/* ---------------------------------------------------------------
   Making models, and growing them.

   A new project starts from a starter rather than an empty scene:
   an item is one cube you can immediately resize, a mob arrives rigged,
   because a rig is tedious to build by hand and is what makes Animate
   mode useful at all.

   Everything here returns a new Model rather than mutating one, so the
   editor's undo story stays a matter of keeping old references.
   --------------------------------------------------------------- */

import { FACES } from './bbmodel'
import type { Element, FaceKey, Group, Model, Texture, UVRect, Vec3 } from './bbmodel'

export type NewModelKind = 'items' | 'mobs'

let counter = 0
const id = () =>
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
    uuid: id(),
    id: '0',
    name,
    width: size,
    height: size,
    uvWidth: size,
    uvHeight: size,
    source: canvas.toDataURL('image/png'),
  }
}

/* ---------------- pieces ---------------- */

/**
 * Wrap a box's six faces onto the sheet the way a box unwrap does, so a
 * newly added cube already has somewhere sensible to paint. Laid out at
 * `at`, one texel per unit.
 */
function boxUvFaces(size: Vec3, at: [number, number], limit: number): Record<FaceKey, Element['faces'][FaceKey]> {
  const [w, h, d] = size.map((v) => Math.max(1, Math.round(v))) as Vec3
  const [ox, oy] = at
  const clamp = (r: UVRect): UVRect =>
    r.map((v) => Math.max(0, Math.min(limit, v))) as UVRect

  const rects: Record<FaceKey, UVRect> = {
    up: [ox + d, oy, ox + d + w, oy + d],
    down: [ox + d + w, oy, ox + d + w * 2, oy + d],
    east: [ox, oy + d, ox + d, oy + d + h],
    north: [ox + d, oy + d, ox + d + w, oy + d + h],
    west: [ox + d + w, oy + d, ox + d * 2 + w, oy + d + h],
    south: [ox + d * 2 + w, oy + d, ox + d * 2 + w * 2, oy + d + h],
  }

  const faces = {} as Record<FaceKey, Element['faces'][FaceKey]>
  for (const key of FACES) faces[key] = { uv: clamp(rects[key]), texture: 0, rotation: 0 }
  return faces
}

export function makeCube(
  name: string,
  from: Vec3,
  to: Vec3,
  opts: { origin?: Vec3; rotation?: Vec3; uvAt?: [number, number]; uvLimit?: number } = {},
): Element {
  const size: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  return {
    uuid: id(),
    name,
    from,
    to,
    origin: opts.origin ?? [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2],
    rotation: opts.rotation ?? [0, 0, 0],
    faces: boxUvFaces(size, opts.uvAt ?? [0, 0], opts.uvLimit ?? 64),
    inflate: 0,
    boxUv: false,
    color: 0,
    visibility: true,
    locked: false,
  }
}

export function makeGroup(name: string, origin: Vec3, children: Group['children'] = []): Group {
  return {
    uuid: id(),
    name,
    origin,
    rotation: [0, 0, 0],
    color: 0,
    isOpen: true,
    visibility: true,
    locked: false,
    children,
  }
}

/* ---------------- starters ---------------- */

export function createModel(kind: NewModelKind, name: string): Model {
  return kind === 'mobs' ? mobStarter(name) : itemStarter(name)
}

function itemStarter(name: string): Model {
  const texture = starterTexture(16, `${name}.png`)
  // a single 16-unit cube: the thing you immediately resize
  const cube = makeCube('cube', [4, 0, 4], [12, 16, 12], { uvAt: [0, 0], uvLimit: 16 })
  const root = makeGroup(name, [0, 0, 0], [{ kind: 'element', uuid: cube.uuid }])

  return {
    name,
    format: 'vellum',
    boxUv: false,
    resolution: { width: 16, height: 16 },
    elements: [cube],
    outliner: [root],
    textures: [texture],
    animations: [],
  }
}

function mobStarter(name: string): Model {
  const texture = starterTexture(64, `${name}.png`)
  const L = 64

  // pivots sit on the joints, which is what makes the rig animate properly
  const head = makeCube('head', [-4, 24, -4], [4, 32, 4], { origin: [0, 24, 0], uvAt: [0, 0], uvLimit: L })
  const torso = makeCube('torso', [-4, 12, -2], [4, 24, 2], { origin: [0, 24, 0], uvAt: [16, 16], uvLimit: L })
  const armL = makeCube('arm_left', [-8, 12, -2], [-4, 24, 2], { origin: [-4, 23, 0], uvAt: [40, 16], uvLimit: L })
  const armR = makeCube('arm_right', [4, 12, -2], [8, 24, 2], { origin: [4, 23, 0], uvAt: [40, 32], uvLimit: L })
  const legL = makeCube('leg_left', [-4, 0, -2], [0, 12, 2], { origin: [-2, 12, 0], uvAt: [0, 32], uvLimit: L })
  const legR = makeCube('leg_right', [0, 0, -2], [4, 12, 2], { origin: [2, 12, 0], uvAt: [16, 32], uvLimit: L })

  const elements = [head, torso, armL, armR, legL, legR]

  const root = makeGroup(name, [0, 0, 0], [
    {
      kind: 'group',
      group: makeGroup('torso', [0, 12, 0], [
        { kind: 'element', uuid: torso.uuid },
        { kind: 'group', group: makeGroup('head', [0, 24, 0], [{ kind: 'element', uuid: head.uuid }]) },
        { kind: 'group', group: makeGroup('arm_left', [-4, 23, 0], [{ kind: 'element', uuid: armL.uuid }]) },
        { kind: 'group', group: makeGroup('arm_right', [4, 23, 0], [{ kind: 'element', uuid: armR.uuid }]) },
      ]),
    },
    { kind: 'group', group: makeGroup('leg_left', [-2, 12, 0], [{ kind: 'element', uuid: legL.uuid }]) },
    { kind: 'group', group: makeGroup('leg_right', [2, 12, 0], [{ kind: 'element', uuid: legR.uuid }]) },
  ])

  return {
    name,
    format: 'vellum',
    boxUv: false,
    resolution: { width: L, height: L },
    elements,
    outliner: [root],
    textures: [texture],
    animations: [],
  }
}

/* ---------------- growing a model ---------------- */

/** Where the next cube should go: stacked on top of the model so far. */
function nextSpot(model: Model): { from: Vec3; to: Vec3 } {
  if (!model.elements.length) return { from: [-4, 0, -4], to: [4, 8, 4] }
  let top = -Infinity
  for (const el of model.elements) top = Math.max(top, el.to[1])
  return { from: [-4, top, -4], to: [4, top + 8, 4] }
}

/** Somewhere on the sheet that nothing has claimed, or the origin if it is full. */
function freeUvSpot(model: Model): [number, number] {
  const limit = model.resolution.width
  let lowest = 0
  for (const el of model.elements) {
    for (const key of FACES) {
      const [, y1, , y2] = el.faces[key].uv
      lowest = Math.max(lowest, Math.max(y1, y2))
    }
  }
  return lowest < limit ? [0, Math.ceil(lowest)] : [0, 0]
}

function addChild(groups: Group[], parentUuid: string | null, child: Group['children'][number]): Group[] {
  if (!parentUuid) {
    if (!groups.length) return groups
    return [{ ...groups[0], children: [...groups[0].children, child] }, ...groups.slice(1)]
  }
  return groups.map((g) => {
    if (g.uuid === parentUuid) return { ...g, children: [...g.children, child] }
    return {
      ...g,
      children: g.children.map((c) =>
        c.kind === 'group'
          ? { kind: 'group' as const, group: addChild([c.group], parentUuid, child)[0] }
          : c,
      ),
    }
  })
}

/** Add a cube, parented to `parentUuid` when given and to the first root otherwise. */
export function addCube(model: Model, parentUuid: string | null = null): { model: Model; uuid: string } {
  const spot = nextSpot(model)
  const cube = makeCube(`cube_${model.elements.length + 1}`, spot.from, spot.to, {
    uvAt: freeUvSpot(model),
    uvLimit: model.resolution.width,
  })

  const outliner = model.outliner.length
    ? addChild(model.outliner, parentUuid, { kind: 'element', uuid: cube.uuid })
    : [makeGroup(model.name, [0, 0, 0], [{ kind: 'element', uuid: cube.uuid }])]

  return { model: { ...model, elements: [...model.elements, cube], outliner }, uuid: cube.uuid }
}

export function addBone(model: Model, parentUuid: string | null = null): { model: Model; uuid: string } {
  const bone = makeGroup(`bone_${countGroups(model.outliner) + 1}`, [0, 0, 0])
  const outliner = model.outliner.length
    ? addChild(model.outliner, parentUuid, { kind: 'group', group: bone })
    : [bone]
  return { model: { ...model, outliner }, uuid: bone.uuid }
}

function countGroups(groups: Group[]): number {
  return groups.reduce(
    (n, g) =>
      n + 1 + countGroups(g.children.filter((c) => c.kind === 'group').map((c) => (c as { group: Group }).group)),
    0,
  )
}

/** Remove a cube, and the outliner entry that referenced it. */
export function deleteElement(model: Model, uuid: string): Model {
  const strip = (groups: Group[]): Group[] =>
    groups.map((g) => ({
      ...g,
      children: g.children
        .filter((c) => !(c.kind === 'element' && c.uuid === uuid))
        .map((c) => (c.kind === 'group' ? { kind: 'group' as const, group: strip([c.group])[0] } : c)),
    }))

  return {
    ...model,
    elements: model.elements.filter((e) => e.uuid !== uuid),
    outliner: strip(model.outliner),
  }
}

export function duplicateElement(model: Model, uuid: string): { model: Model; uuid: string } | null {
  const source = model.elements.find((e) => e.uuid === uuid)
  if (!source) return null
  const copy: Element = {
    ...source,
    uuid: id(),
    name: `${source.name}_copy`,
    faces: Object.fromEntries(
      FACES.map((k) => [k, { ...source.faces[k], uv: [...source.faces[k].uv] as UVRect }]),
    ) as Element['faces'],
  }

  const place = (groups: Group[]): Group[] =>
    groups.map((g) => {
      const holds = g.children.some((c) => c.kind === 'element' && c.uuid === uuid)
      return {
        ...g,
        children: holds
          ? [...g.children, { kind: 'element' as const, uuid: copy.uuid }]
          : g.children.map((c) =>
              c.kind === 'group' ? { kind: 'group' as const, group: place([c.group])[0] } : c,
            ),
      }
    })

  return {
    model: { ...model, elements: [...model.elements, copy], outliner: place(model.outliner) },
    uuid: copy.uuid,
  }
}
