/* Edits made from the viewport: moving, resizing, turning and flipping
   nodes, copy and paste, grouping. Each returns a new Model and keeps the
   `.vellum` meaning of every field: coordinates stay absolute model
   coordinates, read in the parent bone's frame. */

import { FACES } from './model'
import type { Bone, BoneChild, Cube, Face, FaceKey, Model, UVRect, Vec3 } from './model'
import { newId } from './new-model'

const addV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** Finds a bone anywhere in the tree. */
export function findBone(bones: Bone[], id: string): Bone | null {
  for (const b of bones) {
    if (b.id === id) return b
    const found = findBone(
      b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])),
      id,
    )
    if (found) return found
  }
  return null
}

/** Every cube id and bone id under a bone, the bone itself excluded. */
export function descendants(bone: Bone): { cubes: string[]; bones: string[] } {
  const out = { cubes: [] as string[], bones: [] as string[] }
  const walk = (b: Bone) => {
    for (const c of b.children) {
      if (c.kind === 'cube') out.cubes.push(c.id)
      else {
        out.bones.push(c.bone.id)
        walk(c.bone)
      }
    }
  }
  walk(bone)
  return out
}

const mapBones = (bones: Bone[], fn: (b: Bone) => Bone): Bone[] =>
  bones.map((b) => {
    const next = fn(b)
    return {
      ...next,
      children: next.children.map((c) =>
        c.kind === 'bone' ? { kind: 'bone' as const, bone: mapBones([c.bone], fn)[0] } : c,
      ),
    }
  })

const isLocked = (model: Model, id: string) =>
  model.cubes.find((c) => c.id === id)?.locked ?? model.meshes?.find((m) => m.id === id)?.locked ?? findBone(model.bones, id)?.locked ?? false

/**
 * Drops ids already covered by a selected ancestor bone, and locked nodes, so
 * a move applied to every id moves each node once.
 */
export function topLevel(model: Model, ids: readonly string[]): string[] {
  const covered = new Set<string>()
  for (const id of ids) {
    const bone = findBone(model.bones, id)
    if (!bone) continue
    const d = descendants(bone)
    for (const x of [...d.cubes, ...d.bones]) covered.add(x)
  }
  return ids.filter((id) => !covered.has(id) && !isLocked(model, id))
}

/**
 * Moves nodes by `delta`, given per node in its parent frame. A bone carries
 * everything under it, since children are stored in absolute coordinates.
 */
export function translateNodes(model: Model, deltas: ReadonlyMap<string, Vec3>): Model {
  const cubeShift = new Map<string, Vec3>()
  const boneShift = new Map<string, Vec3>()
  for (const [id, d] of deltas) {
    const bone = findBone(model.bones, id)
    if (bone) {
      boneShift.set(id, d)
      const under = descendants(bone)
      for (const c of under.cubes) cubeShift.set(c, d)
      for (const b of under.bones) boneShift.set(b, d)
    } else cubeShift.set(id, d)
  }
  return {
    ...model,
    cubes: model.cubes.map((c) => {
      const d = cubeShift.get(c.id)
      return d ? { ...c, from: addV(c.from, d), to: addV(c.to, d), origin: addV(c.origin, d) } : c
    }),
    bones: mapBones(model.bones, (b) => {
      const d = boneShift.get(b.id)
      return d ? { ...b, origin: addV(b.origin, d) } : b
    }),
    // a null object rides on its bone, so it moves with it
    nulls: model.nulls?.map((n) => {
      const d = n.parent ? boneShift.get(n.parent) : undefined
      return d ? { ...n, position: addV(n.position, d) } : n
    }),
    // a mesh moves when picked itself or when its bone moves; its vertices are offsets, so only the origin changes
    meshes: model.meshes?.map((m) => {
      const d = deltas.get(m.id) ?? (m.parent ? boneShift.get(m.parent) : undefined)
      return d ? { ...m, origin: addV(m.origin, d) } : m
    }),
  }
}

/** Moves only the pivot. The cube or bone, and a bone's children, stay where they are. */
export function movePivots(model: Model, deltas: ReadonlyMap<string, Vec3>): Model {
  return {
    ...model,
    /* A mesh's vertices hang off its pivot, turned by its rotation, so they
       shift back by the same distance in the mesh's own frame. */
    meshes: model.meshes?.map((m) => {
      const d = deltas.get(m.id)
      if (!d) return m
      const back = inverseTurn(m.rotation, d)
      const vertices = Object.fromEntries(Object.entries(m.vertices).map(([k, v]) => [k, [v[0] - back[0], v[1] - back[1], v[2] - back[2]] as Vec3]))
      return { ...m, origin: addV(m.origin, d), vertices }
    }),
    cubes: model.cubes.map((c) => {
      const d = deltas.get(c.id)
      return d ? { ...c, origin: addV(c.origin, d) } : c
    }),
    bones: mapBones(model.bones, (b) => {
      const d = deltas.get(b.id)
      return d ? { ...b, origin: addV(b.origin, d) } : b
    }),
  }
}

/**
 * Grows or shrinks one side of a cube along its own axis. `side` 1 moves
 * `to`, -1 moves `from`; a positive amount always grows the cube. The far
 * side never crosses the near one.
 */
export function resizeCube(c: Cube, axis: 0 | 1 | 2, side: 1 | -1, amount: number): Cube {
  const from: Vec3 = [...c.from]
  const to: Vec3 = [...c.to]
  if (side === 1) to[axis] = Math.max(from[axis], to[axis] + amount)
  else from[axis] = Math.min(to[axis], from[axis] - amount)
  return { ...c, from, to }
}

/** Sets Euler degrees on cubes and bones. */
export function setRotations(model: Model, rotations: ReadonlyMap<string, Vec3>): Model {
  return {
    ...model,
    cubes: model.cubes.map((c) => (rotations.has(c.id) ? { ...c, rotation: rotations.get(c.id)! } : c)),
    bones: mapBones(model.bones, (b) => (rotations.has(b.id) ? { ...b, rotation: rotations.get(b.id)! } : b)),
    meshes: model.meshes?.map((m) => (rotations.has(m.id) ? { ...m, rotation: rotations.get(m.id)! } : m)),
  }
}

/** A direction taken back through an Euler rotation (Rx·Ry·Rz), into the frame it turns. */
function inverseTurn(r: Vec3, v: Vec3): Vec3 {
  const [x, y, z] = r.map((a) => (a * Math.PI) / 180)
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z)
  // the transpose of Rx·Ry·Rz
  const m = [
    [cy * cz, sx * sy * cz + cx * sz, -cx * sy * cz + sx * sz],
    [-cy * sz, -sx * sy * sz + cx * cz, cx * sy * sz + sx * cz],
    [sy, -sx * cy, cx * cy],
  ]
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]]
}

/* ---------------- flip ---------------- */

const OPPOSITE: Record<number, [FaceKey, FaceKey]> = { 0: ['east', 'west'], 1: ['up', 'down'], 2: ['north', 'south'] }

function flipFaces(faces: Record<FaceKey, Face>, axis: 0 | 1 | 2): Record<FaceKey, Face> {
  const [a, b] = OPPOSITE[axis]
  const out = {} as Record<FaceKey, Face>
  for (const k of FACES) {
    const src = faces[k === a ? b : k === b ? a : k]
    const [x1, y1, x2, y2] = src.uv
    // the mirror image of the texture: swap the pair across the flipped direction
    const uv: UVRect = axis === 1 ? [x1, y2, x2, y1] : [x2, y1, x1, y2]
    out[k] = { ...src, uv }
  }
  return out
}

const mirrorRot = (r: Vec3, axis: 0 | 1 | 2): Vec3 => r.map((v, i) => (i === axis ? v : -v || 0)) as Vec3

/**
 * Mirrors nodes across a plane through the middle of what's flipped, or
 * across `about` when given. Bones
 * flip with everything under them; faces swap and their textures mirror.
 */
export function flipNodes(model: Model, ids: readonly string[], axis: 0 | 1 | 2, about?: number): Model {
  const cubes = new Set<string>()
  const bones = new Set<string>()
  for (const id of topLevel(model, ids)) {
    const bone = findBone(model.bones, id)
    if (bone) {
      bones.add(id)
      const d = descendants(bone)
      d.cubes.forEach((c) => cubes.add(c))
      d.bones.forEach((b) => bones.add(b))
    } else cubes.add(id)
  }
  if (!cubes.size && !bones.size) return model

  let lo = Infinity
  let hi = -Infinity
  for (const c of model.cubes)
    if (cubes.has(c.id)) {
      lo = Math.min(lo, c.from[axis])
      hi = Math.max(hi, c.to[axis])
    }
  if (!Number.isFinite(lo)) {
    for (const id of bones) {
      const o = findBone(model.bones, id)!.origin[axis]
      lo = Math.min(lo, o)
      hi = Math.max(hi, o)
    }
  }
  // `about` mirrors across a fixed plane, such as the model's centre line
  const mid = about ?? (lo + hi) / 2
  const m = (v: number) => 2 * mid - v
  const mv = (p: Vec3): Vec3 => p.map((v, i) => (i === axis ? m(v) : v)) as Vec3

  return {
    ...model,
    cubes: model.cubes.map((c) => {
      if (!cubes.has(c.id)) return c
      const from: Vec3 = [...c.from]
      const to: Vec3 = [...c.to]
      from[axis] = m(c.to[axis])
      to[axis] = m(c.from[axis])
      return { ...c, from, to, origin: mv(c.origin), rotation: mirrorRot(c.rotation, axis), faces: flipFaces(c.faces, axis) }
    }),
    bones: mapBones(model.bones, (b) =>
      bones.has(b.id) ? { ...b, origin: mv(b.origin), rotation: mirrorRot(b.rotation, axis) } : b,
    ),
  }
}

/* ---------------- copy and paste ---------------- */

/** What Copy holds: whole subtrees, so a pasted bone keeps its cubes. */
export type Clipboard = { roots: BoneChild[]; cubes: Cube[] }

let clipboard: Clipboard | null = null
export const readClipboard = () => clipboard

/** Copies the top-level selected nodes with everything under them. */
export function copyNodes(model: Model, ids: readonly string[]): Clipboard | null {
  const roots: BoneChild[] = []
  const cubes: Cube[] = []
  const keep = ids.filter((id) => {
    // a node under a selected bone is copied with it
    return !ids.some((other) => {
      if (other === id) return false
      const b = findBone(model.bones, other)
      return !!b && [...descendants(b).cubes, ...descendants(b).bones].includes(id)
    })
  })
  for (const id of keep) {
    const bone = findBone(model.bones, id)
    if (bone) {
      roots.push({ kind: 'bone', bone: structuredClone(bone) })
      for (const c of descendants(bone).cubes) {
        const cube = model.cubes.find((x) => x.id === c)
        if (cube) cubes.push(structuredClone(cube))
      }
    } else {
      const cube = model.cubes.find((x) => x.id === id)
      if (cube) {
        roots.push({ kind: 'cube', id })
        cubes.push(structuredClone(cube))
      }
    }
  }
  if (!roots.length) return null
  clipboard = { roots, cubes }
  return clipboard
}

/**
 * Pastes under `parentId` (or the first bone), with fresh ids. A face whose
 * texture this model lacks takes the model's first texture.
 */
export function pasteNodes(model: Model, clip: Clipboard, parentId: string | null): { model: Model; ids: string[] } {
  const textureIds = new Set(model.textures.map((t) => t.id))
  const fallback = model.textures[0]?.id ?? null
  const cubeIds = new Map<string, string>()
  const made: Cube[] = []

  const copyCube = (id: string): string => {
    const src = clip.cubes.find((c) => c.id === id)
    if (!src) return id
    const fresh = newId()
    cubeIds.set(id, fresh)
    made.push({
      ...structuredClone(src),
      id: fresh,
      faces: Object.fromEntries(
        FACES.map((k) => [
          k,
          { ...src.faces[k], uv: [...src.faces[k].uv] as UVRect, texture: src.faces[k].texture && textureIds.has(src.faces[k].texture!) ? src.faces[k].texture : fallback },
        ]),
      ) as Record<FaceKey, Face>,
    })
    return fresh
  }
  const copyBone = (b: Bone): Bone => ({
    ...b,
    id: newId(),
    children: b.children.map((c) =>
      c.kind === 'bone' ? { kind: 'bone' as const, bone: copyBone(c.bone) } : { kind: 'cube' as const, id: copyCube(c.id) },
    ),
  })

  const nodes: BoneChild[] = clip.roots.map((r) =>
    r.kind === 'bone' ? { kind: 'bone' as const, bone: copyBone(r.bone) } : { kind: 'cube' as const, id: copyCube(r.id) },
  )
  const ids = nodes.map((n) => (n.kind === 'bone' ? n.bone.id : n.id))

  const target = (parentId && findBone(model.bones, parentId)?.id) || model.bones[0]?.id || null
  let bones: Bone[]
  if (!target) {
    // an empty model: pasted bones become roots, cubes need a bone to sit in
    const looseCubes = nodes.filter((n) => n.kind === 'cube')
    const rootBones = nodes.flatMap((n) => (n.kind === 'bone' ? [n.bone] : []))
    bones = looseCubes.length
      ? [...rootBones, { id: newId(), name: 'root', origin: [0, 0, 0], rotation: [0, 0, 0], visible: true, locked: false, children: looseCubes }]
      : rootBones
  } else {
    bones = mapBones(model.bones, (b) => (b.id === target ? { ...b, children: [...b.children, ...nodes] } : b))
  }
  return { model: { ...model, cubes: [...model.cubes, ...made], bones }, ids }
}

/* ---------------- group ---------------- */

/**
 * Wraps the selected nodes in a new bone, Blockbench's Ctrl+G. The bone goes
 * where the first node sat and pivots at the middle of what it holds.
 */
export function groupNodes(model: Model, ids: readonly string[]): { model: Model; id: string } | null {
  const nodes = topLevel(model, ids)
  if (!nodes.length) return null
  const firstParent = (() => {
    const walk = (bones: Bone[]): string | null => {
      for (const b of bones) {
        if (b.children.some((c) => (c.kind === 'cube' ? c.id : c.bone.id) === nodes[0])) return b.id
        const nested = walk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))
        if (nested) return nested
      }
      return null
    }
    return walk(model.bones)
  })()

  const lifted: BoneChild[] = []
  const take = new Set(nodes)
  const strip = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...b,
      children: b.children
        .filter((c) => {
          const id = c.kind === 'cube' ? c.id : c.bone.id
          if (take.has(id)) {
            lifted.push(c)
            return false
          }
          return true
        })
        .map((c) => (c.kind === 'bone' ? { kind: 'bone' as const, bone: strip([c.bone])[0] } : c)),
    }))
  const rootsTaken = model.bones.filter((b) => take.has(b.id))
  rootsTaken.forEach((b) => lifted.push({ kind: 'bone', bone: b }))
  let bones = strip(model.bones.filter((b) => !take.has(b.id)))

  const pts: Vec3[] = []
  for (const n of lifted) {
    if (n.kind === 'bone') pts.push(n.bone.origin)
    else {
      const c = model.cubes.find((x) => x.id === n.id)
      if (c) pts.push(c.from, c.to)
    }
  }
  const mid = (i: number) => (Math.min(...pts.map((p) => p[i])) + Math.max(...pts.map((p) => p[i]))) / 2
  const group: Bone = {
    id: newId(),
    name: 'group',
    origin: pts.length ? [mid(0), mid(1), mid(2)] : [0, 0, 0],
    rotation: [0, 0, 0],
    visible: true,
    locked: false,
    children: lifted,
  }
  bones = firstParent && !take.has(firstParent)
    ? mapBones(bones, (b) => (b.id === firstParent ? { ...b, children: [...b.children, { kind: 'bone', bone: group }] } : b))
    : [...bones, group]
  return { model: { ...model, bones }, id: group.id }
}

/**
 * Moves a node before or after a sibling, for drag reordering in the outliner.
 * In a `.vellum` file a bone lists its cubes in order and child bones are
 * written in tree order, so both orders survive a save.
 */
export function reorderNode(model: Model, id: string, beside: string, after: boolean): Model {
  if (id === beside) return model
  const key = (c: BoneChild) => (c.kind === 'cube' ? c.id : c.bone.id)
  const place = (list: BoneChild[]): BoneChild[] | null => {
    const from = list.findIndex((c) => key(c) === id)
    const to = list.findIndex((c) => key(c) === beside)
    if (from < 0 || to < 0) return null
    const next = [...list]
    const [node] = next.splice(from, 1)
    const at = next.findIndex((c) => key(c) === beside)
    next.splice(after ? at + 1 : at, 0, node)
    return next
  }
  const roots = place(model.bones.map((b) => ({ kind: 'bone' as const, bone: b })))
  if (roots) return { ...model, bones: roots.map((c) => (c as { bone: Bone }).bone) }
  let done = false
  const bones = mapBones(model.bones, (b) => {
    if (done) return b
    const next = place(b.children)
    if (!next) return b
    done = true
    return { ...b, children: next }
  })
  return done ? { ...model, bones } : model
}

/** After bones are deleted, a null object that rode on one moves to the model root, where it was. */
export function rehomeNulls(model: Model): Model {
  if (!model.nulls?.length) return model
  const live = new Set<string>()
  const walk = (bones: Bone[]) => {
    for (const b of bones) {
      live.add(b.id)
      walk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))
    }
  }
  walk(model.bones)
  // the null's position is absolute, so only the parent link changes
  return { ...model, nulls: model.nulls.map((n) => (n.parent && !live.has(n.parent) ? { ...n, parent: null, ikTarget: n.ikTarget && live.has(n.ikTarget) ? n.ikTarget : undefined } : n.ikTarget && !live.has(n.ikTarget) ? { ...n, ikTarget: undefined } : n)) }
}

/* ---------------- mirror editing ---------------- */

const near = (a: Vec3, b: Vec3) => Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3 && Math.abs(a[2] - b[2]) < 1e-3

/** A cube's shape mirrored across the plane x = `about`: its box, pivot and turn. */
function mirroredShape(c: Cube, about: number): Pick<Cube, 'from' | 'to' | 'origin' | 'rotation' | 'inflate'> {
  return {
    from: [2 * about - c.to[0], c.from[1], c.from[2]],
    to: [2 * about - c.from[0], c.to[1], c.to[2]],
    origin: [2 * about - c.origin[0], c.origin[1], c.origin[2]],
    rotation: mirrorRot(c.rotation, 0),
    inflate: c.inflate,
  }
}

/** The cube that is this one's mirror image across x = `about`, if there is one (never the cube itself). */
export function mirrorCubeOf(model: Model, cube: Cube, about: number): Cube | null {
  const want = mirroredShape(cube, about)
  return model.cubes.find((c) => c.id !== cube.id && near(c.from, want.from) && near(c.to, want.to) && near(c.origin, want.origin)) ?? null
}

/**
 * Blockbench's mirror modelling for cubes: each edited cube that had a
 * mirror image in `before` gets one again in `after`, the partner's box,
 * pivot and turn rebuilt from it. A partner that was itself edited is left
 * as the edit made it.
 */
export function followMirrorCubes(before: Model, after: Model, ids: readonly string[], about: number): Model {
  const edited = new Set(ids)
  const updates = new Map<string, Pick<Cube, 'from' | 'to' | 'origin' | 'rotation' | 'inflate'>>()
  for (const id of ids) {
    const b = before.cubes.find((c) => c.id === id)
    const a = after.cubes.find((c) => c.id === id)
    if (!a || !b) continue
    const partner = mirrorCubeOf(before, b, about)
    if (!partner || edited.has(partner.id) || partner.locked) continue
    updates.set(partner.id, mirroredShape(a, about))
  }
  if (!updates.size) return after
  return { ...after, cubes: after.cubes.map((c) => (updates.has(c.id) ? { ...c, ...updates.get(c.id)! } : c)) }
}
