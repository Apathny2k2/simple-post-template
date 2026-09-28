import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HEIGHT, MinerScene } from '../lib/miner/scene'
import type { Failure, Mood } from '../lib/miner/scene'
import { parseColour } from '../lib/miner/pixels'
import { useReducedMotion } from '../lib/motion'
import './Miner.css'

export type MinerMood = Mood
export type MinerFailure = Failure

/** Longest an ending may take before the result is shown anyway. */
const ENDING_LIMIT_MS = 6000

/**
 * The studio's waiting scene, in one colour after the offline dinosaur
 * game: a miner who mines while work runs, then walks into a portal,
 * into lava, or into a wall depending on how it went.
 *
 * Mount it only while something is running. When the mood turns to done
 * or failed it plays the ending and then calls `onFinish`, which is when
 * the result should appear. It draws in the text colour of wherever it
 * sits, at one canvas pixel per art pixel scaled up by a whole number.
 */
export function Miner({
  mood,
  failure = 'lava',
  onFinish,
  maxScale = 3,
  className = '',
}: {
  mood: Mood
  failure?: Failure
  onFinish?: () => void
  /** the largest whole-number zoom; the frame widens to fill its box */
  maxScale?: number
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [scene] = useState(() => new MinerScene(128))
  const [fit, setFit] = useState({ scale: 2, width: 128 })
  const reduced = useReducedMotion()
  const finish = useRef(onFinish)
  const told = useRef(false)

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
    // a result is never held back for long, whatever happens to the drawing
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
    // with motion reduced there is nothing to wait for
    if (reduced) {
      scene.settle()
      paint()
      if (ending) tell()
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      scene.step((now - last) / 1000)
      last = now
      paint()
      if (ending && scene.finished) tell()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scene, fit.width, reduced, mood, failure])

  return (
    <div className={`miner ${className}`} ref={box} aria-hidden="true">
      <canvas
        ref={canvas}
        className="miner__frame"
        width={fit.width}
        height={HEIGHT}
        style={{ width: fit.width * fit.scale, height: HEIGHT * fit.scale }}
      />
    </div>
  )
}
