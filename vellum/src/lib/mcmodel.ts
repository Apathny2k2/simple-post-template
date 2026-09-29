/* Checks whether a model converts to a Minecraft model file, and converts
   it. Where a model file differs from a .vellum:

   - Elements are flat, with no bones.
   - An element rotates on one axis, about one origin, by one of five angles.
   - Elements have no inflate.
   - UVs run 0..16 across the whole texture. Ours are in the texture's UV units.

   In the rest pose an unrotated bone adds nothing: the renderer offsets
   each bone and cube by its origin minus its parent's, so a cube under
   unrotated bones sits at its own `from`/`to`. Only a rotated bone moves
   its children. */

import { FACES } from './model'
import type { Bone, Cube, FaceKey, Model, ProjectKind, Vec3 } from './model'

/** The angles a model element may rotate by. */
export const LEGAL_ANGLES = [-45, -22.5, 0, 22.5, 45] as const

const AXES = ['x', 'y', 'z'] as const
export type Axis = (typeof AXES)[number]

export type TranslationIssue = {
  /** `error` cannot be expressed at all; `warning` is expressed differently; `note` is a fact. */
  level: 'error' | 'warning' | 'note'
  /** the cube it is about, if any */
  where?: string
  message: string
}

/* ---------------- the rotation chain ---------------- */

type Turn = { axis: Axis; angle: number; origin: Vec3; owner: string }

/** The rotations found along one route down the bone tree. */
type Path = { turns: Turn[]; multiAxis: string[] }

/** A rotation as 'none', a single-axis turn, or 'multi' for more than one axis. */
function turnOf(rotation: Vec3, origin: Vec3, owner: string): Turn | 'none' | 'multi' {
  const live = rotation.map((v, i) => [i, v] as const).filter(([, v]) => v !== 0)
  if (!live.length) return 'none'
  if (live.length > 1) return 'multi'
  return { axis: AXES[live[0][0]], angle: live[0][1], origin, owner }
}

/**
 * The non-zero rotations from the root down to this cube: the bones on its
 * path, in order, and its own. Bones in other branches are left out.
 */
function chainOf(model: Model, cube: Cube): { bones: Path; own: Turn | 'multi' | null } {

  /* Cubes don't reference their bone, so search down from the root. */
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

  /* Kept apart because the limits differ. A cube's own rotation always
     goes into its element. A bone's reaches a pack only as an element's
     single pivot; with the plugin it becomes the bone's rest rotation. */
  return {
    bones: above,
    own: mine === 'none' ? null : mine,
  }
}

const nearestLegal = (angle: number) =>
  LEGAL_ANGLES.reduce((best, a) => (Math.abs(a - angle) < Math.abs(best - angle) ? a : best), 0 as number)

/* ---------------- the check ---------------- */

/** `pack`: a vanilla resource pack. `any`: the editor's view, where limits the plugin handles are warnings. */
export type Target = 'pack' | 'any'

/** Conversion problems: errors keep a model out of a pack, warnings mean the result differs. */
export function checkTranslation(
  model: Model,
  kind: ProjectKind | undefined,
  target: Target = 'any',
): TranslationIssue[] {
  const out: TranslationIssue[] = []
  /* Errors for a pack; on a linked server the plugin handles these. */
  const boneLevel = target === 'pack' ? 'error' : 'warning'
  const carried = target === 'pack' ? '' : '. The plugin applies it as the bone’s rest rotation'

  if (kind === 'mobs') {
    out.push({
      level: 'note',
      message:
        'A mob has no model file in vanilla Minecraft. Resource packs can’t hold entity models, so the plugin renders it.',
    })

    /* Hit regions are checked in lib/hitregions.ts. */
    return out
  }

  if (!model.cubes.length) {
    out.push({ level: 'error', message: 'No cubes, so there is nothing to put in a model' })
    return out
  }

  if (model.clips.length) {
    out.push({
      level: 'note',
      message: `A model file holds a single pose, so the pack gets the rest pose. ${model.clips.length} clip${model.clips.length === 1 ? ' stays' : 's stay'} in the .vellum for the plugin to play.`,
    })
  }

  for (const cube of model.cubes) {
    const tag = cube.name || cube.id
    const { bones, own } = chainOf(model, cube)

    /* The cube's own rotation goes into its element on every path. */
    if (own === 'multi') {
      out.push({
        level: 'error',
        where: tag,
        message: `"${cube.name}" turns on 2 or more axes, but an element can only turn on 1 axis`,
      })
    } else if (own && !(LEGAL_ANGLES as readonly number[]).includes(own.angle)) {
      out.push({
        level: 'warning',
        where: tag,
        message: `${own.owner} turns ${own.angle}°, which isn’t one of ${LEGAL_ANGLES.join(', ')}. It exports as ${nearestLegal(own.angle)}°`,
      })
    }

    for (const owner of bones.multiAxis) {
      out.push({
        level: boneLevel,
        where: tag,
        message: `${owner} turns on 2 or more axes, which a model file can’t hold${carried}`,
      })
    }

    /* An element has one pivot, so a single turn on the path (bone or
       cube) becomes it; two or more can't be written. */
    const pivots = bones.turns.length + (own && own !== 'multi' ? 1 : 0)
    if (pivots > 1) {
      const names = [...bones.turns.map((t) => t.owner), ...(own && own !== 'multi' ? [own.owner] : [])]
      out.push({
        level: boneLevel,
        where: tag,
        message: `rotated about ${pivots} pivots (${names.join(', ')}), but an element can only have 1 pivot${carried}`,
      })
    } else if (bones.turns.length === 1 && !(LEGAL_ANGLES as readonly number[]).includes(bones.turns[0].angle)) {
      out.push({
        level: boneLevel === 'error' ? 'warning' : 'note',
        where: tag,
        message: `${bones.turns[0].owner} turns ${bones.turns[0].angle}°, which isn’t one of ${LEGAL_ANGLES.join(', ')}. It exports as ${nearestLegal(bones.turns[0].angle)}°${carried}`,
      })
    }

    /* Elements have no inflate, so it is baked into the corners before
       the -16..32 range check. */
    const from = cube.from.map((v) => v - cube.inflate) as Vec3
    const to = cube.to.map((v) => v + cube.inflate) as Vec3
    for (let i = 0; i < 3; i++) {
      if (from[i] < -16 || to[i] > 32) {
        out.push({
          /* An error for a pack; the plugin can scale the bone down to fit. */
          level: target === 'pack' ? 'error' : 'warning',
          where: tag,
          message: `${AXES[i]} runs ${from[i]} to ${to[i]}${cube.inflate ? ' once inflated' : ''}, but an element must stay inside -16..32${
            target === 'pack' ? '' : '. The plugin scales the bone down to fit'
          }`,
        })
      }
    }

    const blank = FACES.filter((f) => !cube.faces[f].texture)
    if (blank.length === 6) {
      out.push({ level: 'warning', where: tag, message: 'has no textured faces, so it exports invisible' })
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

/** A name valid in a resource path. Texture references and file names both use it, so they always match. */
export const safeId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'model'

/** A texture's name in the pack, for the model's reference and the PNG path alike. */
export const textureName = (texName: string, fallback: string) =>
  safeId((texName || fallback).replace(/\.png$/i, ''))

/** UV units to the 0..16 space a model file measures UVs in. */
const uvTo16 = (v: number, span: number) => Math.round((v / span) * 16 * 10000) / 10000

const round = (v: number) => Math.round(v * 10000) / 10000

/** The model file and its pack issues. `display` holds the Display tab's eight slots. */
export function toMinecraftModel(
  model: Model,
  namespace: string,
  folder: 'item' | 'block',
  display?: Record<string, { rotation: Vec3; translation: Vec3; scale: Vec3 }>,
  /** the model's file stem in the pack, also used for an unnamed texture */
  assetName?: string,
): { json: McModel; issues: TranslationIssue[] } {
  const issues = checkTranslation(model, folder === 'block' ? 'blocks' : 'items', 'pack')

  /* One variable per texture, in order, so `#0` is the first sheet.
     Minecraft takes break particles from `particle`. */
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
    /* An element has one pivot. With two or more turns the pack check
       reports an error and no rotation is written. */
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
    /* Only what differs from identity. With no parent model, Minecraft
       reads an absent slot or field as identity. */
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
