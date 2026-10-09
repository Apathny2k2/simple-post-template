/* Texture meshes: Blockbench's sprite made solid from a texture's pixels,
   the way Minecraft builds a held item from its icon. The texture's first
   frame is laid flat, one pixel deep: a face in front and one behind cover
   the whole picture (clear pixels show nothing), and every edge of a pixel
   that borders a clear one, or the edge of the picture, gets a strip
   coloured by that pixel.

   In Vellum a texture mesh is a mesh that remembers its texture
   (`fromTexture`), so the outliner, the gizmo, hiding and every exporter
   treat it as any mesh. Its faces are built from the pixels: when the
   texture is painted the faces are built again. Editing its faces by hand
   makes it an ordinary mesh. */

import type { Mesh, MeshFace, Model, Texture, Vec3 } from './model'
import { frameHeight } from './texture-anim'
import { newId } from './new-model'

type UV = [number, number]

const round = (v: number) => Math.round(v * 1e4) / 1e4 || 0

/** Which of the first frame's pixels show (alpha above zero), row by row from the top. */
async function opaqueOf(t: Texture, model: Pick<Model, 'resolution'>): Promise<{ w: number; h: number; on: (x: number, y: number) => boolean } | null> {
  if (!t.source) return null
  // decoded here and let go, as painting makes a new image every stroke
  const img = new Image()
  img.src = t.source
  try {
    await img.decode()
  } catch {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, t.width)
  canvas.height = Math.max(1, t.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const w = t.width
  const h = Math.max(1, Math.round(frameHeight(t, model)))
  const data = ctx.getImageData(0, 0, w, h).data
  return { w, h, on: (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0 }
}

/**
 * The faces of a texture mesh, as a mesh's vertices and faces. The picture
 * is centred on x, stands on y = 0 and is centred on z, one UV unit per
 * texel, one pixel deep; then scaled, and moved by the local pivot.
 */
export async function textureMeshGeometry(
  t: Texture,
  model: Pick<Model, 'resolution'>,
  scale: Vec3 = [1, 1, 1],
  localPivot: Vec3 = [0, 0, 0],
): Promise<Pick<Mesh, 'vertices' | 'faces'> | null> {
  const px = await opaqueOf(t, model)
  if (!px) return null
  const W = t.uvWidth || model.resolution.width
  const H = t.uvHeight || model.resolution.height
  const pu = W / px.w
  const pv = H / px.h
  const depth = pu
  const vertices: Record<string, Vec3> = {}
  const byPos = new Map<string, string>()
  const faces: Record<string, MeshFace> = {}
  const vertex = (x: number, y: number, z: number): string => {
    const p: Vec3 = [round(x * scale[0] - localPivot[0]), round(y * scale[1] - localPivot[1]), round(z * scale[2] - localPivot[2])]
    const key = p.join(',')
    let k = byPos.get(key)
    if (!k) {
      k = newId().slice(0, 8)
      byPos.set(key, k)
      vertices[k] = p
    }
    return k
  }
  const face = (corners: Array<[number, number, number]>, uvs: UV[]) => {
    const keys = corners.map(([x, y, z]) => vertex(x, y, z))
    if (new Set(keys).size < 3) return
    faces[newId().slice(0, 8)] = { vertices: keys, uv: Object.fromEntries(keys.map((k, i) => [k, [round(uvs[i][0]), round(uvs[i][1])] as UV])), texture: t.id }
  }
  const x0 = -W / 2
  const zf = depth / 2
  const zb = -depth / 2
  // the whole picture in front, and mirrored behind, as Minecraft draws an item's back
  face(
    [
      [x0, 0, zf],
      [x0 + W, 0, zf],
      [x0 + W, H, zf],
      [x0, H, zf],
    ],
    [
      [0, H],
      [W, H],
      [W, 0],
      [0, 0],
    ],
  )
  face(
    [
      [x0, H, zb],
      [x0 + W, H, zb],
      [x0 + W, 0, zb],
      [x0, 0, zb],
    ],
    [
      [0, 0],
      [W, 0],
      [W, H],
      [0, H],
    ],
  )
  // a strip on every pixel edge that borders a clear pixel, coloured by the pixel
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (!px.on(x, y)) continue
      const l = x0 + x * pu
      const r = l + pu
      const top = H - y * pv
      const bot = top - pv
      const uv: UV[] = [
        [x * pu, y * pv],
        [(x + 1) * pu, y * pv],
        [(x + 1) * pu, (y + 1) * pv],
        [x * pu, (y + 1) * pv],
      ]
      if (!px.on(x, y - 1)) face([[l, top, zf], [r, top, zf], [r, top, zb], [l, top, zb]], uv)
      if (!px.on(x, y + 1)) face([[l, bot, zb], [r, bot, zb], [r, bot, zf], [l, bot, zf]], uv)
      if (!px.on(x + 1, y)) face([[r, bot, zf], [r, bot, zb], [r, top, zb], [r, top, zf]], uv)
      if (!px.on(x - 1, y)) face([[l, top, zf], [l, top, zb], [l, bot, zb], [l, bot, zf]], uv)
    }
  }
  return { vertices, faces }
}

/** A texture mesh with its faces built from its texture as it is now; unchanged when the texture has no image. */
export async function rebuildTextureMesh(mesh: Mesh, model: Model): Promise<Mesh> {
  const from = mesh.fromTexture
  if (!from) return mesh
  const t = model.textures.find((x) => x.id === from.texture)
  if (!t) return mesh
  const g = await textureMeshGeometry(t, model, from.scale, from.localPivot)
  return g ? { ...mesh, ...g } : mesh
}

/** Every texture mesh of the model built from its texture, as after opening a Blockbench project. */
export async function rebuildTextureMeshes(model: Model): Promise<Model> {
  if (!model.meshes?.some((m) => m.fromTexture)) return model
  const meshes = await Promise.all(model.meshes.map((m) => (m.fromTexture ? rebuildTextureMesh(m, model) : m)))
  return { ...model, meshes }
}

/** A new texture mesh of a texture, standing on `origin`. */
export async function makeTextureMesh(model: Model, texture: Texture, parent: string | null, origin: Vec3, name = 'texture mesh'): Promise<Mesh | null> {
  const mesh: Mesh = {
    id: newId(),
    name,
    parent,
    origin,
    rotation: [0, 0, 0],
    vertices: {},
    faces: {},
    visible: true,
    locked: false,
    fromTexture: { texture: texture.id, scale: [1, 1, 1], localPivot: [0, 0, 0] },
  }
  const built = await rebuildTextureMesh(mesh, model)
  return Object.keys(built.faces).length ? built : null
}
