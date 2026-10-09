/* What is under a point on the viewport. Every triangle the scene drew is
   projected with the view's own camera and tested in screen space; the
   nearest one that holds the point wins. Weights are perspective-correct,
   so the UV and the point inside the face are the ones drawn there. */

import type { Vec3 } from '../model'
import type { Camera } from './camera'
import type { PickTri } from './scene'

export type Hit = {
  tri: PickTri
  /** the hit in the texture's UV units */
  uv: [number, number]
  /** the hit in the element's own frame (a mesh's vertex space) */
  local: Vec3
  /** the hit in model space */
  at: Vec3
}

export function pickAt(camera: Camera, picks: readonly PickTri[], x: number, y: number): Hit | null {
  let best: Hit | null = null
  let bestZ = -Infinity
  for (const tri of picks) {
    const s = tri.p.map((p) => camera.project(p))
    // behind the eye
    if (s.some((q) => q.w <= 1e-6)) continue
    const [a, b, c] = s
    const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if (Math.abs(det) < 1e-9) continue
    const l0 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / det
    const l1 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / det
    const l2 = 1 - l0 - l1
    const eps = -1e-6
    if (l0 < eps || l1 < eps || l2 < eps) continue
    // screen weights to the triangle's own, undoing the perspective divide
    const q0 = l0 / a.w
    const q1 = l1 / b.w
    const q2 = l2 / c.w
    const sum = q0 + q1 + q2
    const w = [q0 / sum, q1 / sum, q2 / sum]
    const z = w[0] * a.z + w[1] * b.z + w[2] * c.z
    if (z <= bestZ) continue
    bestZ = z
    const mix3 = (v: readonly Vec3[]): Vec3 => [0, 1, 2].map((i) => w[0] * v[0][i] + w[1] * v[1][i] + w[2] * v[2][i]) as Vec3
    best = {
      tri,
      uv: [w[0] * tri.uv[0][0] + w[1] * tri.uv[1][0] + w[2] * tri.uv[2][0], w[0] * tri.uv[0][1] + w[1] * tri.uv[1][1] + w[2] * tri.uv[2][1]],
      local: mix3(tri.local),
      at: mix3(tri.p),
    }
  }
  return best
}
