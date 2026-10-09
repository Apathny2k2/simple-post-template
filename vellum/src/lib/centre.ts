/* Items live in the 16-unit block a Java model is drawn in, 0 to 16 on each
   axis, so an item's middle belongs at x and z 8. An item built around 0
   (as Vellum's samples once were) sits half off its block in the game, in
   a slot and in a frame. `centreInBlock` moves everything over. */

import type { Bone, Model, Vec3 } from './model'
import { buildRig, cubeFrame, meshFrame } from './kinematics'

/** The model's rest-pose bounds across x and z, cubes and meshes both; null when it has neither. */
function boundsXZ(model: Model): { lo: [number, number]; hi: [number, number] } | null {
  const rig = buildRig(model, {})
  const pts: Vec3[] = []
  for (const c of model.cubes) {
    const f = cubeFrame(rig, c)
    for (const x of [c.from[0], c.to[0]])
      for (const y of [c.from[1], c.to[1]])
        for (const z of [c.from[2], c.to[2]]) {
          const p = f.transformPoint(new DOMPoint(x - c.origin[0], y - c.origin[1], z - c.origin[2]))
          pts.push([p.x, p.y, p.z])
        }
  }
  for (const m of model.meshes ?? []) {
    const f = meshFrame(rig, m)
    for (const v of Object.values(m.vertices)) {
      const p = f.transformPoint(new DOMPoint(v[0], v[1], v[2]))
      pts.push([p.x, p.y, p.z])
    }
  }
  if (!pts.length) return null
  return {
    lo: [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[2]))],
    hi: [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[2]))],
  }
}

/** How far the item's middle is from the block's, across x and z; null for a model with nothing in it. */
export function offCentre(model: Model): [number, number] | null {
  const b = boundsXZ(model)
  if (!b) return null
  return [(b.lo[0] + b.hi[0]) / 2 - 8, (b.lo[1] + b.hi[1]) / 2 - 8]
}

/**
 * The model moved across x and z so its middle is the block's, to the
 * nearest sixteenth of a unit: every cube, bone pivot, mesh and null. Clips
 * are offsets and stay as they are.
 */
export function centreInBlock(model: Model): Model {
  const off = offCentre(model)
  if (!off) return model
  const dx = -Math.round(off[0] * 16) / 16
  const dz = -Math.round(off[1] * 16) / 16
  if (!dx && !dz) return model
  const move = (p: Vec3): Vec3 => [p[0] + dx, p[1], p[2] + dz]
  const bone = (b: Bone): Bone => ({ ...b, origin: move(b.origin), children: b.children.map((c) => (c.kind === 'bone' ? { ...c, bone: bone(c.bone) } : c)) })
  return {
    ...model,
    bones: model.bones.map(bone),
    cubes: model.cubes.map((c) => ({ ...c, from: move(c.from), to: move(c.to), origin: move(c.origin) })),
    ...(model.meshes ? { meshes: model.meshes.map((m) => ({ ...m, origin: move(m.origin) })) } : {}),
    ...(model.nulls ? { nulls: model.nulls.map((n) => ({ ...n, position: move(n.position) })) } : {}),
  }
}
