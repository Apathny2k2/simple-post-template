/* A small pixel buffer drawn by hand and put on a canvas in one call.
   Everything is whole pixels: sprites rotate by nearest-neighbour
   sampling, so a swinging arm stays as crisp as a standing one. */

/** 0xRRGGBB */
export type Rgb = number

export type Sprite = { w: number; h: number; px: Int32Array }

/** Transparent in a sprite's pixel list. */
const CLEAR = -1

/** Sprite rows as strings, one character per pixel; '.' and ' ' are transparent. */
export function sprite(rows: string[], pal: Record<string, Rgb>): Sprite {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const px = new Int32Array(w * h).fill(CLEAR)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const c = pal[ch]
      if (c === undefined) throw new Error(`no colour for '${ch}'`)
      px[y * w + x] = c
    }
  })
  return { w, h, px }
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t))
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k
  const bl = (a & 255) + ((b & 255) - (a & 255)) * k
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

export function shade(c: Rgb, k: number): Rgb {
  return k < 1 ? mix(c, 0x000000, 1 - k) : mix(c, 0xffffff, k - 1)
}

export type Ink = {
  /** mixed into every pixel, for the hurt flash and the portal's purple */
  tint?: Rgb
  tintBy?: number
  /** 0..1; below 1 the sprite is laid over what is there */
  alpha?: number
  flip?: boolean
}

export class Pixels {
  w: number
  h: number
  data: Uint8ClampedArray<ArrayBuffer>
  /** added to every draw that goes through put(), for a screen shake */
  ox = 0
  oy = 0

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }

  copyFrom(other: Pixels) {
    this.data.set(other.data)
  }

  get(x: number, y: number): Rgb | null {
    const X = Math.floor(x)
    const Y = Math.floor(y)
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return null
    const i = (Y * this.w + X) * 4
    if (this.data[i + 3] === 0) return null
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2]
  }

  put(x: number, y: number, c: Rgb, a = 1) {
    const X = Math.floor(x + this.ox)
    const Y = Math.floor(y + this.oy)
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h || a <= 0) return
    const d = this.data
    const i = (Y * this.w + X) * 4
    const r = (c >> 16) & 255
    const g = (c >> 8) & 255
    const b = c & 255
    if (a >= 1 || d[i + 3] === 0) {
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
    } else {
      d[i] += (r - d[i]) * a
      d[i + 1] += (g - d[i + 1]) * a
      d[i + 2] += (b - d[i + 2]) * a
    }
    d[i + 3] = 255
  }

  rect(x: number, y: number, w: number, h: number, c: Rgb, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c, a)
  }

  /** Brighten towards a colour, strongest at the centre, in steps so it still reads as pixels. */
  light(cx: number, cy: number, radius: number, c: Rgb, strength: number, squash = 1) {
    const r2 = radius * radius
    const ry = radius * squash
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
        const d2 = (x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / squash) ** 2
        if (d2 > r2) continue
        const k = Math.round((1 - Math.sqrt(d2) / radius) ** 2 * 8) / 8
        this.lighten(x, y, c, k * strength)
      }
    }
  }

  lighten(x: number, y: number, c: Rgb, a: number) {
    const X = Math.floor(x + this.ox)
    const Y = Math.floor(y + this.oy)
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h || a <= 0) return
    const d = this.data
    const i = (Y * this.w + X) * 4
    d[i] += ((c >> 16) & 255) * a
    d[i + 1] += ((c >> 8) & 255) * a
    d[i + 2] += (c & 255) * a
  }
}

function ink(c: Rgb, how: Ink): Rgb {
  return how.tint !== undefined && how.tintBy ? mix(c, how.tint, how.tintBy) : c
}

/** Draws a sprite with its top-left corner at x, y. */
export function blit(p: Pixels, s: Sprite, x: number, y: number, how: Ink = {}) {
  const a = how.alpha ?? 1
  for (let j = 0; j < s.h; j++) {
    for (let i = 0; i < s.w; i++) {
      const c = s.px[j * s.w + (how.flip ? s.w - 1 - i : i)]
      if (c !== CLEAR) p.put(x + i, y + j, ink(c, how), a)
    }
  }
}

/**
 * Draws a sprite turned by `angle` radians (clockwise on screen) about
 * a pivot given in the sprite's own pixels, with the pivot landing on
 * x, y. Each screen pixel samples the one sprite pixel under it, so
 * nothing is blurred.
 */
export function blitTurned(
  p: Pixels,
  s: Sprite,
  pivotX: number,
  pivotY: number,
  x: number,
  y: number,
  angle: number,
  how: Ink = {},
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const reach = Math.ceil(Math.hypot(Math.max(pivotX, s.w - pivotX), Math.max(pivotY, s.h - pivotY))) + 1
  const a = how.alpha ?? 1
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  for (let Y = y0 - reach; Y <= y0 + reach; Y++) {
    for (let X = x0 - reach; X <= x0 + reach; X++) {
      const dx = X + 0.5 - x
      const dy = Y + 0.5 - y
      const u = Math.floor(pivotX + dx * cos + dy * sin)
      const v = Math.floor(pivotY - dx * sin + dy * cos)
      if (u < 0 || v < 0 || u >= s.w || v >= s.h) continue
      const c = s.px[v * s.w + (how.flip ? s.w - 1 - u : u)]
      if (c !== CLEAR) p.put(X, Y, ink(c, how), a)
    }
  }
}

/** A small seeded random source, so a scene plays the same way every time. */
export function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable 0..1 value for a pair of integers, for texturing blocks without storing them. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
