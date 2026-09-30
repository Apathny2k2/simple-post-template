/* Entering a server: Pip walks up, a purple portal grows in front of him,
   he walks in, and the portal floods the screen while the Studio opens
   behind it. Unlike the other scenes this one is in colour, so it draws
   into its own RGBA buffer; Pip is drawn into a mask first and laid in
   with the server's colour. Every frame is a function of time alone. */

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
  /** the portal floods the screen */
  flash: [2.3, 2.75] as const,
  /** the Studio opens underneath, while the screen is purple */
  open: 2.6,
  /** the flood is full; the overlay fades out from here */
  end: 2.75,
}

/** The portal at full size, in art pixels: outer width, height and frame. */
const PORTAL = { w: 40, h: 62, frame: 6 }
/** How fast Pip walks, in art pixels a second. */
const WALK = 22

const BG: Rgb = [12, 10, 20]
const FLOOD: Rgb = [233, 221, 255]
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
const GROUND_LINE: Rgb = [58, 52, 80]

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

  /** How big the portal is, 0 to a touch over 1. */
  portalSize(t: number) {
    const [a, b] = ARRIVE.grow
    return t <= a ? 0 : easeOutBack((t - a) / (b - a))
  }

  /** Where Pip's feet are at time t. */
  pipX(t: number) {
    return this.cx - 36 + WALK * t
  }

  render(t: number, pipColour: Rgb) {
    const { w, h, data } = this
    const s = Math.max(0, this.portalSize(t))
    const px = this.cx + 22
    const pw = Math.max(0, Math.round(PORTAL.w * s))
    const ph = Math.max(0, Math.round(PORTAL.h * s))
    const pf = Math.max(1, Math.round(PORTAL.frame * s))
    const left = px - Math.floor(pw / 2)
    const top = this.ground - ph
    const inner = { x0: left + pf, y0: top + pf, x1: left + pw - pf, y1: this.ground - pf }
    const glowY = this.ground - ph / 2
    const glowR = 70 * Math.min(1, s)
    const flash = clamp01((t - ARRIVE.flash[0]) / (ARRIVE.flash[1] - ARRIVE.flash[0]))
    // the portal lights up as it reaches full size, then brightens into the flood
    const pulse = t > ARRIVE.grow[1] ? Math.max(0, 1 - (t - ARRIVE.grow[1]) / 0.25) : 0

    // ---- ground, glow and portal, one pixel at a time
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let c: Rgb = BG
        if (glowR > 0) {
          const d = Math.hypot((x - px) / 1.3, (y - glowY) / 1.1)
          if (d < glowR) c = mix(c, GLOW, 0.3 * s * (1 - d / glowR) ** 2)
        }
        if (y === this.ground || (y > this.ground && hash2(x, y) < 0.012)) {
          const lit = glowR > 0 ? clamp01(1 - Math.abs(x - px) / (glowR * 1.2)) * s : 0
          c = mix(c, mix(GROUND_LINE, SWIRL[3], lit * 0.7), y === this.ground ? 1 : 0.6)
        }
        if (pw > 0 && x >= left && x < left + pw && y >= top && y < this.ground) {
          const inside = x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1
          if (inside) {
            c = mix(swirl(x - inner.x0, y - inner.y0, t), SWIRL[4], pulse * 0.5)
          } else {
            // obsidian blocks: a seam every block, a lit edge on top and left
            const bu = Math.floor((x - left) / pf)
            const bv = Math.floor((y - top) / pf)
            const lu = (x - left) % pf
            const lv = (y - top) % pf
            c = OBSIDIAN
            if (lu === 0 || lv === 0) c = OBSIDIAN_SEAM
            else if (lv === 1 || lu === 1) c = OBSIDIAN_LIT
            else if (hash2(bu * 13 + x, bv * 7 + y) > 0.93) c = OBSIDIAN_LIT
          }
        }
        const i = (y * w + x) * 4
        data[i] = c[0]
        data[i + 1] = c[1]
        data[i + 2] = c[2]
        data[i + 3] = 255
      }
    }

    // ---- sparks drifting into the portal
    if (s > 0.3 && t < ARRIVE.flash[1]) {
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
    if (t < ARRIVE.gone) {
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
      // he fits in a box a little wider than his pickaxe swing
      const bx = Math.round(x)
      for (let y = Math.max(0, this.ground - 34); y < Math.min(h, this.ground + 2); y++) {
        for (let xx = Math.max(0, bx - 16); xx < Math.min(w, bx + 17); xx++) {
          const a = p.data[(y * w + xx) * 4 + 3] / 255
          if (!a) continue
          const inPortal = pw > 0 && xx >= inner.x0 && xx < inner.x1 && y >= inner.y0 && y <= this.ground
          if (!inPortal) {
            this.blend(xx, y, pipColour, a)
            continue
          }
          // the deeper a pixel is into the purple, the more it has gone
          const depth = clamp01((xx - inner.x0 + 1) / 8 + through * 0.6)
          this.blend(xx, y, mix(pipColour, SWIRL[4], depth), a * (1 - depth))
        }
      }
    }

    // ---- the portal spreads from its middle until it fills the screen, as standing in one does in the game
    if (flash > 0) {
      const far = Math.hypot(Math.max(px, w - px), Math.max(glowY, h - glowY))
      const r = far * 1.15 * flash ** 1.4
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const d = Math.hypot(x - px, y - glowY)
          const edge = clamp01((r - d) / 18)
          if (edge > 0) this.blend(x, y, mix(swirl(x, y, t), FLOOD, 0.15 * (1 - edge)), edge)
        }
      }
    }
  }

  private blend(x: number, y: number, c: Rgb, a: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return
    const i = (y * this.w + x) * 4
    const d = this.data
    const k = Math.min(1, a)
    d[i] = d[i] + (c[0] - d[i]) * k
    d[i + 1] = d[i + 1] + (c[1] - d[i + 1]) * k
    d[i + 2] = d[i + 2] + (c[2] - d[i + 2]) * k
  }
}

