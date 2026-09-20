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

/** The rotations found along one route down the bone tree. */
type Path = { turns: Turn[]; multiAxis: string[] }

/**
 * What one rotation amounts to: nothing, a single turn, or a rotation
 * on more than one axis - which an element cannot express at all.
 */
function turnOf(rotation: Vec3, origin: Vec3, owner: string): Turn | 'none' | 'multi' {
  const live = rotation.map((v, i) => [i, v] as const).filter(([, v]) => v !== 0)
  if (!live.length) return 'none'
  if (live.length > 1) return 'multi'
  return { axis: AXES[live[0][0]], angle: live[0][1], origin, owner }
}

/**
 * Every non-zero rotation between the model root and this cube, in order.
 *
 * Both lists are scoped to the path, not to the traversal: a bone in a
 * branch this cube does not live in says nothing about this cube, and
 * naming it here would send someone to look at geometry that is fine.
 * Its own cubes report it themselves.
 */
function chainOf(model: Model, cube: Cube): { bones: Path; own: Turn | 'multi' | null } {

  /* Walk down rather than up: a cube knows nothing about its bone, so
     the tree is what says which bones are above it. */
  const walk = (bones: Bone[], above: Path): Path | null => {
    for (const bone of bones) {
      const t = turnOf(bone.rotation, bone.origin, `bone "${bone.name}"`)
      const here: Path = {
        turns: t === 'none' || t === 'multi' ? above.turns : [...above.turns, t],
        multiAxis: t === 'multi' ? [...above.multiAxis, `bone "${bone.name}"`] : above.multiAxis,
      }

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

  const above = walk(model.bones, { turns: [], multiAxis: [] }) ?? { turns: [], multiAxis: [] }
  const mine = turnOf(cube.rotation, cube.origin, `"${cube.name}"`)

  /* The two are kept apart because they are not the same constraint.
     A cube's own rotation goes INTO the model file and is bound by what
     an element can say. A bone's rotation never reaches the file at all:
     on the pack path there is nowhere to put it, and on the plugin path
     it becomes the bone's rest rotation, applied at runtime by the
     display carrying it. Same geometry, different verdict. */
  return {
    bones: above,
    own: mine === 'none' ? null : mine,
  }
}

const nearestLegal = (angle: number) =>
  LEGAL_ANGLES.reduce((best, a) => (Math.abs(a - angle) < Math.abs(best - angle) ? a : best), 0 as number)

/* ---------------- the check ---------------- */

/**
 * Where the model is going, because it decides what counts as a fault.
 *
 * `pack` is a resource pack and nothing else: a model file, alone, on a
 * vanilla client. `any` is the editor's own view, which cannot know
 * whether a server is linked, so it reports what a pack could not hold
 * WITHOUT calling it broken - the plugin expresses several of these at
 * runtime and refusing them outright would be wrong about half the time.
 */
export type Target = 'pack' | 'any'

/**
 * What would go wrong, said before anyone exports. A model with no
 * errors here converts exactly; one with warnings converts into
 * something that loads but is not quite what is on screen.
 */
export function checkTranslation(
  model: Model,
  kind: ProjectKind | undefined,
  target: Target = 'any',
): TranslationIssue[] {
  const out: TranslationIssue[] = []
  /* Fatal to a pack, merely a fact on a linked server. */
  const boneLevel = target === 'pack' ? 'error' : 'warning'
  const carried = target === 'pack' ? '' : ' — the plugin carries it as the bone’s rest rotation'

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
    const { bones, own } = chainOf(model, cube)

    /* ---- the cube's own rotation: a model-file limit on every path ----
       "Cube rotations stay raw inside the model, exactly as authored",
       so what an element can say is what a cube may be, linked or not. */
    if (own === 'multi') {
      out.push({
        level: 'error',
        where: tag,
        message: `"${cube.name}" turns on more than one axis — an element rotates on exactly one`,
      })
    } else if (own && !(LEGAL_ANGLES as readonly number[]).includes(own.angle)) {
      out.push({
        level: 'warning',
        where: tag,
        message: `${own.owner} turns ${own.angle}°, which is not one of ${LEGAL_ANGLES.join(', ')} — it exports as ${nearestLegal(own.angle)}°`,
      })
    }

    /* ---- the bones above it: nothing a model file can hold ---- */
    for (const owner of bones.multiAxis) {
      out.push({
        level: boneLevel,
        where: tag,
        message: `${owner} turns on more than one axis, which no model file can hold${carried}`,
      })
    }

    /* One bone turn and no cube turn is the one case a pack CAN express:
       an element gets exactly one pivot, so that rotation becomes it. */
    const pivots = bones.turns.length + (own && own !== 'multi' ? 1 : 0)
    if (pivots > 1) {
      const names = [...bones.turns.map((t) => t.owner), ...(own && own !== 'multi' ? [own.owner] : [])]
      out.push({
        level: boneLevel,
        where: tag,
        message: `rotated about ${pivots} pivots (${names.join(', ')}) — an element has one${carried}`,
      })
    } else if (bones.turns.length === 1 && !(LEGAL_ANGLES as readonly number[]).includes(bones.turns[0].angle)) {
      out.push({
        level: boneLevel === 'error' ? 'warning' : 'note',
        where: tag,
        message: `${bones.turns[0].owner} turns ${bones.turns[0].angle}°, which is not one of ${LEGAL_ANGLES.join(', ')} — it exports as ${nearestLegal(bones.turns[0].angle)}°${carried}`,
      })
    }

    /* Inflate has no element field: it bakes into the corners, which is
       what it already means. Worth saying only when it is non-zero and
       would push the cube out of range. */
    const from = cube.from.map((v) => v - cube.inflate) as Vec3
    const to = cube.to.map((v) => v + cube.inflate) as Vec3
    for (let i = 0; i < 3; i++) {
      if (from[i] < -16 || to[i] > 32) {
        out.push({
          /* A pack has nowhere to put this. A linked server does: the
             plugin divides an over-reaching bone down and records the
             divisor on it, multiplying it back into that one display's
             scale. So it is fatal to a pack and a fact on a server. */
          level: target === 'pack' ? 'error' : 'warning',
          where: tag,
          message: `${AXES[i]} runs ${from[i]} to ${to[i]}${cube.inflate ? ' once inflated' : ''} — an element lives inside -16..32${
            target === 'pack' ? '' : ' — the plugin scales the bone down to fit'
          }`,
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

/**
 * A resource path Minecraft will accept: lowercase, digits, underscore,
 * dot, dash.
 *
 * This lives here rather than beside the zip writer because it is not
 * about zips - it is the rule the model file's texture references and
 * the file names under `textures/` BOTH have to obey, and the one thing
 * that must never happen is the two disagreeing. A model that points at
 * `item/Blade Sheet` while the PNG sits at `item/blade_sheet.png` loads
 * without complaint and renders the missing-texture checkerboard.
 */
export const safeId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'model'

/** What one texture is called inside the pack, from either side. */
export const textureName = (texName: string, fallback: string) =>
  safeId((texName || fallback).replace(/\.png$/i, ''))

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
  /** the stem the pack files this model under - the fallback for an unnamed texture */
  assetName?: string,
): { json: McModel; issues: TranslationIssue[] } {
  const issues = checkTranslation(model, folder === 'block' ? 'blocks' : 'items', 'pack')

  /* One entry per texture, in order, so `#0` is the first sheet and a
     model with two sheets does not silently paint everything from one. */
  const slot = new Map<string, string>()
  model.textures.forEach((t, i) => slot.set(t.id, String(i)))
  const stem = assetName ?? safeId(model.name)
  const textures: Record<string, string> = {}
  model.textures.forEach((t, i) => {
    textures[String(i)] = `${namespace}:${folder}/${textureName(t.name, stem)}`
  })
  if (model.textures.length) textures.particle = textures['0']

  const elements: McElement[] = model.cubes.map((cube) => {
    const { bones, own } = chainOf(model, cube)
    /* One pivot is all an element has. A model that reaches here has
       already passed the pack check, so there is at most one. */
    const turns = [...bones.turns, ...(own && own !== 'multi' ? [own] : [])]
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
