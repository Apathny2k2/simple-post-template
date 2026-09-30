/* Entering a server: Pip walks up the middle of the screen, a purple portal
   grows in front of him, he walks in, and it closes behind him. The Studio
   opens underneath at the start, so the scene is drawn over it: everything
   but Pip, the portal and its light is clear. It is in colour, so it draws
   into its own RGBA buffer; Pip is drawn into a mask first and laid in with
   the server's colour. Every frame is a function of time alone. */

import { Pixels, hash2 } from './pixels'
import { LEG_LEN, drawPip, standing } from './figure'
import type { Rgb } from '../title'

/** Seconds into the scene. */
export const ARRIVE = {
  /** the portal grows from nothing to full size */
  grow: [0.2, 1.15] as const,
  /** Pip's front foot reaches the purple */
  enter: 1.75,
  /** he is through */
  gone: 2.45,
  /** the portal swells a little and closes behind him */
  close: [2.5, 2.85] as const,
  /** the last sparks are out; the overlay fades from here */
  end: 3.05,
}

/** The portal at full size, in art pixels: outer width, height and frame. */
const PORTAL = { w: 40, h: 62, frame: 6 }
/** How fast Pip walks, in art pixels a second. */
const WALK = 22

const OBSIDIAN: Rgb = [26, 16, 37]
const OBSIDIAN_LIT: Rgb = [58, 36, 88]
const OBSIDIAN_SEAM: Rgb = [13, 7, 20]
const GLOW: Rgb = [124, 58, 237]
const SWIRL: Rgb[] = [
  [59, 10, 122],
  [91, 29, 184],
  [124, 58, 237],
  [166, 107, 255],
  [217, 184, 255],
]
const FLASH: Rgb = [233, 221, 255]
/** the dark rim round Pip and his shadow, so he reads over any card */
const RIM: Rgb = [10, 8, 18]

const clamp01 = (k: number) => Math.max(0, Math.min(1, k))

/** The portal's purple at a point, moving with time. */
function swirl(u: number, v: number, t: number): Rgb {
  const tick = Math.floor(t * 10)
  const n1 = Math.sin(u * 0.45 + t * 2.1 + Math.sin(v * 0.23 - t * 1.3) * 2.2)
  const n2 = Math.sin(v * 0.31 - t * 2.7 + Math.sin(u * 0.19 + t * 0.9) * 1.8)
  let k = (n1 + n2) * 0.25 + 0.5 + (hash2(u + tick * 31, v) - 0.5) * 0.14
  if (hash2(u * 7 + tick, v * 3 + 11) > 0.992) k = 1
  return SWIRL[Math.max(0, Math.min(SWIRL.length - 1, Math.floor(k * SWIRL.length)))]
}
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
/** eases out with a small overshoot, so the portal settles into its size */
const easeOutBack = (k: number) => {
  const c = 1.4
  const u = clamp01(k) - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}
/** dips below 0 before it rises, so the portal swells before it shuts */
const easeInBack = (k: number) => {
  const c = 1.7
  const u = clamp01(k)
  return (c + 1) * u * u * u - c * u * u
}

/** The largest whole-number zoom at which the scene fits a w x h screen. */
export function arriveScale(w: number, h: number) {
  return Math.max(2, Math.min(7, Math.floor((h * 0.5) / PORTAL.h), Math.floor(w / 104)))
}

export class ArriveScene {
  readonly w: number
  readonly h: number
  readonly data: Uint8ClampedArray<ArrayBuffer>
  private readonly pip: Pixels
  private readonly ground: number
  private readonly cx: number

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
    this.pip = new Pixels(w, h)
    this.pip.ink = 0xffffff
    this.cx = Math.floor(w / 2)
    // the portal's middle sits on the middle of the screen
    this.ground = Math.floor(h / 2) + Math.floor(PORTAL.h / 2)
  }

  /** How big the portal is: 0, up to a touch over 1, and back to 0 as it closes. */
  portalSize(t: number) {
    const [a, b] = ARRIVE.grow
    const [c, d] = ARRIVE.close
    if (t <= a || t >= d) return 0
    const open = easeOutBack((t - a) / (b - a))
    return t <= c ? open : Math.max(0, open * (1 - easeInBack((t - c) / (d - c))))
  }

  /** Where Pip's feet are at time t. */
  pipX(t: number) {
    return this.cx - 36 + WALK * t
  }

  render(t: number, pipColour: Rgb) {
    this.data.fill(0)
    const s = this.portalSize(t)
    const closing = t > ARRIVE.close[0]
    const px = this.cx + 22
    const pw = Math.round(PORTAL.w * s)
    const ph = Math.round(PORTAL.h * s)
    const pf = Math.max(1, Math.round(PORTAL.frame * s))
    // it grows up from the floor, and shuts towards its middle
    const middle = this.ground - PORTAL.h / 2
    const bottom = closing ? Math.round(middle + ph / 2) : this.ground
    const left = px - Math.floor(pw / 2)
    const top = bottom - ph
    const inner = { x0: left + pf, y0: top + pf, x1: left + pw - pf, y1: bottom - pf }
    const glowY = bottom - ph / 2
    // the portal lights up as it reaches full size
    const pulse = t > ARRIVE.grow[1] ? Math.max(0, 1 - (t - ARRIVE.grow[1]) / 0.25) : 0

    // ---- its light, on the page behind and in a pool on the floor
    if (s > 0) {
      const r = 54 * Math.min(1, s)
      this.each(px - r * 1.2, glowY - r * 1.1, px + r * 1.2, glowY + r * 1.1, (x, y) => {
        const d = Math.hypot((x - px) / 1.2, (y - glowY) / 1.1) / r
        if (d < 1) this.blend(x, y, GLOW, 0.32 * Math.min(1, s) * (1 - d) ** 2)
      })
      const rx = 48 * Math.min(1, s)
      if (!closing) {
        this.each(px - rx, this.ground - 4, px + rx, this.ground + 5, (x, y) => {
          const d = Math.hypot((x - px) / rx, (y - this.ground - 0.5) / 4.5)
          if (d < 1) this.blend(x, y, SWIRL[3], 0.3 * s * (1 - d) ** 1.5)
        })
      }
    }

    // ---- the portal: obsidian blocks round a swirl of purple
    if (pw > 0 && ph > 0) {
      this.each(left, top, left + pw - 1, bottom - 1, (x, y) => {
        const inside = x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1
        let c: Rgb
        if (inside) {
          c = mix(swirl(x - inner.x0, y - inner.y0, t), SWIRL[4], pulse * 0.5)
        } else {
          // a seam every block, a lit edge on top and left
          const bu = Math.floor((x - left) / pf)
          const bv = Math.floor((y - top) / pf)
          const lu = (x - left) % pf
          const lv = (y - top) % pf
          c = OBSIDIAN
          if (lu === 0 || lv === 0) c = OBSIDIAN_SEAM
          else if (lv === 1 || lu === 1) c = OBSIDIAN_LIT
          else if (hash2(bu * 13 + x, bv * 7 + y) > 0.93) c = OBSIDIAN_LIT
        }
        this.blend(x, y, c, 1)
      })
    }

    // ---- sparks drifting into the portal while it is open
    if (s > 0.3 && !closing) {
      for (let n = 0; n < 28; n++) {
        const angle = hash2(n, 1) * Math.PI * 2
        const reach = (26 + hash2(n, 2) * 34) * Math.min(1, s)
        const period = 0.9 + hash2(n, 3) * 0.8
        const q = (((t + hash2(n, 4) * period) / period) % 1 + 1) % 1
        const x = Math.round(px + Math.cos(angle) * reach * (1 - q))
        const y = Math.round(glowY + Math.sin(angle) * reach * 1.25 * (1 - q))
        this.blend(x, y, SWIRL[4], Math.sin(q * Math.PI) * 0.9 * Math.min(1, s))
      }
    }

    // ---- Pip, in the server's colour, fading as he steps through
    if (t < ARRIVE.gone) this.drawPip(t, pipColour, pw > 0 ? inner : null)

    // ---- as it shuts: a flash where it was, and a burst of sparks
    const [, shut] = ARRIVE.close
    if (t >= shut - 0.05 && t < ARRIVE.end) {
      const q = clamp01((t - shut + 0.05) / (ARRIVE.end - shut + 0.05))
      const flash = 5 * (1 - q)
      this.each(px - flash, middle - flash, px + flash, middle + flash, (x, y) => {
        const d = Math.hypot(x - px, y - middle) / Math.max(0.5, flash)
        if (d < 1) this.blend(x, y, FLASH, (1 - d) * (1 - q))
      })
      for (let n = 0; n < 18; n++) {
        const angle = (n / 18) * Math.PI * 2 + hash2(n, 5)
        const reach = (18 + hash2(n, 6) * 26) * (1 - (1 - q) ** 3)
        const x = Math.round(px + Math.cos(angle) * reach)
        const y = Math.round(middle + Math.sin(angle) * reach * 1.2)
        this.blend(x, y, n % 3 ? SWIRL[4] : FLASH, 1 - q)
      }
    }
  }

  private drawPip(t: number, colour: Rgb, inner: { x0: number; y0: number; x1: number; y1: number } | null) {
    const { w, h } = this
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
    const through = clamp01((t - ARRIVE.enter) / (ARRIVE.gone - ARRIVE.enter))
    const bx = Math.round(x)

    // his shadow, gone once he is in
    this.each(bx - 9, this.ground - 1, bx + 9, this.ground + 2, (xx, y) => {
      const d = Math.hypot((xx - bx) / 9, (y - this.ground - 0.5) / 2)
      if (d < 1) this.blend(xx, y, RIM, 0.35 * (1 - d) * (1 - through))
    })

    // the deeper a pixel is into the purple, the more it has gone
    const fade = (xx: number, y: number) =>
      inner && xx >= inner.x0 && xx < inner.x1 && y >= inner.y0 && y <= this.ground
        ? clamp01((xx - inner.x0 + 1) / 8 + through * 0.6)
        : 0
    const ink = (xx: number, y: number) =>
      xx >= 0 && y >= 0 && xx < w && y < h && p.data[(y * w + xx) * 4 + 3] > 0

    // he fits in a box a little wider than his pickaxe swing
    const x0 = Math.max(0, bx - 17)
    const x1 = Math.min(w - 1, bx + 18)
    const y0 = Math.max(0, this.ground - 35)
    const y1 = Math.min(h - 1, this.ground + 2)
    // first the rim, one pixel round every inked pixel
    for (let y = y0; y <= y1; y++) {
      for (let xx = x0; xx <= x1; xx++) {
        if (ink(xx, y)) continue
        let near = false
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (ink(xx + dx, y + dy)) near = true
        if (near) this.blend(xx, y, RIM, 0.6 * (1 - fade(xx, y)))
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let xx = x0; xx <= x1; xx++) {
        const a = p.data[(y * w + xx) * 4 + 3] / 255
        if (!a) continue
        const k = fade(xx, y)
        this.blend(xx, y, k ? mix(colour, SWIRL[4], k) : colour, a * (1 - k))
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
