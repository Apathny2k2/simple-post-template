import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HEIGHT } from '../lib/pip/scene'
import type { Failure, Mood, PipScene } from '../lib/pip/scene'
import { MineScene } from '../lib/pip/mine'
import { FishScene } from '../lib/pip/fish'
import { parseColour } from '../lib/pip/pixels'
import { FISH_QUIPS, MINE_QUIPS } from '../lib/pip/quips'
import { useReducedMotion } from '../lib/motion'
import './Pip.css'

export type PipMood = Mood
export type PipFailure = Failure

/** Longest an ending may take before the result is shown anyway. */
const ENDING_LIMIT_MS = 6000

/** The mascot shown while something is on its way. Mount him only while waiting. */
export function Pip({
  scene: kind = 'mine',
  mood,
  failure = 'lava',
  onFinish,
  maxScale = 3,
  label,
  quips = true,
  className = '',
}: {
  /** 'mine' for work that runs, 'fish' for waiting on a person. Fixed at mount; key it to change. */
  scene?: 'mine' | 'fish'
  mood: Mood
  failure?: Failure
  /** called after the done or failed ending has played; show the result then */
  onFinish?: () => void
  /** the largest whole-number zoom; the frame widens to fill its box */
  maxScale?: number
  /** what is happening, for screen readers; without it Pip is decoration */
  label?: string
  /** a line under him while he works */
  quips?: boolean
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [scene] = useState<PipScene>(() => (kind === 'fish' ? new FishScene(128) : new MineScene(128)))
  const [fit, setFit] = useState({ scale: 2, width: 128 })
  const reduced = useReducedMotion()
  const finish = useRef(onFinish)
  const told = useRef(false)
  const firstQuip = useRef(-1)
  const [quip, setQuip] = useState<string | null>(null)
  const [said, setSaid] = useState('')

  useEffect(() => {
    if (!label) return
    // set after mount, so screen readers hear it arrive
    const id = requestAnimationFrame(() => setSaid(label))
    return () => cancelAnimationFrame(id)
  }, [label])

  useEffect(() => {
    finish.current = onFinish
  }, [onFinish])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const room = entry.contentRect.width
      if (room <= 0) return
      const scale = Math.max(1, Math.min(maxScale, Math.floor(room / 128)))
      const width = Math.max(96, Math.floor(room / scale))
      setFit((f) => (f.scale === scale && f.width === width ? f : { scale, width }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxScale])

  useEffect(() => {
    scene.setMood(mood, failure)
    told.current = false
    if (mood !== 'done' && mood !== 'failed') return
    // show the result even if the ending never finishes
    const id = window.setTimeout(() => {
      if (told.current) return
      told.current = true
      finish.current?.()
    }, ENDING_LIMIT_MS)
    return () => window.clearTimeout(id)
  }, [scene, mood, failure])

  useEffect(() => {
    const el = box.current
    const ctx = canvas.current?.getContext('2d')
    if (!el || !ctx) return
    scene.resize(fit.width)
    scene.setInk(parseColour(getComputedStyle(el).color, 0x535353))
    const ending = mood === 'done' || mood === 'failed'
    const paint = () => {
      scene.render()
      ctx.putImageData(new ImageData(scene.px.data, scene.w, HEIGHT), 0, 0)
    }
    const tell = () => {
      if (told.current) return
      told.current = true
      finish.current?.()
    }
    const lines = kind === 'fish' ? FISH_QUIPS : MINE_QUIPS
    if (firstQuip.current < 0) firstQuip.current = Math.floor(Math.random() * lines.length)
    const lineFor = () => lines[(firstQuip.current + scene.loops) % lines.length]
    // with motion reduced there is nothing to wait for, and the line stays put
    if (reduced) {
      scene.settle()
      paint()
      if (ending) tell()
      const id = requestAnimationFrame(() => setQuip(lineFor()))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    let last = performance.now()
    let loops = -1
    const tick = (now: number) => {
      scene.step((now - last) / 1000)
      last = now
      paint()
      if (ending && scene.finished) tell()
      if (scene.loops !== loops) {
        loops = scene.loops
        setQuip(lineFor())
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scene, kind, fit.width, reduced, mood, failure])

  return (
    <div
      className={`pip ${className}`}
      data-scene={kind}
      ref={box}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      <canvas
        ref={canvas}
        className="pip__frame"
        width={fit.width}
        height={HEIGHT}
        style={{ width: fit.width * fit.scale, height: HEIGHT * fit.scale }}
        aria-hidden="true"
      />
      {quips && mood === 'working' && quip ? (
        <p key={quip} className="pip__quip" aria-hidden="true">
          {quip}
        </p>
      ) : null}
      {label ? <span className="visually-hidden">{said}</span> : null}
    </div>
  )
}
