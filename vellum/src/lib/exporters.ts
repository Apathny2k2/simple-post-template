/* Sending models out to other tools: glTF (with the rig and every clip, for
   Blender and game engines), OBJ (the rest pose, for anything), and Java
   Edition JSON. Geometry comes from the same rig maths the viewport and the
   gizmos use, so an export stands exactly as the model does on screen. */

import { frameCount } from './texture-anim'
import { FACES, textureById } from './model'
import type { Bone, Cube, FaceKey, Mesh, Model, Vec3 } from './model'
import { FACE_CORNERS, faceNormal, faceOrder } from './mesh'
import { applyDir, buildRig, cubeFrame, meshFrame, posedAt, rotationMatrix } from './kinematics'
import { dataUriBytes, makeZip } from './zip'
import { safeId, toMinecraftModel } from './mcmodel'

/** 16 units are a block; a block is a metre in glTF and OBJ. */
const UNIT = 1 / 16

const NORMALS: Record<FaceKey, Vec3> = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] }

/** A face to write: its corners clockwise as seen from outside, with their UVs (0..1) and the face's normal. */
export type Quad = { face: FaceKey | string; texture: string | null; points: Vec3[]; normal: Vec3; uv: Array<[number, number]> }

/** A UV (0..1 over one frame) on the whole image, in its first frame: glTF and OBJ embed the strip and show frame one. */
function frameOne(model: Model, q: Quad, uv: [number, number]): [number, number] {
  const tex = textureById(model, q.texture)
  const n = tex ? frameCount(tex, model) : 1
  return n > 1 ? [uv[0], uv[1] / n] : uv
}

/** A mesh's faces as polygons, clockwise from outside like a cube's quads, each point through `place`. */
function meshQuads(model: Model, mesh: Mesh, place: (p: Vec3) => Vec3, placeDir: (v: Vec3) => Vec3): Quad[] {
  const out: Quad[] = []
  for (const [key, f] of Object.entries(mesh.faces)) {
    const ccw = faceOrder(mesh, f)
    if (ccw.length < 3) continue
    const cw = [ccw[0], ...ccw.slice(1).reverse()]
    const tex = textureById(model, f.texture)
    const W = tex?.uvWidth || model.resolution.width
    const H = tex?.uvHeight || model.resolution.height
    out.push({
      face: key,
      texture: f.texture,
      points: cw.map((k) => place(mesh.vertices[k])),
      normal: placeDir(faceNormal(mesh, f)),
      uv: cw.map((k) => [(f.uv[k]?.[0] ?? 0) / W, (f.uv[k]?.[1] ?? 0) / H] as [number, number]),
    })
  }
  return out
}

/**
 * A cube's faces as quads, each point passed through `place`. UVs are 0..1
 * across the face's texture, top left at 0,0, with the face's turn applied.
 */
export function quads(model: Model, cube: Cube, place: (p: Vec3) => Vec3, placeDir: (v: Vec3) => Vec3): Quad[] {
  const inf = cube.inflate || 0
  const lo: Vec3 = [cube.from[0] - inf, cube.from[1] - inf, cube.from[2] - inf]
  const hi: Vec3 = [cube.to[0] + inf, cube.to[1] + inf, cube.to[2] + inf]
  const out: Quad[] = []
  for (const k of FACES) {
    const f = cube.faces[k]
    const [x1, y1, x2, y2] = f.uv
    if (x1 === x2 || y1 === y2) continue
    const tex = textureById(model, f.texture)
    const W = tex?.uvWidth || model.resolution.width
    const H = tex?.uvHeight || model.resolution.height
    const corners: Array<[number, number]> = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    const turn = (f.rotation ?? 0) / 90
    out.push({
      face: k,
      texture: f.texture,
      points: FACE_CORNERS[k].map((c) => place([c[0] ? hi[0] : lo[0], c[1] ? hi[1] : lo[1], c[2] ? hi[2] : lo[2]])),
      normal: placeDir(NORMALS[k]),
      // a face turned a quarter shows the texel from its top left at its top right
      uv: [0, 1, 2, 3].map((i) => {
        const [u, v] = corners[(i - turn + 4) % 4]
        return [u / W, v / H] as [number, number]
      }),
    })
  }
  return out
}

/* ---------------- glTF ---------------- */

/** A unit quaternion [x, y, z, w] for an Euler rotation in the rig's own order. */
function quatOf(rot: Vec3): [number, number, number, number] {
  const m = rotationMatrix(rot)
  const c0 = applyDir(m, [1, 0, 0])
  const c1 = applyDir(m, [0, 1, 0])
  const c2 = applyDir(m, [0, 0, 1])
  // r[row][col]
  const r = [
    [c0[0], c1[0], c2[0]],
    [c0[1], c1[1], c2[1]],
    [c0[2], c1[2], c2[2]],
  ]
  const tr = r[0][0] + r[1][1] + r[2][2]
  let x: number, y: number, z: number, w: number
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    w = 0.25 * s
    x = (r[2][1] - r[1][2]) / s
    y = (r[0][2] - r[2][0]) / s
    z = (r[1][0] - r[0][1]) / s
  } else if (r[0][0] > r[1][1] && r[0][0] > r[2][2]) {
    const s = Math.sqrt(1 + r[0][0] - r[1][1] - r[2][2]) * 2
    w = (r[2][1] - r[1][2]) / s
    x = 0.25 * s
    y = (r[0][1] + r[1][0]) / s
    z = (r[0][2] + r[2][0]) / s
  } else if (r[1][1] > r[2][2]) {
    const s = Math.sqrt(1 + r[1][1] - r[0][0] - r[2][2]) * 2
    w = (r[0][2] - r[2][0]) / s
    x = (r[0][1] + r[1][0]) / s
    y = 0.25 * s
    z = (r[1][2] + r[2][1]) / s
  } else {
    const s = Math.sqrt(1 + r[2][2] - r[0][0] - r[1][1]) * 2
    w = (r[1][0] - r[0][1]) / s
    x = (r[0][2] + r[2][0]) / s
    y = (r[1][2] + r[2][1]) / s
    z = 0.25 * s
  }
  const n = Math.hypot(x, y, z, w) || 1
  return [x / n, y / n, z / n, w / n]
}

type Flat = { bone: Bone; parent: Bone | null }
function flatBones(bones: Bone[], parent: Bone | null = null, out: Flat[] = []): Flat[] {
  for (const b of bones) {
    out.push({ bone: b, parent })
    flatBones(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone), b, out)
  }
  return out
}

/**
 * The model as one self-contained .gltf: a node per bone, the cubes as
 * meshes on their bones, the textures embedded with nearest-neighbour
 * sampling, and every clip as an animation sampled at its snapping rate,
 * IK included. Blender imports it with the rig and the actions.
 */
export function toGltf(model: Model): string {
  const bins: Uint8Array[] = []
  let byteLength = 0
  const bufferViews: unknown[] = []
  const accessors: unknown[] = []
  const push = (data: Float32Array | Uint32Array, target?: number): number => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const pad = (4 - (byteLength % 4)) % 4
    if (pad) {
      bins.push(new Uint8Array(pad))
      byteLength += pad
    }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, ...(target ? { target } : {}) })
    bins.push(bytes)
    byteLength += bytes.byteLength
    return bufferViews.length - 1
  }
  const accessor = (data: Float32Array | Uint32Array, type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4', target?: number, minmax = false): number => {
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type]
    const view = push(data, target)
    const acc: Record<string, unknown> = {
      bufferView: view,
      componentType: data instanceof Float32Array ? 5126 : 5125,
      count: data.length / size,
      type,
    }
    if (minmax) {
      const min = Array(size).fill(Infinity)
      const max = Array(size).fill(-Infinity)
      for (let i = 0; i < data.length; i++) {
        min[i % size] = Math.min(min[i % size], data[i])
        max[i % size] = Math.max(max[i % size], data[i])
      }
      acc.min = min
      acc.max = max
    }
    accessors.push(acc)
    return accessors.length - 1
  }

  // materials: one per texture, and a plain one for untextured faces
  const images: unknown[] = []
  const textures: unknown[] = []
  const materials: unknown[] = []
  const materialOf = new Map<string | null, number>()
  for (const t of model.textures) {
    const mat: Record<string, unknown> = { name: t.name.replace(/\.png$/i, ''), alphaMode: 'MASK', alphaCutoff: 0.5, doubleSided: false }
    if (t.source) {
      images.push({ uri: t.source, name: t.name })
      textures.push({ source: images.length - 1, sampler: 0 })
      mat.pbrMetallicRoughness = { baseColorTexture: { index: textures.length - 1 }, metallicFactor: 0, roughnessFactor: 1 }
    } else {
      mat.pbrMetallicRoughness = { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 1 }
    }
    materials.push(mat)
    materialOf.set(t.id, materials.length - 1)
  }
  const plain = () => {
    if (!materialOf.has(null)) {
      materials.push({ name: 'untextured', pbrMetallicRoughness: { baseColorFactor: [0.7, 0.7, 0.7, 1], metallicFactor: 0, roughnessFactor: 1 } })
      materialOf.set(null, materials.length - 1)
    }
    return materialOf.get(null)!
  }

  const flat = flatBones(model.bones)
  const nodeOf = new Map<string, number>()
  flat.forEach((f, i) => nodeOf.set(f.bone.id, i))
  const owner = new Map<string, string>()
  for (const f of flat) for (const c of f.bone.children) if (c.kind === 'cube') owner.set(c.id, f.bone.id)

  const meshes: unknown[] = []
  const nodes: Record<string, unknown>[] = flat.map((f) => {
    const at: Vec3 = [f.bone.origin[0] - (f.parent?.origin[0] ?? 0), f.bone.origin[1] - (f.parent?.origin[1] ?? 0), f.bone.origin[2] - (f.parent?.origin[2] ?? 0)]
    return {
      name: f.bone.name,
      translation: at.map((v) => v * UNIT),
      rotation: quatOf(f.bone.rotation),
      children: f.bone.children.filter((c) => c.kind === 'bone').map((c) => nodeOf.get((c as { bone: Bone }).bone.id)!),
    }
  })

  // the cubes of each bone, in the bone's own frame, one primitive per texture
  const cubesOf = new Map<string, Cube[]>()
  const loose: Cube[] = []
  for (const c of model.cubes) {
    const b = owner.get(c.id)
    if (b) cubesOf.set(b, [...(cubesOf.get(b) ?? []), c])
    else loose.push(c)
  }
  const meshFor = (cubes: Cube[], boneOrigin: Vec3, name: string, free: Mesh[] = []): number | null => {
    const groups = new Map<number, Quad[]>()
    const add = (q: Quad) => {
      const mat = q.texture !== null && materialOf.has(q.texture) ? materialOf.get(q.texture)! : plain()
      groups.set(mat, [...(groups.get(mat) ?? []), q])
    }
    for (const mesh of free) {
      const m = new DOMMatrix()
        .translate(mesh.origin[0] - boneOrigin[0], mesh.origin[1] - boneOrigin[1], mesh.origin[2] - boneOrigin[2])
        .multiply(rotationMatrix(mesh.rotation))
      const place = (p: Vec3): Vec3 => {
        const q = m.transformPoint(new DOMPoint(p[0], p[1], p[2]))
        return [q.x * UNIT, q.y * UNIT, q.z * UNIT]
      }
      meshQuads(model, mesh, place, (v) => applyDir(m, v)).forEach(add)
    }
    for (const cube of cubes) {
      const m = new DOMMatrix()
        .translate(cube.origin[0] - boneOrigin[0], cube.origin[1] - boneOrigin[1], cube.origin[2] - boneOrigin[2])
        .multiply(rotationMatrix(cube.rotation))
      const place = (p: Vec3): Vec3 => {
        const q = m.transformPoint(new DOMPoint(p[0] - cube.origin[0], p[1] - cube.origin[1], p[2] - cube.origin[2]))
        return [q.x * UNIT, q.y * UNIT, q.z * UNIT]
      }
      quads(model, cube, place, (v) => applyDir(m, v)).forEach(add)
    }
    if (!groups.size) return null
    const primitives = [...groups.entries()].map(([material, qs]) => {
      // every face is a fan from its first corner; corners run clockwise, so each triangle is (0, i+1, i)
      const corners = qs.reduce((n, q) => n + q.points.length, 0)
      const pos = new Float32Array(corners * 3)
      const nor = new Float32Array(corners * 3)
      const uv = new Float32Array(corners * 2)
      const idx = new Uint32Array(qs.reduce((n, q) => n + (q.points.length - 2) * 3, 0))
      let at = 0
      let ti = 0
      for (const q of qs) {
        q.points.forEach((p, c) => {
          pos.set(p, (at + c) * 3)
          nor.set(q.normal, (at + c) * 3)
          uv.set(frameOne(model, q, q.uv[c]), (at + c) * 2)
        })
        for (let c = 1; c < q.points.length - 1; c++) {
          idx.set([at, at + c + 1, at + c], ti)
          ti += 3
        }
        at += q.points.length
      }
      return {
        attributes: {
          POSITION: accessor(pos, 'VEC3', 34962, true),
          NORMAL: accessor(nor, 'VEC3', 34962),
          TEXCOORD_0: accessor(uv, 'VEC2', 34962),
        },
        indices: accessor(idx, 'SCALAR', 34963),
        material,
      }
    })
    meshes.push({ name, primitives })
    return meshes.length - 1
  }
  const meshesOf = new Map<string, Mesh[]>()
  const looseMeshes: Mesh[] = []
  for (const m of model.meshes ?? []) {
    if (m.parent && nodeOf.has(m.parent)) meshesOf.set(m.parent, [...(meshesOf.get(m.parent) ?? []), m])
    else looseMeshes.push(m)
  }
  flat.forEach((f, i) => {
    const mesh = meshFor(cubesOf.get(f.bone.id) ?? [], f.bone.origin, f.bone.name, meshesOf.get(f.bone.id))
    if (mesh !== null) nodes[i].mesh = mesh
  })
  const roots = model.bones.map((b) => nodeOf.get(b.id)!)
  if (loose.length || looseMeshes.length) {
    const mesh = meshFor(loose, [0, 0, 0], 'loose', looseMeshes)
    if (mesh !== null) {
      nodes.push({ name: 'loose cubes', mesh })
      roots.push(nodes.length - 1)
    }
  }

  // each clip, sampled so every easing (and IK) comes out as it plays here
  const animations = model.clips.map((clip) => {
    const fps = clip.snapping > 0 ? clip.snapping : 24
    const frames = Math.max(1, Math.round(clip.length * fps))
    const times = new Float32Array(frames + 1).map((_, i) => Math.min(clip.length, i / fps))
    const input = accessor(times, 'SCALAR', undefined, true)
    const poses = Array.from(times, (t) => posedAt(model, clip, t))
    const channels: unknown[] = []
    const samplers: unknown[] = []
    for (const f of flat) {
      const keyed = new Set(clip.tracks.filter((t) => t.bone === f.bone.id).map((t) => t.channel))
      const ik = (model.nulls ?? []).some((n) => n.ikTarget)
      if (!keyed.size && !ik) continue
      const node = nodeOf.get(f.bone.id)!
      const parentOrigin = f.parent?.origin ?? [0, 0, 0]
      const add = (path: 'translation' | 'rotation' | 'scale', values: Float32Array, type: 'VEC3' | 'VEC4') => {
        samplers.push({ input, output: accessor(values, type), interpolation: 'LINEAR' })
        channels.push({ sampler: samplers.length - 1, target: { node, path } })
      }
      if (keyed.has('position')) {
        const v = new Float32Array(poses.length * 3)
        poses.forEach((p, i) => {
          const pos = p[f.bone.id]?.position ?? [0, 0, 0]
          v.set([0, 1, 2].map((a) => (f.bone.origin[a] - parentOrigin[a] + pos[a]) * UNIT), i * 3)
        })
        add('translation', v, 'VEC3')
      }
      if (keyed.has('rotation') || ik) {
        const v = new Float32Array(poses.length * 4)
        poses.forEach((p, i) => {
          const r = p[f.bone.id]?.rotation ?? [0, 0, 0]
          v.set(quatOf([f.bone.rotation[0] + r[0], f.bone.rotation[1] + r[1], f.bone.rotation[2] + r[2]]), i * 4)
        })
        add('rotation', v, 'VEC4')
      }
      if (keyed.has('scale')) {
        const v = new Float32Array(poses.length * 3)
        poses.forEach((p, i) => v.set(p[f.bone.id]?.scale ?? [1, 1, 1], i * 3))
        add('scale', v, 'VEC3')
      }
    }
    return { name: clip.name.split('.').pop() || clip.name, channels, samplers }
  }).filter((a) => a.channels.length)

  const bin = new Uint8Array(byteLength)
  let at = 0
  for (const b of bins) {
    bin.set(b, at)
    at += b.byteLength
  }
  let b64 = ''
  for (let i = 0; i < bin.length; i += 0x8000) b64 += String.fromCharCode(...bin.subarray(i, i + 0x8000))
  const gltf = {
    asset: { version: '2.0', generator: 'Vellum' },
    scene: 0,
    scenes: [{ name: model.name, nodes: roots }],
    nodes,
    meshes,
    materials,
    ...(textures.length ? { textures, images, samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }] } : {}),
    ...(animations.length ? { animations } : {}),
    buffers: [{ byteLength, uri: `data:application/octet-stream;base64,${btoa(b64)}` }],
    bufferViews,
    accessors,
  }
  return JSON.stringify(gltf)
}

/* ---------------- OBJ ---------------- */

/**
 * The rest pose as Wavefront OBJ, one object per cube, zipped with its .mtl
 * and the textures as PNGs.
 */
export function toObjZip(model: Model): Uint8Array {
  const rig = buildRig(model)
  const stem = safeId(model.name) || 'model'
  const lines = [`# ${model.name}, from Vellum`, `mtllib ${stem}.mtl`]
  const mtl: string[] = []
  const pngs: Array<{ path: string; bytes: Uint8Array }> = []
  const matName = new Map<string | null, string>()
  for (const t of model.textures) {
    const name = safeId(t.name.replace(/\.png$/i, '')) || 'texture'
    matName.set(t.id, name)
    mtl.push(`newmtl ${name}`, 'Ka 1 1 1', 'Kd 1 1 1', 'Ks 0 0 0', 'd 1', 'illum 1')
    const bytes = t.source ? dataUriBytes(t.source) : null
    if (bytes) {
      mtl.push(`map_Kd ${name}.png`, `map_d ${name}.png`)
      pngs.push({ path: `${name}.png`, bytes })
    }
    mtl.push('')
  }
  mtl.push('newmtl untextured', 'Kd 0.7 0.7 0.7', 'illum 1', '')
  let v = 0
  let vt = 0
  let vn = 0
  // OBJ wants counter-clockwise from outside; the corners come clockwise, so the first stays and the rest reverse
  const faceLine = (n: number) => `f ${[0, ...Array.from({ length: n - 1 }, (_, i) => n - 1 - i)].map((i) => `${v + i + 1}/${vt + i + 1}/${vn}`).join(' ')}`
  for (const cube of model.cubes) {
    const frame = cubeFrame(rig, cube)
    const place = (p: Vec3): Vec3 => {
      const q = frame.transformPoint(new DOMPoint(p[0] - cube.origin[0], p[1] - cube.origin[1], p[2] - cube.origin[2]))
      return [q.x * UNIT, q.y * UNIT, q.z * UNIT]
    }
    lines.push(`o ${safeId(cube.name) || 'cube'}`)
    let current = ''
    for (const q of quads(model, cube, place, (d) => applyDir(frame, d))) {
      const mat = matName.get(q.texture) ?? 'untextured'
      if (mat !== current) {
        lines.push(`usemtl ${mat}`)
        current = mat
      }
      for (const p of q.points) lines.push(`v ${p.map((x) => +x.toFixed(6)).join(' ')}`)
      for (const [s, t] of q.uv.map((p) => frameOne(model, q, p))) lines.push(`vt ${+s.toFixed(6)} ${+(1 - t).toFixed(6)}`)
      lines.push(`vn ${q.normal.map((x) => +x.toFixed(6)).join(' ')}`)
      vn++
      lines.push(faceLine(4))
      v += 4
      vt += 4
    }
  }
  for (const mesh of model.meshes ?? []) {
    const frame = meshFrame(rig, mesh)
    const place = (p: Vec3): Vec3 => {
      const q = frame.transformPoint(new DOMPoint(p[0], p[1], p[2]))
      return [q.x * UNIT, q.y * UNIT, q.z * UNIT]
    }
    lines.push(`o ${safeId(mesh.name) || 'mesh'}`)
    let current = ''
    for (const q of meshQuads(model, mesh, place, (d) => applyDir(frame, d))) {
      const mat = matName.get(q.texture) ?? 'untextured'
      if (mat !== current) {
        lines.push(`usemtl ${mat}`)
        current = mat
      }
      for (const p of q.points) lines.push(`v ${p.map((x) => +x.toFixed(6)).join(' ')}`)
      for (const [s2, t] of q.uv.map((p) => frameOne(model, q, p))) lines.push(`vt ${+s2.toFixed(6)} ${+(1 - t).toFixed(6)}`)
      lines.push(`vn ${q.normal.map((x) => +x.toFixed(6)).join(' ')}`)
      vn++
      lines.push(faceLine(q.points.length))
      v += q.points.length
      vt += q.points.length
    }
  }
  const enc = new TextEncoder()
  return makeZip([
    { path: `${stem}.obj`, bytes: enc.encode(lines.join('\n') + '\n') },
    { path: `${stem}.mtl`, bytes: enc.encode(mtl.join('\n')) },
    ...pngs,
  ])
}

/* ---------------- Java Edition ---------------- */

/** The model as a Java block or item model, with the textures named under `namespace`. */
export function toJavaJson(model: Model, folder: 'item' | 'block', namespace = 'vellum'): { name: string; text: string; issues: string[] } {
  const { json, issues } = toMinecraftModel(model, namespace, folder)
  return {
    name: `${safeId(model.name) || 'model'}.json`,
    text: JSON.stringify(json, null, 2) + '\n',
    issues: issues.map((i) => i.message),
  }
}
