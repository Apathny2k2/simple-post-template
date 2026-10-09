/* Clip, track and key edits. Each returns a new Model for the undo stack.
   A track exists only while it has keys, and holds one key per time. */

import { newId } from './new-model'
import { sampleTrack } from './model'
import type { Bone, Channel, Clip, ClipEvent, Interpolation, Key, Model, Track, Vec3 } from './model'

/** Two keys closer than this are the same key, in seconds. */
const EPSILON = 1e-4

export const DEFAULT_VALUE: Record<Channel, Vec3> = {
  rotation: [0, 0, 0],
  position: [0, 0, 0],
  scale: [1, 1, 1],
}

export const CHANNELS: Channel[] = ['rotation', 'position', 'scale']

/** Clamp a time to the clip and snap it to the grid. A snapping of 0 means no grid. */
export function snapTime(clip: Clip, t: number): number {
  const clamped = Math.max(0, Math.min(clip.length, t))
  if (!clip.snapping) return Number(clamped.toFixed(4))
  return Number((Math.round(clamped * clip.snapping) / clip.snapping).toFixed(4))
}

/* ---------------- clips ---------------- */

export function makeClip(name: string, length = 1, snapping = 24): Clip {
  return { id: newId(), name, loop: 'loop', length, snapping, tracks: [] }
}

/** `wanted`, or `wanted_2`, `wanted_3` and so on if it is taken. */
export function uniqueName(taken: readonly string[], wanted: string): string {
  if (!taken.includes(wanted)) return wanted
  for (let n = 2; n < 1000; n++) {
    const candidate = `${wanted}_${n}`
    if (!taken.includes(candidate)) return candidate
  }
  return `${wanted}_${Date.now().toString(36)}`
}

export function addClip(model: Model, name?: string): { model: Model; id: string } {
  // the clip picker shows just name and length, so names must differ
  const names = model.clips.map((c) => c.name)
  const clip = makeClip(uniqueName(names, name?.trim() || `animation.${model.clips.length + 1}`))
  return { model: { ...model, clips: [...model.clips, clip] }, id: clip.id }
}

export function deleteClip(model: Model, id: string): Model {
  return { ...model, clips: model.clips.filter((c) => c.id !== id) }
}

export function duplicateClip(model: Model, id: string): { model: Model; id: string } | null {
  const source = model.clips.find((c) => c.id === id)
  if (!source) return null
  const copy: Clip = {
    ...source,
    id: newId(),
    name: uniqueName(model.clips.map((c) => c.name), `${source.name}_copy`),
    tracks: source.tracks.map((t) => ({
      ...t,
      keys: t.keys.map((k) => ({ ...k, id: newId(), value: [...k.value] as Vec3 })),
    })),
  }
  return { model: { ...model, clips: [...model.clips, copy], }, id: copy.id }
}

/** Keys past a shortened clip's end are kept; the validator warns about them. */
export function updateClip(model: Model, id: string, patch: Partial<Omit<Clip, 'id' | 'tracks'>>): Model {
  return {
    ...model,
    clips: model.clips.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)),
  }
}

/* ---------------- tracks and keys ---------------- */

export const findTrack = (clip: Clip | null, bone: string, channel: Channel): Track | null =>
  clip?.tracks.find((t) => t.bone === bone && t.channel === channel) ?? null

export const keyAt = (track: Track | null, time: number): Key | null =>
  track?.keys.find((k) => Math.abs(k.time - time) < EPSILON) ?? null

/** Edit one clip's tracks, dropping any track left empty. */
function mapTracks(model: Model, clipId: string, fn: (tracks: Track[]) => Track[]): Model {
  return {
    ...model,
    clips: model.clips.map((clip) =>
      clip.id === clipId
        ? { ...clip, tracks: fn(clip.tracks).filter((t) => t.keys.length) }
        : clip,
    ),
  }
}

/** Key a bone-channel at `time`, replacing any key there. With no `value`, keys the sampled pose. */
export function setKey(
  model: Model,
  clipId: string,
  bone: string,
  channel: Channel,
  time: number,
  value?: Vec3,
  interp: Interpolation = 'linear',
): Model {
  const clip = model.clips.find((c) => c.id === clipId)
  if (!clip) return model
  const at = snapTime(clip, time)
  const existing = findTrack(clip, bone, channel)
  const resolved = value ?? (existing ? sampleTrack(existing, at) : DEFAULT_VALUE[channel])

  return mapTracks(model, clipId, (tracks) => {
    const i = tracks.findIndex((t) => t.bone === bone && t.channel === channel)
    const key: Key = { id: newId(), time: at, value: [...resolved] as Vec3, interp }
    if (i === -1) return [...tracks, { bone, channel, keys: [key] }]
    const track = tracks[i]
    const keys = track.keys.some((k) => Math.abs(k.time - at) < EPSILON)
      ? track.keys.map((k) => (Math.abs(k.time - at) < EPSILON ? { ...k, value: key.value, interp } : k))
      : [...track.keys, key]
    const next = [...tracks]
    next[i] = { ...track, keys: keys.sort((a, b) => a.time - b.time) }
    return next
  })
}

export function updateKey(
  model: Model,
  clipId: string,
  keyId: string,
  patch: Partial<Omit<Key, 'id'>>,
): Model {
  const clip = model.clips.find((c) => c.id === clipId)
  if (!clip) return model
  const time = patch.time !== undefined ? snapTime(clip, patch.time) : undefined

  return mapTracks(model, clipId, (tracks) =>
    tracks.map((track) => {
      if (!track.keys.some((k) => k.id === keyId)) return track
      // a key moved onto another replaces it
      const cleared =
        time === undefined
          ? track.keys
          : track.keys.filter((k) => k.id === keyId || Math.abs(k.time - time) >= EPSILON)
      return {
        ...track,
        keys: cleared
          .map((k) => (k.id === keyId ? { ...k, ...patch, ...(time !== undefined ? { time } : {}) } : k))
          .sort((a, b) => a.time - b.time),
      }
    }),
  )
}

export function deleteKey(model: Model, clipId: string, keyId: string): Model {
  return mapTracks(model, clipId, (tracks) =>
    tracks.map((t) => ({ ...t, keys: t.keys.filter((k) => k.id !== keyId) })),
  )
}

export function deleteTrack(model: Model, clipId: string, bone: string, channel: Channel): Model {
  return mapTracks(model, clipId, (tracks) =>
    tracks.filter((t) => !(t.bone === bone && t.channel === channel)),
  )
}

/** Copy each track's first key to the clip's end, so the loop returns to its start pose. */
export function closeLoop(model: Model, clipId: string): Model {
  const clip = model.clips.find((c) => c.id === clipId)
  if (!clip) return model
  return mapTracks(model, clipId, (tracks) =>
    tracks.map((track) => {
      if (!track.keys.length) return track
      const first = [...track.keys].sort((a, b) => a.time - b.time)[0]
      const end = clip.length
      const keys = track.keys.filter((k) => Math.abs(k.time - end) >= EPSILON)
      return {
        ...track,
        keys: [...keys, { id: newId(), time: end, value: [...first.value] as Vec3, interp: first.interp }].sort(
          (a, b) => a.time - b.time,
        ),
      }
    }),
  )
}

/* ---------------- bones, for the picker ---------------- */

export type BoneRef = { id: string; name: string; depth: number }

/** Every bone in the tree, flattened depth-first. */
export function boneList(bones: Bone[], depth = 0): BoneRef[] {
  return bones.flatMap((b) => [
    { id: b.id, name: b.name, depth },
    ...boneList(
      b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone),
      depth + 1,
    ),
  ])
}

/* ---------------- many keys at once ---------------- */

/** Shifts keys by `dt` seconds, snapped. A moved key that lands on an unmoved one replaces it. */
export function moveKeys(model: Model, clipId: string, ids: ReadonlySet<string>, dt: number): Model {
  const clip = model.clips.find((c) => c.id === clipId)
  if (!clip || !ids.size) return model
  return mapTracks(model, clipId, (tracks) =>
    tracks.map((track) => {
      if (!track.keys.some((k) => ids.has(k.id))) return track
      const moved = track.keys.filter((k) => ids.has(k.id)).map((k) => ({ ...k, time: snapTime(clip, k.time + dt) }))
      const kept = track.keys.filter((k) => !ids.has(k.id) && !moved.some((m) => Math.abs(m.time - k.time) < EPSILON))
      return { ...track, keys: [...kept, ...moved].sort((a, b) => a.time - b.time) }
    }),
  )
}

export function deleteKeys(model: Model, clipId: string, ids: ReadonlySet<string>): Model {
  return mapTracks(model, clipId, (tracks) => tracks.map((t) => ({ ...t, keys: t.keys.filter((k) => !ids.has(k.id)) })))
}

/** Sets one field on many keys, such as their interpolation. */
export function patchKeys(model: Model, clipId: string, ids: ReadonlySet<string>, patch: Partial<Omit<Key, 'id' | 'time'>>): Model {
  return mapTracks(model, clipId, (tracks) =>
    tracks.map((t) => (t.keys.some((k) => ids.has(k.id)) ? { ...t, keys: t.keys.map((k) => (ids.has(k.id) ? { ...k, ...patch } : k)) } : t)),
  )
}

/** Copied keys, timed from the earliest one, so a paste lands them at the playhead. */
export type KeyClip = Array<{ bone: string; channel: Channel; offset: number; key: Omit<Key, 'id' | 'time'> }>

let keyClipboard: KeyClip | null = null
export const readKeyClipboard = () => keyClipboard

export function copyKeys(clip: Clip, ids: ReadonlySet<string>): KeyClip | null {
  const picked = clip.tracks.flatMap((t) => t.keys.filter((k) => ids.has(k.id)).map((k) => ({ t, k })))
  if (!picked.length) return null
  const start = Math.min(...picked.map((p) => p.k.time))
  keyClipboard = picked.map(({ t, k }) => ({
    bone: t.bone,
    channel: t.channel,
    offset: k.time - start,
    key: { value: [...k.value] as Vec3, interp: k.interp, handles: k.handles },
  }))
  return keyClipboard
}

/**
 * Pastes at `at`. Keys copied from one bone go onto `onto` when it is given,
 * as Blockbench pastes onto the selected bone; keys from several bones go back
 * to their own. Returns the new keys' ids.
 */
export function pasteKeys(model: Model, clipId: string, items: KeyClip, at: number, onto?: string | null): { model: Model; ids: string[] } {
  const clip = model.clips.find((c) => c.id === clipId)
  if (!clip) return { model, ids: [] }
  const oneBone = new Set(items.map((i) => i.bone)).size === 1
  const ids: string[] = []
  let next = model
  for (const item of items) {
    const bone = oneBone && onto ? onto : item.bone
    const time = snapTime(clip, at + item.offset)
    next = setKey(next, clipId, bone, item.channel, time, item.key.value, item.key.interp)
    const c = next.clips.find((x) => x.id === clipId)!
    const k = keyAt(findTrack(c, bone, item.channel), time)
    if (k) {
      if (item.key.handles) next = updateKey(next, clipId, k.id, { handles: item.key.handles })
      ids.push(k.id)
    }
  }
  return { model: next, ids }
}

/* ---------------- events (v8) ---------------- */

export function addEvent(model: Model, clipId: string, event: Omit<ClipEvent, 'id'>): { model: Model; id: string } {
  const id = newId()
  return {
    id,
    model: {
      ...model,
      clips: model.clips.map((c) =>
        c.id === clipId ? { ...c, events: [...(c.events ?? []), { ...event, id, time: snapTime(c, event.time) }].sort((a, b) => a.time - b.time) } : c,
      ),
    },
  }
}

export function updateEvent(model: Model, clipId: string, id: string, patch: Partial<Omit<ClipEvent, 'id'>>): Model {
  return {
    ...model,
    clips: model.clips.map((c) =>
      c.id === clipId
        ? {
            ...c,
            events: (c.events ?? [])
              .map((e) => (e.id === id ? { ...e, ...patch, ...(patch.time !== undefined ? { time: snapTime(c, patch.time) } : {}) } : e))
              .sort((a, b) => a.time - b.time),
          }
        : c,
    ),
  }
}

export function deleteEvent(model: Model, clipId: string, id: string): Model {
  return {
    ...model,
    clips: model.clips.map((c) => {
      if (c.id !== clipId) return c
      const events = (c.events ?? []).filter((e) => e.id !== id)
      return { ...c, events: events.length ? events : undefined }
    }),
  }
}
