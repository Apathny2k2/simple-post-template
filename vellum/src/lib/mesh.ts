/* Meshes: Blockbench's free-form elements. Geometry helpers the renderer,
   the exporters and the editing tools share, the primitives, and the edits
   (move vertices, extrude, delete, merge, flip). Vertices are offsets from
   the mesh's origin; UVs are in UV units like a cube face's. */

import { FACES } from './model'
import type { Cube, FaceKey, Mesh, MeshFace, Model, UVRect, Vec3 } from './model'
import { newId } from './new-model'

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const addV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const unit = (a: Vec3): Vec3 => {
  const l = length(a)
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0]
}

/** Newell's normal: the area-weighted normal of a polygon, whatever its winding quality. */
function newell(ps: Vec3[]): Vec3 {
  const n: Vec3 = [0, 0, 0]
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i]
    const b = ps[(i + 1) % ps.length]
    n[0] += (a[1] - b[1]) * (a[2] + b[2])
    n[1] += (a[2] - b[2]) * (a[0] + b[0])
    n[2] += (a[0] - b[0]) * (a[1] + b[1])
  }
  return n
}

/**
 * A face's vertex keys in drawing order. A quad's four vertices can be
 * stored in any order. An order whose edges cross encloses less area than
 * one whose edges don't, so the order with most area is taken, turned to
 * face the way the first three vertices do.
 */
export function faceOrder(mesh: Mesh, face: MeshFace): string[] {
  const keys = face.vertices.filter((k) => mesh.vertices[k])
  if (keys.length !== 4) return keys
  const p = keys.map((k) => mesh.vertices[k])
  const n0 = cross(sub(p[1], p[0]), sub(p[2], p[0]))
  const orders = [
    [0, 1, 2, 3],
    [0, 1, 3, 2],
    [0, 2, 1, 3],
  ]
  let best = orders[0]
  let area = -1
  for (const o of orders) {
    const a = length(newell(o.map((i) => p[i])))
    if (a > area + 1e-9) {
      area = a
      best = o
    }
  }
  const sorted = best.map((i) => keys[i])
  return dot(newell(best.map((i) => p[i])), n0) < 0 ? [sorted[0], ...sorted.slice(1).reverse()] : sorted
}

/** The outward normal of a face, unit length; the zero vector for a degenerate one. */
export function faceNormal(mesh: Mesh, face: MeshFace): Vec3 {
  return unit(newell(faceOrder(mesh, face).map((k) => mesh.vertices[k])))
}

export function faceCentre(mesh: Mesh, face: MeshFace): Vec3 {
  const ps = face.vertices.map((k) => mesh.vertices[k]).filter(Boolean)
  return ps.length ? scale(ps.reduce(addV, [0, 0, 0] as Vec3), 1 / ps.length) : [0, 0, 0]
}

/**
 * A face laid flat: an origin and two in-plane axes (e1, e2, with e1 × e2
 * along the normal), and each vertex's 2D position in that plane, in
 * drawing order. The renderer places a div with this basis and clips it to
 * the polygon.
 */
export function faceBasis(mesh: Mesh, face: MeshFace) {
  const keys = faceOrder(mesh, face)
  const ps = keys.map((k) => mesh.vertices[k])
  const n = unit(newell(ps))
  // the longest edge from the first vertex gives a steady in-plane axis
  let e1: Vec3 = [0, 0, 0]
  for (let i = 1; i < ps.length && length(e1) < 1e-9; i++) e1 = unit(sub(ps[i], ps[0]))
  const e2 = unit(cross(n, e1))
  const flat = ps.map((p) => {
    const d = sub(p, ps[0])
    return [dot(d, e1), dot(d, e2)] as [number, number]
  })
  return { keys, origin: ps[0], e1, e2, n, flat }
}

/**
 * The affine map from a face's UVs to its flat positions, solved from its
 * first three vertices that aren't in a line: [x, y] = A·[u, v] + t. Null
 * when every UV is on one line, which leaves the face untextured.
 */
export function uvToFlat(uvs: Array<[number, number]>, flat: Array<[number, number]>): { a: number; b: number; c: number; d: number; tx: number; ty: number } | null {
  for (let i = 1; i < uvs.length - 1; i++) {
    for (let j = i + 1; j < uvs.length; j++) {
      const [u0, v0] = uvs[0]
      const du1 = uvs[i][0] - u0
      const dv1 = uvs[i][1] - v0
      const du2 = uvs[j][0] - u0
      const dv2 = uvs[j][1] - v0
      const det = du1 * dv2 - du2 * dv1
      if (Math.abs(det) < 1e-9) continue
      const dx1 = flat[i][0] - flat[0][0]
      const dy1 = flat[i][1] - flat[0][1]
      const dx2 = flat[j][0] - flat[0][0]
      const dy2 = flat[j][1] - flat[0][1]
      // [dx1 dx2; dy1 dy2] = M · [du1 du2; dv1 dv2]
      const a = (dx1 * dv2 - dx2 * dv1) / det
      const c = (dx2 * du1 - dx1 * du2) / det
      const b = (dy1 * dv2 - dy2 * dv1) / det
      const d = (dy2 * du1 - dy1 * du2) / det
      return { a, b, c, d, tx: flat[0][0] - a * u0 - c * v0, ty: flat[0][1] - b * u0 - d * v0 }
    }
  }
  return null
}

/** Minecraft-style shading for a face pointing along `n`: top 1, sides 0.8 and 0.6, bottom 0.5, blended. */
export function shadeOf(n: Vec3): number {
  const [x, y, z] = n
  return x * x * 0.6 + z * z * 0.8 + y * y * (y > 0 ? 1 : 0.5)
}

/* ---------------- primitives ---------------- */

export type Primitive = 'cube' | 'plane' | 'pyramid' | 'cylinder' | 'cone' | 'sphere'

export const PRIMITIVES: Array<{ id: Primitive; label: string }> = [
  { id: 'cube', label: 'Cube' },
  { id: 'plane', label: 'Plane' },
  { id: 'pyramid', label: 'Pyramid' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'cone', label: 'Cone' },
  { id: 'sphere', label: 'Sphere' },
]

type Draft = { vertices: Vec3[]; faces: number[][] }

function draft(kind: Primitive, size: number, sides: number): Draft {
  const h = size / 2
  switch (kind) {
    case 'plane':
      return { vertices: [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h]], faces: [[0, 3, 2, 1]] }
    case 'pyramid':
      return {
        vertices: [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h], [0, size, 0]],
        faces: [[0, 1, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]],
      }
    case 'cylinder':
    case 'cone': {
      const vs: Vec3[] = []
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        vs.push([Math.round(Math.cos(a) * h * 1000) / 1000, 0, Math.round(Math.sin(a) * h * 1000) / 1000])
      }
      const faces: number[][] = [[...vs.keys()]]
      if (kind === 'cone') {
        vs.push([0, size, 0])
        for (let i = 0; i < sides; i++) faces.push([i, sides, (i + 1) % sides])
      } else {
        for (let i = 0; i < sides; i++) vs.push([vs[i][0], size, vs[i][2]])
        faces.push([...Array(sides).keys()].map((i) => sides + (sides - 1 - i)))
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides
          faces.push([i, sides + i, sides + j, j])
        }
      }
      return { vertices: vs, faces }
    }
    case 'sphere': {
      const rings = Math.max(3, Math.round(sides / 2))
      const vs: Vec3[] = [[0, -h, 0]]
      for (let r = 1; r < rings; r++) {
        const phi = (r / rings) * Math.PI
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2
          vs.push([
            Math.round(Math.sin(phi) * Math.cos(a) * h * 1000) / 1000,
            Math.round(-Math.cos(phi) * h * 1000) / 1000,
            Math.round(Math.sin(phi) * Math.sin(a) * h * 1000) / 1000,
          ])
        }
      }
      vs.push([0, h, 0])
      const top = vs.length - 1
      const at = (r: number, i: number) => 1 + (r - 1) * sides + (i % sides)
      const faces: number[][] = []
      for (let i = 0; i < sides; i++) faces.push([0, at(1, i), at(1, i + 1)])
      for (let r = 1; r < rings - 1; r++) for (let i = 0; i < sides; i++) faces.push([at(r, i), at(r + 1, i), at(r + 1, i + 1), at(r, i + 1)])
      for (let i = 0; i < sides; i++) faces.push([at(rings - 1, i), top, at(rings - 1, i + 1)])
      return { vertices: vs.map((v) => [v[0], v[1] + h, v[2]] as Vec3), faces }
    }
    default:
      return {
        vertices: [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h], [-h, size, -h], [h, size, -h], [h, size, h], [-h, size, h]],
        faces: [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]],
      }
  }
}

/**
 * A new mesh primitive, `size` units across, standing on its origin. Each
 * face's UVs are its own outline laid flat at one texel per unit, packed
 * into free room on the sheet by `place` (given each face's flat size).
 */
export function makeMesh(
  kind: Primitive,
  opts: { name?: string; parent: string | null; origin: Vec3; size?: number; sides?: number; texture: string | null; place: (w: number, h: number) => [number, number] },
): Mesh {
  const d = draft(kind, opts.size ?? 8, opts.sides ?? 8)
  const keys = d.vertices.map(() => newId().slice(0, 8))
  const vertices = Object.fromEntries(keys.map((k, i) => [k, d.vertices[i]])) as Record<string, Vec3>
  const mesh: Mesh = { id: newId(), name: opts.name ?? kind, parent: opts.parent, origin: opts.origin, rotation: [0, 0, 0], vertices, faces: {}, visible: true, locked: false }
  for (const f of d.faces) {
    const face: MeshFace = { vertices: f.map((i) => keys[i]), uv: {}, texture: opts.texture }
    mesh.faces[newId().slice(0, 8)] = face
  }
  return projectUv(mesh, Object.keys(mesh.faces), opts.place)
}

/** Lays faces out flat (one texel per unit) and packs each where `place` says. */
export function projectUv(mesh: Mesh, faceKeys: string[], place: (w: number, h: number) => [number, number]): Mesh {
  const faces = { ...mesh.faces }
  for (const k of faceKeys) {
    const f = faces[k]
    if (!f) continue
    const { keys, flat } = faceBasis(mesh, f)
    const xs = flat.map((p) => p[0])
    const ys = flat.map((p) => p[1])
    const [x0, y1] = [Math.min(...xs), Math.max(...ys)]
    const w = Math.max(1, Math.ceil(Math.max(...xs) - x0))
    const h = Math.max(1, Math.ceil(y1 - Math.min(...ys)))
    const [ox, oy] = place(w, h)
    // flat y runs up the face; the sheet's v runs down
    const uv = Object.fromEntries(keys.map((key, i) => [key, [round(ox + flat[i][0] - x0), round(oy + (y1 - flat[i][1]))] as [number, number]]))
    faces[k] = { ...f, uv }
  }
  return { ...mesh, faces }
}

const round = (v: number) => Math.round(v * 1000) / 1000

/** Each face's UV bounds, for packing other things around them. */
export function meshUvRects(model: Model): UVRect[] {
  const out: UVRect[] = []
  for (const m of model.meshes ?? []) {
    for (const f of Object.values(m.faces)) {
      const uvs = Object.values(f.uv)
      if (!uvs.length) continue
      const us = uvs.map((p) => p[0])
      const vs = uvs.map((p) => p[1])
      out.push([Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)])
    }
  }
  return out
}

/* ---------------- edits ---------------- */

/** Moves vertices by `delta`, given in the mesh's own (unturned) frame. */
export function moveVertices(mesh: Mesh, keys: readonly string[], delta: Vec3): Mesh {
  const set = new Set(keys)
  const vertices = { ...mesh.vertices }
  for (const k of set) if (vertices[k]) vertices[k] = addV(vertices[k], delta).map(round) as Vec3
  return { ...mesh, vertices }
}

/** The vertices of some faces, once each. */
export function verticesOf(mesh: Mesh, faceKeys: readonly string[]): string[] {
  return [...new Set(faceKeys.flatMap((k) => mesh.faces[k]?.vertices ?? []))]
}

/** Removes faces, then the vertices left without a face. */
export function deleteFaces(mesh: Mesh, faceKeys: readonly string[]): Mesh {
  const gone = new Set(faceKeys)
  const faces = Object.fromEntries(Object.entries(mesh.faces).filter(([k]) => !gone.has(k)))
  const used = new Set(Object.values(faces).flatMap((f) => f.vertices))
  const vertices = Object.fromEntries(Object.entries(mesh.vertices).filter(([k]) => used.has(k)))
  return { ...mesh, faces, vertices }
}

/** Removes vertices and every face that used one of them. */
export function deleteVertices(mesh: Mesh, keys: readonly string[]): Mesh {
  const gone = new Set(keys)
  return deleteFaces(mesh, Object.entries(mesh.faces).filter(([, f]) => f.vertices.some((v) => gone.has(v))).map(([k]) => k))
}

/** Turns faces round, so their front is their back. */
export function flipFaces(mesh: Mesh, faceKeys: readonly string[]): Mesh {
  const faces = { ...mesh.faces }
  for (const k of faceKeys) {
    const f = faces[k]
    if (!f) continue
    const order = faceOrder(mesh, f)
    faces[k] = { ...f, vertices: [order[0], ...order.slice(1).reverse()] }
  }
  return { ...mesh, faces }
}

/** Merges vertices into one at their middle; faces left with fewer than three vertices go. */
export function mergeVertices(mesh: Mesh, keys: readonly string[]): { mesh: Mesh; kept: string | null } {
  const live = keys.filter((k) => mesh.vertices[k])
  if (live.length < 2) return { mesh, kept: live[0] ?? null }
  const [keep, ...rest] = live
  const mid = scale(live.map((k) => mesh.vertices[k]).reduce(addV, [0, 0, 0] as Vec3), 1 / live.length).map(round) as Vec3
  const drop = new Set(rest)
  const vertices = Object.fromEntries(Object.entries(mesh.vertices).filter(([k]) => !drop.has(k)))
  vertices[keep] = mid
  const faces: Record<string, MeshFace> = {}
  for (const [fk, f] of Object.entries(mesh.faces)) {
    const vs: string[] = []
    for (const v of f.vertices.map((x) => (drop.has(x) ? keep : x))) if (vs[vs.length - 1] !== v) vs.push(v)
    if (vs.length > 1 && vs[0] === vs[vs.length - 1]) vs.pop()
    if (new Set(vs).size < 3) continue
    const uv: Record<string, [number, number]> = {}
    for (const v of vs) uv[v] = f.uv[v] ?? f.uv[f.vertices.find((x) => (drop.has(x) ? keep : x) === v) ?? v] ?? [0, 0]
    faces[fk] = { ...f, vertices: vs, uv }
  }
  return { mesh: { ...mesh, vertices, faces }, kept: keep }
}

/**
 * Extrudes faces along their average normal by `distance`: the faces move
 * out, and a quad joins each open edge of the region to where it started.
 * Returns the moved faces' keys, so they stay selected.
 */
export function extrudeFaces(mesh: Mesh, faceKeys: readonly string[], distance: number): { mesh: Mesh; faces: string[] } {
  const keys = faceKeys.filter((k) => mesh.faces[k])
  if (!keys.length) return { mesh, faces: [] }
  const n = unit(keys.map((k) => faceNormal(mesh, mesh.faces[k])).reduce(addV, [0, 0, 0] as Vec3))
  // an edge is open when only one selected face uses it
  const edgeCount = new Map<string, number>()
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (const k of keys) {
    const order = faceOrder(mesh, mesh.faces[k])
    order.forEach((a, i) => {
      const e = edgeKey(a, order[(i + 1) % order.length])
      edgeCount.set(e, (edgeCount.get(e) ?? 0) + 1)
    })
  }
  const vertices = { ...mesh.vertices }
  const copy = new Map<string, string>()
  for (const v of verticesOf(mesh, keys)) {
    const nk = newId().slice(0, 8)
    copy.set(v, nk)
    vertices[nk] = addV(mesh.vertices[v], scale(n, distance)).map(round) as Vec3
  }
  const faces = { ...mesh.faces }
  for (const k of keys) {
    const f = mesh.faces[k]
    const order = faceOrder(mesh, f)
    order.forEach((a, i) => {
      const b = order[(i + 1) % order.length]
      if (edgeCount.get(edgeKey(a, b)) !== 1) return
      // the side runs a → b along the old edge, then back along the new one
      const side = [a, b, copy.get(b)!, copy.get(a)!]
      faces[newId().slice(0, 8)] = { vertices: side, uv: { [side[0]]: f.uv[a] ?? [0, 0], [side[1]]: f.uv[b] ?? [0, 0], [side[2]]: f.uv[b] ?? [0, 0], [side[3]]: f.uv[a] ?? [0, 0] }, texture: f.texture }
    })
    faces[k] = { ...f, vertices: f.vertices.map((v) => copy.get(v)!), uv: Object.fromEntries(f.vertices.map((v) => [copy.get(v)!, f.uv[v] ?? [0, 0]])) }
  }
  // the old vertices that only the moved faces used are left behind for the sides
  return { mesh: { ...mesh, vertices, faces }, faces: keys }
}

/** The middle of some vertices in the mesh's own frame. */
export function centreOf(mesh: Mesh, keys: readonly string[]): Vec3 {
  const ps = keys.map((k) => mesh.vertices[k]).filter(Boolean)
  return ps.length ? scale(ps.reduce(addV, [0, 0, 0] as Vec3), 1 / ps.length) : [0, 0, 0]
}

/* ---------------- edges ---------------- */

/** An edge's key: its two vertex keys in sorted order, so either direction names it. */
export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
export const edgeEnds = (key: string) => key.split('|') as [string, string]

/** Every edge of the mesh once, from its faces' outlines. */
export function edgesOf(mesh: Mesh): string[] {
  const out = new Set<string>()
  for (const f of Object.values(mesh.faces)) {
    const o = faceOrder(mesh, f)
    o.forEach((a, i) => out.add(edgeKey(a, o[(i + 1) % o.length])))
  }
  return [...out]
}

/** The vertices of some edges, once each. */
export function edgeVerticesOf(edges: readonly string[]): string[] {
  return [...new Set(edges.flatMap(edgeEnds))]
}

/** Removes every face that uses one of the edges, then vertices left without a face. */
export function deleteEdges(mesh: Mesh, edges: readonly string[]): Mesh {
  const set = new Set(edges)
  return deleteFaces(
    mesh,
    Object.entries(mesh.faces)
      .filter(([, f]) => {
        const o = faceOrder(mesh, f)
        return o.some((a, i) => set.has(edgeKey(a, o[(i + 1) % o.length])))
      })
      .map(([k]) => k),
  )
}

const mid = (a: Vec3, b: Vec3): Vec3 => [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2), round((a[2] + b[2]) / 2)]
const midUv = (a: [number, number] | undefined, b: [number, number] | undefined): [number, number] => {
  const p = a ?? [0, 0]
  const q = b ?? [0, 0]
  return [round((p[0] + q[0]) / 2), round((p[1] + q[1]) / 2)]
}

/**
 * Puts each new middle vertex into faces that weren't split but share the
 * edge it sits on, so no face is left with a gap along that edge.
 */
function stitch(mesh: Mesh, faces: Record<string, MeshFace>, mids: ReadonlyMap<string, string>, skip: ReadonlySet<string>) {
  for (const [k, f] of Object.entries(faces)) {
    if (skip.has(k)) continue
    const o = faceOrder(mesh, f)
    const next: string[] = []
    const uv = { ...f.uv }
    let changed = false
    o.forEach((a, i) => {
      const b = o[(i + 1) % o.length]
      next.push(a)
      const m = mids.get(edgeKey(a, b))
      if (m) {
        next.push(m)
        uv[m] = midUv(f.uv[a], f.uv[b])
        changed = true
      }
    })
    if (changed) faces[k] = { ...f, vertices: next, uv }
  }
}

/**
 * Blender's and Blockbench's loop cut: a new ring of edges across the quads
 * that the picked edge's ring runs through. The ring goes from the edge to
 * the opposite side of each quad, and on into the next quad, both ways,
 * until it meets a face that isn't a quad or comes round to its start.
 * Each quad on the ring splits in two through the middles of its two ring
 * edges. Returns the new edges, so they can be picked.
 */
export function loopCut(mesh: Mesh, start: string): { mesh: Mesh; edges: string[] } {
  const facesOn = new Map<string, string[]>()
  const orders = new Map<string, string[]>()
  for (const [k, f] of Object.entries(mesh.faces)) {
    const o = faceOrder(mesh, f)
    orders.set(k, o)
    o.forEach((a, i) => {
      const e = edgeKey(a, o[(i + 1) % o.length])
      facesOn.set(e, [...(facesOn.get(e) ?? []), k])
    })
  }
  if (!facesOn.has(start)) return { mesh, edges: [] }
  // each ring quad, turned so its incoming ring edge is its first edge
  const ring: Array<{ face: string; order: string[] }> = []
  const seen = new Set<string>()
  for (const first of facesOn.get(start) ?? []) {
    let edge = start
    let face: string | undefined = first
    while (face && !seen.has(face)) {
      const o = orders.get(face)!
      if (o.length !== 4) break
      const i = o.findIndex((a, j) => edgeKey(a, o[(j + 1) % 4]) === edge)
      if (i < 0) break
      const turned = [o[i], o[(i + 1) % 4], o[(i + 2) % 4], o[(i + 3) % 4]]
      seen.add(face)
      ring.push({ face, order: turned })
      edge = edgeKey(turned[2], turned[3])
      face = (facesOn.get(edge) ?? []).find((x) => x !== face)
    }
  }
  if (!ring.length) return { mesh, edges: [] }
  const vertices = { ...mesh.vertices }
  const mids = new Map<string, string>()
  const midOf = (a: string, b: string) => {
    const e = edgeKey(a, b)
    let m = mids.get(e)
    if (!m) {
      m = newId().slice(0, 8)
      mids.set(e, m)
      vertices[m] = mid(mesh.vertices[a], mesh.vertices[b])
    }
    return m
  }
  const faces = { ...mesh.faces }
  const made: string[] = []
  for (const { face, order: [p0, p1, p2, p3] } of ring) {
    const f = mesh.faces[face]
    const ma = midOf(p0, p1)
    const mb = midOf(p2, p3)
    const uvA = midUv(f.uv[p0], f.uv[p1])
    const uvB = midUv(f.uv[p2], f.uv[p3])
    faces[face] = { ...f, vertices: [p0, ma, mb, p3], uv: { [p0]: f.uv[p0] ?? [0, 0], [ma]: uvA, [mb]: uvB, [p3]: f.uv[p3] ?? [0, 0] } }
    faces[newId().slice(0, 8)] = { ...f, vertices: [ma, p1, p2, mb], uv: { [ma]: uvA, [p1]: f.uv[p1] ?? [0, 0], [p2]: f.uv[p2] ?? [0, 0], [mb]: uvB } }
    made.push(edgeKey(ma, mb))
  }
  stitch(mesh, faces, mids, new Set(ring.map((r) => r.face)))
  return { mesh: { ...mesh, vertices, faces }, edges: [...new Set(made)] }
}

/**
 * Splits faces (all of them when none are given) into quads: one per corner,
 * through the middles of its edges and the face's middle. Middles are shared
 * between faces, and faces next to the split ones take the new middles on
 * their shared edges, so the surface stays closed.
 */
export function subdivide(mesh: Mesh, faceKeys?: readonly string[]): Mesh {
  const keys = (faceKeys?.length ? faceKeys : Object.keys(mesh.faces)).filter((k) => mesh.faces[k])
  const vertices = { ...mesh.vertices }
  const mids = new Map<string, string>()
  const midOf = (a: string, b: string) => {
    const e = edgeKey(a, b)
    let m = mids.get(e)
    if (!m) {
      m = newId().slice(0, 8)
      mids.set(e, m)
      vertices[m] = mid(mesh.vertices[a], mesh.vertices[b])
    }
    return m
  }
  const faces = { ...mesh.faces }
  for (const k of keys) {
    const f = mesh.faces[k]
    const o = faceOrder(mesh, f)
    const n = o.length
    const c = newId().slice(0, 8)
    vertices[c] = centreOf(mesh, o).map(round) as Vec3
    const cuv: [number, number] = [round(o.reduce((s, v) => s + (f.uv[v]?.[0] ?? 0), 0) / n), round(o.reduce((s, v) => s + (f.uv[v]?.[1] ?? 0), 0) / n)]
    delete faces[k]
    o.forEach((v, i) => {
      const next = o[(i + 1) % n]
      const prev = o[(i - 1 + n) % n]
      const mn = midOf(v, next)
      const mp = midOf(prev, v)
      faces[i === 0 ? k : newId().slice(0, 8)] = {
        ...f,
        vertices: [v, mn, c, mp],
        uv: { [v]: f.uv[v] ?? [0, 0], [mn]: midUv(f.uv[v], f.uv[next]), [c]: cuv, [mp]: midUv(f.uv[prev], f.uv[v]) },
      }
    })
  }
  stitch(mesh, faces, mids, new Set(Object.keys(faces).filter((k) => !mesh.faces[k] || keys.includes(k))))
  return { ...mesh, vertices, faces }
}

/* ---------------- UVs ---------------- */

/** The UV bounds of some faces: [u0, v0, u1, v1]. */
export function uvBoundsOf(mesh: Mesh, faceKeys: readonly string[]): [number, number, number, number] {
  const pts = faceKeys.flatMap((k) => Object.values(mesh.faces[k]?.uv ?? {}))
  if (!pts.length) return [0, 0, 0, 0]
  const us = pts.map((p) => p[0])
  const vs = pts.map((p) => p[1])
  return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)]
}

/** Runs `fn` over every UV corner of the given faces. */
function mapUv(mesh: Mesh, faceKeys: readonly string[], fn: (p: [number, number]) => [number, number]): Mesh {
  const faces = { ...mesh.faces }
  for (const k of faceKeys) {
    const f = faces[k]
    if (!f) continue
    faces[k] = { ...f, uv: Object.fromEntries(Object.entries(f.uv).map(([v, p]) => [v, fn(p).map(round) as [number, number]])) }
  }
  return { ...mesh, faces }
}

/** Moves the faces' UVs by (du, dv). */
export function moveFacesUvBy(mesh: Mesh, faceKeys: readonly string[], du: number, dv: number): Mesh {
  return mapUv(mesh, faceKeys, ([u, v]) => [u + du, v + dv])
}

/** Moves one corner of one face on the sheet; the vertex keeps its other faces' UVs. */
export function moveUvCorner(mesh: Mesh, face: string, vertex: string, du: number, dv: number): Mesh {
  const f = mesh.faces[face]
  const p = f?.uv[vertex]
  if (!p) return mesh
  return { ...mesh, faces: { ...mesh.faces, [face]: { ...f, uv: { ...f.uv, [vertex]: [round(p[0] + du), round(p[1] + dv)] } } } }
}

/** Turns the faces' UVs a quarter clockwise on the sheet, about the middle of their bounds. */
export function turnFacesUv(mesh: Mesh, faceKeys: readonly string[]): Mesh {
  const [u0, v0, u1, v1] = uvBoundsOf(mesh, faceKeys)
  const cu = (u0 + u1) / 2
  const cv = (v0 + v1) / 2
  return mapUv(mesh, faceKeys, ([u, v]) => [cu - (v - cv), cv + (u - cu)])
}

/** Mirrors the faces' UVs across the middle of their bounds, left to right ('u') or top to bottom ('v'). */
export function mirrorFacesUv(mesh: Mesh, faceKeys: readonly string[], axis: 'u' | 'v'): Mesh {
  const [u0, v0, u1, v1] = uvBoundsOf(mesh, faceKeys)
  return mapUv(mesh, faceKeys, ([u, v]) => (axis === 'u' ? [u0 + u1 - u, v] : [u, v0 + v1 - v]))
}

/* ---------------- drawing a face exactly ---------------- */

/**
 * How to draw a face. One flat piece maps a texture by a single affine map,
 * which is exact for a triangle, and for a flat polygon only when its UVs
 * are the same shape as its outline (a parallelogram on a parallelogram).
 * Any other face (a quad bent out of its plane, or one whose UVs are a
 * trapezoid while its outline is a square) is drawn as triangles, each
 * with its own map, as a GPU would. `outer` marks which of a piece's edges
 * are the face's own, so the outline skips the diagonals.
 */
export function facePieces(mesh: Mesh, face: MeshFace): Array<{ keys: string[]; outer: boolean[] }> {
  const o = faceOrder(mesh, face)
  const whole = [{ keys: o, outer: o.map(() => true) }]
  if (o.length <= 3) return whole
  const { origin, n, flat } = faceBasis(mesh, face)
  const planar = o.every((k) => Math.abs(dot(sub(mesh.vertices[k], origin), n)) < 0.01)
  if (planar) {
    const map = uvToFlat(o.map((k) => face.uv[k] ?? [0, 0]), flat)
    const fits =
      !map ||
      o.every((k, i) => {
        const [u, v] = face.uv[k] ?? [0, 0]
        return Math.hypot(map.a * u + map.c * v + map.tx - flat[i][0], map.b * u + map.d * v + map.ty - flat[i][1]) < 0.02
      })
    if (fits) return whole
  }
  const count = o.length
  const tri = (i: number, j: number, k: number) => ({
    keys: [o[i], o[j], o[k]],
    outer: [(j - i + count) % count === 1, (k - j + count) % count === 1, (i - k + count) % count === 1],
  })
  if (count === 4) {
    // split along the shorter diagonal, as modelling tools do
    const p = o.map((k) => mesh.vertices[k])
    return length(sub(p[2], p[0])) <= length(sub(p[3], p[1])) ? [tri(0, 1, 2), tri(0, 2, 3)] : [tri(1, 2, 3), tri(1, 3, 0)]
  }
  return Array.from({ length: count - 2 }, (_, i) => tri(0, i + 1, i + 2))
}

/* ---------------- knife, bevel, slide, loops, fill, dissolve, inset ---------------- */

type UV = [number, number]
const key8 = () => newId().slice(0, 8)
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t), round(a[2] + (b[2] - a[2]) * t)]
const lerpUv = (a: UV | undefined, b: UV | undefined, t: number): UV => {
  const p = a ?? [0, 0]
  const q = b ?? p
  return [round(p[0] + (q[0] - p[0]) * t), round(p[1] + (q[1] - p[1]) * t)]
}
const pickUv = (f: MeshFace, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, f.uv[k] ?? [0, 0]])) as Record<string, UV>

/** Each edge's faces, by the faces' drawing order. */
function facesByEdge(mesh: Mesh, faces: Record<string, MeshFace> = mesh.faces) {
  const out = new Map<string, string[]>()
  for (const [k, f] of Object.entries(faces)) {
    const o = faceOrder(mesh, f)
    o.forEach((a, i) => {
      const e = edgeKey(a, o[(i + 1) % o.length])
      out.set(e, [...(out.get(e) ?? []), k])
    })
  }
  return out
}

/** True when a face's outline runs a → b. */
function runs(o: readonly string[], a: string, b: string) {
  const i = o.indexOf(a)
  return i >= 0 && o[(i + 1) % o.length] === b
}

/**
 * Puts new vertices on edges of the faces outside `skip`, between the
 * edge's ends, so no face keeps a gap where a neighbour was cut. `t` is
 * measured from `from`, and each new corner's UV is that far along the
 * face's own UVs.
 */
function insertOnEdges(mesh: Mesh, faces: Record<string, MeshFace>, inserts: ReadonlyMap<string, Array<{ v: string; from: string; t: number }>>, skip: ReadonlySet<string>) {
  if (!inserts.size) return
  for (const [k, f] of Object.entries(faces)) {
    if (skip.has(k)) continue
    const o = faceOrder(mesh, f)
    const next: string[] = []
    const uv = { ...f.uv }
    let changed = false
    o.forEach((a, i) => {
      const b = o[(i + 1) % o.length]
      next.push(a)
      const list = inserts.get(edgeKey(a, b))
      if (!list) return
      const along = list.map((x) => ({ v: x.v, s: x.from === a ? x.t : 1 - x.t })).sort((x, y) => x.s - y.s)
      for (const x of along) {
        if (next.includes(x.v)) continue
        next.push(x.v)
        uv[x.v] = lerpUv(f.uv[a], f.uv[b], x.s)
        changed = true
      }
    })
    if (changed) faces[k] = { ...f, vertices: next, uv }
  }
}

/** A point on an edge for the knife: `t` runs from the edge's first end (`edgeEnds(edge)[0]`) to its second. */
export type KnifePoint = { edge: string; t: number }

/**
 * Blender's knife, through edges: each point becomes a vertex on its edge
 * (or the corner it sits on), and each pair of points in a row that share
 * a face splits that face between them. Faces next to a cut edge take the
 * new vertex too. Returns the new edges.
 */
export function knifeCut(mesh: Mesh, points: readonly KnifePoint[]): { mesh: Mesh; edges: string[] } {
  const vertices = { ...mesh.vertices }
  const inserts = new Map<string, Array<{ v: string; from: string; t: number }>>()
  const at: string[] = []
  for (const p of points) {
    const [a, b] = edgeEnds(p.edge)
    if (!mesh.vertices[a] || !mesh.vertices[b]) continue
    let v: string
    if (p.t <= 0.02) v = a
    else if (p.t >= 0.98) v = b
    else {
      const list = inserts.get(p.edge) ?? []
      // the same spot on one edge twice is one vertex
      const same = list.find((x) => Math.abs(x.t - p.t) < 0.02)
      if (same) v = same.v
      else {
        v = key8()
        vertices[v] = lerp3(mesh.vertices[a], mesh.vertices[b], p.t)
        list.push({ v, from: a, t: p.t })
        inserts.set(p.edge, list)
      }
    }
    if (at[at.length - 1] !== v) at.push(v)
  }
  const cut: Mesh = { ...mesh, vertices }
  const faces = { ...mesh.faces }
  insertOnEdges(cut, faces, inserts, new Set())
  const made: string[] = []
  for (let i = 0; i + 1 < at.length; i++) {
    const p = at[i]
    const q = at[i + 1]
    for (const [fk, f] of Object.entries(faces)) {
      const o = faceOrder(cut, f)
      const ip = o.indexOf(p)
      const iq = o.indexOf(q)
      if (ip < 0 || iq < 0) continue
      const gap = (iq - ip + o.length) % o.length
      if (gap === 1 || gap === o.length - 1) continue
      const one = Array.from({ length: gap + 1 }, (_, j) => o[(ip + j) % o.length])
      const two = Array.from({ length: o.length - gap + 1 }, (_, j) => o[(iq + j) % o.length])
      faces[fk] = { ...f, vertices: one, uv: pickUv(f, one) }
      faces[key8()] = { ...f, vertices: two, uv: pickUv(f, two) }
      made.push(edgeKey(p, q))
      break
    }
  }
  return { mesh: { ...cut, faces }, edges: made }
}

/**
 * Bevels edges: each edge becomes a strip `width` wide, its two faces
 * pulled back from it along their other edges. At an end where three
 * faces meet, the third face loses its corner to a cut; where more meet,
 * a triangle fills the gap. Edges are bevelled one after another, and an
 * edge whose end an earlier bevel moved follows that end. The strip takes
 * its texture from the edge's first face, along the edge. Returns the
 * strip's long edges.
 */
export function bevelEdges(mesh: Mesh, edges: readonly string[], width: number): { mesh: Mesh; edges: string[] } {
  let m = mesh
  const made: string[] = []
  // the vertex an earlier bevel put on the edge from → to, near `from`
  const moved = new Map<string, string>()
  const follow = (v: string, other: string) => (m.vertices[v] ? v : moved.get(`${v}>${other}`) ?? v)
  for (const e0 of edges) {
    const [a0, b0] = edgeEnds(e0)
    const a = follow(a0, b0)
    const b = follow(b0, a0)
    if (!m.vertices[a] || !m.vertices[b]) continue
    const around = facesByEdge(m).get(edgeKey(a, b)) ?? []
    if (around.length !== 2) continue
    let [k1, k2] = around
    if (!runs(faceOrder(m, m.faces[k1]), a, b)) [k1, k2] = [k2, k1]
    const f1 = m.faces[k1]
    const f2 = m.faces[k2]
    const o1 = faceOrder(m, f1)
    const o2 = faceOrder(m, f2)
    const p1 = o1[(o1.indexOf(a) - 1 + o1.length) % o1.length]
    const q1 = o1[(o1.indexOf(b) + 1) % o1.length]
    const p2 = o2[(o2.indexOf(a) + 1) % o2.length]
    const q2 = o2[(o2.indexOf(b) - 1 + o2.length) % o2.length]
    const vertices = { ...m.vertices }
    const inserts = new Map<string, Array<{ v: string; from: string; t: number }>>()
    const share = new Map<string, string>()
    const place = (from: string, to: string) => {
      const e = edgeKey(from, to)
      const have = share.get(`${from}>${to}`)
      if (have) return { v: have, t: inserts.get(e)![0].t }
      const t = Math.min(width / Math.max(1e-6, length(sub(m.vertices[to], m.vertices[from]))), 0.45)
      const v = key8()
      vertices[v] = lerp3(m.vertices[from], m.vertices[to], t)
      inserts.set(e, [...(inserts.get(e) ?? []), { v, from, t }])
      share.set(`${from}>${to}`, v)
      moved.set(`${from}>${to}`, v)
      return { v, t }
    }
    const A1 = place(a, p1)
    const B1 = place(b, q1)
    const A2 = place(a, p2)
    const B2 = place(b, q2)
    const faces = { ...m.faces }
    const swap = (f: MeshFace, o: string[], at: Record<string, { v: string; t: number; to: string }>) => {
      const vs = o.map((v) => at[v]?.v ?? v)
      const uv: Record<string, UV> = {}
      o.forEach((v) => {
        const r = at[v]
        if (r) uv[r.v] = lerpUv(f.uv[v], f.uv[r.to], r.t)
        else uv[v] = f.uv[v] ?? [0, 0]
      })
      return { ...f, vertices: vs, uv }
    }
    faces[k1] = swap(f1, o1, { [a]: { ...A1, to: p1 }, [b]: { ...B1, to: q1 } })
    faces[k2] = swap(f2, o2, { [a]: { ...A2, to: p2 }, [b]: { ...B2, to: q2 } })
    const strip = [B1.v, A1.v, A2.v, B2.v].filter((v, i, all) => all.indexOf(v) === i)
    const stripKey = key8()
    faces[stripKey] = {
      vertices: strip,
      uv: { [B1.v]: faces[k1].uv[B1.v], [A1.v]: faces[k1].uv[A1.v], [A2.v]: f1.uv[a] ?? [0, 0], [B2.v]: f1.uv[b] ?? [0, 0] },
      texture: f1.texture,
    }
    const cut: Mesh = { ...m, vertices }
    insertOnEdges(cut, faces, inserts, new Set([k1, k2, stripKey]))
    // close the gap left at each end
    const closeAt = (corner: string, first: string, second: string, tri: string[]) => {
      if (first === second) return
      const holder = (v: string) => Object.keys(faces).find((k) => k !== stripKey && faces[k].vertices.includes(corner) && faces[k].vertices.includes(v))
      const g = holder(first)
      const h = holder(second)
      if (g && g === h) {
        const f = faces[g]
        const uv = { ...f.uv }
        delete uv[corner]
        faces[g] = { ...f, vertices: f.vertices.filter((v) => v !== corner), uv }
      } else if (g && h) {
        faces[key8()] = { vertices: tri, uv: { [first]: faces[g].uv[first], [corner]: faces[g].uv[corner], [second]: faces[h].uv[second] }, texture: faces[g].texture }
      }
    }
    closeAt(a, A1.v, A2.v, [A2.v, A1.v, a])
    closeAt(b, B1.v, B2.v, [B1.v, B2.v, b])
    m = dropLoose({ ...cut, faces })
    made.push(edgeKey(A1.v, B1.v), edgeKey(A2.v, B2.v))
  }
  return { mesh: m, edges: [...new Set(made)].filter((e) => edgeEnds(e).every((v) => m.vertices[v])) }
}

/** Drops vertices no face uses. */
function dropLoose(mesh: Mesh): Mesh {
  const used = new Set(Object.values(mesh.faces).flatMap((f) => f.vertices))
  if (Object.keys(mesh.vertices).every((k) => used.has(k))) return mesh
  return { ...mesh, vertices: Object.fromEntries(Object.entries(mesh.vertices).filter(([k]) => used.has(k))) }
}

/**
 * Where each end of some edges slides to: along the edge of the face beside
 * it that isn't one of the picked edges. Side `a` and side `b` are the two
 * faces along the picked edges, kept on one side as the pick runs on.
 */
export function slideRails(mesh: Mesh, edges: readonly string[]): { a: Map<string, string>; b: Map<string, string> } {
  const byEdge = facesByEdge(mesh)
  const picked = edges.filter((e) => byEdge.has(e))
  const rails = { a: new Map<string, string>(), b: new Map<string, string>() }
  const sideOf = new Map<string, string>()
  const neighbour = (face: string, v: string, not: string) => {
    const o = faceOrder(mesh, mesh.faces[face])
    const i = o.indexOf(v)
    const prev = o[(i - 1 + o.length) % o.length]
    const next = o[(i + 1) % o.length]
    return prev === not ? next : prev
  }
  for (const seed of picked) {
    if (sideOf.has(seed)) continue
    sideOf.set(seed, byEdge.get(seed)![0])
    const queue = [seed]
    while (queue.length) {
      const e = queue.shift()!
      const face = sideOf.get(e)!
      const other = byEdge.get(e)!.find((f) => f !== face)
      for (const [v, w] of [edgeEnds(e), edgeEnds(e).reverse()]) {
        const n = neighbour(face, v, w)
        if (!rails.a.has(v)) rails.a.set(v, n)
        if (other && !rails.b.has(v)) rails.b.set(v, neighbour(other, v, w))
        for (const e2 of picked) {
          if (sideOf.has(e2) || !edgeEnds(e2).includes(v)) continue
          const faces2 = byEdge.get(e2)!
          // the same side is the face that shares the rail
          sideOf.set(e2, faces2.find((f) => faceOrder(mesh, mesh.faces[f]).includes(n) && runsEither(faceOrder(mesh, mesh.faces[f]), v, n)) ?? faces2[0])
          queue.push(e2)
        }
      }
    }
  }
  return rails
}

const runsEither = (o: readonly string[], a: string, b: string) => runs(o, a, b) || runs(o, b, a)

/**
 * Blender's edge slide: the picked edges' vertices move along their rails,
 * `amount` of the way (positive toward side a, negative toward side b), and
 * the faces' UVs follow, so the texture stays put on the surface.
 */
export function slideEdges(mesh: Mesh, edges: readonly string[], amount: number): Mesh {
  if (!amount) return mesh
  const rails = slideRails(mesh, edges)
  const toward = amount > 0 ? rails.a : rails.b
  const away = amount > 0 ? rails.b : rails.a
  const t = Math.min(Math.abs(amount), 1)
  const vertices = { ...mesh.vertices }
  for (const [v, n] of toward) vertices[v] = lerp3(mesh.vertices[v], mesh.vertices[n], t)
  const faces = { ...mesh.faces }
  for (const [k, f] of Object.entries(mesh.faces)) {
    const o = faceOrder(mesh, f)
    let uv: Record<string, UV> | null = null
    for (const v of o) {
      const n = toward.get(v)
      if (!n) continue
      uv ??= { ...f.uv }
      if (runsEither(o, v, n)) {
        uv[v] = lerpUv(f.uv[v], f.uv[n], t)
        continue
      }
      // on the far side the corner moves away from that side's rail, by as much in space
      const m2 = away.get(v)
      if (m2 && runsEither(o, v, m2)) {
        const k2 = (t * length(sub(mesh.vertices[n], mesh.vertices[v]))) / Math.max(1e-6, length(sub(mesh.vertices[m2], mesh.vertices[v])))
        uv[v] = lerpUv(f.uv[v], f.uv[m2], -k2)
      }
    }
    if (uv) faces[k] = { ...f, uv }
  }
  return { ...mesh, vertices, faces }
}

/**
 * The edge loop through an edge, as Alt+click picks it in Blender: at each
 * vertex where four edges meet, it carries on along the edge sharing no
 * face with the edge it came in on. It stops anywhere else, or when it
 * comes back round.
 */
export function edgeLoop(mesh: Mesh, start: string): string[] {
  const byEdge = facesByEdge(mesh)
  if (!byEdge.has(start)) return []
  const at = new Map<string, string[]>()
  for (const e of byEdge.keys()) for (const v of edgeEnds(e)) at.set(v, [...(at.get(v) ?? []), e])
  const loop = [start]
  const seen = new Set(loop)
  for (const end of edgeEnds(start)) {
    let edge = start
    let v = end
    for (;;) {
      const here = at.get(v) ?? []
      if (here.length !== 4) break
      const faces = new Set(byEdge.get(edge))
      const next = here.find((e) => e !== edge && !(byEdge.get(e) ?? []).some((f) => faces.has(f)))
      if (!next || seen.has(next)) break
      seen.add(next)
      loop.push(next)
      edge = next
      v = edgeEnds(next).find((x) => x !== v)!
    }
  }
  return loop
}

/**
 * Blender's F: a new face through some vertices, ordered round their middle
 * and turned to face out (against a face it shares an edge with, or away
 * from the mesh's middle). Its UVs are left empty for the caller to lay out.
 */
export function fillFace(mesh: Mesh, keys: readonly string[], texture: string | null): { mesh: Mesh; face: string | null } {
  const vs = [...new Set(keys)].filter((k) => mesh.vertices[k])
  if (vs.length < 3) return { mesh, face: null }
  const ps = vs.map((k) => mesh.vertices[k])
  const c = scale(ps.reduce(addV, [0, 0, 0] as Vec3), 1 / ps.length)
  // the plane's normal: the largest cross product of two spokes
  let n: Vec3 = [0, 0, 0]
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const x = cross(sub(ps[i], c), sub(ps[j], c))
      if (length(x) > length(n)) n = x
    }
  n = unit(n)
  const e1 = unit(sub(ps[0], c))
  const e2 = cross(n, e1)
  const order = vs
    .map((k, i) => ({ k, a: Math.atan2(dot(sub(ps[i], c), e2), dot(sub(ps[i], c), e1)) }))
    .sort((x, y) => x.a - y.a)
    .map((x) => x.k)
  const outlines = Object.values(mesh.faces).map((f) => faceOrder(mesh, f))
  const sharesForward = order.some((a, i) => outlines.some((o) => runs(o, a, order[(i + 1) % order.length])))
  const sharesBackward = order.some((a, i) => outlines.some((o) => runs(o, order[(i + 1) % order.length], a)))
  const middle = centreOf(mesh, Object.keys(mesh.vertices))
  const outward = sharesForward ? false : sharesBackward ? true : dot(newell(order.map((k) => mesh.vertices[k])), sub(c, middle)) >= 0
  const vertices = outward ? order : [order[0], ...order.slice(1).reverse()]
  const face = key8()
  return { mesh: { ...mesh, faces: { ...mesh.faces, [face]: { vertices, uv: {}, texture } } }, face }
}

/** Dissolves edges: the two faces on each become one, with the edge gone. */
export function dissolveEdges(mesh: Mesh, edges: readonly string[]): { mesh: Mesh; faces: string[] } {
  let m = mesh
  const kept: string[] = []
  for (const e of edges) {
    const [a, b] = edgeEnds(e)
    const around = facesByEdge(m).get(edgeKey(a, b)) ?? []
    if (around.length !== 2) continue
    let [k1, k2] = around
    if (!runs(faceOrder(m, m.faces[k1]), a, b)) [k1, k2] = [k2, k1]
    const f1 = m.faces[k1]
    const o1 = faceOrder(m, f1)
    const o2 = faceOrder(m, m.faces[k2])
    const from1 = Array.from({ length: o1.length }, (_, j) => o1[(o1.indexOf(b) + j) % o1.length])
    const from2 = Array.from({ length: o2.length }, (_, j) => o2[(o2.indexOf(a) + j) % o2.length])
    const merged = [...from1, ...from2.slice(1, -1)]
    // faces that touch along more than one edge would fold over themselves
    if (new Set(merged).size !== merged.length) continue
    const faces = { ...m.faces }
    delete faces[k2]
    faces[k1] = { ...f1, vertices: merged, uv: { ...m.faces[k2].uv, ...f1.uv } }
    m = dropLoose({ ...m, faces })
    kept.push(k1)
  }
  return { mesh: m, faces: [...new Set(kept)].filter((k) => m.faces[k]) }
}

/**
 * Blender's inset: each face shrinks toward its middle by `amount` units,
 * and a ring of quads joins it to where its edges were. The ring keeps the
 * face's texture, running from its old UVs to the inner ones. Returns the
 * inner faces, which keep the old keys.
 */
export function insetFaces(mesh: Mesh, faceKeys: readonly string[], amount: number): { mesh: Mesh; faces: string[] } {
  const vertices = { ...mesh.vertices }
  const faces = { ...mesh.faces }
  const keys = faceKeys.filter((k) => mesh.faces[k])
  for (const k of keys) {
    const f = mesh.faces[k]
    const o = faceOrder(mesh, f)
    const c = centreOf(mesh, o)
    const uvc: UV = [o.reduce((s, v) => s + (f.uv[v]?.[0] ?? 0), 0) / o.length, o.reduce((s, v) => s + (f.uv[v]?.[1] ?? 0), 0) / o.length]
    const inner = o.map((v) => {
      const t = Math.min(amount / Math.max(1e-6, length(sub(c, mesh.vertices[v]))), 0.9)
      const nk = key8()
      vertices[nk] = lerp3(mesh.vertices[v], c, t)
      return { k: nk, uv: lerpUv(f.uv[v], uvc, t) }
    })
    o.forEach((v, i) => {
      const j = (i + 1) % o.length
      const ring = [v, o[j], inner[j].k, inner[i].k]
      faces[key8()] = { ...f, vertices: ring, uv: { [v]: f.uv[v] ?? [0, 0], [o[j]]: f.uv[o[j]] ?? [0, 0], [inner[j].k]: inner[j].uv, [inner[i].k]: inner[i].uv } }
    })
    faces[k] = { ...f, vertices: inner.map((x) => x.k), uv: Object.fromEntries(inner.map((x) => [x.k, x.uv])) }
  }
  return { mesh: { ...mesh, vertices, faces }, faces: keys }
}

/** Turns vertices `degrees` about `axis` (unit length, the mesh's own frame) through `about`. */
export function rotateVertices(mesh: Mesh, keys: readonly string[], axis: Vec3, degrees: number, about: Vec3): Mesh {
  const r = (degrees * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const k = unit(axis)
  const vertices = { ...mesh.vertices }
  for (const key of new Set(keys)) {
    const p = mesh.vertices[key]
    if (!p) continue
    const v = sub(p, about)
    // Rodrigues' rotation
    const turned = addV(addV(scale(v, cos), scale(cross(k, v), sin)), scale(k, dot(k, v) * (1 - cos)))
    vertices[key] = addV(turned, about).map(round) as Vec3
  }
  return { ...mesh, vertices }
}

/** Scales vertices by `factors` along the mesh's own axes, about `about`. */
export function scaleVertices(mesh: Mesh, keys: readonly string[], factors: Vec3, about: Vec3): Mesh {
  const vertices = { ...mesh.vertices }
  for (const key of new Set(keys)) {
    const p = mesh.vertices[key]
    if (!p) continue
    vertices[key] = [0, 1, 2].map((i) => round(about[i] + (p[i] - about[i]) * factors[i])) as Vec3
  }
  return { ...mesh, vertices }
}

/* ---------------- tidying: merge by distance, separate, join, cube to mesh ---------------- */

/**
 * Blender's merge by distance: vertices (of `keys`, or all) closer than
 * `distance` to one another become one, at their middle. Returns how many
 * went.
 */
export function mergeByDistance(mesh: Mesh, distance: number, keys?: readonly string[]): { mesh: Mesh; removed: number } {
  const pool = (keys?.length ? keys : Object.keys(mesh.vertices)).filter((k) => mesh.vertices[k])
  // union-find over the pairs that are close enough
  const root = new Map(pool.map((k) => [k, k]))
  const find = (k: string): string => {
    let r = k
    while (root.get(r) !== r) r = root.get(r)!
    root.set(k, r)
    return r
  }
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      if (length(sub(mesh.vertices[pool[i]], mesh.vertices[pool[j]])) <= distance) root.set(find(pool[j]), find(pool[i]))
  const groups = new Map<string, string[]>()
  for (const k of pool) groups.set(find(k), [...(groups.get(find(k)) ?? []), k])
  let m = mesh
  let removed = 0
  for (const g of groups.values()) {
    if (g.length < 2) continue
    m = mergeVertices(m, g).mesh
    removed += g.length - 1
  }
  return { mesh: dropLoose(m), removed }
}

/**
 * Blender's separate: the picked faces leave for a mesh of their own, in
 * the same place, with their own copies of the vertices they share with
 * the faces left behind.
 */
export function separateFaces(mesh: Mesh, faceKeys: readonly string[], name: string): { mesh: Mesh; piece: Mesh } | null {
  const keys = faceKeys.filter((k) => mesh.faces[k])
  if (!keys.length || keys.length === Object.keys(mesh.faces).length) return null
  const vertices = Object.fromEntries(verticesOf(mesh, keys).map((v) => [v, mesh.vertices[v]]))
  const faces = Object.fromEntries(keys.map((k) => [k, mesh.faces[k]]))
  const piece: Mesh = { ...mesh, id: newId(), name, vertices, faces }
  return { mesh: deleteFaces(mesh, keys), piece }
}

/**
 * Blender's join: other meshes' faces move into `target`. `toTarget` takes
 * a point of the other mesh into the target's own frame, so nothing moves
 * on screen. Keys that clash are made anew.
 */
export function joinMeshes(target: Mesh, others: ReadonlyArray<{ mesh: Mesh; toTarget: (p: Vec3) => Vec3 }>): Mesh {
  const vertices = { ...target.vertices }
  const faces = { ...target.faces }
  for (const { mesh, toTarget } of others) {
    const rename = new Map<string, string>()
    for (const [k, p] of Object.entries(mesh.vertices)) {
      const nk = vertices[k] ? key8() : k
      rename.set(k, nk)
      vertices[nk] = toTarget(p).map(round) as Vec3
    }
    for (const [k, f] of Object.entries(mesh.faces)) {
      const vs = f.vertices.map((v) => rename.get(v) ?? v)
      faces[faces[k] ? key8() : k] = { ...f, vertices: vs, uv: Object.fromEntries(Object.entries(f.uv).map(([v, uv]) => [rename.get(v) ?? v, uv])) }
    }
  }
  return { ...target, vertices, faces }
}

type Corner = [0 | 1, 0 | 1, 0 | 1]
/** Each cube face's corners as seen from outside, top left first and going clockwise, with the texture upright the way Blockbench and Minecraft draw it. 0 is the cube's `from` side on that axis, 1 its `to` side. */
export const FACE_CORNERS: Record<FaceKey, [Corner, Corner, Corner, Corner]> = {
  north: [[1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]],
  south: [[0, 1, 1], [1, 1, 1], [1, 0, 1], [0, 0, 1]],
  east: [[1, 1, 1], [1, 1, 0], [1, 0, 0], [1, 0, 1]],
  west: [[0, 1, 0], [0, 1, 1], [0, 0, 1], [0, 0, 0]],
  up: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
  down: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]],
}

/**
 * A cube as a mesh, Blockbench's "Convert to mesh": eight shared corners
 * (inflate included) about the cube's pivot, its turn kept, and each face
 * with its texture and its UVs, the face's quarter turns applied. A face
 * with no area on the sheet keeps its corners at one point.
 */
export function cubeToMesh(cube: Cube, parent: string | null): Mesh {
  const inf = cube.inflate || 0
  const lo: Vec3 = [cube.from[0] - inf, cube.from[1] - inf, cube.from[2] - inf]
  const hi: Vec3 = [cube.to[0] + inf, cube.to[1] + inf, cube.to[2] + inf]
  const vertices: Record<string, Vec3> = {}
  const corners = new Map<string, string>()
  const at = (c: Corner) => {
    const id = c.join('')
    let k = corners.get(id)
    if (!k) {
      k = key8()
      corners.set(id, k)
      vertices[k] = [0, 1, 2].map((i) => round((c[i] ? hi[i] : lo[i]) - cube.origin[i])) as Vec3
    }
    return k
  }
  const faces: Record<string, MeshFace> = {}
  for (const f of FACES) {
    const face = cube.faces[f]
    const cw = FACE_CORNERS[f].map(at)
    const [x1, y1, x2, y2] = face.uv
    const rect: Array<[number, number]> = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    const turn = (face.rotation ?? 0) / 90
    const uv = Object.fromEntries(cw.map((k, i) => [k, rect[(i - turn + 4) % 4]]))
    // meshes run their corners anticlockwise from outside
    faces[key8()] = { vertices: [cw[0], cw[3], cw[2], cw[1]], uv, texture: face.texture }
  }
  return { id: newId(), name: cube.name, parent, origin: [...cube.origin] as Vec3, rotation: [...cube.rotation] as Vec3, vertices, faces, visible: cube.visible, locked: cube.locked }
}
