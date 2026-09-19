/* ---------------------------------------------------------------
   Making models, and growing them.

   A new project starts from a starter rather than an empty scene:
   an item is one cube you can immediately resize, a mob arrives rigged,
   because a rig is tedious to build by hand and is what makes Animate
   mode useful at all.

   Everything here returns a new Model rather than mutating one, so the
   editor's undo stack is a matter of keeping old references.
   --------------------------------------------------------------- */

import { FACES } from './model'
import { boxUvFaces, makeRoom } from './uv-pack'
import type { Rescale } from './uv-pack'
import type { Bone, BoneChild, Cube, Face, FaceKey, Model, Texture, UVRect, Vec3 } from './model'

export type NewModelKind = 'items' | 'mobs'

let counter = 0
export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${(counter += 1)}`

/* ---------------- starter texture ---------------- */

/**
 * A neutral sheet with a faint 8-texel check, so the first brush stroke
 * is visible and the UV islands are legible before anything is painted.
 */
export function starterTexture(size: number, name: string): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#6a6f80'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#767c8e'
    for (let y = 0; y < size; y += 8) {
      for (let x = 0; x < size; x += 8) {
        if (((x / 8) + (y / 8)) % 2 === 0) ctx.fillRect(x, y, 8, 8)
      }
    }
  }
  return {
    id: newId(),
    name,
    width: size,
    height: size,
    uvWidth: size,
    uvHeight: size,
    source: canvas.toDataURL('image/png'),
  }
}

/* ---------------- pieces ---------------- */

export function makeCube(
  name: string,
  from: Vec3,
  to: Vec3,
  opts: { origin?: Vec3; rotation?: Vec3; uvAt?: [number, number]; texture?: string | null } = {},
): Cube {
  const size: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  return {
    id: newId(),
    name,
    from,
    to,
    origin: opts.origin ?? [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2],
    rotation: opts.rotation ?? [0, 0, 0],
    faces: boxUvFaces(size, opts.uvAt ?? [0, 0], opts.texture ?? null),
    inflate: 0,
    boxUv: false,
    visible: true,
    locked: false,
  }
}

export function makeBone(name: string, origin: Vec3, children: BoneChild[] = []): Bone {
  return {
    id: newId(),
    name,
    origin,
    rotation: [0, 0, 0],
    visible: true,
    locked: false,
    children,
  }
}

/* ---------------- starters ---------------- */

export function createModel(kind: NewModelKind, name: string): Model {
  return kind === 'mobs' ? mobStarter(name) : itemStarter(name)
}

function itemStarter(name: string): Model {
  /* 32 rather than 16: the starter cube is 8 x 16 x 8, whose unwrap
     needs 32 x 24 texels. On a 16-wide sheet three of its six faces
     used to be clamped to zero width, so the model you were handed had
     half its faces unpaintable before you touched it. */
  const texture = starterTexture(32, `${name}.png`)
  const cube = makeCube('cube', [4, 0, 4], [12, 16, 12], { uvAt: [0, 0], texture: texture.id })
  const root = makeBone(name, [0, 0, 0], [{ kind: 'cube', id: cube.id }])

  return {
    name,
    kind: 'items',
    resolution: { width: 32, height: 32 },
    bones: [root],
    cubes: [cube],
    textures: [texture],
    clips: [],
  }
}

function mobStarter(name: string): Model {
  const texture = starterTexture(64, `${name}.png`)
  const L = 64
  const t = texture.id

  // pivots sit on the joints, which is what makes the rig animate properly
  const head = makeCube('head', [-4, 24, -4], [4, 32, 4], { origin: [0, 24, 0], uvAt: [0, 0], texture: t })
  const torso = makeCube('torso', [-4, 12, -2], [4, 24, 2], { origin: [0, 12, 0], uvAt: [16, 16], texture: t })
  const armL = makeCube('arm_left', [-8, 12, -2], [-4, 24, 2], { origin: [-4, 23, 0], uvAt: [40, 16], texture: t })
  const armR = makeCube('arm_right', [4, 12, -2], [8, 24, 2], { origin: [4, 23, 0], uvAt: [40, 32], texture: t })
  const legL = makeCube('leg_left', [-4, 0, -2], [0, 12, 2], { origin: [-2, 12, 0], uvAt: [0, 32], texture: t })
  const legR = makeCube('leg_right', [0, 0, -2], [4, 12, 2], { origin: [2, 12, 0], uvAt: [16, 32], texture: t })

  const root = makeBone(name, [0, 0, 0], [
    {
      kind: 'bone',
      bone: makeBone('torso', [0, 12, 0], [
        { kind: 'cube', id: torso.id },
        { kind: 'bone', bone: makeBone('head', [0, 24, 0], [{ kind: 'cube', id: head.id }]) },
        { kind: 'bone', bone: makeBone('arm_left', [-4, 23, 0], [{ kind: 'cube', id: armL.id }]) },
        { kind: 'bone', bone: makeBone('arm_right', [4, 23, 0], [{ kind: 'cube', id: armR.id }]) },
      ]),
    },
    { kind: 'bone', bone: makeBone('leg_left', [-2, 12, 0], [{ kind: 'cube', id: legL.id }]) },
    { kind: 'bone', bone: makeBone('leg_right', [2, 12, 0], [{ kind: 'cube', id: legR.id }]) },
  ])

  return {
    name,
    kind: 'mobs',
    resolution: { width: L, height: L },
    bones: [root],
    cubes: [head, torso, armL, armR, legL, legR],
    textures: [texture],
    clips: [],
  }
}

/* ---------------- growing a model ---------------- */

/** Where the next cube should go: stacked on top of the model so far. */
function nextSpot(model: Model): { from: Vec3; to: Vec3 } {
  if (!model.cubes.length) return { from: [-4, 0, -4], to: [4, 8, 4] }
  let top = -Infinity
  for (const c of model.cubes) top = Math.max(top, c.to[1])
  return { from: [-4, top, -4], to: [4, top + 8, 4] }
}

function addChild(bones: Bone[], parentId: string | null, child: BoneChild): Bone[] {
  if (!parentId) {
    if (!bones.length) return bones
    return [{ ...bones[0], children: [...bones[0].children, child] }, ...bones.slice(1)]
  }
  return bones.map((b) => {
    if (b.id === parentId) return { ...b, children: [...b.children, child] }
    return {
      ...b,
      children: b.children.map((c) =>
        c.kind === 'bone' ? { kind: 'bone' as const, bone: addChild([c.bone], parentId, child)[0] } : c,
      ),
    }
  })
}

/**
 * Add a cube, parented to `parentId` when given and to the first root
 * otherwise. `rescale` lets the sheet grow when it is full; without one
 * a full sheet means the new cube shares an island rather than getting
 * a degenerate one, which is at least recoverable by hand.
 */
export function addCube(
  model: Model,
  parentId: string | null = null,
  rescale: Rescale | null = null,
): { model: Model; id: string } {
  const spot = nextSpot(model)
  const size: Vec3 = [spot.to[0] - spot.from[0], spot.to[1] - spot.from[1], spot.to[2] - spot.from[2]]
  const room = makeRoom(model, size, rescale)
  const base = room.model

  const cube = makeCube(`cube_${base.cubes.length + 1}`, spot.from, spot.to, {
    uvAt: room.at ?? [0, 0],
    texture: base.textures[0]?.id ?? null,
  })

  const bones = base.bones.length
    ? addChild(base.bones, parentId, { kind: 'cube', id: cube.id })
    : [makeBone(base.name, [0, 0, 0], [{ kind: 'cube', id: cube.id }])]

  return { model: { ...base, cubes: [...base.cubes, cube], bones }, id: cube.id }
}

export function addBone(model: Model, parentId: string | null = null): { model: Model; id: string } {
  const bone = makeBone(`bone_${countBones(model.bones) + 1}`, [0, 0, 0])
  const bones = model.bones.length
    ? addChild(model.bones, parentId, { kind: 'bone', bone })
    : [bone]
  return { model: { ...model, bones }, id: bone.id }
}

function countBones(bones: Bone[]): number {
  return bones.reduce(
    (n, b) => n + 1 + countBones(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone)),
    0,
  )
}

/** Remove a cube, the bone-tree entry that held it, and any key that drove it. */
export function deleteCube(model: Model, id: string): Model {
  const strip = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...b,
      children: b.children
        .filter((c) => !(c.kind === 'cube' && c.id === id))
        .map((c) => (c.kind === 'bone' ? { kind: 'bone' as const, bone: strip([c.bone])[0] } : c)),
    }))

  return { ...model, cubes: model.cubes.filter((c) => c.id !== id), bones: strip(model.bones) }
}

/** Remove a bone and everything under it, cubes included. */
export function deleteBone(model: Model, id: string): Model {
  const doomed = new Set<string>()
  const collect = (b: Bone) => {
    for (const c of b.children) {
      if (c.kind === 'cube') doomed.add(c.id)
      else collect(c.bone)
    }
  }
  const find = (bones: Bone[]): Bone | null => {
    for (const b of bones) {
      if (b.id === id) return b
      const nested = find(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))
      if (nested) return nested
    }
    return null
  }
  const target = find(model.bones)
  if (!target) return model
  collect(target)

  const strip = (bones: Bone[]): Bone[] =>
    bones
      .filter((b) => b.id !== id)
      .map((b) => ({
        ...b,
        children: b.children
          .filter((c) => !(c.kind === 'bone' && c.bone.id === id))
          .map((c) => (c.kind === 'bone' ? { kind: 'bone' as const, bone: strip([c.bone])[0] } : c)),
      }))

  return {
    ...model,
    cubes: model.cubes.filter((c) => !doomed.has(c.id)),
    bones: strip(model.bones),
    // a clip driving a bone that no longer exists would fail validation
    clips: model.clips.map((clip) => ({ ...clip, tracks: clip.tracks.filter((t) => t.bone !== id) })),
  }
}

export function duplicateCube(model: Model, id: string): { model: Model; id: string } | null {
  const source = model.cubes.find((c) => c.id === id)
  if (!source) return null
  const copy: Cube = {
    ...source,
    id: newId(),
    name: `${source.name}_copy`,
    faces: Object.fromEntries(
      FACES.map((k) => [k, { ...source.faces[k], uv: [...source.faces[k].uv] as UVRect }]),
    ) as Record<FaceKey, Face>,
  }

  const place = (bones: Bone[]): Bone[] =>
    bones.map((b) => {
      const holds = b.children.some((c) => c.kind === 'cube' && c.id === id)
      return {
        ...b,
        children: holds
          ? [...b.children, { kind: 'cube' as const, id: copy.id }]
          : b.children.map((c) =>
              c.kind === 'bone' ? { kind: 'bone' as const, bone: place([c.bone])[0] } : c,
            ),
      }
    })

  return { model: { ...model, cubes: [...model.cubes, copy], bones: place(model.bones) }, id: copy.id }
}
