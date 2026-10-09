/* The model in memory. It matches the `.vellum` document except that the
   bone tree is nested here; on disk each bone names its `parent`.

   A cube's `rotation` turns about its `origin`, an absolute model
   coordinate. Face UVs are `[x1, y1, x2, y2]` in the texture's UV units
   (see `Texture.uvWidth`) from the top left. A reversed pair mirrors the
   face, so never normalise a rectangle to min/max on load. */

import { validateBehaviour } from './behaviour'
import { evalMolang } from './molang'
import type { Behaviour } from './behaviour'
import { validateConfig } from './config'
import type { Config } from './config'

export type Vec3 = [number, number, number]
export type UVRect = [number, number, number, number]

export const FACES = ['north', 'east', 'south', 'west', 'up', 'down'] as const
export type FaceKey = (typeof FACES)[number]

/** What a model is. It decides which validation rules apply. */
export type ProjectKind = 'items' | 'mobs' | 'blocks'

/** What an item or mob is for. Picks validation rules and the shelf group; never inferred from a name. */
export type ItemType = 'weapon' | 'tool' | 'consumable' | 'misc'
export type MobType = 'hostile' | 'neutral' | 'docile'
export type Subtype = ItemType | MobType

export const ITEM_TYPES: readonly ItemType[] = ['weapon', 'tool', 'consumable', 'misc']
export const MOB_TYPES: readonly MobType[] = ['hostile', 'neutral', 'docile']

/** The subtypes a kind offers, in the order a picker should show them. */
export const SUBTYPES: Record<ProjectKind, readonly Subtype[]> = {
  items: ITEM_TYPES,
  mobs: MOB_TYPES,
  blocks: [],
}

const SUBTYPE_LABELS: Record<Subtype, string> = {
  weapon: 'Weapon',
  tool: 'Tool',
  consumable: 'Consumable',
  misc: 'Misc',
  hostile: 'Hostile',
  neutral: 'Neutral',
  docile: 'Docile',
}

export const subtypeLabel = (s: Subtype) => SUBTYPE_LABELS[s]

/** What a new model of this kind starts as, or nothing where a kind has no subtypes. */
export const defaultSubtype = (kind: ProjectKind): Subtype | undefined =>
  kind === 'items' ? 'misc' : kind === 'mobs' ? 'neutral' : undefined

/** Whether this kind offers the subtype. */
export function subtypeFits(kind: ProjectKind | undefined, sub: unknown): sub is Subtype {
  if (!kind) return false
  return (SUBTYPES[kind] as readonly string[]).includes(sub as string)
}

export type Face = {
  uv: UVRect
  /** a texture id, or null for an untextured face */
  texture: string | null
  rotation?: 0 | 90 | 180 | 270
}

export type Cube = {
  id: string
  name: string
  from: Vec3
  to: Vec3
  origin: Vec3
  rotation: Vec3
  faces: Record<FaceKey, Face>
  inflate: number
  boxUv: boolean
  /**
   * Where the box unwrap starts on the sheet, when `boxUv` is set. The face
   * rects are stored in full; this is for readers that regenerate them.
   */
  uvOffset?: [number, number]
  /** Box unwrap mirrored across the vertical axis; only stored, for readers that regenerate it. */
  mirrorUv?: boolean
  visible: boolean
  locked: boolean
}

export type BoneChild = { kind: 'bone'; bone: Bone } | { kind: 'cube'; id: string }

export type Bone = {
  id: string
  name: string
  origin: Vec3
  rotation: Vec3
  visible: boolean
  locked: boolean
  /** Marks every cube under it as mirrored. Only stored, like `Cube.mirrorUv`. */
  mirrorUv?: boolean
  children: BoneChild[]
}

export type Texture = {
  id: string
  name: string
  /** the image's own pixel size */
  width: number
  height: number
  /**
   * The space face UVs are in, which can differ from the image size: a
   * 512px sheet can have uvWidth 64, so divide UVs by this.
   */
  uvWidth: number
  uvHeight: number
  /** data URI */
  source: string
  /** the pixels already carry face shading, so the viewport adds none (the stage's sheet) */
  shaded?: boolean
  /**
   * Paint layers, bottom first (v13). When present, `source` is them
   * flattened, so whatever reads `source` sees the finished image.
   */
  layers?: TextureLayer[]
  /**
   * How an animated texture plays (v14). A texture is animated when its
   * image is a strip of frames, top to bottom, each the UV sheet's shape
   * (`frameCount`); this says how fast and in what order they go.
   */
  animation?: TextureAnimation
}

/** Playback of an animated texture, as Blockbench and Java's `.mcmeta` describe it. */
export type TextureAnimation = {
  /** game ticks (1/20 s) each frame shows for */
  frameTime: number
  /** the frames in order, front to back and round again, or back and forth; unset is 'loop' */
  mode?: 'loop' | 'backwards' | 'back_and_forth'
  /** an explicit frame order, by index; overrides `mode` */
  order?: number[]
  /** cross-fade into the next frame, as Java's `interpolate` does */
  interpolate?: boolean
}

/** One layer of a texture: its own pixels, whether it shows, and how strongly. */
export type TextureLayer = {
  id: string
  name: string
  /** data URI, the texture's size */
  source: string
  visible: boolean
  /** 0 to 1 */
  opacity: number
}

export type Channel = 'rotation' | 'position' | 'scale'
export type Interpolation = 'linear' | 'step' | 'catmullrom' | 'bezier'

/** Bezier handles, all four arrays or none: offsets from the key in seconds and value, per axis. */
export type Handles = {
  leftTime: Vec3
  leftValue: Vec3
  rightTime: Vec3
  rightValue: Vec3
}

export type Key = {
  id: string
  time: number
  value: Vec3
  interp: Interpolation
  /** absent unless the author drew one */
  handles?: Handles
  /**
   * Molang for an axis, played instead of that axis's number (v11). Null
   * where the axis is a plain number; absent when no axis has any.
   */
  expr?: Array<string | null>
}

/** One bone and channel: one row in the timeline. */
export type Track = {
  bone: string
  channel: Channel
  keys: Key[]
}

/** What a clip does at its end: start over, stop at 0, stop on the last frame, or play back and forth (v8). */
export type LoopMode = 'loop' | 'once' | 'hold' | 'pingpong'

/** A timed effect on a clip (v8): Blockbench's sound, particle and instruction keyframes. */
export type EventKind = 'sound' | 'particle' | 'script'
export type ClipEvent = {
  id: string
  time: number
  kind: EventKind
  /** a sound or particle id such as `minecraft:entity.zombie.ambient`, or the script itself */
  effect: string
  /** a null object id: where a particle starts or a sound plays from */
  locator?: string
}

export type Clip = {
  id: string
  name: string
  loop: LoopMode
  length: number
  snapping: number
  tracks: Track[]
  /** absent when the clip has none */
  events?: ClipEvent[]
}

/**
 * A point that belongs to a bone (v8), Blockbench's null object. It marks
 * where an effect plays, and with `ikTarget` it is the point an IK chain
 * reaches for. `position` is an absolute model coordinate, like a pivot,
 * and can be animated through a `position` track keyed by the null's id.
 */
export type NullObject = {
  id: string
  name: string
  /** the bone it moves with; null at the model root */
  parent: string | null
  position: Vec3
  /** the bone at the end of the chain that reaches for this point */
  ikTarget?: string
  /** how many bones above `ikTarget` bend to reach it; 2 when unset */
  ikChain?: number
  visible: boolean
  locked: boolean
}

/** One face of a mesh: three or more of its vertices, each with its own UV, in UV units. */
export type MeshFace = {
  vertices: string[]
  uv: Record<string, [number, number]>
  texture: string | null
}

/**
 * A free-form mesh (v9), Blockbench's mesh element. Vertices are offsets
 * from `origin`, which is also the point it turns about. Like a null
 * object it names the bone it rides on with `parent`; the bone tree does
 * not list it.
 */
export type Mesh = {
  id: string
  name: string
  /** a bone's id; null at the model root */
  parent: string | null
  origin: Vec3
  rotation: Vec3
  vertices: Record<string, Vec3>
  faces: Record<string, MeshFace>
  visible: boolean
  locked: boolean
  /**
   * A texture mesh (v15), Blockbench's sprite made solid from a texture's
   * pixels: its faces are built from the texture (`lib/texture-mesh.ts`),
   * scaled, and moved by the local pivot.
   */
  fromTexture?: { texture: string; scale: Vec3; localPivot: Vec3 }
}

/** A state of an animation controller: the clips it plays, added together, and when it moves on. */
export type ControllerState = {
  id: string
  name: string
  /** clips by id; `weight` is Molang for how much of it plays, 1 when absent */
  clips: Array<{ clip: string; weight?: string }>
  /** checked in order each frame; the first whose Molang `when` is true moves to `to` (a state id) */
  transitions: Array<{ to: string; when: string }>
  /** seconds to cross-fade from the state before */
  blend?: number
  /** Molang run as the state starts and ends, usually setting variables */
  onEntry?: string
  onExit?: string
}

/** A Bedrock animation controller: states and the conditions that move between them. */
export type Controller = {
  id: string
  name: string
  /** the state it starts in */
  initial: string
  states: ControllerState[]
}

export type Model = {
  name: string
  /** what the model is; drives which validation rules apply */
  kind?: ProjectKind
  /** what it is for, within its kind; absent means not set */
  subtype?: Subtype
  /** what makes it act on its own; see lib/behaviour.ts */
  behaviour?: Behaviour
  /** the stats and behaviour authored beside it; see lib/config.ts */
  config?: Config
  resolution: { width: number; height: number }
  bones: Bone[]
  cubes: Cube[]
  textures: Texture[]
  clips: Clip[]
  /** absent when the model has none (v8) */
  nulls?: NullObject[]
  /** absent when the model has none (v9) */
  meshes?: Mesh[]
  /** Bedrock animation controllers (v12); absent when the model has none */
  controllers?: Controller[]
  /**
   * What a Blockbench project held that Vellum has no field for (v10): its
   * meta and display settings, and each element's, group's, texture's and
   * animation's other keys by id. Kept so a .bbmodel export gives them back.
   */
  blockbench?: Record<string, unknown>
}

/* ---------------- lookups ---------------- */

export const cubeById = (model: Model, id: string) => model.cubes.find((c) => c.id === id) ?? null

export function boneById(model: Model, id: string): Bone | null {
  const walk = (bones: Bone[]): Bone | null => {
    for (const b of bones) {
      if (b.id === id) return b
      const found = walk(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))
      if (found) return found
    }
    return null
  }
  return walk(model.bones)
}

export const textureById = (model: Model, id: string | null) =>
  id === null ? null : (model.textures.find((t) => t.id === id) ?? null)

/* ---------------- derived views ---------------- */

/** Position is `from`; size is `to - from`. */
export const cubeSize = (c: Cube): Vec3 => [c.to[0] - c.from[0], c.to[1] - c.from[1], c.to[2] - c.from[2]]

export function setCubeSize(c: Cube, size: Vec3): Cube {
  return { ...c, to: [c.from[0] + size[0], c.from[1] + size[1], c.from[2] + size[2]] }
}

export function setCubePosition(c: Cube, from: Vec3): Cube {
  const size = cubeSize(c)
  return { ...c, from, to: [from[0] + size[0], from[1] + size[1], from[2] + size[2]] }
}

export type FlatNode =
  | { kind: 'bone'; depth: number; bone: Bone }
  | { kind: 'cube'; depth: number; cube: Cube }

/** The bone tree, flattened for list rendering. Collapsed bones hide their subtree. */
export function flattenBones(model: Model, collapsed: ReadonlySet<string> = new Set()): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (bones: Bone[], depth: number) => {
    for (const b of bones) {
      out.push({ kind: 'bone', depth, bone: b })
      if (collapsed.has(b.id)) continue
      for (const child of b.children) {
        if (child.kind === 'bone') walk([child.bone], depth + 1)
        else {
          const cube = cubeById(model, child.id)
          if (cube) out.push({ kind: 'cube', depth: depth + 1, cube })
        }
      }
    }
  }
  walk(model.bones, 0)
  return out
}

/* ---------------- animation ---------------- */

const DEFAULTS: Record<Channel, Vec3> = {
  rotation: [0, 0, 0],
  position: [0, 0, 0],
  scale: [1, 1, 1],
}

/**
 * Catmull-Rom on the segment p1..p2 at `k` in 0..1. At a track's ends the
 * caller repeats the end key for the missing neighbour.
 */
const spline = (p0: number, p1: number, p2: number, p3: number, k: number) => {
  const k2 = k * k
  const k3 = k2 * k
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * k +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * k3)
  )
}

/**
 * A bezier segment from key `a` to key `b` at time `t`, per axis, as
 * Blockbench plays them. Handles are offsets from their key in seconds and
 * value. `a` uses its right handle and `b` its left; a key with no handles
 * gets flat ones a third of the way along, which eases in and out. Handle
 * times are kept inside the segment, so time only runs forward.
 */
function bezierSegment(a: Key, b: Key, t: number): Vec3 {
  const span = b.time - a.time || 1
  const out: Vec3 = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const rt = Math.max(0, Math.min(span, a.handles?.rightTime[i] ?? span / 3))
    const rv = a.handles?.rightValue[i] ?? 0
    const lt = Math.max(-span, Math.min(0, b.handles?.leftTime[i] ?? -span / 3))
    const lv = b.handles?.leftValue[i] ?? 0
    const x = [a.time, a.time + rt, b.time + lt, b.time]
    const y = [a.value[i], a.value[i] + rv, b.value[i] + lv, b.value[i]]
    const at = (p: number[], u: number) =>
      (1 - u) ** 3 * p[0] + 3 * (1 - u) ** 2 * u * p[1] + 3 * (1 - u) * u ** 2 * p[2] + u ** 3 * p[3]
    // x(u) rises from a.time to b.time, so bisection finds the u for t
    let lo = 0
    let hi = 1
    for (let n = 0; n < 30; n++) {
      const mid = (lo + hi) / 2
      if (at(x, mid) < t) lo = mid
      else hi = mid
    }
    out[i] = at(y, (lo + hi) / 2)
  }
  return out
}

/** A key's value at time `t`: its Molang axes run with the playhead as anim_time and life_time. */
export function molangValue(k: Key, t: number): Vec3 {
  const query = { anim_time: t, life_time: t }
  return k.value.map((v, i) => (k.expr?.[i] ? evalMolang(k.expr[i]!, { query }, v) : v)) as Vec3
}

/** A track's value at time `t`. Each segment eases by its first key's `interp`. */
export function sampleTrack(track: Track, t: number): Vec3 {
  // keys written in Molang take their value at this moment, as Bedrock plays them
  const keys = [...track.keys].sort((a, b) => a.time - b.time).map((k) => (k.expr ? { ...k, value: molangValue(k, t) } : k))
  if (!keys.length) return DEFAULTS[track.channel]
  if (t <= keys[0].time) return keys[0].value
  const last = keys[keys.length - 1]
  if (t >= last.time) return last.value

  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t < a.time || t > b.time) continue
    if (a.interp === 'step') return a.value

    const k = (t - a.time) / (b.time - a.time || 1)
    if (a.interp === 'bezier') return bezierSegment(a, b, t)
    if (a.interp !== 'catmullrom') {
      return [
        a.value[0] + (b.value[0] - a.value[0]) * k,
        a.value[1] + (b.value[1] - a.value[1]) * k,
        a.value[2] + (b.value[2] - a.value[2]) * k,
      ]
    }

    const p0 = keys[i - 1] ?? a
    const p3 = keys[i + 2] ?? b
    return [
      spline(p0.value[0], a.value[0], b.value[0], p3.value[0], k),
      spline(p0.value[1], a.value[1], b.value[1], p3.value[1], k),
      spline(p0.value[2], a.value[2], b.value[2], p3.value[2], k),
    ]
  }
  return last.value
}

export type Pose = Record<string, { rotation: Vec3; position: Vec3; scale: Vec3 }>

/** Every animated bone's transform at time `t`. Untracked bones are absent. */
export function samplePose(clip: Clip | null, t: number): Pose {
  if (!clip) return {}
  const pose: Pose = {}
  for (const track of clip.tracks) {
    const entry = (pose[track.bone] ??= {
      rotation: DEFAULTS.rotation,
      position: DEFAULTS.position,
      scale: DEFAULTS.scale,
    })
    entry[track.channel] = sampleTrack(track, t)
  }
  return pose
}

/* ---------------- validation ---------------- */

export type Issue = { level: 'error' | 'warning'; message: string }

const BLOCK_ROTATIONS = new Set([-45, -22.5, 0, 22.5, 45])

/** Issues for the editor's Validation panel. Block projects get Minecraft's block model limits. */
export function validateModel(model: Model, kind?: ProjectKind, subtype?: Subtype): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()
  /* `kind` is the caller's; only `subtype` falls back to the model's own. */
  const sub = subtype ?? model.subtype

  for (const cube of model.cubes) {
    const tag = cube.name || cube.id
    if (seen.has(cube.id)) issues.push({ level: 'error', message: `Duplicate cube id on "${tag}"` })
    seen.add(cube.id)

    for (let i = 0; i < 3; i++) {
      if (cube.to[i] < cube.from[i]) {
        issues.push({ level: 'error', message: `"${tag}": to[${i}] is behind from[${i}]` })
      }
    }

    for (const key of FACES) {
      const { uv, texture } = cube.faces[key]
      if (texture !== null && !textureById(model, texture)) {
        issues.push({ level: 'error', message: `"${tag}" ${key} face names a texture that does not exist` })
      }
      const [x1, y1, x2, y2] = uv
      if (texture !== null && (x1 === x2 || y1 === y2)) {
        issues.push({
          level: 'warning',
          message: `"${tag}" ${key} has a zero-area UV, so it cannot be textured or painted`,
        })
      }
      if (
        Math.min(x1, x2) < 0 ||
        Math.max(x1, x2) > model.resolution.width ||
        Math.min(y1, y2) < 0 ||
        Math.max(y1, y2) > model.resolution.height
      ) {
        issues.push({ level: 'warning', message: `"${tag}" ${key} UV falls outside the sheet` })
      }
    }

    if (kind === 'items') {
      /* Minecraft renders items in the item slot, so geometry far
         outside it is drawn where the player is not looking. */
      for (const v of [...cube.from, ...cube.to]) {
        if (v < -16 || v > 32) {
          issues.push({ level: 'warning', message: `"${tag}": ${v} is outside an item's -16..32 range` })
        }
      }
    }

    if (kind === 'blocks') {
      for (const v of [...cube.from, ...cube.to]) {
        if (v < -16 || v > 32) {
          issues.push({ level: 'error', message: `"${tag}": ${v} is outside a block's -16..32 range` })
        }
      }
      const spun = cube.rotation.filter((r) => r !== 0)
      if (spun.length > 1) {
        issues.push({ level: 'error', message: `"${tag}" rotates on ${spun.length} axes, but a block can only rotate on 1` })
      }
      for (const r of cube.rotation) {
        if (!BLOCK_ROTATIONS.has(r)) {
          issues.push({ level: 'error', message: `"${tag}" rotation ${r}° is not one of -45, -22.5, 0, 22.5, 45` })
        }
      }
    }
  }

  const referenced = new Map<string, number>()
  const walk = (bones: Bone[]) => {
    for (const b of bones) {
      for (const child of b.children) {
        if (child.kind === 'cube') referenced.set(child.id, (referenced.get(child.id) ?? 0) + 1)
        else walk([child.bone])
      }
    }
  }
  walk(model.bones)

  for (const [id, n] of referenced) {
    if (!model.cubes.some((c) => c.id === id)) {
      issues.push({ level: 'error', message: 'The bone tree names a cube that does not exist' })
    }
    if (n > 1) issues.push({ level: 'error', message: `A cube appears ${n} times in the bone tree` })
  }
  for (const cube of model.cubes) {
    if (!referenced.has(cube.id)) {
      issues.push({ level: 'warning', message: `"${cube.name}" is not in the bone tree` })
    }
  }

  const nullIds = new Set<string>()
  for (const n of model.nulls ?? []) {
    if (nullIds.has(n.id)) issues.push({ level: 'error', message: `Duplicate null object id on "${n.name}"` })
    nullIds.add(n.id)
    if (n.parent && !boneById(model, n.parent)) {
      issues.push({ level: 'error', message: `"${n.name}" belongs to a bone that is not in the tree` })
    }
    if (n.ikTarget) {
      const tip = boneById(model, n.ikTarget)
      if (!tip) issues.push({ level: 'error', message: `"${n.name}" is the IK target of a bone that is not in the tree` })
      if (n.ikChain !== undefined && (!Number.isInteger(n.ikChain) || n.ikChain < 1 || n.ikChain > 8)) {
        issues.push({ level: 'warning', message: `"${n.name}" bends ${n.ikChain} bones; an IK chain takes 1 to 8` })
      }
    }
  }

  for (const clip of model.clips) {
    if (/\s/.test(clip.name)) {
      issues.push({ level: 'warning', message: `"${clip.name}" has a space in its name, so a config can\u2019t name it. Use underscores` })
    }
    for (const ev of clip.events ?? []) {
      if (ev.time < 0 || ev.time > clip.length + 1e-9) {
        issues.push({ level: 'warning', message: `"${clip.name}" has a ${ev.kind} event past its end, so it won't play` })
      }
      if (ev.locator && !(model.nulls ?? []).some((n) => n.id === ev.locator)) {
        issues.push({ level: 'error', message: `"${clip.name}" plays an effect at a null object that is gone` })
      }
    }
    for (const track of clip.tracks) {
      // a null object's position can be keyed like a bone's
      if (!boneById(model, track.bone) && !(track.channel === 'position' && (model.nulls ?? []).some((n) => n.id === track.bone))) {
        issues.push({ level: 'error', message: `"${clip.name}" drives a bone that is not in the tree` })
      }
      for (const key of track.keys) {
        if (key.time < 0 || key.time > clip.length + 1e-9) {
          /* A warning because the key still round-trips and the clip
             plays; playback never reaches it. */
          issues.push({
            level: 'warning',
            message: `"${clip.name}" has a key at ${key.time}s, past its ${clip.length}s end, so that key won't play`,
          })
        }
      }
      if (clip.loop === 'loop' && track.keys.length >= 2) {
        const start = sampleTrack(track, 0)
        const end = sampleTrack(track, clip.length)
        if (start.some((v, i) => Math.abs(v - end[i]) > 1e-9)) {
          issues.push({
            level: 'warning',
            message: `"${clip.name}" ${track.channel} on this bone does not return to its start pose, so the loop will jump`,
          })
        }
      }
    }
  }

  /* Minecraft renders a held item in a 16-unit slot, so a model wider
     than 16 on any axis is bigger than a block in hand. */
  if (kind === 'items' && model.cubes.length) {
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (const c of model.cubes) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], c.from[i])
        hi[i] = Math.max(hi[i], c.to[i])
      }
    }
    const axis = ['X', 'Y', 'Z']
    for (let i = 0; i < 3; i++) {
      const span = hi[i] - lo[i]
      if (span > 16.001) {
        issues.push({
          level: 'warning',
          message: `${span.toFixed(1)} units across ${axis[i]} is ${(span / 16).toFixed(2)} blocks in hand, because items render in a 16-unit slot`,
        })
      }
    }
  }

  /* A consumable is defined by its use animation. */
  if (sub === 'consumable' && !model.clips.length) {
    issues.push({
      level: 'warning',
      message: 'A consumable with no animation: add a use clip, or this is an ordinary item',
    })
  }

  if (sub === 'hostile' && model.clips.length && !model.clips.some((c) => ATTACK_CLIP.test(c.name))) {
    issues.push({
      level: 'warning',
      message: 'A hostile mob with no attack clip plays its idle while attacking, so nothing seems to happen',
    })
  }

  if (sub && kind && !subtypeFits(kind, sub)) {
    issues.push({
      level: 'error',
      message: `"${sub}" is not a subtype that ${kind} offer`,
    })
  }

  issues.push(...validateBehaviour(model, model.behaviour))
  issues.push(...validateConfig(model.name, kind, model.config))

  // meshes: what each face names must exist
  for (const m of model.meshes ?? []) {
    if (seen.has(m.name)) issues.push({ level: 'warning', message: `More than one node is called "${m.name}"` })
    else seen.add(m.name)
    if (m.parent && !boneById(model, m.parent)) issues.push({ level: 'warning', message: `"${m.name}" names a bone the model does not have, so it sits at the root` })
    for (const f of Object.values(m.faces)) {
      if (f.texture !== null && !textureById(model, f.texture)) {
        issues.push({ level: 'error', message: `A face of "${m.name}" names a texture that does not exist` })
        break
      }
    }
    if (!Object.keys(m.faces).length) issues.push({ level: 'warning', message: `"${m.name}" has no faces, so nothing of it shows` })
  }

  return issues
}

/** Clip names that count as an attack. */
const ATTACK_CLIP = /attack|strike|swing|bite|lunge|slam|hit|charge/i

/**
 * Where a key's kept Blockbench fields are filed: by clip, bone, channel and
 * time, as a .vellum gives keys new ids each time it is read. A key moved
 * in time leaves them behind.
 */
export const keyAddress = (clip: string, bone: string, channel: string, time: number) => `${clip}/${bone}/${channel}/${Math.round(time * 1e4) / 1e4}`
