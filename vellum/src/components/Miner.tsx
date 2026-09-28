import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HEIGHT, MinerScene } from '../lib/miner/scene'
import type { Failure, Mood } from '../lib/miner/scene'
import { useReducedMotion } from '../lib/motion'
import './Miner.css'

export type MinerMood = Mood
export type MinerFailure = Failure

/**
 * The studio's waiting scene: a miner who walks and mines while work
 * runs, steps through a portal when it succeeds, and either sits down
 * by a wall or ends up in lava when it fails. It is decoration; the
 * words next to it say what actually happened.
 *
 * The frame is drawn at one canvas pixel per art pixel and scaled up by
 * a whole number, so every pixel stays square.
 */
export function Miner({
  mood,
  failure = 'lava',
  maxScale = 3,
  className = '',
}: {
  mood: Mood
  failure?: Failure
  /** the largest whole-number zoom; the frame widens to fill its box */
  maxScale?: number
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [scene] = useState(() => new MinerScene(128))
  const [fit, setFit] = useState({ scale: 2, width: 128 })
  const [seen, setSeen] = useState(true)
  const reduced = useReducedMotion()

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
    const el = box.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    scene.setMood(mood, failure)
  }, [scene, mood, failure])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    scene.resize(fit.width)
    const paint = () => {
      scene.render()
      ctx.putImageData(new ImageData(scene.px.data, scene.w, HEIGHT), 0, 0)
    }
    if (reduced) {
      scene.settle()
      paint()
      return
    }
    if (!seen) {
      paint()
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      scene.step((now - last) / 1000)
      last = now
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scene, fit.width, reduced, seen, mood, failure])

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
