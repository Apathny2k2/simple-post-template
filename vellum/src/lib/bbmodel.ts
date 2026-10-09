/* Blockbench projects (.bbmodel), both ways.

   Reading keeps everything. What maps onto Vellum's model becomes cubes,
   bones, meshes, null objects, textures and clips. What doesn't (display
   settings, a face's cullface, an element's colour, an animation's blend
   weight and so on) is kept in `model.blockbench`, by id, and written back
   on export. Keys whose value is what the exporter writes anyway are not
   kept, so a model that came from Vellum carries no extras at all.

   Writing gives a Blockbench 4.10 project, which Blockbench 4 and 5 both
   open. What only Vellum says (the model's kind, behaviour and config, a
   ping-pong loop) rides along under a `vellum` key, so a model saved as a
   .bbmodel opens again exactly as its .vellum would. The round trip test
   checks that for every sample. */

import { FACES } from './model'
import type { Bone, BoneChild, Clip, ClipEvent, Cube, Face, FaceKey, Interpolation, Key, Mesh, MeshFace, Model, NullObject, ProjectKind, Texture, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'
import { boxFaces, unwrapOrigin } from './uv-edit'
import { CURRENT_VERSION, readVellumOnly, vellumOnlyOf } from './vellum'

export type Imported = { model: Model; kind: ProjectKind; notes: string[] }

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}
const vec = (v: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 => {
  const a = arr(v)
  return a.length >= 3 ? [num(a[0], fallback[0]), num(a[1], fallback[1]), num(a[2], fallback[2])] : fallback
}
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/* ---------------- what the exporter writes by default ---------------- */

/* Each kind of object's keys that Vellum has no field for, with the value
   the exporter gives them. Reading drops a key that holds its default, so
   only what a Blockbench author really set is kept. */
const PROJECT_DEFAULTS: Json = {
  model_identifier: '',
  visible_box: [1, 1, 0],
  variable_placeholders: '',
  variable_placeholder_buttons: [],
  timeline_setups: [],
  unhandled_root_fields: {},
}
const CUBE_DEFAULTS: Json = { rescale: false, render_order: 'default', allow_mirror_modeling: true, autouv: 0, color: 0 }
const MESH_DEFAULTS: Json = { color: 0, export: true, render_order: 'default', allow_mirror_modeling: true }
const NULL_DEFAULTS: Json = { lock_ik_target_rotation: false }
const GROUP_DEFAULTS: Json = { color: 0, nbt: '{}', export: true, isOpen: false, autouv: 0 }
const TEXTURE_DEFAULTS: Json = {
  path: '',
  folder: 'block',
  namespace: '',
  group: '',
  particle: false,
  use_as_default: false,
  layers_enabled: false,
  sync_to_project: '',
  render_mode: 'default',
  render_sides: 'auto',
  pbr_channel: 'color',
  frame_time: 1,
  frame_order_type: 'loop',
  frame_order: '',
  frame_interpolate: false,
  visible: true,
  internal: true,
  saved: true,
}
const ANIMATION_DEFAULTS: Json = { override: false, selected: false, anim_time_update: '', blend_weight: '', start_delay: '', loop_delay: '' }

/** The keys of `o` outside `used` whose value isn't the default; undefined when there are none. */
function rest(o: Json, used: readonly string[], defaults: Json = {}): Json | undefined {
  const out: Json = {}
  for (const [k, v] of Object.entries(o)) {
    if (used.includes(k)) continue
    if (k in defaults && same(defaults[k], v)) continue
    out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A Blockbench uuid for a Vellum id. Blockbench tells an element's uuid
 * from a group in the outliner by its 36 characters, so an id of another
 * shape gets a uuid made from its own characters, the same every time.
 */
function uuidFor(id: string): string {
  if (UUID.test(id)) return id
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  const hex: string[] = []
  for (let round = 0; hex.join('').length < 32; round++) {
    for (let i = 0; i < id.length; i++) {
      h1 = Math.imul(h1 ^ id.charCodeAt(i), 16777619) >>> 0
      h2 = Math.imul(h2 + id.charCodeAt(i) + round, 2246822519) >>> 0
    }
    hex.push(h1.toString(16).padStart(8, '0'), h2.toString(16).padStart(8, '0'))
  }
  const x = hex.join('').slice(0, 32)
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-a${x.slice(17, 20)}-${x.slice(20, 32)}`
}

/* ---------------- detecting ---------------- */

/** Whether text is a Blockbench project. */
export function isBbmodel(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && typeof j.meta === 'object' && Array.isArray(j.elements)
  } catch {
    return false
  }
}

/* ---------------- reading ---------------- */

const INTERP: Record<string, Interpolation> = { linear: 'linear', catmullrom: 'catmullrom', step: 'step', bezier: 'bezier' }

/** The format a model goes out as when it didn't come from Blockbench with one. */
function defaultFormat(model: Pick<Model, 'kind' | 'clips' | 'meshes' | 'nulls' | 'bones' | 'cubes'>): string {
  const rotations = (r: Vec3) => r.filter((v) => v !== 0)
  const javaRotation = (r: Vec3) => {
    const turned = rotations(r)
    return turned.length === 0 || (turned.length === 1 && Math.abs(turned[0]) <= 45 && Math.abs(turned[0] / 22.5 - Math.round(turned[0] / 22.5)) < 1e-6)
  }
  const bones: Bone[] = []
  const walk = (list: Bone[]) => list.forEach((b) => (bones.push(b), walk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))))
  walk(model.bones)
  // a still block or item that Java can say exactly stays a Java block model; anything else is a generic one
  const java =
    model.kind !== 'mobs' &&
    !model.clips.length &&
    !model.meshes?.length &&
    !model.nulls?.length &&
    bones.every((b) => rotations(b.rotation).length === 0) &&
    model.cubes.every((c) => javaRotation(c.rotation))
  return java ? 'java_block' : 'free'
}

/**
 * A Blockbench project. Groups become bones, elements cubes, meshes and
 * null objects, animations clips with their easing, bezier handles and
 * effect keys. Blockbench's own ids are kept, so tracks, IK targets and
 * effect locators still point at the right things. Both the Blockbench 4
 * outliner (groups nested in it) and the Blockbench 5 one (groups listed
 * apart, by uuid) are read.
 */
export function fromBbmodel(text: string, fileName = 'model.bbmodel'): Imported {
  let j = JSON.parse(text) as Json
  // a model whose ids weren't uuids went out with a map back to them
  const idMap = obj(obj(j.vellum).ids)
  if (Object.keys(idMap).length) {
    let back = text
    for (const [u, id] of Object.entries(idMap)) if (typeof id === 'string') back = back.split(JSON.stringify(u)).join(JSON.stringify(id))
    j = JSON.parse(back) as Json
  }
  const meta = obj(j.meta)
  const stash = obj(j.vellum)
  const notes: string[] = []
  const res = obj(j.resolution)
  const resolution = { width: num(res.width, 16), height: num(res.height, 16) }
  const derived = new Set(arr(stash.derived_offsets).map((v) => str(v)))
  const pingpong = new Set(arr(stash.pingpong).map((v) => str(v)))
  const bag: { elements: Record<string, Json>; groups: Record<string, Json>; textures: Record<string, Json>; animations: Record<string, Json>; others: unknown[] } = {
    elements: {},
    groups: {},
    textures: {},
    animations: {},
    others: [],
  }

  // textures: a face names one by its index, or in some files by its uuid or `#id`
  const textures: Texture[] = []
  const texRef = new Map<string, string>()
  arr(j.textures).forEach((raw, i) => {
    const t = obj(raw)
    const id = str(t.uuid) || newId()
    const source = str(t.source)
    if (!source.startsWith('data:image')) notes.push(`Texture "${str(t.name, `#${i}`)}" is stored as a path outside the file. Import its PNG on the Textures panel.`)
    const name = str(t.name, `texture_${i}`)
    textures.push({
      id,
      name: /\.[a-z0-9]+$/i.test(name) ? name : `${name}.png`,
      width: num(t.width, num(t.uv_width, resolution.width)),
      height: num(t.height, num(t.uv_height, resolution.height)),
      uvWidth: num(t.uv_width, resolution.width),
      uvHeight: num(t.uv_height, resolution.height),
      source: source.startsWith('data:image') ? source : '',
    })
    const extra = rest(t, ['uuid', 'name', 'width', 'height', 'uv_width', 'uv_height', 'source', 'id'], TEXTURE_DEFAULTS)
    if (extra) bag.textures[id] = extra
    texRef.set(String(i), id)
    texRef.set(`#${i}`, id)
    texRef.set(id, id)
    if (t.id !== undefined) texRef.set(`#${String(t.id)}`, id)
  })
  const textureOf = (v: unknown): string | null => (v === null || v === undefined || v === false ? null : (texRef.get(String(v)) ?? textures[0]?.id ?? null))

  const boxDefault = meta.box_uv === true
  const cubes: Cube[] = []
  const nulls: NullObject[] = []
  const ikSource = new Map<string, string>()
  const meshes: Mesh[] = []
  for (const raw of arr(j.elements)) {
    const e = obj(raw)
    const type = str(e.type, 'cube')
    const id = str(e.uuid) || newId()
    if (type === 'null_object' || type === 'locator') {
      const ik = str(e.ik_target)
      if (str(e.ik_source)) ikSource.set(id, str(e.ik_source))
      nulls.push({
        id,
        name: str(e.name, type),
        parent: null,
        position: vec(e.position, vec(e.from)),
        ...(ik ? { ikTarget: ik } : {}),
        ...(e.ik_chain_length !== undefined ? { ikChain: Math.max(1, num(e.ik_chain_length, 2)) } : {}),
        visible: e.visibility !== false,
        locked: e.locked === true,
      })
      const extra = rest(e, ['uuid', 'type', 'name', 'position', 'ik_target', 'ik_source', 'ik_chain_length', 'visibility', 'locked'], NULL_DEFAULTS)
      // a locator is a null object in Vellum, so remember which it was
      if (extra || type === 'locator') bag.elements[id] = { ...extra, ...(type === 'locator' ? { type } : {}) }
      continue
    }
    if (type === 'mesh') {
      // Blockbench's mesh has the same shape as Vellum's: offsets from an origin, per-vertex UVs
      const vertices: Record<string, Vec3> = {}
      for (const [k, v] of Object.entries(obj(e.vertices))) vertices[k] = vec(v)
      const faces: Record<string, MeshFace> = {}
      for (const [k, rawFace] of Object.entries(obj(e.faces))) {
        const f = obj(rawFace)
        const vs = arr(f.vertices).filter((v): v is string => typeof v === 'string' && v in vertices)
        if (vs.length < 3) continue
        const uv = obj(f.uv)
        faces[k] = { vertices: vs, uv: Object.fromEntries(vs.map((v) => [v, [num(arr(uv[v])[0]), num(arr(uv[v])[1])] as [number, number]])), texture: textureOf(f.texture) }
      }
      meshes.push({ id, name: str(e.name, 'mesh'), parent: null, origin: vec(e.origin), rotation: vec(e.rotation), vertices, faces, visible: e.visibility !== false, locked: e.locked === true })
      const extra = rest(e, ['uuid', 'type', 'name', 'origin', 'rotation', 'vertices', 'faces', 'visibility', 'locked'], MESH_DEFAULTS)
      if (extra) bag.elements[id] = extra
      continue
    }
    if (type !== 'cube') {
      // texture meshes, armatures, splines: kept whole and written back as they came
      bag.others.push(raw)
      continue
    }
    const from = vec(e.from)
    const to = vec(e.to)
    const facesRaw = obj(e.faces)
    const faces = {} as Record<FaceKey, Face>
    const faceExtras: Json = {}
    for (const k of FACES) {
      const f = obj(facesRaw[k])
      const uv = arr(f.uv)
      const rot = num(f.rotation, 0)
      faces[k] = {
        uv: (uv.length === 4 ? uv.map((v) => num(v)) : [0, 0, 0, 0]) as UVRect,
        texture: facesRaw[k] === undefined ? null : textureOf(f.texture),
        ...(rot === 90 || rot === 180 || rot === 270 ? { rotation: rot as 90 | 180 | 270 } : {}),
      }
      const extra = rest(f, ['uv', 'texture', 'rotation'])
      if (extra) faceExtras[k] = extra
    }
    const boxUv = e.box_uv === undefined ? boxDefault : e.box_uv === true
    const offset = arr(e.uv_offset)
    let cube: Cube = {
      id,
      name: str(e.name, 'cube'),
      from,
      to,
      origin: vec(e.origin, from),
      rotation: vec(e.rotation),
      faces,
      inflate: num(e.inflate, 0),
      boxUv,
      ...(offset.length === 2 && !derived.has(id) ? { uvOffset: [num(offset[0]), num(offset[1])] as [number, number] } : {}),
      ...(e.mirror_uv === true ? { mirrorUv: true } : {}),
      visible: e.visibility !== false,
      locked: e.locked === true,
    }
    // an older box UV file keeps only the offset; rebuild its faces from it
    if (boxUv && FACES.every((k) => faces[k].uv.every((v) => v === 0))) {
      const at = cube.uvOffset ?? [0, 0]
      const texture = textures[0]?.id ?? null
      cube = { ...cube, faces: Object.fromEntries(FACES.map((k) => [k, { ...boxFaces(cube, at)[k], texture }])) as Cube['faces'] }
    }
    cubes.push(cube)
    const extra = rest(e, ['uuid', 'type', 'name', 'from', 'to', 'origin', 'rotation', 'faces', 'inflate', 'box_uv', 'uv_offset', 'mirror_uv', 'visibility', 'locked'], CUBE_DEFAULTS)
    if (extra || Object.keys(faceExtras).length) bag.elements[id] = { ...extra, ...(Object.keys(faceExtras).length ? { faces: faceExtras } : {}) }
  }
  if (bag.others.length) {
    const kinds = [...new Set(bag.others.map((o) => str(obj(o).type, 'unknown')))].join(', ')
    notes.push(`${bag.others.length} element${bag.others.length === 1 ? '' : 's'} of a kind Vellum can't show (${kinds}) ${bag.others.length === 1 ? 'is' : 'are'} kept as they are and saved back into a .bbmodel.`)
  }

  // Blockbench 5 lists groups apart from the outliner, which names them by uuid
  const groupData = new Map(arr(j.groups).map((g) => [str(obj(g).uuid), obj(g)] as const))

  // the outliner: groups are bones; loose cubes at the top go under a root bone
  const nullById = new Map(nulls.map((n) => [n.id, n]))
  const meshById = new Map(meshes.map((m) => [m.id, m]))
  const cubeIds = new Set(cubes.map((c) => c.id))
  const parentOf = new Map<string, string | null>()
  const walk = (items: unknown[], parent: string | null): BoneChild[] => {
    const out: BoneChild[] = []
    for (const item of items) {
      if (typeof item === 'string') {
        if (cubeIds.has(item)) out.push({ kind: 'cube', id: item })
        const n = nullById.get(item)
        if (n) n.parent = parent
        const mesh = meshById.get(item)
        if (mesh) mesh.parent = parent
        continue
      }
      const listed = obj(item)
      const g = { ...groupData.get(str(listed.uuid)), ...listed }
      const id = str(g.uuid) || newId()
      const bone: Bone = {
        id,
        name: str(g.name, 'bone'),
        origin: vec(g.origin),
        rotation: vec(g.rotation),
        visible: g.visibility !== false,
        locked: g.locked === true,
        ...(g.mirror_uv === true ? { mirrorUv: true } : {}),
        children: [],
      }
      parentOf.set(id, parent)
      const extra = rest(g, ['uuid', 'name', 'origin', 'rotation', 'visibility', 'locked', 'mirror_uv', 'children'], GROUP_DEFAULTS)
      if (extra) bag.groups[id] = extra
      bone.children = walk(arr(g.children), id)
      out.push({ kind: 'bone', bone })
    }
    return out
  }
  const top = walk(arr(j.outliner), null)
  const bones: Bone[] = top.flatMap((c) => (c.kind === 'bone' ? [c.bone] : []))
  const placed = new Set<string>()
  const mark = (list: BoneChild[]) => list.forEach((c) => (c.kind === 'cube' ? placed.add(c.id) : mark(c.bone.children)))
  // only cubes inside a group count as placed; a loose one at the top has no bone yet
  mark(bones.map((bone) => ({ kind: 'bone' as const, bone })))
  const loose = cubes.filter((c) => !placed.has(c.id))
  if (loose.length) {
    bones.unshift({ id: newId(), name: 'root', origin: [0, 0, 0], rotation: [0, 0, 0], visible: true, locked: false, children: loose.map((c) => ({ kind: 'cube', id: c.id })) })
  }

  // an IK source names the top of the chain; Vellum counts the bones from the target up to it
  for (const n of nulls) {
    const source = ikSource.get(n.id)
    if (!source || !n.ikTarget) continue
    let at: string | null | undefined = n.ikTarget
    let steps = 0
    while (at && at !== source && steps < 64) {
      at = parentOf.get(at)
      steps++
    }
    if (at === source && steps > 0) n.ikChain = steps
  }

  // animations
  const clips: Clip[] = []
  const boneIds = new Set<string>()
  const boneByName = new Map<string, string>()
  const collect = (list: Bone[]) =>
    list.forEach((b) => {
      boneIds.add(b.id)
      if (!boneByName.has(b.name)) boneByName.set(b.name, b.id)
      collect(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))
    })
  collect(bones)
  const order = obj(stash.track_order)
  let molang = 0
  for (const raw of arr(j.animations)) {
    const a = obj(raw)
    const clipId = str(a.uuid) || newId()
    const tracks: Track[] = []
    const events: ClipEvent[] = []
    for (const [key, animRaw] of Object.entries(obj(a.animators))) {
      const animator = obj(animRaw)
      const effects = str(animator.type) === 'effect' || key === 'effects'
      // an older file names each animator by its group's name
      const target = boneIds.has(key) || nullById.has(key) ? key : (boneByName.get(str(animator.name)) ?? key)
      const byChannel = new Map<string, Key[]>()
      for (const kRaw of arr(animator.keyframes)) {
        const k = obj(kRaw)
        const channel = str(k.channel)
        const time = num(k.time)
        const point = obj(arr(k.data_points)[0])
        if (effects) {
          const kind = channel === 'sound' ? 'sound' : channel === 'particle' ? 'particle' : channel === 'timeline' ? 'script' : null
          if (!kind) continue
          const effect = str(point.effect, str(point.script))
          const locator = str(point.locator)
          events.push({ id: newId(), time, kind, effect, ...(locator && nullById.has(locator) ? { locator } : {}) })
          continue
        }
        if (channel !== 'rotation' && channel !== 'position' && channel !== 'scale') continue
        const axis = (v: unknown, d: number) => {
          const n = num(v, NaN)
          if (Number.isNaN(n)) {
            molang++
            return d
          }
          return n
        }
        const d = channel === 'scale' ? 1 : 0
        const key: Key = {
          id: str(k.uuid) || newId(),
          time,
          value: [axis(point.x, d), axis(point.y, d), axis(point.z, d)],
          interp: INTERP[str(k.interpolation, 'linear')] ?? 'linear',
        }
        if (key.interp === 'bezier' && k.bezier_right_time !== undefined) {
          key.handles = {
            leftTime: vec(k.bezier_left_time, [-0.1, -0.1, -0.1]),
            leftValue: vec(k.bezier_left_value),
            rightTime: vec(k.bezier_right_time, [0.1, 0.1, 0.1]),
            rightValue: vec(k.bezier_right_value),
          }
        }
        byChannel.set(channel, [...(byChannel.get(channel) ?? []), key])
      }
      if (effects) continue
      if (!boneIds.has(target) && !nullById.has(target)) continue
      for (const [channel, keys] of byChannel) {
        tracks.push({ bone: target, channel: channel as Track['channel'], keys: keys.sort((x, y) => x.time - y.time) })
      }
    }
    // the order Vellum had its tracks in, when grouping them by bone changed it
    const wanted = arr(order[clipId]).map((v) => str(v))
    if (wanted.length) tracks.sort((x, y) => wanted.indexOf(`${x.bone}:${x.channel}`) - wanted.indexOf(`${y.bone}:${y.channel}`))
    const loop = str(a.loop, 'once')
    clips.push({
      id: clipId,
      name: str(a.name, 'animation'),
      loop: pingpong.has(clipId) ? 'pingpong' : loop === 'loop' || loop === 'hold' ? loop : 'once',
      length: Math.max(0.05, num(a.length, 1)),
      snapping: num(a.snapping, 24),
      tracks,
      ...(events.length ? { events: events.sort((x, y) => x.time - y.time) } : {}),
    })
    const extra = rest(a, ['uuid', 'name', 'loop', 'length', 'snapping', 'animators'], ANIMATION_DEFAULTS)
    if (extra) bag.animations[clipId] = extra
  }
  if (molang) notes.push(`${molang} keyframe value${molang === 1 ? ' was a Molang expression' : 's were Molang expressions'}, which Vellum does not run. ${molang === 1 ? 'It reads' : 'They read'} as the rest value.`)

  const only = readVellumOnly(stash)
  const format = str(meta.model_format)
  // a Java block/item project is an item unless told otherwise; anything rigged or animated is a mob
  const kind: ProjectKind = only.kind ?? (format === 'java_block' ? 'items' : bones.length > 1 || clips.length ? 'mobs' : 'items')
  const name = str(j.name) || fileName.replace(/\.bbmodel$/i, '')
  const model: Model = {
    name,
    kind,
    ...(only.subtype ? { subtype: only.subtype } : {}),
    ...(only.behaviour ? { behaviour: only.behaviour } : {}),
    ...(only.config ? { config: only.config } : {}),
    resolution,
    bones,
    cubes,
    textures,
    clips,
    ...(nulls.length ? { nulls } : {}),
    ...(meshes.length ? { meshes } : {}),
  }

  // the meta and the project's other keys, less what the exporter would write anyway
  const metaExtra = rest(meta, ['format_version'], { model_format: defaultFormat(model), box_uv: cubes.length > 0 && cubes.every((c) => c.boxUv) })
  const projectExtra = rest(j, ['meta', 'name', 'resolution', 'elements', 'outliner', 'textures', 'animations', 'groups', 'vellum'], PROJECT_DEFAULTS)
  const kept: Json = {
    ...(metaExtra ? { meta: metaExtra } : {}),
    ...(projectExtra ? { project: projectExtra } : {}),
    ...(Object.keys(bag.elements).length ? { elements: bag.elements } : {}),
    ...(Object.keys(bag.groups).length ? { groups: bag.groups } : {}),
    ...(Object.keys(bag.textures).length ? { textures: bag.textures } : {}),
    ...(Object.keys(bag.animations).length ? { animations: bag.animations } : {}),
    ...(bag.others.length ? { other_elements: bag.others } : {}),
  }
  if (Object.keys(kept).length) model.blockbench = kept
  return { model, kind, notes }
}

/* ---------------- writing ---------------- */

/**
 * The model as a Blockbench 4.10 project. Everything Blockbench has a
 * place for is written its way; Blockbench's own keys that Vellum kept
 * from an import go back where they came from; what only Vellum knows goes
 * under `vellum`.
 */
export function toBbmodel(model: Model): string {
  const bag = obj(model.blockbench)
  const extras = (group: string, id: string) => obj(obj(bag[group])[id])
  const texIndex = new Map(model.textures.map((t, i) => [t.id, i]))
  const texRef = (id: string | null) => (id !== null && texIndex.has(id) ? texIndex.get(id)! : null)
  const derived: string[] = []

  const cubeElements = model.cubes.map((c) => {
    const ex = extras('elements', c.id)
    const faceEx = obj(ex.faces)
    const boxUv = c.boxUv
    // Blockbench rebuilds a box UV cube's faces from its offset, so one is always given
    if (boxUv && !c.uvOffset) derived.push(c.id)
    const offset = c.uvOffset ?? (boxUv ? unwrapOrigin(c) : undefined)
    return {
      ...CUBE_DEFAULTS,
      ...ex,
      name: c.name,
      box_uv: boxUv,
      locked: c.locked,
      from: c.from,
      to: c.to,
      origin: c.origin,
      rotation: c.rotation,
      inflate: c.inflate,
      ...(offset ? { uv_offset: offset } : {}),
      ...(c.mirrorUv ? { mirror_uv: true } : {}),
      visibility: c.visible,
      faces: Object.fromEntries(
        FACES.map((k) => {
          const f = c.faces[k]
          return [k, { ...obj(faceEx[k]), uv: f.uv, texture: texRef(f.texture), ...(f.rotation ? { rotation: f.rotation } : {}) }]
        }),
      ),
      type: 'cube',
      uuid: uuidFor(c.id),
    }
  })

  const meshElements = (model.meshes ?? []).map((m) => ({
    ...MESH_DEFAULTS,
    ...extras('elements', m.id),
    name: m.name,
    origin: m.origin,
    rotation: m.rotation,
    visibility: m.visible,
    locked: m.locked,
    vertices: m.vertices,
    faces: Object.fromEntries(Object.entries(m.faces).map(([k, f]) => [k, { uv: f.uv, vertices: f.vertices, texture: texRef(f.texture) }])),
    type: 'mesh',
    uuid: uuidFor(m.id),
  }))

  // where each bone sits, for an IK chain's source
  const parentOf = new Map<string, string | null>()
  const walkParents = (list: Bone[], parent: string | null) =>
    list.forEach((b) => {
      parentOf.set(b.id, parent)
      walkParents(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])), b.id)
    })
  walkParents(model.bones, null)
  const nullElements = (model.nulls ?? []).map((n) => {
    const ex = extras('elements', n.id)
    let source: string | null = null
    if (n.ikTarget && n.ikChain !== undefined) {
      let at: string | null = n.ikTarget
      for (let i = 0; i < n.ikChain && at; i++) at = parentOf.get(at) ?? null
      source = at
    }
    return {
      ...NULL_DEFAULTS,
      ...ex,
      name: n.name,
      position: n.position,
      ...(n.ikTarget ? { ik_target: uuidFor(n.ikTarget) } : {}),
      ...(source ? { ik_source: uuidFor(source) } : {}),
      visibility: n.visible,
      locked: n.locked,
      type: str(ex.type) === 'locator' ? 'locator' : 'null_object',
      uuid: uuidFor(n.id),
    }
  })

  // groups nest in the outliner; meshes and null objects follow their bone's own children
  const ridersOf = (bone: string | null) => [
    ...(model.meshes ?? []).filter((m) => m.parent === bone).map((m) => uuidFor(m.id)),
    ...(model.nulls ?? []).filter((n) => n.parent === bone).map((n) => uuidFor(n.id)),
  ]
  const group = (b: Bone): Json => ({
    ...GROUP_DEFAULTS,
    ...extras('groups', b.id),
    name: b.name,
    origin: b.origin,
    rotation: b.rotation,
    uuid: uuidFor(b.id),
    mirror_uv: b.mirrorUv === true,
    locked: b.locked,
    visibility: b.visible,
    children: [...b.children.map((c) => (c.kind === 'bone' ? group(c.bone) : uuidFor(c.id))), ...ridersOf(b.id)],
  })
  const outliner = [...model.bones.map(group), ...ridersOf(null), ...arr(bag.other_elements).map((o) => str(obj(o).uuid)).filter(Boolean)]

  const textures = model.textures.map((t, i) => ({
    ...TEXTURE_DEFAULTS,
    ...extras('textures', t.id),
    name: t.name,
    id: String(i),
    width: t.width,
    height: t.height,
    uv_width: t.uvWidth,
    uv_height: t.uvHeight,
    uuid: uuidFor(t.id),
    source: t.source,
  }))

  const nullIds = new Set((model.nulls ?? []).map((n) => n.id))
  const names = new Map<string, string>()
  const nameWalk = (list: Bone[]) => list.forEach((b) => (names.set(b.id, b.name), nameWalk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))))
  nameWalk(model.bones)
  for (const n of model.nulls ?? []) names.set(n.id, n.name)
  const trackOrder: Json = {}
  const pingpong: string[] = []
  const animations = model.clips.map((clip) => {
    const animators: Json = {}
    const live = clip.tracks.filter((t) => t.keys.length)
    for (const t of live) {
      const id = uuidFor(t.bone)
      const animator = obj(animators[id])
      animators[id] = {
        name: names.get(t.bone) ?? t.bone,
        type: nullIds.has(t.bone) ? 'null_object' : 'bone',
        keyframes: [
          ...arr(animator.keyframes),
          ...[...t.keys]
            .sort((a, b) => a.time - b.time)
            .map((k) => ({
              channel: t.channel,
              data_points: [{ x: k.value[0], y: k.value[1], z: k.value[2] }],
              uuid: uuidFor(k.id),
              time: k.time,
              color: -1,
              interpolation: k.interp,
              ...(k.handles
                ? {
                    bezier_linked: false,
                    bezier_left_time: k.handles.leftTime,
                    bezier_left_value: k.handles.leftValue,
                    bezier_right_time: k.handles.rightTime,
                    bezier_right_value: k.handles.rightValue,
                  }
                : {}),
            })),
        ],
      }
    }
    // the reader takes tracks bone by bone; when that isn't Vellum's order, say what it was
    const natural = Object.keys(animators).flatMap((id) => live.filter((t) => uuidFor(t.bone) === id).map((t) => `${t.bone}:${t.channel}`))
    const actual = live.map((t) => `${t.bone}:${t.channel}`)
    if (!same(natural, actual)) trackOrder[clip.id] = actual
    if (clip.events?.length) {
      animators.effects = {
        name: 'Effects',
        type: 'effect',
        keyframes: [...clip.events]
          .sort((a, b) => a.time - b.time)
          .map((e) => ({
            channel: e.kind === 'script' ? 'timeline' : e.kind,
            data_points: [
              e.kind === 'script'
                ? { script: e.effect }
                : e.kind === 'particle'
                  ? { effect: e.effect, locator: e.locator ? uuidFor(e.locator) : '', script: '', file: '' }
                  : { effect: e.effect, file: '' },
            ],
            uuid: uuidFor(e.id),
            time: e.time,
            color: -1,
            interpolation: 'linear',
          })),
      }
    }
    if (clip.loop === 'pingpong') pingpong.push(clip.id)
    return {
      ...ANIMATION_DEFAULTS,
      ...extras('animations', clip.id),
      uuid: uuidFor(clip.id),
      name: clip.name,
      loop: clip.loop === 'pingpong' ? 'loop' : clip.loop,
      length: clip.length,
      snapping: clip.snapping,
      animators,
    }
  })

  const metaKept = obj(bag.meta)
  const doc: Json = {
    meta: {
      ...metaKept,
      format_version: '4.10',
      model_format: str(metaKept.model_format) || defaultFormat(model),
      box_uv: typeof metaKept.box_uv === 'boolean' ? metaKept.box_uv : model.cubes.length > 0 && model.cubes.every((c) => c.boxUv),
    },
    name: model.name,
    ...PROJECT_DEFAULTS,
    ...obj(bag.project),
    resolution: model.resolution,
    elements: [...cubeElements, ...meshElements, ...nullElements, ...arr(bag.other_elements)],
    outliner,
    textures,
    animations,
  }
  // a model whose ids aren't uuids gets them back from this map
  const ids: Json = {}
  const note = (id: string) => {
    if (uuidFor(id) !== id) ids[uuidFor(id)] = id
  }
  model.cubes.forEach((c) => note(c.id))
  ;(model.meshes ?? []).forEach((m) => note(m.id))
  ;(model.nulls ?? []).forEach((n) => note(n.id))
  model.textures.forEach((t) => note(t.id))
  model.clips.forEach((c) => note(c.id))
  parentOf.forEach((_, id) => note(id))
  doc.vellum = {
    version: CURRENT_VERSION,
    ...vellumOnlyOf(model),
    ...(pingpong.length ? { pingpong } : {}),
    ...(Object.keys(trackOrder).length ? { track_order: trackOrder } : {}),
    ...(derived.length ? { derived_offsets: derived.map(uuidFor) } : {}),
    ...(Object.keys(ids).length ? { ids } : {}),
  }
  return JSON.stringify(doc, null, 2)
}
