import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { samplePose } from '../lib/model'
import { buildRig, nullWorld, solveIK } from '../lib/kinematics'
import type { Bone, Clip, FaceKey, Model, Vec3 } from '../lib/model'
import { makeCamera, perspectiveOf, stagePoint } from '../lib/gl/camera'
import type { CameraState } from '../lib/gl/camera'
import { buildScene } from '../lib/gl/scene'
import type { BuiltScene } from '../lib/gl/scene'
import { drawView, glAvailable, onTextureReady } from '../lib/gl/renderer'
import type { Rgba } from '../lib/gl/renderer'
import { pickAt } from '../lib/gl/pick'
import { hasAnimatedTextures, textureFrames } from '../lib/texture-anim'
import type { Hit } from '../lib/gl/pick'
import { Gizmo } from './Gizmo'
import type { Basis, GizmoEvent, GizmoSpec } from './Gizmo'
import './Model3D.css'
import './ModelView.css'

/** Modifier keys held on a click, for adding to or toggling a selection. */
export type PickMods = { shift: boolean; ctrl: boolean; alt?: boolean }

/** Camera control from outside: view presets, focus, box select. */
export type ViewApi = {
  setView: (yaw: number, pitch: number) => void
  /** centres the view on a world point and zooms so `size` units fill about half of it */
  focus: (centre: Vec3, size: number) => void
  /** the next left-drag on the viewport draws a selection box (Blender's B) */
  armBox: () => void
  view: () => { yaw: number; pitch: number }
  /** where the gizmo's anchor is on screen and the screen step of one unit along x, y and z; null without a gizmo */
  basis: () => Basis | null
}

/** Where the corners of cubes are, for the vertex snap tool. */
export type VertexLayer = {
  points: Vec3[]
  /** marks the corners of the cube being moved */
  own: boolean[]
  onPick: (index: number, mods?: PickMods) => void
  /** a finished box select over the dots: the indices inside, and whether to add */
  onBox?: (indices: number[], add: boolean) => void
  /** edges between points, by index, drawn as lines you can click (a mesh's Edge mode) */
  edges?: Array<[number, number]>
  /** marks the picked edges */
  edgeOwn?: boolean[]
  /** a click on an edge: `t` is how far along it, from its first point to its second */
  onPickEdge?: (index: number, mods: PickMods, t: number) => void
  /** the knife's cut: points on edges (by edge index and how far along) or at one of `points`, joined in order */
  marks?: Array<{ edge: number; t: number } | { point: number }>
  /** draws no dots, only the edges */
  hideDots?: boolean
}


const EMPTY: ReadonlySet<string> = new Set()

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


const ZOOM_MIN = 0.3
const ZOOM_MAX = 7
/** Far enough to put any corner of a model under the cursor, near enough to find it again. */
const PAN_LIMIT = 3000


/** Mesh editing state the viewport draws: which faces are picked, and where a face click goes. */
export type MeshPick = {
  mesh: string
  faces: ReadonlySet<string>
  /** set while picking faces; a click on a face of `mesh` calls it instead of selecting the mesh */
  onFace?: (face: string, mods: PickMods) => void
  /** set while the knife cuts; a click inside a face gives the point under it, in the mesh's own frame */
  onFacePoint?: (face: string, at: Vec3) => void
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
  /** onion skin: other moments of the clip drawn faintly, earlier ones blue, later ones orange */
  ghosts?: Array<{ time: number; side: 'before' | 'after' }>
  /** draws null objects as markers you can click */
  showNulls?: boolean
  /** a click on empty space */
  onDeselect?: () => void
  /** a line through the gizmo's anchor along a world axis, while a grab is held to it */
  guide?: 0 | 1 | 2 | null
  /** When set, a left-button drag on a face paints. Other drags orbit or pan as usual. */
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
  /** mesh editing: picked faces, and face picking */
  meshPick?: MeshPick | null
  /** painting on a mesh face; u and v are in UV units */
  onPaintMesh?: (meshId: string, face: string, u: number, v: number, phase: 'down' | 'move') => void
  /** a display-slot transform applied to the whole model, as a pack would */
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
  /** 'floor' stands the model's lowest point on the grid; 'centre' centres it vertically. */
  anchorAt?: 'floor' | 'centre'
  /** an explicit stage origin, in model units, overriding `anchorAt` */
  anchorOn?: Vec3 | null
  /** places the model by a general matrix instead of `display` (Display mode's previews) */
  place?: DOMMatrix | null
  /** other models drawn in world space with it, never picked: the player, an item frame */
  companions?: Model[]
  /** a field of view from an eye at this point, instead of the usual orbit perspective (first person); yaw and pitch turn the view about the eye */
  eye?: { at: Vec3; fov: number } | null
  /** where the eye is down the box, 0 to 1 (0.46 by default) */
  eyeHeight?: number
  /** holds animated textures on these frames (by texture id) instead of playing them; Paint holds the frame being painted */
  textureFrame?: ReadonlyMap<string, number> | null
  /** 'wire' draws every edge and no faces */
  shading?: 'solid' | 'wire'
  className?: string
}


/** A CSS colour as 0..1 RGBA, read through a canvas so any form the stylesheet uses works. */
function rgbaOf(css: string, fallback: Rgba): Rgba {
  const c = document.createElement('canvas').getContext('2d')
  if (!c || !css.trim()) return fallback
  c.fillStyle = '#000'
  c.fillStyle = css.trim()
  c.fillRect(0, 0, 1, 1)
  const d = c.getImageData(0, 0, 1, 1).data
  return d[3] ? [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255] : fallback
}

/** The theme's colours the renderer needs, read again when the theme changes. */
function useThemeColours(root: React.RefObject<HTMLDivElement | null>) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const watch = new MutationObserver(bump)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)')
    dark?.addEventListener?.('change', bump)
    bump()
    return () => {
      watch.disconnect()
      dark?.removeEventListener?.('change', bump)
    }
  }, [])
  return useMemo(() => {
    const el = root.current
    const css = el ? getComputedStyle(el) : null
    const v = (name: string) => css?.getPropertyValue(name) ?? ''
    return {
      accent: rgbaOf(v('--model-select') || v('--accent-mark'), [0.35, 0.64, 1, 1]),
      grid: rgbaOf(v('--grid-line'), [1, 1, 1, 0.08]),
      border: rgbaOf(v('--ink-faint'), [1, 1, 1, 0.2]).map((x, i) => (i === 3 ? x * 0.4 : x)) as Rgba,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
}

/** Renders a model with WebGL. Overlays (gizmo, dots, edges, nulls) are DOM, placed by the same camera. */
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
  ghosts,
  showNulls = false,
  onDeselect,
  guide = null,
  onPaint,
  meshPick = null,
  onPaintMesh,
  display = null,
  anchorAt = 'floor',
  anchorOn = null,
  shading = 'solid',
  place = null,
  companions,
  eye = null,
  textureFrame = null,
  eyeHeight,
  className = '',
}: Props) {
  const [ownYaw, setYaw] = useState(initialYaw)
  const [spinYaw, setSpinYaw] = useState(0)
  const yaw = spin ? spinYaw : (heldYaw ?? ownYaw)
  const [pitch, setPitch] = useState(initialPitch)
  const [factor, setFactor] = useState(1)
  // screen-space offset of the stage; without it every zoom is about the stage's centre
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const panning = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  // where the last press began, and whether that was on empty space
  const press = useRef<{ x: number; y: number; empty: boolean } | null>(null)
  const pinch = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ span: number; factor: number } | null>(null)
  // a paint stroke in progress: the element and face it started on
  const stroke = useRef<{ kind: 'cube' | 'mesh'; id: string; face: string } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 })
  const [noGl] = useState(() => !glAvailable())
  const colours = useThemeColours(root)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight, dpr: Math.min(3, window.devicePixelRatio || 1) })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // a spinning preview turns once every nine seconds, and holds still for reduced motion
  useEffect(() => {
    if (!spin) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      setSpinYaw((((now - start) / 9000) * 360) % 360)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spin])

  // the clip's pose with any IK chains bent toward their null objects
  const pose = useMemo(() => solveIK(model, samplePose(clip, time)), [model, clip, time])
  const ghostPoses = useMemo(
    () => (ghosts ?? []).map((g) => ({ ...g, pose: solveIK(model, samplePose(clip, g.time)) })),
    [ghosts, model, clip],
  )
  const nullMarks = useMemo(() => {
    if (!showNulls || !model.nulls?.length) return []
    const rig = buildRig(model, pose)
    return model.nulls.filter((n) => n.visible).map((n) => ({ n, at: nullWorld(rig, n, pose) }))
  }, [showNulls, model, pose])
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

  const camState: CameraState = useMemo(() => {
    const base = { width: size.w || 1, height: size.h || 1, scale, yaw, pitch, factor, pan, zoom, anchor, display, place, ortho, fov: eye?.fov, eyeHeight }
    if (!eye) return base
    // the stage's middle sits the perspective distance in front of the eye, along the way the view looks
    const back = perspectiveOf(base) / (scale * factor)
    const [p, y] = [(pitch * Math.PI) / 180, (yaw * Math.PI) / 180]
    const look: Vec3 = [Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y)]
    return { ...base, anchor: [eye.at[0] + look[0] * back, eye.at[1] + look[1] * back, eye.at[2] + look[2] * back] as Vec3 }
  }, [size.w, size.h, scale, yaw, pitch, factor, pan, zoom, anchor, display, place, ortho, eye, eyeHeight])
  const camera = useMemo(() => makeCamera(camState), [camState])
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  const scene = useMemo<BuiltScene>(
    () =>
      buildScene(model, {
        pose,
        selected: picked,
        pickedFaces: meshPick ? { mesh: meshPick.mesh, faces: meshPick.faces } : null,
        wire: shading === 'wire',
        accent: colours.accent,
      }),
    [model, pose, picked, meshPick, shading, colours],
  )
  const ghostScenes = useMemo(
    () =>
      ghostPoses.map((g) =>
        buildScene(model, {
          pose: g.pose,
          selected: EMPTY,
          accent: colours.accent,
          ghost: g.side === 'before' ? [80 / 255, 150 / 255, 1, 0.16] : [1, 150 / 255, 60 / 255, 0.16],
        }),
      ),
    [ghostPoses, model, colours],
  )
  const companionScenes = useMemo(
    () => (companions ?? []).map((c) => buildScene(c, { pose: {}, selected: EMPTY, accent: colours.accent })),
    [companions, colours],
  )
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  /* Zooming keeps the point under the cursor still. A square on the stage
     is projected before and after: its width gives the ratio and its middle
     the fixed point, and the pan makes up the difference. */
  const zoomAnchor = useRef<{ at: { x: number; y: number }; before: { x: number; y: number; w: number }; rect: DOMRect } | null>(null)
  const probeOf = (s: CameraState) => {
    const a = stagePoint(s, [0, 0, 0])
    const b = stagePoint(s, [100, 0, 0])
    return { x: a.x, y: a.y, w: Math.hypot(b.x - a.x, b.y - a.y) }
  }
  const camStateRef = useRef(camState)
  camStateRef.current = camState

  const zoomAt = useCallback((mul: number, at?: { x: number; y: number }) => {
    const rect = root.current?.getBoundingClientRect()
    if (at && rect) zoomAnchor.current = { at, before: probeOf(camStateRef.current), rect }
    setFactor((f) => clampZoom(f * mul))
  }, [])

  useLayoutEffect(() => {
    const pending = zoomAnchor.current
    zoomAnchor.current = null
    if (!pending) return
    const after = probeOf(camState)
    const k = after.w / pending.before.w
    if (!Number.isFinite(k) || Math.abs(k - 1) < 1e-4) return
    // o1 = C + k(o0 - C) solved for the fixed point C
    const cx = (after.x - k * pending.before.x) / (1 - k)
    const cy = (after.y - k * pending.before.y) / (1 - k)
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return
    const ax = pending.at.x - pending.rect.left
    const ay = pending.at.y - pending.rect.top
    setPan((prev) => ({
      x: clampPan(prev.x + (ax - cx) * (1 - k)),
      y: clampPan(prev.y + (ay - cy) * (1 - k)),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factor])

  const nudge = useCallback((mul: number) => zoomAt(mul), [zoomAt])

  /* ---------------- drawing ---------------- */

  const animated = useMemo(() => hasAnimatedTextures(model), [model])
  const draw = useCallback(() => {
    const c = canvas.current
    if (!c || !size.w || !size.h) return
    const w = Math.round(size.w * size.dpr)
    const h = Math.round(size.h * size.dpr)
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    drawView(c, {
      camera,
      scene,
      ghosts: ghostScenes,
      companions: companionScenes,
      grid: grid ? { size: 16 * 2.6, cell: 4, at: anchor, line: colours.grid, border: colours.border } : null,
      frames: animated ? textureFrames(model, performance.now() / 1000, textureFrame) : undefined,
      dpr: size.dpr,
    })
  }, [camera, scene, ghostScenes, companionScenes, grid, anchor, colours, size, animated, model, textureFrame])
  const drawRef = useRef(draw)
  drawRef.current = draw
  useLayoutEffect(() => draw(), [draw])
  useEffect(() => onTextureReady(() => drawRef.current()), [])
  // animated textures play on the game's clock, twenty ticks a second; reduced motion holds their first frame
  useEffect(() => {
    if (!animated || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let last = -1
    const tick = (now: number) => {
      const t = Math.floor(now / 50)
      if (t !== last) {
        last = t
        drawRef.current()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animated])

  /* ---------------- picking ---------------- */

  const hitAt = useCallback((clientX: number, clientY: number): Hit | null => {
    const r = root.current?.getBoundingClientRect()
    if (!r) return null
    return pickAt(cameraRef.current, sceneRef.current.picks, clientX - r.left, clientY - r.top)
  }, [])

  /** A cube hit as the face's own 0..1, from its UV rectangle's top left, as painting takes it. */
  const cubeFaceUv = (hit: Hit): [number, number] | null => {
    const cube = model.cubes.find((c) => c.id === hit.tri.id)
    if (!cube) return null
    const [x1, y1, x2, y2] = cube.faces[hit.tri.face as FaceKey].uv
    const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)]
    const [ay, by] = [Math.min(y1, y2), Math.max(y1, y2)]
    if (bx === ax || by === ay) return null
    const u = (hit.uv[0] - ax) / (bx - ax)
    const v = (hit.uv[1] - ay) / (by - ay)
    return [Math.min(0.9999, Math.max(0, u)), Math.min(0.9999, Math.max(0, v))]
  }

  const paintHit = (hit: Hit, phase: 'down' | 'move'): boolean => {
    if (hit.tri.kind === 'cube' && onPaint) {
      const uv = cubeFaceUv(hit)
      if (uv) onPaint(hit.tri.id, hit.tri.face as FaceKey, uv[0], uv[1], phase)
      return true
    }
    if (hit.tri.kind === 'mesh' && onPaintMesh) {
      onPaintMesh(hit.tri.id, hit.tri.face, hit.uv[0], hit.uv[1], phase)
      return true
    }
    return false
  }

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
      const hit = e.button === 0 && !e.altKey ? hitAt(e.clientX, e.clientY) : null
      press.current = { x: e.clientX, y: e.clientY, empty: !hit }
      if (hit) {
        // painting, and a mesh's face picking, take the press for themselves
        if (paintHit(hit, 'down')) {
          stroke.current = { kind: hit.tri.kind, id: hit.tri.id, face: hit.tri.face }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          return
        }
        if (hit.tri.kind === 'mesh' && meshPick && meshPick.mesh === hit.tri.id) {
          if (meshPick.onFacePoint) {
            meshPick.onFacePoint(hit.tri.face, hit.local)
            return
          }
          if (meshPick.onFace) {
            meshPick.onFace(hit.tri.face, mods)
            return
          }
        }
        onSelect?.(hit.tri.id, mods)
      }
      if (!orbit) return

      /* Ctrl+drag on empty space, or a drag after B, draws a selection box.
         Shift adds to the selection. */
      if (onBoxSelect && e.button === 0 && (boxArmed.current || ((e.ctrlKey || e.metaKey) && !hit))) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orbit, yaw, pitch, factor, pan, onBoxSelect, onSelect, onPaint, onPaintMesh, meshPick, hitAt, model],
  )

  /* the pinch handler needs the live factor without re-subscribing on every step */
  const factorRef = useRef(factor)
  factorRef.current = factor

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = stroke.current
    if (s) {
      if (e.buttons !== 1) return
      // a stroke stays on the face it started on, as it did when each face was its own element
      const hit = hitAt(e.clientX, e.clientY)
      if (hit && hit.tri.kind === s.kind && hit.tri.id === s.id && hit.tri.face === s.face) paintHit(hit, 'move')
      return
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomAt, hitAt, onPaint, onPaintMesh, model])

  /* ---------------- what is on screen where ---------------- */

  /** Each face's box on screen, for the hook layer tests and tools find faces by, and for box select. */
  const hooks = useMemo(() => {
    const rect = (pts: Vec3[]) => {
      const s = pts.map((p) => camera.project(p))
      if (s.some((q) => q.w <= 0)) return null
      const xs = s.map((q) => q.x)
      const ys = s.map((q) => q.y)
      const left = Math.min(...xs)
      const top = Math.min(...ys)
      return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
    }
    return scene.outlines.map((o) => ({ ...o, rect: rect(o.points) }))
  }, [scene, camera])

  const endDrag = useCallback((e: React.PointerEvent) => {
    stroke.current = null
    const m = marquee.current
    if (m && onBoxSelect && root.current) {
      marquee.current = null
      const r = root.current.getBoundingClientRect()
      const x1 = e.clientX - r.left
      const y1 = e.clientY - r.top
      const [lx, hx] = [Math.min(m.x, x1), Math.max(m.x, x1)]
      const [ly, hy] = [Math.min(m.y, y1), Math.max(m.y, y1)]
      // with a vertex layer that takes boxes, the box picks its dots instead of cubes
      const layer = vertexLayer.current
      if (layer?.onBox) {
        const inside = vertexAtRef.current.flatMap((p, i) => (p[0] >= lx && p[0] <= hx && p[1] >= ly && p[1] <= hy ? [i] : []))
        setBox(null)
        layer.onBox(inside, m.add)
        return
      }
      // a cube is in when the middle of its drawn box is inside the marquee
      const boxes = new Map<string, { l: number; t: number; r: number; b: number }>()
      for (const h of hooksRef.current) {
        if (h.kind !== 'cube' || !h.rect) continue
        const b = boxes.get(h.id) ?? { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity }
        boxes.set(h.id, { l: Math.min(b.l, h.rect.left), t: Math.min(b.t, h.rect.top), r: Math.max(b.r, h.rect.left + h.rect.width), b: Math.max(b.b, h.rect.top + h.rect.height) })
      }
      const ids = [...boxes.entries()].filter(([, b]) => {
        const cx = (b.l + b.r) / 2
        const cy = (b.t + b.b) / 2
        return cx >= lx && cx <= hx && cy >= ly && cy <= hy
      }).map(([id]) => id)
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

  /* The gizmo's anchor on screen and one unit along each world axis, from the camera. */
  const measure = useCallback((): Basis | null => {
    if (!gizmoRef.current) return null
    const cam = cameraRef.current
    const a = gizmoRef.current.anchor
    const c = cam.project(a)
    const per = (i: 0 | 1 | 2): [number, number] => {
      const p: Vec3 = [...a]
      p[i] += PROBE
      const q = cam.project(p)
      return [(q.x - c.x) / PROBE, (q.y - c.y) / PROBE]
    }
    return { c: [c.x, c.y], s: [per(0), per(1), per(2)] }
  }, [])
  const gizmoRef = useRef(gizmo)
  gizmoRef.current = gizmo
  // the view handle below is made before `measure` changes, so it reaches it through this
  const measureRef = useRef(measure)
  measureRef.current = measure

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
      basis: () => measureRef.current(),
    }),
    [scale, yaw, pitch],
  )

  /* A grab held to an axis draws that axis through the anchor, across the view, as Blender does. */
  const guideLine = useMemo(() => {
    if (guide === null || !gizmo) return null
    const b = measure()
    if (!b) return null
    const [dx, dy] = b.s[guide]
    const len = Math.hypot(dx, dy) || 1
    const far = 4000 / len
    return [b.c[0] - dx * far, b.c[1] - dy * far, b.c[0] + dx * far, b.c[1] + dy * far] as [number, number, number, number]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide, gizmo, camera, measure])

  /* the corners for vertex snap, projected by the same camera */
  const vertexAt = useMemo<Array<[number, number]>>(
    () =>
      (vertices?.points ?? []).map((p) => {
        const q = camera.project(p)
        return q.w > 0 ? [q.x, q.y] : [-99, -99]
      }),
    [vertices, camera],
  )
  // the box select reads these when it ends, without re-making its handler
  const vertexAtRef = useRef(vertexAt)
  vertexAtRef.current = vertexAt
  const vertexLayer = useRef(vertices)
  vertexLayer.current = vertices
  const hooksRef = useRef(hooks)
  hooksRef.current = hooks

  const navEnds = useMemo(() => {
    const m = new DOMMatrix(`rotateX(${pitch}deg) rotateY(${yaw}deg)`)
    return NAV_ENDS.map((end) => {
      const v: [number, number, number] = [0, 0, 0]
      v[end.axis] = end.sign
      const p = m.transformPoint(new DOMPoint(v[0], -v[1], v[2], 0))
      return { ...end, x: p.x, y: p.y, z: p.z }
    }).sort((a, b) => a.z - b.z)
  }, [yaw, pitch])

  const at2 = (p: Vec3) => {
    const q = camera.project(p)
    return { left: q.x, top: q.y }
  }

  // the hook layer, grouped as the bone tree was, so a bone's cubes can be found under it
  const cubeHooks = new Map<string, typeof hooks>()
  for (const h of hooks) if (h.kind === 'cube') cubeHooks.set(h.id, [...(cubeHooks.get(h.id) ?? []), h])
  const boneName = new Map<string, string>()
  const nameWalk = (bs: Bone[]) => bs.forEach((b) => (boneName.set(b.id, b.name), nameWalk(b.children.flatMap((c) => (c.kind === 'bone' ? [c.bone] : [])))))
  nameWalk(model.bones)
  const byBone = new Map<string, string[]>()
  for (const [id, hs] of cubeHooks) {
    const bone = hs[0].bone ?? ''
    byBone.set(bone, [...(byBone.get(bone) ?? []), id])
  }
  const union = (hs: typeof hooks) => {
    const rs = hs.flatMap((h) => (h.rect ? [h.rect] : []))
    if (!rs.length) return undefined
    const l = Math.min(...rs.map((r) => r.left))
    const t = Math.min(...rs.map((r) => r.top))
    return { left: l, top: t, width: Math.max(...rs.map((r) => r.left + r.width)) - l, height: Math.max(...rs.map((r) => r.top + r.height)) - t }
  }

  return (
    <div
      ref={root}
      className={`scene3d${spin ? ' scene3d--spin' : ''}${ortho ? ' scene3d--ortho' : ''} ${className}`}
      style={{ cursor: onPaint ? 'crosshair' : orbit ? 'grab' : undefined }}
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
      <canvas ref={canvas} className="scene3d__canvas" aria-hidden="true" />
      {noGl ? <p className="scene3d__nogl">This browser can't draw the model: it has no WebGL 2.</p> : null}

      {/* where each face is on screen: no pointer events, nothing drawn; tools and tests find faces by it */}
      <div className="scene3d__hooks" aria-hidden="true">
        {[...byBone.entries()].map(([bone, ids]) => (
          <div key={bone || 'root'} className="model-group" data-bone={boneName.get(bone)}>
            {ids.map((id) => {
              const hs = cubeHooks.get(id)!
              const u = union(hs)
              return (
                <div key={id} className={`model-cube${picked.has(id) ? ' model-cube--selected' : ''}`} data-cube={id} style={u}>
                  {hs.map((h) =>
                    h.rect && u ? (
                      <div
                        key={h.face}
                        className="model-face"
                        data-face={h.face}
                        style={{ left: h.rect.left - u.left, top: h.rect.top - u.top, width: h.rect.width, height: h.rect.height }}
                      />
                    ) : null,
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {hooks
          .filter((h) => h.kind === 'mesh' && h.rect)
          .map((h, i) => (
            <div
              key={`${h.id}:${h.face}:${i}`}
              className={`model-mface${h.tri ? ' model-mface--tri' : ''}${h.picked ? ' model-mface--picked' : ''}`}
              data-mesh={h.id}
              data-mface={h.face}
              style={h.rect!}
            />
          ))}
        {ghostPoses.map((g) => (
          <div key={`ghost${g.time}`} className={`model-ghost model-ghost--${g.side}`} />
        ))}
      </div>

      {nullMarks.map(({ n, at }) => (
        <div
          key={n.id}
          className={`model-null${picked.has(n.id) ? ' model-null--selected' : ''}${n.ikTarget ? ' model-null--ik' : ''}`}
          data-null={n.id}
          style={at2(at)}
          title={n.ikTarget ? `${n.name} (IK target)` : n.name}
          onPointerDown={
            onSelect
              ? (e) => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  onSelect(n.id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })
                }
              : undefined
          }
        >
          <span />
        </div>
      ))}

      {gizmo && onGizmo ? <Gizmo spec={gizmo} measure={measure} step={snapStep} onGizmo={onGizmo} /> : null}
      {guideLine && guide !== null ? (
        <svg className={`scene3d__guide scene3d__guide--${'xyz'[guide]}`} aria-hidden="true">
          <line x1={guideLine[0]} y1={guideLine[1]} x2={guideLine[2]} y2={guideLine[3]} />
        </svg>
      ) : null}

      {vertices?.edges && vertexAt.length >= vertices.points.length ? (
        <svg className="scene3d__edges" aria-label="Edges">
          {vertices.edges.map(([a, b], i) => {
            const p = vertexAt[a]
            const q = vertexAt[b]
            if (!p || !q) return null
            return (
              <g key={i} className={`scene3d__edge${vertices.edgeOwn?.[i] ? ' scene3d__edge--own' : ''}`}>
                <line className="scene3d__edge-line" x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />
                <line
                  className="scene3d__edge-hit"
                  data-edge={i}
                  x1={p[0]}
                  y1={p[1]}
                  x2={q[0]}
                  y2={q[1]}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    // how far along the edge the click is, on screen
                    const r = root.current!.getBoundingClientRect()
                    const c = [e.clientX - r.left, e.clientY - r.top]
                    const d = [q[0] - p[0], q[1] - p[1]]
                    const len = d[0] * d[0] + d[1] * d[1] || 1
                    const t = Math.max(0, Math.min(1, ((c[0] - p[0]) * d[0] + (c[1] - p[1]) * d[1]) / len))
                    vertices.onPickEdge?.(i, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey }, t)
                  }}
                />
              </g>
            )
          })}
          {vertices.marks?.length
            ? (() => {
                const at = vertices.marks.flatMap((m) => {
                  if ('point' in m) return vertexAt[m.point] ? [vertexAt[m.point]] : []
                  const [a, b] = vertices.edges![m.edge] ?? []
                  const p = vertexAt[a]
                  const q = vertexAt[b]
                  return p && q ? [[p[0] + (q[0] - p[0]) * m.t, p[1] + (q[1] - p[1]) * m.t] as [number, number]] : []
                })
                return (
                  <g className="scene3d__knife">
                    <polyline points={at.map((p) => p.join(',')).join(' ')} />
                    {at.map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r={4} />
                    ))}
                  </g>
                )
              })()
            : null}
        </svg>
      ) : null}

      {vertices && !vertices.hideDots
        ? vertexAt.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`scene3d__vertex${vertices.own[i] ? ' scene3d__vertex--own' : ''}`}
              style={{ left: p[0], top: p[1] }}
              aria-label={vertices.own[i] ? 'Corner of the selection' : 'Corner to snap to'}
              onPointerDown={(e) => {
                e.stopPropagation()
                vertices.onPick(i, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })
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
