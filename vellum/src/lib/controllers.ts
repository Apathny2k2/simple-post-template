/* Animation controllers, as Bedrock runs them. A controller is in one
   state at a time; a state plays its clips together, each from when the
   state began and each added onto the bones (rotation and position add,
   scale multiplies), at a Molang weight. Every frame the state's
   transitions are checked in order, and the first that holds moves it on,
   cross-fading over the new state's blend time. */

import { sampleTrack } from './model'
import type { Clip, Controller, ControllerState, Model, Pose, Vec3 } from './model'
import { evalMolang } from './molang'
import type { MolangContext } from './molang'

export type ControllerRun = {
  state: string
  /** when this state began, in seconds since the controller started */
  since: number
  /** the state it left and when, while the cross-fade lasts */
  from?: { state: string; since: number; left: number }
  /** Molang variables the states' scripts have set */
  variables: Record<string, number>
}

const stateOf = (c: Controller, id: string) => c.states.find((s) => s.id === id) ?? null

/** A controller at its start: in its first state, having run that state's entry script. */
export function startController(c: Controller, query: Record<string, number> = {}): ControllerRun {
  const run: ControllerRun = { state: c.initial, since: 0, variables: {} }
  const first = stateOf(c, c.initial)
  if (first?.onEntry) evalMolang(first.onEntry, { query: { ...query, anim_time: 0, life_time: 0 }, variable: run.variables })
  return run
}

/** One frame: checks the state's transitions at `now` and moves on at the first that holds. */
export function stepController(c: Controller, run: ControllerRun, now: number, query: Record<string, number> = {}): ControllerRun {
  const state = stateOf(c, run.state)
  if (!state) return run
  const ctx: MolangContext = { query: { ...query, anim_time: now - run.since, life_time: now }, variable: run.variables }
  for (const t of state.transitions) {
    if (!t.when.trim() || !stateOf(c, t.to) || t.to === state.id) continue
    if (evalMolang(t.when, ctx, 0)) {
      if (state.onExit) evalMolang(state.onExit, ctx)
      const next = stateOf(c, t.to)!
      if (next.onEntry) evalMolang(next.onEntry, ctx)
      return { state: next.id, since: now, from: { state: state.id, since: run.since, left: now }, variables: run.variables }
    }
  }
  // the cross-fade is over once the blend time has passed
  if (run.from && now - run.from.left >= (state.blend ?? 0)) return { ...run, from: undefined }
  return run
}

/** Where a clip is `t` seconds after its state began: looped, held on its last frame, or stopped there. */
function clipTime(clip: Clip, t: number): number {
  if (clip.loop === 'loop') return clip.length > 0 ? t % clip.length : 0
  if (clip.loop === 'pingpong') {
    const L = clip.length || 1
    const k = t % (2 * L)
    return k <= L ? k : 2 * L - k
  }
  return Math.min(t, clip.length)
}

/** A state's pose `t` seconds in: its clips added together at their weights. */
export function statePose(model: Model, state: ControllerState, t: number, ctx: MolangContext): Pose {
  const pose: Pose = {}
  for (const { clip: id, weight } of state.clips) {
    const clip = model.clips.find((c) => c.id === id)
    if (!clip) continue
    const w = weight?.trim() ? evalMolang(weight, ctx, 1) : 1
    if (!w) continue
    const at = clipTime(clip, t)
    for (const track of clip.tracks) {
      if (!track.keys.length) continue
      const v = sampleTrack(track, at)
      const entry = (pose[track.bone] ??= { rotation: [0, 0, 0], position: [0, 0, 0], scale: [1, 1, 1] })
      if (track.channel === 'scale') entry.scale = entry.scale.map((s, i) => s * (1 + (v[i] - 1) * w)) as Vec3
      else entry[track.channel] = entry[track.channel].map((x, i) => x + v[i] * w) as Vec3
    }
  }
  return pose
}

const mix = (a: Vec3, b: Vec3, k: number): Vec3 => a.map((x, i) => x + (b[i] - x) * k) as Vec3

/** The controller's pose at `now`: the state's, cross-faded from the state before while its blend lasts. */
export function controllerPose(model: Model, c: Controller, run: ControllerRun, now: number, query: Record<string, number> = {}): Pose {
  const state = stateOf(c, run.state)
  if (!state) return {}
  const ctx = (since: number): MolangContext => ({ query: { ...query, anim_time: now - since, life_time: now }, variable: run.variables })
  const to = statePose(model, state, now - run.since, ctx(run.since))
  const fromState = run.from ? stateOf(c, run.from.state) : null
  const blend = state.blend ?? 0
  if (!run.from || !fromState || blend <= 0) return to
  const k = Math.min(1, (now - run.from.left) / blend)
  if (k >= 1) return to
  const from = statePose(model, fromState, now - run.from.since, ctx(run.from.since))
  const rest = { rotation: [0, 0, 0] as Vec3, position: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3 }
  const out: Pose = {}
  for (const bone of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[bone] ?? rest
    const b = to[bone] ?? rest
    out[bone] = { rotation: mix(a.rotation, b.rotation, k), position: mix(a.position, b.position, k), scale: mix(a.scale, b.scale, k) }
  }
  return out
}

/** A pose as a clip of one moment, so the viewport can show it as it shows any clip at time 0. */
export function poseAsClip(pose: Pose): Clip {
  return {
    id: 'controller-preview',
    name: 'controller',
    loop: 'hold',
    length: 1,
    snapping: 20,
    tracks: Object.entries(pose).flatMap(([bone, p]) =>
      (['rotation', 'position', 'scale'] as const).map((channel) => ({ bone, channel, keys: [{ id: `${bone}:${channel}`, time: 0, value: p[channel], interp: 'linear' as const }] })),
    ),
  }
}
