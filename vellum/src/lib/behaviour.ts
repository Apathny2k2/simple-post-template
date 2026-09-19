/* ---------------------------------------------------------------
   Behaviours: what makes a block or an item do something on its own.

   An animation says how a model moves. It does not say *when*, and for
   a block that is most of the question. A geyser is not a model with a
   steam clip - it is a model that sits quiet until there is water over
   lava beneath it, then charges for a while, rumbles as it nears full,
   blows, and settles. Nothing in a clip can express "for a while" or
   "when there is lava below".

   So a behaviour is two things and nothing else:

   1. `requires` - what has to be true of the blocks around this one
      before any of it runs. All of them, or none of it.
   2. `stages` - an ordered cycle. Each stage lasts a number of seconds,
      plays one of the model's own clips while it does, and may throw
      off particles, a sound or a shake. The cycle repeats while the
      requirements hold.

   "Near full charge it rumbles" needs no special case: rumble is the
   stage before the burst, and how long the charge runs is the charge
   stage's own duration.

   The plugin is what checks the world and runs the clock. This is the
   authoring half: the shape, the rules, and a clock good enough to
   watch the thing work before it ever reaches a server.
   --------------------------------------------------------------- */

import type { Model, Vec3 } from './model'

export type EffectKind = 'particles' | 'sound' | 'shake'

export type BehaviourEffect = {
  kind: EffectKind
  /** a particle or sound id; a shake has none */
  id?: string
  /** particles per second, sound volume, or shake amplitude in units */
  amount: number
  /** where it leaves the model, in model units; the model's origin when absent */
  at?: Vec3
}

export type BehaviourStage = {
  id: string
  name: string
  /** how long it lasts. A stage of zero seconds is a stage nobody sees. */
  seconds: number
  /** one of the model's clips, looped for the stage's length; null holds the rest pose */
  clip: string | null
  effects: BehaviourEffect[]
}

export type BehaviourRequirement = {
  id: string
  /** where to look, in blocks, relative to this one */
  at: Vec3
  /** what has to be there */
  block: string
}

export type Behaviour = {
  requires: BehaviourRequirement[]
  stages: BehaviourStage[]
}

export const EMPTY_BEHAVIOUR: Behaviour = { requires: [], stages: [] }

export const hasBehaviour = (b: Behaviour | undefined): b is Behaviour =>
  !!b && (b.requires.length > 0 || b.stages.length > 0)

/* ---------------- the catalogue ---------------- */

/** Particles a pack can already name, with the colour each reads as. */
export const PARTICLES: Array<{ id: string; label: string; colour: string; rise: number }> = [
  { id: 'minecraft:cloud', label: 'Steam', colour: '#e8f1f6', rise: 1 },
  { id: 'minecraft:splash', label: 'Splash', colour: '#7fc4e8', rise: 0.6 },
  { id: 'minecraft:smoke', label: 'Smoke', colour: '#6b6b6b', rise: 0.8 },
  { id: 'minecraft:flame', label: 'Flame', colour: '#ff9a3c', rise: 0.7 },
  { id: 'minecraft:lava', label: 'Lava drip', colour: '#ff5a1f', rise: -0.4 },
  { id: 'minecraft:crit', label: 'Crit', colour: '#ffe08a', rise: 0.5 },
  { id: 'minecraft:enchant', label: 'Enchant', colour: '#c8a6ff', rise: 0.4 },
  { id: 'minecraft:block_dust', label: 'Ground dust', colour: '#9c8b74', rise: 0.15 },
]

export const particleById = (id: string | undefined) =>
  PARTICLES.find((p) => p.id === id) ?? PARTICLES[0]

/** The blocks a requirement is most often about, offered rather than typed. */
export const COMMON_BLOCKS = [
  'minecraft:water',
  'minecraft:lava',
  'minecraft:air',
  'minecraft:stone',
  'minecraft:magma_block',
  'minecraft:redstone_block',
  'minecraft:soul_sand',
]

/* ---------------- reading a position out loud ---------------- */

/**
 * What an offset means in words. A modeller thinks "a water source
 * under it", not "[0, -1, 0]", and a row of three numbers is exactly
 * where an off-by-one hides.
 */
export function offsetLabel(at: Vec3): string {
  const [x, y, z] = at
  if (x === 0 && y === 0 && z === 0) return 'this block itself'
  const parts: string[] = []
  const say = (n: number, pos: string, neg: string) => {
    if (n === 0) return
    const mag = Math.abs(n)
    parts.push(mag === 1 ? (n > 0 ? pos : neg) : `${mag} ${n > 0 ? pos : neg}`)
  }
  say(y, 'above', 'below')
  say(x, 'east', 'west')
  say(z, 'south', 'north')
  return parts.join(', ')
}

/* ---------------- the clock ---------------- */

export const cycleLength = (b: Behaviour) =>
  b.stages.reduce((n, s) => n + Math.max(0, s.seconds), 0)

export type StageAt = {
  stage: BehaviourStage | null
  index: number
  /** seconds into this stage */
  local: number
  /** 0..1 through this stage */
  progress: number
}

const NO_STAGE: StageAt = { stage: null, index: -1, local: 0, progress: 0 }

/** Which stage a cycle is in at `t` seconds, wrapping. */
export function stageAt(b: Behaviour, t: number): StageAt {
  const total = cycleLength(b)
  if (total <= 0) return NO_STAGE
  let at = t % total
  if (at < 0) at += total
  for (let i = 0; i < b.stages.length; i++) {
    const s = b.stages[i]
    const len = Math.max(0, s.seconds)
    if (len <= 0) continue
    if (at < len) return { stage: s, index: i, local: at, progress: at / len }
    at -= len
  }
  // floating point can leave a sliver at the very end of the cycle
  const last = b.stages.filter((s) => s.seconds > 0).pop() ?? null
  return last
    ? { stage: last, index: b.stages.indexOf(last), local: last.seconds, progress: 1 }
    : NO_STAGE
}

/* ---------------- making one ---------------- */

let n = 0
const id = (p: string) => `${p}${(n += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const makeStage = (name: string, seconds: number, clip: string | null = null): BehaviourStage => ({
  id: id('bs'),
  name,
  seconds,
  clip,
  effects: [],
})

export const makeRequirement = (at: Vec3, block: string): BehaviourRequirement => ({
  id: id('br'),
  at,
  block,
})

/* ---------------- rules ---------------- */

export type BehaviourIssue = { level: 'error' | 'warning'; message: string }

/**
 * What can be wrong with a behaviour, checked against the model it is
 * attached to - a stage can only play a clip that model actually has.
 */
export function validateBehaviour(model: Model, b: Behaviour | undefined): BehaviourIssue[] {
  if (!hasBehaviour(b)) return []
  const out: BehaviourIssue[] = []

  if (model.kind === 'mobs') {
    out.push({
      level: 'warning',
      message:
        'A behaviour on a mob: a mob is animated by what it is doing, not by the blocks around it. This will not be read.',
    })
  }

  const seenAt = new Set<string>()
  for (const r of b.requires) {
    if (r.at.every((v) => v === 0)) {
      out.push({ level: 'error', message: 'A requirement on this block itself can never be a condition' })
    }
    if (r.at.some((v) => !Number.isInteger(v))) {
      out.push({ level: 'error', message: `"${r.block}" is half a block away — offsets are whole blocks` })
    }
    if (!r.block.trim()) {
      out.push({ level: 'error', message: `The requirement ${offsetLabel(r.at)} names no block` })
    }
    const key = r.at.join(',')
    if (seenAt.has(key)) {
      out.push({
        level: 'warning',
        message: `Two requirements look at the same place (${offsetLabel(r.at)}) — one block cannot be two things`,
      })
    }
    seenAt.add(key)
  }

  if (!b.stages.length) {
    out.push({
      level: 'warning',
      message: 'Requirements but no stages: nothing happens when they are met',
    })
  }

  for (const s of b.stages) {
    if (s.seconds <= 0) {
      out.push({ level: 'error', message: `Stage "${s.name}" lasts ${s.seconds}s, so nobody sees it` })
    }
    if (s.clip && !model.clips.some((c) => c.id === s.clip)) {
      out.push({ level: 'error', message: `Stage "${s.name}" plays a clip this model does not have` })
    }
    for (const e of s.effects) {
      if (e.amount <= 0) {
        out.push({
          level: 'warning',
          message: `Stage "${s.name}" has a ${e.kind} effect set to ${e.amount}, which emits nothing`,
        })
      }
    }
  }

  if (b.stages.length && !b.requires.length) {
    out.push({
      level: 'warning',
      message: 'Stages but no requirements: the cycle runs from the moment the block is placed',
    })
  }

  return out
}

/* ---------------- a worked example ---------------- */

/**
 * The geyser, which is the case this whole shape was built around:
 * water over lava beneath it, a long quiet charge, a rumble as it nears
 * full, the burst, and a settle before it starts again.
 *
 * Clip ids are resolved by the caller, because a behaviour can only
 * name clips the model it is attached to actually has.
 */
export function geyserBehaviour(clips: { idle?: string; rumble?: string; erupt?: string }): Behaviour {
  const charge = makeStage('charge', 7, clips.idle ?? null)
  charge.effects = [{ kind: 'particles', id: 'minecraft:splash', amount: 1, at: [0, 14, 0] }]

  const rumble = makeStage('rumble', 2.2, clips.rumble ?? null)
  rumble.effects = [
    { kind: 'shake', amount: 0.4 },
    { kind: 'particles', id: 'minecraft:block_dust', amount: 14, at: [0, 1, 0] },
  ]

  const erupt = makeStage('erupt', 1.6, clips.erupt ?? null)
  erupt.effects = [
    { kind: 'particles', id: 'minecraft:cloud', amount: 48, at: [0, 16, 0] },
    { kind: 'sound', id: 'minecraft:block.fire.extinguish', amount: 1 },
  ]

  const settle = makeStage('settle', 2.4, clips.idle ?? null)
  settle.effects = [{ kind: 'particles', id: 'minecraft:cloud', amount: 6, at: [0, 12, 0] }]

  return {
    requires: [
      makeRequirement([0, -1, 0], 'minecraft:water'),
      makeRequirement([0, -2, 0], 'minecraft:lava'),
    ],
    stages: [charge, rumble, erupt, settle],
  }
}
