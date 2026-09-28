import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Whether the element is on screen, so loops can stop when it is scrolled away. */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return seen
}

/** A number that glides to each new value. It starts from 0, so the first render counts up. */
export function useTween(target: number, ms = 900): number {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const v = a + (target - a) * (1 - Math.pow(1 - k, 4))
      from.current = v
      setValue(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, reduced])

  return reduced ? target : value
}

/** Seconds of running time, advanced every frame, for playing a clip and turning a model. */
export function useClock(running: boolean): number {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      // a background tab stops frames; do not jump ahead when it comes back
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      setT((x) => x + dt)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [running])
  return t
}

/** Pointer position inside an element as --mx and --my, for a light that follows the cursor. */
export function trackPointer(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}
