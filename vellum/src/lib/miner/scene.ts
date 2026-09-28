/* The studio's waiting scene, drawn in one colour after the offline
   dinosaur game: a horizon line, a couple of clouds, and a miner.

   working  he mines the block in front of him; when it breaks, the next
            one rises out of the ground a few steps on and he walks to it
   done     he breaks the block he is on, a portal rises ahead of him and
            he fades into it; a check mark is left behind
   failed   the ground opens into lava and he walks in, or a wall rises
            and he walks into it and sits down under a rain cloud

   An outcome never cuts a swing short and he never walks past a block.
   `finished` turns true once the ending has played, so whatever shows
   the result can wait for it. */

import { Pixels, hash2, seeded, stamp, stampTurned } from './pixels'
import type { Mask, Stamp } from './pixels'
import {
  ARM,
  CHECK,
  CLOUD,
  CRACKS,
  DIGITS,
  FLAMES,
  GEM,
  HEAD,
  HEAD_DAZED,
  LEG,
  ORE,
  PICK,
  PUFF,
  RAIN_CLOUD,
  RING,
  STAR,
  TORSO,
} from './art'

export type Mood = 'idle' | 'working' | 'done' | 'failed'
export type Failure = 'lava' | 'wall'

export const HEIGHT = 40
const GROUND = 31
const LAVA_TOP = GROUND + 3
const PIT = 20
const WALK = 22
const STROLL = 28
const GRAVITY = 300
const LEG_LEN = 5
const REACH = 9
const TAU = Math.PI * 2
/** Seconds a block, portal or wall takes to rise out of the ground. */
const RISE = 0.3

type Ore = { x: number; hits: number; born: number; struck: number }

type Bit = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  gravity: number
  shape?: Mask
  rain?: boolean
  bounce?: boolean
}

type Pose = {
  x: number
  y: number
  vx: number
  vy: number
  stride: number
  legNear: number
  legFar: number
  armNear: number
  armFar: number
  pick: number | null
  sit: number
  bob: number
  dip: number
  dazed: boolean
  hidden: boolean
}

type PhaseName = 'stand' | 'walk' | 'mine' | 'approach' | 'enter' | 'gone' | 'fall' | 'burn' | 'sunk' | 'bonk' | 'sit' | 'respawn'

type Phase = { name: PhaseName; t: number; ore?: Ore }

type Goal = { kind: 'portal' | 'pit' | 'wall'; x: number; born: number }

type Dropped = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; landed: number | null; rest: number }

const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k))
const easeOut = (k: number) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 3

function standing(x: number): Pose {
  return {
    x,
    y: GROUND,
    vx: 0,
    vy: 0,
    stride: 0,
    legNear: 0,
    legFar: 0,
    armNear: 0.15,
    armFar: -0.05,
    pick: 1.0,
    sit: 0,
    bob: 0,
    dip: 0,
    dazed: false,
    hidden: false,
  }
}

export class MinerScene {
  w: number
  readonly h = HEIGHT
  px: Pixels
  private scratch: Pixels
  private rand = seeded(11)
  private time = 0
  private cam = 0
  private mood: Mood = 'idle'
  private failure: Failure = 'lava'
  private phase: Phase = { name: 'stand', t: 0 }
  private me: Pose
  private ore: Ore | null = null
  /** an outcome is in: the block being mined breaks on the next strike */
  private finishing = false
  private goal: Goal | null = null
  private dropped: Dropped | null = null
  private gem: { x: number; y: number; vx: number; vy: number; age: number } | null = null
  private bits: Bit[] = []
  private mined = 0
  private dizzy = 0
  private knock = 0
  private flash = 0
  private endedAt: number | null = null

  constructor(width = 128) {
    this.w = Math.max(96, Math.round(width))
    this.px = new Pixels(this.w, HEIGHT)
    this.scratch = new Pixels(this.w, HEIGHT)
    this.me = standing(this.anchor)
    this.ore = { x: Math.floor(this.me.x + REACH), hits: 0, born: -1, struck: -1 }
  }

  /** He works near the right of the frame, so what comes next arrives in a few steps. */
  private get anchor() {
    return Math.max(24, this.w - 44)
  }

  /** True once an outcome has played through. */
  get finished() {
    return this.endedAt !== null
  }

  /** The colour everything is drawn in. */
  setInk(c: number) {
    this.px.ink = c
    this.scratch.ink = c
  }

  resize(width: number) {
    const w = Math.max(96, Math.round(width))
    if (w === this.w) return
    const ink = this.px.ink
    this.w = w
    this.px = new Pixels(w, HEIGHT)
    this.scratch = new Pixels(w, HEIGHT)
    this.setInk(ink)
    const name = this.phase.name
    if (name === 'stand' || name === 'walk' || name === 'mine' || name === 'approach') this.cam = this.me.x - this.anchor
  }

  setMood(mood: Mood, failure: Failure = 'lava') {
    if (mood === this.mood && failure === this.failure) return
    this.mood = mood
    this.failure = failure
    this.endedAt = null
    const name = this.phase.name
    const ended = name === 'enter' || name === 'gone' || name === 'fall' || name === 'burn' || name === 'sunk' || name === 'bonk' || name === 'sit'
    if (ended) return this.go('respawn')
    if (name === 'respawn') return
    if (mood === 'idle') return this.go('stand')
    if (mood === 'working') {
      this.finishing = false
      if (name === 'stand' || name === 'approach') this.goal = null
      if (name === 'stand' || name === 'approach') this.nextOre(true)
      return
    }
    // An outcome. Let the swing land first; a block he has not reached yet is not worth the walk.
    if (name === 'mine') this.finishing = true
    else if (name === 'walk' && this.ore && this.ore.x - this.me.x > REACH + 6) {
      this.ore = null
      this.placeGoal()
    } else if (name === 'walk') this.finishing = true
    else this.placeGoal()
  }

  /** Skips to a frame that sums the mood up, for a still picture. */
  settle() {
    const seconds = { idle: 0.2, working: 0.2, done: 4, failed: 4 }[this.mood]
    for (let t = 0; t < seconds && !(this.mood !== 'working' && this.finished); t += 1 / 30) this.step(1 / 30)
    this.bits = this.bits.filter((b) => b.rain)
    this.gem = null
  }

  /* ---------------- choreography ---------------- */

  private go(name: PhaseName, ore?: Ore) {
    this.phase = { name, t: 0, ore }
  }

  /** The next block rises a few steps ahead. */
  private nextOre(now = false) {
    const gap = now ? REACH : 26 + Math.floor(this.rand() * 8)
    this.ore = { x: Math.floor(this.me.x + gap), hits: 0, born: now ? -1 : this.time, struck: -1 }
    this.go(now ? 'mine' : 'walk', now ? this.ore : undefined)
  }

  private placeGoal() {
    this.ore = null
    const kind = this.mood === 'done' ? 'portal' : this.failure === 'wall' ? 'wall' : 'pit'
    const ahead = kind === 'portal' ? 10 : kind === 'pit' ? 10 : 15
    this.goal = { kind, x: Math.floor(this.me.x + ahead), born: this.time }
    this.go('approach')
  }

  private respawn() {
    this.goal = null
    this.dropped = null
    this.gem = null
    this.bits = []
    this.dizzy = 0
    this.finishing = false
    this.me = standing(this.cam + this.anchor)
    for (let i = 0; i < 10; i++) {
      this.bits.push({
        x: this.me.x - 5 + this.rand() * 10,
        y: GROUND - 2 - this.rand() * 16,
        vx: (this.rand() - 0.5) * 24,
        vy: -6 - this.rand() * 14,
        age: 0,
        life: 0.4 + this.rand() * 0.3,
        gravity: 0,
      })
    }
  }

  step(dt: number) {
    dt = Math.min(dt, 0.05)
    this.time += dt
    const ph = this.phase
    ph.t += dt
    const me = this.me

    switch (ph.name) {
      case 'stand':
        break

      case 'walk': {
        const ore = this.ore
        if (ore && ore.x - me.x <= REACH + WALK * dt) {
          me.x = ore.x - REACH
          this.cam = me.x - this.anchor
          this.go('mine', ore)
          break
        }
        const step = WALK * dt
        this.cam += step
        me.x += step
        me.stride += (step / 12) * TAU
        break
      }

      case 'mine': {
        const ore = ph.ore!
        const cycle = 0.46
        if (ph.t >= ore.hits * cycle + 0.3) {
          ore.hits += 1
          ore.struck = this.time
          this.chips(ore.x + 1, GROUND - 5, 3, 0.6)
          if (ore.hits >= 3 || this.finishing) {
            this.breakOre(ore)
            if (this.mood === 'working' || this.mood === 'idle') this.nextOre()
            else {
              this.finishing = false
              this.placeGoal()
            }
          }
        }
        break
      }

      case 'approach': {
        const g = this.goal!
        const target = g.kind === 'portal' ? g.x + 9 : g.kind === 'pit' ? g.x + 1 : g.x - 4
        const left = target - me.x
        const step = Math.min(STROLL * dt, Math.max(0, left))
        this.cam += step
        me.x += step
        me.stride += (step / 12) * TAU
        if (left - step <= 0.001 && this.time - g.born >= RISE) {
          if (g.kind === 'portal') this.go('enter')
          else if (g.kind === 'pit') {
            me.vx = STROLL * 0.8
            me.vy = -30
            this.drop(g.x + PIT + 7, -80)
            this.go('fall')
          } else this.bonk()
        }
        break
      }

      case 'enter': {
        // bits of him drift into the middle of the portal as he fades
        if (ph.t > 0.25 && this.rand() < dt * 45) {
          const g = this.goal!
          const x = me.x + (this.rand() - 0.5) * 10
          const y = GROUND - 2 - this.rand() * 18
          this.bits.push({ x, y, vx: (g.x + 9 - x) * 2.2, vy: (GROUND - 12 - y) * 2.2, age: 0, life: 0.35 + this.rand() * 0.3, gravity: 0 })
        }
        if (ph.t >= 0.95) {
          me.hidden = true
          this.flash = 0.18
          this.go('gone')
        }
        break
      }

      case 'gone':
        if (ph.t >= 0.95 && this.endedAt === null) this.endedAt = this.time
        break

      case 'fall': {
        me.vy += GRAVITY * dt
        me.x += me.vx * dt
        me.y += me.vy * dt
        if (me.y >= LAVA_TOP + 3) {
          me.vx = 0
          me.vy = 0
          this.knock = 0.2
          this.splash(me.x, LAVA_TOP)
          this.go('burn')
        }
        break
      }

      case 'burn': {
        me.y += 12 * dt
        if (this.rand() < dt * 7) this.puff(me.x + (this.rand() - 0.5) * 8, LAVA_TOP - 8 - this.rand() * 6)
        if (me.y - 21 > LAVA_TOP + 1) {
          this.puff(me.x, LAVA_TOP - 4)
          this.puff(me.x + 3, LAVA_TOP - 9)
          this.go('sunk')
        }
        break
      }

      case 'sunk':
        if (this.rand() < dt * 2) this.puff(this.goal!.x + 4 + this.rand() * (PIT - 8), LAVA_TOP - 3)
        if (ph.t >= 0.55 && this.endedAt === null) this.endedAt = this.time
        break

      case 'bonk': {
        me.vy += GRAVITY * dt
        me.x += me.vx * dt
        me.y += me.vy * dt
        if (me.y >= GROUND && me.vy > 0) {
          me.y = GROUND
          me.vx = 0
          me.vy = 0
          this.dust(me.x, GROUND - 1)
          this.go('sit')
        }
        break
      }

      case 'sit': {
        if (ph.t > 0.45 && this.rand() < dt * 18) {
          this.bits.push({
            x: me.x - 5 + Math.floor(this.rand() * 10),
            y: this.headTop() - 6,
            vx: 0,
            vy: 55,
            age: 0,
            life: 1,
            gravity: 0,
            rain: true,
          })
        }
        if (ph.t >= 1.7 && this.endedAt === null) this.endedAt = this.time
        break
      }

      case 'respawn': {
        if (ph.t <= dt + 1e-9) this.respawn()
        if (ph.t >= 0.35) {
          if (this.mood === 'working') this.nextOre(true)
          else if (this.mood === 'idle') this.go('stand')
          else this.placeGoal()
        }
        break
      }
    }

    this.pose()
    this.stepBits(dt)
    this.stepDropped(dt)
    this.stepGem(dt)
    this.dizzy = Math.max(0, this.dizzy - dt)
    this.knock = Math.max(0, this.knock - dt)
    this.flash = Math.max(0, this.flash - dt)
    if (this.goal?.kind === 'portal' && this.rand() < dt * 6) {
      const g = this.goal
      this.bits.push({ x: g.x + 4 + this.rand() * 10, y: GROUND - 6 - this.rand() * 14, vx: (this.rand() - 0.5) * 6, vy: -8 - this.rand() * 8, age: 0, life: 0.6, gravity: 0 })
    }
    if (this.goal?.kind === 'pit' && this.rand() < dt * 3) {
      const g = this.goal
      this.bits.push({ x: g.x + 3 + this.rand() * (PIT - 6), y: LAVA_TOP + 4, vx: 0, vy: -9, age: 0, life: 0.55, gravity: 0, shape: RING })
    }
  }

  /** Limb angles for the phase. Angles are forward swings in radians; 0 hangs straight down. */
  private pose() {
    const me = this.me
    const ph = this.phase
    me.dip = 0
    switch (ph.name) {
      case 'stand':
      case 'respawn':
        me.legNear = me.legFar = 0
        me.armNear = 0.15
        me.armFar = -0.05
        me.pick = 1.0
        me.bob = this.time % 2.6 < 0.5 ? 1 : 0
        me.dazed = false
        me.hidden = ph.name === 'respawn' && Math.floor(ph.t * 16) % 2 === 0
        break
      case 'walk':
      case 'approach': {
        const s = Math.sin(me.stride)
        me.legNear = 0.55 * s
        me.legFar = -0.55 * s
        me.armNear = -0.3 * s
        me.armFar = 0.4 * s
        me.pick = -me.armNear + 1.0
        me.bob = Math.round(LEG_LEN * (1 - Math.cos(0.55 * s)) * 0.9)
        me.hidden = false
        break
      }
      case 'mine': {
        const k = ph.t % 0.46
        if (k < 0.24) {
          const u = easeOut(k / 0.24)
          me.armNear = lerp(0.35, 2.6, u)
          me.pick = lerp(1.2, 0.15, u)
        } else if (k < 0.32) {
          const u = (k - 0.24) / 0.08
          me.armNear = lerp(2.6, 0.85, u)
          me.pick = lerp(0.15, 2.2, u)
        } else {
          const u = (k - 0.32) / 0.14
          me.armNear = lerp(0.85, 0.35, u)
          me.pick = lerp(2.2, 1.2, u)
        }
        me.armFar = -0.2
        me.legNear = 0.28
        me.legFar = -0.22
        me.bob = 1
        break
      }
      case 'enter':
        me.legNear = me.legFar = 0
        me.armNear = 0.3
        me.armFar = -0.2
        me.pick = 1.0
        me.bob = 0
        break
      case 'fall':
      case 'burn': {
        const f = this.time * (ph.name === 'fall' ? 30 : 16)
        me.armNear = 2.7 + 0.35 * Math.sin(f)
        me.armFar = 2.5 + 0.35 * Math.cos(f)
        me.legNear = 0.5 * Math.sin(f * 0.8)
        me.legFar = -0.5 * Math.sin(f * 0.8)
        me.pick = null
        me.bob = 0
        me.dazed = true
        break
      }
      case 'bonk':
        me.armNear = 1.3
        me.armFar = 1.0
        me.legNear = 0.45
        me.legFar = -0.35
        me.pick = null
        me.bob = 0
        me.dazed = true
        break
      case 'sit':
        me.sit = easeOut(ph.t / 0.3)
        me.legNear = lerp(0.45, 1.5, me.sit)
        me.legFar = lerp(-0.35, 1.38, me.sit)
        me.armNear = lerp(1.3, 0.55, me.sit)
        me.armFar = lerp(1.0, 0.4, me.sit)
        me.pick = null
        me.bob = 0
        me.dazed = ph.t < 0.9
        me.dip = ph.t > 0.9 && (ph.t - 0.9) % 1.8 < 0.6 ? 1 : 0
        break
      case 'gone':
      case 'sunk':
        me.hidden = true
        break
    }
  }

  /* ---------------- events ---------------- */

  private breakOre(ore: Ore) {
    ore.struck = this.time
    this.mined += 1
    this.chips(ore.x + 4, GROUND - 4, 12, 1)
    this.gem = { x: ore.x + 3, y: GROUND - 5, vx: -26, vy: -70, age: 0 }
    this.ore = null
  }

  private bonk() {
    const me = this.me
    me.vx = -30
    me.vy = -55
    this.knock = 0.25
    this.dizzy = 1.4
    this.dust(this.goal!.x, GROUND - 10)
    this.drop(this.goal!.x - 6, -65)
    this.go('bonk')
  }

  /** Lets go of the pickaxe so it lands at x. */
  private drop(x: number, vy: number) {
    const me = this.me
    const hand = this.hand()
    const rest = GROUND - 4
    const dy = rest - hand.y
    const time = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, dy))) / GRAVITY
    this.dropped = {
      x: hand.x,
      y: hand.y,
      vx: (x - hand.x) / time,
      vy,
      angle: me.pick ?? 1,
      spin: x > hand.x ? 9 : -9,
      landed: null,
      rest: x > hand.x ? 0.8 : -0.8,
    }
    me.pick = null
  }

  private chips(x: number, y: number, n: number, force: number) {
    for (let i = 0; i < n; i++) {
      this.bits.push({
        x: x + (this.rand() - 0.5) * 4,
        y: y + (this.rand() - 0.5) * 4,
        vx: (this.rand() - 0.5) * 70 * force,
        vy: (-40 - this.rand() * 60) * force,
        age: 0,
        life: 0.45 + this.rand() * 0.35,
        gravity: GRAVITY,
        bounce: true,
      })
    }
  }

  private splash(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      this.bits.push({ x: x + (this.rand() - 0.5) * 6, y, vx: (this.rand() - 0.5) * 60, vy: -50 - this.rand() * 50, age: 0, life: 0.55, gravity: GRAVITY })
    }
  }

  private puff(x: number, y: number) {
    this.bits.push({ x, y, vx: (this.rand() - 0.5) * 5, vy: -9 - this.rand() * 6, age: 0, life: 1 + this.rand() * 0.5, gravity: -2, shape: this.rand() > 0.5 ? PUFF : RING })
  }

  private dust(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.bits.push({ x: x + (this.rand() - 0.5) * 4, y: y + (this.rand() - 0.5) * 6, vx: (this.rand() - 0.5) * 30, vy: -6 - this.rand() * 12, age: 0, life: 0.45, gravity: 0 })
    }
  }

  private stepBits(dt: number) {
    const top = this.headTop()
    const mx = this.me.x
    for (const b of this.bits) {
      b.age += dt
      b.vy += b.gravity * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.bounce && b.y >= GROUND - 1 && b.vy > 0) {
        b.y = GROUND - 1
        b.vy *= -0.3
        b.vx *= 0.5
      }
      if (b.rain && ((Math.abs(b.x - mx) < 5 && b.y >= top) || b.y >= GROUND)) b.age = b.life
    }
    this.bits = this.bits.filter((b) => b.age < b.life)
  }

  private stepDropped(dt: number) {
    const d = this.dropped
    if (!d || d.landed !== null) return
    d.vy += GRAVITY * dt
    d.x += d.vx * dt
    d.y += d.vy * dt
    d.angle += d.spin * dt
    const g = this.goal
    const overLava = g?.kind === 'pit' && d.x > g.x && d.x < g.x + PIT
    if (d.y >= GROUND - 4 && d.vy > 0 && !overLava) {
      d.y = GROUND - 4
      d.landed = this.time
      d.angle = d.rest
    } else if (overLava && d.y > LAVA_TOP) this.dropped = null
  }

  private stepGem(dt: number) {
    const gem = this.gem
    if (!gem) return
    gem.age += dt
    if (gem.age < 0.45) {
      gem.vy += GRAVITY * dt
      gem.x += gem.vx * dt
      gem.y += gem.vy * dt
      if (gem.y > GROUND - 2) {
        gem.y = GROUND - 2
        gem.vy *= -0.35
        gem.vx *= 0.6
      }
      return
    }
    const tx = this.me.x
    const ty = GROUND - 10
    gem.x += (tx - gem.x) * Math.min(1, dt * 12)
    gem.y += (ty - gem.y) * Math.min(1, dt * 12)
    if (Math.abs(gem.x - tx) < 1.5 && Math.abs(gem.y - ty) < 1.5) this.gem = null
  }

  /* ---------------- drawing ---------------- */

  private hipY() {
    const me = this.me
    return Math.round(lerp(me.y - LEG_LEN + me.bob, me.y - 2, me.sit))
  }

  private headTop() {
    return this.hipY() - 6 - 10 + this.me.dip
  }

  private hand() {
    const me = this.me
    const shoulder = this.hipY() - 6 + 1
    return { x: me.x + Math.sin(me.armNear) * 4.5, y: shoulder + Math.cos(me.armNear) * 4.5 }
  }

  render() {
    const p = this.px
    p.clear()
    const cam = Math.floor(this.cam)
    p.ox = this.knock > 0 ? Math.round((this.rand() - 0.5) * 2) : 0
    p.oy = 0

    this.drawClouds()
    this.drawGround(cam)

    const g = this.goal
    const grown = g ? easeOut((this.time - g.born) / RISE) : 1
    if (g?.kind === 'portal') this.drawPortal(g.x - cam, grown)
    if (g?.kind === 'wall') this.drawWall(g.x - cam, grown)
    if (g?.kind === 'pit') this.drawPit(g.x - cam, g.x, grown)
    if (this.ore) this.drawOre(this.ore, this.ore.x - cam)

    const me = this.me
    const sx = Math.floor(me.x - cam)
    const ph = this.phase
    if (!me.hidden) {
      const sinking = ph.name === 'burn' || (ph.name === 'fall' && me.y > GROUND)
      if (sinking) p.clipY = LAVA_TOP + 1
      const how: Stamp = {}
      if (ph.name === 'enter' && ph.t > 0.25) {
        const gone = (ph.t - 0.25) / 0.7
        how.keep = (x, y) => hash2(x * 7 + 3, y * 13 + 1) > gone
      }
      this.drawMiner(p, sx, how)
      p.clipY = Infinity
      if (ph.name === 'burn') {
        const f = FLAMES[Math.floor(this.time * 12) % FLAMES.length]
        for (const dx of [-7, -2, 3]) stamp(p, f, sx + dx, LAVA_TOP - f.h + 1)
      }
    }

    this.drawDropped(cam)
    if (this.gem) stamp(p, GEM, Math.floor(this.gem.x - cam) - 1, Math.floor(this.gem.y) - 1)

    for (const b of this.bits) {
      const a = 1 - (b.age / b.life) ** 2
      const x = Math.floor(b.x - cam)
      const y = Math.floor(b.y)
      if (b.shape) stamp(p, b.shape, x - 1, y - 1, { a })
      else p.rect(x, y, 1, b.rain ? 2 : 1, a)
    }

    if (ph.name === 'sit' && ph.t > 0.4) stamp(p, RAIN_CLOUD, sx - 5, this.headTop() - 10)
    if (this.dizzy > 0 && !me.hidden) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + (i * TAU) / 3
        stamp(p, STAR, Math.round(sx + Math.cos(a) * 6) - 1, Math.round(this.headTop() - 2 + Math.sin(a) * 2) - 1)
      }
    }

    if (g?.kind === 'portal' && ph.name === 'gone' && ph.t > 0.25) {
      const pop = ph.t < 0.36 ? -1 : 0
      stamp(p, CHECK, g.x - cam + 4, GROUND - 17 + pop)
    }

    this.drawCount()
    p.ox = 0
  }

  private drawClouds() {
    const p = this.px
    const span = this.w + 40
    for (const [x0, y, speed] of [
      [this.w * 0.2, 1, 2.2],
      [this.w * 0.62, 4, 1.4],
    ]) {
      const x = ((((x0 - this.time * speed) % span) + span) % span) - 20
      stamp(p, CLOUD, Math.round(x), y, { a: 0.28 })
    }
  }

  private drawGround(cam: number) {
    const p = this.px
    const g = this.goal
    for (let x = 0; x < p.w; x++) {
      const wx = cam + x
      if (g?.kind === 'pit') {
        const open = easeOut((this.time - g.born) / RISE) * PIT
        const mid = g.x + PIT / 2
        if (wx >= mid - open / 2 && wx < mid + open / 2) continue
      }
      p.dot(x, GROUND)
      if (hash2(wx, 5) < 0.035) p.dot(x, GROUND - 1)
      const h = hash2(wx, 9)
      if (h < 0.1) p.dot(x, GROUND + 2 + Math.floor(hash2(wx, 10) * 7), 0.8)
      if (h > 0.97) p.rect(x, GROUND + 3 + Math.floor(hash2(wx, 11) * 4), 2, 1, 0.8)
    }
  }

  private drawOre(o: Ore, x: number) {
    const p = this.px
    const rise = o.born < 0 ? 1 : easeOut((this.time - o.born) / RISE)
    const knock = this.time - o.struck < 0.06 ? 1 : 0
    const y = GROUND - 8 + Math.round((1 - rise) * 8) - knock
    p.clipY = GROUND
    stamp(p, ORE, x, y)
    const shown = [0, 3, 6, 9][Math.min(3, o.hits)]
    for (let i = 0; i < shown; i++) p.dot(x + CRACKS[i][0], y + CRACKS[i][1])
    p.clipY = Infinity
  }

  private drawWall(x: number, grown: number) {
    const p = this.px
    const top = GROUND - Math.round(16 * grown)
    for (let y = top; y < GROUND; y++) {
      const v = y - (GROUND - 16)
      const row = Math.floor(v / 4)
      for (let u = 0; u < 8; u++) {
        const edge = u === 0 || u === 7 || y === top || v % 4 === 0
        const joint = (u + (row % 2 ? 4 : 0)) % 8 === 4
        if (edge || joint) p.dot(x + u, y)
      }
    }
  }

  private drawPortal(x: number, grown: number) {
    const p = this.px
    const w = 18
    const h = Math.round(24 * grown)
    const top = GROUND - h
    if (h < 2) return
    p.frame(x, top, w, h + 1)
    p.frame(x + 2, top + 2, w - 4, h - 3)
    // rings drawn inward, over and over, like looking down a tunnel
    const iw = w - 8
    const ih = h - 7
    if (ih > 2) {
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 1.4 + i / 3) % 1
        const rw = Math.max(1, Math.round(iw * (1 - k)))
        const rh = Math.max(1, Math.round(ih * (1 - k)))
        p.frame(x + 4 + Math.floor((iw - rw) / 2), top + 4 + Math.floor((ih - rh) / 2), rw, rh, 0.3 + 0.7 * (1 - k))
      }
      if (this.flash > 0) p.rect(x + 4, top + 4, iw, ih, 0.6)
    }
  }

  private drawPit(x: number, wx: number, grown: number) {
    const p = this.px
    if (grown < 0.2) return
    const open = Math.round(PIT * grown)
    const left = x + Math.floor((PIT - open) / 2)
    for (let y = GROUND; y < p.h; y++) {
      p.dot(left, y)
      p.dot(left + open - 1, y)
    }
    for (let u = 1; u < open - 1; u++) {
      const X = left + u
      const w1 = LAVA_TOP + Math.round(Math.sin((wx + u) * 0.7 + this.time * 5))
      const w2 = LAVA_TOP + 3 + Math.round(Math.sin((wx + u) * 0.5 - this.time * 4 + 1))
      p.dot(X, w1)
      p.dot(X, w2, 0.55)
      if ((u + Math.floor(this.time * 6)) % 5 === 0) p.dot(X, LAVA_TOP + 5, 0.4)
    }
  }

  private drawDropped(cam: number) {
    const d = this.dropped
    if (!d) return
    const bob = d.landed === null ? 0 : Math.round(Math.sin((this.time - d.landed) * 3))
    stampTurned(this.px, PICK, 4.5, 5, d.x - cam, d.y + bob, d.angle)
  }

  private drawCount() {
    const p = this.px
    const text = String(this.mined).padStart(5, '0')
    const x0 = p.w - text.length * 4 - 2
    for (let i = 0; i < text.length; i++) stamp(p, DIGITS[Number(text[i])], x0 + i * 4, 2, { a: 0.7 })
  }

  private drawMiner(p: Pixels, sx: number, how: Stamp) {
    const me = this.me
    const hip = this.hipY()
    const torsoTop = hip - 6
    const head = torsoTop - 10 + me.dip
    const far: Stamp = { ...how, a: 0.45 }
    stampTurned(p, LEG, 1.5, 0, sx, hip, -me.legFar, far)
    stampTurned(p, ARM, 1.5, 0.5, sx, torsoTop + 1, -me.armFar, far)
    stampTurned(p, LEG, 1.5, 0, sx, hip, -me.legNear, how)
    stamp(p, TORSO, sx - 3, torsoTop, how)
    const blink = !me.dazed && this.time % 3.4 < 0.12
    stamp(p, me.dazed ? HEAD_DAZED : HEAD, sx - 5, head, how)
    if (blink) p.dot(sx + 1, head + 5)
    if (me.pick !== null) {
      const hx = sx + Math.sin(me.armNear) * 4.5
      const hy = torsoTop + 1 + Math.cos(me.armNear) * 4.5
      stampTurned(p, PICK, 4.5, 8.5, hx, hy, me.pick, how)
    }
    stampTurned(p, ARM, 1.5, 0.5, sx, torsoTop + 1, -me.armNear, how)
  }
}
