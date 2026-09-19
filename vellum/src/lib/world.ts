/* ---------------------------------------------------------------
   The scene a model is actually going to live in.

   The Display tab shows a model on a tilted grid with nothing to judge
   it against: no ground, and above all nothing of a known size.
   A mob that looks right floating in a void is routinely twice the
   height of a player, and you find that out in game.

   So: a flat field, a figure of a known two blocks beside it, and the
   model's animation played there. The world is a `.vellum` model like
   any other - the same cubes, bones, UVs and clips - which means the
   renderer, the camera and the animation system all work on it
   unchanged.

   The field is deliberately empty. It is not scenery; it is a ruler and
   a treadmill. A walk cycle played in place tells you the legs move; it
   does not tell you whether the mob covers ground or moonwalks, which
   is the thing you cannot see in the timeline and cannot unsee in game.
   So the ground travels under the model at the speed the legs are
   actually asking for, and a walk loops forever.

   Three things make it read as Minecraft rather than as coloured boxes:

   1. One texel per unit, always. A block face is 16 texels across
      because it is 16 units across, so a 4-unit fence post shows a
      4-texel slice of the plank pattern rather than the whole thing
      squeezed. That is how Minecraft's own small models work.
   2. Minecraft's directional shading, which is fixed rather than
      computed: top 1.0, north and south 0.8, east and west 0.6, bottom
      0.5. It is baked into the texture per face, which is also what
      Minecraft does with its lightmap.
   3. Sky light as a multiplier on that bake. Night is not a filter over
      the finished picture - it is the world being darker, which is why
      the model keeps its own colours and stands out of it.
   --------------------------------------------------------------- */

import { FACES } from './model'
import type { Bone, BoneChild, Clip, Cube, Face, FaceKey, Key, Model, ProjectKind, Subtype, Texture, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'
import { readRig } from './auto-rig'

export const BLOCK = 16

/** Minecraft's fixed directional shading. Not a lighting model - a table. */
const FACE_SHADE: Record<FaceKey, number> = {
  up: 1,
  down: 0.5,
  north: 0.8,
  south: 0.8,
  east: 0.6,
  west: 0.6,
}


/** Sky light, and the colour the world is tinted toward under it. */
/**
 * There is no sky to light this any more, so there is one exposure and
 * it is the model's own. The directional shading table still applies -
 * that belongs to the geometry, not to the weather - but nothing tints
 * or dims the stage, which is what lets a glow read as a glow against
 * the black rather than against a field at dusk.
 */
const STAGE_LIGHT = 1

/* ---------------- the atlas ---------------- */

type Rect = [number, number, number, number]

type TileKind =
  | 'floor'
  | 'skin' | 'hair' | 'shirt' | 'sleeve' | 'trouser' | 'boot' | 'face'
  | 'void'

/** Deterministic, so the same world is the same world every time. */
function noise(x: number, y: number, salt: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

type Paint = { r: number; g: number; b: number; a?: number }

/**
 * One texel of one block type, at texture coordinates that repeat every
 * 16 - so a face can start anywhere in the pattern and still line up
 * with its neighbours.
 */
function texel(kind: TileKind, tx: number, ty: number): Paint | null {
  const x = ((tx % 16) + 16) % 16
  const y = ((ty % 16) + 16) % 16
  const n = noise(x, y, kind.length)
  const jitter = (base: [number, number, number], amount: number): Paint => {
    const k = 1 - amount / 2 + n * amount
    return { r: base[0] * k, g: base[1] * k, b: base[2] * k }
  }

  switch (kind) {
    case 'floor': {
      /* Near-black, with one lighter texel on the block boundary. The
         stage is meant to disappear, but a floor that disappears
         entirely takes the treadmill with it: a walking mob would look
         like a walking mob standing still. One line every block is the
         least that still shows ground moving, and doubles as the ruler
         it already had to be - so it is one line, dim, and nothing
         else: a grid that draws the eye is a grid competing with the
         model for it. */
      if (x === 0 || y === 0) return { r: 31, g: 33, b: 39 }
      return jitter([11, 12, 15], 0.07)
    }
    case 'skin':
      return jitter([199, 140, 98], 0.06)
    case 'hair':
      return jitter([58, 42, 29], 0.1)
    case 'shirt':
      return jitter([62, 110, 168], 0.06)
    case 'sleeve':
      // a sleeve that ends in a hand, and a shade off the shirt so the
      // arms are not the same blue slab as the body they hang from
      return y > 11 ? jitter([199, 140, 98], 0.06) : jitter([74, 124, 182], 0.06)
    case 'trouser':
      return jitter([42, 49, 87], 0.07)
    case 'boot':
      return jitter([46, 43, 41], 0.08)
    case 'face': {
      // eyes and a mouth, so which way it is looking is not a guess
      if (y >= 6 && y <= 7 && (x === 3 || x === 4 || x === 11 || x === 12))
        return x === 3 || x === 11 ? { r: 240, g: 240, b: 245 } : { r: 40, g: 52, b: 92 }
      if (y === 10 && x >= 6 && x <= 9) return { r: 138, g: 90, b: 72 }
      if (y < 3) return jitter([58, 42, 29], 0.1)
      return jitter([199, 140, 98], 0.06)
    }
    case 'void':
      // a face that is never meant to be seen, and costs one texel to say so
      return null
    default:
      return null
  }
}

/**
 * Shelf-packs one region per (block type, size, shade) and paints it on
 * first request, so nine ground slabs share the one patch of grass.
 */
class Atlas {
  readonly size: number
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly canvas: HTMLCanvasElement
  private readonly spots = new Map<string, Rect>()
  private x = 0
  private y = 0
  private shelf = 0

  constructor(size: number) {
    this.size = size
    this.canvas = document.createElement('canvas')
    this.canvas.width = size
    this.canvas.height = size
    this.ctx = this.canvas.getContext('2d')
    /* Claimed first so that it is also what a request past the end of
       the sheet falls back to. The old fallback handed out whatever had
       been packed first, which was the field - so overflowing the
       atlas painted floor onto everything instead of failing visibly. */
    this.region('void', 4, 4, 1)
  }

  /**
   * `emissive` ignores the stage exposure, for a flame. `fit` scales the 16x16
   * motif onto the region instead of slicing it: a fence post wants a
   * 4-texel slice of the plank pattern, but a player's 8-unit head
   * wants the whole face on it, not the top-left corner of one.
   */
  region(
    kind: TileKind,
    w: number,
    h: number,
    shade: number,
    emissive = false,
    fit = false,
  ): Rect {
    const width = Math.max(1, Math.round(w))
    const height = Math.max(1, Math.round(h))
    const key = `${kind}:${width}x${height}:${shade.toFixed(2)}:${emissive ? 'e' : 'l'}:${fit ? 'f' : 's'}`
    const found = this.spots.get(key)
    if (found) return found

    /* A texel of clearance around every island. A face 160 units wide
       samples its region at 160x, and at that magnification the filter
       reaches past the edge into whatever was packed next door - which
       drew pale seams across the plain where a transparent face sat
       beside a green one. */
    const pad = 1
    if (this.x + width + pad > this.size) {
      this.x = 0
      this.y += this.shelf
      this.shelf = 0
    }
    // out of sheet: hand back the first region rather than draw off it
    if (this.y + height + pad > this.size) return this.spots.values().next().value ?? [0, 0, 1, 1]

    const at: Rect = [this.x, this.y, this.x + width, this.y + height]
    this.x += width + pad
    this.shelf = Math.max(this.shelf, height + pad)
    this.spots.set(key, at)
    this.paint(kind, at, shade, emissive, fit)
    return at
  }

  private paint(kind: TileKind, at: Rect, shade: number, emissive: boolean, fit: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    const [x0, y0, x1, y1] = at
    const w = x1 - x0
    const h = y1 - y0
    const k = emissive ? 1 : shade * STAGE_LIGHT

    /* One ImageData rather than a fillRect per texel. The field is a
       960 x 640 patch - six hundred thousand of them - and painting it
       a rectangle at a time cost half a second every time the
       placement changed. */
    const img = ctx.createImageData(w, h)
    const px = img.data
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = fit
          ? texel(kind, Math.floor((x * 16) / w), Math.floor((y * 16) / h))
          : texel(kind, x, y)
        const i = (y * w + x) * 4
        if (!t) {
          px[i + 3] = 0
          continue
        }
        px[i] = t.r * k
        px[i + 1] = t.g * k
        px[i + 2] = t.b * k
        px[i + 3] = (t.a ?? 1) * 255
      }
    }
    ctx.putImageData(img, x0, y0)
  }

  texture(name: string): Texture {
    return {
      id: newId(),
      name,
      width: this.size,
      height: this.size,
      uvWidth: this.size,
      uvHeight: this.size,
      source: this.canvas.toDataURL('image/png'),
    }
  }
}

/* ---------------- blocks ---------------- */

type Skin = Partial<Record<FaceKey, TileKind>> & { all?: TileKind }

/**
 * A cube, textured one texel per unit and shaded per face the way
 * Minecraft shades. `size` comes from the cube itself, so nothing has
 * to be kept in step by hand.
 */
function block(
  atlas: Atlas,
  texture: string,
  name: string,
  from: Vec3,
  to: Vec3,
  skin: Skin,
  opts: { emissive?: boolean; fit?: boolean; rotation?: Vec3; origin?: Vec3 } = {},
): Cube {
  const w = Math.abs(to[0] - from[0])
  const h = Math.abs(to[1] - from[1])
  const d = Math.abs(to[2] - from[2])
  const span: Record<FaceKey, [number, number]> = {
    up: [w, d],
    down: [w, d],
    north: [w, h],
    south: [w, h],
    east: [d, h],
    west: [d, h],
  }

  const faces = Object.fromEntries(
    FACES.map((key) => {
      const kind: TileKind = skin[key] ?? skin.all ?? 'void'
      // a void face is transparent at any size, so it claims one texel
      const [fw, fh] = kind === 'void' ? [4, 4] : span[key]
      const uv = atlas.region(kind, fw, fh, FACE_SHADE[key], opts.emissive, opts.fit) as UVRect
      return [key, { uv, texture, rotation: 0 as const }]
    }),
  ) as Record<FaceKey, Face>

  return {
    id: newId(),
    name,
    from,
    to,
    origin: opts.origin ?? [from[0], from[1], from[2]],
    rotation: opts.rotation ?? [0, 0, 0],
    faces,
    inflate: 0,
    boxUv: false,
    visible: true,
    locked: true,
  }
}

/* ---------------- the terrain ---------------- */


/**
 * A flat field, and nothing else on it.
 *
 * One cube, not a grid of them. A tiled field needs its cubes to
 * overlap or antialiasing leaves a hairline of the stage along every join,
 * and once they overlap their coplanar tops fight over which is in
 * front - either way a grid gets drawn across the grass. Offsetting
 * them in height trades that for a sliver of transparency at each
 * step, because the sides are void. There is no arrangement of many
 * cubes that has no seam; one cube has no join to show.
 *
 * It costs a 960 x 640 patch of the sheet, which sounds expensive and
 * is not: the pattern repeats every 16 texels, so it is about 75 KB of
 * PNG. Its sides and underside are a single transparent texel each -
 * the frame never reaches them.
 */
function terrain(atlas: Atlas, t: string): { cubes: Cube[]; bone: Bone } {
  const cube = block(atlas, t, 'field', [-480, -BLOCK, -320], [480, 0, 320], {
    up: 'floor',
    all: 'void',
  })

  return {
    cubes: [cube],
    bone: {
      id: newId(),
      name: 'ground',
      origin: [0, 0, 0],
      rotation: [0, 0, 0],
      visible: true,
      locked: true,
      children: [{ kind: 'cube', id: cube.id }],
    },
  }
}

/* ---------------- the player ---------------- */

export type PlayerRig = { legs: [string, string]; arms: [string, string] }

/**
 * Two blocks tall, which is the whole point of it: a mob is either
 * about the height of the thing standing next to it or it is not, and
 * that is not a judgement anybody makes reliably against a void.
 *
 * Rigged on joints rather than welded into one piece, so that when the
 * ground starts moving it can walk at the same speed instead of
 * standing still on a floor sliding out from under it.
 *
 * `facing` is worked out rather than passed: rotateY maps the local -z
 * axis to (-sin, 0, -cos), so the yaw that points a figure at the
 * origin from (x, z) is atan2(x, z) - eased back toward the camera,
 * because a figure turned squarely at the model shows the viewer the
 * back of its head.
 */
function playerParts(
  atlas: Atlas,
  t: string,
  at: Vec3,
): { cubes: Cube[]; bone: Bone; rig: PlayerRig } {
  const [x, y, z] = at
  const facing = (Math.atan2(x, z) * 180) / Math.PI - 26
  const put = (name: string, from: Vec3, to: Vec3, skin: Skin) =>
    block(atlas, t, name, from, to, skin, { fit: true })

  const head = put('player_head', [x - 4, y + 24, z - 4], [x + 4, y + 32, z + 4], {
    up: 'hair',
    north: 'face',
    all: 'skin',
  })
  const body = put('player_body', [x - 4, y + 12, z - 2], [x + 4, y + 24, z + 2], { all: 'shirt' })
  const armL = put('player_arm_left', [x - 8, y + 12, z - 2], [x - 4, y + 24, z + 2], { down: 'skin', all: 'sleeve' })
  const armR = put('player_arm_right', [x + 4, y + 12, z - 2], [x + 8, y + 24, z + 2], { down: 'skin', all: 'sleeve' })
  const legL = put('player_leg_left', [x - 4, y, z - 2], [x, y + 12, z + 2], { down: 'boot', all: 'trouser' })
  const legR = put('player_leg_right', [x, y, z - 2], [x + 4, y + 12, z + 2], { down: 'boot', all: 'trouser' })

  const joint = (name: string, origin: Vec3, cube: Cube, children: BoneChild[] = []): Bone => ({
    id: newId(),
    name,
    origin,
    rotation: [0, 0, 0],
    visible: true,
    locked: true,
    children: [{ kind: 'cube', id: cube.id }, ...children],
  })

  const headBone = joint('player_neck', [x, y + 24, z], head)
  const armLBone = joint('player_shoulder_left', [x - 4, y + 23, z], armL)
  const armRBone = joint('player_shoulder_right', [x + 4, y + 23, z], armR)
  const legLBone = joint('player_hip_left', [x - 2, y + 12, z], legL)
  const legRBone = joint('player_hip_right', [x + 2, y + 12, z], legR)
  const torso = joint('player_torso', [x, y + 12, z], body, [
    { kind: 'bone', bone: headBone },
    { kind: 'bone', bone: armLBone },
    { kind: 'bone', bone: armRBone },
  ])

  return {
    cubes: [head, body, armL, armR, legL, legR],
    rig: { legs: [legLBone.id, legRBone.id], arms: [armLBone.id, armRBone.id] },
    bone: {
      id: newId(),
      name: 'player',
      origin: [x, y, z],
      rotation: [0, facing, 0],
      visible: true,
      locked: true,
      children: [
        { kind: 'bone', bone: torso },
        { kind: 'bone', bone: legLBone },
        { kind: 'bone', bone: legRBone },
      ],
    },
  }
}

/* ---------------- how far a walk actually walks ---------------- */

/** The legs' own reach, so a walk covers the ground it looks like it covers. */
const PLAYER_LEG = 12

export type Travel = {
  /** what the legs are asking for, in units per cycle */
  asked: number
  /** whole blocks per cycle - the only distance the field can loop on */
  blocks: number
  /** units per second, after rounding */
  speed: number
}

export const NO_TRAVEL: Travel = { asked: 0, blocks: 0, speed: 0 }

/**
 * How far a clip means to travel, read off the rig rather than guessed
 * or asked for. A leg swinging by `a` degrees about a pivot `r` from
 * the foot sweeps an arc whose chord is `2r sin(a)`, and that chord is
 * the ground a stride covers.
 *
 * Only a looping clip travels. An attack lunges and comes back; a
 * model that walked away during one would be worse than one that
 * stayed put.
 */
export function travelOf(subject: Model, clip: Clip | null): Travel {
  if (!clip || clip.loop !== 'loop' || clip.length <= 0) return NO_TRAVEL
  const rig = readRig(subject)
  if (!rig.byRole.leg.length) return NO_TRAVEL

  let asked = 0
  for (const leg of rig.byRole.leg) {
    const track = clip.tracks.find((t) => t.bone === leg.id && t.channel === 'rotation')
    if (!track || track.keys.length < 2) continue
    const swing = Math.max(...track.keys.map((k) => Math.abs(k.value[0])))
    asked = Math.max(asked, 2 * leg.reach * Math.sin((swing * Math.PI) / 180))
  }

  // a breathing idle rocks the legs a degree or two; that is not walking
  if (asked < 3) return NO_TRAVEL

  /* The field is tiled, so it can only wrap on a whole block - anything
     else jumps visibly at the loop. Rounding the stride there is what
     buys a seam nobody can see, and the speed reported back is the
     rounded one, because that is the speed you are looking at. */
  const blocks = Math.max(1, Math.round(asked / BLOCK))
  return { asked, blocks, speed: (blocks * BLOCK) / clip.length }
}

/* ---------------- placing the subject ---------------- */

export type Placement = 'ground' | 'air' | 'dropped'

const TOOLS = /sword|blade|axe|pick|shovel|spade|hoe|knife|dagger|spear|lance|bow|staff|wand|hammer|mace|scythe|fang|cleaver|sickle|glaive/i

/**
 * What the scene does with a model when nobody has said. Tools, weapons
 * and consumables are things you drop on the floor; a plain item model
 * is a thing you hold up and look at.
 */
export function defaultPlacement(kind: ProjectKind, name: string, subtype?: Subtype): Placement {
  if (kind === 'mobs' || kind === 'blocks') return 'ground'
  /* A subtype is something the project actually said, so it beats the
     name test below, which is a guess over a vocabulary. */
  if (subtype === 'consumable' || subtype === 'weapon' || subtype === 'tool') return 'dropped'
  if (subtype === 'misc') return 'air'
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
  /** night darkens the world, not the model - which is the point of it */
}

export type BuiltWorld = {
  model: Model
  /** the bone the subject hangs from, so the scene can pose it */
  subjectId: string
  /** the field, which is what moves when the model walks */
  groundId: string
  /** the reference figure's joints, so it can walk at the same speed */
  player: PlayerRig | null
  /** how tall the model is, in blocks, for the caption */
  blocks: number
  /** the middle of the subject, so the camera can look at it rather than at the island */
  focus: Vec3
  /** what it decided to do with it */
  placement: Placement
}

export function buildWorld(subject: Model, opts: WorldOptions): BuiltWorld {
  const atlas = new Atlas(1024)
  const id = newId()
  const ground = terrain(atlas, id)
  const player = opts.withPlayer ? playerParts(atlas, id, [34, 0, 4]) : null
  const sheet: Texture = { ...atlas.texture('world.png'), id }

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

  const subjectBone: Bone = {
    id: newId(),
    name: 'subject',
    origin: [0, 0, 0],
    rotation: [0, 0, 0],
    visible: true,
    locked: false,
    children: moved.bones.map((b) => ({ kind: 'bone', bone: b }) as BoneChild),
  }

  const children: BoneChild[] = [
    { kind: 'bone', bone: ground.bone },
    { kind: 'bone', bone: subjectBone },
  ]
  const cubes = [...ground.cubes, ...moved.cubes]
  if (player) {
    children.push({ kind: 'bone', bone: player.bone })
    cubes.push(...player.cubes)
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

  return {
    focus: [0, shift[1] + ((lo[1] + hi[1]) / 2) * factor, 0],
    groundId: ground.bone.id,
    player: player?.rig ?? null,
    model: {
      name: `${subject.name} in the world`,
      kind: subject.kind,
      resolution: subject.resolution,
      bones: [root],
      cubes,
      textures: [sheet, ...subject.textures],
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
export function sceneClip(built: BuiltWorld, clip: Clip | null, travel: Travel = NO_TRAVEL): Clip | null {
  const extra: Track[] = []
  const base = clip?.length ?? 3
  const length = clip ? (clip.loop === 'once' ? clip.length * 1.4 : clip.length) : 3

  /* The model walks by standing still while the world goes past it,
     which is the only way a walk can loop forever and stay in frame.
     One whole block per cycle wraps invisibly on a tiled field. */
  if (built.placement === 'ground' && travel.speed > 0 && clip) {
    const dist = travel.blocks * BLOCK
    extra.push({
      bone: built.groundId,
      channel: 'position',
      keys: [key(0, [0, 0, 0]), key(clip.length, [0, 0, dist])],
    })

    /* And the figure beside it walks too. A reference standing still on
       a floor sliding out from under it is a worse lie than no
       reference at all - so it takes the swing that covers the same
       ground its own legs would: chord = 2r sin(a), solved for a. */
    if (built.player) {
      const swing = (Math.asin(Math.min(0.85, dist / (2 * PLAYER_LEG))) * 180) / Math.PI
      const cycle = (bone: string, amp: number, flip: boolean) =>
        extra.push({
          bone,
          channel: 'rotation',
          keys: [0, 0.25, 0.5, 0.75, 1].map((f, i) =>
            key(clip.length * f, [[0, 1, 0, -1, 0][i] * (flip ? -amp : amp), 0, 0], 'catmullrom'),
          ),
        })
      cycle(built.player.legs[0], swing, false)
      cycle(built.player.legs[1], swing, true)
      cycle(built.player.arms[0], swing * 0.6, true)
      cycle(built.player.arms[1], swing * 0.6, false)
    }
  }

  if (built.placement === 'dropped' || built.placement === 'air') {
    const spins = built.placement === 'dropped' ? Math.max(1, Math.round(length / 2.5)) : 1
    const lift = built.placement === 'dropped' ? 2.2 : 3
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
        key(length * 0.5, [0, lift, 0], 'catmullrom'),
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
