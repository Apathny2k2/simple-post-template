import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FACES, samplePose, textureById } from '../lib/model'
import type { Bone, Clip, Cube, Face as ModelFace, FaceKey, Model, Pose, Vec3 } from '../lib/model'
import './Model3D.css'
import './ModelView.css'

/* Faces, in the order a CSS box needs them: each is the plane's own size plus
   the transform that swings it onto the right side of the box. */
const FACE_PLACEMENT: Record<
  FaceKey,
  (w: number, h: number, d: number) => { w: number; h: number; transform: string }
> = {
  south: (w, h, d) => ({ w, h, transform: `translateZ(${d / 2}px)` }),
  north: (w, h, d) => ({ w, h, transform: `rotateY(180deg) translateZ(${d / 2}px)` }),
  east: (w, h, d) => ({ w: d, h, transform: `rotateY(90deg) translateZ(${w / 2}px)` }),
  west: (w, h, d) => ({ w: d, h, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }),
  up: (w, h, d) => ({ w, h: d, transform: `rotateX(90deg) translateZ(${h / 2}px)` }),
  down: (w, h, d) => ({ w, h: d, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }),
}

const ZOOM_MIN = 0.3
const ZOOM_MAX = 7

/**
 * Model space is Y-up and right-handed; CSS is Y-down. Mapping (x,y,z) to
 * (x,-y,z) flips the sense of rotation about X and Z but leaves Y alone,
 * which is where the sign flips below come from.
 */
function transformOf(translate: Vec3, rotation: Vec3, scale: number, scl: Vec3 = [1, 1, 1]) {
  const [x, y, z] = translate
  const [rx, ry, rz] = rotation
  const t = `translate3d(${x * scale}px, ${-y * scale}px, ${z * scale}px)`
  const r = `rotateX(${-rx}deg) rotateY(${ry}deg) rotateZ(${-rz}deg)`
  const s = scl[0] === 1 && scl[1] === 1 && scl[2] === 1 ? '' : ` scale3d(${scl[0]}, ${scl[1]}, ${scl[2]})`
  return `${t} ${r}${s}`
}

function Face({
  face,
  name,
  w,
  h,
  transform,
  model,
  scale,
  onPaint,
}: {
  face: ModelFace
  name: FaceKey
  w: number
  h: number
  transform: string
  model: Model
  scale: number
  /** u,v are 0..1 from the face's top-left; the caller back-projects to a texel */
  onPaint?: (face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
}) {
  const px = { w: w * scale, h: h * scale }
  const texture = textureById(model, face.texture)

  const style: React.CSSProperties = {
    width: px.w,
    height: px.h,
    marginLeft: -px.w / 2,
    marginTop: -px.h / 2,
    transform,
  }

  if (texture && texture.source) {
    const [x1, y1, x2, y2] = face.uv
    const uw = Math.abs(x2 - x1) || 1
    const uh = Math.abs(y2 - y1) || 1
    // Scale the sheet so the UV rectangle covers this face exactly, then slide
    // it so the rectangle's corner lands on the face's corner. The sheet is
    // measured in UV space, which is not always the PNG's pixel size.
    const sx = px.w / uw
    const sy = px.h / uh
    style.backgroundImage = `url(${texture.source})`
    style.backgroundSize = `${texture.uvWidth * sx}px ${texture.uvHeight * sy}px`
    style.backgroundPosition = `${-Math.min(x1, x2) * sx}px ${-Math.min(y1, y2) * sy}px`
    style.imageRendering = 'pixelated'
    // A reversed UV coordinate is how a face is mirrored. Normalising the
    // rectangle to min/max would silently throw that away, so the flip is
    // re-applied to the plane instead.
    const flipX = x2 < x1
    const flipY = y2 < y1
    if (flipX || flipY) {
      style.transform = `${transform} scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
    }
  } else {
    style.background = 'rgba(146, 165, 202, 0.25)'
  }

  /* offsetX/offsetY are already in the element's own coordinate system -
     the browser inverse-transforms the hit point for us - so a click on a
     rotated face in the viewport gives face-local pixels directly. */
  const report = (e: React.PointerEvent<HTMLDivElement>, phase: 'down' | 'move') => {
    if (!onPaint) return
    const u = e.nativeEvent.offsetX / px.w
    const v = e.nativeEvent.offsetY / px.h
    if (u < 0 || v < 0 || u > 1 || v > 1) return
    onPaint(name, u, v, phase)
  }

  return (
    <div
      className="bbface"
      data-face={name}
      style={style}
      onPointerDown={
        onPaint
          ? (e) => {
              /* Left button paints and keeps the event to itself; any other
                 button is left to bubble so the scene can orbit, which is
                 what makes painting and looking around coexist. */
              if (e.button !== 0) return
              e.stopPropagation()
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              report(e, 'down')
            }
          : undefined
      }
      onPointerMove={onPaint ? (e) => e.buttons === 1 && report(e, 'move') : undefined}
    />
  )
}

function CubeBox({
  cube,
  parentOrigin,
  model,
  scale,
  selected,
  onSelect,
  onPaint,
}: {
  cube: Cube
  parentOrigin: Vec3
  model: Model
  scale: number
  selected: boolean
  onSelect?: (id: string) => void
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
}) {
  if (!cube.visible) return null

  // the format does not guarantee to > from; a reversed box would render
  // inside-out, so it is clamped here and flagged by the validator instead
  const inf = cube.inflate || 0
  const w = Math.max(cube.to[0] - cube.from[0], 0) + inf * 2
  const h = Math.max(cube.to[1] - cube.from[1], 0) + inf * 2
  const d = Math.max(cube.to[2] - cube.from[2], 0) + inf * 2
  const centre: Vec3 = [
    (cube.from[0] + cube.to[0]) / 2,
    (cube.from[1] + cube.to[1]) / 2,
    (cube.from[2] + cube.to[2]) / 2,
  ]

  // the pivot sits at the cube's origin; the box hangs off it
  const pivotAt: Vec3 = [
    cube.origin[0] - parentOrigin[0],
    cube.origin[1] - parentOrigin[1],
    cube.origin[2] - parentOrigin[2],
  ]
  const boxAt: Vec3 = [
    centre[0] - cube.origin[0],
    centre[1] - cube.origin[1],
    centre[2] - cube.origin[2],
  ]

  return (
    <div className="bbpivot" style={{ transform: transformOf(pivotAt, cube.rotation, scale) }}>
      <div
        className={`bbbox${selected ? ' bbbox--selected' : ''}`}
        style={{ transform: transformOf(boxAt, [0, 0, 0], scale) }}
        onPointerDown={onSelect ? (e) => e.button === 0 && onSelect(cube.id) : undefined}
      >
        {FACES.map((name) => {
          const place = FACE_PLACEMENT[name](w * scale, h * scale, d * scale)
          return (
            <Face
              key={name}
              name={name}
              face={cube.faces[name]}
              w={place.w / scale}
              h={place.h / scale}
              transform={place.transform}
              model={model}
              scale={scale}
              onPaint={onPaint ? (face, u, v, phase) => onPaint(cube.id, face, u, v, phase) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}

function BoneNode({
  bone,
  parentOrigin,
  model,
  scale,
  pose,
  selected,
  onSelect,
  onPaint,
}: {
  bone: Bone
  parentOrigin: Vec3
  model: Model
  scale: number
  pose: Pose
  selected: string | null
  onSelect?: (id: string) => void
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
}) {
  if (!bone.visible) return null

  const animated = pose[bone.id]
  const at: Vec3 = [
    bone.origin[0] - parentOrigin[0] + (animated?.position[0] ?? 0),
    bone.origin[1] - parentOrigin[1] + (animated?.position[1] ?? 0),
    bone.origin[2] - parentOrigin[2] + (animated?.position[2] ?? 0),
  ]
  const rot: Vec3 = [
    bone.rotation[0] + (animated?.rotation[0] ?? 0),
    bone.rotation[1] + (animated?.rotation[1] ?? 0),
    bone.rotation[2] + (animated?.rotation[2] ?? 0),
  ]

  return (
    <div
      className="bbgroup"
      data-bone={bone.name}
      style={{ transform: transformOf(at, rot, scale, animated?.scale ?? [1, 1, 1]) }}
    >
      {bone.children.map((child, i) =>
        child.kind === 'bone' ? (
          <BoneNode
            key={child.bone.id}
            bone={child.bone}
            parentOrigin={bone.origin}
            model={model}
            scale={scale}
            pose={pose}
            selected={selected}
            onSelect={onSelect}
            onPaint={onPaint}
          />
        ) : (
          (() => {
            const cube = model.cubes.find((c) => c.id === child.id)
            if (!cube) return null
            return (
              <CubeBox
                key={`${child.id}-${i}`}
                cube={cube}
                parentOrigin={bone.origin}
                model={model}
                scale={scale}
                selected={selected === cube.id}
                onSelect={onSelect}
                onPaint={onPaint}
              />
            )
          })()
        ),
      )}
    </div>
  )
}

type Props = {
  model: Model
  /** px per model unit */
  scale?: number
  grid?: boolean
  orbit?: boolean
  spin?: boolean
  initialYaw?: number
  initialPitch?: number
  /** pull the camera back; negative moves away */
  zoom?: number
  /** false hides the on-canvas zoom cluster, for thumbnails */
  zoomable?: boolean
  clip?: Clip | null
  time?: number
  selected?: string | null
  onSelect?: (id: string) => void
  /**
   * When set, a LEFT drag on a face paints. Every other drag - on empty
   * space, or with any other button - still orbits, so you are never
   * stuck looking at one side of the model while painting it.
   */
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
  /** a display-slot transform applied to the whole model, as a pack would */
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
  className?: string
}

/**
 * Renders a `.vellum` with CSS 3D transforms: the bone hierarchy becomes
 * nested transformed divs, and each face samples its own UV rectangle out of
 * the texture. No WebGL, no meshes - but the geometry, the pivots and the UVs
 * are the real ones from the file.
 */
export function ModelView({
  model,
  scale = 6,
  grid = true,
  orbit = true,
  spin = false,
  initialYaw = -32,
  initialPitch = -18,
  zoom = 0,
  zoomable = true,
  clip = null,
  time = 0,
  selected = null,
  onSelect,
  onPaint,
  display = null,
  className = '',
}: Props) {
  const [yaw, setYaw] = useState(initialYaw)
  const [pitch, setPitch] = useState(initialPitch)
  const [factor, setFactor] = useState(1)
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const pinch = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ span: number; factor: number } | null>(null)

  const pose = useMemo(() => samplePose(clip, time), [clip, time])

  const clampZoom = (f: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, f))
  const nudge = useCallback((mul: number) => setFactor((f) => clampZoom(f * mul)), [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!orbit) return
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch.current.size === 2) {
        const [a, b] = [...pinch.current.values()]
        pinchStart.current = { span: Math.hypot(a.x - b.x, a.y - b.y), factor }
        drag.current = null
        return
      }
      drag.current = { x: e.clientX, y: e.clientY, yaw, pitch }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [orbit, yaw, pitch, factor],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const start = pinchStart.current
    if (start && pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()]
      const span = Math.hypot(a.x - b.x, a.y - b.y)
      if (start.span > 0) setFactor(clampZoom((start.factor * span) / start.span))
      return
    }

    const from = drag.current
    if (!from) return
    setYaw(from.yaw + (e.clientX - from.x) * 0.45)
    setPitch(Math.max(-88, Math.min(88, from.pitch - (e.clientY - from.y) * 0.35)))
  }, [])

  const endDrag = useCallback((e: React.PointerEvent) => {
    pinch.current.delete(e.pointerId)
    if (pinch.current.size < 2) pinchStart.current = null
    drag.current = null
  }, [])

  /* Wheel zoom has to be a non-passive native listener: React's onWheel is
     registered passively, so preventDefault there is ignored and the page
     scrolls behind the viewport instead. */
  useEffect(() => {
    const node = root.current
    if (!node || !orbit) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // a trackpad pinch arrives as ctrl+wheel, with much smaller deltas
      const step = e.ctrlKey ? 0.01 : 0.0016
      setFactor((f) => clampZoom(f * Math.exp(-e.deltaY * step)))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [orbit])

  /* Centred left-to-right and front-to-back, but stood ON the grid rather
     than through it: the model's lowest point is what meets the floor. */
  const anchor = useMemo(() => {
    if (!model.cubes.length) return [0, 0, 0] as Vec3
    const lo: Vec3 = [Infinity, Infinity, Infinity]
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const c of model.cubes) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], c.from[i])
        hi[i] = Math.max(hi[i], c.to[i])
      }
    }
    return [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2] as Vec3
  }, [model])

  /* Zoom scales the whole stage rather than sliding the camera along Z:
     translateZ past the perspective origin distorts and eventually turns
     the model inside out, while scaling keeps proportions exact. */
  const stage = spin
    ? undefined
    : `translateZ(${zoom}px) rotateX(${pitch}deg) rotateY(${yaw}deg) scale3d(${factor}, ${factor}, ${factor})`

  return (
    <div
      ref={root}
      className={`scene3d${spin ? ' scene3d--spin' : ''} ${className}`}
      style={
        {
          '--pitch': `${pitch}deg`,
          '--yaw': `${yaw}deg`,
          '--zoom': `${zoom}px`,
          '--zoom-scale': factor,
          cursor: onPaint ? 'crosshair' : orbit ? 'grab' : undefined,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // right-drag orbits, so the browser menu would fight it
      onContextMenu={orbit ? (e) => e.preventDefault() : undefined}
    >
      <div className="scene3d__stage" style={{ transform: stage }}>
        {grid ? (
          <div className="scene3d__grid">
            <div
              className="scene3d__grid-plane"
              style={{
                width: Math.round(16 * scale * 2.6),
                height: Math.round(16 * scale * 2.6),
                ['--cell' as string]: `${scale * 4}px`,
              }}
            />
          </div>
        ) : null}
        <div className="scene3d__origin">
          <div
            className="bbroot"
            style={{
              transform:
                `translate3d(${-anchor[0] * scale}px, ${anchor[1] * scale}px, ${-anchor[2] * scale}px)` +
                (display
                  ? ` translate3d(${display.translation[0] * scale}px, ${-display.translation[1] * scale}px, ${display.translation[2] * scale}px)` +
                    ` rotateX(${-display.rotation[0]}deg) rotateY(${display.rotation[1]}deg) rotateZ(${-display.rotation[2]}deg)` +
                    ` scale3d(${display.scale[0]}, ${display.scale[1]}, ${display.scale[2]})`
                  : ''),
            }}
          >
            {model.bones.map((b) => (
              <BoneNode
                key={b.id}
                bone={b}
                parentOrigin={[0, 0, 0]}
                model={model}
                scale={scale}
                pose={pose}
                selected={selected}
                onSelect={onSelect}
                onPaint={onPaint}
              />
            ))}
          </div>
        </div>
      </div>

      {orbit && zoomable ? (
        <div className="scene3d__zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" title="Zoom in (scroll up)" aria-label="Zoom in" onClick={() => nudge(1.25)}>
            +
          </button>
          <button
            type="button"
            className="scene3d__zoom-level"
            title="Reset the view"
            aria-label="Reset zoom"
            onClick={() => {
              setFactor(1)
              setYaw(initialYaw)
              setPitch(initialPitch)
            }}
          >
            {Math.round(factor * 100)}%
          </button>
          <button type="button" title="Zoom out (scroll down)" aria-label="Zoom out" onClick={() => nudge(0.8)}>
            &minus;
          </button>
        </div>
      ) : null}
    </div>
  )
}
