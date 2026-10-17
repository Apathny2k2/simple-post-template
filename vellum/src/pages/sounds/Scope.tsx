/* The console's display: the rendered sound as a waveform or a spectrogram,
   the playhead, and under it one lane per layer showing when it sounds.
   Drag a lane's bar to move the layer, or its right end to change its length.
   Click the display to play from that point. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { RATE, layerEnd } from '../../lib/audio/synth'
import type { Layer } from '../../lib/audio/synth'
import { layerColour } from './colours'

type Props = {
  data: Float32Array
  layers: Layer[]
  selected: string | null
  mode: 'wave' | 'spectrum'
  /** seconds, or null when nothing is playing */
  playhead: () => number | null
  playing: boolean
  onSeek: (t: number) => void
  onSelect: (id: string) => void
  onMove: (id: string, at: number, length: number, done: boolean) => void
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(120, Math.floor(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/* A spectrogram from 512-sample windows: time across, frequency up on a
   log scale, loudness from dark to bright in one hue. */
function spectrum(data: Float32Array, w: number, h: number): ImageData {
  const img = new ImageData(w, h)
  const N = 512
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const bins = new Float32Array(N / 2)
  const rowBin = Array.from({ length: h }, (_, y) => {
    const f = 40 * Math.pow(20000 / 40, 1 - y / (h - 1))
    return Math.min(N / 2 - 1, Math.round((f / RATE) * N))
  })
  for (let x = 0; x < w; x++) {
    const centre = Math.floor((x / w) * data.length)
    for (let i = 0; i < N; i++) {
      const j = centre - N / 2 + i
      re[i] = j >= 0 && j < data.length ? data[j] * win[i] : 0
      im[i] = 0
    }
    fft(re, im)
    for (let k = 0; k < N / 2; k++) bins[k] = Math.hypot(re[k], im[k])
    for (let y = 0; y < h; y++) {
      const db = 20 * Math.log10(bins[rowBin[y]] + 1e-9)
      const v = Math.max(0, Math.min(1, (db + 70) / 70))
      const o = (y * w + x) * 4
      // dark navy to the accent blue to near white
      img.data[o] = 14 + v * v * 220
      img.data[o + 1] = 18 + v * 150 + v * v * 70
      img.data[o + 2] = 30 + v * 225
      img.data[o + 3] = 255
    }
  }
  return img
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
  }
}

/** Seconds to a short label: 250 ms, 1.4 s. */
export const seconds = (t: number) => (t < 1 ? `${Math.round(t * 1000)} ms` : `${t.toFixed(t < 10 ? 2 : 1)} s`)

export function Scope({ data, layers, selected, mode, playhead, playing, onSeek, onSelect, onMove }: Props) {
  const [wrap, w] = useWidth<HTMLDivElement>()
  const canvas = useRef<HTMLCanvasElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const H = 168
  const dur = data.length / RATE
  // the time across the display: steady while a bar is dragged
  const [span, setSpan] = useState(() => Math.max(0.25, dur))
  const dragging = useRef(false)
  useEffect(() => {
    if (!dragging.current) setSpan(Math.max(0.25, dur, ...layers.map(layerEnd)))
  }, [dur, layers])

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.floor(w * dpr)
    cv.height = Math.floor(H * dpr)
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, H)
    const used = Math.max(1, Math.floor((dur / span) * w))
    if (mode === 'spectrum') {
      const img = spectrum(data, Math.max(1, Math.floor(used * dpr)), Math.floor(H * dpr))
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.putImageData(img, 0, 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    } else {
      const mid = H / 2
      g.strokeStyle = 'rgba(255,255,255,0.08)'
      g.beginPath()
      g.moveTo(0, mid + 0.5)
      g.lineTo(w, mid + 0.5)
      g.stroke()
      const per = data.length / used
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#a9ccff')
      grad.addColorStop(0.5, '#3e90ff')
      grad.addColorStop(1, '#a9ccff')
      g.fillStyle = grad
      for (let x = 0; x < used; x++) {
        let lo = 0
        let hi = 0
        const a = Math.floor(x * per)
        const b = Math.min(data.length, Math.floor((x + 1) * per) + 1)
        for (let i = a; i < b; i++) {
          const v = data[i]
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        const y0 = mid - hi * (mid - 6)
        const y1 = mid - lo * (mid - 6)
        g.fillRect(x, y0, 1, Math.max(1, y1 - y0))
      }
    }
  }, [data, w, mode, span, dur])

  // the playhead moves without React
  useEffect(() => {
    if (!playing) {
      if (head.current) head.current.style.opacity = '0'
      return
    }
    let raf = 0
    const tick = () => {
      const t = playhead()
      if (head.current) {
        head.current.style.opacity = t === null ? '0' : '1'
        if (t !== null) head.current.style.transform = `translateX(${(t / span) * w}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, playhead, span, w])

  const ticks: number[] = []
  // the smallest round step that keeps labels about 64px apart
  const stepT = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5].find((s) => (s / span) * (w || 800) >= 64) ?? 10
  for (let t = 0; t <= span + 1e-9; t += stepT) ticks.push(t)

  const bar = (l: Layer, e: PointerEvent<HTMLElement>, edge: boolean) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(l.id)
    const x0 = e.clientX
    const at0 = l.at
    const len0 = l.length
    dragging.current = true
    const move = (ev: globalThis.PointerEvent, done: boolean) => {
      const dt = ((ev.clientX - x0) / w) * span
      const snap = (v: number) => (ev.shiftKey ? v : Math.round(v / 0.005) * 0.005)
      if (edge) onMove(l.id, at0, Math.max(0.005, snap(len0 + dt)), done)
      else onMove(l.id, Math.max(0, snap(at0 + dt)), len0, done)
    }
    const mm = (ev: globalThis.PointerEvent) => move(ev, false)
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', mm)
      window.removeEventListener('pointerup', up)
      dragging.current = false
      move(ev, true)
    }
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="scope" ref={wrap}>
      <div
        className="scope__screen"
        style={{ height: H }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onSeek(Math.max(0, ((e.clientX - r.left) / r.width) * span))
        }}
        role="img"
        aria-label={`${mode === 'wave' ? 'Waveform' : 'Spectrogram'} of the sound, ${seconds(dur)} long. Click to play from a point.`}
      >
        <canvas ref={canvas} style={{ width: w, height: H }} />
        <div className="scope__head" ref={head} />
        <span className="scope__len mono">{seconds(dur)}</span>
      </div>
      <div className="scope__ruler mono" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${(t / span) * 100}%` }}>
            {t === 0 ? '0' : seconds(t)}
          </span>
        ))}
      </div>
      <div className="scope__lanes">
        {layers.map((l) => {
          const end = layerEnd(l)
          const style = {
            left: `${(l.at / span) * 100}%`,
            width: `${Math.max(0.4, ((end - l.at) / span) * 100)}%`,
            '--lane': layerColour(l),
          } as CSSProperties
          const hits = Math.max(1, Math.round(l.repeats))
          return (
            <div className="scope__lane" key={l.id} data-off={l.muted || undefined}>
              <button
                className="scope__bar"
                style={style}
                aria-pressed={selected === l.id}
                aria-label={`${l.name}: from ${seconds(l.at)}, ${seconds(end - l.at)} long. Drag to move.`}
                onPointerDown={(e) => bar(l, e, false)}
                onClick={() => onSelect(l.id)}
              >
                <span className="scope__name">{l.name}</span>
                {hits > 1
                  ? Array.from({ length: hits }, (_, i) => (
                      <i key={i} style={{ left: `${((i * l.gap) / (end - l.at)) * 100}%`, width: `${(l.length / (end - l.at)) * 100}%` }} />
                    ))
                  : null}
                <span className="scope__grip" onPointerDown={(e) => bar(l, e, true)} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
