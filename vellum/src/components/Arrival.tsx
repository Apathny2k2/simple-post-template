import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ARRIVE, ArriveScene, arriveScale } from '../lib/pip/arrive'
import { finishArrival, toTitle, useArrival } from '../lib/arrival'
import type { Arrival as ArrivalState } from '../lib/arrival'
import { renderTitle, serverColours } from '../lib/title'
import { useModal } from '../lib/a11y'
import './Arrival.css'

/** Entering a server: the portal scene, then the server's title over its Dash. */
export function Arrival() {
  const arrival = useArrival()
  if (!arrival) return null
  return arrival.stage === 'portal' ? <Portal key={arrival.key} arrival={arrival} /> : <Title key={arrival.key} arrival={arrival} />
}

function measure() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = arriveScale(vw, vh)
  return { scale, w: Math.ceil(vw / scale) + 1, h: Math.ceil(vh / scale) + 1 }
}

function Portal({ arrival }: { arrival: ArrivalState }) {
  const { server } = arrival
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const skip = useRef<HTMLButtonElement>(null)
  const started = useRef<number | null>(null)
  // Tab stays on Skip, and Escape skips
  useModal(box, toTitle)
  const [size, setSize] = useState(measure)
  const pip = useMemo(() => serverColours(server.id, server.hue).pip, [server.id, server.hue])

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
    const scene = new ArriveScene(size.w, size.h)
    let raf = 0
    const frame = (now: number) => {
      started.current ??= now
      const t = (now - started.current) / 1000
      if (t >= ARRIVE.end) return toTitle()
      scene.render(t, pip)
      ctx.putImageData(new ImageData(scene.data, size.w, size.h), 0, 0)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size, pip])

  // the scene ends itself; this is for a tab that stops painting, or a canvas that never drew
  useEffect(() => {
    const id = window.setTimeout(toTitle, (ARRIVE.end + 1) * 1000)
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
