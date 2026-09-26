/* ---------------------------------------------------------------
   Where a mob can be hit, derived from the rig the way the plugin's
   baker derives it.

   THERE IS NO HIT-REGION FIELD IN `.vellum`, AND THERE DOES NOT NEED
   TO BE. The plugin's `RigBaker` decides a bone's kind and bounds from
   what the bone draws:

     measure(drawable.isEmpty() ? hidden : drawable, pivot)
     drawable.isEmpty()  ->  BoneKind.LOCATOR, bounds from the HIDDEN
                             cubes (null if it has none)
     otherwise           ->  BoneKind.RENDER, bounds from what it draws

   and `HitRegions` then picks:

     explicit = locator bones that have bounds
     drawn    = render bones
     regions  = explicit.isEmpty() ? drawn : explicit

   So a hit region is authored as A HIDDEN CUBE IN A BONE THAT DRAWS
   NOTHING ELSE, using `hidden`, which the format has carried since v6.

   THE TRAP THIS MODULE EXISTS FOR. That last line is one ternary with
   whole-mob consequences: the instant ONE locator has bounds, every
   drawn bone stops being a target. An author who hides a cube for an
   ordinary reason - roughing a shape out, pulling a horn off for a
   minute - flips the entire mob from derived to explicit without going
   near anything labelled "hit region", and the engine says nothing.
   The mob simply cannot be hit where it looks.

   So the readout keys off the REAL condition - any locator bone with
   bounds - and never off whether the author used a hit-region control.
   A readout that only catches the deliberate case documents the one
   that was never dangerous.
   --------------------------------------------------------------- */

import type { Bone, Cube, Model, Vec3 } from './model'

export type Box = { min: Vec3; max: Vec3 }

export type Region = {
  boneId: string
  boneName: string
  /** LOCATOR is a bone that draws nothing; RENDER is one that does. */
  kind: 'locator' | 'render'
  /** Bone-local, because that is what travels with the bone's animation. */
  box: Box
  /** How many cubes the box was measured from. */
  from: number
}

/** A bone that will not be a target, and the reason it will not. */
export type Inert = { boneId: string; boneName: string; why: string }

export type HitReport = {
  /**
   * `explicit` the moment any locator carries bounds; `derived`
   * otherwise. `none` means nothing is hittable at all, which is a
   * real state and not an error - a rig with no drawn bones and no
   * bounded locators has nowhere to be hit.
   */
  mode: 'derived' | 'explicit' | 'none'
  regions: Region[]
  /** Bones that would be targets under the other mode but are not under this one. */
  lost: Inert[]
  /** Locator bones with no cubes at all, so no bounds and no effect either way. */
  empty: Inert[]
  /** Things we cannot decide from the model alone. Named, never guessed at. */
  unknowns: string[]
}

const isCube = (c: Bone['children'][number]): c is { kind: 'cube'; id: string } => c.kind === 'cube'

/** Every bone in the tree, depth first, with no reliance on a helper that may not exist. */
export function allBones(bones: Bone[], out: Bone[] = []): Bone[] {
  for (const b of bones) {
    out.push(b)
    for (const child of b.children) if (child.kind === 'bone') allBones([child.bone], out)
  }
  return out
}

/**
 * A cube's corners after inflate, which is part of how big it actually
 * is. `from`/`to` are not ordered, so both ends are taken per axis
 * rather than assumed.
 */
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

/**
 * What the plugin would make of this rig's hittability.
 *
 * Only a bone's OWN cubes count, not its descendants' - the baker emits
 * one spec per bone and measures that bone's own geometry, so a parent
 * holding nothing but child bones draws nothing itself.
 */
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

    /* A hidden BONE holding visible cubes is the one case the quoted
       baker code does not settle, and inventing an answer here is how
       the `hitbox` mistake happened. Named instead. */
    if (!bone.visible && shown.length) {
      unknowns.push(
        `"${bone.name}" is hidden but holds ${shown.length} visible cube${shown.length === 1 ? '' : 's'} — whether the baker treats those as drawn is not something the model can say`,
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
        why: 'draws nothing and has no hidden cube to measure, so it has no bounds and no effect on hittability',
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
        why: 'marked regions exist on this rig, and they win outright',
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
    return `Explicit hit regions: ${n} marked bone${n === 1 ? '' : 's'}. Every drawn bone has stopped being a target.`
  }
  if (r.mode === 'derived') {
    const n = r.regions.length
    return `Derived hit regions: all ${n} drawn bone${n === 1 ? ' is a target' : 's are targets'}, following the animation, for free.`
  }
  return 'Nothing is hittable: this rig draws nothing and marks nothing.'
}

/* ---------------- authoring ----------------

   SURFACE THE INTENT, NOT THE MECHANISM. "Make this a hit region"
   really means "add a child bone, give it a cube, hide the cube, and
   make sure that bone draws nothing else". Asked to do that by hand an
   author gets it wrong once, and the mob is then unhittable everywhere
   with nothing said out loud. Same relationship as a box unwrap, where
   one origin becomes six face rects.
   --------------------------------------------------------------- */

import { makeBone, makeCube } from './new-model'
import type { BoneChild } from './model'

/** Named so the bone reads as what it is in the outliner. */
export const REGION_PREFIX = 'hit_'

/** A bone this module authored, by its shape rather than by its name. */
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

/**
 * Mark a bone as hittable: a child bone holding one hidden cube.
 *
 * The box defaults to whatever the bone draws, so "a hit region on the
 * head" starts the size of the head rather than at some arbitrary
 * origin the author then has to find. A bone that draws nothing gets a
 * modest cube at its pivot instead of nothing at all - a zero-size box
 * measures to a point and would be a region that cannot be hit, which
 * is the failure this whole area is about.
 *
 * It is a CHILD bone rather than the bone itself on purpose: the bone
 * keeps drawing what it drew, and the region travels with it because
 * it hangs off it.
 */
export function addHitRegion(model: Model, boneId: string): { model: Model; boneId: string; cubeId: string } | null {
  const target = allBones(model.bones).find((b) => b.id === boneId)
  if (!target) return null

  const box = drawnBox(model, target)
  const from: Vec3 = box ? box.min : [target.origin[0] - 4, target.origin[1], target.origin[2] - 4]
  const to: Vec3 = box ? box.max : [target.origin[0] + 4, target.origin[1] + 8, target.origin[2] + 4]

  /* Untextured and unmapped: it is never drawn, so a UV island for it
     would be sheet space spent on nothing. */
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
