/* The transform gizmo drawn over the viewport: move arrows and planes,
   resize handles, rotation rings, the pivot cross and scale handles, in
   Blockbench's colours (X red, Y green, Z blue).

   The scene is CSS 3D, so there is no camera matrix to project with.
   Instead ModelView places four invisible probes in the scene, at the
   anchor and one unit along each world axis, and `measure` reads where the
   browser drew them. That gives the screen position of the anchor and a
   2x3 matrix S taking any world vector to screen pixels near it. Drags are
   solved back through S into world units. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vec3 } from '../lib/model'
import './Gizmo.css'

export type GizmoTool = 'move' | 'resize' | 'rotate' | 'pivot' | 'scale'
export type Handle = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'free' | 'uniform'

export type GizmoSpec = {
  tool: GizmoTool
  /** world position of the gizmo */
  anchor: Vec3
  /** handle directions in world space, unit length: the space toggle picks global or local */
  axes: [Vec3, Vec3, Vec3]
  /** rotation axes for the rings, world space, unit length */
  rings?: [Vec3, Vec3, Vec3]
}

export type GizmoEvent = {
  phase: 'start' | 'move' | 'end'
  tool: GizmoTool
  handle: Handle
  /** resize only: 1 grows `to`, -1 grows `from` */
  side?: 1 | -1
  /** move and pivot: world-space offset since the drag began, snapped */
  delta?: Vec3
  /** resize and scale: units along the handle since the drag began, snapped */
  amount?: number
  /** rotate: degrees about `rings[i]` since the drag began, right-handed. The editor snaps it. */
  angle?: number
  shift: boolean
  ctrl: boolean
}

/** Screen position of the anchor and the screen vector of one world unit along x, y and z. */
export type Basis = { c: [number, number]; s: [[number, number], [number, number], [number, number]] }

const AXES = ['x', 'y', 'z'] as const
/** On-screen length of the longest axis handle, in px. */
const R = 96

type V2 = [number, number]
const v2 = (a: V2, b: V2, k = 1): V2 => [a[0] + b[0] * k, a[1] + b[1] * k]
const len2 = (a: V2) => Math.hypot(a[0], a[1])
const cross2 = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0]
const dot2 = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1]

const project = (b: Basis, v: Vec3): V2 => [
  b.s[0][0] * v[0] + b.s[1][0] * v[1] + b.s[2][0] * v[2],
  b.s[0][1] * v[0] + b.s[1][1] * v[1] + b.s[2][1] * v[2],
]

/** Two unit vectors spanning the plane square to `a`, ordered so u × w = a. */
function planeOf(a: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u0: Vec3 = [a[1] * helper[2] - a[2] * helper[1], a[2] * helper[0] - a[0] * helper[2], a[0] * helper[1] - a[1] * helper[0]]
  const l = Math.hypot(...u0) || 1
  const u: Vec3 = [u0[0] / l, u0[1] / l, u0[2] / l]
  const w: Vec3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]]
  return [u, w]
}

const snapTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

type Drag = {
  pointer: number
  handle: Handle
  side?: 1 | -1
  start: V2
  basis: Basis
  /** rotate: last pointer angle and the unwrapped total */
  phi?: number
  turned?: number
}

export function Gizmo({
  spec,
  measure,
  step,
  onGizmo,
}: {
  spec: GizmoSpec
  measure: () => Basis | null
  /** snap increment in world units; Shift divides it by 4, Ctrl turns it off */
  step: number
  onGizmo: (e: GizmoEvent) => void
}) {
  const [basis, setBasis] = useState<Basis | null>(null)
  const drag = useRef<Drag | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  // follow the scene every frame: the camera, the model and the pose can all move
  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      const b = measure()
      const key = b ? [b.c, ...b.s].flat().map((n) => n.toFixed(1)).join(',') : ''
      if (key !== last) {
        last = key
        setBasis(b)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [measure])

  const emit = useCallback(
    (phase: GizmoEvent['phase'], e: React.PointerEvent | PointerEvent) => {
      const d = drag.current
      if (!d) return
      const shift = e.shiftKey
      const ctrl = e.ctrlKey || e.metaKey
      const stepNow = ctrl ? 0 : shift ? step / 4 : step
      const rect = svg.current!.getBoundingClientRect()
      const p: V2 = [e.clientX - rect.left, e.clientY - rect.top]
      const delta: V2 = [p[0] - d.start[0], p[1] - d.start[1]]
      const b = d.basis
      const base = { phase, tool: spec.tool, handle: d.handle, side: d.side, shift, ctrl }

      if (spec.tool === 'rotate') {
        const i = AXES.indexOf(d.handle as 'x')
        const axis = spec.rings?.[i] ?? spec.axes[i]
        const [u, w] = planeOf(axis)
        const pu = project(b, u)
        const pw = project(b, w)
        const det = cross2(pu, pw)
        const rel: V2 = [p[0] - b.c[0], p[1] - b.c[1]]
        /* Read the pointer's angle in the ring's own plane, so a quarter of
           the ring is a quarter turn however flat it looks. A ring seen
           edge-on can't be unprojected, so there the screen angle is used. */
        const planar = Math.abs(det) > 0.12 * len2(pu) * len2(pw)
        const orient = planar ? 1 : Math.sign(det) || 1
        const phi = planar
          ? Math.atan2(cross2(pu, rel) / det, cross2(rel, pw) / det)
          : Math.atan2(rel[1], rel[0])
        if (phase === 'start') {
          d.phi = phi
          d.turned = 0
        }
        let dphi = phi - (d.phi ?? phi)
        if (dphi > Math.PI) dphi -= 2 * Math.PI
        if (dphi < -Math.PI) dphi += 2 * Math.PI
        d.phi = phi
        d.turned = (d.turned ?? 0) + dphi
        onGizmo({ ...base, angle: (d.turned * orient * 180) / Math.PI })
        return
      }

      if (d.handle === 'free') {
        // the smallest world move that lands under the pointer: in the view plane
        const S = b.s
        const a11 = S[0][0] ** 2 + S[1][0] ** 2 + S[2][0] ** 2
        const a12 = S[0][0] * S[0][1] + S[1][0] * S[1][1] + S[2][0] * S[2][1]
        const a22 = S[0][1] ** 2 + S[1][1] ** 2 + S[2][1] ** 2
        const det = a11 * a22 - a12 * a12
        if (Math.abs(det) < 1e-9) return
        const y0 = (a22 * delta[0] - a12 * delta[1]) / det
        const y1 = (-a12 * delta[0] + a11 * delta[1]) / det
        const t: Vec3 = [0, 1, 2].map((i) => snapTo(S[i][0] * y0 + S[i][1] * y1, stepNow)) as Vec3
        onGizmo({ ...base, delta: t })
        return
      }

      if (d.handle === 'xy' || d.handle === 'xz' || d.handle === 'yz') {
        const ia = AXES.indexOf(d.handle[0] as 'x')
        const ib = AXES.indexOf(d.handle[1] as 'x')
        const qa = project(b, spec.axes[ia])
        const qb = project(b, spec.axes[ib])
        const det = cross2(qa, qb)
        if (Math.abs(det) < 1e-6) return
        const ta = snapTo(cross2(delta, qb) / det, stepNow)
        const tb = snapTo(cross2(qa, delta) / det, stepNow)
        const A = spec.axes[ia]
        const B = spec.axes[ib]
        onGizmo({ ...base, delta: [A[0] * ta + B[0] * tb, A[1] * ta + B[1] * tb, A[2] * ta + B[2] * tb] })
        return
      }

      if (d.handle === 'uniform') {
        // drag right or up to grow
        onGizmo({ ...base, amount: snapTo((delta[0] - delta[1]) / R, stepNow > 0 ? 0.05 : 0) })
        return
      }

      const i = AXES.indexOf(d.handle as 'x')
      const dir = spec.axes[i]
      const q = project(b, dir)
      const l2 = dot2(q, q)
      if (l2 < 1e-6) return
      const along = dot2(delta, q) / l2
      if (spec.tool === 'resize' || spec.tool === 'scale') {
        onGizmo({ ...base, amount: snapTo(along * (d.side ?? 1), stepNow) })
        return
      }
      const t = snapTo(along, stepNow)
      onGizmo({ ...base, delta: [dir[0] * t, dir[1] * t, dir[2] * t] })
    },
    [spec, step, onGizmo],
  )

  const begin = (handle: Handle, side?: 1 | -1) => (e: React.PointerEvent) => {
    if (e.button !== 0 || !basis) return
    e.stopPropagation()
    e.preventDefault()
    const rect = svg.current!.getBoundingClientRect()
    const start: V2 = [e.clientX - rect.left, e.clientY - rect.top]
    drag.current = {
      pointer: e.pointerId,
      handle,
      side,
      start,
      basis,
      phi: Math.atan2(start[1] - basis.c[1], start[0] - basis.c[0]),
      turned: 0,
    }
    svg.current!.setPointerCapture(e.pointerId)
    emit('start', e)
  }

  const onMove = (e: React.PointerEvent) => {
    if (drag.current?.pointer === e.pointerId) emit('move', e)
  }
  const onUp = (e: React.PointerEvent) => {
    if (drag.current?.pointer !== e.pointerId) return
    emit('end', e)
    drag.current = null
  }

  if (!basis) return <svg className="xform" ref={svg} />

  const b = drag.current?.basis ?? basis
  // world units → px, so the gizmo keeps one size on screen at any zoom
  const longest = Math.max(...[0, 1, 2].map((i) => len2(b.s[i] as V2)), 1e-6)
  const g = R / longest
  const c = basis.c
  const q = spec.axes.map((a) => {
    const p = project(b, a)
    return [p[0] * g, p[1] * g] as V2
  })
  const active = drag.current?.handle
  const cls = (h: Handle, extra = '') =>
    `xform__handle xform__handle--${h.length === 1 ? h : h === 'free' || h === 'uniform' ? 'free' : AXES[3 - AXES.indexOf(h[0] as 'x') - AXES.indexOf(h[1] as 'x')]}${active === h ? ' is-active' : ''}${active && active !== h ? ' is-idle' : ''} ${extra}`

  const pt = (p: V2) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  const arrow = (i: number, tool: GizmoTool) => {
    const h = AXES[i]
    const dir = q[i]
    const l = len2(dir)
    // an axis pointing at the viewer can't be dragged along; Blockbench hides it too
    if (l < 14) return null
    const tip = v2(c, dir)
    const unit: V2 = [dir[0] / l, dir[1] / l]
    const nrm: V2 = [-unit[1], unit[0]]
    const head =
      tool === 'scale'
        ? `M${pt(v2(v2(tip, unit, -5), nrm, -5))}h0L${pt(v2(v2(tip, unit, -5), nrm, 5))}L${pt(v2(v2(tip, unit, 5), nrm, 5))}L${pt(v2(v2(tip, unit, 5), nrm, -5))}Z`
        : `M${pt(v2(tip, unit, 6))}L${pt(v2(v2(tip, unit, -9), nrm, 5))}L${pt(v2(v2(tip, unit, -9), nrm, -5))}Z`
    return (
      <g key={h} className={cls(h)} onPointerDown={begin(h, 1)} data-handle={h}>
        <line className="xform__hit" x1={c[0]} y1={c[1]} x2={tip[0]} y2={tip[1]} />
        <line className="xform__stem" x1={c[0]} y1={c[1]} x2={tip[0]} y2={tip[1]} />
        <path className="xform__head" d={head} />
      </g>
    )
  }

  const resizeHandle = (i: number, side: 1 | -1) => {
    const h = AXES[i]
    const dir: V2 = [q[i][0] * side, q[i][1] * side]
    const l = len2(dir)
    if (l < 14) return null
    const tip = v2(c, dir)
    const unit: V2 = [dir[0] / l, dir[1] / l]
    const nrm: V2 = [-unit[1], unit[0]]
    const head = `M${pt(v2(tip, unit, 7))}L${pt(v2(v2(tip, unit, -6), nrm, 6))}L${pt(v2(v2(tip, unit, -6), nrm, -6))}Z`
    return (
      <g key={`${h}${side}`} className={cls(h)} onPointerDown={begin(h, side)} data-handle={`${h}${side > 0 ? '+' : '-'}`}>
        <line className="xform__hit" x1={c[0] + dir[0] * 0.25} y1={c[1] + dir[1] * 0.25} x2={tip[0]} y2={tip[1]} />
        <line className="xform__stem" x1={c[0] + dir[0] * 0.25} y1={c[1] + dir[1] * 0.25} x2={tip[0]} y2={tip[1]} />
        <path className="xform__head" d={head} />
      </g>
    )
  }

  const plane = (a: number, bIdx: number) => {
    const h = `${AXES[a]}${AXES[bIdx]}` as Handle
    const qa = q[a]
    const qb = q[bIdx]
    // a plane seen edge-on is a sliver nobody can grab
    if (Math.abs(cross2(qa, qb)) < 260) return null
    const p1 = v2(v2(c, qa, 0.18), qb, 0.18)
    const p2 = v2(v2(c, qa, 0.38), qb, 0.18)
    const p3 = v2(v2(c, qa, 0.38), qb, 0.38)
    const p4 = v2(v2(c, qa, 0.18), qb, 0.38)
    return (
      <path key={h} className={cls(h, 'xform__plane')} onPointerDown={begin(h)} data-handle={h} d={`M${pt(p1)}L${pt(p2)}L${pt(p3)}L${pt(p4)}Z`} />
    )
  }

  const ring = (i: number) => {
    const h = AXES[i]
    const axis = spec.rings?.[i] ?? spec.axes[i]
    if (axis[0] === 0 && axis[1] === 0 && axis[2] === 0) return null
    const [u, w] = planeOf(axis)
    const pu = project(b, u)
    const pw = project(b, w)
    const ring = Array.from({ length: 73 }, (_, k) => {
      const t = (k / 72) * Math.PI * 2
      return pt([c[0] + g * (Math.cos(t) * pu[0] + Math.sin(t) * pw[0]), c[1] + g * (Math.cos(t) * pu[1] + Math.sin(t) * pw[1])])
    })
    const d = `M${ring.join('L')}`
    return (
      <g key={h} className={cls(h)} onPointerDown={begin(h)} data-handle={h}>
        <path className="xform__hit" d={d} />
        <path className="xform__ring" d={d} />
      </g>
    )
  }

  return (
    <svg className="xform" ref={svg} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-tool={spec.tool}>
      {spec.tool === 'rotate' ? (
        <>
          <circle className="xform__dot" cx={c[0]} cy={c[1]} r={3} />
          {[0, 1, 2].map(ring)}
        </>
      ) : spec.tool === 'resize' ? (
        <>
          {[0, 1, 2].flatMap((i) => [resizeHandle(i, 1), resizeHandle(i, -1)])}
          <circle className="xform__dot" cx={c[0]} cy={c[1]} r={3} />
        </>
      ) : (
        <>
          {spec.tool === 'move' ? [plane(0, 1), plane(0, 2), plane(1, 2)] : null}
          {[0, 1, 2].map((i) => arrow(i, spec.tool))}
          {spec.tool === 'pivot' ? (
            <g className={cls('free', 'xform__pivot')} onPointerDown={begin('free')} data-handle="free">
              <circle className="xform__hit" cx={c[0]} cy={c[1]} r={10} />
              <circle cx={c[0]} cy={c[1]} r={7} />
              <path d={`M${c[0] - 11},${c[1]}H${c[0] + 11}M${c[0]},${c[1] - 11}V${c[1] + 11}`} />
            </g>
          ) : spec.tool === 'scale' ? (
            <rect className={cls('uniform', 'xform__free')} onPointerDown={begin('uniform')} data-handle="uniform" x={c[0] - 6} y={c[1] - 6} width={12} height={12} />
          ) : (
            <circle className={cls('free', 'xform__free')} onPointerDown={begin('free')} data-handle="free" cx={c[0]} cy={c[1]} r={7} />
          )}
        </>
      )}
    </svg>
  )
}
