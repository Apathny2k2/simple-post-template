/* ---------------------------------------------------------------
   Does this model translate, and what does it become?

   A `.vellum` and a Minecraft model file are not the same kind of
   thing, and the difference is not cosmetic:

   * A model file has NO hierarchy. Elements are flat, in one model
     space. Our bones nest and rotate.
   * An element rotates on ONE axis, about ONE origin, at one of five
     fixed angles. Our cubes carry a full Vec3 at any angle, and sit
     under bones that carry their own.
   * An element has no inflate. Ours do.
   * UVs are in a 0..16 space over the whole texture. Ours are in
     texture pixels.

   So a model can be perfectly good in the Studio and impossible to put
   in a pack. The job here is to say which, and why, and where - before
   anyone ships a pack that loads wrong - and then to convert the part
   that does translate.

   What saves most of it: in the rest pose a bone with no rotation
   contributes no transform at all. The renderer places a bone at
   `origin - parentOrigin` and a cube at `origin - boneOrigin`, so the
   offsets telescope and a cube under unrotated bones sits at exactly
   the absolute coordinates its own `from`/`to` already say. Only a
   *rotated* bone actually moves its children.
   --------------------------------------------------------------- */

import { FACES } from './model'
import type { Bone, Cube, FaceKey, Model, ProjectKind, Vec3 } from './model'

/** The five angles an element may rotate by. Anything else is not a model. */
export const LEGAL_ANGLES = [-45, -22.5, 0, 22.5, 45] as const

const AXES = ['x', 'y', 'z'] as const
export type Axis = (typeof AXES)[number]

export type TranslationIssue = {
  /** `error` cannot be expressed at all; `warning` is expressed differently; `note` is a fact. */
  level: 'error' | 'warning' | 'note'
  /** the cube or bone it is about, where it is about one */
  where?: string
  message: string
}

/* ---------------- the rotation chain ---------------- */

type Turn = { axis: Axis; angle: number; origin: Vec3; owner: string }

/** Every non-zero rotation between the model root and this cube, in order. */
function chainOf(model: Model, cube: Cube): { turns: Turn[]; multiAxis: string[] } {
  const turns: Turn[] = []
  const multiAxis: string[] = []

  const add = (rotation: Vec3, origin: Vec3, owner: string) => {
    const live = rotation.map((v, i) => [i, v] as const).filter(([, v]) => v !== 0)
    if (!live.length) return
    if (live.length > 1) {
      multiAxis.push(owner)
      return
    }
    turns.push({ axis: AXES[live[0][0]], angle: live[0][1], origin, owner })
  }

  /* Walk down rather than up: a cube knows nothing about its bone, so
     the tree is what says which bones are above it. */
  const walk = (bones: Bone[], above: Turn[]): Turn[] | null => {
    for (const bone of bones) {
      const here = [...above]
      const before = turns.length
      add(bone.rotation, bone.origin, `bone "${bone.name}"`)
      if (turns.length > before) here.push(turns[turns.length - 1])

      for (const child of bone.children) {
        if (child.kind === 'cube' && child.id === cube.id) return here
        if (child.kind === 'bone') {
          const found = walk([child.bone], here)
          if (found) return found
        }
      }
    }
    return null
  }

  const above = walk(model.bones, []) ?? []
  const mine: Turn[] = []
  const before = turns.length
  add(cube.rotation, cube.origin, `"${cube.name}"`)
  if (turns.length > before) mine.push(turns[turns.length - 1])

  return { turns: [...above, ...mine], multiAxis }
}

const nearestLegal = (angle: number) =>
  LEGAL_ANGLES.reduce((best, a) => (Math.abs(a - angle) < Math.abs(best - angle) ? a : best), 0 as number)

/* ---------------- the check ---------------- */

/**
 * What would go wrong, said before anyone exports. A model with no
 * errors here converts exactly; one with warnings converts into
 * something that loads but is not quite what is on screen.
 */
export function checkTranslation(model: Model, kind: ProjectKind | undefined): TranslationIssue[] {
  const out: TranslationIssue[] = []

  if (kind === 'mobs') {
    out.push({
      level: 'note',
      message:
        'A mob has no model file in vanilla Minecraft — entity models are not part of a resource pack. This is the plugin’s to render.',
    })
    return out
  }

  if (!model.cubes.length) {
    out.push({ level: 'error', message: 'No cubes, so there is nothing to put in a model' })
    return out
  }

  if (model.clips.length) {
    out.push({
      level: 'note',
      message: `A model file holds one pose. ${model.clips.length} clip${model.clips.length === 1 ? '' : 's'} stay in the .vellum for the plugin to play — the pack gets the rest pose.`,
    })
  }

  for (const cube of model.cubes) {
    const tag = cube.name || cube.id
    const { turns, multiAxis } = chainOf(model, cube)

    for (const owner of multiAxis) {
      out.push({
        level: 'error',
        where: tag,
        message: `${owner} turns on more than one axis — an element rotates on exactly one`,
      })
    }

    if (turns.length > 1) {
      out.push({
        level: 'error',
        where: tag,
        message: `rotated about ${turns.length} different pivots (${turns
          .map((t) => t.owner)
          .join(', ')}) — an element has one`,
      })
    } else if (turns.length === 1) {
      const t = turns[0]
      if (!(LEGAL_ANGLES as readonly number[]).includes(t.angle)) {
        out.push({
          level: 'warning',
          where: tag,
          message: `${t.owner} turns ${t.angle}°, which is not one of ${LEGAL_ANGLES.join(', ')} — it exports as ${nearestLegal(t.angle)}°`,
        })
      }
    }

    /* Inflate has no element field: it bakes into the corners, which is
       what it already means. Worth saying only when it is non-zero and
       would push the cube out of range. */
    const from = cube.from.map((v) => v - cube.inflate) as Vec3
    const to = cube.to.map((v) => v + cube.inflate) as Vec3
    for (let i = 0; i < 3; i++) {
      if (from[i] < -16 || to[i] > 32) {
        out.push({
          level: 'error',
          where: tag,
          message: `${AXES[i]} runs ${from[i]} to ${to[i]}${cube.inflate ? ' once inflated' : ''} — an element lives inside -16..32`,
        })
      }
    }

    const blank = FACES.filter((f) => !cube.faces[f].texture)
    if (blank.length === 6) {
      out.push({ level: 'warning', where: tag, message: 'no textured faces — it exports invisible' })
    } else if (blank.length) {
      out.push({
        level: 'note',
        where: tag,
        message: `${blank.join(', ')} ${blank.length === 1 ? 'has' : 'have'} no texture and ${blank.length === 1 ? 'is' : 'are'} left out`,
      })
    }
  }

  if (!model.textures.length) {
    out.push({ level: 'error', message: 'No texture, so every face would reference nothing' })
  }

  return out
}

/* ---------------- the conversion ---------------- */

export type McFace = {
  uv: [number, number, number, number]
  texture: string
  rotation?: 0 | 90 | 180 | 270
}

export type McElement = {
  name?: string
  from: Vec3
  to: Vec3
  rotation?: { origin: Vec3; axis: Axis; angle: number }
  faces: Partial<Record<FaceKey, McFace>>
}

export type McModel = {
  textures: Record<string, string>
  elements: McElement[]
  display?: Record<string, { rotation?: Vec3; translation?: Vec3; scale?: Vec3 }>
}

/** Texture pixels to the 0..16 space a model file measures UVs in. */
const uvTo16 = (v: number, span: number) => Math.round((v / span) * 16 * 10000) / 10000

const round = (v: number) => Math.round(v * 10000) / 10000

/**
 * The model file, plus what had to change to make one.
 *
 * `display` comes straight from the Display tab - those eight slots
 * ARE the model file's display block, which is why the tab exists.
 */
export function toMinecraftModel(
  model: Model,
  namespace: string,
  folder: 'item' | 'block',
  display?: Record<string, { rotation: Vec3; translation: Vec3; scale: Vec3 }>,
): { json: McModel; issues: TranslationIssue[] } {
  const issues = checkTranslation(model, folder === 'block' ? 'blocks' : 'items')

  /* One entry per texture, in order, so `#0` is the first sheet and a
     model with two sheets does not silently paint everything from one. */
  const slot = new Map<string, string>()
  model.textures.forEach((t, i) => slot.set(t.id, String(i)))
  const path = (name: string) => `${namespace}:${folder}/${name.replace(/\.png$/i, '')}`
  const textures: Record<string, string> = {}
  model.textures.forEach((t, i) => {
    textures[String(i)] = path(t.name || model.name)
  })
  if (model.textures.length) textures.particle = textures['0']

  const elements: McElement[] = model.cubes.map((cube) => {
    const { turns } = chainOf(model, cube)
    const el: McElement = {
      name: cube.name || undefined,
      from: cube.from.map((v) => round(v - cube.inflate)) as Vec3,
      to: cube.to.map((v) => round(v + cube.inflate)) as Vec3,
      faces: {},
    }

    if (turns.length === 1) {
      const t = turns[0]
      el.rotation = {
        origin: t.origin.map(round) as Vec3,
        axis: t.axis,
        angle: nearestLegal(t.angle),
      }
    }

    for (const key of FACES) {
      const face = cube.faces[key]
      if (!face.texture) continue
      const tex = model.textures.find((t) => t.id === face.texture)
      if (!tex) continue
      const [x1, y1, x2, y2] = face.uv
      el.faces[key] = {
        uv: [
          uvTo16(x1, tex.uvWidth),
          uvTo16(y1, tex.uvHeight),
          uvTo16(x2, tex.uvWidth),
          uvTo16(y2, tex.uvHeight),
        ],
        texture: `#${slot.get(face.texture) ?? '0'}`,
        ...(face.rotation ? { rotation: face.rotation } : {}),
      }
    }

    return el
  })

  const json: McModel = { textures, elements }

  if (display) {
    /* Only the slots that differ from rest: Minecraft reads an absent
       slot as the default, and writing eight identity blocks into every
       model is eight lies about having tuned them. */
    const out: McModel['display'] = {}
    for (const [name, t] of Object.entries(display)) {
      const block: { rotation?: Vec3; translation?: Vec3; scale?: Vec3 } = {}
      if (t.rotation.some((v) => v !== 0)) block.rotation = t.rotation.map(round) as Vec3
      if (t.translation.some((v) => v !== 0)) block.translation = t.translation.map(round) as Vec3
      if (t.scale.some((v) => v !== 1)) block.scale = t.scale.map(round) as Vec3
      if (Object.keys(block).length) out[name] = block
    }
    if (Object.keys(out).length) json.display = out
  }

  return { json, issues }
}
