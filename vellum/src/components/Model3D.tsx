import { useCallback, useRef, useState } from 'react'
import './Model3D.css'

export type Box = {
  /** centre of the box, in scene units. +y is up. */
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  /** [top, side, front] - a flat three-tone shade, no lighting pass */
  colors: [string, string, string]
  selected?: boolean
}

function Box3D({ box }: { box: Box }) {
  const { x, y, z, w, h, d, colors, selected } = box
  const [top, side, front] = colors

  const face = (
    key: string,
    fw: number,
    fh: number,
    transform: string,
    background: string,
    shade: number,
  ) => (
    <div
      key={key}
      className="box3d__face"
      style={{
        width: fw,
        height: fh,
        marginLeft: -fw / 2,
        marginTop: -fh / 2,
        transform,
        background,
        filter: `brightness(${shade})`,
      }}
    />
  )

  return (
    <div
      className={`box3d${selected ? ' box3d--selected' : ''}`}
      style={{ transform: `translate3d(${x}px, ${-y}px, ${z}px)` }}
    >
      {face('front', w, h, `translateZ(${d / 2}px)`, front, 1)}
      {face('back', w, h, `rotateY(180deg) translateZ(${d / 2}px)`, front, 0.72)}
      {face('right', d, h, `rotateY(90deg) translateZ(${w / 2}px)`, side, 0.88)}
      {face('left', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, side, 0.78)}
      {face('top', w, d, `rotateX(90deg) translateZ(${h / 2}px)`, top, 1.12)}
      {face('bottom', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, top, 0.6)}
    </div>
  )
}

type Props = {
  boxes: Box[]
  /** free spin, used by the library cards on hover */
  spin?: boolean
  grid?: boolean
  gridSize?: number
  cell?: number
  /** orbit with the pointer, used by the editor viewport */
  orbit?: boolean
  initialYaw?: number
  initialPitch?: number
  zoom?: number
  className?: string
}

export function Model3D({
  boxes,
  spin,
  grid,
  gridSize = 320,
  cell = 24,
  orbit,
  initialYaw = -32,
  initialPitch = -20,
  zoom = 0,
  className = '',
}: Props) {
  const [yaw, setYaw] = useState(initialYaw)
  const [pitch, setPitch] = useState(initialPitch)
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!orbit) return
      drag.current = { x: e.clientX, y: e.clientY, yaw, pitch }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [orbit, yaw, pitch],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = drag.current
    if (!start) return
    setYaw(start.yaw + (e.clientX - start.x) * 0.45)
    setPitch(Math.max(-88, Math.min(88, start.pitch - (e.clientY - start.y) * 0.35)))
  }, [])

  const endDrag = useCallback(() => {
    drag.current = null
  }, [])

  const stageTransform = spin
    ? undefined
    : `translateZ(${zoom}px) rotateX(${pitch}deg) rotateY(${yaw}deg)`

  return (
    <div
      className={`scene3d${spin ? ' scene3d--spin' : ''} ${className}`}
      style={
        {
          '--pitch': `${pitch}deg`,
          '--yaw': `${yaw}deg`,
          '--zoom': `${zoom}px`,
          cursor: orbit ? (drag.current ? 'grabbing' : 'grab') : undefined,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="scene3d__stage" style={{ transform: stageTransform }}>
        {grid ? (
          <div className="scene3d__grid">
            <div
              className="scene3d__grid-plane"
              style={{ width: gridSize, height: gridSize, ['--cell' as string]: `${cell}px` }}
            />
          </div>
        ) : null}
        <div className="scene3d__origin">
          {boxes.map((b, i) => (
            <Box3D key={i} box={b} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- two stock models, so the mock has something to show ---- */

export function lanternModel(palette: [string, string, string], selectedIndex = -1): Box[] {
  const [a, b, c] = palette
  const trim: [string, string, string] = [a, b, c]
  const glass: [string, string, string] = ['#e9dcb2', '#d8c48c', '#c9b072']
  const iron: [string, string, string] = ['#6f7684', '#5a616e', '#474d58']
  const parts: Box[] = [
    { x: 0, y: -46, z: 0, w: 72, h: 14, d: 72, colors: trim },
    { x: 0, y: -4, z: 0, w: 52, h: 70, d: 52, colors: glass },
    { x: -32, y: -4, z: -32, w: 12, h: 70, d: 12, colors: iron },
    { x: 32, y: -4, z: -32, w: 12, h: 70, d: 12, colors: iron },
    { x: -32, y: -4, z: 32, w: 12, h: 70, d: 12, colors: iron },
    { x: 32, y: -4, z: 32, w: 12, h: 70, d: 12, colors: iron },
    { x: 0, y: 38, z: 0, w: 80, h: 14, d: 80, colors: trim },
    { x: 0, y: 52, z: 0, w: 22, h: 16, d: 22, colors: iron },
  ]
  return parts.map((p, i) => ({ ...p, selected: i === selectedIndex }))
}

export function blockModel(palette: [string, string, string]): Box[] {
  const [a, b, c] = palette
  return [
    { x: 0, y: 0, z: 0, w: 84, h: 84, d: 84, colors: [a, b, c] },
    { x: 0, y: 52, z: 0, w: 42, h: 20, d: 42, colors: [b, c, a] },
  ]
}
