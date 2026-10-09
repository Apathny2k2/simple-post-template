/* Editing UVs by hand, as Blockbench's UV editor does: move a face's
   rectangle, drag its edges, keep a box unwrap following its cube, give
   faces a texture, and unwrap a cube again after it changed size. */

import { FACES, cubeSize } from './model'
import type { Cube, Face, FaceKey, Model, Texture, UVRect } from './model'
import { boxUvFaces, makeRoom } from './uv-pack'
import type { Rescale } from './uv-pack'

/** Where a box unwrap starts: the stored offset, or the top left of its faces. */
export function unwrapOrigin(c: Cube): [number, number] {
  if (c.uvOffset) return [c.uvOffset[0], c.uvOffset[1]]
  let x = Infinity
  let y = Infinity
  for (const k of FACES) {
    const [x1, y1, x2, y2] = c.faces[k].uv
    x = Math.min(x, x1, x2)
    y = Math.min(y, y1, y2)
  }
  return [Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0]
}

/**
 * The box unwrap of a cube at `at`, keeping each face's texture and turn.
 * A mirrored cube swaps east for west and reads every face right to left.
 */
export function boxFaces(c: Cube, at: [number, number]): Record<FaceKey, Face> {
  const rects = boxUvFaces(cubeSize(c), at, null)
  const out = {} as Record<FaceKey, Face>
  for (const k of FACES) {
    const src = c.mirrorUv ? (k === 'east' ? 'west' : k === 'west' ? 'east' : k) : k
    const [x1, y1, x2, y2] = rects[src].uv
    out[k] = { ...c.faces[k], uv: c.mirrorUv ? [x2, y1, x1, y2] : [x1, y1, x2, y2] }
  }
  return out
}

/** With box UV on, the faces follow the cube's size. Off, the cube is returned as it is. */
export function followBoxUv(c: Cube): Cube {
  if (!c.boxUv) return c
  const at = unwrapOrigin(c)
  return { ...c, uvOffset: at, faces: boxFaces(c, at) }
}

/** Turns box UV on (the faces snap to an unwrap at their top left) or off (the faces stay put). */
export function setBoxUv(c: Cube, on: boolean): Cube {
  if (!on) return { ...c, boxUv: false }
  // the stored start, while the faces still sit where it put them; otherwise their top left
  const stored = c.uvOffset && sameFaces(boxFaces(c, c.uvOffset), c.faces) ? c.uvOffset : null
  return followBoxUv({ ...c, boxUv: true, uvOffset: stored ?? unwrapOrigin({ ...c, uvOffset: undefined }) })
}

const sameFaces = (a: Record<FaceKey, Face>, b: Record<FaceKey, Face>) =>
  FACES.every((k) => a[k].uv.every((v, i) => v === b[k].uv[i]))

const shift = (uv: UVRect, dx: number, dy: number): UVRect => [uv[0] + dx, uv[1] + dy, uv[2] + dx, uv[3] + dy]

/** Moves one face's rectangle, or the whole unwrap when box UV is on. */
export function moveFaceUv(c: Cube, face: FaceKey, dx: number, dy: number): Cube {
  if (!dx && !dy) return c
  if (c.boxUv) {
    const [ox, oy] = unwrapOrigin(c)
    return followBoxUv({ ...c, uvOffset: [ox + dx, oy + dy] })
  }
  return { ...c, faces: { ...c.faces, [face]: { ...c.faces[face], uv: shift(c.faces[face].uv, dx, dy) } } }
}

/** Moves several faces of one cube together. */
export function moveFacesUv(c: Cube, faces: readonly FaceKey[], dx: number, dy: number): Cube {
  if (c.boxUv) return moveFaceUv(c, faces[0] ?? 'north', dx, dy)
  let out = c
  for (const f of faces) out = moveFaceUv(out, f, dx, dy)
  return out
}

/** An edge or corner of a UV rectangle, by compass point; north is the top of the sheet. */
export type UvHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Drags an edge or corner of a face's rectangle. The rectangle keeps its
 * mirroring: a face stored right to left stays right to left. An edge
 * stops one texel short of the opposite edge.
 */
export function resizeFaceUv(c: Cube, face: FaceKey, handle: UvHandle, dx: number, dy: number): Cube {
  const uv = c.faces[face].uv
  const flipX = uv[0] > uv[2]
  const flipY = uv[1] > uv[3]
  let [l, t, r, b] = [Math.min(uv[0], uv[2]), Math.min(uv[1], uv[3]), Math.max(uv[0], uv[2]), Math.max(uv[1], uv[3])]
  if (handle.includes('w')) l = Math.min(l + dx, r - 1)
  if (handle.includes('e')) r = Math.max(r + dx, l + 1)
  if (handle.includes('n')) t = Math.min(t + dy, b - 1)
  if (handle.includes('s')) b = Math.max(b + dy, t + 1)
  const next: UVRect = [flipX ? r : l, flipY ? b : t, flipX ? l : r, flipY ? t : b]
  return { ...c, faces: { ...c.faces, [face]: { ...c.faces[face], uv: next } } }
}

/**
 * Unwraps cubes again, as a fresh box at their size. Each stays where its
 * unwrap starts when that still fits and overlaps no other cube; otherwise
 * it moves to the first free spot, and the sheet doubles if there is none.
 * Pixels are not moved, so a cube that moves needs painting again.
 */
export function reunwrap(model: Model, ids: readonly string[], rescale: Rescale | null): { model: Model; moved: string[]; failed: string[] } {
  let m = model
  const moved: string[] = []
  const failed: string[] = []
  for (const id of ids) {
    const c = m.cubes.find((x) => x.id === id)
    if (!c || c.locked) continue
    const at = unwrapOrigin(c)
    // the cube's own faces must not count as taken
    const empty = Object.fromEntries(FACES.map((k) => [k, { ...c.faces[k], uv: [0, 0, 0, 0] as UVRect }])) as Cube['faces']
    const without: Model = { ...m, cubes: m.cubes.map((x) => (x.id === id ? { ...x, faces: empty } : x)) }
    const stay = boxFaces(c, at)
    if (fits(without, stay)) {
      m = { ...m, cubes: m.cubes.map((x) => (x.id === id ? { ...x, uvOffset: at, faces: stay } : x)) }
      continue
    }
    const room = makeRoom(without, cubeSize(c), rescale)
    if (!room.at) {
      failed.push(id)
      continue
    }
    const placed = room.model.cubes.find((x) => x.id === id)!
    const faces = boxFaces({ ...c, faces: c.faces }, room.at)
    m = { ...room.model, cubes: room.model.cubes.map((x) => (x.id === id ? { ...placed, faces, uvOffset: room.at! } : x)) }
    moved.push(id)
  }
  return { model: m, moved, failed }
}

const norm = (uv: UVRect): UVRect => [Math.min(uv[0], uv[2]), Math.min(uv[1], uv[3]), Math.max(uv[0], uv[2]), Math.max(uv[1], uv[3])]

/** Whether faces sit inside the sheet and clear of every other cube's faces. */
function fits(model: Model, faces: Record<FaceKey, Face>): boolean {
  const { width, height } = model.resolution
  const mine = FACES.map((k) => norm(faces[k].uv))
  if (mine.some((r) => r[0] < 0 || r[1] < 0 || r[2] > width || r[3] > height)) return false
  for (const c of model.cubes) {
    for (const k of FACES) {
      const o = norm(c.faces[k].uv)
      if (o[2] <= o[0] || o[3] <= o[1]) continue
      if (mine.some((r) => r[0] < o[2] && o[0] < r[2] && r[1] < o[3] && o[1] < r[3])) return false
    }
  }
  return true
}

/** Gives faces of the cubes a texture: all six, or just `faces`. Locked cubes are skipped. */
export function assignTexture(model: Model, ids: readonly string[], texture: string | null, faces?: readonly FaceKey[]): Model {
  const set = new Set(ids)
  const keys = faces ?? FACES
  return {
    ...model,
    cubes: model.cubes.map((c) => {
      if (!set.has(c.id) || c.locked) return c
      const next = { ...c.faces }
      for (const k of keys) next[k] = { ...next[k], texture }
      return { ...c, faces: next }
    }),
  }
}

/** Removes a texture. Faces that used it take the first texture left, or none. */
export function removeTexture(model: Model, id: string): Model {
  const textures = model.textures.filter((t) => t.id !== id)
  const fallback = textures[0]?.id ?? null
  return {
    ...model,
    textures,
    cubes: model.cubes.map((c) => {
      if (!FACES.some((k) => c.faces[k].texture === id)) return c
      const faces = { ...c.faces }
      for (const k of FACES) if (faces[k].texture === id) faces[k] = { ...faces[k], texture: fallback }
      return { ...c, faces }
    }),
  }
}

/** A name not yet taken by a texture, from `base` ("skin.png", "skin_2.png", ...). */
export function freeTextureName(model: Model, base: string): string {
  const stem = base.replace(/\.png$/i, '') || 'texture'
  const taken = new Set(model.textures.map((t) => t.name.toLowerCase()))
  if (!taken.has(`${stem}.png`.toLowerCase())) return `${stem}.png`
  let i = 2
  while (taken.has(`${stem}_${i}.png`.toLowerCase())) i++
  return `${stem}_${i}.png`
}

/** Pixels per UV unit across and down, for a texture drawn larger or smaller than the sheet. */
export function pixelScale(model: Model, t: Texture): [number, number] {
  return [t.width / (t.uvWidth || model.resolution.width), t.height / (t.uvHeight || model.resolution.height)]
}

/**
 * Where a point on a face lands when the model is mirrored across X, for
 * Blockbench's mirror painting: the cube whose box is this one's mirror
 * image (itself, for a cube centred on X), with east and west swapped and
 * the face read the other way across. Null when no cube mirrors it.
 */
export function mirrorPoint(model: Model, cube: Cube, face: FaceKey, u: number, v: number): { cube: Cube; face: FaceKey; u: number; v: number } | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3
  const twin = model.cubes.find(
    (c) =>
      near(c.from[0], -cube.to[0]) &&
      near(c.to[0], -cube.from[0]) &&
      near(c.from[1], cube.from[1]) &&
      near(c.to[1], cube.to[1]) &&
      near(c.from[2], cube.from[2]) &&
      near(c.to[2], cube.to[2]),
  )
  if (!twin) return null
  const swapped: FaceKey = face === 'east' ? 'west' : face === 'west' ? 'east' : face
  return { cube: twin, face: swapped, u: 1 - u, v }
}
