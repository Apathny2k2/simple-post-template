/* ---------------------------------------------------------------
   Creating and editing clips.

   A clip is a name, a length and a set of tracks; a track is one bone
   and one channel; a key is a time, a value and how it reaches the next
   one. That is the whole model, and every edit here is a pure function
   over it so the undo stack is just a list of old models.

   Two rules the editor leans on:

   1. **A track is created by keying it.** There is no "add animator"
      step - keying a bone's rotation brings that track into existence,
      and emptying a track removes it again, so the timeline never shows
      a row with nothing in it.
   2. **One key per time, per track.** Keying a time that already holds
      a key overwrites it, which is what makes scrub-pose-key work.
   --------------------------------------------------------------- */

import { newId } from './new-model'
import { sampleTrack } from './model'
import type { Bone, Channel, Clip, Interpolation, Key, Model, Track, Vec3 } from './model'

/** Two keys closer than this are the same key, in seconds. */
const EPSILON = 1e-4

export const DEFAULT_VALUE: Record<Channel, Vec3> = {
  rotation: [0, 0, 0],
  position: [0, 0, 0],
  scale: [1, 1, 1],
}

export const CHANNELS: Channel[] = ['rotation', 'position', 'scale']

/** Snap a time to the clip's grid. A snapping of 0 means "don't". */
export function snapTime(clip: Clip, t: number): number {
  const clamped = Math.max(0, Math.min(clip.length, t))
  if (!clip.snapping) return Number(clamped.toFixed(4))
  return Number((Math.round(clamped * clip.snapping) / clip.snapping).toFixed(4))
}

/* ---------------- clips ---------------- */

export function makeClip(name: string, length = 1, snapping = 24): Clip {
  return { id: newId(), name, loop: 'loop', length, snapping, tracks: [] }
}

/** A name nothing else in the model is using. */
export function uniqueName(taken: readonly string[], wanted: string): string {
  if (!taken.includes(wanted)) return wanted
  for (let n = 2; n < 1000; n++) {
    const candidate = `${wanted}_${n}`
    if (!taken.includes(candidate)) return candidate
  }
  return `${wanted}_${Date.now().toString(36)}`
}

export function addClip(model: Model, name?: string): { model: Model; id: string } {
  /* Naming from the current count collided the moment anything was
     deleted, and the picker is the only place a clip has an identity -
     two options reading "4 · 1s" are indistinguishable. */
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

/**
 * Patch a clip in place.
 *
 * Shortening one used to delete every key past the new end - 77 down to
 * 17 from one drag of the length field, with no warning and no way back
 * except undo, and lengthening it again brought nothing back. Keys off
 * the end round-trip through the codec perfectly well; the validator
 * already says they are out of range, so they are kept and reported
 * rather than destroyed.
 */
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

/**
 * Key a bone-channel at `time`. The track is created if it does not
 * exist; an existing key at that time is overwritten rather than stacked.
 * Without a value, the current sampled pose is keyed - which is what
 * "scrub, pose, key" means.
 */
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
      // moving a key onto another one replaces it, rather than stacking two at a time
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

/** Drop every key a bone-channel holds, which removes the row entirely. */
export function deleteTrack(model: Model, clipId: string, bone: string, channel: Channel): Model {
  return mapTracks(model, clipId, (tracks) =>
    tracks.filter((t) => !(t.bone === bone && t.channel === channel)),
  )
}

/**
 * Make a looping clip actually loop: copy each track's first key to the
 * clip's end, so the pose it returns to is the pose it left.
 */
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

/** Every bone in the tree, flattened - the animatable things in a model. */
export function boneList(bones: Bone[], depth = 0): BoneRef[] {
  return bones.flatMap((b) => [
    { id: b.id, name: b.name, depth },
    ...boneList(
      b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone),
      depth + 1,
    ),
  ])
}
