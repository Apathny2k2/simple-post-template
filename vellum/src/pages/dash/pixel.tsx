import { memo, useMemo } from 'react'
import { layout, textRows, toRuns } from './sprites'
import type { Sprite } from './sprites'

export const PixelArt = memo(function PixelArt({
  sprite,
  scale = 2,
  outline,
  className,
  label,
}: {
  sprite: Sprite
  scale?: number
  outline?: string
  className?: string
  /** Set when the picture carries meaning on its own. */
  label?: string
}) {
  const { w, h, runs } = useMemo(() => layout(sprite, outline), [sprite, outline])
  return (
    <svg
      className={className}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  )
})

/**
 * Numbers drawn like the game draws them: a drop shadow for stack counts,
 * a full outline for the XP level.
 */
export const PixelText = memo(function PixelText({
  text,
  scale = 2,
  color = '#ffffff',
  edge = 'drop',
  edgeColor = '#3f3f3f',
  className,
}: {
  text: string
  scale?: number
  color?: string
  edge?: 'drop' | 'outline' | 'none'
  edgeColor?: string
  className?: string
}) {
  const { w, h, runs } = useMemo(() => {
    const rows = textRows(text, edge === 'outline' ? 2 : 1)
    const tw = rows[0].length
    const ink = { '#': color }
    const shade = { '#': edgeColor }
    if (edge === 'drop') {
      return { w: tw + 1, h: 8, runs: [...toRuns(rows, shade, 1, 1), ...toRuns(rows, ink)] }
    }
    if (edge === 'outline') {
      const ring = [-1, 1].flatMap((d) => [toRuns(rows, shade, 1 + d, 1), toRuns(rows, shade, 1, 1 + d)]).flat()
      return { w: tw + 2, h: 9, runs: [...ring, ...toRuns(rows, ink, 1, 1)] }
    }
    return { w: tw, h: 7, runs: toRuns(rows, ink) }
  }, [text, color, edge, edgeColor])

  return (
    <svg
      className={className}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  )
})
