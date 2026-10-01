/* Pip himself: how he stands, where his hand and hat are, and how he is
   drawn. Each scene poses him, then calls drawPip. */

import { stamp, stampTurned } from './pixels'
import type { Pixels, Stamp } from './pixels'
import { ARM, HEAD, HEAD_DAZED, LEG, PICK, TORSO } from './art'
import { GROUND } from './scene'

export const LEG_LEN = 5

/** Angles are forward swings in radians; 0 hangs straight down. */
export type Pose = {
  x: number
  y: number
  vx: number
  vy: number
  stride: number
  legNear: number
  legFar: number
  armNear: number
  armFar: number
  /** the pickaxe in his near hand, at this angle, or null for none */
  pick: number | null
  /** 0 standing to 1 sitting */
  sit: number
  bob: number
  dip: number
  dazed: boolean
  hidden: boolean
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k))
export const easeOut = (k: number) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 3

export function standing(x: number): Pose {
  return {
    x,
    y: GROUND,
    vx: 0,
    vy: 0,
    stride: 0,
    legNear: 0,
    legFar: 0,
    armNear: 0.15,
    armFar: -0.05,
    pick: 1.0,
    sit: 0,
    bob: 0,
    dip: 0,
    dazed: false,
    hidden: false,
  }
}

export function hipY(me: Pose) {
  return Math.round(lerp(me.y - LEG_LEN + me.bob, me.y - 2, me.sit))
}

export function headTop(me: Pose) {
  return hipY(me) - 6 - 10 + me.dip
}

/** Where his near hand is. */
export function hand(me: Pose) {
  const shoulder = hipY(me) - 6 + 1
  return { x: me.x + Math.sin(me.armNear) * 4.5, y: shoulder + Math.cos(me.armNear) * 4.5 }
}

/**
 * Draws Pip with his feet at screen x `sx`. The pickaxe is drawn when
 * the pose has one; `held` draws anything else in his near hand, after
 * his head and before the hand itself, so the hand closes over it.
 */
export function drawPip(
  p: Pixels,
  me: Pose,
  sx: number,
  time: number,
  how: Stamp = {},
  held?: (hx: number, hy: number) => void,
) {
  const hip = hipY(me)
  const torsoTop = hip - 6
  const head = torsoTop - 10 + me.dip
  const far: Stamp = { ...how, a: 0.45 }
  stampTurned(p, LEG, 1.5, 0, sx, hip, -me.legFar, far)
  stampTurned(p, ARM, 1.5, 0.5, sx, torsoTop + 1, -me.armFar, far)
  stampTurned(p, LEG, 1.5, 0, sx, hip, -me.legNear, how)
  stamp(p, TORSO, sx - 3, torsoTop, how)
  const blink = !me.dazed && time % 3.4 < 0.12
  stamp(p, me.dazed ? HEAD_DAZED : HEAD, sx - 5, head, how)
  if (blink) p.dot(sx + 1, head + 5)
  const hx = sx + Math.sin(me.armNear) * 4.5
  const hy = torsoTop + 1 + Math.cos(me.armNear) * 4.5
  if (me.pick !== null) stampTurned(p, PICK, 4.5, 8.5, hx, hy, me.pick, how)
  held?.(hx, hy)
  stampTurned(p, ARM, 1.5, 0.5, sx, torsoTop + 1, -me.armNear, how)
}
