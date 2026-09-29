/* Finding room on the texture sheet for a box unwrap, and doubling the
   sheet when it is full. Doubling every UV along with the image keeps
   each face on the same texels. */

import { FACES } from './model'
import type { Cube, FaceKey, Model, Texture, UVRect, Vec3 } from './model'

/** The rectangle a box unwrap of this size needs, in texels. */
export function boxSize(size: Vec3): [number, number] {
  const [w, h, d] = size.map((v) => Math.max(1, Math.round(v))) as Vec3
  return [2 * (d + w), d + h]
}

const normalise = (uv: UVRect): UVRect => [
  Math.min(uv[0], uv[2]),
  Math.min(uv[1], uv[3]),
  Math.max(uv[0], uv[2]),
  Math.max(uv[1], uv[3]),
]

/** Every island already claimed. Zero-area faces claim nothing. */
export function occupied(model: Model, skip?: string): UVRect[] {
  const out: UVRect[] = []
  for (const cube of model.cubes) {
    if (cube.id === skip) continue
    for (const key of FACES) {
      const r = normalise(cube.faces[key].uv)
      if (r[2] > r[0] && r[3] > r[1]) out.push(r)
    }
  }
  return out
}

const overlaps = (a: UVRect, b: UVRect) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/* First fit over candidate corners at 0 and the island edges. Any free
   spot can slide up and left onto one of them, so none is missed. */
export function findSpot(model: Model, box: [number, number]): [number, number] | null {
  const [bw, bh] = box
  const { width, height } = model.resolution
  if (bw > width || bh > height) return null

  const taken = occupied(model)
  const xs = new Set<number>([0])
  const ys = new Set<number>([0])
  for (const r of taken) {
    xs.add(r[2])
    ys.add(r[1])
    ys.add(r[3])
  }

  const cols = [...xs].filter((x) => x + bw <= width).sort((a, b) => a - b)
  const rows = [...ys].filter((y) => y + bh <= height).sort((a, b) => a - b)

  for (const y of rows) {
    for (const x of cols) {
      const candidate: UVRect = [x, y, x + bw, y + bh]
      if (!taken.some((r) => overlaps(candidate, r))) return [x, y]
    }
  }
  return null
}

/** Redraw a texture at `factor` size. Null when it cannot be rendered. */
export type Rescale = (texture: Texture, factor: number) => string | null

/** Scale the UV space, every face rect and each texture by `factor`, so faces keep their texels. */
export function growUvSpace(model: Model, rescale: Rescale, factor = 2): Model {
  const scaleRect = (uv: UVRect): UVRect => [uv[0] * factor, uv[1] * factor, uv[2] * factor, uv[3] * factor]

  return {
    ...model,
    resolution: {
      width: model.resolution.width * factor,
      height: model.resolution.height * factor,
    },
    textures: model.textures.map((t) => {
      const source = rescale(t, factor)
      return {
        ...t,
        width: t.width * factor,
        height: t.height * factor,
        uvWidth: t.uvWidth * factor,
        uvHeight: t.uvHeight * factor,
        // a texture that could not be redrawn keeps its old pixels, still visible and repaintable
        source: source ?? t.source,
      }
    }),
    cubes: model.cubes.map((c) => ({
      ...c,
      faces: Object.fromEntries(
        FACES.map((k) => [k, { ...c.faces[k], uv: scaleRect(c.faces[k].uv) }]),
      ) as Cube['faces'],
    })),
  }
}

/** Room for a box. With `rescale`, the sheet doubles after each miss, up to `limit` + 1 times. */
export function makeRoom(
  model: Model,
  size: Vec3,
  rescale: Rescale | null,
  limit = 3,
): { model: Model; at: [number, number] | null } {
  const box = boxSize(size)
  let current = model
  for (let i = 0; i <= limit; i++) {
    const at = findSpot(current, box)
    if (at) return { model: current, at }
    if (!rescale) break
    current = growUvSpace(current, rescale)
  }
  return { model: current, at: null }
}

/** The six faces of a box unwrap at `at`. Each side is at least 1 texel. */
export function boxUvFaces(
  size: Vec3,
  at: [number, number],
  texture: string | null,
): Record<FaceKey, { uv: UVRect; texture: string | null; rotation: 0 }> {
  const [w, h, d] = size.map((v) => Math.max(1, Math.round(v))) as Vec3
  const [ox, oy] = at
  const rects: Record<FaceKey, UVRect> = {
    up: [ox + d, oy, ox + d + w, oy + d],
    down: [ox + d + w, oy, ox + d + w * 2, oy + d],
    east: [ox, oy + d, ox + d, oy + d + h],
    north: [ox + d, oy + d, ox + d + w, oy + d + h],
    west: [ox + d + w, oy + d, ox + d * 2 + w, oy + d + h],
    south: [ox + d * 2 + w, oy + d, ox + d * 2 + w * 2, oy + d + h],
  }
  return Object.fromEntries(
    FACES.map((k) => [k, { uv: rects[k], texture, rotation: 0 as const }]),
  ) as Record<FaceKey, { uv: UVRect; texture: string | null; rotation: 0 }>
}
