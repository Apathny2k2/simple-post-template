/* ---------------------------------------------------------------
   Reading a rig, and animating it.

   Animating a mob by hand means keying four limbs across five poses
   and keeping them in phase, which is exactly the sort of work that is
   tedious without being interesting. But an automatic animation is
   only as good as its reading of the skeleton: the difference between
   a walk and a twitch is knowing which bone is a leg.

   So the reading comes first and is the part worth being careful
   about. Names are the strongest signal a rigger gives - `leg_left`
   means something - but a rig that names nothing still has a shape,
   and a bone's height, its offset from the centre line and how far its
   geometry reaches all say something. Names first, then geometry, and
   the panel reports what it decided so a wrong guess is visible rather
   than mysterious.

   Everything here is mobs-only by design. An item has no gait.
   --------------------------------------------------------------- */

import { flattenBones } from './model'
import type { Bone, Clip, Interpolation, Key, Model, Track, Vec3 } from './model'
import { newId } from './new-model'

export type Role = 'root' | 'head' | 'torso' | 'arm' | 'leg' | 'tail' | 'wing' | 'other'
export type Side = 'left' | 'right' | 'centre'

export type RiggedBone = {
  id: string
  name: string
  role: Role
  side: Side
  /** 0 for a root bone */
  depth: number
  origin: Vec3
  /** how far the geometry under this bone reaches from its pivot */
  reach: number
  /** why it was classified this way, for the panel to show */
  why: 'name' | 'shape'
}

export type RigReading = {
  bones: RiggedBone[]
  byRole: Record<Role, RiggedBone[]>
  /** jaws and mandibles, pulled out of `head` so they can chomp rather than look around */
  jaws: RiggedBone[]
  /** tail segments, outermost first, so a wave can travel down them */
  tailChain: RiggedBone[]
  /** the model's overall height in units */
  height: number
  /** 0..1 - how much of the rig the names accounted for */
  confidence: number
  summary: string
}

/* ---------------- names ---------------- */

const NAME_ROLES: Array<[RegExp, Role]> = [
  [/head|skull|crown|cranium|jaw|snout|beak|horn|crest|antenna/i, 'head'],
  [/wing|pinion/i, 'wing'],
  [/tail|tendril|whip|stinger|fin\b/i, 'tail'],
  [/leg|thigh|shin|calf|foot|feet|knee|hoof|paw|talon/i, 'leg'],
  [/arm|hand|claw|fist|elbow|shoulder|forearm|upperarm|blade_(left|right)/i, 'arm'],
  [/torso|body|chest|spine|abdomen|thorax|core|pelvis|hip|waist|yoke|flank/i, 'torso'],
]

const LEFT = /(^|[^a-z])(l|left)([^a-z]|$)|_l$|left/i
const RIGHT = /(^|[^a-z])(r|right)([^a-z]|$)|_r$|right/i

function sideOf(name: string, origin: Vec3): Side {
  if (LEFT.test(name)) return 'left'
  if (RIGHT.test(name)) return 'right'
  // no name to go on: the centre line decides
  if (origin[0] < -0.35) return 'left'
  if (origin[0] > 0.35) return 'right'
  return 'centre'
}

/* ---------------- geometry ---------------- */

function extentOf(model: Model) {
  const lo: Vec3 = [Infinity, Infinity, Infinity]
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const c of model.cubes) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], c.from[i])
      hi[i] = Math.max(hi[i], c.to[i])
    }
  }
  if (!model.cubes.length) return { lo: [0, 0, 0] as Vec3, hi: [0, 0, 0] as Vec3 }
  return { lo, hi }
}

/** Every cube under `bone`, including through nested bones. */
function cubesUnder(bone: Bone): string[] {
  const out: string[] = []
  const walk = (b: Bone) => {
    for (const child of b.children) {
      if (child.kind === 'cube') out.push(child.id)
      else walk(child.bone)
    }
  }
  walk(bone)
  return out
}

function reachOf(model: Model, bone: Bone): number {
  const ids = new Set(cubesUnder(bone))
  let far = 0
  for (const c of model.cubes) {
    if (!ids.has(c.id)) continue
    for (const corner of [c.from, c.to]) {
      const d = Math.hypot(
        corner[0] - bone.origin[0],
        corner[1] - bone.origin[1],
        corner[2] - bone.origin[2],
      )
      if (d > far) far = d
    }
  }
  return far
}

/* ---------------- the reading ---------------- */

export function readRig(model: Model): RigReading {
  const rows = flattenBones(model).filter((r) => r.kind === 'bone') as Array<{
    kind: 'bone'
    bone: Bone
    depth: number
  }>

  const { lo, hi } = extentOf(model)
  const height = Math.max(hi[1] - lo[1], 1)
  const width = Math.max(hi[0] - lo[0], 1)

  let named = 0
  const bones: RiggedBone[] = rows.map(({ bone, depth }) => {
    const reach = reachOf(model, bone)
    const side = sideOf(bone.name, bone.origin)

    let role: Role | null = null
    for (const [pattern, r] of NAME_ROLES) {
      if (pattern.test(bone.name)) {
        role = r
        break
      }
    }
    if (role) named += 1

    let why: RiggedBone['why'] = role ? 'name' : 'shape'
    if (!role) {
      /* Nothing in the name. The shape still says something: how high
         the pivot sits, how far off the centre line it is, and whether
         anything hangs off it at all. */
      const y = (bone.origin[1] - lo[1]) / height
      const offCentre = Math.abs(bone.origin[0] - (lo[0] + hi[0]) / 2) / width
      if (depth === 0) role = 'root'
      else if (reach < 0.001) role = 'other'
      else if (y >= 0.74) role = 'head'
      else if (y <= 0.42 && offCentre >= 0.1) role = 'leg'
      else if (offCentre >= 0.18) role = 'arm'
      else if (bone.origin[2] > (lo[2] + hi[2]) / 2 + width * 0.12) role = 'tail'
      else role = 'torso'
    }
    if (depth === 0 && role === 'torso') {
      role = 'root'
      why = 'shape'
    }

    return { id: bone.id, name: bone.name, role, side, depth, origin: bone.origin, reach, why }
  })

  const byRole = {
    root: [], head: [], torso: [], arm: [], leg: [], tail: [], wing: [], other: [],
  } as Record<Role, RiggedBone[]>
  for (const b of bones) byRole[b.role].push(b)

  /* Only the outermost bone of a limb should be driven: keying a thigh
     and its shin with the same curve doubles the swing and the leg
     folds through itself. */
  const limbLead = (role: Role) => {
    const all = byRole[role]
    return all.filter((b) => !all.some((other) => other !== b && other.depth < b.depth && isUnder(model, other.id, b.id)))
  }
  byRole.leg = limbLead('leg')
  byRole.arm = limbLead('arm')
  byRole.wing = limbLead('wing')

  /* A jaw is part of the head, but it does not look around with it -
     driving both with the same curve swung the jaw twice as far as the
     skull it hangs from. It gets its own motion instead. */
  const jaws = byRole.head.filter((b) => /jaw|mouth|maw|mandible|beak/i.test(b.name))
  const skulls = byRole.head.filter((b) => !jaws.includes(b))
  byRole.head = skulls.filter(
    (b) => !skulls.some((other) => other !== b && other.depth < b.depth && isUnder(model, other.id, b.id)),
  )

  /* A tail is the opposite case: every segment should move, but as a
     wave travelling down it rather than all at once. Outermost first. */
  const tailChain = [...byRole.tail].sort((a, b) => a.depth - b.depth)

  const parts: string[] = []
  const say = (n: number, one: string, many = one + 's') => {
    if (n) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  say(byRole.head.length, 'head')
  say(byRole.torso.length, 'body part')
  say(byRole.arm.length, 'arm')
  say(byRole.leg.length, 'leg')
  say(byRole.tail.length, 'tail')
  say(byRole.wing.length, 'wing')

  return {
    bones,
    byRole,
    jaws,
    tailChain,
    height,
    confidence: bones.length ? named / bones.length : 0,
    summary: parts.length ? parts.join(', ') : 'nothing it recognises',
  }
}

/** Is `childId` somewhere under `parentId` in the bone tree? */
function isUnder(model: Model, parentId: string, childId: string): boolean {
  const find = (bones: Bone[]): Bone | null => {
    for (const b of bones) {
      if (b.id === parentId) return b
      const deeper = find(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))
      if (deeper) return deeper
    }
    return null
  }
  const parent = find(model.bones)
  if (!parent) return false
  let found = false
  const walk = (b: Bone) => {
    for (const child of b.children) {
      if (child.kind !== 'bone') continue
      if (child.bone.id === childId) found = true
      else walk(child.bone)
    }
  }
  walk(parent)
  return found
}

/* ---------------- building clips ---------------- */

const key = (time: number, value: Vec3, interp: Interpolation = 'catmullrom'): Key => ({
  id: newId(),
  time: Number(time.toFixed(4)),
  value: value.map((v) => Number(v.toFixed(3))) as Vec3,
  interp,
})

type Builder = (rig: RigReading) => { length: number; loop: Clip['loop']; tracks: Track[] }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** The dominant arm: the right one, or whichever there is. */
const strikingArm = (rig: RigReading) =>
  rig.byRole.arm.find((a) => a.side === 'right') ?? rig.byRole.arm[0] ?? null

/**
 * Swing amplitude from how long the limb is. A 4-unit stub and a
 * 20-unit leg rotating by the same angle look nothing alike - the stub
 * barely moves and the leg swings through the floor.
 */
const swingFor = (reach: number) => clamp(34 - reach * 0.55, 14, 34)

/**
 * One cycle of a sway, shifted a quarter turn per segment and decaying
 * as it travels, which is what makes a tail look like a tail rather
 * than a rod. The pattern is cyclic, so every segment still ends where
 * it started and the loop does not jump.
 */
function wave(T: number, amp: number, segment: number, axis: Vec3): Key[] {
  const a = amp * Math.max(0.35, 1 - segment * 0.28)
  const pattern = [0, 1, 0, -1, 0]
  const shift = segment % 4
  return [0, 1, 2, 3, 4].map((step) => {
    const v = pattern[(step + shift) % 4]
    return key((T * step) / 4, [axis[0] * a * v, axis[1] * a * v, axis[2] * a * v])
  })
}

const idle: Builder = (rig) => {
  const T = 3.2
  const bob = clamp(rig.height * 0.013, 0.12, 0.6)
  const tracks: Track[] = []
  const at = (bone: string, channel: Track['channel'], keys: Key[]) => tracks.push({ bone, channel, keys })

  const spine = rig.byRole.torso[0] ?? rig.byRole.root[0]
  if (spine)
    at(spine.id, 'position', [
      key(0, [0, 0, 0]),
      key(T * 0.25, [0, bob, 0]),
      key(T * 0.5, [0, 0, 0]),
      key(T * 0.75, [0, -bob * 0.55, 0]),
      key(T, [0, 0, 0]),
    ])

  for (const head of rig.byRole.head.slice(0, 1))
    at(head.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(T * 0.3, [0, 9, 0]),
      key(T * 0.55, [2.5, 0, 0]),
      key(T * 0.8, [0, -7, 0]),
      key(T, [0, 0, 0]),
    ])

  for (const arm of rig.byRole.arm) {
    const s = arm.side === 'left' ? -1 : 1
    at(arm.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(T * 0.25, [2, 0, s * 2.5]),
      key(T * 0.5, [0, 0, 0]),
      key(T * 0.75, [-2, 0, s * 0.8]),
      key(T, [0, 0, 0]),
    ])
  }

  rig.tailChain.forEach((tail, i) => at(tail.id, 'rotation', wave(T, 11, i, [0, 1, 0])))

  for (const wing of rig.byRole.wing) {
    const s = wing.side === 'left' ? -1 : 1
    at(wing.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(T * 0.5, [0, 0, s * 9]),
      key(T, [0, 0, 0]),
    ])
  }

  return { length: T, loop: 'loop', tracks }
}

const walk: Builder = (rig) => {
  const legs = rig.byRole.leg
  const longest = legs.reduce((m, l) => Math.max(m, l.reach), 0)
  // a longer leg takes a longer stride, so the cycle slows
  const T = Number(clamp(0.7 + longest * 0.034, 0.6, 1.4).toFixed(2))
  const A = swingFor(longest)
  const tracks: Track[] = []
  const at = (bone: string, channel: Track['channel'], keys: Key[]) => tracks.push({ bone, channel, keys })

  const quarter = [0, T * 0.25, T * 0.5, T * 0.75, T]
  const cycle = (bone: string, amp: number, flip: boolean) =>
    at(bone, 'rotation', [
      key(quarter[0], [0, 0, 0]),
      key(quarter[1], [flip ? -amp : amp, 0, 0]),
      key(quarter[2], [0, 0, 0]),
      key(quarter[3], [flip ? amp : -amp, 0, 0]),
      key(quarter[4], [0, 0, 0]),
    ])

  legs.forEach((leg, i) => {
    // pairs counter-phase; an odd leg out joins whichever phase is thinner
    const flip = leg.side === 'right' || (leg.side === 'centre' && i % 2 === 1)
    cycle(leg.id, A, flip)
  })

  // arms swing against the leg on their own side, which is what walking is
  for (const arm of rig.byRole.arm) {
    const flip = arm.side !== 'right'
    cycle(arm.id, A * 0.62, flip)
  }

  const spine = rig.byRole.torso[0] ?? rig.byRole.root[0]
  if (spine) {
    const bob = clamp(rig.height * 0.014, 0.1, 0.7)
    // twice a cycle: one bob per footfall, not per stride
    at(spine.id, 'position', [
      key(0, [0, 0, 0]),
      key(T * 0.25, [0, bob, 0]),
      key(T * 0.5, [0, 0, 0]),
      key(T * 0.75, [0, bob, 0]),
      key(T, [0, 0, 0]),
    ])
    at(spine.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(T * 0.25, [0, 3.5, 0]),
      key(T * 0.5, [0, 0, 0]),
      key(T * 0.75, [0, -3.5, 0]),
      key(T, [0, 0, 0]),
    ])
  }

  rig.tailChain.forEach((tail, i) => at(tail.id, 'rotation', wave(T, 9, i, [0, 1, 0])))

  return { length: T, loop: 'loop', tracks }
}

const attack: Builder = (rig) => {
  const T = 0.9
  const tracks: Track[] = []
  const at = (bone: string, channel: Track['channel'], keys: Key[]) => tracks.push({ bone, channel, keys })
  const lunge = clamp(rig.height * 0.06, 0.5, 2.6)

  const root = rig.byRole.root[0] ?? rig.byRole.torso[0]
  if (root)
    at(root.id, 'position', [
      key(0, [0, 0, 0]),
      key(0.25, [0, 0, -lunge * 0.5]),
      key(0.45, [0, 0, lunge]),
      key(0.62, [0, 0, lunge * 0.35]),
      key(T, [0, 0, 0]),
    ])

  const spine = rig.byRole.torso[0] ?? root
  if (spine)
    at(spine.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.25, [-6, 19, 0]),
      key(0.45, [12, -24, 0]),
      key(0.62, [4, -8, 0]),
      key(T, [0, 0, 0]),
    ])

  const striker = strikingArm(rig)
  if (striker)
    at(striker.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.25, [-104, 0, striker.side === 'left' ? 16 : -16]),
      key(0.45, [64, 0, 0]),
      key(0.66, [18, 0, 0]),
      key(T, [0, 0, 0]),
    ])

  for (const arm of rig.byRole.arm) {
    if (striker && arm.id === striker.id) continue
    at(arm.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.25, [26, 0, arm.side === 'left' ? -12 : 12]),
      key(0.45, [-20, 0, 0]),
      key(T, [0, 0, 0]),
    ])
  }

  /* A mob with no arms still attacks - with its head. Without this a
     serpent's attack clip moved nothing at all. */
  const head = rig.byRole.head[0]
  if (head)
    at(head.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.25, [striker ? -12 : -34, 0, 0]),
      key(0.45, [striker ? 14 : 46, 0, 0]),
      key(0.66, [striker ? 4 : 10, 0, 0]),
      key(T, [0, 0, 0]),
    ])

  for (const jaw of rig.jaws)
    at(jaw.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.22, [-18, 0, 0]),
      key(0.42, [26, 0, 0]),
      key(0.6, [-4, 0, 0]),
      key(T, [0, 0, 0]),
    ])

  // the front foot braces, which is what stops a lunge looking like a slide
  rig.byRole.leg.forEach((leg, i) => {
    const lead = i % 2 === 0
    at(leg.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.25, [lead ? -14 : 10, 0, 0]),
      key(0.45, [lead ? 20 : -14, 0, 0]),
      key(T, [0, 0, 0]),
    ])
  })

  return { length: T, loop: 'once', tracks }
}

const hurt: Builder = (rig) => {
  const T = 0.55
  const tracks: Track[] = []
  const at = (bone: string, channel: Track['channel'], keys: Key[]) => tracks.push({ bone, channel, keys })
  const knock = clamp(rig.height * 0.05, 0.4, 2)

  const root = rig.byRole.root[0] ?? rig.byRole.torso[0]
  if (root)
    at(root.id, 'position', [
      key(0, [0, 0, 0]),
      key(0.12, [0, knock * 0.5, -knock]),
      key(0.3, [0, 0, -knock * 0.3]),
      key(T, [0, 0, 0]),
    ])

  const spine = rig.byRole.torso[0] ?? root
  if (spine)
    at(spine.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.12, [17, 0, 0]),
      key(0.32, [-7, 0, 0]),
      key(T, [0, 0, 0]),
    ])

  for (const head of rig.byRole.head.slice(0, 1))
    at(head.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.1, [26, 0, 0]),
      key(0.3, [-9, 0, 0]),
      key(T, [0, 0, 0]),
    ])

  for (const arm of rig.byRole.arm) {
    const s = arm.side === 'left' ? -1 : 1
    at(arm.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.12, [-24, 0, s * 26]),
      key(0.32, [8, 0, s * 6]),
      key(T, [0, 0, 0]),
    ])
  }

  for (const jaw of rig.jaws)
    at(jaw.id, 'rotation', [key(0, [0, 0, 0]), key(0.1, [22, 0, 0]), key(0.34, [-5, 0, 0]), key(T, [0, 0, 0])])

  rig.byRole.leg.forEach((leg, i) => {
    at(leg.id, 'rotation', [
      key(0, [0, 0, 0]),
      key(0.12, [i % 2 === 0 ? 14 : -10, 0, 0]),
      key(0.32, [-5, 0, 0]),
      key(T, [0, 0, 0]),
    ])
  })

  return { length: T, loop: 'once', tracks }
}

export type Preset = {
  id: string
  label: string
  blurb: string
  /** what the preset has nothing to work with; empty means it will move something */
  needs: (rig: RigReading) => string | null
  build: Builder
}

export const AUTO_PRESETS: Preset[] = [
  {
    id: 'idle',
    label: 'Idle',
    blurb: 'Breathing, a slow look around, and whatever hangs off the rig swaying with it.',
    needs: (rig) =>
      rig.byRole.torso.length || rig.byRole.root.length || rig.byRole.head.length
        ? null
        : 'no body or head to breathe with',
    build: idle,
  },
  {
    id: 'walk',
    label: 'Walk',
    blurb: 'Legs counter-phase, arms against them, one bob per footfall. The stride follows leg length.',
    needs: (rig) => (rig.byRole.leg.length ? null : 'no legs it can find'),
    build: walk,
  },
  {
    id: 'attack',
    label: 'Attack',
    blurb: 'Wind up, twist, strike and recover. Uses the arms if there are any, the head if not.',
    needs: (rig) =>
      rig.byRole.arm.length || rig.byRole.head.length ? null : 'no arms and no head to strike with',
    build: attack,
  },
  {
    id: 'hurt',
    label: 'Hurt',
    blurb: 'A short recoil: knocked back, head snapped, limbs splayed, then settled.',
    needs: (rig) =>
      rig.byRole.root.length || rig.byRole.torso.length ? null : 'no root or body to knock back',
    build: hurt,
  },
]

/**
 * Build one preset against a model. Returns null when the reading found
 * nothing the preset can drive - a clip with no tracks plays nothing,
 * and handing one back would look like the feature had worked.
 */
export function autoAnimate(model: Model, presetId: string, name?: string): Clip | null {
  const preset = AUTO_PRESETS.find((p) => p.id === presetId)
  if (!preset) return null
  const rig = readRig(model)
  if (preset.needs(rig)) return null

  const { length, loop, tracks } = preset.build(rig)
  const real = tracks.filter((t) => t.keys.length >= 2)
  if (!real.length) return null

  return {
    id: newId(),
    name: name ?? `auto_${preset.id}`,
    loop,
    length,
    snapping: 24,
    tracks: real,
  }
}
