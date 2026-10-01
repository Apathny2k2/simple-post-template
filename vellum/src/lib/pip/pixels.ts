/* A one-colour pixel buffer, put on a canvas in one call. Shapes are masks,
   and fainter things (the far arm, a cloud) are the same ink at lower
   strength. Masks turn by nearest-neighbour sampling, so they stay crisp. */

/** 0xRRGGBB */
export type Rgb = number

export type Mask = { w: number; h: number; on: Uint8Array }

/** Rows as strings: '#' is ink, anything else is empty. */
export function mask(rows: string[]): Mask {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const on = new Uint8Array(w * h)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') on[y * w + x] = 1
  })
  return { w, h, on }
}

export class Pixels {
  w: number
  h: number
  data: Uint8ClampedArray<ArrayBuffer>
  ink: Rgb = 0x535353
  /** added to every draw, for a knock */
  ox = 0
  oy = 0
  /** nothing is drawn at or below this row; lets a figure sink into lava */
  clipY = Infinity

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }

  clear() {
    this.data.fill(0)
  }

  on(x: number, y: number): boolean {
    const X = Math.floor(x)
    const Y = Math.floor(y)
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) return false
    return this.data[(Y * this.w + X) * 4 + 3] > 0
  }

  /** Ink one pixel at strength a (0..1), laid over whatever is there. */
  dot(x: number, y: number, a = 1) {
    const X = Math.floor(x + this.ox)
    const Y = Math.floor(y + this.oy)
    if (X < 0 || Y < 0 || X >= this.w || Y >= this.h || a <= 0 || Y >= this.clipY) return
    const d = this.data
    const i = (Y * this.w + X) * 4
    const was = d[i + 3] / 255
    const now = Math.min(1, a + was * (1 - a))
    d[i] = (this.ink >> 16) & 255
    d[i + 1] = (this.ink >> 8) & 255
    d[i + 2] = this.ink & 255
    d[i + 3] = Math.round(now * 255)
  }

  rect(x: number, y: number, w: number, h: number, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, a)
  }

  /** A 1px outline. */
  frame(x: number, y: number, w: number, h: number, a = 1) {
    for (let i = 0; i < w; i++) {
      this.dot(x + i, y, a)
      this.dot(x + i, y + h - 1, a)
    }
    for (let j = 1; j < h - 1; j++) {
      this.dot(x, y + j, a)
      this.dot(x + w - 1, y + j, a)
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, a = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) this.dot(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), a)
  }
}

export type Stamp = { a?: number; flip?: boolean; keep?: (x: number, y: number) => boolean }

/** Inks a mask with its top-left corner at x, y. */
export function stamp(p: Pixels, m: Mask, x: number, y: number, how: Stamp = {}) {
  const a = how.a ?? 1
  const X = Math.floor(x)
  const Y = Math.floor(y)
  for (let j = 0; j < m.h; j++) {
    for (let i = 0; i < m.w; i++) {
      if (!m.on[j * m.w + (how.flip ? m.w - 1 - i : i)]) continue
      if (how.keep && !how.keep(X + i, Y + j)) continue
      p.dot(X + i, Y + j, a)
    }
  }
}

/** Inks a mask turned `angle` radians clockwise about a pivot in mask pixels, which lands on x, y. */
export function stampTurned(
  p: Pixels,
  m: Mask,
  pivotX: number,
  pivotY: number,
  x: number,
  y: number,
  angle: number,
  how: Stamp = {},
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const reach = Math.ceil(Math.hypot(Math.max(pivotX, m.w - pivotX), Math.max(pivotY, m.h - pivotY))) + 1
  const a = how.a ?? 1
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  for (let Y = y0 - reach; Y <= y0 + reach; Y++) {
    for (let X = x0 - reach; X <= x0 + reach; X++) {
      const dx = X + 0.5 - x
      const dy = Y + 0.5 - y
      const u = Math.floor(pivotX + dx * cos + dy * sin)
      const v = Math.floor(pivotY - dx * sin + dy * cos)
      if (u < 0 || v < 0 || u >= m.w || v >= m.h) continue
      if (!m.on[v * m.w + (how.flip ? m.w - 1 - u : u)]) continue
      if (how.keep && !how.keep(X, Y)) continue
      p.dot(X, Y, a)
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

/** A stable 0..1 value for a pair of integers, for placing ground specks without storing them. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** '#rrggbb' or 'rgb(r, g, b)' to 0xRRGGBB. */
export function parseColour(css: string, fallback: Rgb): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim())
  if (hex) return parseInt(hex[1], 16)
  const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(css)
  if (rgb) return (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3])
  return fallback
}
