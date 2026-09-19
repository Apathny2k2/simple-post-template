/* ---------------------------------------------------------------
   The scene a model is actually going to live in.

   The Display tab shows a model on a tilted grid with nothing to judge
   it against: no ground, no sky, and above all nothing of a known size.
   A mob that looks right floating in a void is routinely twice the
   height of a player, and you find that out in game.

   So: build a Minecraft-shaped world, drop the model into it beside
   something a known two blocks tall, and play its animation there. The
   world is a `.vellum` model like any other - the same cubes, bones,
   UVs and clips - which means the renderer, the camera and the
   animation system all work on it unchanged.

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
import type { Bone, BoneChild, Clip, Cube, Face, FaceKey, Key, Model, ProjectKind, Texture, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'

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

export type TimeOfDay = 'day' | 'night'

/** Sky light, and the colour the world is tinted toward under it. */
const SKY: Record<TimeOfDay, { light: number; tint: [number, number, number]; tintAmount: number }> = {
  day: { light: 1, tint: [255, 252, 240], tintAmount: 0.04 },
  night: { light: 0.33, tint: [44, 66, 132], tintAmount: 0.34 },
}

/* ---------------- the atlas ---------------- */

type Rect = [number, number, number, number]

type TileKind =
  | 'grass_top' | 'grass_side' | 'dirt' | 'stone' | 'cobble'
  | 'log_side' | 'log_top' | 'leaves' | 'planks' | 'water' | 'sand'
  | 'skin' | 'hair' | 'shirt' | 'sleeve' | 'trouser' | 'boot' | 'face'
  | 'torch' | 'flame' | 'void'

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
    case 'grass_top':
      // flatter than it looks: a handful of darker blades over one green
      return n > 0.88 ? { r: 105, g: 170, b: 78 } : jitter([124, 189, 107], 0.1)
    case 'grass_side': {
      // the green lip is ragged, three to five texels deep
      const lip = 3 + Math.floor(noise(x, 0, 3) * 3)
      if (y < lip) return n > 0.85 ? { r: 105, g: 170, b: 78 } : jitter([124, 189, 107], 0.1)
      return jitter([134, 96, 67], 0.12)
    }
    case 'dirt':
      return n > 0.9 ? { r: 110, g: 78, b: 54 } : jitter([134, 96, 67], 0.12)
    case 'stone':
      return n > 0.88 ? { r: 110, g: 110, b: 110 } : jitter([126, 126, 126], 0.09)
    case 'cobble': {
      // clustered blobs rather than per-texel noise, which is what makes
      // cobble read as stones instead of static
      const bx = Math.floor(x / 4) * 4
      const by = Math.floor(y / 4) * 4
      const blob = noise(bx, by, 17)
      const base: [number, number, number] = blob > 0.66 ? [140, 140, 140] : blob > 0.33 ? [122, 122, 122] : [100, 100, 100]
      const edge = x % 4 === 0 || y % 4 === 0
      return jitter(edge ? [82, 82, 82] : base, 0.1)
    }
    case 'log_side': {
      const bark = noise(x, 0, 7)
      return jitter(bark > 0.72 ? [85, 67, 42] : bark > 0.4 ? [107, 84, 51] : [96, 75, 46], 0.08)
    }
    case 'log_top': {
      const d = Math.hypot(x - 7.5, y - 7.5)
      const ring = Math.sin(d * 2.4) > 0.25
      return jitter(ring ? [126, 100, 64] : [160, 129, 78], 0.07)
    }
    case 'leaves': {
      // real gaps, in clumps: a canopy you cannot see the sky through is
      // a green box, but per-texel holes are confetti
      const clump = noise(Math.floor(x / 2) * 2, Math.floor(y / 2) * 2, 23)
      if (clump > 0.88) return null
      return jitter(n > 0.68 ? [74, 126, 50] : [92, 150, 60], 0.1)
    }
    case 'planks': {
      const grain = y % 8 === 0 || y % 8 === 7
      const join = x % 8 === 3 && y % 8 > 1 && y % 8 < 6
      return jitter(grain || join ? [143, 108, 64] : [184, 140, 85], 0.07)
    }
    case 'water': {
      const wave = Math.sin((x * 0.9 + y * 0.35)) * 0.05
      const k = 0.96 + n * 0.08 + wave
      return { r: 63 * k, g: 118 * k, b: 228 * k, a: 0.78 }
    }
    case 'sand':
      return jitter([219, 211, 160], 0.09)
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
    case 'torch':
      return jitter([124, 96, 58], 0.08)
    case 'flame':
      return { r: 255, g: 214 - n * 60, b: 96 - n * 60 }
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
       atlas grew grass on the fence posts instead of failing visibly. */
    this.region('void', 4, 4, 1, 'day')
  }

  /**
   * `emissive` ignores sky light, for a flame. `fit` scales the 16x16
   * motif onto the region instead of slicing it: a fence post wants a
   * 4-texel slice of the plank pattern, but a player's 8-unit head
   * wants the whole face on it, not the top-left corner of one.
   */
  region(
    kind: TileKind,
    w: number,
    h: number,
    shade: number,
    sky: TimeOfDay,
    emissive = false,
    fit = false,
  ): Rect {
    const width = Math.max(1, Math.round(w))
    const height = Math.max(1, Math.round(h))
    const key = `${kind}:${width}x${height}:${shade.toFixed(2)}:${emissive ? 'e' : sky}:${fit ? 'f' : 's'}`
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
    this.paint(kind, at, shade, sky, emissive, fit)
    return at
  }

  private paint(kind: TileKind, at: Rect, shade: number, sky: TimeOfDay, emissive: boolean, fit: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    const [x0, y0, x1, y1] = at
    const { light, tint, tintAmount } = SKY[sky]
    const k = emissive ? 1 : shade * light
    const mix = emissive ? 0 : tintAmount * (1 - light) * 2.2

    const w = x1 - x0
    const h = y1 - y0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = fit
          ? texel(kind, Math.floor((x * 16) / w), Math.floor((y * 16) / h))
          : texel(kind, x, y)
        if (!t) continue
        const r = t.r * k + (tint[0] - t.r * k) * mix
        const g = t.g * k + (tint[1] - t.g * k) * mix
        const b = t.b * k + (tint[2] - t.b * k) * mix
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${t.a ?? 1})`
        ctx.fillRect(x0 + x, y0 + y, 1, 1)
      }
    }
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
  sky: TimeOfDay,
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
      const kind = skin[key] ?? skin.all ?? 'stone'
      // a void face is transparent at any size, so it claims one texel
      const [fw, fh] = kind === 'void' ? [4, 4] : span[key]
      const uv = atlas.region(kind, fw, fh, FACE_SHADE[key], sky, opts.emissive, opts.fit) as UVRect
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

const GRASS: Skin = { up: 'grass_top', down: 'dirt', all: 'grass_side' }
const STONE: Skin = { all: 'stone' }
const COBBLE: Skin = { all: 'cobble' }
const LOG: Skin = { up: 'log_top', down: 'log_top', all: 'log_side' }
const LEAVES: Skin = { all: 'leaves' }
const PLANKS: Skin = { all: 'planks' }

function terrain(atlas: Atlas, t: string, sky: TimeOfDay): { cubes: Cube[]; bone: Bone } {
  const cubes: Cube[] = []
  const put = (name: string, from: Vec3, to: Vec3, skin: Skin, emissive = false) =>
    cubes.push(block(atlas, t, sky, name, from, to, skin, { emissive }))

  const B = BLOCK

  /* A ground cube shows its top and nothing else. The interior sides of
     a tiled field are vertical planes seen nearly edge-on, and backface
     culling only hides the half of them pointing away - nine slabs drew
     a grid over the plain. The outer sides are past the frame anyway,
     so every one of them is void: one transparent texel, no seam.

     Tiling rather than one huge cube because the sheet is 512 square
     and a face is painted one texel per unit: a 30-block plain as a
     single cube wants a 480 x 480 patch, which is most of the atlas. As
     a grid of identical cubes they all share one region instead. */
  const surface = (top: TileKind): Skin => ({ up: top, all: 'void' })
  const CW = 10 * B // one ground cube, in units
  const CD = 6 * B
  const SHORE = 3 * B // where the grass gives way to the water
  /* Cubes that merely touch leave a hairline of sky between them once
     the browser antialiases the edges. Their sides are void, so half a
     unit of overlap costs nothing and closes it. */
  const LAP = 0.5

  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -2; cz <= 0; cz++) {
      put(
        `plain_${cx}_${cz}`,
        [cx * CW - CW / 2 - LAP, -B, SHORE + cz * CD - CD - LAP],
        [cx * CW + CW / 2 + LAP, 0, SHORE + cz * CD + LAP],
        surface('grass_top'),
      )
    }
  }

  /* The one boundary that is meant to be seen: the bank where the grass
     drops to the water. It is also how the water gets to be lower than
     the land without carving a hole in a cube. */
  put('bank', [-1.5 * CW, -B, SHORE - 4], [1.5 * CW, 0, SHORE], { up: 'grass_top', south: 'grass_side', all: 'void' })

  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = 0; cz <= 1; cz++) {
      const z0 = SHORE + cz * CD
      const x0 = cx * CW - CW / 2 - LAP
      const x1 = cx * CW + CW / 2 + LAP
      put(`shore_${cx}_${cz}`, [x0, -1.8 * B, z0 - LAP], [x1, -0.5 * B, z0 + CD + LAP], surface('sand'))
      put(`water_${cx}_${cz}`, [x0, -0.5 * B, z0 - LAP], [x1, -0.2 * B, z0 + CD + LAP], surface('water'))
    }
  }

  // a two-step rise at the back, so the ground is not one flat plane
  put('rise_1', [-5 * B, 0, -6 * B], [-B, B, -2 * B], GRASS)
  put('rise_2', [-4 * B, B, -6 * B], [-2 * B, 2 * B, -4 * B], GRASS)
  put('cliff', [-4 * B, 0, -6 * B], [-3 * B, B, -5 * B], STONE)
  put('boulder', [-3.5 * B, 2 * B, -5.5 * B], [-2.5 * B, 3 * B, -4.5 * B], COBBLE)

  /* An oak: a 1x1 trunk five blocks up, a 5x5 canopy two blocks deep
     with a 3x3 cap on it, which is the shape Minecraft grows. */
  const tx = -5.5 * B
  const tz = 1.5 * B
  put('trunk', [tx - B / 2, 0, tz - B / 2], [tx + B / 2, 5 * B, tz + B / 2], LOG)
  put('canopy_wide', [tx - 2.5 * B, 3 * B, tz - 2.5 * B], [tx + 2.5 * B, 5 * B, tz + 2.5 * B], LEAVES)
  put('canopy_cap', [tx - 1.5 * B, 5 * B, tz - 1.5 * B], [tx + 1.5 * B, 6 * B, tz + 1.5 * B], LEAVES)

  // a fence behind the stage, for depth
  for (let i = -2; i <= 2; i++) {
    put(`post_${i + 2}`, [i * B - 2, 0, -4 * B - 2], [i * B + 2, 22, -4 * B + 2], PLANKS)
  }
  put('rail_low', [-2 * B - 2, 8, -4 * B - 1], [2 * B + 2, 11, -4 * B + 1], PLANKS)
  put('rail_high', [-2 * B - 2, 16, -4 * B - 1], [2 * B + 2, 19, -4 * B + 1], PLANKS)

  /* A torch. At night its flame is painted emissive - it ignores sky
     light - which is the one thing in the terrain that stays bright, so
     it reads as the light source rather than as a yellow block. */
  const lx = 2.6 * B
  put('torch_post', [lx - 2, 0, -1.4 * B - 2], [lx + 2, 9, -1.4 * B + 2], { all: 'torch' })
  put('torch_flame', [lx - 2, 9, -1.4 * B - 2], [lx + 2, 12, -1.4 * B + 2], { all: 'flame' }, true)

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

/* ---------------- the player ---------------- */

/**
 * Two blocks tall, which is the whole point of it: a mob is either
 * about the height of the thing standing next to it or it is not, and
 * that is not a judgement anybody makes reliably against a void.
 *
 * `facing` is worked out rather than passed: rotateY maps the local -z
 * axis to (-sin, 0, -cos), so the yaw that points a figure at the
 * origin from (x, z) is atan2(x, z).
 */
function playerParts(
  atlas: Atlas,
  t: string,
  sky: TimeOfDay,
  at: Vec3,
): { cubes: Cube[]; bone: Bone } {
  const [x, y, z] = at
  /* Facing is worked out rather than eyeballed, then eased 26 degrees
     back toward the default camera: a figure turned squarely at the
     model shows the viewer the back of its head, and a head with no
     face on it is a brown box. */
  const facing = (Math.atan2(x, z) * 180) / Math.PI - 26
  const put = (name: string, from: Vec3, to: Vec3, skin: Skin) =>
    block(atlas, t, sky, name, from, to, skin, { fit: true })

  const cubes = [
    put('player_head', [x - 4, y + 24, z - 4], [x + 4, y + 32, z + 4], {
      up: 'hair',
      north: 'face',
      all: 'skin',
    }),
    put('player_body', [x - 4, y + 12, z - 2], [x + 4, y + 24, z + 2], { all: 'shirt' }),
    put('player_arm_left', [x - 8, y + 12, z - 2], [x - 4, y + 24, z + 2], { down: 'skin', all: 'sleeve' }),
    put('player_arm_right', [x + 4, y + 12, z - 2], [x + 8, y + 24, z + 2], { down: 'skin', all: 'sleeve' }),
    put('player_leg_left', [x - 4, y, z - 2], [x, y + 12, z + 2], { down: 'boot', all: 'trouser' }),
    put('player_leg_right', [x, y, z - 2], [x + 4, y + 12, z + 2], { down: 'boot', all: 'trouser' }),
  ]

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
  /** night darkens the world, not the model - which is the point of it */
  sky?: TimeOfDay
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
  /* Normalised once, here, rather than trusted all the way down: this
     is called from JavaScript as well as from TypeScript, and an
     unrecognised sky used to reach the painter and throw on a lookup
     that had no entry for it. Anything that is not night is day. */
  const sky: TimeOfDay = opts.sky === 'night' ? 'night' : 'day'
  const atlas = new Atlas(512)
  const id = newId()
  const ground = terrain(atlas, id, sky)
  const player = opts.withPlayer ? playerParts(atlas, id, sky, [34, 0, 4]) : null
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
export function sceneClip(built: BuiltWorld, clip: Clip | null): Clip | null {
  const extra: Track[] = []
  const base = clip?.length ?? 3
  const length = clip ? (clip.loop === 'once' ? clip.length * 1.4 : clip.length) : 3

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
