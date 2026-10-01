/* Where a mob can be hit, worked out from its rig; .vellum has no
   hit-region field. The rule comes from the original plugin, which was
   deleted, and the rewritten plugin has not been checked against it.

     - A bone that draws nothing is a locator, bounded by its hidden cubes.
     - A bone that draws something is a render bone, bounded by what it draws.
     - If any locator has bounds, only locators can be hit. Otherwise every
       render bone can.

   So hiding one cube in an otherwise empty bone switches the whole mob to
   explicit regions. The editor's hit panel warns whenever that is the mode. */

import type { Bone, Cube, Model, Vec3 } from './model'

export type Box = { min: Vec3; max: Vec3 }

export type Region = {
  boneId: string
  boneName: string
  /** `locator` draws nothing; `render` draws something. */
  kind: 'locator' | 'render'
  /** Relative to the bone's pivot, so it moves with the bone's animation. */
  box: Box
  /** How many cubes the box was measured from. */
  from: number
}

/** A bone that can't be hit, and why. */
export type Inert = { boneId: string; boneName: string; why: string }

export type HitReport = {
  /**
   * `explicit` when any locator has bounds, else `derived`; `none` when
   * there are no drawn bones or bounded locators.
   */
  mode: 'derived' | 'explicit' | 'none'
  regions: Region[]
  /** Drawn bones that can't be hit because the rig has marked regions. */
  lost: Inert[]
  /** Locator bones with no cubes at all, so no bounds and no effect. */
  empty: Inert[]
  /** Cases the rule doesn't cover, listed as warnings. */
  unknowns: string[]
}

const isCube = (c: Bone['children'][number]): c is { kind: 'cube'; id: string } => c.kind === 'cube'

/** Every bone in the tree, depth first. */
export function allBones(bones: Bone[], out: Bone[] = []): Bone[] {
  for (const b of bones) {
    out.push(b)
    for (const child of b.children) if (child.kind === 'bone') allBones([child.bone], out)
  }
  return out
}

/** A cube's box including inflate, with min and max per axis in case `to` is below `from`. */
function corners(c: Cube): Box {
  const lo: Vec3 = [0, 0, 0]
  const hi: Vec3 = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(c.from[i], c.to[i]) - c.inflate
    hi[i] = Math.max(c.from[i], c.to[i]) + c.inflate
  }
  return { min: lo, max: hi }
}

/** The union of some cubes, expressed relative to a pivot. Null for none. */
function measure(cubes: Cube[], pivot: Vec3): Box | null {
  if (!cubes.length) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const c of cubes) {
    const b = corners(c)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i])
      max[i] = Math.max(max[i], b.max[i])
    }
  }
  return {
    min: [min[0] - pivot[0], min[1] - pivot[1], min[2] - pivot[2]],
    max: [max[0] - pivot[0], max[1] - pivot[1], max[2] - pivot[2]],
  }
}

/** Which bones can be hit. Each bone counts only its own cubes. */
export function hitReport(model: Model): HitReport {
  const byId = new Map(model.cubes.map((c) => [c.id, c]))
  const unknowns: string[] = []

  const explicit: Region[] = []
  const drawn: Region[] = []
  const empty: Inert[] = []

  for (const bone of allBones(model.bones)) {
    const own = bone.children.filter(isCube).map((c) => byId.get(c.id)).filter((c): c is Cube => !!c)
    const shown = own.filter((c) => c.visible)
    const hidden = own.filter((c) => !c.visible)

    /* The rule doesn't cover a hidden bone with visible cubes, so report it. */
    if (!bone.visible && shown.length) {
      unknowns.push(
        `"${bone.name}" is hidden but holds ${shown.length} visible cube${shown.length === 1 ? '' : 's'}. It isn't known whether the plugin treats them as drawn.`,
      )
    }

    if (shown.length) {
      const box = measure(shown, bone.origin)
      if (box) drawn.push({ boneId: bone.id, boneName: bone.name, kind: 'render', box, from: shown.length })
      continue
    }

    /* Draws nothing: a locator. Its hidden cubes are its bounds. */
    const box = measure(hidden, bone.origin)
    if (box) {
      explicit.push({ boneId: bone.id, boneName: bone.name, kind: 'locator', box, from: hidden.length })
    } else {
      empty.push({
        boneId: bone.id,
        boneName: bone.name,
        why: 'draws nothing and has no hidden cube, so it has no bounds and doesn’t change what can be hit',
      })
    }
  }

  if (explicit.length) {
    return {
      mode: 'explicit',
      regions: explicit,
      lost: drawn.map((r) => ({
        boneId: r.boneId,
        boneName: r.boneName,
        why: 'this rig has marked regions, and they take priority over drawn bones',
      })),
      empty,
      unknowns,
    }
  }

  return {
    mode: drawn.length ? 'derived' : 'none',
    regions: drawn,
    lost: [],
    empty,
    unknowns,
  }
}

/** One sentence naming the mode, for a Check block. */
export function modeLine(r: HitReport): string {
  if (r.mode === 'explicit') {
    const n = r.regions.length
    return `Explicit hit regions: ${n} marked bone${n === 1 ? '' : 's'}. Drawn bones can’t be hit.`
  }
  if (r.mode === 'derived') {
    const n = r.regions.length
    return `Derived hit regions: all ${n} drawn bone${n === 1 ? ' is a target' : 's are targets'}. Regions follow the animation automatically.`
  }
  return 'Nothing can be hit. This rig has no visible cubes and no marked regions.'
}

/* ---------------- authoring ---------------- */

import { makeBone, makeCube } from './new-model'
import type { BoneChild } from './model'

/** Prefix for region bone names, so they read as regions in the outliner. */
export const REGION_PREFIX = 'hit_'

/** True when a bone has cubes of its own and all are hidden, whatever its name. */
export const isRegionBone = (model: Model, bone: Bone): boolean => {
  const own = bone.children.filter(isCube)
  if (!own.length) return false
  const byId = new Map(model.cubes.map((c) => [c.id, c]))
  return own.every((c) => byId.get(c.id)?.visible === false)
}

/** The model-space box a bone's visible cubes fill, or null. */
function drawnBox(model: Model, bone: Bone): Box | null {
  const byId = new Map(model.cubes.map((c) => [c.id, c]))
  const shown = bone.children
    .filter(isCube)
    .map((c) => byId.get(c.id))
    .filter((c): c is Cube => !!c && c.visible)
  if (!shown.length) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const c of shown) {
    const b = corners(c)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i])
      max[i] = Math.max(max[i], b.max[i])
    }
  }
  return { min, max }
}

const attach = (bones: Bone[], parentId: string, child: BoneChild): Bone[] =>
  bones.map((b) =>
    b.id === parentId
      ? { ...b, children: [...b.children, child] }
      : {
          ...b,
          children: b.children.map((c) =>
            c.kind === 'bone' ? { kind: 'bone' as const, bone: attach([c.bone], parentId, child)[0] } : c,
          ),
        },
  )

/** Adds a hit region to a bone: a child bone holding one hidden cube, so the bone keeps drawing. */
export function addHitRegion(model: Model, boneId: string): { model: Model; boneId: string; cubeId: string } | null {
  const target = allBones(model.bones).find((b) => b.id === boneId)
  if (!target) return null

  // the size of what the bone draws, else an 8-unit cube on its pivot: a zero-size box can't be hit
  const box = drawnBox(model, target)
  const from: Vec3 = box ? box.min : [target.origin[0] - 4, target.origin[1], target.origin[2] - 4]
  const to: Vec3 = box ? box.max : [target.origin[0] + 4, target.origin[1] + 8, target.origin[2] + 4]

  /* Untextured: it is never drawn, so it needs no space on the sheet. */
  const cube = { ...makeCube('region', from, to, { texture: null }), visible: false }
  const bone = makeBone(`${REGION_PREFIX}${target.name}`, [...target.origin] as Vec3, [
    { kind: 'cube', id: cube.id },
  ])

  return {
    model: {
      ...model,
      cubes: [...model.cubes, cube],
      bones: attach(model.bones, boneId, { kind: 'bone', bone }),
    },
    boneId: bone.id,
    cubeId: cube.id,
  }
}
