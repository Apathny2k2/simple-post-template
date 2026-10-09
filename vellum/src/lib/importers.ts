/* Bringing models in from other tools. Each importer builds an ordinary
   in-memory model, so once it is open it is a .vellum like any other and
   saves as one. What a format holds that Vellum has no place for is
   listed in `notes`, so nothing is dropped without saying so. */

import { FACES } from './model'
import type { Bone, BoneChild, Clip, ClipEvent, Cube, Face, FaceKey, Interpolation, Key, Mesh, MeshFace, Model, NullObject, ProjectKind, Texture, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'
import { boxFaces } from './uv-edit'

export type Imported = { model: Model; kind: ProjectKind; notes: string[] }

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}
const vec = (v: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 => {
  const a = arr(v)
  return a.length >= 3 ? [num(a[0], fallback[0]), num(a[1], fallback[1]), num(a[2], fallback[2])] : fallback
}
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

/** Whether text is a Blockbench project. */
export function isBbmodel(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && typeof j.meta === 'object' && Array.isArray(j.elements)
  } catch {
    return false
  }
}

/** Whether text is a Java Edition block or item model. */
export function isJavaModel(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && !j.meta && !j.vellum && (Array.isArray(j.elements) || typeof j.parent === 'string')
  } catch {
    return false
  }
}

/* ---------------- Blockbench ---------------- */

const INTERP: Record<string, Interpolation> = { linear: 'linear', catmullrom: 'catmullrom', step: 'step', bezier: 'bezier' }

/**
 * A Blockbench project (.bbmodel): cubes, groups as bones, textures,
 * animations with their easing and bezier handles, sound, particle and
 * script keys, and null objects. Blockbench's own ids are kept, so tracks
 * and IK targets still point at the right bones.
 */
export function fromBbmodel(text: string, fileName = 'model.bbmodel'): Imported {
  const j = JSON.parse(text) as Json
  const meta = obj(j.meta)
  const notes: string[] = []
  const res = obj(j.resolution)
  const resolution = { width: num(res.width, 16), height: num(res.height, 16) }

  // textures: a face names one by its index, or in newer files by its uuid
  const textures: Texture[] = []
  const texRef = new Map<string, string>()
  arr(j.textures).forEach((raw, i) => {
    const t = obj(raw)
    const id = str(t.uuid) || newId()
    const source = str(t.source)
    if (!source.startsWith('data:image')) notes.push(`Texture "${str(t.name, `#${i}`)}" is stored as a path outside the file. Import its PNG on the Textures panel.`)
    textures.push({
      id,
      name: str(t.name, `texture_${i}`).replace(/\.png$/i, '') + '.png',
      width: num(t.width, num(t.uv_width, resolution.width)),
      height: num(t.height, num(t.uv_height, resolution.height)),
      uvWidth: num(t.uv_width, resolution.width),
      uvHeight: num(t.uv_height, resolution.height),
      source: source.startsWith('data:image') ? source : '',
    })
    texRef.set(String(i), id)
    texRef.set(`#${i}`, id)
    texRef.set(id, id)
    if (t.id !== undefined) texRef.set(`#${str(t.id, String(t.id))}`, id)
  })
  const textureOf = (v: unknown): string | null => (v === null || v === undefined || v === false ? null : (texRef.get(String(v)) ?? textures[0]?.id ?? null))

  const boxDefault = meta.box_uv === true
  const cubes: Cube[] = []
  const nulls: NullObject[] = []
  const meshes: Mesh[] = []
  const elementKinds = new Map<string, string>()
  let skipped = 0
  for (const raw of arr(j.elements)) {
    const e = obj(raw)
    const type = str(e.type, 'cube')
    const id = str(e.uuid) || newId()
    elementKinds.set(id, type)
    if (type === 'null_object' || type === 'locator') {
      const ik = str(e.ik_target)
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
      continue
    }
    if (type === 'mesh') {
      // Blockbench's mesh has the same shape as Vellum's: offsets from an origin, per-vertex UVs
      const vertices: Record<string, Vec3> = {}
      for (const [k, v] of Object.entries(obj(e.vertices))) vertices[k] = vec(v)
      const faces: Record<string, MeshFace> = {}
      for (const [k, raw] of Object.entries(obj(e.faces))) {
        const f = obj(raw)
        const vs = arr(f.vertices).filter((v): v is string => typeof v === 'string' && v in vertices)
        if (vs.length < 3) continue
        const uv = obj(f.uv)
        faces[k] = { vertices: vs, uv: Object.fromEntries(vs.map((v) => [v, [num(arr(uv[v])[0]), num(arr(uv[v])[1])] as [number, number]])), texture: textureOf(f.texture) }
      }
      meshes.push({ id, name: str(e.name, 'mesh'), parent: null, origin: vec(e.origin), rotation: vec(e.rotation), vertices, faces, visible: e.visibility !== false, locked: e.locked === true })
      continue
    }
    if (type !== 'cube') {
      skipped++
      continue
    }
    const from = vec(e.from)
    const to = vec(e.to)
    const facesRaw = obj(e.faces)
    const faces = {} as Record<FaceKey, Face>
    for (const k of FACES) {
      const f = obj(facesRaw[k])
      const uv = arr(f.uv)
      const rot = num(f.rotation, 0)
      faces[k] = {
        uv: (uv.length === 4 ? uv.map((v) => num(v)) : [0, 0, 0, 0]) as UVRect,
        texture: facesRaw[k] === undefined ? null : textureOf(f.texture),
        ...(rot === 90 || rot === 180 || rot === 270 ? { rotation: rot as 90 | 180 | 270 } : {}),
      }
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
      ...(offset.length === 2 ? { uvOffset: [num(offset[0]), num(offset[1])] as [number, number] } : {}),
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
  }
  if (skipped) notes.push(`${skipped} element${skipped === 1 ? ' of a kind Vellum has no place for was' : 's of kinds Vellum has no place for were'} left out.`)

  // the outliner: groups are bones; loose cubes and nulls at the top go under a root bone
  const nullById = new Map(nulls.map((n) => [n.id, n]))
  const meshById = new Map(meshes.map((m) => [m.id, m]))
  const cubeIds = new Set(cubes.map((c) => c.id))
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
      const g = obj(item)
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
      bone.children = walk(arr(g.children), id)
      out.push({ kind: 'bone', bone })
    }
    return out
  }
  const top = walk(arr(j.outliner), null)
  const bones: Bone[] = top.filter((c): c is { kind: 'bone'; bone: Bone } => c.kind === 'bone').map((c) => c.bone)
  const placed = new Set<string>()
  const mark = (list: BoneChild[]) => list.forEach((c) => (c.kind === 'cube' ? placed.add(c.id) : mark(c.bone.children)))
  // only cubes inside a group count as placed; a loose one at the top has no bone yet
  mark(bones.map((bone) => ({ kind: 'bone' as const, bone })))
  const loose = cubes.filter((c) => !placed.has(c.id))
  if (loose.length) {
    bones.unshift({ id: newId(), name: 'root', origin: [0, 0, 0], rotation: [0, 0, 0], visible: true, locked: false, children: loose.map((c) => ({ kind: 'cube', id: c.id })) })
  }

  // animations
  const clips: Clip[] = []
  const boneIds = new Set<string>()
  const collect = (list: Bone[]) => list.forEach((b) => (boneIds.add(b.id), collect(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))))
  collect(bones)
  let molang = 0
  for (const raw of arr(j.animations)) {
    const a = obj(raw)
    const tracks: Track[] = []
    const events: ClipEvent[] = []
    for (const [target, animRaw] of Object.entries(obj(a.animators))) {
      const animator = obj(animRaw)
      const effects = str(animator.type) === 'effect' || target === 'effects'
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
    const loop = str(a.loop, 'once')
    clips.push({
      id: str(a.uuid) || newId(),
      name: str(a.name, 'animation'),
      loop: loop === 'loop' || loop === 'hold' ? loop : 'once',
      length: Math.max(0.05, num(a.length, 1)),
      snapping: num(a.snapping, 24),
      tracks,
      ...(events.length ? { events: events.sort((x, y) => x.time - y.time) } : {}),
    })
  }
  if (molang) notes.push(`${molang} keyframe value${molang === 1 ? ' was a Molang expression' : 's were Molang expressions'}, which Vellum does not run. ${molang === 1 ? 'It reads' : 'They read'} as the rest value.`)

  const format = str(meta.model_format)
  // a Java block/item project is an item unless told otherwise; anything rigged or animated is a mob
  const kind: ProjectKind = format === 'java_block' ? 'items' : bones.length > 1 || clips.length ? 'mobs' : 'items'
  const name = str(j.name) || fileName.replace(/\.bbmodel$/i, '')
  return {
    model: {
      name,
      kind,
      resolution,
      bones,
      cubes,
      textures,
      clips,
      ...(nulls.length ? { nulls } : {}),
      ...(meshes.length ? { meshes } : {}),
    },
    kind,
    notes,
  }
}

/* ---------------- Java Edition JSON ---------------- */

const AXIS_INDEX: Record<string, number> = { x: 0, y: 1, z: 2 }

/**
 * A Java block or item model. Its UVs are in a 16-unit square whatever the
 * image's size, so the sheet is 16 by 16. Texture variables become blank
 * textures named after their paths; importing a PNG of the same name on
 * the Textures panel fills one in.
 */
export function fromJavaModel(text: string, fileName = 'model.json'): Imported {
  const j = JSON.parse(text) as Json
  const notes: string[] = []
  const elements = arr(j.elements)
  if (!elements.length) {
    throw new Error(`${fileName} has no elements of its own${typeof j.parent === 'string' ? `; it inherits them from "${j.parent}"` : ''}, so there is nothing to open.`)
  }
  const texVars = obj(j.textures)
  const textures: Texture[] = []
  const varTex = new Map<string, string>()
  const blank = (name: string): Texture => {
    const t: Texture = { id: newId(), name, width: 16, height: 16, uvWidth: 16, uvHeight: 16, source: '' }
    textures.push(t)
    return t
  }
  for (const [key, value] of Object.entries(texVars)) {
    if (key === 'particle') continue
    const path = str(value)
    if (path.startsWith('#')) continue
    const t = blank((path.split('/').pop() || key) + '.png')
    varTex.set(`#${key}`, t.id)
  }
  // a variable that points at another, as "#all": "#side", resolves through it
  for (const [key, value] of Object.entries(texVars)) {
    const path = str(value)
    if (path.startsWith('#') && varTex.has(path)) varTex.set(`#${key}`, varTex.get(path)!)
  }
  const cubes: Cube[] = elements.map((raw, i) => {
    const e = obj(raw)
    const from = vec(e.from)
    const to = vec(e.to)
    const r = obj(e.rotation)
    const rotation: Vec3 = [0, 0, 0]
    if (r.axis !== undefined) rotation[AXIS_INDEX[str(r.axis)] ?? 1] = num(r.angle)
    if (r.rescale === true) notes.push(`Element ${i + 1} uses "rescale", which Vellum does not apply.`)
    const facesRaw = obj(e.faces)
    const faces = {} as Record<FaceKey, Face>
    for (const k of FACES) {
      const f = facesRaw[k]
      if (f === undefined) {
        faces[k] = { uv: [0, 0, 0, 0], texture: null }
        continue
      }
      const face = obj(f)
      const uv = arr(face.uv)
      const rot = num(face.rotation, 0)
      faces[k] = {
        uv: (uv.length === 4 ? uv.map((v) => num(v)) : defaultUv(k, from, to)) as UVRect,
        texture: varTex.get(str(face.texture)) ?? textures[0]?.id ?? null,
        ...(rot === 90 || rot === 180 || rot === 270 ? { rotation: rot as 90 | 180 | 270 } : {}),
      }
    }
    return {
      id: newId(),
      name: str(e.name, `element_${i + 1}`),
      from,
      to,
      origin: vec(r.origin, [8, 8, 8]),
      rotation,
      faces,
      inflate: 0,
      boxUv: false,
      visible: true,
      locked: false,
    }
  })
  if (textures.length) notes.push(`The textures are blank: a Java model names its images by path. Import the PNGs on the Textures panel. A PNG with the same file name fills in its texture.`)
  const block = typeof j.parent === 'string' && /block\//.test(j.parent)
  const kind: ProjectKind = block ? 'blocks' : 'items'
  const root: Bone = { id: newId(), name: 'root', origin: [8, 0, 8], rotation: [0, 0, 0], visible: true, locked: false, children: cubes.map((c) => ({ kind: 'cube' as const, id: c.id })) }
  return {
    model: { name: fileName.replace(/\.json$/i, ''), kind, resolution: { width: 16, height: 16 }, bones: [root], cubes, textures, clips: [] },
    kind,
    notes,
  }
}

/** The UV a Java face gets when it names none: the element's own outline on that side. */
function defaultUv(k: FaceKey, from: Vec3, to: Vec3): UVRect {
  switch (k) {
    case 'up':
    case 'down':
      return [from[0], from[2], to[0], to[2]]
    case 'north':
    case 'south':
      return [from[0], 16 - to[1], to[0], 16 - from[1]]
    default:
      return [from[2], 16 - to[1], to[2], 16 - from[1]]
  }
}
