/* ---------------------------------------------------------------
   The scene a model is actually going to live in.

   The Display tab shows a model on a tilted grid with nothing to judge
   it against: no ground, no sky, and above all nothing of a known size.
   A mob that looks right floating in a void is routinely twice the
   height of a player, and you find that out in game.

   So: build a small Minecraft-shaped world, drop the model into it
   beside something a known two blocks tall, and play its animation
   there. The world is a `.vellum` model like any other - the same
   cubes, bones, UVs and clips - which means the renderer, the camera
   and the animation system all work on it unchanged.

   Everything is in model units, where 16 units is one block.
   --------------------------------------------------------------- */

import { FACES } from './model'
import type { Bone, BoneChild, Clip, Cube, Face, FaceKey, Key, Model, ProjectKind, Texture, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'

export const BLOCK = 16

/* ---------------- the atlas ---------------- */

type Rect = [number, number, number, number]

const ATLAS = 256

/** Where each thing lives on the world sheet, in texels. */
const R = {
  grassField: [0, 0, 112, 112] as Rect,
  dirtField: [112, 0, 224, 112] as Rect,
  grassStrip: [0, 112, 112, 128] as Rect,
  dirtStrip: [0, 128, 112, 144] as Rect,
  logColumn: [0, 144, 16, 208] as Rect,
  logTop: [16, 144, 32, 160] as Rect,
  leafField: [32, 144, 80, 192] as Rect,
  leafTile: [80, 144, 96, 160] as Rect,
  waterField: [96, 144, 128, 176] as Rect,
  stone: [128, 144, 144, 160] as Rect,
  plank: [144, 144, 160, 160] as Rect,
  sand: [160, 144, 176, 160] as Rect,
} as const

type TileKind =
  | 'grass_top' | 'grass_side' | 'dirt' | 'stone' | 'log_side' | 'log_top'
  | 'leaves' | 'water' | 'plank' | 'sand'

/** A deterministic hash, so the same world is the same world every time. */
function noise(x: number, y: number, salt: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

const rgb = (r: number, g: number, b: number) => `rgb(${r | 0},${g | 0},${b | 0})`

/** One 16x16 block face, painted texel by texel. */
function tile(ctx: CanvasRenderingContext2D, kind: TileKind, ox: number, oy: number, salt = 0) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = noise(ox + x, oy + y, salt)
      let colour: string | null = null
      switch (kind) {
        case 'grass_top': {
          const k = 0.86 + n * 0.28
          colour = rgb(88 * k, 134 * k, 58 * k)
          break
        }
        case 'grass_side': {
          // the green lip sits on top, with a ragged edge into the dirt
          const lip = 3 + Math.floor(noise(ox + x, 0, salt + 3) * 2)
          const k = 0.86 + n * 0.28
          colour = y < lip ? rgb(88 * k, 134 * k, 58 * k) : rgb(134 * k, 98 * k, 66 * k)
          break
        }
        case 'dirt': {
          const k = 0.85 + n * 0.3
          colour = rgb(134 * k, 98 * k, 66 * k)
          break
        }
        case 'stone': {
          const k = 0.82 + n * 0.34
          colour = rgb(126 * k, 126 * k, 128 * k)
          break
        }
        case 'log_side': {
          // vertical grain, so a trunk reads as a trunk rather than a post
          const grain = noise(x, 0, salt + 7) > 0.7 ? 0.82 : 1
          const k = (0.9 + n * 0.18) * grain
          colour = rgb(107 * k, 80 * k, 48 * k)
          break
        }
        case 'log_top': {
          const d = Math.hypot(x - 7.5, y - 7.5)
          const ring = Math.sin(d * 2.1) > 0.3 ? 0.84 : 1
          colour = rgb(160 * ring, 126 * ring, 82 * ring)
          break
        }
        case 'leaves': {
          // real gaps, not painted ones - the canopy has to be see-through
          if (n > 0.86) continue
          const k = 0.78 + n * 0.4
          colour = rgb(62 * k, 106 * k, 44 * k)
          break
        }
        case 'water': {
          const wave = Math.sin((x + y * 0.6) * 0.8 + salt) * 0.06
          const k = 0.92 + n * 0.1 + wave
          colour = rgb(58 * k, 108 * k, 196 * k)
          break
        }
        case 'plank': {
          const line = y % 5 === 0 ? 0.78 : 1
          const k = (0.9 + n * 0.16) * line
          colour = rgb(165 * k, 129 * k, 78 * k)
          break
        }
        case 'sand': {
          const k = 0.9 + n * 0.18
          colour = rgb(221 * k, 212 * k, 162 * k)
          break
        }
      }
      if (!colour) continue
      ctx.fillStyle = colour
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  }
}

function field(ctx: CanvasRenderingContext2D, kind: TileKind, rect: Rect) {
  const [x1, y1, x2, y2] = rect
  let salt = 0
  for (let y = y1; y < y2; y += 16) {
    for (let x = x1; x < x2; x += 16) tile(ctx, kind, x, y, (salt += 1))
  }
}

/** The whole terrain sheet, built once per scene. */
export function worldTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS
  canvas.height = ATLAS
  const ctx = canvas.getContext('2d')
  if (ctx) {
    field(ctx, 'grass_top', R.grassField)
    field(ctx, 'dirt', R.dirtField)
    field(ctx, 'grass_side', R.grassStrip)
    field(ctx, 'dirt', R.dirtStrip)
    field(ctx, 'log_side', R.logColumn)
    field(ctx, 'log_top', R.logTop)
    field(ctx, 'leaves', R.leafField)
    field(ctx, 'leaves', R.leafTile)
    field(ctx, 'water', R.waterField)
    field(ctx, 'stone', R.stone)
    field(ctx, 'plank', R.plank)
    field(ctx, 'sand', R.sand)
  }
  return {
    id: newId(),
    name: 'world.png',
    width: ATLAS,
    height: ATLAS,
    uvWidth: ATLAS,
    uvHeight: ATLAS,
    source: canvas.toDataURL('image/png'),
  }
}

/* ---------------- blocks ---------------- */

const faceSet = (
  texture: string,
  rects: Partial<Record<FaceKey, Rect>>,
  fallback: Rect,
): Record<FaceKey, Face> =>
  Object.fromEntries(
    FACES.map((k) => [k, { uv: (rects[k] ?? fallback) as UVRect, texture, rotation: 0 as const }]),
  ) as Record<FaceKey, Face>

function block(
  name: string,
  from: Vec3,
  to: Vec3,
  faces: Record<FaceKey, Face>,
): Cube {
  return {
    id: newId(),
    name,
    from,
    to,
    origin: [from[0], from[1], from[2]],
    rotation: [0, 0, 0],
    faces,
    inflate: 0,
    boxUv: false,
    visible: true,
    locked: true,
  }
}

/* ---------------- the player ---------------- */

const SKIN = '#c98c62'
const SHIRT = '#3f6ea8'
const TROUSER = '#2a3157'
const HAIR = '#3a2a1d'
const SHOE = '#2e2b29'

/**
 * Two blocks tall, which is the whole point of it: a mob is either
 * about the height of the thing standing next to it or it is not, and
 * that is not a judgement anybody makes reliably against a void.
 */
function playerTexture(): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const parts: Array<[Rect, string]> = [
    [[0, 0, 16, 16], SKIN],
    [[16, 0, 32, 16], HAIR],
    [[32, 0, 48, 16], SHIRT],
    [[48, 0, 64, 16], TROUSER],
    [[0, 16, 16, 32], SHOE],
  ]
  if (ctx) {
    for (const [rect, colour] of parts) {
      const [x1, y1, x2, y2] = rect
      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          const n = noise(x, y, 11)
          const k = 0.93 + n * 0.14
          const r = parseInt(colour.slice(1, 3), 16) * k
          const g = parseInt(colour.slice(3, 5), 16) * k
          const b = parseInt(colour.slice(5, 7), 16) * k
          ctx.fillStyle = rgb(r, g, b)
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    // a face, so which way it is looking is not a guess
    ctx.fillStyle = '#20242e'
    ctx.fillRect(3, 6, 2, 2)
    ctx.fillRect(11, 6, 2, 2)
    ctx.fillStyle = '#8c5a48'
    ctx.fillRect(6, 10, 4, 1)
  }
  return {
    id: newId(),
    name: 'player.png',
    width: size,
    height: size,
    uvWidth: size,
    uvHeight: size,
    source: canvas.toDataURL('image/png'),
  }
}

const SKIN_UV: Rect = [0, 0, 16, 16]
const HAIR_UV: Rect = [16, 0, 32, 16]
const SHIRT_UV: Rect = [32, 0, 48, 16]
const TROUSER_UV: Rect = [48, 0, 64, 16]
const SHOE_UV: Rect = [0, 16, 16, 32]

/**
 * `facing` is worked out rather than passed: rotateY maps the local -z
 * axis to (-sin, 0, -cos), so the yaw that points a figure at the
 * origin from (x, z) is atan2(x, z). Guessing it by eye put the player
 * side-on to the thing it was there to be compared with.
 */
function playerParts(t: string, at: Vec3): { cubes: Cube[]; bone: Bone } {
  const [x, y, z] = at
  const facing = (Math.atan2(x, z) * 180) / Math.PI
  const head = block('player_head', [x - 4, y + 24, z - 4], [x + 4, y + 32, z + 4],
    faceSet(t, { up: HAIR_UV, north: SKIN_UV }, SKIN_UV))
  const body = block('player_body', [x - 4, y + 12, z - 2], [x + 4, y + 24, z + 2], faceSet(t, {}, SHIRT_UV))
  const armL = block('player_arm_left', [x - 8, y + 12, z - 2], [x - 4, y + 24, z + 2], faceSet(t, { down: SKIN_UV }, SHIRT_UV))
  const armR = block('player_arm_right', [x + 4, y + 12, z - 2], [x + 8, y + 24, z + 2], faceSet(t, { down: SKIN_UV }, SHIRT_UV))
  const legL = block('player_leg_left', [x - 4, y, z - 2], [x, y + 12, z + 2], faceSet(t, { down: SHOE_UV }, TROUSER_UV))
  const legR = block('player_leg_right', [x, y, z - 2], [x + 4, y + 12, z + 2], faceSet(t, { down: SHOE_UV }, TROUSER_UV))
  const cubes = [head, body, armL, armR, legL, legR]
  return {
    cubes,
    bone: {
      id: newId(),
      name: 'player',
      origin: [x, y, z],
      rotation: [0, facing, 0],
      visible: true,
      locked: true,
      children: cubes.map((c) => ({ kind: 'cube', id: c.id }) as BoneChild),
    },
  }
}

/* ---------------- the terrain ---------------- */

function terrain(t: string): { cubes: Cube[]; bone: Bone } {
  const half = 56 // a 7 x 7 platform, centred on the model
  const pond = BLOCK * 2 // the notch the water sits in
  const cubes: Cube[] = []

  /* Two cubes for the whole field rather than forty-nine, with a notch
     left in one corner. The sheet carries a 7x7 patch of grass and a
     7-wide strip for the sides, so it tiles properly instead of
     stretching one texel across a block. Any sub-rectangle of a tiled
     patch is itself tiled, which is what lets the field be cut up. */
  cubes.push(
    block('ground', [-half, -BLOCK, -half], [half - pond, 0, half],
      faceSet(t, { up: [0, 0, 80, 112], down: R.dirtStrip }, R.grassStrip)),
  )
  cubes.push(
    block('ground_east', [half - pond, -BLOCK, -half], [half, 0, half - pond],
      faceSet(t, { up: [0, 0, 32, 80], down: R.dirtStrip }, R.grassStrip)),
  )

  /* The pond goes in the notch. Sunk into a solid slab it was two
     coplanar faces fighting each other, and all that showed of it was a
     blue seam along one edge. */
  cubes.push(
    block('pond_bed', [half - pond, -BLOCK, half - pond], [half, -6, half], faceSet(t, {}, R.sand)),
  )
  cubes.push(
    block('pond', [half - pond, -6, half - pond], [half, -2, half], faceSet(t, {}, R.waterField)),
  )

  // a step up at the back corner, so the ground is not one flat plane
  cubes.push(
    block('ledge', [-half, 0, -half], [-half + BLOCK * 2, BLOCK, -half + BLOCK * 2],
      faceSet(t, { up: [0, 0, 32, 32], down: R.dirtStrip }, R.grassStrip)),
  )
  cubes.push(
    block('outcrop', [-half, BLOCK, -half], [-half + BLOCK, BLOCK * 2, -half + BLOCK],
      faceSet(t, {}, R.stone)),
  )

  /* A tree, in the corner furthest from the camera's usual angle and
     short enough to stay inside the frame - a trunk that leaves the top
     of the panel is scenery nobody can see. */
  const tx = -half + BLOCK * 1.5
  const tz = half - BLOCK * 1.5
  cubes.push(
    block('trunk', [tx - 4, 0, tz - 4], [tx + 4, 40, tz + 4],
      faceSet(t, { up: R.logTop, down: R.logTop }, R.logColumn)),
  )
  cubes.push(
    block('canopy', [tx - 20, 34, tz - 20], [tx + 20, 54, tz + 20],
      faceSet(t, { up: R.leafField, down: R.leafField }, R.leafField)),
  )
  cubes.push(
    block('canopy_top', [tx - 10, 54, tz - 10], [tx + 10, 62, tz + 10],
      faceSet(t, {}, R.leafField)),
  )

  // a fence, for a sense of depth behind the model
  for (let i = 0; i < 3; i++) {
    const px = -BLOCK + i * BLOCK
    cubes.push(
      block(`post_${i}`, [px - 2, 0, -half + 2], [px + 2, 22, -half + 6], faceSet(t, {}, R.plank)),
    )
  }
  cubes.push(
    block('rail', [-BLOCK - 2, 14, -half + 3], [BLOCK + 2, 18, -half + 5], faceSet(t, {}, R.plank)),
  )

  return {
    cubes,
    bone: {
      id: newId(),
      name: 'terrain',
      origin: [0, 0, 0],
      rotation: [0, 0, 0],
      visible: true,
      locked: true,
      children: cubes.map((c) => ({ kind: 'cube', id: c.id }) as BoneChild),
    },
  }
}

/* ---------------- placing the subject ---------------- */

export type Placement = 'ground' | 'air' | 'dropped'

const TOOLS = /sword|blade|axe|pick|shovel|spade|hoe|knife|dagger|spear|lance|bow|staff|wand|hammer|mace|scythe|fang|cleaver|sickle|glaive/i

/**
 * What the scene does with a model when nobody has said. Tools, weapons
 * and consumables are things you drop on the floor; a plain item model
 * is a thing you hold up and look at.
 */
export function defaultPlacement(kind: ProjectKind, name: string): Placement {
  if (kind === 'mobs' || kind === 'blocks') return 'ground'
  if (kind === 'consumables') return 'dropped'
  return TOOLS.test(name) ? 'dropped' : 'air'
}

function boundsOf(model: Model) {
  const lo: Vec3 = [Infinity, Infinity, Infinity]
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const c of model.cubes) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], c.from[i])
      hi[i] = Math.max(hi[i], c.to[i])
    }
  }
  if (!model.cubes.length) return { lo: [0, 0, 0] as Vec3, hi: [0, 0, 0] as Vec3 }
  return { lo, hi }
}

/** Scale about the origin, then shift. Bone ids survive, so clips still drive it. */
function transformed(model: Model, factor: number, shift: Vec3): { cubes: Cube[]; bones: Bone[] } {
  const v = (p: Vec3): Vec3 => [p[0] * factor + shift[0], p[1] * factor + shift[1], p[2] * factor + shift[2]]
  const cubes = model.cubes.map((c) => ({ ...c, from: v(c.from), to: v(c.to), origin: v(c.origin) }))
  const walk = (bones: Bone[]): Bone[] =>
    bones.map((b) => ({
      ...b,
      origin: v(b.origin),
      children: b.children.map((child) =>
        child.kind === 'bone' ? ({ kind: 'bone', bone: walk([child.bone])[0] } as BoneChild) : child,
      ),
    }))
  return { cubes, bones: walk(model.bones) }
}

export type WorldOptions = {
  kind: ProjectKind
  placement: Placement
  /** a player entity beside the model, for height and for reach */
  withPlayer: boolean
}

export type BuiltWorld = {
  model: Model
  /** the bone the subject hangs from, so the scene can pose it */
  subjectId: string
  /** how tall the model is, in blocks, for the caption */
  blocks: number
  /** the middle of the subject, so the camera can look at it rather than at the island */
  focus: Vec3
  /** what it decided to do with it */
  placement: Placement
}

export function buildWorld(subject: Model, opts: WorldOptions): BuiltWorld {
  const world = worldTexture()
  const skin = playerTexture()
  const ground = terrain(world.id)

  const { lo, hi } = boundsOf(subject)
  const height = Math.max(hi[1] - lo[1], 1)
  const span = Math.max(hi[0] - lo[0], hi[2] - lo[2], 1)

  /* A dropped item is a quarter size in Minecraft and sits just off the
     ground. An item held up for inspection is scaled to something that
     reads at this distance rather than left at whatever the modeller
     happened to build it at. */
  const factor =
    opts.placement === 'dropped' ? 0.45 : opts.placement === 'air' ? Math.min(1.6, 26 / Math.max(height, span)) : 1

  const shift: Vec3 =
    opts.placement === 'air'
      ? [0, 30 - lo[1] * factor, 0]
      : opts.placement === 'dropped'
        ? [0, 3 - lo[1] * factor, 0]
        : [0, -lo[1] * factor, 0]

  const moved = transformed(subject, factor, shift)

  const pose: Vec3 = opts.placement === 'dropped' ? [0, 0, 0] : [0, 0, 0]
  const subjectBone: Bone = {
    id: newId(),
    name: 'subject',
    origin: [0, 0, 0],
    rotation: pose,
    visible: true,
    locked: false,
    children: moved.bones.map((b) => ({ kind: 'bone', bone: b }) as BoneChild),
  }

  const children: BoneChild[] = [
    { kind: 'bone', bone: ground.bone },
    { kind: 'bone', bone: subjectBone },
  ]
  const cubes = [...ground.cubes, ...moved.cubes]
  const textures = [world, ...subject.textures]

  if (opts.withPlayer) {
    /* In front of the model and facing it, a little to one side, so an
       attack that lunges forward has something to lunge at without the
       target standing in the camera's way. */
    const player = playerParts(skin.id, [30, 0, -18])
    children.push({ kind: 'bone', bone: player.bone })
    cubes.push(...player.cubes)
    textures.push(skin)
  }

  const root: Bone = {
    id: newId(),
    name: 'world',
    origin: [0, 0, 0],
    rotation: [0, 0, 0],
    visible: true,
    locked: true,
    children,
  }

  const focus: Vec3 = [0, shift[1] + ((lo[1] + hi[1]) / 2) * factor, 0]

  return {
    focus,
    model: {
      name: `${subject.name} in the world`,
      kind: subject.kind,
      resolution: subject.resolution,
      bones: [root],
      cubes,
      textures,
      clips: subject.clips,
    },
    subjectId: subjectBone.id,
    blocks: Number((height / BLOCK).toFixed(2)),
    placement: opts.placement,
  }
}

/* ---------------- the scene's own clip ---------------- */

const key = (time: number, value: Vec3, interp: Key['interp'] = 'linear'): Key => ({
  id: newId(),
  time: Number(time.toFixed(4)),
  value,
  interp,
})

/**
 * The model's own animation, plus what the scene adds: a dropped item
 * turns and bobs the way a dropped item does, and a model with no clip
 * at all still turns slowly so every side of it can be seen.
 *
 * A `once` clip gets a beat of stillness on the end so a repeated
 * attack reads as separate swings rather than a stutter.
 */
export function sceneClip(built: BuiltWorld, clip: Clip | null): Clip | null {
  const extra: Track[] = []
  const base = clip?.length ?? 3
  const length = clip ? (clip.loop === 'once' ? clip.length * 1.4 : clip.length) : 3

  if (built.placement === 'dropped') {
    const spins = Math.max(1, Math.round(length / 2.5))
    extra.push({
      bone: built.subjectId,
      channel: 'rotation',
      keys: [0, 0.25, 0.5, 0.75, 1].map((f) => key(length * f, [0, 360 * spins * f, 0])),
    })
    extra.push({
      bone: built.subjectId,
      channel: 'position',
      keys: [
        key(0, [0, 0, 0], 'catmullrom'),
        key(length * 0.5, [0, 2.2, 0], 'catmullrom'),
        key(length, [0, 0, 0], 'catmullrom'),
      ],
    })
  } else if (built.placement === 'air') {
    extra.push({
      bone: built.subjectId,
      channel: 'rotation',
      keys: [0, 0.25, 0.5, 0.75, 1].map((f) => key(length * f, [0, 360 * f, 0])),
    })
    extra.push({
      bone: built.subjectId,
      channel: 'position',
      keys: [
        key(0, [0, 0, 0], 'catmullrom'),
        key(length * 0.5, [0, 3, 0], 'catmullrom'),
        key(length, [0, 0, 0], 'catmullrom'),
      ],
    })
  }

  if (!clip && !extra.length) return null

  return {
    id: newId(),
    name: clip ? `${clip.name} (scene)` : 'scene',
    loop: 'loop',
    length: Math.max(length, base),
    snapping: 0,
    tracks: [...(clip?.tracks ?? []), ...extra],
  }
}
