import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { FACES, samplePose, textureById } from '../lib/model'
import type { Bone, Clip, Cube, Face as ModelFace, FaceKey, Model, Pose, Vec3 } from '../lib/model'
import { Gizmo } from './Gizmo'
import type { Basis, GizmoEvent, GizmoSpec } from './Gizmo'
import './Model3D.css'
import './ModelView.css'

/** Modifier keys held on a click, for adding to or toggling a selection. */
export type PickMods = { shift: boolean; ctrl: boolean }

/** Camera control from outside: view presets, focus, box select. */
export type ViewApi = {
  setView: (yaw: number, pitch: number) => void
  /** centres the view on a world point and zooms so `size` units fill about half of it */
  focus: (centre: Vec3, size: number) => void
  /** the next left-drag on the viewport draws a selection box (Blender's B) */
  armBox: () => void
  view: () => { yaw: number; pitch: number }
}

/** Where the corners of cubes are, for the vertex snap tool. */
export type VertexLayer = {
  points: Vec3[]
  /** marks the corners of the cube being moved */
  own: boolean[]
  onPick: (index: number) => void
}

/** Probe length in model units: long enough to measure, short enough to stay near the anchor. */
const PROBE = 4

/* The six ends of the navigation gizmo and the view each one looks from. */
const NAV_ENDS: Array<{ axis: 0 | 1 | 2; sign: 1 | -1; label: string; yaw: number; pitch: number }> = [
  { axis: 0, sign: 1, label: 'X', yaw: -90, pitch: 0 },
  { axis: 0, sign: -1, label: '', yaw: 90, pitch: 0 },
  { axis: 1, sign: 1, label: 'Y', yaw: 0, pitch: -90 },
  { axis: 1, sign: -1, label: '', yaw: 0, pitch: 90 },
  { axis: 2, sign: 1, label: 'Z', yaw: 0, pitch: 0 },
  { axis: 2, sign: -1, label: '', yaw: 180, pitch: 0 },
]
const NAV_COLOURS = ['#ff3b4e', '#7ad21c', '#2f8dff']

/* Each face's plane size and the transform that places it on the box. South is +z. */
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
/** Far enough to put any corner of a model under the cursor, near enough to find it again. */
const PAN_LIMIT = 3000

/* Model space is Y-up, CSS is Y-down. Mapping (x,y,z) to (x,-y,z) reverses
   rotation about X and Z but not Y, so rx and rz are negated. */
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
  const spin = face.rotation ?? 0
  // a quarter turn swaps which side of the face the UV rectangle spans
  const turned = spin === 90 || spin === 270
  const inner = { w: turned ? px.h : px.w, h: turned ? px.w : px.h }

  const style: React.CSSProperties = {
    width: px.w,
    height: px.h,
    marginLeft: -px.w / 2,
    marginTop: -px.h / 2,
    transform,
  }

  const skin: React.CSSProperties = {
    width: inner.w,
    height: inner.h,
    marginLeft: -inner.w / 2,
    marginTop: -inner.h / 2,
    transform: spin ? `rotate(${spin}deg)` : undefined,
  }

  if (texture && texture.source) {
    const [x1, y1, x2, y2] = face.uv
    const uw = Math.abs(x2 - x1) || 1
    const uh = Math.abs(y2 - y1) || 1
    // Scale the sheet so the UV rectangle covers the face, then offset it to the
    // rectangle's corner. Sizes are in UV units, which can differ from the PNG's pixels.
    const sx = inner.w / uw
    const sy = inner.h / uh
    skin.backgroundImage = `url(${texture.source})`
    skin.backgroundSize = `${texture.uvWidth * sx}px ${texture.uvHeight * sy}px`
    skin.backgroundPosition = `${-Math.min(x1, x2) * sx}px ${-Math.min(y1, y2) * sy}px`
    skin.imageRendering = 'pixelated'
    // A reversed UV coordinate mirrors the face. The rectangle above is
    // normalised to min/max, so the flip is applied to the plane here.
    const flipX = x2 < x1
    const flipY = y2 < y1
    if (flipX || flipY) {
      style.transform = `${transform} scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
    }
  } else {
    skin.background = 'rgba(146, 165, 202, 0.25)'
  }

  /* The browser inverse-transforms offsetX/offsetY into the element's own
     space, so a hit on a rotated face gives face-local pixels. */
  const report = (e: React.PointerEvent<HTMLDivElement>, phase: 'down' | 'move') => {
    if (!onPaint) return
    const u = e.nativeEvent.offsetX / px.w
    const v = e.nativeEvent.offsetY / px.h
    if (u < 0 || v < 0 || u > 1 || v > 1) return
    // un-turn the hit so it lands on the texel that is actually drawn there
    const [tu, tv] =
      spin === 90 ? [v, 1 - u] : spin === 180 ? [1 - u, 1 - v] : spin === 270 ? [1 - v, u] : [u, v]
    onPaint(name, tu, tv, phase)
  }

  return (
    <div
      className="model-face"
      data-face={name}
      data-spin={spin || undefined}
      data-shaded={texture?.shaded || undefined}
      style={style}
      onPointerDown={
        onPaint
          ? (e) => {
              /* Left button paints and stops the event. Other buttons bubble
                 up so the scene can orbit or pan. */
              if (e.button !== 0) return
              e.stopPropagation()
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              report(e, 'down')
            }
          : undefined
      }
      onPointerMove={onPaint ? (e) => e.buttons === 1 && report(e, 'move') : undefined}
    >
      <div className="model-face__skin" style={skin} />
    </div>
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
  onSelect?: (id: string, mods: PickMods) => void
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
}) {
  if (!cube.visible) return null

  // the format allows to < from, which would render inside-out. The size is
  // clamped here and validateModel reports it.
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
    <div className="model-pivot" style={{ transform: transformOf(pivotAt, cube.rotation, scale) }}>
      <div
        className={`model-cube${selected ? ' model-cube--selected' : ''}`}
        data-cube={cube.id}
        style={{ transform: transformOf(boxAt, [0, 0, 0], scale) }}
        onPointerDown={
          onSelect
            ? (e) => e.button === 0 && !e.altKey && onSelect(cube.id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })
            : undefined
        }
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
  selected: ReadonlySet<string>
  onSelect?: (id: string, mods: PickMods) => void
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
      className="model-group"
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
                selected={selected.has(cube.id)}
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
  /** Holds the view at this yaw, for a caller that turns the model itself. */
  yaw?: number
  /** stage translateZ in px; negative moves the model away */
  zoom?: number
  /** false hides the on-canvas zoom cluster, for thumbnails */
  zoomable?: boolean
  clip?: Clip | null
  time?: number
  /** highlighted nodes; `selected` is kept for single-selection callers */
  selected?: string | null
  selection?: readonly string[]
  onSelect?: (id: string, mods: PickMods) => void
  /** the transform gizmo to draw, in world space */
  gizmo?: GizmoSpec | null
  onGizmo?: (e: GizmoEvent) => void
  /** gizmo snap increment in model units */
  snapStep?: number
  /** orthographic projection instead of perspective */
  ortho?: boolean
  onOrtho?: (ortho: boolean) => void
  /** the clickable axis gizmo, top right */
  nav?: boolean
  viewRef?: Ref<ViewApi>
  /** a finished box select: the cubes inside, and whether to add to the selection */
  onBoxSelect?: (ids: string[], add: boolean) => void
  vertices?: VertexLayer | null
  /** called when the camera turns, with the yaw and pitch */
  onView?: (yaw: number, pitch: number) => void
  /** a click on empty space */
  onDeselect?: () => void
  /** When set, a left-button drag on a face paints. Other drags orbit or pan as usual. */
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
  /** a display-slot transform applied to the whole model, as a pack would */
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
  /** 'floor' stands the model's lowest point on the grid; 'centre' centres it vertically. */
  anchorAt?: 'floor' | 'centre'
  /** an explicit stage origin, in model units, overriding `anchorAt` */
  anchorOn?: Vec3 | null
  className?: string
}

/** Renders a model with CSS 3D transforms. Bones are nested divs; each face shows its UV rectangle. */
export function ModelView({
  model,
  scale = 6,
  grid = true,
  orbit = true,
  spin = false,
  initialYaw = -32,
  initialPitch = -18,
  yaw: heldYaw,
  zoom = 0,
  zoomable = true,
  clip = null,
  time = 0,
  selected = null,
  selection,
  onSelect,
  gizmo = null,
  onGizmo,
  snapStep = 1,
  ortho = false,
  onOrtho,
  nav = false,
  viewRef,
  onBoxSelect,
  vertices = null,
  onView,
  onDeselect,
  onPaint,
  display = null,
  anchorAt = 'floor',
  anchorOn = null,
  className = '',
}: Props) {
  const [ownYaw, setYaw] = useState(initialYaw)
  const yaw = heldYaw ?? ownYaw
  const [pitch, setPitch] = useState(initialPitch)
  const [factor, setFactor] = useState(1)
  // screen-space offset of the stage; without it every zoom is about the stage's centre
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const panning = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  // where the last press began, and whether that was on empty space
  const press = useRef<{ x: number; y: number; empty: boolean } | null>(null)
  const pinch = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ span: number; factor: number } | null>(null)

  const pose = useMemo(() => samplePose(clip, time), [clip, time])
  const picked = useMemo(
    () => new Set<string>(selection ?? (selected ? [selected] : [])),
    [selection, selected],
  )
  /** a world point the view is centred on, set by focus; it overrides the anchor */
  const [focusAt, setFocusAt] = useState<Vec3 | null>(null)
  const boxArmed = useRef(false)
  const marquee = useRef<{ x: number; y: number; add: boolean } | null>(null)
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)

  useEffect(() => {
    onView?.(yaw, pitch)
  }, [yaw, pitch, onView])

  const clampZoom = (f: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, f))
  const clampPan = (v: number) => Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, v))

  /* The stage scales in 3D under perspective, so a zoom's on-screen ratio and
     fixed point can't be derived from the scale factor. A hidden probe inside
     the stage is measured before and after: its width gives the ratio and its
     centre gives the fixed point. The pan then holds the cursor still. */
  const probe = useRef<HTMLDivElement>(null)
  const zoomAnchor = useRef<{ at: { x: number; y: number }; before: DOMRect } | null>(null)

  const zoomAt = useCallback((mul: number, at?: { x: number; y: number }) => {
    const before = probe.current?.getBoundingClientRect()
    if (at && before && before.width > 0) zoomAnchor.current = { at, before }
    setFactor((f) => clampZoom(f * mul))
  }, [])

  useLayoutEffect(() => {
    const pending = zoomAnchor.current
    zoomAnchor.current = null
    if (!pending || !probe.current) return

    const after = probe.current.getBoundingClientRect()
    const k = after.width / pending.before.width
    // no magnification means nothing to correct, and 1 - k would divide by zero
    if (!Number.isFinite(k) || Math.abs(k - 1) < 1e-4) return

    const o0 = { x: pending.before.x + pending.before.width / 2, y: pending.before.y + pending.before.height / 2 }
    const o1 = { x: after.x + after.width / 2, y: after.y + after.height / 2 }
    // o1 = C + k(o0 - C)  solved for the fixed point C
    const cx = (o1.x - k * o0.x) / (1 - k)
    const cy = (o1.y - k * o0.y) / (1 - k)
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return

    setPan((prev) => ({
      x: clampPan(prev.x + (pending.at.x - cx) * (1 - k)),
      y: clampPan(prev.y + (pending.at.y - cy) * (1 - k)),
    }))
  }, [factor])

  const nudge = useCallback((mul: number) => zoomAt(mul), [zoomAt])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!orbit) return

      /* Ctrl+drag on empty space, or a drag after B, draws a selection box.
         Shift adds to the selection. */
      if (onBoxSelect && e.button === 0 && (boxArmed.current || ((e.ctrlKey || e.metaKey) && e.target === e.currentTarget))) {
        boxArmed.current = false
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        marquee.current = { x: e.clientX - r.left, y: e.clientY - r.top, add: e.shiftKey }
        setBox({ x0: marquee.current.x, y0: marquee.current.y, x1: marquee.current.x, y1: marquee.current.y })
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        e.preventDefault()
        return
      }

      // middle button or shift-drag pans; left and right drags orbit
      if (e.button === 1 || e.shiftKey) {
        e.preventDefault()
        panning.current = { x: e.clientX, y: e.clientY, pan }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        return
      }

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
    [orbit, yaw, pitch, factor, pan, onBoxSelect],
  )

  /* the pinch handler needs the live factor without re-subscribing on every step */
  const factorRef = useRef(factor)
  factorRef.current = factor

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (marquee.current) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const m = marquee.current
      setBox({ x0: m.x, y0: m.y, x1: e.clientX - r.left, y1: e.clientY - r.top })
      return
    }
    const drift = panning.current
    if (drift) {
      setPan({
        x: clampPan(drift.pan.x + (e.clientX - drift.x)),
        y: clampPan(drift.pan.y + (e.clientY - drift.y)),
      })
      return
    }

    if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const start = pinchStart.current
    if (start && pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()]
      const span = Math.hypot(a.x - b.x, a.y - b.y)
      if (start.span > 0) {
        // zoom about the pinch midpoint
        const want = clampZoom((start.factor * span) / start.span)
        const now = factorRef.current
        if (now > 0 && want !== now) zoomAt(want / now, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      }
      return
    }

    const from = drag.current
    if (!from) return
    setYaw(from.yaw + (e.clientX - from.x) * 0.45)
    setPitch(Math.max(-88, Math.min(88, from.pitch - (e.clientY - from.y) * 0.35)))
  }, [zoomAt])

  const endDrag = useCallback((e: React.PointerEvent) => {
    const m = marquee.current
    if (m && onBoxSelect && root.current) {
      marquee.current = null
      const r = root.current.getBoundingClientRect()
      const x1 = e.clientX - r.left
      const y1 = e.clientY - r.top
      const [lx, hx] = [Math.min(m.x, x1), Math.max(m.x, x1)]
      const [ly, hy] = [Math.min(m.y, y1), Math.max(m.y, y1)]
      const ids: string[] = []
      // a cube is in when the middle of its drawn box is inside the marquee
      root.current.querySelectorAll<HTMLElement>('.model-cube[data-cube]').forEach((el) => {
        const b = el.getBoundingClientRect()
        const cx = b.left + b.width / 2 - r.left
        const cy = b.top + b.height / 2 - r.top
        if (cx >= lx && cx <= hx && cy >= ly && cy <= hy) ids.push(el.dataset.cube!)
      })
      setBox(null)
      onBoxSelect(ids, m.add)
      return
    }
    panning.current = null
    pinch.current.delete(e.pointerId)
    if (pinch.current.size < 2) pinchStart.current = null
    drag.current = null
  }, [onBoxSelect])

  /* A native non-passive listener: React registers onWheel as passive, so
     preventDefault there is ignored and the page scrolls. */
  useEffect(() => {
    const node = root.current
    if (!node || !orbit) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // shift+wheel scrolls the view sideways, as it does in most editors
      if (e.shiftKey && !e.ctrlKey) {
        setPan((prev) => ({ x: clampPan(prev.x - e.deltaY), y: prev.y }))
        return
      }
      // a trackpad pinch arrives as ctrl+wheel, with much smaller deltas
      const step = e.ctrlKey ? 0.01 : 0.0016
      zoomAt(Math.exp(-e.deltaY * step), { x: e.clientX, y: e.clientY })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [orbit, zoomAt])

  const anchor = useMemo(() => {
    if (!model.cubes.length) return anchorOn ?? ([0, 0, 0] as Vec3)
    const lo: Vec3 = [Infinity, Infinity, Infinity]
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const c of model.cubes) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], c.from[i])
        hi[i] = Math.max(hi[i], c.to[i])
      }
    }
    if (focusAt) return focusAt
    if (anchorOn) return anchorOn
    return [
      (lo[0] + hi[0]) / 2,
      anchorAt === 'centre' ? (lo[1] + hi[1]) / 2 : lo[1],
      (lo[2] + hi[2]) / 2,
    ] as Vec3
  }, [model, anchorAt, anchorOn, focusAt])

  useImperativeHandle(
    viewRef,
    () => ({
      setView: (y, p) => {
        setYaw(y)
        setPitch(Math.max(-90, Math.min(90, p)))
      },
      focus: (centre, size) => {
        const el = root.current
        const span = el ? Math.min(el.clientWidth, el.clientHeight) : 600
        setFocusAt(centre)
        setPan({ x: 0, y: 0 })
        setFactor(clampZoom((span * 0.5) / Math.max(size * scale, 1)))
      },
      armBox: () => {
        boxArmed.current = true
      },
      view: () => ({ yaw, pitch }),
    }),
    [scale, yaw, pitch],
  )

  /* Gizmo probes: the anchor and one unit along each world axis, placed in
     the model root so the browser projects them exactly as it draws the
     model. `measure` turns them into screen vectors. */
  const probes = useRef<Array<HTMLDivElement | null>>([])
  const measure = useCallback((): Basis | null => {
    const el = root.current
    const ps = probes.current
    if (!el || ps.length < 4 || ps.some((p) => !p)) return null
    const r = el.getBoundingClientRect()
    const at = ps.map((p) => {
      const b = p!.getBoundingClientRect()
      return [b.left - r.left, b.top - r.top] as [number, number]
    })
    const [c, x, y, z] = at
    const per = (p: [number, number]): [number, number] => [(p[0] - c[0]) / PROBE, (p[1] - c[1]) / PROBE]
    return { c, s: [per(x), per(y), per(z)] }
  }, [])

  /* the corners for vertex snap, measured the same way */
  const vertexEls = useRef<Array<HTMLDivElement | null>>([])
  const [vertexAt, setVertexAt] = useState<Array<[number, number]>>([])
  useEffect(() => {
    if (!vertices) return
    let raf = 0
    let last = ''
    const tick = () => {
      const el = root.current
      if (el) {
        const r = el.getBoundingClientRect()
        const pts = vertexEls.current.slice(0, vertices.points.length).map((p) => {
          const b = p?.getBoundingClientRect()
          return (b ? [b.left - r.left, b.top - r.top] : [-99, -99]) as [number, number]
        })
        const key = pts.map((p) => p.map((n) => n.toFixed(0)).join(',')).join(';')
        if (key !== last) {
          last = key
          setVertexAt(pts)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [vertices])

  const navEnds = useMemo(() => {
    const m = new DOMMatrix(`rotateX(${pitch}deg) rotateY(${yaw}deg)`)
    return NAV_ENDS.map((end) => {
      const v: [number, number, number] = [0, 0, 0]
      v[end.axis] = end.sign
      const p = m.transformPoint(new DOMPoint(v[0], -v[1], v[2], 0))
      return { ...end, x: p.x, y: p.y, z: p.z }
    }).sort((a, b) => a.z - b.z)
  }, [yaw, pitch])
  const worldPos = (p: Vec3) => `translate3d(${p[0] * scale}px, ${-p[1] * scale}px, ${p[2] * scale}px)`

  /* The zoom factor scales the stage. Zooming with translateZ distorts, and
     past the perspective distance it turns the model inside out. */
  const stage = spin
    ? undefined
    : `translate(${pan.x}px, ${pan.y}px) translateZ(${zoom}px) rotateX(${pitch}deg) ` +
      `rotateY(${yaw}deg) scale3d(${factor}, ${factor}, ${factor})`

  return (
    <div
      ref={root}
      className={`scene3d${spin ? ' scene3d--spin' : ''}${ortho ? ' scene3d--ortho' : ''} ${className}`}
      style={
        {
          '--pitch': `${pitch}deg`,
          '--yaw': `${yaw}deg`,
          '--zoom': `${zoom}px`,
          '--zoom-scale': factor,
          '--pan-x': `${pan.x}px`,
          '--pan-y': `${pan.y}px`,
          cursor: onPaint ? 'crosshair' : orbit ? 'grab' : undefined,
        } as React.CSSProperties
      }
      onPointerDownCapture={(e) => {
        press.current = { x: e.clientX, y: e.clientY, empty: e.target === e.currentTarget }
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        /* The orbit drag captures the pointer, so the click lands on the scene
           even when the press was on a cube. Only a still click that began
           on empty space deselects. */
        const at = press.current
        press.current = null
        if (onDeselect && at?.empty && Math.hypot(e.clientX - at.x, e.clientY - at.y) < 4) onDeselect()
      }}
      // the browser's middle-click autoscroll widget fights a pan drag
      onMouseDown={orbit ? (e) => e.button === 1 && e.preventDefault() : undefined}
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
          {/* invisible; measured before and after each zoom */}
          <div className="scene3d__probe" ref={probe} aria-hidden="true" />
          <div
            className="model-root"
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
                selected={picked}
                onSelect={onSelect}
                onPaint={onPaint}
              />
            ))}
            {gizmo
              ? [gizmo.anchor, ...([0, 1, 2] as const).map((i) => {
                  const p: Vec3 = [...gizmo.anchor]
                  p[i] += PROBE
                  return p
                })].map((p, i) => (
                  <div
                    key={`probe${i}`}
                    className="scene3d__gizmo-probe"
                    ref={(el) => {
                      probes.current[i] = el
                    }}
                    style={{ transform: worldPos(p) }}
                  />
                ))
              : null}
            {vertices
              ? vertices.points.map((p, i) => (
                  <div
                    key={`v${i}`}
                    className="scene3d__gizmo-probe"
                    ref={(el) => {
                      vertexEls.current[i] = el
                    }}
                    style={{ transform: worldPos(p) }}
                  />
                ))
              : null}
          </div>
        </div>
      </div>

      {gizmo && onGizmo ? <Gizmo spec={gizmo} measure={measure} step={snapStep} onGizmo={onGizmo} /> : null}

      {vertices
        ? vertexAt.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`scene3d__vertex${vertices.own[i] ? ' scene3d__vertex--own' : ''}`}
              style={{ left: p[0], top: p[1] }}
              aria-label={vertices.own[i] ? 'Corner of the selection' : 'Corner to snap to'}
              onPointerDown={(e) => {
                e.stopPropagation()
                vertices.onPick(i)
              }}
            />
          ))
        : null}

      {box ? (
        <div
          className="scene3d__marquee"
          style={{
            left: Math.min(box.x0, box.x1),
            top: Math.min(box.y0, box.y1),
            width: Math.abs(box.x1 - box.x0),
            height: Math.abs(box.y1 - box.y0),
          }}
        />
      ) : null}

      {nav ? (
        <>
          <div className="scene3d__nav" title="Click an axis to look along it, drag to orbit">
            <svg viewBox="-42 -42 84 84" aria-hidden="false" role="group" aria-label="View axes">
              {navEnds.map((end) => (
                <line
                  key={`l${end.axis}${end.sign}`}
                  x1={0}
                  y1={0}
                  x2={end.x * 30}
                  y2={end.y * 30}
                  style={{ stroke: NAV_COLOURS[end.axis], opacity: end.sign > 0 ? 1 : 0.4 }}
                />
              ))}
              {navEnds.map((end) => (
                <g
                  key={`b${end.axis}${end.sign}`}
                  className={`scene3d__nav-ball${end.sign < 0 ? ' scene3d__nav-ball--neg' : ''}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setYaw(end.yaw)
                    setPitch(end.pitch)
                  }}
                  role="button"
                  aria-label={`Look along ${end.sign > 0 ? '+' : '-'}${'XYZ'[end.axis]}`}
                >
                  <circle cx={end.x * 30} cy={end.y * 30} r={end.sign > 0 ? 8 : 6} style={{ fill: NAV_COLOURS[end.axis] }} />
                  {end.label ? (
                    <text x={end.x * 30} y={end.y * 30 + 3} textAnchor="middle">
                      {end.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
          {onOrtho ? (
            <button
              type="button"
              className="scene3d__projection"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onOrtho(!ortho)}
              title="Switch perspective and orthographic (Numpad 5)"
            >
              {ortho ? 'Orthographic' : 'Perspective'}
            </button>
          ) : null}
        </>
      ) : null}

      {orbit && zoomable ? (
        <div className="scene3d__zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" title="Zoom in (scroll up)" aria-label="Zoom in" onClick={() => nudge(1.25)}>
            +
          </button>
          <button
            type="button"
            className="scene3d__zoom-level"
            title="Recentre and reset the zoom"
            aria-label="Reset zoom"
            onClick={() => {
              setFactor(1)
              setFocusAt(null)
              setPan({ x: 0, y: 0 })
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
