/* ---------------------------------------------------------------
   `.vellum` — the native model format.

   Per docs/architecture §3: not a zip and not a custom binary, but a
   compact, key-ordered UTF-8 JSON document with a Vellum-owned schema.
   The extension is ours; the encoding is JSON so `git diff` on a model
   keeps working.

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
   models or textures, no display transforms, no editor state, and none
   of Blockbench's `meta` - carrying that would leave the document with
   two version numbers that can disagree.
   --------------------------------------------------------------- */

import { FACES } from './bbmodel'
import type {
  Animation,
  Channel,
  Element,
  FaceKey,
  Group,
  Interpolation,
  Model,
  Texture,
  UVRect,
  Vec3,
} from './bbmodel'

export const FORMAT = 'model'
export const CURRENT_VERSION = 2

/** A well-formed `.vellum` begins with exactly these bytes. */
export const HEADER_PREFIX = `{"vellum":{"format":"${FORMAT}","version":${CURRENT_VERSION}},`

export const EXTENSION = '.vellum'

/* ---------------- the document shape ---------------- */

type VellumFace = {
  uv: UVRect
  /** a texture ID, not an index into an array */
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
  mirror_uv?: boolean
  faces: Record<string, VellumFace>
}

type VellumBone = {
  id: string
  name: string
  origin: Vec3
  rotation: Vec3
  /** said once, as a parent id - unlike Blockbench's duplicated groups + outliner */
  parent?: string
  cubes: string[]
  mirror_uv?: boolean
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
  loop: Animation['loop']
  length: number
  snapping?: number
  tracks: VellumTrack[]
}

export type VellumDocument = {
  vellum: { format: string; version: number }
  name?: string
  resolution?: { width: number; height: number }
  bones: VellumBone[]
  cubes: VellumCube[]
  textures: VellumTexture[]
  clips: VellumClip[]
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
  const textureIdOf = (index: number | null): string | undefined =>
    index === null ? undefined : model.textures[index]?.id

  const cubes: VellumCube[] = model.elements.map((el) =>
    compact({
      id: el.uuid,
      name: el.name,
      from: el.from,
      to: el.to,
      origin: el.origin,
      rotation: el.rotation,
      inflate: el.inflate || undefined,
      box_uv: el.boxUv || undefined,
      mirror_uv: undefined,
      // faces are emitted in sorted order so a reshuffle cannot churn the diff
      faces: Object.fromEntries(
        [...FACES]
          .sort()
          .map((key): [string, VellumFace] => [
            key,
            compact({
              uv: el.faces[key].uv,
              texture: textureIdOf(el.faces[key].texture),
              rotation: el.faces[key].rotation || undefined,
            }),
          ]),
      ),
    }),
  )

  // the group tree flattens to a bone list carrying parent ids
  const bones: VellumBone[] = []
  const walk = (groups: Group[], parent?: string) => {
    for (const g of groups) {
      bones.push(
        compact({
          id: g.uuid,
          name: g.name,
          origin: g.origin,
          rotation: g.rotation,
          parent,
          cubes: g.children.filter((c) => c.kind === 'element').map((c) => (c as { uuid: string }).uuid),
          mirror_uv: undefined,
        }),
      )
      walk(
        g.children.filter((c) => c.kind === 'group').map((c) => (c as { group: Group }).group),
        g.uuid,
      )
    }
  }
  walk(model.outliner)

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
     stacks its rows - Blockbench's animator-with-mixed-keyframes shape
     makes you re-filter by channel at every read. */
  const clips: VellumClip[] = model.animations.map((anim) =>
    compact({
      id: anim.uuid,
      name: anim.name,
      loop: anim.loop,
      length: anim.length,
      snapping: anim.snapping || undefined,
      tracks: anim.animators.flatMap((an) => {
        const channels: Channel[] = ['rotation', 'position', 'scale']
        return channels
          .map((channel) => ({
            bone: an.boneUuid,
            channel,
            keys: an.keyframes
              .filter((k) => k.channel === channel)
              .sort((a, b) => a.time - b.time)
              .map((k) => ({ time: k.time, value: k.value, interp: k.interpolation })),
          }))
          .filter((t) => t.keys.length)
      }),
    }),
  )

  // insertion order here IS the written key order
  return compact({
    vellum: { format: FORMAT, version: CURRENT_VERSION },
    name: model.name || undefined,
    resolution: model.resolution,
    bones,
    cubes,
    textures,
    clips,
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
      default:
        throw new VellumFormatError(`No upgrade path from .vellum version ${version}.`)
    }
  }
  return { ...doc, vellum: { format: doc.vellum.format, version } }
}

export function fromVellumDocument(doc: VellumDocument): Model {
  const resolution = doc.resolution ?? { width: 16, height: 16 }

  const textures: Texture[] = (doc.textures ?? []).map((t, i) => ({
    uuid: t.id,
    id: t.id ?? String(i),
    name: t.name,
    width: t.width,
    height: t.height,
    uvWidth: t.uv_width ?? resolution.width,
    uvHeight: t.uv_height ?? resolution.height,
    source: t.source ?? '',
  }))

  const indexOfTexture = (id: string | undefined) => {
    if (id === undefined) return null
    const i = textures.findIndex((t) => t.id === id)
    return i === -1 ? null : i
  }

  const elements: Element[] = (doc.cubes ?? []).map((c) => {
    const faces = {} as Record<FaceKey, Element['faces'][FaceKey]>
    for (const key of FACES) {
      const f = c.faces?.[key]
      faces[key] = {
        uv: (f?.uv ?? [0, 0, 0, 0]) as UVRect,
        texture: indexOfTexture(f?.texture),
        rotation: (f?.rotation ?? 0) as 0 | 90 | 180 | 270,
      }
    }
    return {
      uuid: c.id,
      name: c.name,
      from: c.from,
      to: c.to,
      origin: c.origin ?? [0, 0, 0],
      rotation: c.rotation ?? [0, 0, 0],
      faces,
      inflate: c.inflate ?? 0,
      boxUv: c.box_uv ?? false,
      color: 0,
      visibility: true,
      locked: false,
    }
  })

  // rebuild the nested tree from the parent pointers
  const boneList = doc.bones ?? []
  const groups = new Map<string, Group>()
  for (const b of boneList) {
    groups.set(b.id, {
      uuid: b.id,
      name: b.name,
      origin: b.origin ?? [0, 0, 0],
      rotation: b.rotation ?? [0, 0, 0],
      color: 0,
      isOpen: true,
      visibility: true,
      locked: false,
      children: (b.cubes ?? []).map((uuid) => ({ kind: 'element' as const, uuid })),
    })
  }

  const roots: Group[] = []
  for (const b of boneList) {
    const self = groups.get(b.id)!
    const parent = b.parent ? groups.get(b.parent) : undefined
    if (parent) parent.children.push({ kind: 'group', group: self })
    else roots.push(self)
  }

  const animations: Animation[] = (doc.clips ?? []).map((clip) => {
    // tracks are per bone-channel; animators are per bone
    const byBone = new Map<string, Animation['animators'][number]>()
    for (const track of clip.tracks ?? []) {
      let animator = byBone.get(track.bone)
      if (!animator) {
        animator = {
          boneUuid: track.bone,
          name: groups.get(track.bone)?.name ?? track.bone,
          keyframes: [],
        }
        byBone.set(track.bone, animator)
      }
      for (const key of track.keys ?? []) {
        animator.keyframes.push({
          uuid: `${clip.id}:${track.bone}:${track.channel}:${key.time}`,
          channel: track.channel,
          time: key.time,
          value: key.value,
          interpolation: key.interp ?? 'linear',
        })
      }
    }
    return {
      uuid: clip.id,
      name: clip.name,
      loop: clip.loop ?? 'loop',
      length: clip.length,
      snapping: clip.snapping ?? 24,
      animators: [...byBone.values()],
    }
  })

  return {
    name: doc.name ?? 'model',
    // `.vellum` carries no Blockbench format; the editor treats it as generic
    format: 'vellum',
    boxUv: false,
    resolution,
    elements,
    outliner: roots,
    textures,
    animations,
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
      'This file has no "vellum" header, so it was not written by Vellum. Import it as .bbmodel instead.',
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

/** True when the bytes look like a `.vellum` rather than a `.bbmodel`. */
export function isVellum(raw: string) {
  return raw.trimStart().startsWith('{"vellum"')
}

/** Swap any model extension for `.vellum`; opening and saving is the migration. */
export function vellumFileName(name: string) {
  return `${name.replace(/\.(vellum|bbmodel|json)$/i, '')}${EXTENSION}`
}
