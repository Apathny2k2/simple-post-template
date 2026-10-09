/* A posed model as what the renderer draws: triangles grouped by texture,
   edge lines, and a record of every triangle for picking. Built on the CPU
   each time the pose or the model changes; a model of a few hundred cubes
   is a few thousand triangles, which this does in well under a frame.

   Cubes take their faces from the exporters' `quads`, so UVs, face turns
   and inflate are the same ones glTF gets. Shading is fixed per face
   direction in the element's own frame, as the editor has always drawn it. */

import { textureById } from '../model'
import type { Bone, FaceKey, Model, Pose, Texture, Vec3 } from '../model'
import { applyDir, buildRig, cubeFrame, meshFrame, rotationMatrix } from '../kinematics'
import { faceNormal, facePieces } from '../mesh'
import { quads } from '../exporters'
import type { Rgba } from './renderer'

/** One triangle as picking needs it. */
export type PickTri = {
  kind: 'cube' | 'mesh'
  id: string
  /** a cube's face name or a mesh's face key */
  face: string
  /** corners in model space (before the display transform) */
  p: [Vec3, Vec3, Vec3]
  /** corners' UVs in the texture's UV units */
  uv: [[number, number], [number, number], [number, number]]
  /** corners in the element's own frame: a mesh's vertex offsets; unused for cubes */
  local: [Vec3, Vec3, Vec3]
}

/** Triangles sharing one texture, or none. Each corner: x y z, u v (0..1), r g b a. */
export type TriBatch = { texture: Texture | null; data: number[]; doubleSided: boolean; overlay?: boolean }

export type BuiltScene = {
  batches: TriBatch[]
  /** pairs of points with a colour each: x y z r g b a */
  lines: number[]
  /** lines drawn over everything, for the wireframe */
  topLines: number[]
  picks: PickTri[]
  /** each element's corners in model space, for the hidden hook layer and box select */
  outlines: Array<{ kind: 'cube' | 'mesh'; id: string; bone: string | null; face: string; tri?: boolean; picked?: boolean; points: Vec3[] }>
}

export type SceneOptions = {
  pose: Pose
  selected: ReadonlySet<string>
  /** faces of one mesh to tint, while picking faces */
  pickedFaces?: { mesh: string; faces: ReadonlySet<string> } | null
  wire?: boolean
  /** a flat tint instead of textures, for onion skin */
  ghost?: Rgba | null
  accent: Rgba
}

const EDGE: Rgba = [0, 0, 0, 0.22]
const BLANK_CUBE: Rgba = [146 / 255, 165 / 255, 202 / 255, 0.25]
const BLANK_MESH: Rgba = [146 / 255, 165 / 255, 202 / 255, 0.35]
const PICKED: Rgba = [1, 214 / 255, 107 / 255, 0.42]
const NORMALS: Record<FaceKey, Vec3> = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] }

/** The brightness a face gets in each direction, blended by its normal, so meshes and cubes are shaded alike. */
export function shadeOf(n: Vec3): number {
  const [x, y, z] = n
  return x * x * (x > 0 ? 0.9 : 0.84) + y * y * (y > 0 ? 1.14 : 0.62) + z * z * (z > 0 ? 1 : 0.78)
}

export function buildScene(model: Model, o: SceneOptions): BuiltScene {
  const rig = buildRig(model, o.pose)
  const batches = new Map<string, TriBatch>()
  const lines: number[] = []
  const topLines: number[] = []
  const picks: PickTri[] = []
  const outlines: BuiltScene['outlines'] = []
  const batchOf = (tex: Texture | null, doubleSided: boolean, overlay = false) => {
    const key = `${tex?.id ?? ''}|${doubleSided}|${overlay}`
    let b = batches.get(key)
    if (!b) batches.set(key, (b = { texture: tex, data: [], doubleSided, overlay }))
    return b
  }
  const vert = (b: TriBatch, p: Vec3, uv: [number, number], c: Rgba) => b.data.push(p[0], p[1], p[2], uv[0], uv[1], c[0], c[1], c[2], c[3])
  const line = (into: number[], a: Vec3, b: Vec3, c: Rgba) => into.push(a[0], a[1], a[2], c[0], c[1], c[2], c[3], b[0], b[1], b[2], c[0], c[1], c[2], c[3])

  // cubes, under bones that are shown
  const walk = (list: Bone[]) => {
    for (const bone of list) {
      if (!bone.visible) continue
      for (const child of bone.children) {
        if (child.kind === 'bone') {
          walk([child.bone])
          continue
        }
        const cube = model.cubes.find((c) => c.id === child.id)
        if (!cube || !cube.visible) continue
        const frame = cubeFrame(rig, cube)
        const place = (p: Vec3): Vec3 => {
          const q = frame.transformPoint(new DOMPoint(p[0] - cube.origin[0], p[1] - cube.origin[1], p[2] - cube.origin[2]))
          return [q.x, q.y, q.z]
        }
        const isSel = o.selected.has(cube.id)
        for (const q of quads(model, cube, place, (v) => v)) {
          const face = q.face as FaceKey
          const tex = o.ghost ? null : textureById(model, q.texture)
          const live = tex?.source ? tex : null
          const shade = live?.shaded ? 1 : shadeOf(NORMALS[face])
          const colour: Rgba = o.ghost ?? (live ? [shade, shade, shade, 1] : BLANK_CUBE)
          const [a, b, c, d] = q.points
          const W = (tex?.uvWidth || model.resolution.width) || 1
          const H = (tex?.uvHeight || model.resolution.height) || 1
          if (!o.wire) {
            const batch = batchOf(live, false, !!o.ghost)
            // the corners run clockwise from outside: (a, b, c) and (a, c, d)
            for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
              vert(batch, q.points[i], q.uv[i], colour)
              vert(batch, q.points[j], q.uv[j], colour)
              vert(batch, q.points[k], q.uv[k], colour)
            }
          }
          if (!o.ghost) {
            const texel = (i: number): [number, number] => [q.uv[i][0] * W, q.uv[i][1] * H]
            const zero: Vec3 = [0, 0, 0]
            picks.push({ kind: 'cube', id: cube.id, face, p: [a, b, c], uv: [texel(0), texel(1), texel(2)], local: [zero, zero, zero] })
            picks.push({ kind: 'cube', id: cube.id, face, p: [a, c, d], uv: [texel(0), texel(2), texel(3)], local: [zero, zero, zero] })
            outlines.push({ kind: 'cube', id: cube.id, bone: bone.id, face, points: q.points })
            const edgeColour = o.wire ? o.accent : isSel ? o.accent : EDGE
            const into = o.wire ? topLines : lines
            for (let i = 0; i < 4; i++) line(into, q.points[i], q.points[(i + 1) % 4], edgeColour)
          }
        }
      }
    }
  }
  walk(model.bones)

  // meshes: on their bone when it is shown, at the root when they name none the model has
  const hidden = new Set<string>()
  const hide = (list: Bone[], off: boolean) =>
    list.forEach((b) => {
      if (off || !b.visible) hidden.add(b.id)
      hide(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])), off || !b.visible)
    })
  hide(model.bones, false)
  for (const mesh of model.meshes ?? []) {
    if (!mesh.visible || (mesh.parent && hidden.has(mesh.parent))) continue
    const frame = meshFrame(rig, mesh)
    const place = (k: string): Vec3 => {
      const v = mesh.vertices[k]
      const q = frame.transformPoint(new DOMPoint(v[0], v[1], v[2]))
      return [q.x, q.y, q.z]
    }
    const isSel = o.selected.has(mesh.id)
    const picking = o.pickedFaces?.mesh === mesh.id ? o.pickedFaces.faces : null
    for (const [key, face] of Object.entries(mesh.faces)) {
      if (face.vertices.length < 3) continue
      const tex = o.ghost ? null : textureById(model, face.texture)
      const live = tex?.source ? tex : null
      const W = (tex?.uvWidth || model.resolution.width) || 1
      const H = (tex?.uvHeight || model.resolution.height) || 1
      // shaded by the face's direction under the mesh's own turn; its bone's turn is left out
      const n = applyDir(rotationMatrix(mesh.rotation), faceNormal(mesh, face))
      const shade = live?.shaded ? 1 : shadeOf(n)
      const colour: Rgba = o.ghost ?? (live ? [shade, shade, shade, 1] : BLANK_MESH)
      const pieces = facePieces(mesh, face)
      const isPicked = !!picking?.has(key)
      for (const piece of pieces) {
        const keys = piece.keys
        const pts = keys.map(place)
        const uvs = keys.map((k) => face.uv[k] ?? [0, 0])
        // a flat piece of more than three corners is a fan from its first
        for (let i = 1; i + 1 < keys.length; i++) {
          const tri = [0, i, i + 1]
          if (!o.wire) {
            const batch = batchOf(live, true, !!o.ghost)
            for (const j of tri) vert(batch, pts[j], [uvs[j][0] / W, uvs[j][1] / H], colour)
            if (isPicked) {
              const over = batchOf(null, true, true)
              for (const j of tri) vert(over, pts[j], [0, 0], PICKED)
            }
          }
          if (!o.ghost) {
            picks.push({
              kind: 'mesh',
              id: mesh.id,
              face: key,
              p: [pts[0], pts[i], pts[i + 1]],
              uv: [uvs[0], uvs[i], uvs[i + 1]],
              local: [mesh.vertices[keys[0]], mesh.vertices[keys[i]], mesh.vertices[keys[i + 1]]],
            })
          }
        }
        if (!o.ghost) {
          outlines.push({ kind: 'mesh', id: mesh.id, bone: mesh.parent, face: key, tri: pieces.length > 1, picked: isPicked, points: pts })
          if (isSel || o.wire) {
            piece.outer.forEach((outer, i) => {
              if (outer) line(o.wire ? topLines : lines, pts[i], pts[(i + 1) % pts.length], o.accent)
            })
          }
        }
      }
    }
  }
  return { batches: [...batches.values()], lines, topLines, picks, outlines }
}

