import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ARRIVE, ArriveScene, arriveEnd, arriveScale } from '../lib/pip/arrive'
import { finishArrival, openStudio, toTitle, useArrival } from '../lib/arrival'
import type { Arrival as ArrivalState } from '../lib/arrival'
import { renderTitle, serverColours } from '../lib/title'
import { useModal } from '../lib/a11y'
import './Arrival.css'

/** Entering a server: the walk into the swirl, then the server's title over its Dash. `path` is the page on screen. */
export function Arrival({ path }: { path: string }) {
  const arrival = useArrival()
  if (!arrival) return null
  return arrival.stage === 'portal' ? (
    <Portal key={arrival.key} arrival={arrival} path={path} />
  ) : (
    <Title key={arrival.key} arrival={arrival} />
  )
}

function measure() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = arriveScale(vh)
  const w = Math.ceil(vw / scale) + 1
  const h = Math.ceil(vh / scale) + 1
  // the canvas is centred, so it overhangs the screen by up to a pixel each side
  const top = (vh - h * scale) / 2
  const gap = groundGap(vh)
  return { scale, w, h, ground: gap === null ? undefined : Math.round((gap - top) / scale) }
}

/* The line runs along a gap between two rows of the list it starts from,
   the one nearest a little below the middle, rather than through a row's text. */
function groundGap(vh: number): number | null {
  const rows = [...document.querySelectorAll('.server')].map((el) => el.getBoundingClientRect())
  let best: number | null = null
  for (let i = 1; i < rows.length; i++) {
    const y = (rows[i - 1].bottom + rows[i].top) / 2
    if (Math.abs(y - vh * 0.56) > vh * 0.2) continue
    if (best === null || Math.abs(y - vh * 0.56) < Math.abs(best - vh * 0.56)) best = y
  }
  return best
}

function Portal({ arrival, path }: { arrival: ArrivalState; path: string }) {
  const { server } = arrival
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const skip = useRef<HTMLButtonElement>(null)
  const started = useRef<number | null>(null)
  // Tab stays on Skip, and Escape skips
  useModal(box, toTitle)
  const [size, setSize] = useState(measure)
  const pip = useMemo(() => serverColours(server.id, server.hue).pip, [server.id, server.hue])
  // the page on screen, for the frame loop: it waits for the Studio to be drawn
  const onScreen = useRef(path)
  useLayoutEffect(() => {
    onScreen.current = path
  }, [path])

  useEffect(() => {
    const on = () => setSize(measure())
    window.addEventListener('resize', on)
    skip.current?.focus()
    return () => {
      window.removeEventListener('resize', on)
      // the list that started this is gone, so focus goes to the Dash
      const main = document.querySelector('main')
      if (!main) return
      main.tabIndex = -1
      main.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const scene = new ArriveScene(size.w, size.h, size.ground)
    let raf = 0
    let asked = false
    let drawn: number | null = null
    const frame = (now: number) => {
      started.current ??= now
      const t = (now - started.current) / 1000
      if (asked && drawn === null && onScreen.current === '/dash') drawn = t
      if (t >= arriveEnd(drawn)) return toTitle()
      scene.render(t, pip, t < ARRIVE.gone ? ARRIVE.gone : drawn)
      ctx.putImageData(new ImageData(scene.data, size.w, size.h), 0, 0)
      // Pip is in: the Studio opens out of the swirl's middle
      if (t >= ARRIVE.gone && !asked && canvas.current) {
        asked = true
        const r = canvas.current.getBoundingClientRect()
        openStudio({ x: r.left + ((scene.px + 0.5) * r.width) / size.w, y: r.top + ((scene.py + 0.5) * r.height) / size.h })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size, pip])

  // the scene ends itself; this is for a tab that stops painting, or a canvas that never drew
  useEffect(() => {
    const id = window.setTimeout(toTitle, (ARRIVE.end + 2.5) * 1000)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div
      ref={box}
      className="arrival"
      role="dialog"
      aria-modal="true"
      aria-label={`Entering ${server.name}`}
      onClick={() => toTitle()}
    >
      <canvas
        ref={canvas}
        className="arrival__scene"
        width={size.w}
        height={size.h}
        style={{ width: size.w * size.scale, height: size.h * size.scale }}
        aria-hidden="true"
      />
      <p className="visually-hidden" role="status">
        Entering {server.name}
      </p>
      <button
        ref={skip}
        className="arrival__skip"
        onClick={(e) => {
          e.stopPropagation()
          toTitle()
        }}
      >
        Skip
      </button>
    </div>
  )
}

/** The largest whole-number zoom that keeps the title inside most of the screen width. */
const titleScale = (w: number) => Math.max(2, Math.min(6, Math.floor((window.innerWidth * 0.86) / w)))

function Title({ arrival }: { arrival: ArrivalState }) {
  const { server } = arrival
  const canvas = useRef<HTMLCanvasElement>(null)
  const image = useMemo(() => renderTitle(server.name, serverColours(server.id, server.hue), server.id), [server])
  const [scale] = useState(() => titleScale(image.w))

  useLayoutEffect(() => {
    canvas.current?.getContext('2d')?.putImageData(new ImageData(image.data, image.w, image.h), 0, 0)
  }, [image])

  useEffect(() => {
    // the title's own animation runs this long; see Arrival.css
    const id = window.setTimeout(finishArrival, 3000)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="server-title" aria-hidden="true">
      <canvas
        ref={canvas}
        className="server-title__name"
        width={image.w}
        height={image.h}
        style={{ width: image.w * scale, height: image.h * scale }}
      />
      <p className="server-title__motd">{server.motd}</p>
    </div>
  )
}
