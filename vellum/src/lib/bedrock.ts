/* Bedrock Edition: geometry (.geo.json) and animations (.animation.json),
   both ways.

   Bedrock's axes differ from the model's in one way: X runs the other way.
   A pivot or point goes over as (-x, y, z), a turn as (-x, -y, z), and a
   cube's `origin` is its corner nearest -x in Bedrock's terms, which is the
   model's `to` on x. Up and down faces are drawn turned half round in
   Bedrock, so their UVs cross over swapped end for end, as Blockbench
   writes them. Animation keys take the same signs as Blockbench keeps them
   (see `keySigns`). */

import { FACES, sampleTrack } from './model'
import type { Bone, BoneChild, Clip, ClipEvent, Controller, ControllerState, Cube, Face, FaceKey, Key, Model, NullObject, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'
import { keySigns } from './bbmodel'
import type { Imported } from './bbmodel'
import { boxFaces, unwrapOrigin } from './uv-edit'
import { dataUriBytes, makeZip } from './zip'
import { isPlainNumber, negated } from './molang'
import type { ZipEntry } from './zip'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const r4 = (v: number) => Math.round(v * 1e4) / 1e4 || 0
const flipX = (p: Vec3): Vec3 => [r4(-p[0]), r4(p[1]), r4(p[2])]
const turn = (r: Vec3): Vec3 => [r4(-r[0]), r4(-r[1]), r4(r[2])]
const signed = (v: Vec3, s: Vec3): Vec3 => [r4(v[0] * s[0]), r4(v[1] * s[1]), r4(v[2] * s[2])]
const vec = (v: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 => {
  const a = arr(v)
  return a.length >= 3 ? [num(a[0], fallback[0]), num(a[1], fallback[1]), num(a[2], fallback[2])] : fallback
}

/** A name Bedrock takes as part of an identifier: lower case, letters, digits and underscores. */
export const bedrockName = (name: string) => name.toLowerCase().replace(/[^a-z0-9_.]+/g, '_').replace(/^_+|_+$/g, '') || 'model'

/* ---------------- geometry out ---------------- */

/** The model as Bedrock geometry, format 1.12.0. Meshes have no Bedrock form yet and are listed in `notes`. */
export function toBedrockGeometry(model: Model): { json: Json; notes: string[] } {
  const id = `geometry.${bedrockName(model.name)}`
  const notes: string[] = []
  if (model.meshes?.length) notes.push(`${model.meshes.length} mesh${model.meshes.length === 1 ? ' is' : 'es are'} left out: Bedrock geometry holds cubes.`)
  const cubeById = new Map(model.cubes.map((c) => [c.id, c]))
  const bones: Json[] = []
  let maxR = 1
  let maxY = 1
  const cubeJson = (c: Cube): Json => {
    for (const x of [c.from[0], c.to[0]]) for (const z of [c.from[2], c.to[2]]) maxR = Math.max(maxR, Math.abs(x), Math.abs(z))
    maxY = Math.max(maxY, c.to[1])
    const size: Vec3 = [r4(c.to[0] - c.from[0]), r4(c.to[1] - c.from[1]), r4(c.to[2] - c.from[2])]
    const out: Json = { origin: [r4(-c.to[0]), r4(c.from[1]), r4(c.from[2])], size }
    if (c.rotation.some((v) => v !== 0)) {
      out.pivot = flipX(c.origin)
      out.rotation = turn(c.rotation)
    }
    if (c.inflate) out.inflate = c.inflate
    if (c.boxUv) {
      out.uv = unwrapOrigin(c)
      if (c.mirrorUv) out.mirror = true
    } else {
      const faces: Json = {}
      for (const k of FACES) {
        const f = c.faces[k]
        const [x1, y1, x2, y2] = f.uv
        if (x1 === x2 && y1 === y2 && f.texture === null) continue
        // Bedrock turns up and down faces half round
        const [a, b, cc, d] = k === 'up' || k === 'down' ? [x2, y2, x1, y1] : [x1, y1, x2, y2]
        faces[k] = { uv: [a, b], uv_size: [r4(cc - a), r4(d - b)], ...(f.rotation ? { uv_rotation: f.rotation } : {}) }
      }
      out.uv = faces
    }
    return out
  }
  const walk = (list: Bone[], parent: string | null) => {
    for (const b of list) {
      const cubes = b.children.flatMap((c) => (c.kind === 'cube' && cubeById.has(c.id) ? [cubeJson(cubeById.get(c.id)!)] : []))
      const locators = Object.fromEntries((model.nulls ?? []).filter((n) => n.parent === b.id).map((n) => [n.name, flipX(n.position)]))
      bones.push({
        name: b.name,
        ...(parent ? { parent } : {}),
        pivot: flipX(b.origin),
        ...(b.rotation.some((v) => v !== 0) ? { rotation: turn(b.rotation) } : {}),
        ...(b.mirrorUv ? { mirror: true } : {}),
        ...(cubes.length ? { cubes } : {}),
        ...(Object.keys(locators).length ? { locators } : {}),
      })
      walk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])), b.name)
    }
  }
  walk(model.bones, null)
  // null objects at the model root ride on the first bone
  const loose = (model.nulls ?? []).filter((n) => !n.parent)
  if (loose.length && bones[0]) bones[0].locators = { ...obj(bones[0].locators), ...Object.fromEntries(loose.map((n) => [n.name, flipX(n.position)])) }
  const width = Math.ceil((maxR * 2) / 16) + 1
  const height = Math.ceil(maxY / 16) + 1
  return {
    json: {
      format_version: '1.12.0',
      'minecraft:geometry': [
        {
          description: {
            identifier: id,
            texture_width: model.resolution.width,
            texture_height: model.resolution.height,
            visible_bounds_width: width,
            visible_bounds_height: height,
            visible_bounds_offset: [0, height / 2, 0],
          },
          bones,
        },
      ],
    },
    notes,
  }
}

/* ---------------- animations out ---------------- */

const time = (t: number) => String(r4(t))

/**
 * One track's keys as Bedrock writes them. Linear keys are plain arrays,
 * catmull-rom ones carry `lerp_mode`, a step holds by giving the next key a
 * `pre` value, and a bezier segment, which Bedrock can't say, is baked into
 * linear keys at the clip's snapping rate.
 */
function trackJson(track: Track, snapping: number): Json {
  const s = keySigns(track.channel)
  const keys = [...track.keys].sort((a, b) => a.time - b.time)
  const out: Json = {}
  const step = 1 / Math.max(1, snapping || 20)
  // an axis written in Molang goes out as its expression, signed like the numbers
  const out3 = (k: Key): Array<number | string> => signed(k.value, s).map((v, i) => (k.expr?.[i] ? (s[i] < 0 ? negated(k.expr[i]!) : k.expr[i]!) : v))
  keys.forEach((k, i) => {
    const prev = keys[i - 1]
    const value = out3(k)
    const entry: Json = {}
    if (prev?.interp === 'step') entry.pre = out3(prev)
    entry.post = value
    if (k.interp === 'catmullrom') entry.lerp_mode = 'catmullrom'
    out[time(k.time)] = Object.keys(entry).length === 1 ? value : entry
    const next = keys[i + 1]
    if (k.interp === 'bezier' && next) {
      for (let t = k.time + step; t < next.time - 1e-6; t += step) out[time(t)] = signed(sampleTrack(track, t), s)
    }
  })
  return out
}

/** The model's clips as Bedrock animations, format 1.8.0. Ping-pong clips are written out both ways. */
export function toBedrockAnimations(model: Model): { json: Json; notes: string[] } {
  const notes: string[] = []
  const names = new Map<string, string>()
  const walk = (list: Bone[]) => list.forEach((b) => (names.set(b.id, b.name), walk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))))
  walk(model.bones)
  const nullName = new Map((model.nulls ?? []).map((n) => [n.id, n.name]))
  const base = bedrockName(model.name)
  const animations: Json = {}
  let nullTracks = 0
  for (const clip0 of model.clips) {
    const clip = clip0.loop === 'pingpong' ? pingPongBaked(clip0) : clip0
    const bones: Json = {}
    for (const t of clip.tracks) {
      const name = names.get(t.bone)
      if (!name) {
        if (nullName.has(t.bone)) nullTracks++
        continue
      }
      if (!t.keys.length) continue
      bones[name] = { ...obj(bones[name]), [t.channel]: trackJson(t, clip.snapping) }
    }
    const events = clip.events ?? []
    const at = (kind: ClipEvent['kind']) => events.filter((e) => e.kind === kind)
    const id = clip.name.startsWith('animation.') ? clip.name : `animation.${base}.${bedrockName(clip.name)}`
    animations[id] = {
      ...(clip.loop === 'loop' || clip.loop === 'pingpong' ? { loop: true } : clip.loop === 'hold' ? { loop: 'hold_on_last_frame' } : {}),
      animation_length: r4(clip.length),
      bones,
      ...(at('sound').length ? { sound_effects: Object.fromEntries(at('sound').map((e) => [time(e.time), { effect: e.effect }])) } : {}),
      ...(at('particle').length
        ? { particle_effects: Object.fromEntries(at('particle').map((e) => [time(e.time), { effect: e.effect, ...(e.locator && nullName.has(e.locator) ? { locator: nullName.get(e.locator) } : {}) }])) }
        : {}),
      ...(at('script').length ? { timeline: Object.fromEntries(at('script').map((e) => [time(e.time), e.effect])) } : {}),
    }
  }
  if (nullTracks) notes.push(`${nullTracks} track${nullTracks === 1 ? '' : 's'} on null objects ${nullTracks === 1 ? 'is' : 'are'} left out: Bedrock animates bones.`)
  return { json: { format_version: '1.8.0', animations }, notes }
}

/** A ping-pong clip as a plain loop twice as long: there, and back the same way. */
function pingPongBaked(clip: Clip): Clip {
  const L = clip.length
  return {
    ...clip,
    loop: 'loop',
    length: L * 2,
    tracks: clip.tracks.map((t) => {
      const keys = [...t.keys].sort((a, b) => a.time - b.time)
      const back = keys
        .filter((k) => k.time < L - 1e-6)
        .reverse()
        .map((k, i): Key => ({ ...k, id: `${k.id}~${i}`, time: 2 * L - k.time, handles: undefined, interp: k.interp === 'bezier' ? 'linear' : k.interp }))
      return { ...t, keys: [...keys, ...back] }
    }),
    events: clip.events?.flatMap((e) => [e, { ...e, id: `${e.id}~`, time: 2 * L - e.time }]),
  }
}

/** Geometry, animations and textures in a zip laid out as a resource pack's folders. */
export function toBedrockZip(model: Model): { bytes: Uint8Array; notes: string[] } {
  const name = bedrockName(model.name)
  const geo = toBedrockGeometry(model)
  const enc = new TextEncoder()
  const entries: ZipEntry[] = [{ path: `models/entity/${name}.geo.json`, bytes: enc.encode(JSON.stringify(geo.json, null, 2)) }]
  const notes = [...geo.notes]
  if (model.clips.length) {
    const anim = toBedrockAnimations(model)
    entries.push({ path: `animations/${name}.animation.json`, bytes: enc.encode(JSON.stringify(anim.json, null, 2)) })
    notes.push(...anim.notes)
  }
  const controllers = toBedrockControllers(model)
  if (controllers) entries.push({ path: `animation_controllers/${name}.animation_controllers.json`, bytes: enc.encode(JSON.stringify(controllers, null, 2)) })
  entries.push({ path: `entity/${name}.entity.json`, bytes: enc.encode(JSON.stringify(toBedrockEntity(model), null, 2)) })
  for (const t of model.textures) {
    const bytes = t.source ? dataUriBytes(t.source) : null
    if (bytes) entries.push({ path: `textures/entity/${t.name.replace(/\.png$/i, '')}.png`, bytes })
  }
  return { bytes: makeZip(entries), notes }
}

/* ---------------- in ---------------- */

/** Whether text is Bedrock geometry, the 1.12 form or the older one keyed by `geometry.` names. */
export function isBedrockGeometry(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && (Array.isArray(j['minecraft:geometry']) || Object.keys(j).some((k) => k.startsWith('geometry.')))
  } catch {
    return false
  }
}

/** Whether text is a Bedrock animation file. */
export function isBedrockAnimation(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && typeof j.animations === 'object' && !j.meta
  } catch {
    return false
  }
}

/**
 * Bedrock geometry as a model. Bones keep their names and parents, cubes
 * their box or per-face UVs, locators become null objects. The texture is
 * blank and named after the geometry, as Bedrock files carry no image;
 * importing a PNG of that name on the Textures panel fills it in.
 */
export function fromBedrockGeometry(text: string, fileName = 'model.geo.json'): Imported {
  const j = JSON.parse(text) as Json
  const notes: string[] = []
  let geo: Json
  let identifier: string
  if (Array.isArray(j['minecraft:geometry'])) {
    const list = arr(j['minecraft:geometry'])
    if (list.length > 1) notes.push(`The file holds ${list.length} geometries, and the first is opened.`)
    geo = obj(list[0])
    identifier = str(obj(geo.description).identifier, 'geometry.model')
  } else {
    const key = Object.keys(j).find((k) => k.startsWith('geometry.'))!
    geo = obj(j[key])
    identifier = key.split(':')[0]
  }
  const desc = obj(geo.description)
  const resolution = { width: num(desc.texture_width, num(geo.texturewidth, 64)), height: num(desc.texture_height, num(geo.textureheight, 64)) }
  const texture = { id: newId(), name: `${identifier.replace(/^geometry\./, '')}.png`, width: resolution.width, height: resolution.height, uvWidth: resolution.width, uvHeight: resolution.height, source: '' }
  const cubes: Cube[] = []
  const nulls: NullObject[] = []
  const byName = new Map<string, Bone>()
  const order: Array<{ bone: Bone; parent: string }> = []
  for (const raw of arr(geo.bones)) {
    const b = obj(raw)
    const bone: Bone = { id: newId(), name: str(b.name, 'bone'), origin: flipX(vec(b.pivot)), rotation: turn(vec(b.rotation)), visible: true, locked: false, ...(b.mirror === true ? { mirrorUv: true } : {}), children: [] }
    if (byName.has(bone.name)) notes.push(`Two bones are named "${bone.name}"; the second is renamed.`)
    if (byName.has(bone.name)) bone.name = `${bone.name}_${byName.size}`
    byName.set(bone.name, bone)
    order.push({ bone, parent: str(b.parent) })
    for (const [i, rawCube] of arr(b.cubes).entries()) {
      const c = obj(rawCube)
      const o = vec(c.origin)
      const size = vec(c.size)
      const from: Vec3 = [r4(-(o[0] + size[0])), o[1], o[2]]
      const to: Vec3 = [r4(-o[0]), r4(o[1] + size[1]), r4(o[2] + size[2])]
      const mirror = c.mirror === true || (c.mirror === undefined && b.mirror === true)
      let cube: Cube = {
        id: newId(),
        name: `${bone.name}${i ? `_${i + 1}` : ''}`,
        from,
        to,
        origin: c.pivot ? flipX(vec(c.pivot)) : [...bone.origin] as Vec3,
        rotation: c.rotation ? turn(vec(c.rotation)) : [0, 0, 0],
        faces: Object.fromEntries(FACES.map((k) => [k, { uv: [0, 0, 0, 0] as UVRect, texture: null }])) as Record<FaceKey, Face>,
        inflate: num(c.inflate, 0),
        boxUv: Array.isArray(c.uv),
        ...(mirror ? { mirrorUv: true } : {}),
        visible: true,
        locked: false,
      }
      if (Array.isArray(c.uv)) {
        const at: [number, number] = [num(c.uv[0]), num(c.uv[1])]
        cube = { ...cube, uvOffset: at, faces: Object.fromEntries(FACES.map((k) => [k, { ...boxFaces(cube, at)[k], texture: texture.id }])) as Cube['faces'] }
      } else {
        const per = obj(c.uv)
        for (const k of FACES) {
          const f = obj(per[k])
          if (!per[k]) continue
          const [u, v] = [num(arr(f.uv)[0]), num(arr(f.uv)[1])]
          const [su, sv] = [num(arr(f.uv_size)[0]), num(arr(f.uv_size)[1])]
          const rect: UVRect = k === 'up' || k === 'down' ? [u + su, v + sv, u, v] : [u, v, u + su, v + sv]
          const rot = num(f.uv_rotation, 0)
          cube.faces[k] = { uv: rect, texture: texture.id, ...(rot === 90 || rot === 180 || rot === 270 ? { rotation: rot as 90 | 180 | 270 } : {}) }
        }
      }
      cubes.push(cube)
      bone.children.push({ kind: 'cube', id: cube.id })
    }
    for (const [name, rawAt] of Object.entries(obj(b.locators))) {
      const at = Array.isArray(rawAt) ? vec(rawAt) : vec(obj(rawAt).offset)
      nulls.push({ id: newId(), name, parent: bone.id, position: flipX(at), visible: true, locked: false })
    }
    if (b.poly_mesh) notes.push(`Bone "${bone.name}" has a poly mesh, which is left out.`)
  }
  // parents by name; a bone whose parent isn't in the file goes to the top
  const top: Bone[] = []
  for (const { bone, parent } of order) {
    const p = parent ? byName.get(parent) : undefined
    if (p) p.children.push({ kind: 'bone', bone } as BoneChild)
    else top.push(bone)
  }
  if (!cubes.length && !top.length) throw new Error(`${fileName} has no bones, so there is nothing to open.`)
  notes.push(`The texture is blank: Bedrock geometry names no image. Import ${texture.name} on the Textures panel to fill it in.`)
  const model: Model = {
    name: identifier.replace(/^geometry\./, ''),
    kind: 'mobs',
    resolution,
    bones: top,
    cubes,
    textures: [texture],
    clips: [],
    ...(nulls.length ? { nulls } : {}),
  }
  return { model, kind: 'mobs', notes }
}

/** A Bedrock key's three axes (one value stands for all three): numbers, and Molang kept per axis with `rest` as its number. */
function vectorOf(v: unknown, rest: number, molang: { n: number }): { value: Vec3; expr: Array<string | null> } {
  const raw = Array.isArray(v) ? [v[0], v[1], v[2]] : [v, v, v]
  const expr = raw.map((x) => (typeof x === 'string' && x.trim() && !isPlainNumber(x) ? x : null))
  if (expr.some((e) => e)) molang.n++
  return { value: raw.map((x, i) => (expr[i] ? rest : num(x, rest))) as Vec3, expr }
}

/**
 * Bedrock animations as clips for `model`, matched to its bones by name.
 * Returns the model with the clips added (a clip with a name already used
 * replaces that clip) and notes on what didn't fit.
 */
export function applyBedrockAnimations(model: Model, text: string): { model: Model; added: number; notes: string[] } {
  const j = JSON.parse(text) as Json
  const notes: string[] = []
  const boneId = new Map<string, string>()
  const walk = (list: Bone[]) => list.forEach((b) => (boneId.set(b.name, b.id), walk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))))
  walk(model.bones)
  const nullId = new Map((model.nulls ?? []).map((n) => [n.name, n.id]))
  const missing = new Set<string>()
  const molang = { n: 0 }
  const clips: Clip[] = []
  for (const [name, rawAnim] of Object.entries(obj(j.animations))) {
    const a = obj(rawAnim)
    const tracks: Track[] = []
    let last = 0
    for (const [boneName, rawBone] of Object.entries(obj(a.bones))) {
      const bone = boneId.get(boneName)
      if (!bone) {
        missing.add(boneName)
        continue
      }
      for (const channel of ['rotation', 'position', 'scale'] as const) {
        const raw = obj(rawBone)[channel]
        if (raw === undefined) continue
        const rest = channel === 'scale' ? 1 : 0
        const s = keySigns(channel)
        const keys: Key[] = []
        // a channel can be one value for the whole clip, or keys by time
        const timed = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.entries(raw as Json) : [['0', raw] as [string, unknown]]
        timed
          .map(([t, v]) => [num(t), v] as const)
          .sort((x, y) => x[0] - y[0])
          .forEach(([t, v]) => {
            const entry = v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
            const post = entry ? (entry.post ?? entry.pre) : v
            const read = vectorOf(post, rest, molang)
            const value = signed(read.value, s)
            const expr = read.expr.map((e, i) => (e ? (s[i] < 0 ? negated(e) : e) : null))
            // a `pre` that differs from the key before means that key held until now
            if (entry?.pre !== undefined && keys.length) {
              const pre = signed(vectorOf(entry.pre, rest, { n: 0 }).value, s)
              const prev = keys[keys.length - 1]
              if (pre.every((x, i) => Math.abs(x - prev.value[i]) < 1e-6)) prev.interp = 'step'
            }
            keys.push({ id: newId(), time: t, value, interp: entry?.lerp_mode === 'catmullrom' ? 'catmullrom' : 'linear', ...(expr.some((e) => e) ? { expr } : {}) })
            last = Math.max(last, t)
          })
        if (keys.length) tracks.push({ bone, channel, keys })
      }
    }
    const events: ClipEvent[] = []
    const effect = (raw: unknown, kind: ClipEvent['kind']) => {
      for (const [t, v] of Object.entries(obj(raw))) {
        for (const one of Array.isArray(v) ? v : [v]) {
          const e = obj(one)
          const locator = nullId.get(str(e.locator))
          events.push({ id: newId(), time: num(t), kind, effect: kind === 'script' ? (typeof one === 'string' ? one : '') : str(e.effect), ...(locator ? { locator } : {}) })
        }
      }
    }
    effect(a.sound_effects, 'sound')
    effect(a.particle_effects, 'particle')
    effect(a.timeline, 'script')
    const loop = a.loop === true ? 'loop' : a.loop === 'hold_on_last_frame' ? 'hold' : 'once'
    clips.push({
      id: newId(),
      name,
      loop,
      length: Math.max(0.05, num(a.animation_length, last || 1)),
      snapping: 20,
      tracks,
      ...(events.length ? { events: events.sort((x, y) => x.time - y.time) } : {}),
    })
  }
  if (missing.size) notes.push(`No bone is named ${[...missing].map((n) => `"${n}"`).join(', ')}, so ${missing.size === 1 ? 'its keys were' : 'their keys were'} left out.`)
  if (molang.n) notes.push(`${molang.n} key${molang.n === 1 ? ' is' : 's are'} Molang, kept and played; queries such as ground speed take preview values.`)
  const names = new Set(clips.map((c) => c.name))
  return { model: { ...model, clips: [...model.clips.filter((c) => !names.has(c.name)), ...clips] }, added: clips.length, notes }
}

/* ---------------- animation controllers ---------------- */

/** The short name a controller or entity file calls a clip by: its name without `animation.<model>.`. */
export const shortClipName = (clip: Clip) => bedrockName(clip.name.replace(/^animation\.[^.]+\./, ''))

/** Names made unique by a number, in order. */
function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const k = seen.get(n) ?? 0
    seen.set(n, k + 1)
    return k ? `${n}_${k + 1}` : n
  })
}

/** The model's controllers as Bedrock writes them, format 1.10.0; null when it has none. */
export function toBedrockControllers(model: Model): Json | null {
  if (!model.controllers?.length) return null
  const base = bedrockName(model.name)
  const out: Json = {}
  for (const c of model.controllers) {
    const names = uniqueNames(c.states.map((s) => bedrockName(s.name)))
    const nameOf = new Map(c.states.map((s, i) => [s.id, names[i]]))
    const states: Json = {}
    c.states.forEach((s, i) => {
      const animations = s.clips.flatMap(({ clip, weight }) => {
        const found = model.clips.find((x) => x.id === clip)
        if (!found) return []
        return [weight?.trim() ? { [shortClipName(found)]: weight } : shortClipName(found)]
      })
      states[names[i]] = {
        ...(animations.length ? { animations } : {}),
        ...(s.transitions.length ? { transitions: s.transitions.filter((t) => nameOf.has(t.to)).map((t) => ({ [nameOf.get(t.to)!]: t.when || '0' })) } : {}),
        ...(s.blend ? { blend_transition: s.blend } : {}),
        ...(s.onEntry?.trim() ? { on_entry: [s.onEntry.trim().endsWith(';') ? s.onEntry.trim() : `${s.onEntry.trim()};`] } : {}),
        ...(s.onExit?.trim() ? { on_exit: [s.onExit.trim().endsWith(';') ? s.onExit.trim() : `${s.onExit.trim()};`] } : {}),
      }
    })
    out[`controller.animation.${base}.${bedrockName(c.name)}`] = { initial_state: nameOf.get(c.initial) ?? names[0], states }
  }
  return { format_version: '1.10.0', animation_controllers: out }
}

/**
 * The client entity file that ties the pack together: the geometry, the
 * texture, every animation and controller by the short names controllers
 * use, and the controllers set to run.
 */
export function toBedrockEntity(model: Model): Json {
  const base = bedrockName(model.name)
  const anims = toBedrockAnimations(model).json.animations as Json
  const ids = Object.keys(anims)
  const animations: Json = Object.fromEntries(model.clips.map((c, i) => [shortClipName(c), ids[i]]))
  const controllers = Object.keys(obj(toBedrockControllers(model)?.animation_controllers))
  controllers.forEach((id) => (animations[id.split('.').pop()!] = id))
  const texture = model.textures[0]?.name.replace(/\.png$/i, '') ?? base
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `vellum:${base}`,
        materials: { default: 'entity_alphatest' },
        textures: { default: `textures/entity/${texture}` },
        geometry: { default: `geometry.${base}` },
        render_controllers: ['controller.render.default'],
        ...(Object.keys(animations).length ? { animations } : {}),
        ...(controllers.length ? { scripts: { animate: controllers.map((id) => id.split('.').pop()!) } } : {}),
      },
    },
  }
}

/** Whether text is a Bedrock animation controllers file. */
export function isBedrockControllers(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && typeof j.animation_controllers === 'object'
  } catch {
    return false
  }
}

/**
 * Bedrock controllers onto `model`, their animations matched to its clips
 * by name (a clip named `animation.x.walk`, or `walk`, answers to `walk`).
 * A controller with a name already used replaces it.
 */
export function applyBedrockControllers(model: Model, text: string): { model: Model; added: number; notes: string[] } {
  const j = JSON.parse(text) as Json
  const notes: string[] = []
  const missing = new Set<string>()
  const clipFor = (short: string) =>
    model.clips.find((c) => c.name === short || c.name.endsWith(`.${short}`) || shortClipName(c) === bedrockName(short))
  const controllers: Controller[] = []
  for (const [fullName, rawC] of Object.entries(obj(j.animation_controllers))) {
    const c = obj(rawC)
    const entries = Object.entries(obj(c.states))
    const ids = new Map(entries.map(([name]) => [name, newId()]))
    const states: ControllerState[] = entries.map(([name, rawS]) => {
      const st = obj(rawS)
      const clips = arr(st.animations).flatMap((a) => {
        const [short, weight] = typeof a === 'string' ? [a, undefined] : (Object.entries(obj(a))[0] ?? ['', undefined])
        const clip = clipFor(String(short))
        if (!clip) {
          missing.add(String(short))
          return []
        }
        return [{ clip: clip.id, ...(typeof weight === 'string' && weight.trim() ? { weight } : typeof weight === 'number' && weight !== 1 ? { weight: String(weight) } : {}) }]
      })
      const transitions = arr(st.transitions).flatMap((t) => {
        const [to, when] = Object.entries(obj(t))[0] ?? []
        return to && ids.has(to) ? [{ to: ids.get(to)!, when: typeof when === 'string' ? when : String(when ?? '') }] : []
      })
      const script = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(' ') : typeof v === 'string' ? v : '')
      return {
        id: ids.get(name)!,
        name,
        clips,
        transitions,
        ...(num(st.blend_transition) > 0 ? { blend: num(st.blend_transition) } : {}),
        ...(script(st.on_entry) ? { onEntry: script(st.on_entry) } : {}),
        ...(script(st.on_exit) ? { onExit: script(st.on_exit) } : {}),
      }
    })
    if (!states.length) continue
    const initial = ids.get(str(c.initial_state, 'default')) ?? states[0].id
    controllers.push({ id: newId(), name: fullName.replace(/^controller\.animation\.([^.]+\.)?/, ''), initial, states })
  }
  if (missing.size) notes.push(`No clip answers to ${[...missing].map((n) => `"${n}"`).join(', ')}, so ${missing.size === 1 ? 'it was' : 'they were'} left out of the states.`)
  const names = new Set(controllers.map((c) => c.name))
  return { model: { ...model, controllers: [...(model.controllers ?? []).filter((c) => !names.has(c.name)), ...controllers] }, added: controllers.length, notes }
}
