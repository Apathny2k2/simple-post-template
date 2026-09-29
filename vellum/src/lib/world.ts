/* The stage for "View in the real world": a black stage, a floor that
   moves under a walking model, and a figure two blocks tall for scale.
   It is an ordinary .vellum model, so the renderer, camera and animation
   code work on it unchanged. Faces are one texel per unit, with
   Minecraft's face shading baked into the texture. */

import { FACES } from './model'
import type { Bone, BoneChild, Clip, Cube, Face, FaceKey, Key, Model, ProjectKind, Subtype, Texture, Track, UVRect, Vec3 } from './model'
import { newId } from './new-model'
import { readRig } from './auto-rig'

export const BLOCK = 16

/** Minecraft's fixed shading for each face direction. */
const FACE_SHADE: Record<FaceKey, number> = {
  up: 1,
  down: 0.5,
  north: 0.8,
  south: 0.8,
  east: 0.6,
  west: 0.6,
}


/* ---------------- the atlas ---------------- */

type Rect = [number, number, number, number]

type TileKind =
  | 'floor'
  | 'skin' | 'hair' | 'shirt' | 'sleeve' | 'trouser' | 'boot' | 'face'
  | 'void'

/** Deterministic, so the world paints the same every time. */
function noise(x: number, y: number, salt: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

type Paint = { r: number; g: number; b: number; a?: number }

/**
 * One texel of a tile. Coordinates wrap every 16, so a face can start
 * anywhere in the pattern and still line up with its neighbours.
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
      /* Near-black, with a dim line on each block boundary so the moving
         floor shows motion and marks out blocks. */
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
      // the bottom quarter is the hand; the sleeve is a lighter blue than
      // the shirt so the arms stand out from the body
      return y > 11 ? jitter([199, 140, 98], 0.06) : jitter([74, 124, 182], 0.06)
    case 'trouser':
      return jitter([42, 49, 87], 0.07)
    case 'boot':
      return jitter([46, 43, 41], 0.08)
    case 'face': {
      // eyes and a mouth, to show which way the figure faces
      if (y >= 6 && y <= 7 && (x === 3 || x === 4 || x === 11 || x === 12))
        return x === 3 || x === 11 ? { r: 240, g: 240, b: 245 } : { r: 40, g: 52, b: 92 }
      if (y === 10 && x >= 6 && x <= 9) return { r: 138, g: 90, b: 72 }
      if (y < 3) return jitter([58, 42, 29], 0.1)
      return jitter([199, 140, 98], 0.06)
    }
    case 'void':
      // transparent, for faces that are never seen
      return null
    default:
      return null
  }
}

/**
 * Shelf-packs one region per (tile, size, shade, emissive, fit) and paints
 * it on first request, so identical faces share a region.
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
    /* Claimed first: a request that overflows the sheet gets the first
       region back, and this one is transparent. */
    this.region('void', 4, 4, 1)
  }

  /**
   * `emissive` skips the face shading. `fit` stretches the 16x16 motif over
   * the region; otherwise the pattern repeats across it.
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

    /* A texel of clearance after each region, so filtering at a face's
       edge does not pick up its neighbour. */
    const pad = 1
    if (this.x + width + pad > this.size) {
      this.x = 0
      this.y += this.shelf
      this.shelf = 0
    }
    // out of sheet: return the first region, the transparent one
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
    const k = emissive ? 1 : shade

    /* ImageData: the field alone is 960 x 640 texels, too many for a fillRect each. */
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
      shaded: true,
    }
  }
}

/* ---------------- blocks ---------------- */

type Skin = Partial<Record<FaceKey, TileKind>> & { all?: TileKind }

/** A locked cube whose faces get atlas regions one texel per unit, shaded by direction. */
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
      // a void face is transparent at any size, so it gets a small fixed region
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
 * The floor, as one cube. A grid of cubes shows seams: antialiasing gaps
 * where they meet, or z-fighting where they overlap.
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
 * A figure two blocks tall for scale, jointed so it can walk with the
 * floor. Its face is on local -z, which rotateY maps to (-sin, 0, -cos),
 * so atan2(x, z) is the yaw that faces the origin from (x, z).
 */
function playerParts(
  atlas: Atlas,
  t: string,
  at: Vec3,
): { cubes: Cube[]; bone: Bone; rig: PlayerRig } {
  const [x, y, z] = at
  /* Faces the model, turned 26 degrees toward -z, the way the moving floor
     carries a walk. Turned toward the camera, it would walk backwards. */
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

/** Hip-to-foot length of the figure's legs. */
const PLAYER_LEG = 12

export type Travel = {
  /** stride from the legs' swing, in units per cycle */
  asked: number
  /** `asked` rounded to whole blocks, since the floor pattern repeats every block */
  blocks: number
  /** units per second, after rounding */
  speed: number
}

export const NO_TRAVEL: Travel = { asked: 0, blocks: 0, speed: 0 }

/** How far a looping clip travels per cycle, from its legs' swing. */
export function travelOf(subject: Model, clip: Clip | null): Travel {
  if (!clip || clip.loop !== 'loop' || clip.length <= 0) return NO_TRAVEL
  const rig = readRig(subject)
  if (!rig.byRole.leg.length) return NO_TRAVEL

  let asked = 0
  for (const leg of rig.byRole.leg) {
    const track = clip.tracks.find((t) => t.bone === leg.id && t.channel === 'rotation')
    if (!track || track.keys.length < 2) continue
    const swing = Math.max(...track.keys.map((k) => Math.abs(k.value[0])))
    // a leg of length r swinging a degrees either way covers a chord of 2r sin(a)
    asked = Math.max(asked, 2 * leg.reach * Math.sin((swing * Math.PI) / 180))
  }

  // small sways, such as an idle's breathing, don't count as walking
  if (asked < 3) return NO_TRAVEL

  /* The floor pattern repeats every block, so the stride is rounded to
     whole blocks to loop without a jump. `speed` uses the rounded stride. */
  const blocks = Math.max(1, Math.round(asked / BLOCK))
  return { asked, blocks, speed: (blocks * BLOCK) / clip.length }
}

/* ---------------- placing the subject ---------------- */

export type Placement = 'ground' | 'air' | 'dropped'

const TOOLS = /sword|blade|axe|pick|shovel|spade|hoe|knife|dagger|spear|lance|bow|staff|wand|hammer|mace|scythe|fang|cleaver|sickle|glaive/i

/** Starting placement: ground for mobs and blocks; dropped for tools, weapons and consumables; else air. */
export function defaultPlacement(kind: ProjectKind, name: string, subtype?: Subtype): Placement {
  if (kind === 'mobs' || kind === 'blocks') return 'ground'
  /* A subtype the project set wins over the name guess below. */
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
  /** a player figure beside the model, for scale */
  withPlayer: boolean
}

export type BuiltWorld = {
  model: Model
  /** the bone the subject hangs from, so the scene can pose it */
  subjectId: string
  /** the floor's bone, moved when the model walks */
  groundId: string
  /** the reference figure's joints, so it can walk at the same speed */
  player: PlayerRig | null
  /** how tall the model is, in blocks, for the caption */
  blocks: number
  /** the middle of the subject, for the camera to look at */
  focus: Vec3
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

  /* Dropped items shrink and sit just off the ground, as in Minecraft.
     Floating items are scaled to a size that reads at this distance. */
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

/** The model's clip plus the scene's tracks: moving floor, walking figure, or spin and bob. */
export function sceneClip(built: BuiltWorld, clip: Clip | null, travel: Travel = NO_TRAVEL): Clip | null {
  const extra: Track[] = []
  const base = clip?.length ?? 3
  // a once clip gets a pause of 40% of its length, so repeats read as separate swings
  const length = clip ? (clip.loop === 'once' ? clip.length * 1.4 : clip.length) : 3

  /* The model stays put and the floor moves under it, so the walk loops
     in frame. Moving whole blocks per cycle hides the wrap. */
  if (built.placement === 'ground' && travel.speed > 0 && clip) {
    const dist = travel.blocks * BLOCK
    extra.push({
      bone: built.groundId,
      channel: 'position',
      keys: [key(0, [0, 0, 0]), key(clip.length, [0, 0, dist])],
    })

    /* The figure walks too, with the leg swing that covers the same
       distance: chord = 2r sin(a) solved for a, capped. */
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
