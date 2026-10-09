/* Plain coloured boxes (the Projects tiles, and cards with no model behind
   them), drawn by the same WebGL viewport as a model: each box becomes a
   cube, coloured from a strip of flat swatches. */

import { useMemo } from 'react'
import type { Cube, FaceKey, Model } from '../lib/model'
import { FACES } from '../lib/model'
import { ModelView } from './ModelView'

export type Box = {
  /** centre of the box, in scene units. +y is up. */
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  /** [top, side, front] */
  colors: [string, string, string]
  selected?: boolean
}

type Props = {
  boxes: Box[]
  /** continuous turntable spin */
  spin?: boolean
  grid?: boolean
  /** drag to orbit */
  orbit?: boolean
  initialYaw?: number
  initialPitch?: number
  /** the stage pushed along screen z, in pixels; negative moves it away */
  zoom?: number
  className?: string
}

/** The boxes as a model: one cube each, its faces painted from a strip of the colours used. */
export function boxesModel(boxes: Box[]): Model {
  const colours = [...new Set(boxes.flatMap((b) => b.colors))]
  const c = document.createElement('canvas')
  c.width = Math.max(1, colours.length)
  c.height = 1
  const x = c.getContext('2d')
  colours.forEach((col, i) => {
    if (!x) return
    x.fillStyle = col
    x.fillRect(i, 0, 1, 1)
  })
  const uv = (col: string): [number, number, number, number] => {
    const i = colours.indexOf(col)
    return [i + 0.25, 0.25, i + 0.75, 0.75]
  }
  const role: Record<FaceKey, 0 | 1 | 2> = { up: 0, down: 0, east: 1, west: 1, north: 2, south: 2 }
  const cubes: Cube[] = boxes.map((b, i) => ({
    id: `box${i}`,
    name: `box ${i + 1}`,
    from: [b.x - b.w / 2, b.y - b.h / 2, b.z - b.d / 2],
    to: [b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2],
    origin: [b.x, b.y, b.z],
    rotation: [0, 0, 0],
    faces: Object.fromEntries(FACES.map((k) => [k, { uv: uv(b.colors[role[k]]), texture: 'swatches' }])) as Cube['faces'],
    inflate: 0,
    boxUv: false,
    visible: true,
    locked: false,
  }))
  return {
    name: 'boxes',
    kind: 'items',
    resolution: { width: c.width, height: 1 },
    bones: [{ id: 'boxes', name: 'boxes', origin: [0, 0, 0], rotation: [0, 0, 0], visible: true, locked: false, children: cubes.map((cube) => ({ kind: 'cube' as const, id: cube.id })) }],
    cubes,
    textures: [{ id: 'swatches', name: 'swatches.png', width: c.width, height: 1, uvWidth: c.width, uvHeight: 1, source: c.toDataURL('image/png') }],
    clips: [],
  }
}

export function Model3D({ boxes, spin, grid, orbit = false, initialYaw = -32, initialPitch = -20, zoom = 0, className = '' }: Props) {
  // rebuilt only when the boxes change, so a spinning tile doesn't repaint its swatches
  const key = JSON.stringify(boxes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => boxesModel(boxes), [key])
  const selection = useMemo(() => boxes.flatMap((b, i) => (b.selected ? [`box${i}`] : [])), [key])
  return (
    <ModelView
      model={model}
      scale={1}
      grid={!!grid}
      orbit={orbit}
      zoomable={false}
      spin={spin}
      initialYaw={initialYaw}
      initialPitch={initialPitch}
      zoom={zoom}
      anchorOn={[0, 0, 0]}
      selection={selection}
      className={className}
    />
  )
}

/* ---- stock models for placeholder art ---- */

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
