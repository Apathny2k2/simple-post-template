/* ---------------------------------------------------------------
   Finding room on the sheet.

   A box unwrap needs a rectangle `2(w+d)` wide and `d+h` tall. The old
   code picked the lowest y any face reached and put the next box
   there, then clamped the result into the sheet - so on an atlas that
   already reached the bottom edge, every face of the new cube was
   clamped to zero height and the cube arrived unpaintable, with the
   validator calling it clean. On a small sheet it was worse: once the
   lowest point passed the limit it returned the origin forever, and
   every cube you added landed on the same island.

   So: pack properly, and when the sheet is genuinely full, make the
   sheet bigger rather than folding the box flat. Doubling the UV space
   and doubling every existing coordinate is a visual no-op - the same
   texels stay under the same faces - and pixel-doubling the image is
   lossless for pixel art. The bottom-right three quarters come back as
   free space.
   --------------------------------------------------------------- */

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

/**
 * First fit, scanning only the corners existing islands create - the
 * top-left of a free rectangle always sits against one of them, so
 * this finds a spot if one exists without walking every texel.
 */
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

/**
 * Double the UV space. Every coordinate doubles with it, so nothing
 * moves relative to the texture - the sheet simply gains room.
 */
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
        // a texture we could not redraw keeps its pixels and simply
        // samples a quarter of the new space - wrong, but visible and
        // repaintable, which a blank sheet would not be
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

/**
 * Room for a box of this size, growing the sheet up to `limit` times if
 * it has to. Returns the model to place into - which may be a bigger
 * one than you passed.
 */
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

/** The faces of a box unwrap laid out at `at`. Never degenerate. */
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
