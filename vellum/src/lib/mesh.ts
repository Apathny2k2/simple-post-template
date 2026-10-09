/* Meshes: Blockbench's free-form elements. Geometry helpers the renderer,
   the exporters and the editing tools share, the primitives, and the edits
   (move vertices, extrude, delete, merge, flip). Vertices are offsets from
   the mesh's origin; UVs are in UV units like a cube face's. */

import type { Mesh, MeshFace, Model, UVRect, Vec3 } from './model'
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
