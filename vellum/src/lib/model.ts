/* ---------------------------------------------------------------
   The model, in memory.

   This mirrors the `.vellum` document one-for-one: cubes, bones,
   textures and clips, with ids rather than array indices and one track
   per bone-channel pair. The only shape that differs is the bone tree -
   on disk each bone names its `parent`, in memory the tree is nested,
   because that is what a renderer and an outliner both want. The codec
   flattens on write and rebuilds on read.

   Two semantics are easy to get wrong and are worth stating here:

   1. A cube's `rotation` turns about its `origin`, which is an absolute
      model coordinate - not about the cube's own centre.
   2. Face UVs are `[x1, y1, x2, y2]` in TEXTURE PIXELS with a top-left
      origin, not normalised. A reversed coordinate mirrors the face, so
      a rectangle must never be normalised to min/max on load.
   --------------------------------------------------------------- */

import { validateBehaviour } from './behaviour'
import type { Behaviour } from './behaviour'
import { validateConfig } from './mythic'
import type { MythicConfig } from './mythic'

export type Vec3 = [number, number, number]
export type UVRect = [number, number, number, number]

export const FACES = ['north', 'east', 'south', 'west', 'up', 'down'] as const
export type FaceKey = (typeof FACES)[number]

/**
 * What a model is. It drives which validation rules apply, and it is
 * the project's, not the file's: a `.vellum` carries no format string,
 * so one model can never claim two formats.
 */
export type ProjectKind = 'items' | 'mobs' | 'blocks'

/**
 * What it is *for*, which is a different question from what it is.
 *
 * A consumable used to be a fourth kind, which put it beside "item" as
 * though holding a potion were a different act from holding a sword.
 * It is not: a consumable is an item, and so are a weapon and a tool.
 * What separates them is what the game does with one, and that is
 * exactly what a subtype is - it picks the validation rules and it
 * groups the shelf, and it changes no geometry.
 *
 * A model read from an older file has none. That is allowed: absent
 * means "not said", and nothing may infer a subtype from a name.
 */
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

/** Whether a subtype is one this kind actually offers. */
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
   * Where a box unwrap starts on the sheet, when `boxUv` is set.
   *
   * The six face rects are always written out in full, so the UV
   * *positions* survive a round trip on their own. What does not is the
   * origin they were generated from - and a reader that regenerates the
   * unwrap rather than trusting the rects has nothing to regenerate
   * from. Absent on a cube that is not box-unwrapped.
   */
  uvOffset?: [number, number]
  /** Mirrors the unwrap across the vertical axis. */
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
  /** Mirrors every cube under it, rather than each one saying so. */
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
   * The space face UVs are expressed in. NOT necessarily the image size:
   * a 64-unit model can be painted on a 512px sheet with uvWidth 64.
   * Divide UVs by this, never by `width`.
   */
  uvWidth: number
  uvHeight: number
  /** data URI */
  source: string
}

export type Channel = 'rotation' | 'position' | 'scale'
export type Interpolation = 'linear' | 'step' | 'catmullrom' | 'bezier'

export type Key = {
  id: string
  time: number
  value: Vec3
  interp: Interpolation
}

/** One bone, one channel. The timeline stacks exactly these as its rows. */
export type Track = {
  bone: string
  channel: Channel
  keys: Key[]
}

export type Clip = {
  id: string
  name: string
  loop: 'loop' | 'once' | 'hold'
  length: number
  snapping: number
  tracks: Track[]
}

export type Model = {
  name: string
  /** what the model is; drives which validation rules apply */
  kind?: ProjectKind
  /** what it is for, within its kind; absent means nobody said */
  subtype?: Subtype
  /** what makes it act on its own, where it does; see lib/behaviour.ts */
  behaviour?: Behaviour
  /** the MythicMobs config authored beside it; see lib/mythic.ts */
  config?: MythicConfig
  resolution: { width: number; height: number }
  bones: Bone[]
  cubes: Cube[]
  textures: Texture[]
  clips: Clip[]
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
 * Catmull-Rom through four control points, at parameter `k` on the
 * middle segment. The end segments repeat their outer neighbour, which
 * is the usual clamped form and keeps a two-key curve from flying off.
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
 * A track's value at time `t`.
 *
 * `step` holds until the next key. `catmullrom` runs a spline through
 * the neighbouring keys - it used to fall through to the same lerp as
 * `linear`, which made a third of the easing menu decorative and played
 * back every shipped clip as if it had been authored straight, since
 * they are all authored catmullrom.
 */
export function sampleTrack(track: Track, t: number): Vec3 {
  const keys = [...track.keys].sort((a, b) => a.time - b.time)
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

/**
 * The rules the editor refuses to write past. Block projects are the
 * strict case: their limits mirror what Minecraft's own block model
 * format allows, and the kind comes from the project rather than the
 * file, because a `.vellum` carries no format string.
 */
export function validateModel(model: Model, kind?: ProjectKind, subtype?: Subtype): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()
  /* The editor holds the kind and subtype the project says, which can
     differ from what the document says while you are changing one. The
     caller's answer wins; the document's is the fallback. */
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
      /* Minecraft renders every item in the item slot, so anything far
         outside the item volume is drawn somewhere the player is not
         looking. This used to ask only of consumables, as though a
         sword hanging out of frame were fine. */
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
        issues.push({ level: 'error', message: `"${tag}" rotates on ${spun.length} axes; a block allows one` })
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

  for (const clip of model.clips) {
    for (const track of clip.tracks) {
      if (!boneById(model, track.bone)) {
        issues.push({ level: 'error', message: `"${clip.name}" drives a bone that is not in the tree` })
      }
      for (const key of track.keys) {
        if (key.time < 0 || key.time > clip.length + 1e-9) {
          /* A warning, not an error: the key round-trips through the
             codec perfectly and the clip still plays, it simply never
             reaches this one. Shortening a clip used to delete these
             outright, which is the thing worth avoiding. */
          issues.push({
            level: 'warning',
            message: `"${clip.name}" has a key at ${key.time}s, past its ${clip.length}s end - it will not play`,
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

  /* Minecraft renders a held item inside a 16-unit slot, so a model
     whose bounding box is bigger than that is drawn bigger than a
     block in the player's hand - which is how a sword ends up taller
     than the player holding it. Nothing checked this, because
     validation only ever looked at each cube on its own. */
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
          message: `${span.toFixed(1)} units across ${axis[i]} — an item is rendered in a 16-unit slot, so this is ${(span / 16).toFixed(2)} blocks in hand`,
        })
      }
    }
  }

  /* A consumable is defined by its use animation. Shipping one with no
     clip is the whole point missed, and nothing else would have said
     so - validation only ever looked at geometry. */
  if (sub === 'consumable' && !model.clips.length) {
    issues.push({
      level: 'warning',
      message: 'A consumable with no animation: add a use clip, or this is an ordinary item',
    })
  }

  /* The pose a player sees most of a hostile mob is the one where it is
     coming at them. A hostile with an idle and a walk and nothing else
     will attack on the idle, which reads as the mob doing nothing while
     the damage lands. */
  if (sub === 'hostile' && model.clips.length && !model.clips.some((c) => ATTACK_CLIP.test(c.name))) {
    issues.push({
      level: 'warning',
      message: 'A hostile mob with no attack clip: it will swing on its idle, which reads as nothing happening',
    })
  }

  /* A subtype that the kind does not offer means the file was written
     by hand or upgraded wrong. It is worth an error rather than a
     shrug, because everything downstream - the shelf, the rules above -
     reads it and finds nothing. */
  if (sub && kind && !subtypeFits(kind, sub)) {
    issues.push({
      level: 'error',
      message: `"${sub}" is not a subtype that ${kind} offer`,
    })
  }

  issues.push(...validateBehaviour(model, model.behaviour))
  issues.push(...validateConfig(model.name, kind, model.config))

  return issues
}

/** What reads as an attack in a clip name, across the usual vocabularies. */
const ATTACK_CLIP = /attack|strike|swing|bite|lunge|slam|hit|charge/i
