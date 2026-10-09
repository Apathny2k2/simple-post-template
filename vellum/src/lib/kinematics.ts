/* World transforms of bones and cubes, built the way ModelView renders them,
   so gizmos and snapping agree with what is on screen.

   Everything here is in model space: Y up, one unit per texel, the same
   space as `.vellum` coordinates. ModelView works in CSS space (Y down)
   and turns a rotation into `rotateX(-rx) rotateY(ry) rotateZ(-rz)`; the
   same string is parsed here and conjugated by the Y flip, so the two can't
   drift apart. Needs DOMMatrix, which every browser has. */

import { samplePose } from './model'
import type { Bone, Clip, Cube, Mesh, Model, NullObject, Pose, Vec3 } from './model'

const flip = () => new DOMMatrix().scale(1, -1, 1)

/** The same rotation built by parsing the CSS ModelView writes. Slow; kept to check `rotationMatrix` against. */
export function rotationMatrixFromCss(rot: Vec3): DOMMatrix {
  const css = new DOMMatrix(`rotateX(${-rot[0]}deg) rotateY(${rot[1]}deg) rotateZ(${-rot[2]}deg)`)
  return flip().multiply(css).multiply(flip())
}

/**
 * A model-space rotation matrix for Euler degrees, as ModelView applies them.
 * Conjugating the CSS rotation by the Y flip gives Rx(rx)·Ry(ry)·Rz(rz) with
 * the usual right-handed matrices.
 */
export function rotationMatrix(rot: Vec3): DOMMatrix {
  const [a, b, c] = rot.map((d) => (d * Math.PI) / 180)
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)]
  const r = [
    [cb * cc, -cb * sc, sb],
    [sa * sb * cc + ca * sc, -sa * sb * sc + ca * cc, -sa * cb],
    [-ca * sb * cc + sa * sc, ca * sb * sc + sa * cc, ca * cb],
  ]
  // DOMMatrix takes column-major order
  return new DOMMatrix([r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, 0, 0, 0, 1])
}

/** Euler degrees from the rotation part of a matrix, the inverse of `rotationMatrix`. */
export function eulerOf(m: DOMMatrix): Vec3 {
  // row r, column c is m{c}{r}
  const r02 = m.m31
  const b = Math.asin(Math.max(-1, Math.min(1, r02)))
  let a: number
  let c: number
  if (Math.abs(r02) < 0.99999) {
    a = Math.atan2(-m.m32, m.m33)
    c = Math.atan2(-m.m21, m.m11)
  } else {
    // gimbal lock: X and Z turn about the same axis, so give it all to X
    a = Math.atan2(m.m23, m.m22)
    c = 0
  }
  const deg = (v: number) => Math.round(((v * 180) / Math.PI) * 1e4) / 1e4
  return [deg(a), deg(b), deg(c)]
}

const translation = (v: Vec3) => new DOMMatrix().translate(v[0], v[1], v[2])

export const apply = (m: DOMMatrix, p: Vec3): Vec3 => {
  const r = m.transformPoint(new DOMPoint(p[0], p[1], p[2], 1))
  return [r.x, r.y, r.z]
}

/** The matrix's linear part applied to a direction; translation is ignored. */
export const applyDir = (m: DOMMatrix, v: Vec3): Vec3 => {
  const r = m.transformPoint(new DOMPoint(v[0], v[1], v[2], 0))
  return [r.x, r.y, r.z]
}

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scaleV = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const norm = (a: Vec3): Vec3 => {
  const l = len(a)
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export type Rig = {
  /** bone id → world matrix of the bone's frame; its local origin is the bone's origin */
  bone: Map<string, DOMMatrix>
  /** bone id → the bone itself */
  bones: Map<string, Bone>
  /** cube or mesh id → id of the bone that holds it */
  cubeOwner: Map<string, string>
  /** bone id → parent bone id, or null at the root */
  boneParent: Map<string, string | null>
}

/** Every bone's world frame, with the pose applied the way ModelView adds it to the rest pose. */
export function buildRig(model: Model, pose: Pose = {}): Rig {
  const rig: Rig = { bone: new Map(), bones: new Map(), cubeOwner: new Map(), boneParent: new Map() }
  const walk = (bones: Bone[], parent: DOMMatrix, parentOrigin: Vec3, parentId: string | null) => {
    for (const b of bones) {
      const p = pose[b.id]
      const at: Vec3 = add(sub(b.origin, parentOrigin), p?.position ?? [0, 0, 0])
      const rot: Vec3 = add(b.rotation, p?.rotation ?? [0, 0, 0])
      const s = p?.scale ?? [1, 1, 1]
      const m = parent
        .multiply(translation(at))
        .multiply(rotationMatrix(rot))
        .multiply(new DOMMatrix().scale(s[0], s[1], s[2]))
      rig.bone.set(b.id, m)
      rig.bones.set(b.id, b)
      rig.boneParent.set(b.id, parentId)
      for (const c of b.children) {
        if (c.kind === 'cube') rig.cubeOwner.set(c.id, b.id)
        else walk([c.bone], m, b.origin, b.id)
      }
    }
  }
  walk(model.bones, new DOMMatrix(), [0, 0, 0], null)
  // a mesh names its bone, as a null object does
  for (const m of model.meshes ?? []) if (m.parent && rig.bone.has(m.parent)) rig.cubeOwner.set(m.id, m.parent)
  return rig
}

/** A mesh's world frame; its vertices are offsets in it, from the mesh's origin. */
export function meshFrame(rig: Rig, mesh: Mesh): DOMMatrix {
  const f = parentFrame(rig, mesh.id)
  return f.matrix.multiply(translation(sub(mesh.origin, f.origin))).multiply(rotationMatrix(mesh.rotation))
}

/** A cube's world frame; its local origin is the cube's pivot (`origin`). */
export function cubeFrame(rig: Rig, cube: Cube): DOMMatrix {
  const ownerId = rig.cubeOwner.get(cube.id)
  const owner = ownerId ? rig.bones.get(ownerId) : undefined
  const parent = (ownerId && rig.bone.get(ownerId)) || new DOMMatrix()
  const at = sub(cube.origin, owner?.origin ?? [0, 0, 0])
  return parent.multiply(translation(at)).multiply(rotationMatrix(cube.rotation))
}

/**
 * The frame a node's own coordinates are written in. A cube's `from`, `to`
 * and `origin`, and a bone's `origin`, are offsets in this frame from its
 * local origin, which sits at `originOf` the parent.
 */
export function parentFrame(rig: Rig, id: string): { matrix: DOMMatrix; origin: Vec3 } {
  const ownerId = rig.cubeOwner.get(id) ?? rig.boneParent.get(id) ?? null
  if (!ownerId) return { matrix: new DOMMatrix(), origin: [0, 0, 0] }
  return { matrix: rig.bone.get(ownerId) ?? new DOMMatrix(), origin: rig.bones.get(ownerId)?.origin ?? [0, 0, 0] }
}

/** A point given in the model's absolute coordinates (as stored), placed in the world through its parent frame. */
export function worldOfStored(rig: Rig, id: string, p: Vec3): Vec3 {
  const f = parentFrame(rig, id)
  return apply(f.matrix, sub(p, f.origin))
}

/** A world-space direction expressed in a node's parent frame, the space its stored coordinates move in. */
export function toParentDir(rig: Rig, id: string, worldDir: Vec3): Vec3 {
  return applyDir(parentFrame(rig, id).matrix.inverse(), worldDir)
}

/** The eight corners of a cube in world space, inflate included. */
export function cubeCorners(rig: Rig, cube: Cube): Vec3[] {
  const f = cubeFrame(rig, cube)
  const inf = cube.inflate || 0
  const lo = sub(cube.from, [inf, inf, inf])
  const hi = add(cube.to, [inf, inf, inf])
  const out: Vec3[] = []
  for (const x of [lo[0], hi[0]])
    for (const y of [lo[1], hi[1]])
      for (const z of [lo[2], hi[2]]) out.push(apply(f, sub([x, y, z], cube.origin)))
  return out
}

/**
 * How a node turns in world space when one Euler component of its rotation
 * changes: for each of x, y and z, the world axis it turns about and the
 * radians per degree. Measured by a small step, so it is right for any
 * order and sign the renderer uses, and for parents turned any way.
 */
export function eulerAxes(parent: DOMMatrix, rot: Vec3): Array<{ axis: Vec3; rate: number }> {
  const lin = (m: DOMMatrix) => [
    [m.m11, m.m21, m.m31],
    [m.m12, m.m22, m.m32],
    [m.m13, m.m23, m.m33],
  ]
  const base = parent.multiply(rotationMatrix(rot))
  const W = lin(base)
  const eps = 0.01
  return [0, 1, 2].map((i) => {
    const r: Vec3 = [...rot]
    r[i] += eps
    const D = lin(parent.multiply(rotationMatrix(r)))
    // K = (dW/dε) Wᵀ is skew-symmetric; it holds the angular velocity
    const K = [0, 1, 2].map((a) =>
      [0, 1, 2].map((b) => {
        let s = 0
        for (let k = 0; k < 3; k++) s += ((D[a][k] - W[a][k]) / eps) * W[b][k]
        return s
      }),
    )
    const w: Vec3 = [(K[2][1] - K[1][2]) / 2, (K[0][2] - K[2][0]) / 2, (K[1][0] - K[0][1]) / 2]
    const rate = len(w)
    return { axis: rate > 1e-9 ? scaleV(w, 1 / rate) : ([0, 0, 0] as Vec3), rate }
  })
}

/* ---------------- null objects and IK ---------------- */

/** Where a null object is in world space, its keyed offset included. */
export function nullWorld(rig: Rig, n: NullObject, pose: Pose = {}): Vec3 {
  const parent = n.parent ? rig.bone.get(n.parent) : undefined
  const origin = n.parent ? rig.bones.get(n.parent)?.origin ?? [0, 0, 0] : [0, 0, 0]
  const local = add(sub(n.position, origin as Vec3), pose[n.id]?.position ?? [0, 0, 0])
  return parent ? apply(parent, local) : local
}

const rotationOnly = (m: DOMMatrix) => {
  const r = DOMMatrix.fromMatrix(m)
  r.m41 = 0
  r.m42 = 0
  r.m43 = 0
  return r
}

/** The matrix that turns `from` onto `to`, both directions. */
function turnBetween(from: Vec3, to: Vec3): DOMMatrix | null {
  const a = norm(from)
  const b = norm(to)
  const c = Math.max(-1, Math.min(1, dot(a, b)))
  const angle = Math.acos(c)
  if (angle < 1e-5) return null
  let axis = cross(a, b)
  if (len(axis) < 1e-9) axis = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])
  const n = norm(axis)
  return new DOMMatrix().rotateAxisAngle(n[0], n[1], n[2], (angle * 180) / Math.PI)
}

/**
 * Bends each IK chain so the end bone's pivot reaches its null, by cyclic
 * coordinate descent: each bone in the chain, from the end up, turns to
 * point the end at the target, and the pass repeats. The result is written
 * into the pose as rotation offsets, the same way keyed rotations are.
 */
export function solveIK(model: Model, pose: Pose): Pose {
  const goals = (model.nulls ?? []).filter((n) => n.ikTarget)
  if (!goals.length) return pose
  const out: Pose = { ...pose }
  for (const goal of goals) {
    let rig = buildRig(model, out)
    const tip = goal.ikTarget!
    if (!rig.bones.has(tip)) continue
    const chain: string[] = []
    let up = rig.boneParent.get(tip) ?? null
    while (up && chain.length < (goal.ikChain ?? 2)) {
      chain.push(up)
      up = rig.boneParent.get(up) ?? null
    }
    if (!chain.length) continue
    const target = nullWorld(rig, goal, out)
    for (let pass = 0; pass < 12; pass++) {
      for (const id of chain) {
        const bone = rig.bones.get(id)!
        const world = rig.bone.get(id)!
        const pivot = apply(world, [0, 0, 0])
        const end = apply(rig.bone.get(tip)!, [0, 0, 0])
        const turn = turnBetween(sub(end, pivot), sub(target, pivot))
        if (!turn) continue
        const parentId = rig.boneParent.get(id)
        const parent = rotationOnly(parentId ? rig.bone.get(parentId)! : new DOMMatrix())
        // the bone's new local rotation: parent⁻¹ · turn · its world rotation
        const local = parent.inverse().multiply(turn).multiply(rotationOnly(world))
        const euler = eulerOf(local)
        const prev = out[id]
        out[id] = {
          rotation: sub(euler, bone.rotation),
          position: prev?.position ?? [0, 0, 0],
          scale: prev?.scale ?? [1, 1, 1],
        }
        rig = buildRig(model, out)
      }
      if (len(sub(apply(rig.bone.get(tip)!, [0, 0, 0]), target)) < 0.01) break
    }
  }
  return out
}

/** The pose a clip gives at `t`, with IK solved: what the viewport draws. */
export function posedAt(model: Model, clip: Clip | null, t: number): Pose {
  return solveIK(model, samplePose(clip, t))
}
