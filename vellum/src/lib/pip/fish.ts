/* Pip fishing: the waiting scene for a person rather than a job, used
   while someone on the team writes back. Same line and same colour as
   the mining scene.

   working  he sits on the bank with his legs over the edge and casts;
            the float rides the water, and now and then something
            nibbles and tugs it under
   done     a bite: the float goes under, a mark pops over his head, he
            strikes, and a letter comes up out of the water to hang over
            his hat
   failed   the line snaps, the float drifts off, and he slumps under a
            rain cloud

   An outcome that arrives mid-cast waits for the float to land.
   `finished` turns true once an ending has played. */

import { Pixels, hash2, seeded, stamp, stampTurned } from './pixels'
import { ALERT, FLOAT, LETTER, RAIN_CLOUD, STAR } from './art'
import { GROUND, HEIGHT, drawClouds, drawGroundColumn } from './scene'
import type { Mood, PipScene } from './scene'
import { drawPip, easeOut, hand, headTop, lerp, standing } from './figure'
import type { Pose } from './figure'

/** the water's surface, a little below the bank */
const WATER = GROUND + 3
const ROD = 13
const GRAVITY = 300
/** the rod's angle above level while he waits */
const REST = 0.8
/** the cast: winding back, the moment the float leaves, and its flight */
const WIND = 0.28
const THROW = 0.34
const FLIGHT = 0.46
/** the letter's flight from the water to over his hat */
const LANDING = 0.55

type PhaseName = 'cast' | 'wait' | 'bite' | 'strike' | 'hold' | 'snap'

type Bit = { x: number; y: number; vx: number; vy: number; age: number; life: number; gravity: number; rain?: boolean }

type Ripple = { x: number; age: number; life: number; speed: number }

type Point = { x: number; y: number }

export class FishScene implements PipScene {
  w: number
  readonly h = HEIGHT
  px: Pixels
  private rand = seeded(23)
  private time = 0
  private mood: Mood = 'idle'
  private phase: { name: PhaseName; t: number } = { name: 'cast', t: 0 }
  private me: Pose
  /** the rod's angle above level */
  private rod = REST
  /** the float's bottom row: dangling, flying, then riding the water */
  private float: Point = { x: 0, y: 0 }
  private thrownFrom: Point | null = null
  /** seconds into a nibble, or null between them */
  private nibble: number | null = null
  private nextNibble = 1.2
  private letter = { x: 0, y: 0, spin: 0 }
  /** seconds the letter has hung over his hat */
  private caught: number | null = null
  /** how far a snapped line's float has drifted */
  private drift = 0
  private bits: Bit[] = []
  private ripples: Ripple[] = []
  private endedAt: number | null = null

  constructor(width = 128) {
    this.w = Math.max(96, Math.round(width))
    this.px = new Pixels(this.w, HEIGHT)
    this.me = standing(this.seat)
    this.pose()
    this.float = this.dangling()
  }

  /** The bank ends here and the water starts. */
  private get edge() {
    return Math.max(30, Math.round(this.w * 0.34))
  }

  /** He sits right at the edge, so his legs hang over it. */
  private get seat() {
    return this.edge - 1
  }

  /** Where the float lands. */
  private get spot() {
    return Math.min(this.edge + 34, this.w - 10)
  }

  get finished() {
    return this.endedAt !== null
  }

  setInk(c: number) {
    this.px.ink = c
  }

  resize(width: number) {
    const w = Math.max(96, Math.round(width))
    if (w === this.w) return
    const ink = this.px.ink
    this.w = w
    this.px = new Pixels(w, HEIGHT)
    this.setInk(ink)
    this.me.x = this.seat
  }

  setMood(mood: Mood) {
    if (mood === this.mood) return
    this.mood = mood
    this.endedAt = null
    const name = this.phase.name
    const ended = name === 'bite' || name === 'strike' || name === 'hold' || name === 'snap'
    if ((mood === 'working' || mood === 'idle') && ended) this.recast()
    // an outcome is taken up in the 'wait' step, once the float is down
  }

  settle() {
    const seconds = this.mood === 'done' || this.mood === 'failed' ? 5 : 1.1
    for (let t = 0; t < seconds && !this.finished; t += 1 / 30) this.step(1 / 30)
    this.bits = this.bits.filter((b) => b.rain)
    this.ripples = []
    this.nibble = null
  }

  /* ---------------- choreography ---------------- */

  private go(name: PhaseName) {
    this.phase = { name, t: 0 }
  }

  private recast() {
    this.bits = []
    this.ripples = []
    this.nibble = null
    this.caught = null
    this.thrownFrom = null
    this.drift = 0
    this.go('cast')
  }

  private bite() {
    this.nibble = null
    this.splash(this.spot, 8, 55)
    this.ripple(this.spot, 0.9, 20)
    this.go('bite')
  }

  private strike() {
    // the letter breaks the surface
    this.splash(this.spot, 6, 45)
    this.letter = { x: this.spot, y: WATER, spin: 0 }
    this.go('strike')
  }

  private snap() {
    this.nibble = null
    this.drift = 0
    this.ripple(this.spot, 0.7, 12)
    this.go('snap')
  }

  /** Two quick tugs, then nothing for a while. */
  private tugging() {
    const n = this.nibble
    return n !== null && ((n >= 0 && n < 0.12) || (n >= 0.26 && n < 0.38))
  }

  step(dt: number) {
    dt = Math.min(dt, 0.05)
    this.time += dt
    const ph = this.phase
    ph.t += dt
    this.pose()

    switch (ph.name) {
      case 'cast': {
        if (ph.t < THROW) {
          this.float = this.dangling()
          break
        }
        this.thrownFrom ??= { ...this.float }
        const k = Math.min(1, (ph.t - THROW) / FLIGHT)
        this.float = {
          x: lerp(this.thrownFrom.x, this.spot, k),
          y: lerp(this.thrownFrom.y, WATER, k) - Math.sin(Math.PI * k) * 10,
        }
        if (k >= 1) {
          this.splash(this.spot, 5, 40)
          this.ripple(this.spot, 0.7, 14)
          this.nextNibble = this.time + 0.4 + this.rand() * 0.6
          this.go('wait')
        }
        break
      }

      case 'wait': {
        if (this.mood === 'done' && ph.t >= 0.15) {
          this.bite()
          break
        }
        if (this.mood === 'failed' && ph.t >= 0.15) {
          this.snap()
          break
        }
        if (this.nibble === null && this.time >= this.nextNibble) this.nibble = 0
        if (this.nibble !== null) {
          const before = this.nibble
          this.nibble += dt
          for (const at of [0, 0.26]) if (before <= at && this.nibble > at) this.ripple(this.spot, 0.55, 12)
          if (this.nibble > 0.5) {
            this.nibble = null
            this.nextNibble = this.time + 0.9 + this.rand() * 1.6
          }
        }
        // it rides the swell, and goes under a little when tugged
        const swell = Math.sin(this.time * 2.4) > 0.7 ? -1 : 0
        this.float = { x: this.spot, y: WATER + swell + (this.tugging() ? 2 : 0) }
        break
      }

      case 'bite':
        this.float = { x: this.spot, y: WATER + Math.min(5, Math.floor(ph.t * 40)) }
        if (ph.t >= 0.36) this.strike()
        break

      case 'strike': {
        const k = Math.min(1, ph.t / LANDING)
        const to = this.prize()
        this.letter = {
          x: lerp(this.spot, to.x, k),
          y: lerp(WATER, to.y, k) - Math.sin(Math.PI * k) * 14,
          // it turns over once on the way up and arrives the right way round
          spin: (1 - easeOut(k)) * Math.PI * 2,
        }
        if (k < 0.8 && this.rand() < dt * 24) {
          this.bits.push({ x: this.letter.x + (this.rand() - 0.5) * 4, y: this.letter.y + 2, vx: 0, vy: 10, age: 0, life: 0.5, gravity: GRAVITY })
        }
        if (k >= 1) {
          this.caught = 0
          this.go('hold')
        }
        break
      }

      case 'hold':
        this.caught = (this.caught ?? 0) + dt
        if (ph.t >= 0.6 && this.endedAt === null) this.endedAt = this.time
        break

      case 'snap': {
        this.drift += dt * 7
        const swell = Math.sin(this.time * 2.4) > 0.7 ? -1 : 0
        this.float = { x: this.spot + this.drift, y: WATER + swell }
        if (ph.t > 0.5 && this.rand() < dt * 18) {
          const me = this.me
          this.bits.push({ x: me.x - 5 + Math.floor(this.rand() * 10), y: headTop(me) - 6, vx: 0, vy: 55, age: 0, life: 1, gravity: 0, rain: true })
        }
        if (ph.t >= 1.7 && this.endedAt === null) this.endedAt = this.time
        break
      }
    }

    this.stepBits(dt)
    this.ripples = this.ripples.filter((r) => (r.age += dt) < r.life)
  }

  /** Seated on the edge, legs swinging over the water, the rod in his hands. */
  private pose() {
    const me = this.me
    const ph = this.phase
    me.x = this.seat
    me.y = GROUND
    me.sit = 1
    me.pick = null
    me.bob = 0
    me.dip = 0
    me.dazed = false
    me.hidden = false
    const swing = Math.sin(this.time * 2.2) * 0.25
    me.legNear = 0.3 + swing
    me.legFar = 0.3 - swing
    me.armFar = 1.0
    let arm = 1.15
    let rod = REST
    switch (ph.name) {
      case 'cast': {
        const t = ph.t
        if (t < WIND) {
          const u = easeOut(t / WIND)
          arm = lerp(1.15, 2.5, u)
          rod = lerp(REST, 2.3, u)
        } else if (t < 0.4) {
          const u = (t - WIND) / (0.4 - WIND)
          arm = lerp(2.5, 1.0, u)
          rod = lerp(2.3, 0.5, u)
        } else {
          const u = easeOut((t - 0.4) / 0.3)
          arm = lerp(1.0, 1.15, u)
          rod = lerp(0.5, REST, u)
        }
        break
      }
      case 'wait':
        if (this.tugging()) {
          arm = 1.27
          rod = REST - 0.12
        }
        break
      case 'bite':
        arm = 1.3
        rod = 0.5
        break
      case 'strike': {
        const u = easeOut(ph.t / 0.14)
        arm = lerp(1.3, 2.3, u)
        rod = lerp(0.5, 1.75, u)
        break
      }
      case 'hold': {
        const u = easeOut(ph.t / 0.35)
        arm = lerp(2.3, 1.2, u)
        rod = lerp(1.75, 0.95, u)
        // a little bounce when the letter arrives
        if (ph.t < 0.16) me.y = GROUND - 1
        break
      }
      case 'snap': {
        const u = easeOut(ph.t / 0.4)
        arm = lerp(1.15, 0.6, u)
        rod = lerp(REST, -0.35, u)
        me.dip = ph.t > 0.6 && (ph.t - 0.6) % 1.8 < 0.6 ? 1 : 0
        break
      }
    }
    me.armNear = arm
    this.rod = rod
  }

  /* ---------------- where things are ---------------- */

  private tip(): Point {
    const h = hand(this.me)
    return { x: h.x + Math.cos(this.rod) * ROD, y: h.y - Math.sin(this.rod) * ROD }
  }

  /** The float hanging a little way under the rod tip. */
  private dangling(): Point {
    const t = this.tip()
    return { x: t.x, y: t.y + 5 }
  }

  /** Where the letter hangs, just over his hat. */
  private prize(): Point {
    return { x: this.me.x, y: headTop(this.me) - 6 }
  }

  private splash(x: number, n: number, force: number) {
    for (let i = 0; i < n; i++) {
      this.bits.push({
        x: x + (this.rand() - 0.5) * 4,
        y: WATER - 1,
        vx: (this.rand() - 0.5) * force,
        vy: -force * (0.5 + this.rand() * 0.5),
        age: 0,
        life: 0.6,
        gravity: GRAVITY,
      })
    }
  }

  private ripple(x: number, life: number, speed: number) {
    this.ripples.push({ x, age: 0, life, speed })
  }

  private stepBits(dt: number) {
    const me = this.me
    const top = headTop(me)
    for (const b of this.bits) {
      b.age += dt
      b.vy += b.gravity * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      // drops end in the water, rain on his hat or the bank
      if (!b.rain && b.vy > 0 && b.y >= WATER) b.age = b.life
      if (b.rain && ((Math.abs(b.x - me.x) < 5 && b.y >= top) || b.y >= GROUND)) b.age = b.life
    }
    this.bits = this.bits.filter((b) => b.age < b.life)
  }

  /* ---------------- drawing ---------------- */

  render() {
    const p = this.px
    p.clear()
    const me = this.me
    const ph = this.phase
    const sx = Math.floor(me.x)

    drawClouds(p, this.time)
    for (let x = 0; x <= this.edge; x++) drawGroundColumn(p, x, x)
    this.drawWater()
    for (const r of this.ripples) {
      const d = Math.round(r.age * r.speed)
      const a = 1 - r.age / r.life
      for (const x of [r.x - d, r.x + d]) if (x > this.edge) p.dot(x, WATER - 1, a)
    }

    this.drawFloatAndLine()

    drawPip(p, me, sx, this.time, {}, (hx, hy) => {
      // the rod, its butt a little behind his hand
      const c = Math.cos(this.rod)
      const s = Math.sin(this.rod)
      p.line(Math.round(hx - c * 2), Math.round(hy + s * 2), Math.round(hx + c * ROD), Math.round(hy - s * ROD))
    })

    if (ph.name === 'bite' && ph.t > 0.04) {
      const pop = ph.t < 0.1 ? 1 : 0
      stamp(p, ALERT, sx, headTop(me) - 7 - pop)
    }

    if (ph.name === 'strike') {
      stampTurned(p, LETTER, LETTER.w / 2, LETTER.h / 2, this.letter.x, this.letter.y, this.letter.spin)
    }
    if (ph.name === 'hold') {
      const at = this.prize()
      const held = this.caught ?? 0
      const x = Math.floor(at.x)
      const y = Math.floor(at.y) + Math.round(Math.sin(held * 7))
      stamp(p, LETTER, x - 4, y - 3)
      const spots = [
        [-7, -4],
        [6, -5],
        [7, 2],
      ]
      const [dx, dy] = spots[Math.floor(held * 7) % spots.length]
      stamp(p, STAR, x + dx - 1, y + dy - 1, { a: 0.8 })
    }

    for (const b of this.bits) {
      const a = 1 - (b.age / b.life) ** 2
      p.rect(Math.floor(b.x), Math.floor(b.y), 1, b.rain ? 2 : 1, a)
    }
    if (ph.name === 'snap' && ph.t > 0.4) stamp(p, RAIN_CLOUD, sx - 5, headTop(me) - 10)
  }

  /** The surface, with small crests running along it, and the current under it. */
  private drawWater() {
    const p = this.px
    const edge = this.edge
    for (let x = edge + 1; x < p.w; x++) {
      const crest = Math.sin((x - this.time * 6) * 0.45) > 0.62
      p.dot(x, crest ? WATER - 1 : WATER)
      for (let row = 0; row < 3; row++) {
        const c = Math.floor(x - this.time * (3 + row * 1.5))
        if (hash2(c, 20 + row) < 0.035) p.dot(x, WATER + 2 + row * 2, 0.5)
      }
    }
    // the bank drops to the water
    for (let y = GROUND; y <= WATER + 1; y++) p.dot(edge, y)
  }

  private drawFloatAndLine() {
    const p = this.px
    const ph = this.phase.name
    const tip = this.tip()
    const t = { x: Math.round(tip.x), y: Math.round(tip.y) }
    const f = this.float
    const top = { x: Math.round(f.x), y: Math.round(f.y) - FLOAT.h + 1 }

    if (ph === 'cast' || ph === 'bite') p.line(t.x, t.y, top.x, top.y, 0.55)
    else if (ph === 'wait') this.slack(t, top)
    else if (ph === 'strike') p.line(t.x, t.y, Math.round(this.letter.x), Math.round(this.letter.y) - 2, 0.55)
    else if (ph === 'hold') p.line(t.x, t.y, t.x, t.y + 4, 0.55)
    else if (ph === 'snap') {
      // what is left of the line swings from the tip
      const sway = Math.round(Math.sin(this.time * 3))
      p.line(t.x, t.y, t.x + sway, t.y + 5, 0.55)
    }

    if (ph === 'strike' || ph === 'hold') return
    // under the water the float is hidden, so a tug pulls it out of sight
    if (ph !== 'cast') p.clipY = WATER + 1
    stamp(p, FLOAT, top.x - 1, top.y)
    p.clipY = Infinity
  }

  /** A line that sags between the rod tip and the float. */
  private slack(a: Point, b: Point) {
    const p = this.px
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 4 }
    const seen = new Set<number>()
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.5)
    for (let i = 0; i <= n; i++) {
      const k = i / n
      const x = Math.round((1 - k) ** 2 * a.x + 2 * (1 - k) * k * mid.x + k * k * b.x)
      const y = Math.round((1 - k) ** 2 * a.y + 2 * (1 - k) * k * mid.y + k * k * b.y)
      const key = y * p.w + x
      if (seen.has(key)) continue
      seen.add(key)
      p.dot(x, y, 0.55)
    }
  }
}
