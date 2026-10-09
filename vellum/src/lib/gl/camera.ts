/* The viewport's camera. It reproduces, as one matrix, the projection the
   CSS viewport used: a stage turned by pitch and yaw about the middle of the
   box, scaled by the zoom factor, moved by the pan, and seen through a
   900px perspective from 46% of the way down the box. Model space is Y up
   and screen space Y down, so model units go to pixels as (x, -y, z) times
   the scale. Keeping the same maths keeps the gizmo, the vertex dots and
   every saved view where they were. */

import { rotationMatrix } from '../kinematics'
import type { Vec3 } from '../model'

/** Perspective distance in pixels, and the height of the eye as a share of the box. */
export const PERSPECTIVE = 900
export const EYE_HEIGHT = 0.46
/** Depth range in pixels either side of the stage that fits in the depth buffer. */
const DEPTH_RANGE = 100000

export type CameraState = {
  width: number
  height: number
  /** pixels per model unit */
  scale: number
  yaw: number
  pitch: number
  /** the zoom factor */
  factor: number
  pan: { x: number; y: number }
  /** the stage pushed along screen z, in pixels */
  zoom: number
  /** the model point at the middle of the stage */
  anchor: Vec3
  /** a display-slot transform applied to the whole model */
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
  /** a general placement of the model, used instead of `display` (Display mode's previews) */
  place?: DOMMatrix | null
  ortho: boolean
  /** a vertical field of view in degrees for a 16:9 window, from an eye at the middle of the box, instead of the 900px perspective */
  fov?: number
  /** where the eye is down the box, 0 to 1; 0.46 unless set */
  eyeHeight?: number
}

export type Camera = {
  state: CameraState
  /** model space to clip space, column-major, for WebGL */
  clip: Float32Array
  /** the same without the display transform, for the grid, which stays put under a display slot */
  stageClip: Float32Array
  /** a model point on screen: pixels from the box's top left, its depth (larger is nearer) and w (above 0 when in front) */
  project: (p: Vec3) => { x: number; y: number; z: number; w: number }
}

/** Model space to the stage's own pixels, before perspective: x right, y down, z toward the viewer, from the box's top left. */
function stageMatrix(s: CameraState, withDisplay = true): DOMMatrix {
  const f = s.factor
  const stage = new DOMMatrix()
    .translate(s.width / 2 + s.pan.x, s.height / 2 + s.pan.y, s.zoom)
    .rotateAxisAngle(1, 0, 0, s.pitch)
    .rotateAxisAngle(0, 1, 0, s.yaw)
    .scale(f, f, f)
  const toCss = new DOMMatrix().scale(s.scale, -s.scale, s.scale)
  let m = stage.multiply(toCss).translate(-s.anchor[0], -s.anchor[1], -s.anchor[2])
  if (withDisplay && s.place) return m.multiply(s.place)
  const d = withDisplay ? s.display : null
  if (d) {
    m = m
      .translate(d.translation[0], d.translation[1], d.translation[2])
      .multiply(rotationMatrix(d.rotation))
      .scale(d.scale[0], d.scale[1], d.scale[2])
  }
  return m
}

/** Perspective about the eye point, as CSS `perspective` with `perspective-origin` does. */
function perspectiveMatrix(s: CameraState): DOMMatrix {
  if (s.ortho) return new DOMMatrix()
  const ox = s.width / 2
  const oy = s.height * (s.fov ? 0.5 : (s.eyeHeight ?? EYE_HEIGHT))
  const p = new DOMMatrix()
  p.m34 = -1 / perspectiveOf(s)
  return new DOMMatrix().translate(ox, oy, 0).multiply(p).translate(-ox, -oy, 0)
}

/**
 * The perspective distance in pixels: 900, or, with a field of view, the
 * distance at which the box's width spans what a 16:9 game window shows
 * across at that (vertical) field of view, so first person frames the
 * hand as the game does whatever the box's shape.
 */
export function perspectiveOf(s: Pick<CameraState, 'fov' | 'width'>): number {
  return s.fov ? s.width / 2 / (Math.tan((s.fov * Math.PI) / 360) * (16 / 9)) : PERSPECTIVE
}

export function makeCamera(s: CameraState): Camera {
  const screen = perspectiveMatrix(s).multiply(stageMatrix(s))
  // pixels to clip space: x to -1..1, y flipped, depth nearer-smaller
  const ndc = new DOMMatrix([2 / s.width, 0, 0, 0, 0, -2 / s.height, 0, 0, 0, 0, -1 / DEPTH_RANGE, 0, -1, 1, 0, 1])
  const clip = ndc.multiply(screen).toFloat32Array()
  const stageClip = ndc.multiply(perspectiveMatrix(s)).multiply(stageMatrix(s, false)).toFloat32Array()
  const project = (p: Vec3) => {
    const q = screen.transformPoint(new DOMPoint(p[0], p[1], p[2], 1))
    const w = q.w
    return { x: q.x / w, y: q.y / w, z: q.z, w }
  }
  return { state: s, clip, stageClip, project }
}

/**
 * Where a point of the turned stage lands on screen, in pixels from the
 * box's top left. `p` is in the stage's own pixels from its middle, before
 * the zoom factor; the zoom keeps the cursor still by measuring a square
 * here before and after.
 */
export function stagePoint(s: CameraState, p: Vec3): { x: number; y: number } {
  const f = s.factor
  const m = perspectiveMatrix(s).multiply(
    new DOMMatrix()
      .translate(s.width / 2 + s.pan.x, s.height / 2 + s.pan.y, s.zoom)
      .rotateAxisAngle(1, 0, 0, s.pitch)
      .rotateAxisAngle(0, 1, 0, s.yaw)
      .scale(f, f, f),
  )
  const q = m.transformPoint(new DOMPoint(p[0], p[1], p[2], 1))
  return { x: q.x / q.w, y: q.y / q.w }
}
