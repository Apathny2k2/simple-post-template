/* `.vellum`, the native model format: compact UTF-8 JSON on one line. Its
   shape follows the model in `./model`, but the bone tree differs: on disk
   each bone names its `parent`, in memory the tree is nested.

   - The `vellum` header is the first key, so a well-formed file begins
     with HEADER_PREFIX.
   - Keys are written in a fixed order, and faces and keyframes are
     sorted, so the same model always writes the same bytes.
   - An unset optional key is left out. Nothing is written as null.
   - readVellum upgrades an older version in memory. The writer always
     stamps CURRENT_VERSION.

   Not in the file: pack models and textures, display transforms and
   editor state. v8 added `nulls`, clip `events` and `pingpong`; v9 added
   `meshes`. */

import { FACES, keyAddress, subtypeFits } from './model'
import type { Behaviour, BehaviourEffect, BehaviourRequirement, BehaviourStage, EffectKind } from './behaviour'
import { bodyOf, canonicalise, fieldsOf, hasConfig, looksLegacy } from './config'
import type { ConfigValue, Config, Row } from './config'
import type {
  Bone,
  Channel,
  Clip,
  ClipEvent,
  Controller,
  Cube,
  EventKind,
  NullObject,
  Mesh,
  MeshFace,
  Face,
  FaceKey,
  Handles,
  Interpolation,
  Model,
  ProjectKind,
  Subtype,
  Texture,
  TextureAnimation,
  UVRect,
  Vec3,
} from './model'

export const FORMAT = 'model'
export const CURRENT_VERSION = 15

/** A well-formed `.vellum` begins with exactly these bytes. */
export const HEADER_PREFIX = `{"vellum":{"format":"${FORMAT}","version":${CURRENT_VERSION}},`

export const EXTENSION = '.vellum'

/* ---------------- the document shape ---------------- */

type VellumFace = {
  uv: UVRect
  /** a texture's `id` */
  texture?: string
  rotation?: number
}

type VellumCube = {
  id: string
  name: string
  from: Vec3
  to: Vec3
  origin: Vec3
  rotation: Vec3
  inflate?: number
  box_uv?: boolean
  /**
   * Added in v6 with `mirror_uv`: the box unwrap's origin. The face rects are
   * written in full anyway, so only a reader that regenerates the unwrap needs it.
   */
  uv_offset?: [number, number]
  mirror_uv?: boolean
  hidden?: boolean
  locked?: boolean
  faces: Record<string, VellumFace>
}

type VellumBone = {
  id: string
  name: string
  origin: Vec3
  rotation: Vec3
  parent?: string
  cubes: string[]
  /** mirrors every cube under it */
  mirror_uv?: boolean
  hidden?: boolean
  locked?: boolean
}

type VellumTexture = {
  id: string
  name: string
  width: number
  height: number
  uv_width: number
  uv_height: number
  source?: string
  /** added in v13: paint layers, bottom first; `source` is them flattened */
  layers?: Array<{ id: string; name: string; source: string; hidden?: boolean; opacity?: number }>
  /** added in v14: how an animated texture (a strip of frames) plays */
  animation?: { frame_time: number; mode?: 'backwards' | 'back_and_forth'; order?: number[]; interpolate?: true }
}

/** A bezier key's handles: all four arrays or none. A partial set is dropped on read. */
type WireHandles = {
  left_time: Vec3
  left_value: Vec3
  right_time: Vec3
  right_value: Vec3
}

type VellumKey = {
  time: number
  value: Vec3
  interp: Interpolation
  /** added in v11: Molang per axis, null for a plain number */
  expr?: Array<string | null>
  handles?: WireHandles
}

type VellumTrack = {
  bone: string
  channel: Channel
  keys: VellumKey[]
}

/** A timed effect (v8). */
type VellumEvent = {
  time: number
  kind: EventKind
  effect: string
  /** a null object's `id` */
  locator?: string
}

type VellumClip = {
  id: string
  name: string
  /** `pingpong` is v8 */
  loop: Clip['loop']
  length: number
  snapping?: number
  tracks: VellumTrack[]
  /** Added in v8, sorted by time. Absent when the clip has none. */
  events?: VellumEvent[]
}

/** A null object (v8): a point on a bone, used for effects and as an IK target. */
type VellumNull = {
  id: string
  name: string
  /** a bone's `id`; absent at the model root */
  parent?: string
  position: Vec3
  /** the bone at the end of the chain that reaches for this point */
  ik_target?: string
  /** bones above `ik_target` that bend; 2 when absent */
  ik_chain?: number
  hidden?: boolean
  locked?: boolean
}

/** A mesh (v9): Blockbench's free-form element. Vertices are offsets from `origin`. */
type VellumMesh = {
  id: string
  name: string
  parent?: string
  origin: Vec3
  rotation?: Vec3
  /** vertex key to position, keys sorted */
  vertices: Record<string, Vec3>
  /** face key to its vertices (in order), per-vertex UV and texture id */
  faces: Record<string, { vertices: string[]; uv: Record<string, [number, number]>; texture?: string }>
  hidden?: boolean
  locked?: boolean
  /** added in v15: a texture mesh, whose faces are built from this texture */
  from_texture?: { texture: string; scale?: Vec3; local_pivot?: Vec3 }
}

export type VellumBehaviour = {
  requires?: Array<{ id?: string; at?: number[]; block?: string }>
  stages?: Array<{
    id?: string
    name?: string
    seconds?: number
    clip?: string | null
    effects?: Array<{ kind?: string; id?: string; amount?: number; at?: number[] }>
  }>
}

export type VellumDocument = {
  vellum: { format: string; version: number }
  name?: string
  /** `items`, `mobs` or `blocks`. It picks the validation rules. */
  kind?: string
  /** What it is for within its kind (v3). Absent means unset; it does not default to `misc`. */
  subtype?: string
  resolution?: { width: number; height: number }
  bones: VellumBone[]
  cubes: VellumCube[]
  textures: VellumTexture[]
  clips: VellumClip[]
  /** Added in v8. Absent when the model has none. */
  nulls?: VellumNull[]
  /** Added in v9. Absent when the model has none. */
  meshes?: VellumMesh[]
  /** Added in v4. Absent when the model has no requirements and no stages. */
  behaviour?: VellumBehaviour
  /** Added in v5. The body from `bodyOf`: nested by field path, set fields only. */
  config?: Record<string, unknown>
  /** Added in v12. Bedrock animation controllers; absent when the model has none. */
  controllers?: VellumController[]
  /** Added in v10. What a Blockbench project held that Vellum has no field for, kept for the trip back. */
  blockbench?: Record<string, unknown>
}

export type VellumController = {
  id: string
  name: string
  initial: string
  states: Array<{
    id: string
    name: string
    clips: Array<{ clip: string; weight?: string }>
    transitions: Array<{ to: string; when: string }>
    blend?: number
    on_entry?: string
    on_exit?: string
  }>
}

/* ---------------- errors ---------------- */

export class VellumFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VellumFormatError'
  }
}

/* ---------------- write ---------------- */

/** Drops keys whose value is undefined. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as T
}

export function toVellumDocument(model: Model): VellumDocument {
  const cubes: VellumCube[] = model.cubes.map((c) =>
    compact({
      id: c.id,
      name: c.name,
      from: c.from,
      to: c.to,
      origin: c.origin,
      rotation: c.rotation,
      inflate: c.inflate || undefined,
      box_uv: c.boxUv || undefined,
      /* Written whenever known, even with `box_uv` off: the editor's own
         box-unwrapped cubes have the flag off. */
      uv_offset: c.uvOffset,
      mirror_uv: c.mirrorUv || undefined,
      hidden: c.visible ? undefined : true,
      locked: c.locked || undefined,
      // sorted, so reordering FACES doesn't change the bytes written
      faces: Object.fromEntries(
        [...FACES].sort().map((key): [string, VellumFace] => [
          key,
          compact({
            uv: c.faces[key].uv,
            texture: c.faces[key].texture ?? undefined,
            rotation: c.faces[key].rotation || undefined,
          }),
        ]),
      ),
    }),
  )

  // the nested tree flattens to a bone list carrying parent ids
  const bones: VellumBone[] = []
  const walk = (list: Bone[], parent?: string) => {
    for (const b of list) {
      bones.push(
        compact({
          id: b.id,
          name: b.name,
          origin: b.origin,
          rotation: b.rotation,
          parent,
          cubes: b.children.filter((c) => c.kind === 'cube').map((c) => (c as { id: string }).id),
          mirror_uv: b.mirrorUv || undefined,
          hidden: b.visible ? undefined : true,
          locked: b.locked || undefined,
        }),
      )
      walk(
        b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone),
        b.id,
      )
    }
  }
  walk(model.bones)

  const textures: VellumTexture[] = model.textures.map((t) =>
    compact({
      id: t.id,
      name: t.name,
      width: t.width,
      height: t.height,
      uv_width: t.uvWidth,
      uv_height: t.uvHeight,
      source: t.source || undefined,
      layers: t.layers?.length
        ? t.layers.map((l) => compact({ id: l.id, name: l.name, source: l.source, hidden: l.visible ? undefined : true, opacity: l.opacity === 1 ? undefined : l.opacity }))
        : undefined,
      animation: t.animation
        ? compact({
            frame_time: t.animation.frameTime,
            mode: t.animation.mode && t.animation.mode !== 'loop' ? t.animation.mode : undefined,
            order: t.animation.order?.length ? t.animation.order : undefined,
            interpolate: t.animation.interpolate ? (true as const) : undefined,
          })
        : undefined,
    }),
  )

  // a track is one bone and one channel, as the timeline stacks its rows
  const clips: VellumClip[] = model.clips.map((clip) =>
    compact({
      id: clip.id,
      name: clip.name,
      loop: clip.loop,
      length: clip.length,
      snapping: clip.snapping || undefined,
      tracks: clip.tracks
        .filter((t) => t.keys.length)
        .map((t) => ({
          bone: t.bone,
          channel: t.channel,
          keys: [...t.keys]
            .sort((a, b) => a.time - b.time)
            .map((k) => ({
              time: k.time,
              value: k.value,
              interp: k.interp,
              expr: k.expr?.some((e) => e) ? [0, 1, 2].map((i) => k.expr?.[i] || null) : undefined,
              // after `interp`, which decides whether the handles apply
              handles: k.handles && {
                left_time: k.handles.leftTime,
                left_value: k.handles.leftValue,
                right_time: k.handles.rightTime,
                right_value: k.handles.rightValue,
              },
            })),
        })),
      events: clip.events?.length
        ? [...clip.events]
            .sort((a, b) => a.time - b.time)
            .map((e) => compact({ time: e.time, kind: e.kind, effect: e.effect, locator: e.locator }))
        : undefined,
    }),
  )

  const nulls: VellumNull[] | undefined = model.nulls?.length
    ? model.nulls.map((n) =>
        compact({
          id: n.id,
          name: n.name,
          parent: n.parent ?? undefined,
          position: n.position,
          ik_target: n.ikTarget,
          ik_chain: n.ikTarget ? n.ikChain : undefined,
          hidden: n.visible ? undefined : true,
          locked: n.locked || undefined,
        }),
      )
    : undefined

  // keys are sorted so the same mesh always writes the same bytes
  const sortKeys = <T,>(rec: Record<string, T>, map: (v: T) => unknown) =>
    Object.fromEntries(Object.keys(rec).sort().map((k) => [k, map(rec[k])]))
  const meshes: VellumMesh[] | undefined = model.meshes?.length
    ? model.meshes.map((m) =>
        compact({
          id: m.id,
          name: m.name,
          parent: m.parent ?? undefined,
          origin: m.origin,
          rotation: m.rotation.some((v) => v !== 0) ? m.rotation : undefined,
          vertices: sortKeys(m.vertices, (v) => v) as Record<string, Vec3>,
          faces: sortKeys(m.faces, (f: MeshFace) =>
            compact({ vertices: f.vertices, uv: sortKeys(f.uv, (v) => v), texture: f.texture ?? undefined }),
          ) as VellumMesh['faces'],
          hidden: m.visible ? undefined : true,
          locked: m.locked || undefined,
          from_texture: m.fromTexture
            ? compact({
                texture: m.fromTexture.texture,
                scale: m.fromTexture.scale.every((v) => v === 1) ? undefined : m.fromTexture.scale,
                local_pivot: m.fromTexture.localPivot.every((v) => v === 0) ? undefined : m.fromTexture.localPivot,
              })
            : undefined,
        }),
      )
    : undefined

  const b = model.behaviour
  const behaviour: VellumBehaviour | undefined =
    b && (b.requires.length || b.stages.length)
      ? {
          requires: b.requires.length
            ? b.requires.map((r) => ({ id: r.id, at: r.at, block: r.block }))
            : undefined,
          stages: b.stages.length
            ? b.stages.map((st) =>
                compact({
                  id: st.id,
                  name: st.name,
                  seconds: st.seconds,
                  clip: st.clip ?? undefined,
                  effects: st.effects.length
                    ? st.effects.map((e) =>
                        compact({ kind: e.kind, id: e.id, amount: e.amount, at: e.at }),
                      )
                    : undefined,
                }),
              )
            : undefined,
        }
      : undefined

  /* Only set fields, from `bodyOf`, which is also the body toYaml writes,
     so the file and the YAML preview agree. */
  const body = model.kind && hasConfig(model.kind) && model.config
    ? bodyOf(model.kind, model.config)
    : undefined
  const config = body && Object.keys(body).length ? (body as Record<string, unknown>) : undefined

  // insertion order here is the written key order
  return compact({
    vellum: { format: FORMAT, version: CURRENT_VERSION },
    name: model.name || undefined,
    kind: model.kind,
    subtype: model.subtype,
    resolution: model.resolution,
    bones,
    cubes,
    textures,
    clips,
    nulls,
    meshes,
    behaviour,
    config,
    controllers: writeControllers(model),
    blockbench: blockbenchOf(model),
  })
}

function writeControllers(model: Model): VellumController[] | undefined {
  if (!model.controllers?.length) return undefined
  return model.controllers.map((c) => ({
    id: c.id,
    name: c.name,
    initial: c.initial,
    states: c.states.map((st) =>
      compact({
        id: st.id,
        name: st.name,
        clips: st.clips.map((x) => compact({ clip: x.clip, weight: x.weight?.trim() ? x.weight : undefined })),
        transitions: st.transitions.map((t) => ({ to: t.to, when: t.when })),
        blend: st.blend || undefined,
        on_entry: st.onEntry?.trim() ? st.onEntry : undefined,
        on_exit: st.onExit?.trim() ? st.onExit : undefined,
      }),
    ),
  }))
}

/** Controllers off disk; a state, clip or transition missing what it needs is dropped. */
/** A texture's animation off disk; a frame time that isn't a positive number makes it 1. */
function readTextureAnimation(raw: unknown): { animation?: TextureAnimation } {
  if (!raw || typeof raw !== 'object') return {}
  const a = raw as Record<string, unknown>
  const ft = typeof a.frame_time === 'number' && a.frame_time > 0 ? a.frame_time : 1
  const mode = a.mode === 'backwards' || a.mode === 'back_and_forth' ? a.mode : undefined
  const order = Array.isArray(a.order) ? a.order.filter((i): i is number => Number.isInteger(i) && i >= 0) : []
  return { animation: { frameTime: ft, ...(mode ? { mode } : {}), ...(order.length ? { order } : {}), ...(a.interpolate === true ? { interpolate: true } : {}) } }
}

function readControllers(raw: unknown): Controller[] | undefined {
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  const list = objects(raw as VellumController[] | undefined)
    .filter((c) => typeof c.id === 'string')
    .map((c): Controller => {
      const states = objects(c.states)
        .filter((st) => typeof st.id === 'string')
        .map((st) => ({
          id: st.id,
          name: text(st.name) || 'state',
          clips: objects(st.clips)
            .filter((x) => typeof x.clip === 'string')
            .map((x) => ({ clip: x.clip, ...(text(x.weight) ? { weight: text(x.weight) } : {}) })),
          transitions: objects(st.transitions)
            .filter((t) => typeof t.to === 'string')
            .map((t) => ({ to: t.to, when: text(t.when) })),
          ...(typeof st.blend === 'number' && st.blend > 0 ? { blend: st.blend } : {}),
          ...(text(st.on_entry) ? { onEntry: text(st.on_entry) } : {}),
          ...(text(st.on_exit) ? { onExit: text(st.on_exit) } : {}),
        }))
      const initial = states.some((st) => st.id === c.initial) ? c.initial : (states[0]?.id ?? '')
      return { id: c.id, name: text(c.name) || 'controller', initial, states }
    })
  return list.length ? list : undefined
}

/** The Blockbench extras whose element, group, texture or clip is in the model; absent when none are. */
function blockbenchOf(model: Model): Record<string, unknown> | undefined {
  const bag = model.blockbench
  if (!bag || typeof bag !== 'object') return undefined
  const ids = {
    elements: new Set([...model.cubes.map((c) => c.id), ...(model.meshes ?? []).map((m) => m.id), ...(model.nulls ?? []).map((n) => n.id)]),
    groups: new Set<string>(),
    textures: new Set(model.textures.map((t) => t.id)),
    animations: new Set(model.clips.map((c) => c.id)),
    keys: new Set(model.clips.flatMap((c) => c.tracks.flatMap((t) => t.keys.map((k) => keyAddress(c.id, t.bone, t.channel, k.time))))),
  }
  const walk = (list: Bone[]) =>
    list.forEach((b) => {
      ids.groups.add(b.id)
      walk(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))
    })
  walk(model.bones)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(bag)) {
    const keep = ids[key as keyof typeof ids]
    if (keep && value && typeof value === 'object') {
      const kept = Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([id]) => keep.has(id)))
      if (Object.keys(kept).length) out[key] = kept
    } else if (value !== undefined) out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * What only Vellum says about a model (its kind, subtype, behaviour and
 * config), in the shape a .vellum writes it. A .bbmodel export carries it
 * under a `vellum` key so the model comes back whole.
 */
export function vellumOnlyOf(model: Model): Pick<VellumDocument, 'kind' | 'subtype' | 'behaviour' | 'config' | 'controllers'> {
  const doc = toVellumDocument(model)
  return compact({ kind: doc.kind, subtype: doc.subtype, behaviour: doc.behaviour, config: doc.config, controllers: doc.controllers })
}

/** Reads what `vellumOnlyOf` wrote. */
export function readVellumOnly(raw: unknown): Pick<Model, 'kind' | 'subtype' | 'behaviour' | 'config' | 'controllers'> {
  const doc = (raw && typeof raw === 'object' ? raw : {}) as VellumDocument
  const kind = (['items', 'mobs', 'blocks'] as const).find((k) => k === doc.kind)
  return compact({
    kind,
    subtype: subtypeFits(kind, doc.subtype) ? (doc.subtype as Subtype) : undefined,
    behaviour: readBehaviour(doc.behaviour),
    config: readConfig(doc.config, kind),
    controllers: readControllers(doc.controllers),
  })
}

/** Serialise to the on-disk bytes. Compact, so the header prefix is exact. */
export function writeVellum(model: Model): string {
  return JSON.stringify(toVellumDocument(model))
}

/* ---------------- read ---------------- */

const EFFECTS: EffectKind[] = ['particles', 'sound', 'shake']

/** The objects in a list off disk. Anything else, the list included, reads as empty. */
function objects<T>(v: T[] | undefined): T[] {
  return Array.isArray(v) ? v.filter((x) => !!x && typeof x === 'object' && !Array.isArray(x)) : []
}

/**
 * A behaviour off disk. Malformed fields get defaults so the model still
 * opens: an offset that isn't three numbers becomes the block below, and a
 * list that isn't a list reads as empty.
 */
function readBehaviour(raw: VellumBehaviour | undefined): Behaviour | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const requires: BehaviourRequirement[] = objects(raw.requires).map((r, i) => ({
    id: typeof r.id === 'string' && r.id ? r.id : `br${i}`,
    at: vec3(r.at, [0, -1, 0]),
    block: typeof r.block === 'string' ? r.block : '',
  }))
  const stages: BehaviourStage[] = objects(raw.stages).map((st, i) => ({
    id: typeof st.id === 'string' && st.id ? st.id : `bs${i}`,
    name: typeof st.name === 'string' && st.name ? st.name : `stage ${i + 1}`,
    seconds: typeof st.seconds === 'number' && Number.isFinite(st.seconds) ? st.seconds : 1,
    clip: typeof st.clip === 'string' && st.clip ? st.clip : null,
    effects: objects(st.effects)
      .filter((e): e is { kind: string } & BehaviourEffect => EFFECTS.includes(e.kind as EffectKind))
      .map((e) => ({
        kind: e.kind as EffectKind,
        id: typeof e.id === 'string' && e.id ? e.id : undefined,
        amount: typeof e.amount === 'number' && Number.isFinite(e.amount) ? e.amount : 1,
        at: Array.isArray(e.at) ? vec3(e.at, [0, 0, 0]) : undefined,
      })),
  }))
  if (!requires.length && !stages.length) return undefined
  return { requires, stages }
}

/** The config block off disk, nested by field path. Values no field could hold are dropped. */
function readConfig(raw: Record<string, unknown> | undefined, kind?: ProjectKind): Config | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const value = (v: unknown): ConfigValue | Config | undefined => {
    if (typeof v === 'string' || typeof v === 'boolean') return v
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (Array.isArray(v)) {
      if (v.every((x) => typeof x === 'string')) return v as string[]
      if (v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
        return v.map((x) => {
          const row: Row = {}
          for (const [k, c] of Object.entries(x as Record<string, unknown>)) {
            if (typeof c === 'string') row[k] = c
            else if (typeof c === 'number' && Number.isFinite(c)) row[k] = String(c)
          }
          return row
        }) as ConfigValue
      }
      return undefined
    }
    if (v && typeof v === 'object') {
      const branch = readConfig(v as Record<string, unknown>)
      return branch && Object.keys(branch).length ? branch : undefined
    }
    return undefined
  }

  const out: Config = {}
  for (const [key, v] of Object.entries(raw)) {
    const read = value(v)
    if (read !== undefined) out[key] = read
  }

  /* Unknown keys are kept, since a newer schema may know them. An object
     where the schema declares a scalar field is dropped. */
  if (kind && hasConfig(kind)) {
    for (const f of fieldsOf(kind)) {
      if (f.kind === 'rows' || f.kind === 'list') continue
      const parts = f.path.split('.')
      let at: Config | undefined = out
      for (let i = 0; i < parts.length - 1 && at; i++) {
        const next: unknown = at[parts[i]]
        at = next && typeof next === 'object' && !Array.isArray(next) ? (next as Config) : undefined
      }
      const leaf = at?.[parts[parts.length - 1]]
      if (leaf && typeof leaf === 'object' && !Array.isArray(leaf)) delete at![parts[parts.length - 1]]
    }
  }

  const prune = (c: Config): Config => {
    for (const [k, v] of Object.entries(c)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        prune(v as Config)
        if (!Object.keys(v as Config).length) delete c[k]
      }
    }
    return c
  }
  prune(out)
  return Object.keys(out).length ? out : undefined
}

function upgrade(doc: VellumDocument): VellumDocument {
  let version = doc.vellum.version
  while (version < CURRENT_VERSION) {
    switch (version) {
      case 0: // pre-release shape; nothing to change
        version = 1
        break
      case 1: // v2's added fields are optional, and absent is already correct
        version = 2
        break
      case 2: // v3 turned the `consumables` kind into `items` with subtype `consumable`
        if (doc.kind === 'consumables') doc = { ...doc, kind: 'items', subtype: 'consumable' }
        version = 3
        break
      case 3: // v4 added `behaviour`, and absent is already correct
        version = 4
        break
      case 4: // v5 added `config`, likewise
        version = 5
        break
      case 5: // v6 added `uv_offset` and `mirror_uv`, and absent is already correct
        version = 6
        break
      case 6: {
        /* v7 added optional keyframe `handles`, and re-keyed `config` from
           form field names to field paths (`speed` became `movement-speed`,
           a top-level `idle` became `animations.idle`). */
        const raw = doc.config
        if (raw && typeof raw === 'object' && doc.kind && looksLegacy(doc.kind as ProjectKind, raw as Record<string, unknown>)) {
          doc = { ...doc, config: canonicalise(doc.kind as ProjectKind, raw as Record<string, unknown>) as Record<string, unknown> }
        }
        version = 7
        break
      }
      case 7: // v8 added null objects, clip events and `pingpong`; absent is already correct
        version = 8
        break
      case 8: // v9 added meshes; absent is already correct
        version = 9
        break
      case 9: // v10 added the Blockbench extras; absent is already correct
        version = 10
        break
      case 10: // v11 added Molang on keys, as `expr`; absent is already correct
        version = 11
        break
      case 11: // v12 added animation controllers; absent is already correct
        version = 12
        break
      case 12: // v13 added texture layers; absent is already correct
        version = 13
        break
      case 13: // v14 added texture animation; absent is already correct
        version = 14
        break
      case 14: // v15 added texture meshes; absent is already correct
        version = 15
        break
      default:
        throw new VellumFormatError(`No upgrade path from .vellum version ${version}.`)
    }
  }
  return { ...doc, vellum: { format: doc.vellum.format, version } }
}

/** A key's Molang, three strings or nulls; absent when none is a string. */
function readExpr(raw: unknown): Array<string | null> | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = [0, 1, 2].map((i) => (typeof raw[i] === 'string' && raw[i].trim() ? (raw[i] as string) : null))
  return out.some((e) => e) ? out : undefined
}

function readHandles(raw: unknown): Handles | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const trio = ['left_time', 'left_value', 'right_time', 'right_value'] as const
  const got = trio.map((k) => {
    const v = r[k]
    return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? ([v[0], v[1], v[2]] as Vec3)
      : undefined
  })
  if (got.some((v) => v === undefined)) return undefined
  return { leftTime: got[0]!, leftValue: got[1]!, rightTime: got[2]!, rightValue: got[3]! }
}

let keyCounter = 0
const keyId = () => `k${(keyCounter += 1).toString(36)}`

const vec2 = (v: unknown): [number, number] | undefined =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? [v[0], v[1]]
    : undefined

/** A missing or malformed vector gets the fallback, so later code never gets undefined. */
const vec3 = (v: unknown, fallback: Vec3): Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? [v[0], v[1], v[2]]
    : fallback

export function fromVellumDocument(doc: VellumDocument): Model {
  const resolution = doc.resolution ?? { width: 16, height: 16 }

  const textures: Texture[] = (doc.textures ?? []).map((t, i) => ({
    id: t.id ?? String(i),
    name: t.name,
    width: t.width,
    height: t.height,
    uvWidth: t.uv_width ?? resolution.width,
    uvHeight: t.uv_height ?? resolution.height,
    source: t.source ?? '',
    ...(() => {
      const layers = objects(t.layers as Array<Record<string, unknown>> | undefined)
        .filter((l) => typeof l.id === 'string' && typeof l.source === 'string')
        .map((l) => ({
          id: l.id as string,
          name: typeof l.name === 'string' ? l.name : 'Layer',
          source: l.source as string,
          visible: !l.hidden,
          opacity: typeof l.opacity === 'number' && Number.isFinite(l.opacity) ? Math.max(0, Math.min(1, l.opacity)) : 1,
        }))
      return layers.length ? { layers } : {}
    })(),
    ...readTextureAnimation(t.animation),
  }))

  const cubes: Cube[] = (doc.cubes ?? []).map((c) => {
    const faces = {} as Record<FaceKey, Face>
    for (const key of FACES) {
      const f = c.faces?.[key]
      /* A texture id this file doesn't carry is kept, so the validator can
         report it and the next save doesn't erase it. */
      faces[key] = {
        uv: (f?.uv ?? [0, 0, 0, 0]) as UVRect,
        texture: f?.texture ?? null,
        rotation: (f?.rotation ?? 0) as 0 | 90 | 180 | 270,
      }
    }
    return {
      id: c.id,
      name: c.name,
      from: vec3(c.from, [0, 0, 0]),
      to: vec3(c.to, vec3(c.from, [0, 0, 0])),
      origin: vec3(c.origin, [0, 0, 0]),
      rotation: vec3(c.rotation, [0, 0, 0]),
      faces,
      inflate: c.inflate ?? 0,
      boxUv: c.box_uv ?? false,
      /* Left unset when absent. A pre-v6 box-UV cube has no recorded
         origin, and [0,0] would claim one. */
      uvOffset: vec2(c.uv_offset),
      mirrorUv: c.mirror_uv || undefined,
      visible: !c.hidden,
      locked: Boolean(c.locked),
    }
  })

  // rebuild the nested tree from the parent pointers
  const list = doc.bones ?? []
  const byId = new Map<string, Bone>()
  for (const b of list) {
    byId.set(b.id, {
      id: b.id,
      name: b.name,
      origin: vec3(b.origin, [0, 0, 0]),
      rotation: vec3(b.rotation, [0, 0, 0]),
      visible: !b.hidden,
      locked: Boolean(b.locked),
      mirrorUv: b.mirror_uv || undefined,
      children: (b.cubes ?? []).map((id) => ({ kind: 'cube' as const, id })),
    })
  }

  const bones: Bone[] = []
  for (const b of list) {
    const self = byId.get(b.id)!
    const parent = b.parent ? byId.get(b.parent) : undefined
    // a bone whose parent is missing becomes a root
    if (parent) parent.children.push({ kind: 'bone', bone: self })
    else bones.push(self)
  }

  const LOOPS = ['loop', 'once', 'hold', 'pingpong']
  const KINDS: EventKind[] = ['sound', 'particle', 'script']
  let eventCounter = 0
  const clips: Clip[] = (doc.clips ?? []).map((clip) => ({
    id: clip.id,
    name: clip.name,
    loop: LOOPS.includes(clip.loop) ? clip.loop : 'loop',
    events: (() => {
      // an event of a kind this reader doesn't know, or with no effect, is dropped
      const list: ClipEvent[] = objects(clip.events)
        .filter((e) => KINDS.includes(e.kind) && typeof e.effect === 'string')
        .map((e) => ({
          id: `e${(eventCounter += 1).toString(36)}`,
          time: Number.isFinite(e.time) ? e.time : 0,
          kind: e.kind,
          effect: e.effect,
          locator: typeof e.locator === 'string' ? e.locator : undefined,
        }))
      return list.length ? list : undefined
    })(),
    length: clip.length,
    snapping: clip.snapping ?? 24,
    tracks: (clip.tracks ?? []).map((t) => ({
      bone: t.bone,
      channel: t.channel,
      keys: (t.keys ?? []).map((k) => ({
        id: keyId(),
        time: Number.isFinite(k?.time) ? k.time : 0,
        value: vec3(k?.value, t.channel === 'scale' ? [1, 1, 1] : [0, 0, 0]),
        interp: k?.interp ?? 'linear',
        handles: readHandles((k as { handles?: unknown } | undefined)?.handles),
        expr: readExpr((k as { expr?: unknown } | undefined)?.expr),
      })),
    })),
  }))

  const kind: ProjectKind | undefined =
    doc.kind === 'items' || doc.kind === 'mobs' || doc.kind === 'blocks' ? doc.kind : undefined

  const nulls: NullObject[] = objects(doc.nulls)
    .filter((n) => typeof n.id === 'string')
    .map((n) => ({
      id: n.id,
      name: typeof n.name === 'string' ? n.name : 'null',
      // a parent this file doesn't carry is kept, so the validator can report it
      parent: typeof n.parent === 'string' ? n.parent : null,
      position: vec3(n.position, [0, 0, 0]),
      ikTarget: typeof n.ik_target === 'string' ? n.ik_target : undefined,
      ikChain: typeof n.ik_target === 'string' && Number.isFinite(n.ik_chain) ? n.ik_chain : undefined,
      visible: !n.hidden,
      locked: Boolean(n.locked),
    }))

  const uv2 = (v: unknown): [number, number] =>
    Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) ? [v[0], v[1]] : [0, 0]
  const meshes: Mesh[] = objects(doc.meshes)
    .filter((m) => typeof m.id === 'string')
    .map((m) => {
      const vertices: Record<string, Vec3> = {}
      for (const [k, v] of Object.entries((m.vertices ?? {}) as Record<string, unknown>)) vertices[k] = vec3(v, [0, 0, 0])
      const faces: Record<string, MeshFace> = {}
      for (const [k, raw] of Object.entries((m.faces ?? {}) as Record<string, unknown>)) {
        const f = (raw ?? {}) as { vertices?: unknown; uv?: unknown; texture?: unknown }
        // a face keeps only vertices the mesh has, and needs three of them
        const vs = Array.isArray(f.vertices) ? f.vertices.filter((x): x is string => typeof x === 'string' && x in vertices) : []
        if (vs.length < 3) continue
        const uvRaw = (f.uv ?? {}) as Record<string, unknown>
        faces[k] = {
          vertices: vs,
          uv: Object.fromEntries(vs.map((v) => [v, uv2(uvRaw[v])])),
          texture: typeof f.texture === 'string' ? f.texture : null,
        }
      }
      return {
        id: m.id,
        name: typeof m.name === 'string' ? m.name : 'mesh',
        parent: typeof m.parent === 'string' ? m.parent : null,
        origin: vec3(m.origin, [0, 0, 0]),
        rotation: vec3(m.rotation, [0, 0, 0]),
        vertices,
        faces,
        visible: !m.hidden,
        locked: Boolean(m.locked),
        ...(() => {
          const ft = m.from_texture as { texture?: unknown; scale?: unknown; local_pivot?: unknown } | undefined
          return ft && typeof ft.texture === 'string'
            ? { fromTexture: { texture: ft.texture, scale: vec3(ft.scale, [1, 1, 1]), localPivot: vec3(ft.local_pivot, [0, 0, 0]) } }
            : {}
        })(),
      }
    })

  const subtype: Subtype | undefined = subtypeFits(kind, doc.subtype) ? doc.subtype : undefined

  return {
    name: doc.name ?? 'model',
    kind,
    subtype,
    behaviour: readBehaviour(doc.behaviour),
    config: readConfig(doc.config, kind),
    resolution,
    bones,
    cubes,
    textures,
    clips,
    nulls: nulls.length ? nulls : undefined,
    meshes: meshes.length ? meshes : undefined,
    controllers: readControllers(doc.controllers),
    blockbench: doc.blockbench && typeof doc.blockbench === 'object' && !Array.isArray(doc.blockbench) ? doc.blockbench : undefined,
  }
}

/** Checks the header first, and throws VellumFormatError for bad JSON, a foreign file or a newer version. */
export function readVellum(raw: string | object): Model {
  let parsed: unknown
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      throw new VellumFormatError(`This is not valid JSON, so it is not a .vellum: ${(e as Error).message}`)
    }
  } else {
    parsed = raw
  }

  const doc = parsed as VellumDocument
  const header = doc?.vellum

  if (!header || typeof header !== 'object') {
    throw new VellumFormatError(
      'This file has no "vellum" header, so it was not written by Vellum and cannot be opened here.',
    )
  }
  if (header.format !== FORMAT) {
    throw new VellumFormatError(
      `This is a Vellum "${header.format}" document. This editor opens "${FORMAT}" documents.`,
    )
  }
  if (typeof header.version !== 'number') {
    throw new VellumFormatError('The "vellum" header carries no version number.')
  }
  if (header.version > CURRENT_VERSION) {
    throw new VellumFormatError(
      `This model was saved by a newer Vellum (version ${header.version}). ` +
        `This editor reads up to version ${CURRENT_VERSION}, so it can’t open it.`,
    )
  }

  return fromVellumDocument(upgrade(doc))
}

/** True when the bytes look like a `.vellum`. */
export function isVellum(raw: string) {
  return raw.trimStart().startsWith('{"vellum"')
}

/** The save name: a `.json` or `.vellum` extension becomes `.vellum`, and any other name gets it appended. */
export function vellumFileName(name: string) {
  return `${name.replace(/\.(vellum|json|bbmodel)$/i, '')}${EXTENSION}`
}
