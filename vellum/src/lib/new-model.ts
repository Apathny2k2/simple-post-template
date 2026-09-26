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
import { defaultSubtype, subtypeFits } from './model'
import type { Bone, BoneChild, Clip, Cube, Face, FaceKey, Key, Model, ProjectKind, Subtype, Texture, UVRect, Vec3 } from './model'

/** Kept as a name because the dialog reads better for it; it is the project kind. */
export type NewModelKind = ProjectKind

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
  const uvAt = opts.uvAt ?? [0, 0]
  return {
    id: newId(),
    name,
    from,
    to,
    origin: opts.origin ?? [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2],
    rotation: opts.rotation ?? [0, 0, 0],
    faces: boxUvFaces(size, uvAt, opts.texture ?? null),
    inflate: 0,
    /* The faces ARE a box unwrap, but the flag stays false: the editor
       lets you drag a face anywhere, so the rects are the truth and
       nothing should regenerate over them. The offset is recorded all
       the same, so a reader that does regenerate has the origin these
       rects came from. */
    boxUv: false,
    uvOffset: [uvAt[0], uvAt[1]],
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

/**
 * A starter for a kind, stamped with the subtype the project asked for.
 *
 * Only one subtype changes what you get: a consumable arrives as a
 * flask that already has its use clip, because a consumable is defined
 * by that clip and starting from a bare cube means starting from
 * something the rules will immediately complain about. Every other
 * subtype is metadata - a weapon and a tool begin from the same cube,
 * because what separates them is what the game does with one, not what
 * it is shaped like.
 */
export function createModel(kind: NewModelKind, name: string, subtype?: Subtype): Model {
  const sub = subtypeFits(kind, subtype) ? subtype : defaultSubtype(kind)
  const base =
    kind === 'mobs'
      ? mobStarter(name)
      : kind === 'blocks'
        ? blockStarter(name)
        : sub === 'consumable'
          ? consumableStarter(name)
          : itemStarter(name)
  return { ...base, kind, subtype: sub }
}

/**
 * A full 16-unit cube, which is what a block is before you carve it.
 * The editor ships a whole block rule set - the -16..32 range, one
 * rotated axis, the fixed angles - that no model a user could create
 * was ever checked against, because there was no way to make one.
 */
function blockStarter(name: string): Model {
  const texture = starterTexture(64, `${name}.png`)
  const cube = makeCube('block', [0, 0, 0], [16, 16, 16], {
    origin: [8, 8, 8],
    uvAt: [0, 0],
    texture: texture.id,
  })
  const root = makeBone(name, [0, 0, 0], [{ kind: 'cube', id: cube.id }])
  return {
    name,
    kind: 'blocks',
    resolution: { width: 64, height: 64 },
    bones: [root],
    cubes: [cube],
    textures: [texture],
    clips: [],
  }
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

/**
 * A flask with a stopper, rigged on two bones and arriving with the
 * clip that makes it a consumable rather than an item: tip it back,
 * the stopper comes away, the level drops. The validator asks for that
 * clip, so the starter had better have one.
 */
function consumableStarter(name: string): Model {
  const texture = starterTexture(32, `${name}.png`)
  const t = texture.id

  const body = makeCube('body', [-3, 0, -3], [3, 8, 3], { origin: [0, 0, 0], uvAt: [0, 0], texture: t })
  const neck = makeCube('neck', [-1.5, 8, -1.5], [1.5, 11, 1.5], { origin: [0, 8, 0], uvAt: [0, 14], texture: t })
  const fill = makeCube('fill', [-2.5, 0.5, -2.5], [2.5, 6, 2.5], { origin: [0, 0.5, 0], uvAt: [12, 14], texture: t })
  const cork = makeCube('cork', [-2, 11, -2], [2, 13, 2], { origin: [0, 11, 0], uvAt: [0, 24], texture: t })

  const corkBone = makeBone('cork', [0, 11, 0], [{ kind: 'cube', id: cork.id }])
  const fillBone = makeBone('fill', [0, 0.5, 0], [{ kind: 'cube', id: fill.id }])
  const root = makeBone(name, [0, 0, 0], [
    { kind: 'cube', id: body.id },
    { kind: 'cube', id: neck.id },
    { kind: 'bone', bone: fillBone },
    { kind: 'bone', bone: corkBone },
  ])

  const key = (time: number, value: Vec3, interp: Key['interp'] = 'catmullrom'): Key => ({
    id: newId(),
    time,
    value,
    interp,
  })

  const use: Clip = {
    id: newId(),
    name: 'use',
    loop: 'once',
    length: 1.6,
    snapping: 24,
    tracks: [
      {
        bone: root.id,
        channel: 'rotation',
        keys: [key(0, [0, 0, 0]), key(0.35, [-18, 0, 4]), key(0.9, [-62, 0, 6]), key(1.6, [0, 0, 0])],
      },
      {
        bone: corkBone.id,
        channel: 'position',
        keys: [key(0, [0, 0, 0]), key(0.3, [0, 0, 0], 'step'), key(0.55, [0, 4, -2]), key(1.6, [0, 0, 0], 'step')],
      },
      {
        bone: corkBone.id,
        channel: 'rotation',
        keys: [key(0, [0, 0, 0]), key(0.3, [0, 0, 0], 'step'), key(0.55, [34, 0, 20]), key(1.6, [0, 0, 0], 'step')],
      },
      {
        bone: fillBone.id,
        channel: 'scale',
        keys: [key(0, [1, 1, 1]), key(0.5, [1, 0.9, 1]), key(1.2, [1, 0.08, 1]), key(1.6, [1, 1, 1], 'step')],
      },
    ],
  }

  return {
    name,
    kind: 'items',
    subtype: 'consumable',
    resolution: { width: 32, height: 32 },
    bones: [root],
    cubes: [body, neck, fill, cork],
    textures: [texture],
    clips: [use],
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

/** Rename a cube or a bone, whichever carries the id. */
export function renameNode(model: Model, id: string, name: string): Model {
  const clean = name.trim().slice(0, 64) || 'unnamed'
  if (model.cubes.some((c) => c.id === id)) {
    return { ...model, cubes: model.cubes.map((c) => (c.id === id ? { ...c, name: clean } : c)) }
  }
  const walk = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...(b.id === id ? { ...b, name: clean } : b),
      children: b.children.map((c) =>
        c.kind === 'bone' ? { kind: 'bone' as const, bone: walk([c.bone])[0] } : c,
      ),
    }))
  return { ...model, bones: walk(model.bones) }
}

/** A bone and everything under it, with fresh ids throughout. */
export function duplicateBone(model: Model, id: string): { model: Model; id: string } | null {
  const find = (bones: Bone[]): Bone | null => {
    for (const b of bones) {
      if (b.id === id) return b
      const nested = find(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))
      if (nested) return nested
    }
    return null
  }
  const source = find(model.bones)
  if (!source) return null

  const made: Cube[] = []
  const copyBone = (bone: Bone, suffix: boolean): Bone => ({
    ...bone,
    id: newId(),
    name: suffix ? `${bone.name}_copy` : bone.name,
    children: bone.children.map((child) => {
      if (child.kind === 'bone') return { kind: 'bone' as const, bone: copyBone(child.bone, false) }
      const cube = model.cubes.find((c) => c.id === child.id)
      if (!cube) return { kind: 'cube' as const, id: child.id }
      const copy: Cube = {
        ...cube,
        id: newId(),
        faces: Object.fromEntries(
          FACES.map((k) => [k, { ...cube.faces[k], uv: [...cube.faces[k].uv] as UVRect }]),
        ) as Record<FaceKey, Face>,
      }
      made.push(copy)
      return { kind: 'cube' as const, id: copy.id }
    }),
  })

  const copy = copyBone(source, true)
  // beside the original, or at the root when the original is one
  const place = (bones: Bone[]): Bone[] => {
    if (bones.some((b) => b.id === id)) return [...bones, copy]
    return bones.map((b) => ({
      ...b,
      children: b.children.some((c) => c.kind === 'bone' && c.bone.id === id)
        ? [...b.children, { kind: 'bone' as const, bone: copy }]
        : b.children.map((c) =>
            c.kind === 'bone' ? { kind: 'bone' as const, bone: place([c.bone])[0] } : c,
          ),
    }))
  }

  return { model: { ...model, cubes: [...model.cubes, ...made], bones: place(model.bones) }, id: copy.id }
}

/** Edit a bone's own properties - its pivot and its rotation. */
export function updateBone(model: Model, id: string, patch: Partial<Omit<Bone, 'id' | 'children'>>): Model {
  const walk = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...(b.id === id ? { ...b, ...patch } : b),
      children: b.children.map((c) =>
        c.kind === 'bone' ? { kind: 'bone' as const, bone: walk([c.bone])[0] } : c,
      ),
    }))
  return { ...model, bones: walk(model.bones) }
}

/** Is `id` inside `bone`? A bone cannot be dropped into its own subtree. */
function contains(bone: Bone, id: string): boolean {
  return bone.children.some((c) =>
    c.kind === 'cube' ? c.id === id : c.bone.id === id || contains(c.bone, id),
  )
}

/**
 * Move a cube or a bone under a new parent. Rebuilding the rig used to
 * be impossible: a bone you added could never receive anything, so it
 * was a permanent empty folder.
 */
export function reparent(model: Model, id: string, parentId: string | null): Model {
  if (id === parentId) return model

  let moving: BoneChild | null = null
  const lift = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...b,
      children: b.children
        .filter((c) => {
          const match = c.kind === 'cube' ? c.id === id : c.bone.id === id
          if (match) moving = c
          return !match
        })
        .map((c) => (c.kind === 'bone' ? { kind: 'bone' as const, bone: lift([c.bone])[0] } : c)),
    }))

  const roots = model.bones.filter((b) => {
    if (b.id !== id) return true
    moving = { kind: 'bone', bone: b }
    return false
  })
  const stripped = lift(roots)
  if (!moving) return model

  const node = moving as BoneChild
  // dropping a bone into its own subtree would orphan the whole branch
  if (node.kind === 'bone' && parentId && contains(node.bone, parentId)) return model

  if (!parentId) return { ...model, bones: [...stripped, ...(node.kind === 'bone' ? [node.bone] : [])] }

  const place = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...b,
      children:
        b.id === parentId
          ? [...b.children, node]
          : b.children.map((c) =>
              c.kind === 'bone' ? { kind: 'bone' as const, bone: place([c.bone])[0] } : c,
            ),
    }))

  return { ...model, bones: place(stripped) }
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
