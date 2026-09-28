/* A little night scene with a miner in it, used wherever the studio
   waits on something.

   working  he walks along with his pickaxe, stopping to mine the ore
            blocks he meets
   done     a portal comes into view and he walks through it
   failed   he runs into a wall and sits down under a rain cloud, or
            runs off the edge into lava; his pickaxe lands on the far bank
   idle     he stands by a block, waiting

   The miner stays near the right third of the frame and the ground
   scrolls under him, so a wide frame just shows more of the walk. */

import { Pixels, blit, blitTurned, hash2, mix, seeded } from './pixels'
import type { Ink, Rgb } from './pixels'
import {
  ARM,
  C,
  CHECK,
  CLOUD,
  GEM,
  HEAD,
  LEG,
  MOON,
  PICK,
  PORTAL,
  STAR,
  TORSO,
  brickBlock,
  fire,
  grassBlock,
  lava,
  obsidianBlock,
  oreBlock,
  portal,
  stoneBlock,
} from './art'

export type Mood = 'idle' | 'working' | 'done' | 'failed'
export type Failure = 'lava' | 'wall'

export const HEIGHT = 60
const GROUND = 44
const LAVA_TOP = GROUND + 3
const PIT = 24
const WALK = 18
const RUN = 46
const GRAVITY = 300
const LEG_LEN = 6
const TAU = Math.PI * 2
/** How far in front of a block the miner stands to mine it. */
const REACH = 9

type Ore = { x: number; hits: number; broken: boolean; struck: number }

type Bit = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  c: Rgb
  size: number
  gravity: number
  fade: boolean
  bounce?: boolean
  rain?: boolean
}

type Pose = {
  /** feet, in world pixels */
  x: number
  /** feet, in screen pixels */
  y: number
  vx: number
  vy: number
  stride: number
  legNear: number
  legFar: number
  armNear: number
  armFar: number
  /** the pickaxe's angle while it is held, or null once it is dropped */
  pick: number | null
  sit: number
  bob: number
  dip: number
  jitter: number
  hidden: boolean
}

type PhaseName =
  | 'stand'
  | 'walk'
  | 'mine'
  | 'approach'
  | 'enter'
  | 'gone'
  | 'fall'
  | 'burn'
  | 'sunk'
  | 'bonk'
  | 'sit'
  | 'respawn'

type Phase = { name: PhaseName; t: number; ore?: Ore; speed?: number }

type Goal = { kind: 'portal' | 'pit' | 'wall'; x: number }

type Dropped = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; landed: number | null; flat: number }

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
    jitter: 0,
    hidden: false,
  }
}

export class MinerScene {
  w: number
  readonly h = HEIGHT
  px: Pixels
  private scratch: Pixels
  private sky: Pixels
  private twinkles: { x: number; y: number; k: number }[] = []
  private rand = seeded(11)
  private time = 0
  private cam = 0
  private mood: Mood = 'idle'
  private failure: Failure = 'lava'
  private phase: Phase = { name: 'stand', t: 0 }
  private me: Pose
  private ores: Ore[] = []
  private nextOre = 0
  private goal: Goal | null = null
  private dropped: Dropped | null = null
  private gem: { x: number; y: number; vx: number; vy: number; age: number } | null = null
  private bits: Bit[] = []
  private hurt = 0
  private shake = 0
  private dizzy = 0
  private flash = 0

  constructor(width = 128) {
    this.w = Math.max(96, Math.round(width))
    this.px = new Pixels(this.w, HEIGHT)
    this.scratch = new Pixels(this.w, HEIGHT)
    this.sky = new Pixels(this.w, HEIGHT)
    this.paintSky()
    this.me = standing(this.anchor)
    this.resetOres()
  }

  /** Where the miner walks on screen: the right third, with room ahead for what is coming. */
  private get anchor() {
    return Math.max(26, this.w - 92)
  }

  resize(width: number) {
    const w = Math.max(96, Math.round(width))
    if (w === this.w) return
    this.w = w
    this.px = new Pixels(w, HEIGHT)
    this.scratch = new Pixels(w, HEIGHT)
    this.sky = new Pixels(w, HEIGHT)
    this.paintSky()
    const name = this.phase.name
    if (name === 'stand' || name === 'walk' || name === 'mine' || name === 'approach') this.cam = this.me.x - this.anchor
  }

  setMood(mood: Mood, failure: Failure = 'lava') {
    if (mood === this.mood && failure === this.failure) return
    this.mood = mood
    this.failure = failure
    const name = this.phase.name
    const ended = name === 'enter' || name === 'gone' || name === 'fall' || name === 'burn' || name === 'sunk' || name === 'bonk' || name === 'sit'
    if (ended || (name === 'approach' && mood !== 'done' && mood !== 'failed')) this.go('respawn')
    else if (name !== 'respawn') this.follow()
  }

  /** Fast-forwards to a frame that sums the mood up, for a still picture. */
  settle() {
    const seconds = { idle: 0.5, working: 1.3, done: 6.5, failed: this.failure === 'wall' ? 4.5 : 8 }[this.mood]
    for (let t = 0; t < seconds; t += 1 / 30) this.step(1 / 30)
    this.bits = this.bits.filter((b) => b.rain)
    this.gem = null
  }

  /* ---------------- choreography ---------------- */

  private go(name: PhaseName, ore?: Ore) {
    this.phase = { name, t: 0, ore, speed: name === 'approach' ? (this.phase.name === 'walk' ? WALK : 8) : undefined }
  }

  private follow() {
    if (this.mood === 'idle') return this.go('stand')
    if (this.mood === 'working') return this.go('walk')
    if (this.phase.name === 'mine' && this.phase.ore) this.breakOre(this.phase.ore)
    this.placeGoal()
    this.go('approach')
  }

  private placeGoal() {
    const kind = this.mood === 'done' ? 'portal' : this.failure === 'wall' ? 'wall' : 'pit'
    const x = Math.floor(this.cam + this.w + 6)
    this.goal = { kind, x }
    // nothing may stand on it or past it
    this.ores = this.ores.filter((o) => o.broken || o.x + 8 < x - 6)
    this.nextOre = Infinity
  }

  private resetOres() {
    const first = Math.floor(this.me.x + 38)
    this.ores = [{ x: first, hits: 0, broken: false, struck: -1 }]
    this.nextOre = first + 70
  }

  private spawnOres() {
    while (this.nextOre < this.cam + this.w + 10) {
      this.ores.push({ x: Math.floor(this.nextOre), hits: 0, broken: false, struck: -1 })
      this.nextOre += 60 + this.rand() * 44
    }
    this.ores = this.ores.filter((o) => o.x + 8 > this.cam - 16 && !(o.broken && this.time - o.struck > 1))
  }

  private respawn() {
    this.goal = null
    this.dropped = null
    this.gem = null
    this.bits = []
    this.dizzy = 0
    this.hurt = 0
    this.me = standing(this.cam + this.anchor)
    this.resetOres()
    if (this.nextOre !== Infinity) this.nextOre = Math.max(this.nextOre, this.cam + this.w + 4)
    for (let i = 0; i < 12; i++) {
      this.bits.push({
        x: this.me.x - 4 + this.rand() * 8,
        y: GROUND - 3 - this.rand() * 16,
        vx: (this.rand() - 0.5) * 30,
        vy: -8 - this.rand() * 18,
        age: 0,
        life: 0.45 + this.rand() * 0.35,
        c: this.rand() > 0.5 ? 0xe8ecf5 : 0xb8bfd0,
        size: this.rand() > 0.6 ? 2 : 1,
        gravity: -10,
        fade: true,
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
        const ore = this.ores.find((o) => !o.broken && o.x > me.x && o.x - me.x <= REACH + WALK * dt)
        if (ore) {
          me.x = ore.x - REACH
          this.cam = me.x - this.anchor
          this.go('mine', ore)
          break
        }
        const step = WALK * dt
        this.cam += step
        me.x += step
        me.stride += (step / 16) * TAU
        this.spawnOres()
        break
      }

      case 'mine': {
        const ore = ph.ore!
        const cycle = 0.46
        if (ph.t >= ore.hits * cycle + 0.3) {
          ore.hits += 1
          ore.struck = this.time
          this.chips(ore.x + 1, GROUND - 5, 3, 0.6)
          if (ore.hits >= 3) {
            this.breakOre(ore)
            this.go('walk')
          }
        }
        break
      }

      case 'approach': {
        const g = this.goal!
        ph.speed = Math.min(RUN, (ph.speed ?? WALK) + 120 * dt)
        let v = ph.speed
        const target = g.kind === 'portal' ? g.x + 16 : g.kind === 'pit' ? g.x + 1 : g.x - 4
        const left = target - me.x
        if (g.kind === 'portal' && left < 16) v = Math.max(9, v * (left / 16))
        const step = Math.min(v * dt, Math.max(0, left))
        this.cam += step
        me.x += step
        me.stride += (step / 16) * TAU
        for (const o of this.ores) if (!o.broken && o.x <= me.x + 5) this.breakOre(o)
        if (left - step <= 0.001) {
          if (g.kind === 'portal') this.go('enter')
          else if (g.kind === 'pit') {
            me.vx = ph.speed * 0.62
            me.vy = -24
            this.drop(g.x + PIT + 8, -84)
            this.go('fall')
          } else this.bonk()
        }
        break
      }

      case 'enter': {
        if (this.rand() < dt * 30) this.glint(me.x + (this.rand() - 0.5) * 14, GROUND - 4 - this.rand() * 18, true)
        if (ph.t >= 0.95) {
          this.dissolve()
          this.flash = 0.3
          this.go('gone')
        }
        break
      }

      case 'gone':
        break

      case 'fall': {
        me.vy += GRAVITY * dt
        me.x += me.vx * dt
        me.y += me.vy * dt
        if (me.y >= LAVA_TOP + 5) {
          me.vx = 0
          me.vy = 0
          this.hurt = 0.25
          this.splash(me.x, LAVA_TOP)
          this.go('burn')
        }
        break
      }

      case 'burn': {
        me.y += 5.5 * dt
        if (Math.floor(ph.t / 0.55) !== Math.floor((ph.t - dt) / 0.55)) this.hurt = 0.2
        if (this.rand() < dt * 9) this.smoke(me.x + (this.rand() - 0.5) * 8, LAVA_TOP - 6 - this.rand() * 8)
        if (this.rand() < dt * 14) this.ember(me.x + (this.rand() - 0.5) * 10, LAVA_TOP - 2)
        if (me.y - 20 > LAVA_TOP + 1) {
          for (let i = 0; i < 4; i++) this.smoke(me.x + (this.rand() - 0.5) * 6, LAVA_TOP - 2 - i * 3)
          this.go('sunk')
        }
        break
      }

      case 'sunk': {
        const g = this.goal!
        if (this.rand() < dt * 1.6) this.smoke(g.x + 4 + this.rand() * (PIT - 8), LAVA_TOP - 2)
        if (this.rand() < dt * 5) this.ember(g.x + 2 + this.rand() * (PIT - 4), LAVA_TOP)
        break
      }

      case 'bonk': {
        me.vy += GRAVITY * dt
        me.x += me.vx * dt
        me.y += me.vy * dt
        if (me.y >= GROUND && me.vy > 0) {
          me.y = GROUND
          me.vx = 0
          me.vy = 0
          this.dust(me.x, GROUND - 1, 6)
          this.go('sit')
        }
        break
      }

      case 'sit': {
        if (ph.t > 0.9 && this.rand() < dt * 22) {
          const cx = me.x - 6 + Math.floor(this.rand() * 12)
          this.bits.push({ x: cx, y: this.headTop() - 7, vx: 0, vy: 60, age: 0, life: 1.2, c: C.rain, size: 1, gravity: 0, fade: false, rain: true })
        }
        break
      }

      case 'respawn': {
        if (ph.t === dt || ph.t <= dt + 1e-9) this.respawn()
        if (ph.t >= 0.4) this.follow()
        break
      }
    }

    this.pose()
    this.stepBits(dt)
    this.stepDropped(dt)
    this.stepGem(dt)
    this.hurt = Math.max(0, this.hurt - dt)
    this.shake = Math.max(0, this.shake - dt)
    this.dizzy = Math.max(0, this.dizzy - dt)
    this.flash = Math.max(0, this.flash - dt)

    // the portal breathes out sparks while it stands
    if (this.goal?.kind === 'portal' && this.rand() < dt * 9) {
      const g = this.goal
      this.glint(g.x + 9 + this.rand() * 14, GROUND - 10 - this.rand() * 22, false)
    }
  }

  /** Limb angles for the phase. Angles are forward swings in radians; 0 hangs straight down. */
  private pose() {
    const me = this.me
    const ph = this.phase
    me.jitter = 0
    me.dip = 0
    switch (ph.name) {
      case 'stand':
      case 'respawn': {
        me.legNear = me.legFar = 0
        me.armNear = 0.15
        me.armFar = -0.05
        me.pick = 1.0
        me.bob = this.time % 2.6 < 0.5 ? 1 : 0
        me.hidden = ph.name === 'respawn' && Math.floor(ph.t * 16) % 2 === 0
        break
      }
      case 'walk':
      case 'approach': {
        const amp = ph.name === 'walk' ? 0.5 : lerp(0.5, 0.85, ((ph.speed ?? WALK) - WALK) / (RUN - WALK))
        const s = Math.sin(me.stride)
        me.legNear = amp * s
        me.legFar = -amp * s
        me.armNear = -0.55 * amp * s
        me.armFar = 0.7 * amp * s
        me.pick = -me.armNear + 1.0
        me.bob = Math.round(LEG_LEN * (1 - Math.cos(amp * s)) * 0.8)
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
      case 'enter': {
        me.legNear = me.legFar = 0
        me.armNear = 0.35
        me.armFar = -0.25
        me.pick = 1.0
        me.bob = 0
        me.jitter = ph.t > 0.25 && Math.floor(ph.t * 14) % 2 === 0 ? 1 : 0
        break
      }
      case 'fall':
      case 'burn': {
        const f = this.time * (ph.name === 'fall' ? 30 : 16)
        me.armNear = 2.7 + 0.35 * Math.sin(f)
        me.armFar = 2.5 + 0.35 * Math.cos(f)
        me.legNear = 0.5 * Math.sin(f * 0.8)
        me.legFar = -0.5 * Math.sin(f * 0.8)
        me.pick = null
        me.bob = 0
        break
      }
      case 'bonk': {
        me.armNear = 1.3
        me.armFar = 1.0
        me.legNear = 0.45
        me.legFar = -0.35
        me.pick = null
        me.bob = 0
        break
      }
      case 'sit': {
        me.sit = easeOut(ph.t / 0.35)
        me.legNear = lerp(0.45, 1.5, me.sit)
        me.legFar = lerp(-0.35, 1.38, me.sit)
        me.armNear = lerp(1.3, 0.55, me.sit)
        me.armFar = lerp(1.0, 0.4, me.sit)
        me.pick = null
        me.bob = 0
        me.dip = ph.t > 1.2 && (ph.t - 1.2) % 2.6 < 0.7 ? 1 : 0
        break
      }
      case 'gone':
      case 'sunk':
        me.hidden = true
        break
    }
  }

  /* ---------------- events ---------------- */

  private breakOre(ore: Ore) {
    if (ore.broken) return
    ore.broken = true
    ore.struck = this.time
    this.chips(ore.x + 4, GROUND - 4, 14, 1)
    this.gem = { x: ore.x + 3, y: GROUND - 5, vx: -26, vy: -72, age: 0 }
  }

  private bonk() {
    const me = this.me
    me.vx = -38
    me.vy = -62
    this.hurt = 0.3
    this.shake = 0.28
    this.dizzy = 3.2
    this.dust(this.goal!.x, GROUND - 12, 7)
    this.drop(this.goal!.x - 7, -70)
    this.go('bonk')
  }

  /** Lets go of the pickaxe so it lands at x. */
  private drop(x: number, vy: number) {
    const me = this.me
    const hand = this.hand()
    const fallTo = GROUND - 5
    const dy = fallTo - hand.y
    const time = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * dy)) / GRAVITY
    this.dropped = {
      x: hand.x,
      y: hand.y,
      vx: (x - hand.x) / time,
      vy,
      angle: me.pick ?? 1,
      spin: x > hand.x ? 9 : -9,
      landed: null,
      flat: x > hand.x ? 0.8 : -0.8,
    }
    me.pick = null
  }

  private dissolve() {
    const s = this.scratch
    s.data.fill(0)
    const sx = Math.floor(this.me.x - this.cam)
    this.drawMiner(s, sx, {})
    const g = this.goal!
    const cx = g.x + 16 - this.cam
    const cy = GROUND - 20
    for (let y = 0; y < s.h; y++) {
      for (let x = Math.max(0, sx - 8); x < Math.min(s.w, sx + 12); x++) {
        const c = s.get(x, y)
        if (c === null) continue
        const a = Math.atan2(y - cy, x - cx) + 1.4
        this.bits.push({
          x: x + this.cam,
          y,
          vx: (cx - x) * 1.6 + Math.cos(a) * 14,
          vy: (cy - y) * 1.6 + Math.sin(a) * 14,
          age: 0,
          life: 0.45 + this.rand() * 0.55,
          c: mix(c, PORTAL[3], 0.45),
          size: 1,
          gravity: 0,
          fade: true,
        })
      }
    }
    this.me.hidden = true
  }

  private chips(x: number, y: number, n: number, force: number) {
    for (let i = 0; i < n; i++) {
      const c = [C.stone, C.stoneHi, C.stoneLo, C.ore, C.oreLo][Math.floor(this.rand() * 5)]
      this.bits.push({
        x: x + (this.rand() - 0.5) * 4,
        y: y + (this.rand() - 0.5) * 4,
        vx: (this.rand() - 0.5) * 70 * force,
        vy: (-40 - this.rand() * 60) * force,
        age: 0,
        life: 0.5 + this.rand() * 0.4,
        c,
        size: this.rand() > 0.55 ? 2 : 1,
        gravity: GRAVITY,
        fade: false,
        bounce: true,
      })
    }
  }

  private splash(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      this.bits.push({
        x: x + (this.rand() - 0.5) * 6,
        y,
        vx: (this.rand() - 0.5) * 60,
        vy: -50 - this.rand() * 60,
        age: 0,
        life: 0.6,
        c: this.rand() > 0.5 ? C.lavaHi : C.lava,
        size: 1,
        gravity: GRAVITY,
        fade: false,
      })
    }
  }

  private smoke(x: number, y: number) {
    this.bits.push({
      x,
      y,
      vx: (this.rand() - 0.5) * 6,
      vy: -10 - this.rand() * 8,
      age: 0,
      life: 1.1 + this.rand() * 0.6,
      c: this.rand() > 0.5 ? 0x5d5d68 : 0x44444e,
      size: 2,
      gravity: -2,
      fade: true,
    })
  }

  private ember(x: number, y: number) {
    this.bits.push({
      x,
      y,
      vx: (this.rand() - 0.5) * 10,
      vy: -22 - this.rand() * 26,
      age: 0,
      life: 0.5 + this.rand() * 0.5,
      c: this.rand() > 0.5 ? C.lavaHot : C.lavaHi,
      size: 1,
      gravity: 0,
      fade: true,
    })
  }

  private dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.bits.push({
        x: x + (this.rand() - 0.5) * 4,
        y: y + (this.rand() - 0.5) * 6,
        vx: (this.rand() - 0.5) * 30,
        vy: -6 - this.rand() * 14,
        age: 0,
        life: 0.5 + this.rand() * 0.3,
        c: this.rand() > 0.5 ? 0xb9a58c : 0x8d7a64,
        size: 1,
        gravity: 0,
        fade: true,
      })
    }
  }

  private glint(x: number, y: number, inward: boolean) {
    const g = this.goal
    const cx = g ? g.x + 16 : x
    const cy = GROUND - 20
    this.bits.push({
      x,
      y,
      vx: inward ? (cx - x) * 1.2 : (this.rand() - 0.5) * 8,
      vy: inward ? (cy - y) * 1.2 : -6 - this.rand() * 10,
      age: 0,
      life: 0.6 + this.rand() * 0.6,
      c: PORTAL[2 + Math.floor(this.rand() * 3)],
      size: 1,
      gravity: 0,
      fade: true,
    })
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
    if (!d) return
    if (d.landed !== null) return
    d.vy += GRAVITY * dt
    d.x += d.vx * dt
    d.y += d.vy * dt
    d.angle += d.spin * dt
    const g = this.goal
    const overLava = g?.kind === 'pit' && d.x > g.x && d.x < g.x + PIT
    if (d.y >= GROUND - 5 && d.vy > 0 && !overLava) {
      d.y = GROUND - 5
      d.landed = this.time
      d.angle = d.flat
    } else if (overLava && d.y > LAVA_TOP) {
      this.dropped = null
    }
  }

  private stepGem(dt: number) {
    const gem = this.gem
    if (!gem) return
    gem.age += dt
    if (gem.age < 0.5) {
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
    // pulled in to the miner
    const tx = this.me.x
    const ty = GROUND - 10
    gem.x += (tx - gem.x) * Math.min(1, dt * 12)
    gem.y += (ty - gem.y) * Math.min(1, dt * 12)
    if (Math.abs(gem.x - tx) < 1.5 && Math.abs(gem.y - ty) < 1.5) {
      for (let i = 0; i < 4; i++) {
        this.bits.push({ x: tx, y: ty, vx: (this.rand() - 0.5) * 30, vy: -10 - this.rand() * 20, age: 0, life: 0.35, c: C.oreHi, size: 1, gravity: 0, fade: true })
      }
      this.gem = null
    }
  }

  /* ---------------- drawing ---------------- */

  private headTop() {
    const me = this.me
    const hip = this.hipY()
    return hip - 6 - 8 + me.dip
  }

  private hipY() {
    const me = this.me
    return Math.round(lerp(me.y - LEG_LEN + me.bob, me.y - 2, me.sit))
  }

  private hand() {
    const me = this.me
    const shoulder = { x: me.x, y: this.hipY() - 6 + 1 }
    return { x: shoulder.x + Math.sin(me.armNear) * 5.5, y: shoulder.y + Math.cos(me.armNear) * 5.5 }
  }

  private paintSky() {
    const s = this.sky
    const rand = seeded(5)
    for (let y = 0; y < s.h; y++) {
      const k = Math.min(1, y / GROUND)
      const stepK = Math.floor(k * 6) / 6
      const c = stepK < 0.5 ? mix(C.skyTop, C.skyMid, stepK * 2) : mix(C.skyMid, C.skyLow, (stepK - 0.5) * 2)
      for (let x = 0; x < s.w; x++) s.put(x, y, c)
    }
    this.twinkles = []
    const count = Math.round(s.w * 0.14)
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * s.w)
      const y = Math.floor(rand() * (GROUND - 18))
      const k = rand()
      s.put(x, y, mix(C.skyMid, C.star, 0.35 + k * 0.5))
      if (k > 0.7) this.twinkles.push({ x, y, k: rand() * TAU })
    }
    const mx = Math.floor(s.w * 0.72)
    s.light(mx + 3.5, 8.5, 9, 0x8090c0, 0.12)
    blit(s, MOON, mx, 5)
  }

  render() {
    const p = this.px
    p.copyFrom(this.sky)
    for (const s of this.twinkles) {
      if (Math.sin(this.time * 2.3 + s.k) > 0.55) p.put(s.x, s.y, C.star)
    }

    const cam = Math.floor(this.cam)
    this.drawHills(cam)

    p.ox = this.shake > 0 ? Math.round((this.rand() - 0.5) * 2) : 0
    p.oy = this.shake > 0 ? Math.round((this.rand() - 0.5) * 2) : 0

    const g = this.goal
    if (g?.kind === 'portal') this.drawPortal(g.x - cam)
    this.drawGround(cam)
    if (g?.kind === 'wall') this.drawWall(g.x - cam, g.x)
    for (const o of this.ores) if (!o.broken) this.drawOre(o, o.x - cam)

    const me = this.me
    const sx = Math.floor(me.x - cam) + me.jitter
    const ph = this.phase.name
    if (!me.hidden) {
      if (ph !== 'burn' && ph !== 'fall') this.drawLamp(sx)
      const how: Ink = {}
      if (this.hurt > 0) {
        how.tint = 0xff2a2a
        how.tintBy = 0.55
      } else if (ph === 'enter') {
        how.tint = PORTAL[3]
        how.tintBy = Math.min(0.85, this.phase.t / 0.95)
      }
      this.drawMiner(p, sx, how)
      if (ph === 'burn') this.drawFlames(sx)
    }

    if (g?.kind === 'pit') this.drawLava(g.x - cam, g.x)
    this.drawDropped(cam)
    if (this.gem) blit(p, GEM, Math.floor(this.gem.x - cam) - 1, Math.floor(this.gem.y) - 1)

    for (const b of this.bits) {
      const a = b.fade ? 1 - (b.age / b.life) ** 2 : b.age > b.life * 0.7 ? 0.5 : 1
      p.rect(Math.floor(b.x - cam), Math.floor(b.y), b.size, b.rain ? 2 : b.size, b.c, a)
    }

    if (ph === 'sit' && this.phase.t > 0.8) blit(p, CLOUD, sx - 6, this.headTop() - 11)
    if (this.dizzy > 0 && !me.hidden) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * TAU) / 3
        blit(p, STAR, Math.round(sx + Math.cos(a) * 6) - 1, Math.round(this.headTop() - 3 + Math.sin(a) * 2) - 1)
      }
    }

    if (g?.kind === 'pit') p.light(g.x - cam + PIT / 2, LAVA_TOP, 30, 0xff5a10, 0.42, 0.8)
    if (g?.kind === 'portal') {
      const cx = g.x - cam + 16
      p.light(cx, GROUND - 20, 30, 0x8a46ff, 0.3 + this.flash)
      if (ph === 'gone' && this.phase.t > 0.35) {
        const pop = this.phase.t < 0.47 ? -2 : 0
        const cy = GROUND - 24 + pop
        blit(p, CHECK, Math.round(cx) - 4, cy, { tint: C.checkShade, tintBy: 1 })
        blit(p, CHECK, Math.round(cx) - 5, cy - 1)
      }
    }

    p.ox = 0
    p.oy = 0
  }

  private drawHills(cam: number) {
    const p = this.px
    for (let x = 0; x < p.w; x++) {
      const f = x + cam * 0.15
      const far = GROUND - 13 + Math.round(2.5 * Math.sin(f * 0.05) + 1.5 * Math.sin(f * 0.13 + 1))
      for (let y = far; y < GROUND; y++) p.put(x, y, C.hillFar)
      const n = x + cam * 0.35
      const near = GROUND - 7 + Math.round(2 * Math.sin(n * 0.08 + 2) + 1.2 * Math.sin(n * 0.21))
      for (let y = near; y < GROUND; y++) p.put(x, y, C.hillNear)
    }
  }

  private drawGround(cam: number) {
    const p = this.px
    const g = this.goal
    for (let x = 0; x < p.w; x++) {
      const wx = cam + x
      const u = ((wx % 8) + 8) % 8
      const b = Math.floor(wx / 8)
      if (g?.kind === 'pit' && wx >= g.x && wx < g.x + PIT) continue
      for (let v = 0; GROUND + v < p.h; v++) p.put(x, GROUND + v, v < 8 ? grassBlock(u, v, b) : stoneBlock(u, v - 8, b))
      // a tuft or a flower now and then
      const h = hash2(b, 777)
      const at = b * 8 + Math.floor(hash2(b, 778) * 6)
      if (h < 0.34 && (wx === at || wx === at + 2)) p.put(x, GROUND - 1, C.grassHi)
      if (h < 0.34 && wx === at + 1) p.put(x, GROUND - 2, C.grass)
      if (h < 0.07 && wx === at + 1) p.put(x, GROUND - 3, hash2(b, 779) > 0.5 ? 0xff5d73 : 0xffd84a)
    }
  }

  private drawOre(o: Ore, x: number) {
    const p = this.px
    const b = Math.floor(o.x / 8) + 1000
    const knock = this.time - o.struck < 0.06 ? 1 : 0
    for (let v = 0; v < 8; v++) {
      for (let u = 0; u < 8; u++) {
        const c = oreBlock(u, v, b)
        p.put(x + u, GROUND - 8 + v - knock, knock ? mix(c, 0xffffff, 0.25) : c)
      }
    }
    const cracks = [
      [3, 1], [3, 2], [4, 3], [2, 3],
      [5, 4], [5, 5], [6, 6], [1, 4], [2, 6],
      [4, 6], [6, 2], [1, 1], [3, 5],
    ]
    const shown = [0, 4, 9, 13][Math.min(3, o.hits)]
    for (let i = 0; i < shown; i++) p.put(x + cracks[i][0], GROUND - 8 + cracks[i][1] - knock, C.crack, 0.85)
  }

  private drawWall(x: number, wx: number) {
    const p = this.px
    const b = Math.floor(wx / 8)
    for (let v = 0; v < 24; v++) {
      for (let u = 0; u < 8; u++) p.put(x + u, GROUND - 24 + v, brickBlock(u, v % 8, b + (v >> 3)))
    }
  }

  private drawPortal(x: number) {
    const p = this.px
    const top = GROUND - 40
    for (let v = 0; v < 40; v++) {
      for (let u = 0; u < 32; u++) {
        const inner = u >= 8 && u < 24 && v >= 8 && v < 32
        const c = inner
          ? portal(u - 16 + 0.5, v - 20 + 0.5, this.time)
          : obsidianBlock(u & 7, v & 7, (u >> 3) * 7 + (v >> 3) + 300)
        p.put(x + u, top + v, c)
      }
    }
  }

  private drawLava(x: number, wx: number) {
    const p = this.px
    for (let u = 0; u < PIT; u++) {
      for (let y = GROUND; y < LAVA_TOP; y++) p.put(x + u, y, 0x24160f)
      for (let y = LAVA_TOP; y < p.h; y++) {
        const c = lava(wx + u, y, this.time)
        p.put(x + u, y, y === LAVA_TOP ? mix(c, C.lavaHot, 0.35) : c)
      }
    }
  }

  /** A faint beam from the hat, and the patch of grass it lights. */
  private drawLamp(sx: number) {
    const p = this.px
    const lx = sx + 4
    const ly = this.headTop() + 2
    for (let d = 2; d < 26; d++) {
      const a = Math.round(0.07 * (1 - d / 28) * 50) / 50
      for (let y = Math.floor(ly + d * 0.3); y <= Math.min(GROUND - 1, ly + d * 0.62); y++) p.lighten(lx + d, y, 0xffd98a, a)
    }
    p.light(lx + 27, GROUND + 0.5, 13, 0xffd98a, 0.3, 0.3)
  }

  private drawFlames(sx: number) {
    const p = this.px
    const surface = LAVA_TOP
    const head = this.headTop()
    if (head > surface) return
    for (let c = -5; c <= 5; c++) {
      const wave = 0.5 + 0.5 * Math.sin(c * 1.9 + this.time * 13)
      const tall = Math.min(surface - head + 2, 4 + Math.floor(9 * wave * (0.6 + 0.4 * hash2(c + 50, Math.floor(this.time * 10)))))
      for (let i = 0; i < tall; i++) p.put(sx + c, surface - i, fire(1 - i / tall), 0.9)
    }
  }

  private drawDropped(cam: number) {
    const d = this.dropped
    if (!d) return
    const bobbing = d.landed === null ? 0 : Math.round(Math.sin((this.time - d.landed) * 3))
    blitTurned(this.px, PICK, 4.5, 5, d.x - cam, d.y + bobbing, d.angle)
  }

  private drawMiner(p: Pixels, sx: number, how: Ink) {
    const me = this.me
    const hip = this.hipY()
    const torsoTop = hip - 6
    const head = torsoTop - 8 + me.dip
    const far: Ink = how.tintBy ? how : { tint: 0x000000, tintBy: 0.3 }
    blitTurned(p, LEG, 1.5, 0, sx, hip, -me.legFar, far)
    blitTurned(p, ARM, 1.5, 0.5, sx, torsoTop + 1, -me.armFar, far)
    blitTurned(p, LEG, 1.5, 0, sx, hip, -me.legNear, how)
    blit(p, TORSO, sx - 2, torsoTop, how)
    blit(p, HEAD, sx - 5, head, how)
    if (this.time % 3.4 < 0.12) p.put(sx + 2, head + 5, how.tintBy ? mix(C.skin, how.tint!, how.tintBy) : C.skin)
    if (me.pick !== null) {
      const hx = sx + Math.sin(me.armNear) * 5.5
      const hy = torsoTop + 1 + Math.cos(me.armNear) * 5.5
      blitTurned(p, PICK, 4.5, 8.5, hx, hy, me.pick, how)
    }
    blitTurned(p, ARM, 1.5, 0.5, sx, torsoTop + 1, -me.armNear, how)
  }
}
