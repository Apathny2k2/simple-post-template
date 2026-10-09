/* Paint mode's middle: the texture sheet, large, as the Studio design draws
   it. The selected cube's faces are outlined and labelled, the face being
   painted is lit, and other cubes' faces are dashed. Strokes go to the
   editor in UV units; the editor turns them into the texture's pixels. */

import { useEffect, useRef, useState } from 'react'
import { FACES } from '../../lib/model'
import type { Cube, FaceKey, Mesh, Model, Texture } from '../../lib/model'
import { faceOrder } from '../../lib/mesh'
import { faceBounds } from '../../lib/texture'
import { Icon } from '../../lib/icons'

const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]

export function PaintSheet({
  model,
  texture,
  onTexture,
  cube,
  mesh,
  face,
  onPaint,
  onHover,
}: {
  model: Model
  texture: Texture | null
  onTexture: (id: string) => void
  cube: Cube | null
  /** a selected mesh, whose faces are outlined on the sheet */
  mesh?: Mesh | null
  face: FaceKey
  onPaint: (u: number, v: number, phase: 'down' | 'move') => void
  /** the point under the pointer, in UV units, or null when it leaves */
  onHover: (at: [number, number] | null) => void
}) {
  const { width, height } = model.resolution
  const frame = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number | null>(null)

  // the first zoom fits the sheet to the frame, in whole steps so texels stay square
  useEffect(() => {
    if (zoom !== null || !frame.current) return
    const r = frame.current.getBoundingClientRect()
    const fit = Math.min((r.width - 48) / width, (r.height - 48) / height)
    setZoom(ZOOMS.filter((z) => z <= fit).pop() ?? 1)
  }, [zoom, width, height])

  const z = zoom ?? 1
  const step = (dir: 1 | -1) => {
    const i = ZOOMS.indexOf(z)
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + dir))]
    setZoom(next)
  }

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((cur) => {
        const c = cur ?? 1
        const i = ZOOMS.indexOf(c)
        return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + (e.deltaY < 0 ? 1 : -1)))]
      })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  const at = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = sheet.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height]
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const label: Record<FaceKey, string> = { north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down' }

  const others = model.cubes.flatMap((c) =>
    c.id === cube?.id
      ? []
      : FACES.filter((k) => !texture || c.faces[k].texture === texture.id).map((k) => ({ key: `${c.id}:${k}`, r: faceBounds(c.faces[k].uv) })),
  )

  return (
    <div className="psheet">
      <header className="psheet__bar">
        <span className="psheet__title">
          Sheet{' '}
          {model.textures.length > 1 && texture ? (
            <select className="psheet__select" aria-label="Texture to paint" value={texture.id} onChange={(e) => onTexture(e.target.value)}>
              {model.textures.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <b>{texture?.name ?? 'no texture'}</b>
          )}{' '}
          {'·'} {texture ? `${texture.width} × ${texture.height}` : `${width} × ${height}`}
        </span>
        <span className="psheet__zoom" role="group" aria-label="Sheet zoom">
          <button aria-label="Zoom out" onClick={() => step(-1)} disabled={z <= ZOOMS[0]}>
            <Icon name="minus" size={13} />
          </button>
          <span>{Math.round(z * 100)}%</span>
          <button aria-label="Zoom in" onClick={() => step(1)} disabled={z >= ZOOMS[ZOOMS.length - 1]}>
            <Icon name="plus" size={13} />
          </button>
        </span>
      </header>

      <div className="psheet__frame" ref={frame}>
        <div
          ref={sheet}
          className={`psheet__sheet${z >= 6 ? ' psheet__sheet--grid' : ''}`}
          style={{
            width: width * z,
            height: height * z,
            ['--texel' as string]: `${z}px`,
            ...(texture?.source ? { backgroundImage: `url(${texture.source})` } : {}),
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            const [u, v] = at(e)
            onPaint(u, v, 'down')
          }}
          onPointerMove={(e) => {
            const [u, v] = at(e)
            onHover(u >= 0 && v >= 0 && u < width && v < height ? [u, v] : null)
            if (e.buttons === 1) onPaint(u, v, 'move')
          }}
          onPointerLeave={() => onHover(null)}
        >
          {others.map((o) =>
            o.r[2] > o.r[0] && o.r[3] > o.r[1] ? (
              <span key={o.key} className="psheet__other" style={{ left: pct(o.r[0], width), top: pct(o.r[1], height), width: pct(o.r[2] - o.r[0], width), height: pct(o.r[3] - o.r[1], height) }} />
            ) : null,
          )}
          {cube
            ? FACES.map((k) => {
                const r = faceBounds(cube.faces[k].uv)
                if (r[2] <= r[0] || r[3] <= r[1]) return null
                if (texture && cube.faces[k].texture !== texture.id) return null
                return (
                  <span
                    key={k}
                    data-face={k}
                    className={`psheet__face${k === face ? ' psheet__face--active' : ''}`}
                    style={{ left: pct(r[0], width), top: pct(r[1], height), width: pct(r[2] - r[0], width), height: pct(r[3] - r[1], height) }}
                  >
                    <span className="psheet__tag">{k === face ? `${cube.name} · ${label[k]}` : label[k]}</span>
                  </span>
                )
              })
            : null}
          {mesh ? (
            <svg className="psheet__mesh" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
              {Object.entries(mesh.faces)
                .filter(([, f]) => !texture || f.texture === texture.id)
                .map(([k, f]) => (
                  <polygon key={k} points={faceOrder(mesh, f).map((v) => (f.uv[v] ?? [0, 0]).join(',')).join(' ')} />
                ))}
            </svg>
          ) : null}
        </div>
      </div>

      <footer className="psheet__foot">
        {mesh ? (
          <>
            Painting on <b>{mesh.name}</b>, a mesh: its faces are outlined. Ctrl + wheel zooms.
          </>
        ) : cube ? (
          <>
            Painting on <b>{cube.name}</b> {'·'} <b>{face}</b>. The other faces of the {cube.name} are outlined. Ctrl + wheel zooms.
          </>
        ) : (
          'Pick a cube in the outliner, or click one of its faces here, to paint it.'
        )}
      </footer>
    </div>
  )
}
