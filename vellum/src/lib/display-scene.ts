/* Display mode's previews: an item model in a player's hand, on a head, in
   first person, in an inventory slot, on the ground or in an item frame,
   placed by the steps Java Edition takes to draw it there.

   Each placement is a matrix from the item model's own pixels (0 to 16, as
   in its JSON) to the preview's world pixels (Y up, the ground at 0). It
   ends, as the game does, with the slot's display transform: move, turn
   X then Y then Z, scale, about the middle of the 16-pixel block. The
   numbers before that (the hand's offset, the head's scale, the frame's
   depth) are Java's as recalled from its renderers and are still to be
   checked in game; `README.md` under Display lists them.

   The player is Steve's shape at Steve's size, its parts in flat colours:
   a ruler to judge the item by. */

import { rotationMatrix } from './kinematics'
import type { Bone, Cube, FaceKey, Model, Texture, Vec3 } from './model'
import { FACES } from './model'
import type { SlotId, SlotTransform } from '../pages/editor/DisplayPanel'

export type DisplayScene = {
  /** item model pixels to world pixels */
  place: DOMMatrix
  /** drawn with the item and never picked: the player, a slot, a frame */
  companions: Model[]
  /** where the view looks, and how much of the world it frames (pixels) */
  focus: Vec3
  size: number
  yaw: number
  pitch: number
  ortho?: boolean
  /** first person looks from the eye at the origin, with Java's field of view */
  eye?: { fov: number }
}

const deg = (r: Vec3) => rotationMatrix(r)
const T = (x: number, y: number, z: number) => new DOMMatrix().translate(x, y, z)
const S = (x: number, y = x, z = x) => new DOMMatrix().scale(x, y, z)

/** The slot's display transform, as Java's ItemTransform applies it (a left hand mirrors it). */
function itemTransform(t: SlotTransform, left: boolean): DOMMatrix {
  const [tx, ty, tz] = t.translation.map((v) => Math.max(-80, Math.min(80, v)) / 16)
  const [rx, ry, rz] = t.rotation
  const s = t.scale.map((v) => Math.max(-4, Math.min(4, v)))
  return T(left ? -tx : tx, ty, tz)
    .multiply(deg([rx, left ? -ry : ry, left ? -rz : rz]))
    .multiply(S(s[0], s[1], s[2]))
}

/** The item model's pixels into a block, centred, as the game draws an item: (p / 16) - 0.5. */
const intoBlock = () => T(-0.5, -0.5, -0.5).multiply(S(1 / 16))

/** From the entity's model space (pixels, Y down, facing -Z) to blocks in the world: Java's flip and lift. */
const entity = () => deg([0, 180, 0]).multiply(S(-1, -1, 1)).multiply(T(0, -1.501, 0))

/* ---------------- the props ---------------- */

const SKIN = '#c69680'
const SHIRT = '#3fa7a4'
const PANTS = '#3b3f9e'
const HAIR = '#4a3222'
const WOOD = '#8a5a2b'
const BOARD = '#b98a52'
const SLOT_DARK = '#373737'
const SLOT_LIGHT = '#8b8b8b'

/** A strip texture of flat colours, one texel each, and the UV of each colour's texel. */
function swatches(colours: string[]): { texture: Texture; uv: (i: number) => [number, number, number, number] } {
  const c = document.createElement('canvas')
  c.width = colours.length
  c.height = 1
  const x = c.getContext('2d')!
  colours.forEach((col, i) => {
    x.fillStyle = col
    x.fillRect(i, 0, 1, 1)
  })
  return {
    texture: { id: 'swatches', name: 'swatches.png', width: colours.length, height: 1, uvWidth: colours.length, uvHeight: 1, source: c.toDataURL('image/png') },
    uv: (i) => [i + 0.25, 0.25, i + 0.75, 0.75],
  }
}

let cubeN = 0
function box(name: string, from: Vec3, to: Vec3, uv: [number, number, number, number], origin: Vec3 = [0, 0, 0]): Cube {
  return {
    id: `prop-${name}-${++cubeN}`,
    name,
    from: [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.min(from[2], to[2])],
    to: [Math.max(from[0], to[0]), Math.max(from[1], to[1]), Math.max(from[2], to[2])],
    origin,
    rotation: [0, 0, 0],
    faces: Object.fromEntries(FACES.map((k) => [k, { uv, texture: 'swatches' }])) as Record<FaceKey, Cube['faces'][FaceKey]>,
    inflate: 0,
    boxUv: false,
    visible: true,
    locked: false,
  }
}

function propModel(name: string, bones: Bone[], cubes: Cube[], texture: Texture): Model {
  return { name, kind: 'items', resolution: { width: texture.width, height: texture.height }, bones, cubes, textures: [texture], clips: [] }
}

const bone = (id: string, origin: Vec3, rotation: Vec3, cubes: Cube[]): Bone => ({
  id,
  name: id,
  origin,
  rotation,
  visible: true,
  locked: false,
  children: cubes.map((c) => ({ kind: 'cube' as const, id: c.id })),
})

/** Steve's shape, standing on the ground facing +Z, the holding arm raised as the game raises it. */
function player(holding: 'right' | 'left' | null): Model {
  const sw = swatches([SKIN, SHIRT, PANTS, HAIR])
  const [skin, shirt, pants, hair] = [0, 1, 2, 3].map(sw.uv)
  // model space to world pixels: x stays, y = 24 - y, z = -z
  const head = [box('head', [-4, 24, -4], [4, 32, 4], skin), box('hair', [-4.2, 30, -4.2], [4.2, 32.2, 4.2], hair)]
  const body = [box('body', [-4, 12, -2], [4, 24, 2], shirt)]
  const rArm = [box('right_arm', [-8, 12, -2], [-4, 24, 2], skin)]
  const lArm = [box('left_arm', [4, 12, -2], [8, 24, 2], skin)]
  const rLeg = [box('right_leg', [-3.9, 0, -2], [0.1, 12, 2], pants)]
  const lLeg = [box('left_leg', [-0.1, 0, -2], [3.9, 12, 2], pants)]
  // a held item raises the arm by a tenth of a half turn (HumanoidModel's ITEM pose)
  const lift = -18
  const bones = [
    bone('head', [0, 24, 0], [0, 0, 0], head),
    bone('body', [0, 24, 0], [0, 0, 0], body),
    bone('right_arm', [-5, 22, 0], [holding === 'right' ? lift : 0, 0, 0], rArm),
    bone('left_arm', [5, 22, 0], [holding === 'left' ? lift : 0, 0, 0], lArm),
    bone('right_leg', [-1.9, 12, 0], [0, 0, 0], rLeg),
    bone('left_leg', [1.9, 12, 0], [0, 0, 0], lLeg),
  ]
  return propModel('player', bones, [...head, ...body, ...rArm, ...lArm, ...rLeg, ...lLeg], sw.texture)
}

/** An item frame on a wall, facing +Z, its board's middle at the origin. */
function itemFrame(): Model {
  const sw = swatches([WOOD, BOARD])
  const [wood, board] = [0, 1].map(sw.uv)
  // the block model's pixels, turned to face +Z and centred: x = 8 - x, y = y - 8, z = 8 - z
  const at = (p: Vec3): Vec3 => [8 - p[0], p[1] - 8, 8 - p[2]]
  const b = (name: string, from: Vec3, to: Vec3, uv: [number, number, number, number]) => box(name, at(from), at(to), uv)
  const cubes = [
    b('board', [3, 3, 15.5], [13, 13, 16], board),
    b('rim_bottom', [2, 2, 15], [14, 3, 16], wood),
    b('rim_top', [2, 13, 15], [14, 14, 16], wood),
    b('rim_left', [2, 3, 15], [3, 13, 16], wood),
    b('rim_right', [13, 3, 15], [14, 13, 16], wood),
  ]
  return propModel('item frame', [bone('frame', [0, 0, 0], [0, 0, 0], cubes)], cubes, sw.texture)
}

/** An inventory slot, 18 pixels across with its bevel, behind the item. */
function slot(): Model {
  const sw = swatches([SLOT_DARK, SLOT_LIGHT])
  const [dark, light] = [0, 1].map(sw.uv)
  const cubes = [box('slot', [-9, -9, -9], [9, 9, -8.5], light), box('slot_well', [-8, -8, -8.6], [8, 8, -8.4], dark)]
  return propModel('slot', [bone('slot', [0, 0, 0], [0, 0, 0], cubes)], cubes, sw.texture)
}

/* ---------------- the placements ---------------- */

/** Where the item goes for a display slot, what is drawn with it, and how the view looks at it. */
export function displayScene(slotId: SlotId, t: SlotTransform): DisplayScene {
  const px = S(16)
  switch (slotId) {
    case 'thirdperson_righthand':
    case 'thirdperson_lefthand': {
      const left = slotId === 'thirdperson_lefthand'
      const side = left ? -1 : 1
      // ItemInHandLayer: to the arm's pivot, the arm's lift, then the hand
      const place = px
        .multiply(entity())
        .multiply(T((left ? 5 : -5) / 16, 2 / 16, 0))
        .multiply(deg([-18, 0, 0]))
        .multiply(deg([-90, 0, 0]))
        .multiply(deg([0, 180, 0]))
        .multiply(T(side / 16, 0.125, -0.625))
        .multiply(itemTransform(t, left))
        .multiply(intoBlock())
      return { place, companions: [player(left ? 'left' : 'right')], focus: [left ? 6 : -6, 16, 4], size: 40, yaw: left ? 35 : -35, pitch: -12 }
    }
    case 'firstperson_righthand':
    case 'firstperson_lefthand': {
      const left = slotId === 'firstperson_lefthand'
      // ItemInHandRenderer: in front of the eye, low and to the side
      const place = px
        .multiply(T((left ? -1 : 1) * 0.56, -0.52, -0.72))
        .multiply(itemTransform(t, left))
        .multiply(intoBlock())
      // the view turns from the eye to the hand, as a glance down at it
      const at = place.transformPoint(new DOMPoint(8, 8, 8))
      const len = Math.hypot(at.x, at.y, at.z) || 1
      const pitch = (Math.asin(at.y / len) * 180) / Math.PI
      const yaw = (Math.atan2(at.x, -at.z) * 180) / Math.PI
      return { place, companions: [], focus: [0, 0, 0], size: 16, yaw, pitch, eye: { fov: 70 } }
    }
    case 'head': {
      // CustomHeadLayer: on the head, turned round, at five eighths
      const place = px
        .multiply(entity())
        .multiply(T(0, -0.25, 0))
        .multiply(deg([0, 180, 0]))
        .multiply(S(0.625, -0.625, -0.625))
        .multiply(itemTransform(t, false))
        .multiply(intoBlock())
      return { place, companions: [player(null)], focus: [0, 26, 0], size: 30, yaw: -35, pitch: -15 }
    }
    case 'gui': {
      // a slot is 16 pixels; the item fills it at scale 1
      const place = px.multiply(itemTransform(t, false)).multiply(intoBlock())
      return { place, companions: [slot()], focus: [0, 0, 0], size: 22, yaw: 0, pitch: 0, ortho: true }
    }
    case 'ground': {
      // ItemEntityRenderer: lifted by its bob and a quarter of its own height
      const place = px.multiply(T(0, 0.1 + 0.25 * t.scale[1], 0)).multiply(itemTransform(t, false)).multiply(intoBlock())
      return { place, companions: [], focus: [0, 4, 0], size: 22, yaw: -30, pitch: -25 }
    }
    case 'fixed': {
      // ItemFrameRenderer: out from the board, at half size
      const place = px.multiply(deg([0, 180, 0])).multiply(T(0, 0, 0.4375)).multiply(S(0.5)).multiply(itemTransform(t, false)).multiply(intoBlock())
      return { place, companions: [itemFrame()], focus: [0, 0, 0], size: 22, yaw: -25, pitch: -10 }
    }
  }
}
