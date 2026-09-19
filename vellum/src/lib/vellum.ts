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
import type { ConfigValue, MythicConfig, Row } from './mythic'
import type {
  Bone,
  Channel,
  Clip,
  Cube,
  Face,
  FaceKey,
  Interpolation,
  Model,
  ProjectKind,
  Subtype,
  Texture,
  UVRect,
  Vec3,
} from './model'

export const FORMAT = 'model'
export const CURRENT_VERSION = 5

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

type VellumKey = {
  time: number
  value: Vec3
  interp: Interpolation
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
   * The MythicMobs config, as a flat map of the schema's own keys.
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
            .map((k) => ({ time: k.time, value: k.value, interp: k.interp })),
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

  /* Only what was set: a config of forty defaults is forty lines of
     noise in every diff, and MythicMobs reads an absent key as the
     default anyway. */
  const config = model.config && Object.keys(model.config).length ? model.config : undefined

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
function readConfig(raw: Record<string, unknown> | undefined): MythicConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: MythicConfig = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' || typeof value === 'boolean') {
      out[key] = value
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
    } else if (Array.isArray(value)) {
      if (value.every((v) => typeof v === 'string')) {
        out[key] = value as string[]
      } else if (value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
        out[key] = value.map((v) => {
          const row: Row = {}
          for (const [k, c] of Object.entries(v as Record<string, unknown>)) {
            if (typeof c === 'string') row[k] = c
            else if (typeof c === 'number' && Number.isFinite(c)) row[k] = String(c)
          }
          return row
        }) as ConfigValue
      }
    }
  }
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
      default:
        throw new VellumFormatError(`No upgrade path from .vellum version ${version}.`)
    }
  }
  return { ...doc, vellum: { format: doc.vellum.format, version } }
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
    config: readConfig(doc.config),
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
