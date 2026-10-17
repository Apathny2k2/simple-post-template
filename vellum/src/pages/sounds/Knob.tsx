/* A console knob. Drag up or down, scroll, or use the arrow keys (Shift for
   fine steps); double-click to type a value. It is a slider to assistive
   technology. Knobs over a wide range, such as frequency, turn on a log scale. */

import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'

export type KnobProps = {
  label: string
  value: number
  min: number
  max: number
  log?: boolean
  /** values snap to this */
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  color?: string
  disabled?: boolean
  size?: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function Knob({ label, value, min, max, log, step, format, onChange, color, disabled, size = 46 }: KnobProps) {
  const toP = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min))
  const fromP = (p: number) => {
    const v = log ? min * Math.pow(max / min, clamp(p, 0, 1)) : min + (max - min) * clamp(p, 0, 1)
    if (!step) return v
    return clamp(Math.round(v / step) * step, min, max)
  }
  const p = clamp(toP(clamp(value, min, max)), 0, 1)
  const drag = useRef<{ y: number; p: number } | null>(null)
  const [typing, setTyping] = useState(false)
  const text = format ? format(value) : String(Math.round(value * 100) / 100)

  const set = (np: number) => {
    const v = fromP(np)
    if (v !== value) onChange(v)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    drag.current = { y: e.clientY, p }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const span = e.shiftKey ? 800 : 180
    set(drag.current.p + (drag.current.y - e.clientY) / span)
  }
  const onPointerUp = () => (drag.current = null)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const d = step && !log ? step / (max - min) : 0.01
    const by = e.shiftKey ? d / 4 : d * (e.key.startsWith('Page') ? 10 : 1)
    const moves: Record<string, () => number> = {
      ArrowUp: () => p + Math.max(by, d / 4),
      ArrowRight: () => p + Math.max(by, d / 4),
      ArrowDown: () => p - Math.max(by, d / 4),
      ArrowLeft: () => p - Math.max(by, d / 4),
      PageUp: () => p + by,
      PageDown: () => p - by,
      Home: () => 0,
      End: () => 1,
    }
    const m = moves[e.key]
    if (m) {
      e.preventDefault()
      set(m())
    } else if (e.key === 'Enter') {
      e.preventDefault()
      setTyping(true)
    }
  }

  // the arc runs from 7 o'clock to 5 o'clock
  const r = size / 2 - 4
  const c = size / 2
  const a0 = (-135 * Math.PI) / 180
  const a = a0 + p * ((270 * Math.PI) / 180)
  const pt = (ang: number) => [c + r * Math.sin(ang), c - r * Math.cos(ang)]
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(from)
    const [x1, y1] = pt(to)
    const large = to - from > Math.PI ? 1 : 0
    return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
  }
  const [hx, hy] = [c + (r - 7) * Math.sin(a), c - (r - 7) * Math.cos(a)]

  return (
    <div className="knob" data-disabled={disabled || undefined} style={{ '--knob': color } as CSSProperties}>
      <div
        className="knob__dial"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 1000) / 1000}
        aria-valuetext={text}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => !disabled && setTyping(true)}
        onWheel={(e) => {
          if (disabled || document.activeElement !== e.currentTarget) return
          set(p - Math.sign(e.deltaY) * 0.02)
        }}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} aria-hidden="true">
          <path className="knob__track" d={arc(a0, -a0)} />
          {p > 0.001 ? <path className="knob__fill" d={arc(a0, a)} /> : null}
          <circle className="knob__cap" cx={c} cy={c} r={r - 5} />
          <line className="knob__hand" x1={c} y1={c} x2={hx} y2={hy} />
        </svg>
      </div>
      {typing ? (
        <input
          className="knob__type mono"
          autoFocus
          defaultValue={String(Math.round(value * 1000) / 1000)}
          aria-label={`${label}, type a value`}
          onBlur={() => setTyping(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTyping(false)
            if (e.key === 'Enter') {
              const v = parseFloat((e.target as HTMLInputElement).value)
              if (Number.isFinite(v)) onChange(step ? clamp(Math.round(v / step) * step, min, max) : clamp(v, min, max))
              setTyping(false)
            }
          }}
        />
      ) : (
        <span className="knob__value mono">{text}</span>
      )}
      <span className="knob__label">{label}</span>
    </div>
  )
}
