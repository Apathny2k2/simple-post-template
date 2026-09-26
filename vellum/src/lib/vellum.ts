/* ---------------------------------------------------------------
   `.vellum` - the native model format.

   Not a zip and not a custom binary, but a compact, key-ordered UTF-8
   JSON document with a Vellum-owned schema. The extension is ours; the
   encoding is JSON so `git diff` on a model keeps working.

   The in-memory model in `./model` mirrors this document one-for-one,
   so this file is close to a pass-through. The one shape that differs
   is the bone tree: on disk each bone names its `parent`, in memory the
   tree is nested. Flatten on write, rebuild on read.

   Four properties are load-bearing and are asserted by the round-trip
   test rather than left to good intentions:

   1. **No magic number.** Identity is the first JSON key, so a
      well-formed file begins byte-for-byte with HEADER_PREFIX.
   2. **Key order is structural, not accidental.** Keys are written in a
      fixed order and faces are sorted, so a model whose faces reshuffle
      does not turn every diff into noise.
   3. **Absent, never null.** Optional keys are omitted rather than
      written as JSON null.
   4. **Upgrading is the reader's job**, in memory, on every read. The
      writer always stamps CURRENT_VERSION - never the version it was
      handed.

   Deliberately NOT in the file: no rig (regenerated on save), no pack
   models or textures, no display transforms, and no editor state.
   --------------------------------------------------------------- */

import { FACES, subtypeFits } from './model'
import type { Behaviour, BehaviourEffect, BehaviourRequirement, BehaviourStage, EffectKind } from './behaviour'
import { bodyOf, canonicalise, fieldsOf, hasConfig, looksLegacy } from './config'
import type { ConfigValue, Config, Row } from './config'
import type {
  Bone,
  Channel,
  Clip,
  Cube,
  Face,
  FaceKey,
  Handles,
  Interpolation,
  Model,
  ProjectKind,
  Subtype,
  Texture,
  UVRect,
  Vec3,
} from './model'

export const FORMAT = 'model'
export const CURRENT_VERSION = 7

/** A well-formed `.vellum` begins with exactly these bytes. */
export const HEADER_PREFIX = `{"vellum":{"format":"${FORMAT}","version":${CURRENT_VERSION}},`

export const EXTENSION = '.vellum'

/* ---------------- the document shape ---------------- */

type VellumFace = {
  uv: UVRect
  /** a texture id, not an index into an array */
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
   * The origin a box unwrap was generated from, and whether it is
   * mirrored. Version 6 added both. The six face rects are written in
   * full regardless, so these are what a reader needs only if it
   * regenerates the unwrap rather than trusting the rects - which the
   * plugin does, and which is why a box-UV model used to come back with
   * nothing to regenerate from.
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
  /** said once, as a parent id - rather than a tree duplicated beside a flat list */
  parent?: string
  cubes: string[]
  /** mirrors every cube under it, rather than each one saying so */
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
}

/**
 * The four arrays a bezier keyframe needs, and it is ALL FOUR OR NONE.
 *
 * Three of four describes half a curve, which is worse than no curve at
 * all because it would be drawn as though somebody meant it. A partial
 * block is dropped whole rather than half-read.
 */
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
  /** written AFTER `interp`, because the handles mean nothing without it */
  handles?: WireHandles
}

type VellumTrack = {
  bone: string
  channel: Channel
  keys: VellumKey[]
}

type VellumClip = {
  id: string
  name: string
  loop: Clip['loop']
  length: number
  snapping?: number
  tracks: VellumTrack[]
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
  /**
   * What the model is for. Block models are validated against rules the
   * others are not, so a document that does not say leaves the editor
   * guessing - and it used to guess from whichever page you happened to
   * open first, which meant a block model opened after a mob was not
   * checked at all.
   */
  kind?: string
  /**
   * What it is for, within its kind. Optional, and absent means nobody
   * said - never "misc". Version 3 added it; a version 2 document that
   * called itself a `consumables` kind becomes an item that says
   * `consumable` here, which is the same claim in the shape that can
   * also describe a weapon.
   */
  subtype?: string
  resolution?: { width: number; height: number }
  bones: VellumBone[]
  cubes: VellumCube[]
  textures: VellumTexture[]
  clips: VellumClip[]
  /**
   * What makes it act on its own. Version 4 added it, and it is absent
   * on anything that does not - which is most models, so writing an
   * empty behaviour onto every file would be noise in every diff.
   */
  behaviour?: VellumBehaviour
  /**
   * The config, as a flat map of the schema's own keys.
   * Version 5 added it. Deliberately not the YAML: the YAML is derived,
   * and storing a derived form is storing something that can disagree
   * with what it was derived from.
   */
  config?: Record<string, unknown>
}

/* ---------------- errors ---------------- */

export class VellumFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VellumFormatError'
  }
}

/* ---------------- write ---------------- */

/** Drop keys whose value is undefined, so optional means absent, not null. */
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
      /* Written whenever it is known, not only when `box_uv` is set.
         Gating it on the flag would drop the offset on exactly the
         cube this field exists to preserve: one that arrived from a
         reader that had it, on a model the editor then marked hand-UV. */
      uv_offset: c.uvOffset,
      mirror_uv: c.mirrorUv || undefined,
      hidden: c.visible ? undefined : true,
      locked: c.locked || undefined,
      // faces are emitted in sorted order so a reshuffle cannot churn the diff
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
    }),
  )

  /* One track per bone-channel pair, which is also how the timeline
     stacks its rows - an animator carrying mixed-channel keyframes makes
     you re-filter by channel at every read. */
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
              /* After `interp`, because handles mean nothing without it.
                 Wire is snake_case; the runtime is camelCase. */
              handles: k.handles && {
                left_time: k.handles.leftTime,
                left_value: k.handles.leftValue,
                right_time: k.handles.rightTime,
                right_value: k.handles.rightValue,
              },
            })),
        })),
    }),
  )

  /* Absent, never empty: a model with no behaviour writes no behaviour
     key at all, rather than an object with two empty lists in it. */
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

  /* Only what was set - and this used to be a comment describing
     something the code did not do. The whole form state went in,
     defaults and all, so a model edited in the app carried forty keys
     meaning nothing while one built by the sample script carried four.

     `bodyOf` is the same function the YAML is written through, so the
     block in the file and the block in the preview cannot disagree. */
  const body = model.kind && hasConfig(model.kind) && model.config
    ? bodyOf(model.kind, model.config)
    : undefined
  const config = body && Object.keys(body).length ? (body as Record<string, unknown>) : undefined

  // insertion order here IS the written key order
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
    behaviour,
    config,
  })
}

/** Serialise to the on-disk bytes. Compact, so the header prefix is exact. */
export function writeVellum(model: Model): string {
  return JSON.stringify(toVellumDocument(model))
}

/* ---------------- read ---------------- */

/**
 * Upgrade in memory, on every read. Each step is a re-stamp today - they
 * exist so that the ladder exists, and so a real migration has somewhere
 * to go.
 */
const EFFECTS: EffectKind[] = ['particles', 'sound', 'shake']

/**
 * A behaviour off disk, with every field forced into the shape the rest
 * of the app can rely on. Nothing here rejects a document: an offset
 * that is not three numbers becomes the block below, and validation
 * says so afterwards where a person can read it - a throw at this depth
 * would only ever show up as "could not open".
 */
function readBehaviour(raw: VellumBehaviour | undefined): Behaviour | undefined {
  if (!raw) return undefined
  const requires: BehaviourRequirement[] = (raw.requires ?? []).map((r, i) => ({
    id: typeof r.id === 'string' && r.id ? r.id : `br${i}`,
    at: vec3(r.at, [0, -1, 0]),
    block: typeof r.block === 'string' ? r.block : '',
  }))
  const stages: BehaviourStage[] = (raw.stages ?? []).map((st, i) => ({
    id: typeof st.id === 'string' && st.id ? st.id : `bs${i}`,
    name: typeof st.name === 'string' && st.name ? st.name : `stage ${i + 1}`,
    seconds: typeof st.seconds === 'number' && Number.isFinite(st.seconds) ? st.seconds : 1,
    clip: typeof st.clip === 'string' && st.clip ? st.clip : null,
    effects: (st.effects ?? [])
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

/**
 * A config off disk, with every value forced into one of the shapes a
 * field can hold. Anything else is dropped rather than carried: a
 * number where the form wants a list is a value nothing could render.
 */
/**
 * The config block off disk.
 *
 * It nests now, because it is the entity body in the runtime's own
 * vocabulary rather than a flat bag of form keys - `animations.idle`
 * really is an `animations` branch with an `idle` in it. Anything whose
 * type is not one the block can hold is dropped rather than guessed.
 */
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

  /* An unknown key is KEPT: the block is a body, and a body may
     legitimately carry something this build's schema has not learned
     about yet - dropping it would silently lose a user's config.
     What is not kept is a BRANCH where the schema declares a leaf.
     `health: {nonsense: true}` is not a forward-compatible key, it is a
     scalar field holding an object, and nothing can ever mean that. */
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
      case 2:
        /* v3 split "what it is" from "what it is for". `consumables` was
           a kind, which put it beside `items` as though holding a potion
           were a different act from holding a sword. It is an item with
           a subtype, and that is the same claim in a shape that can also
           describe a weapon or a tool. */
        if (doc.kind === 'consumables') doc = { ...doc, kind: 'items', subtype: 'consumable' }
        version = 3
        break
      case 3: // v4 added `behaviour`, and absent is already correct
        version = 4
        break
      case 4: // v5 added `config`, likewise
        version = 5
        break
      case 5:
        /* v6 added `uv_offset` and `mirror_uv`. Absent is correct for
           anything written before: a document that never said is a
           document with no mirror and an unwrap nobody recorded the
           origin of, which is exactly the state v5 left them in. */
        version = 6
        break
      case 6: {
        /* v7 does two things.

           One is a stamp: a keyframe may carry bezier `handles`, and a
           document written before simply has none.

           The other is NOT a stamp. The `config` block used to be keyed
           by the FORM's field names - `speed`, and `idle`/`walk` at the
           top level - where the runtime reads `movement-speed` and
           nests the two under `animations:`. That is not a cosmetic
           difference: `speed` is not an unknown key that fails quietly,
           it is an error, and one error holds back the content swap for
           every kind on that server. So an old block is read into the
           runtime's vocabulary here, once, rather than translated on
           every write. */
        const raw = doc.config
        if (raw && typeof raw === 'object' && doc.kind && looksLegacy(doc.kind as ProjectKind, raw as Record<string, unknown>)) {
          doc = { ...doc, config: canonicalise(doc.kind as ProjectKind, raw as Record<string, unknown>) as Record<string, unknown> }
        }
        version = 7
        break
      }
      default:
        throw new VellumFormatError(`No upgrade path from .vellum version ${version}.`)
    }
  }
  return { ...doc, vellum: { format: doc.vellum.format, version } }
}

/**
 * The four handle arrays, or nothing.
 *
 * ALL FOUR OR NONE, and a partial block is dropped whole rather than
 * half-read: three of four describes half a curve, which is worse than
 * no curve because it would be drawn as though somebody meant it.
 */
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

/**
 * A vector, or the fallback. `from`, `to` and a key's `value` used to be
 * copied straight through while their neighbours were defaulted, so a
 * file missing one of them - still valid JSON, still a Vellum document -
 * reached the validator as `undefined` and took the whole editor down
 * with it. Nothing that comes off disk is trusted to have a shape.
 */
/** The two-component sibling of `vec3`, and absent where it was absent. */
const vec2 = (v: unknown): [number, number] | undefined =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? [v[0], v[1]]
    : undefined

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
  }))

  const cubes: Cube[] = (doc.cubes ?? []).map((c) => {
    const faces = {} as Record<FaceKey, Face>
    for (const key of FACES) {
      const f = c.faces?.[key]
      /* A face naming a texture this file does not carry keeps the name.
         Erasing it here rendered the same - an untextured face - but it
         also silenced the validator's own rule for exactly this case and
         then wrote the detachment back on the next save, so a file whose
         texture ids had been renamed by another tool was reported clean
         and then permanently broken. */
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
      /* Absent, never guessed. A box-UV cube written before v6 has no
         recorded origin, and inventing [0,0] for it would claim the
         unwrap starts at the corner of the sheet - which is a different
         lie from saying nothing. */
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
    // a parent this file does not carry would orphan the bone, so it roots instead
    if (parent) parent.children.push({ kind: 'bone', bone: self })
    else bones.push(self)
  }

  const clips: Clip[] = (doc.clips ?? []).map((clip) => ({
    id: clip.id,
    name: clip.name,
    loop: clip.loop ?? 'loop',
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
      })),
    })),
  }))

  const kind: ProjectKind | undefined =
    doc.kind === 'items' || doc.kind === 'mobs' || doc.kind === 'blocks' ? doc.kind : undefined

  /* A subtype the kind does not offer is dropped rather than carried:
     absent means "not said", which every reader already handles, and a
     nonsense subtype is a claim nothing downstream could act on. */
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
  }
}

/**
 * Two refusals, both by name rather than by failing somewhere in the
 * middle of a cube: a file from a newer Vellum, which cannot be known
 * to mean what this one would assume; and a foreign file.
 */
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
      `This is a Vellum "${header.format}" document; this editor reads "${FORMAT}" documents.`,
    )
  }
  if (typeof header.version !== 'number') {
    throw new VellumFormatError('The "vellum" header carries no version number.')
  }
  if (header.version > CURRENT_VERSION) {
    throw new VellumFormatError(
      `This model was written by a newer Vellum (version ${header.version}) than this one, ` +
        `which cannot know what it means. This editor reads up to version ${CURRENT_VERSION}.`,
    )
  }

  return fromVellumDocument(upgrade(doc))
}

/** True when the bytes look like a `.vellum`. */
export function isVellum(raw: string) {
  return raw.trimStart().startsWith('{"vellum"')
}

/** Every model Vellum writes is a `.vellum`, whatever it was called before. */
export function vellumFileName(name: string) {
  return `${name.replace(/\.(vellum|json)$/i, '')}${EXTENSION}`
}
