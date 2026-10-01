/* Entering a server, drawn over the page you entered it from: a ground line
   runs out across the middle of the screen, a round purple swirl grows on it,
   and Pip walks up and is pulled into it, turning as he shrinks. The Studio
   opens through the swirl and it closes behind him. Nothing else is drawn,
   so the page shows through. It is in colour, so it draws into its own RGBA
   buffer; Pip is drawn into a mask first and laid in with the server's
   colour. Every frame is a function of time alone. */

import { Pixels, hash2 } from './pixels'
import { LEG_LEN, drawPip, standing } from './figure'
import type { Rgb } from '../title'

/** Seconds into the scene. */
export const ARRIVE = {
  /** the ground line runs out from the middle */
  line: 0.35,
  /** the swirl grows from nothing to full size */
  grow: [0.25, 1.1] as const,
  /** Pip reaches the swirl and it starts to pull him in */
  enter: 1.35,
  /** he is gone; the Studio opens through the swirl */
  gone: 2.0,
  /** the swirl swells a little and closes, as the Studio opens */
  close: [2.1, 2.5] as const,
  /** the last sparks are out; the title follows */
  end: 2.75,
}

/* The Studio can take a moment to draw, and the swirl should shut while it
   opens, not before. So everything after `gone` waits for `opened`, the time
   the Studio was drawn: until then the swirl stays open, and from then on
   the rest runs late by however long it waited. null means not yet drawn. */
const lateBy = (opened: number | null) => (opened === null ? Infinity : Math.max(0, opened - ARRIVE.gone))

/** When the scene is over, given when the Studio was drawn. */
export const arriveEnd = (opened: number | null) => ARRIVE.end + lateBy(opened)

/** How fast Pip walks, in art pixels a second. */
const WALK = 22
/** How far Pip starts from the swirl's rim, in art pixels. */
const APPROACH = 26
/** Pip's box, and the scratch buffer his turned copy is drawn through. */
const BOX = 96

const GLOW: Rgb = [124, 58, 237]
const SWIRL: Rgb[] = [
  [46, 8, 96],
  [74, 20, 150],
  [104, 45, 210],
  [146, 92, 250],
  [196, 160, 255],
  [236, 226, 255],
]
const FLASH: Rgb = [240, 232, 255]
/** the dark rim round Pip, so he reads over any page */
const RIM: Rgb = [10, 8, 18]

const clamp01 = (k: number) => Math.max(0, Math.min(1, k))
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3
const easeIn = (k: number) => clamp01(k) ** 2
/** eases out with a small overshoot, so the swirl settles into its size */
const easeOutBack = (k: number) => {
  const c = 1.4
  const u = clamp01(k) - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}
/** dips below 0 before it rises, so the swirl swells before it shuts */
const easeInBack = (k: number) => {
  const c = 1.7
  const u = clamp01(k)
  return (c + 1) * u * u * u - c * u * u
}

/** Screen pixels to one art pixel, so Pip stands about as tall as a row of the server list. */
export function arriveScale(h: number) {
  return Math.max(2, Math.min(5, Math.round(h / 380)))
}

export class ArriveScene {
  readonly w: number
  readonly h: number
  readonly data: Uint8ClampedArray<ArrayBuffer>
  private readonly pip: Pixels
  private readonly ink = new Uint8Array(BOX * BOX)
  readonly ground: number
  /** the swirl's radius at full size */
  readonly radius: number
  /** the swirl's middle */
  readonly px: number
  readonly py: number
  private readonly lineHalf: number

  /** `ground` is the row the line runs along; by default a little below the middle. */
  constructor(w: number, h: number, ground = Math.round(h * 0.56)) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
    this.pip = new Pixels(w, h)
    this.pip.ink = 0xffffff
    this.ground = ground
    this.radius = Math.round(Math.max(24, Math.min(44, (w - 50) / 4)))
    // Pip and the swirl sit together in the middle, the swirl standing on the line
    this.px = Math.floor(w / 2) + Math.round((APPROACH + 8) / 2)
    this.py = this.ground - this.radius
    this.lineHalf = Math.round(Math.min(w / 2 - 8, Math.max(this.radius * 2 + 70, w * 0.36)))
  }

  /** How big the swirl is: 0, up to a touch over 1, and back to 0 as it closes. */
  size(t: number, opened: number | null = ARRIVE.gone) {
    const [a, b] = ARRIVE.grow
    const late = lateBy(opened)
    const c = ARRIVE.close[0] + late
    const d = ARRIVE.close[1] + late
    if (t <= a || t >= d) return 0
    const open = easeOutBack((t - a) / (b - a))
    return t <= c ? open : Math.max(0, open * (1 - easeInBack((t - c) / (d - c))))
  }

  /** How far round the swirl has turned: steadily, then faster as it pulls and shuts. */
  spin(t: number) {
    const fast = Math.min(1.4, Math.max(0, t - ARRIVE.enter))
    return t * 2.4 + fast * fast * 5
  }

  /** Where Pip's feet are at time t. */
  pipX(t: number) {
    return this.px - this.radius - APPROACH + WALK * t
  }

  /** The frame at time t. `opened` is when the Studio was drawn; see lateBy. */
  render(t: number, pipColour: Rgb, opened: number | null = ARRIVE.gone) {
    this.data.fill(0)
    const late = lateBy(opened)
    const s = this.size(t, opened)
    const R = this.radius * s
    const { px, py, ground } = this

    // ---- the ground line, out from the middle, gone as the swirl shuts
    const out = easeOut(t / ARRIVE.line) * this.lineHalf
    const fade = 1 - clamp01((t - ARRIVE.gone) / 0.35)
    if (out > 0 && fade > 0) {
      const mid = Math.floor(this.w / 2)
      for (let x = Math.round(mid - out); x <= mid + out; x++) {
        const a = 0.75 * clamp01((out - Math.abs(x - mid)) / 24) * fade
        this.blend(x, ground, pipColour, a)
        // the odd pebble on the line and specks under it, as in Pip's other scenes
        if (hash2(x, 5) < 0.035) this.blend(x, ground - 1, pipColour, a)
        if (hash2(x, 9) < 0.08) this.blend(x, ground + 2 + Math.floor(hash2(x, 10) * 6), pipColour, a * 0.5)
      }
    }

    if (s > 0) {
      // ---- its light on the page, and a pool of it on the floor
      const lr = R * 1.7
      this.each(px - lr, py - lr, px + lr, py + lr, (x, y) => {
        const d = Math.hypot(x - px, y - py) / lr
        if (d < 1) this.blend(x, y, GLOW, 0.22 * Math.min(1, s) * (1 - d) ** 2)
      })
      const rx = R * 1.3
      this.each(px - rx, ground - 3, px + rx, ground + 4, (x, y) => {
        const d = Math.hypot((x - px) / rx, (y - ground - 0.5) / 3.5)
        if (d < 1) this.blend(x, y, SWIRL[3], 0.3 * Math.min(1, s) * (1 - d) ** 1.5)
      })

      // ---- the swirl: three arms turning round a bright middle, running past the rim as wisps
      const turn = this.spin(t)
      const reach = R * 1.3
      const tick = Math.floor(t * 12)
      this.each(px - reach, py - reach, px + reach, py + reach, (x, y) => {
        const dx = x + 0.5 - px
        const dy = y + 0.5 - py
        const r = Math.hypot(dx, dy) / Math.max(1, R)
        if (r > 1.3) return
        const arm = (Math.cos(3 * (Math.atan2(dy, dx) - turn) + 6 * r) + 1) / 2
        const band = clamp01((arm - 0.45) / 0.4)
        let a: number
        let k: number
        if (r <= 1) {
          // dark at the rim, lit along the arms, white-hot in the middle
          a = Math.max(0.94 * clamp01((1 - r) / 0.12), band * 0.9)
          k = 0.12 + 0.5 * band * (1 - 0.35 * r) + 0.9 * clamp01(1 - r / 0.3)
        } else {
          // past the rim the arms thin out
          a = band * clamp01((1.3 - r) / 0.3) * 0.85
          k = 0.35 + 0.3 * band
        }
        if (r < 0.95 && hash2(x * 3 + tick, y * 5) > 0.985) k = 0.95
        this.blend(x, y, SWIRL[Math.min(SWIRL.length - 1, Math.floor(clamp01(k) * SWIRL.length))], a)
      })

      // ---- sparks, pulled round and in
      if (t < ARRIVE.close[0] + late) {
        for (let n = 0; n < 22; n++) {
          const period = 1 + hash2(n, 3) * 0.7
          const q = (((t + hash2(n, 4) * period) / period) % 1 + 1) % 1
          const angle = hash2(n, 1) * Math.PI * 2 + q * 2.6
          const dist = R * (1.75 - 1.45 * q)
          const a = Math.sin(q * Math.PI) * 0.9 * Math.min(1, s)
          this.blend(Math.round(px + Math.cos(angle) * dist), Math.round(py + Math.sin(angle) * dist), SWIRL[5], a)
        }
      }
    }

    // ---- Pip, in the server's colour
    if (t < ARRIVE.gone) this.drawPip(t, pipColour)

    // ---- as it shuts: a flash where it was, and a burst of sparks
    const shut = ARRIVE.close[1] + late
    const end = ARRIVE.end + late
    if (t >= shut - 0.05 && t < end) {
      const q = clamp01((t - shut + 0.05) / (end - shut + 0.05))
      const flash = 6 * (1 - q)
      this.each(px - flash, py - flash, px + flash, py + flash, (x, y) => {
        const d = Math.hypot(x - px, y - py) / Math.max(0.5, flash)
        if (d < 1) this.blend(x, y, FLASH, (1 - d) * (1 - q))
      })
      for (let n = 0; n < 18; n++) {
        const angle = (n / 18) * Math.PI * 2 + hash2(n, 5)
        const dist = (this.radius * 0.5 + hash2(n, 6) * this.radius * 0.6) * (1 - (1 - q) ** 3)
        this.blend(Math.round(px + Math.cos(angle) * dist), Math.round(py + Math.sin(angle) * dist), n % 3 ? SWIRL[4] : FLASH, 1 - q)
      }
    }
  }

  /** Pip walking, then pulled towards the swirl's middle, smaller and further turned each frame. */
  private drawPip(t: number, colour: Rgb) {
    const x = this.pipX(t)
    const me = standing(x)
    me.y = this.ground
    const stride = ((x - this.pipX(0)) / 12) * Math.PI * 2
    const sw = Math.sin(stride)
    me.legNear = 0.55 * sw
    me.legFar = -0.55 * sw
    me.armNear = -0.3 * sw
    me.armFar = 0.4 * sw
    me.pick = -me.armNear + 1.0
    me.bob = Math.round(LEG_LEN * (1 - Math.cos(0.55 * sw)) * 0.9)
    const p = this.pip
    p.clear()
    drawPip(p, me, Math.round(x), t)

    const pull = easeIn((t - ARRIVE.enter) / (ARRIVE.gone - ARRIVE.enter))
    const k = 1 - pull
    if (k < 0.04) return
    const turn = pull * Math.PI * 2.4
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    const { px, py, w, h } = this

    // his box, shrunk and turned about the swirl's middle
    const bx = Math.round(x)
    const corners = [
      [bx - 17, this.ground - 35],
      [bx + 18, this.ground - 35],
      [bx - 17, this.ground + 2],
      [bx + 18, this.ground + 2],
    ].map(([cx, cy]) => {
      const dx = (cx - px) * k
      const dy = (cy - py) * k
      return [px + dx * cos - dy * sin, py + dx * sin + dy * cos]
    })
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))) - 1)
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))) - 1)
    const bw = Math.min(BOX - 1, Math.min(w - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))) + 1) - x0 + 1)
    const bh = Math.min(BOX - 1, Math.min(h - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))) + 1) - y0 + 1)

    // each pixel of the turned copy looks back into the mask, so nothing tears as he turns
    const ink = this.ink
    ink.fill(0)
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const dx = x0 + i + 0.5 - px
        const dy = y0 + j + 0.5 - py
        const sx = Math.floor(px + (dx * cos + dy * sin) / k)
        const sy = Math.floor(py + (dy * cos - dx * sin) / k)
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue
        ink[j * BOX + i] = p.data[(sy * w + sx) * 4 + 3]
      }
    }
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= bw || j >= bh ? 0 : ink[j * BOX + i])
    const shown = clamp01(t / 0.25) * (1 - pull * pull)
    const tint = mix(colour, SWIRL[5], pull)
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const a = at(i, j)
        if (a) {
          this.blend(x0 + i, y0 + j, tint, (a / 255) * shown)
        } else if (
          at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1) ||
          at(i - 1, j - 1) || at(i + 1, j - 1) || at(i - 1, j + 1) || at(i + 1, j + 1)
        ) {
          this.blend(x0 + i, y0 + j, RIM, 0.6 * shown)
        }
      }
    }
  }

  /** Calls fn for every pixel in a box, clipped to the screen. */
  private each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void) {
    const xa = Math.max(0, Math.floor(x0))
    const ya = Math.max(0, Math.floor(y0))
    const xb = Math.min(this.w - 1, Math.ceil(x1))
    const yb = Math.min(this.h - 1, Math.ceil(y1))
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) fn(x, y)
  }

  /** Lays colour c over a pixel at opacity a, over whatever is there, clear or not. */
  private blend(x: number, y: number, c: Rgb, a: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return
    const i = (y * this.w + x) * 4
    const d = this.data
    const sa = Math.min(1, a)
    const da = d[i + 3] / 255
    const oa = sa + da * (1 - sa)
    const keep = (da * (1 - sa)) / oa
    const take = sa / oa
    d[i] = c[0] * take + d[i] * keep
    d[i + 1] = c[1] * take + d[i + 1] * keep
    d[i + 2] = c[2] * take + d[i + 2] * keep
    d[i + 3] = oa * 255
  }
}
