/* The UV panel for a selected mesh. Each face is a polygon on the sheet; the
   picked ones (the same pick as Face mode in the viewport) are lit and show
   their corners. Dragging a face moves every picked face; dragging a corner
   moves that corner of that face only. Unwrap lays the picked faces out
   flat again, packed into free room. */

import { useRef, useState } from 'react'
import type { Mesh, Model, Texture } from '../../lib/model'
import { faceOrder, faceCentre, moveFacesUvBy, moveUvCorner, uvBoundsOf } from '../../lib/mesh'
import { Icon } from '../../lib/icons'

type Mods = { shift: boolean; ctrl: boolean }

const snap = (v: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) =>
  e.ctrlKey || e.metaKey ? Math.round(v * 100) / 100 : e.shiftKey ? Math.round(v * 2) / 2 : Math.round(v)

export function MeshUvPanel({
  model,
  mesh,
  picked,
  onPick,
  onDrag,
  onUnwrap,
  onTurn,
  onMirror,
}: {
  model: Model
  mesh: Mesh
  picked: string[]
  onPick: (face: string, mods: Mods) => void
  /** one undo step per drag: `set` replaces the mesh with each new version */
  onDrag: { begin: (label: string) => void; set: (m: Mesh) => void; end: () => void }
  /** joined keeps faces that share edges together on the sheet; apart lays each face out alone */
  onUnwrap: (joined: boolean) => void
  onTurn: () => void
  onMirror: (axis: 'u' | 'v') => void
}) {
  const { width, height } = model.resolution
  const sheet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; start: Mesh; faces: string[]; corner: [string, string] | null; moved: boolean } | null>(null)
  const [zoom, setZoom] = useState(1)
  const locked = mesh.locked
  const live = picked.filter((k) => mesh.faces[k])
  const shown = live.length ? live : Object.keys(mesh.faces)
  const textureId = mesh.faces[shown[0]]?.texture ?? null
  const texture: Texture | null = model.textures.find((t) => t.id === textureId) ?? null

  const begin = (e: React.PointerEvent, face: string, corner: string | null) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
    // a click on an unpicked face picks it; a drag on a picked face takes the whole pick along
    let faces = live
    if (!live.includes(face) || mods.shift || mods.ctrl) {
      onPick(face, mods)
      faces = mods.shift || mods.ctrl ? (live.includes(face) ? live.filter((k) => k !== face) : [...live, face]) : [face]
    }
    if (locked || !faces.includes(face)) return
    sheet.current?.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: mesh, faces, corner: corner ? [face, corner] : null, moved: false }
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !sheet.current) return
    const r = sheet.current.getBoundingClientRect()
    let du = snap(((e.clientX - d.x) / r.width) * width, e)
    let dv = snap(((e.clientY - d.y) / r.height) * height, e)
    if (!d.moved) {
      if (!du && !dv) return
      d.moved = true
      onDrag.begin(d.corner ? 'move UV corner' : 'move UV')
    }
    if (d.corner) {
      onDrag.set(moveUvCorner(d.start, d.corner[0], d.corner[1], du, dv))
      return
    }
    // the pick stops at the sheet's edges
    const [u0, v0, u1, v1] = uvBoundsOf(d.start, d.faces)
    du = Math.max(-u0, Math.min(width - u1, du))
    dv = Math.max(-v0, Math.min(height - v1, dv))
    onDrag.set(moveFacesUvBy(d.start, d.faces, du, dv))
  }

  const end = () => {
    if (drag.current?.moved) onDrag.end()
    drag.current = null
  }

  const pickedSet = new Set(live)
  const bounds = live.length ? uvBoundsOf(mesh, live) : null

  return (
    <>
      <div className="uv-head">
        <span className="uv-head__texture">
          <span>{live.length ? `${live.length} ${live.length === 1 ? 'face' : 'faces'} picked` : `${mesh.name}, every face`}</span>
        </span>
      </div>

      <div className="uv-frame">
        <div className="uv-zoom" role="group" aria-label="UV sheet zoom">
          <button aria-label="Zoom the UV sheet out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z / 1.5))}>
            <Icon name="minus" size={12} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom the UV sheet in" disabled={zoom >= 8} onClick={() => setZoom((z) => Math.min(8, z * 1.5))}>
            <Icon name="plus" size={12} />
          </button>
        </div>
        <div className="uv-scroll">
          <div
            ref={sheet}
            className="uv uv--mesh"
            style={{
              width: `${zoom * 100}%`,
              aspectRatio: `${width} / ${height}`,
              ...(texture?.source ? { backgroundImage: `url(${texture.source})`, backgroundSize: '100% 100%', imageRendering: 'pixelated' } : {}),
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <svg className="uv-mesh" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Mesh faces on the sheet">
              {Object.entries(mesh.faces).map(([k, f]) => {
                const order = faceOrder(mesh, f)
                return (
                  <polygon
                    key={k}
                    data-mface={k}
                    className={`uv-mesh__face${pickedSet.has(k) ? ' uv-mesh__face--picked' : ''}`}
                    points={order.map((v) => (f.uv[v] ?? [0, 0]).join(',')).join(' ')}
                    onPointerDown={(e) => begin(e, k, null)}
                  >
                    <title>{`Face at ${faceCentre(mesh, f).map((n) => Math.round(n * 10) / 10).join(', ')}${locked ? '' : '. Drag to move it.'}`}</title>
                  </polygon>
                )
              })}
            </svg>
            {/* corner handles as HTML so they keep their size at any zoom */}
            {locked
              ? null
              : live.flatMap((k) =>
                  faceOrder(mesh, mesh.faces[k]).map((v) => {
                    const p = mesh.faces[k].uv[v] ?? [0, 0]
                    return (
                      <span
                        key={`${k}:${v}`}
                        className="uv-mesh__corner"
                        data-corner={`${k}:${v}`}
                        style={{ left: `${(p[0] / width) * 100}%`, top: `${(p[1] / height) * 100}%` }}
                        onPointerDown={(e) => begin(e, k, v)}
                      />
                    )
                  }),
                )}
            <span className="uv__ruler" style={{ left: 4, bottom: 3 }}>
              0,0
            </span>
            <span className="uv__ruler" style={{ right: 4, bottom: 3 }}>
              {width},{height}
            </span>
          </div>
        </div>
      </div>

      {bounds ? (
        <p className="editor-hint">
          From {bounds[0]},{bounds[1]} to {bounds[2]},{bounds[3]}. Drag a face to move the pick, a corner to move that corner. Shift snaps to half texels, Ctrl turns snapping off.
        </p>
      ) : (
        <p className="editor-hint">Click a face here or in the viewport (Face mode, 2) to edit its UVs.</p>
      )}

      <div className="chip-row">
        <button className="chip" disabled={locked} onClick={() => onUnwrap(true)} title="Unfold the faces flat, those that share edges kept together, one texel per unit, in free room on the sheet">
          Unwrap
        </button>
        <button className="chip" disabled={locked} onClick={() => onUnwrap(false)} title="Lay each face out flat on its own, in free room on the sheet">
          Each face apart
        </button>
        <button className="chip" disabled={locked || !live.length} onClick={onTurn} title="Turn the picked faces' UVs a quarter clockwise">
          Turn
        </button>
        <button className="chip" disabled={locked || !live.length} onClick={() => onMirror('u')} title="Mirror the picked faces' UVs left to right">
          Mirror X
        </button>
        <button className="chip" disabled={locked || !live.length} onClick={() => onMirror('v')} title="Mirror the picked faces' UVs top to bottom">
          Mirror Y
        </button>
      </div>
    </>
  )
}
