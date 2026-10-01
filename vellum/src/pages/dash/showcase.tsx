import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ModelView } from '../../components/ModelView'
import { Icon } from '../../lib/icons'
import { navigate } from '../../lib/router'
import { samples } from '../../lib/samples'
import type { Sample } from '../../lib/samples'
import type { Clip, Model } from '../../lib/model'
import { useClock, useInView, useReducedMotion } from '../../lib/motion'

const ORDER = ['voidling', 'geyser_block', 'emberfang', 'tide_flask', 'alien_sword', 'resonator_block', 'runic_blade', 'honeyed_loaf']
const REEL = ORDER.map((id) => samples.find((s) => s.id === id)).filter((s): s is Sample => !!s)
const HOLD_MS = 7000
/** Seconds for one full turn of the turntable. */
const TURN_S = 14
const PITCH = -14
const KIND: Record<string, string> = { items: 'Item', mobs: 'Mob', blocks: 'Block' }

/** The model's largest extent in units, so every model fills the stage by the same share. */
function sizeOf(model: Model): number {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const c of model.cubes) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], c.from[i])
      hi[i] = Math.max(hi[i], c.to[i])
    }
  }
  return Math.max(hi[1] - lo[1], Math.hypot(hi[0] - lo[0], hi[2] - lo[2]), 1)
}

const idleOf = (m: Model): Clip | null => m.clips.find((c) => /idle|breath/i.test(c.name)) ?? m.clips[0] ?? null

/** What a click plays: a one-shot if the model has one, otherwise its longest other clip. */
function actionOf(m: Model): Clip | null {
  const idle = idleOf(m)
  const rest = m.clips.filter((c) => c !== idle && c.length > 0)
  return rest.find((c) => c.loop === 'once') ?? [...rest].sort((a, b) => b.length - a.length)[0] ?? null
}

/** 'animation.voidling.strike' reads as 'strike'. */
const clipName = (c: Clip) => c.name.split('.').pop() || c.name

function Turntable({
  sample,
  box,
  time,
  yaw,
  poke,
  state,
}: {
  sample: Sample
  box: number
  time: number
  yaw: number
  /** clock time of the last click on this model, or null */
  poke: number | null
  state: 'in' | 'out'
}) {
  const { model } = sample
  const idle = idleOf(model)
  const action = actionOf(model)
  const since = poke === null ? Infinity : time - poke
  const acting = action !== null && since < action.length
  const clip = acting ? action : idle
  const t = acting ? since : clip && clip.length > 0 ? time % clip.length : 0
  const scale = Math.max(0.8, Math.min(14, (box * 0.6) / sizeOf(model)))

  return (
    <div className="showcase__model" data-state={state}>
      <ModelView
        model={model}
        scale={scale}
        grid={false}
        orbit={false}
        zoomable={false}
        yaw={yaw}
        initialPitch={PITCH}
        anchorAt="floor"
        clip={clip}
        time={t}
      />
    </div>
  )
}

/* The viewport's axis gizmo, turned by the same yaw as the model.
   Model space is Y-up; the maths below is in CSS space, where Y points down. */
const AXES = [
  { key: 'x', v: [1, 0, 0] },
  { key: 'y', v: [0, -1, 0] },
  { key: 'z', v: [0, 0, 1] },
] as const

function Gizmo({ yaw }: { yaw: number }) {
  const a = (yaw * Math.PI) / 180
  const p = (PITCH * Math.PI) / 180
  const R = 24
  const ends = AXES.map(({ key, v: [x, y, z] }) => {
    const x1 = x * Math.cos(a) + z * Math.sin(a)
    const z1 = -x * Math.sin(a) + z * Math.cos(a)
    return { key, x: x1 * R, y: (y * Math.cos(p) - z1 * Math.sin(p)) * R, depth: y * Math.sin(p) + z1 * Math.cos(p) }
  }).sort((m, n) => m.depth - n.depth)

  return (
    <svg className="gizmo" viewBox="-36 -36 72 72" aria-hidden="true">
      <circle className="gizmo__ring" r="34" />
      {ends.map((e) => (
        <g key={e.key} className="gizmo__axis" data-axis={e.key} data-behind={e.depth < -0.25 || undefined}>
          <line x1="0" y1="0" x2={e.x} y2={e.y} />
          <circle cx={e.x} cy={e.y} r="7" />
          <text x={e.x} y={e.y} dy="0.36em">
            {e.key.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Sample models on a turntable. Hover holds one; clicking plays its action. `linked` adds an editor link. */
export const Showcase = memo(function Showcase({ linked = true }: { linked?: boolean }) {
  const reduced = useReducedMotion()
  const frame = useRef<HTMLDivElement>(null)
  const visible = useInView(frame)
  const [at, setAt] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null })
  const [held, setHeld] = useState(false)
  const [poke, setPoke] = useState<{ id: string; at: number } | null>(null)
  const [box, setBox] = useState(360)
  const time = useClock(!reduced && visible)
  const yaw = -32 + ((time * 360) / TURN_S) % 360

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      if (r.width > 0 && r.height > 0) setBox(Math.min(r.width, r.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cycling = !held && !reduced && visible
  useEffect(() => {
    if (!cycling) return
    const id = window.setTimeout(() => setAt((s) => ({ index: (s.index + 1) % REEL.length, prev: s.index })), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [at.index, cycling])

  // The outgoing model stays just long enough to animate away.
  useEffect(() => {
    if (at.prev === null) return
    const id = window.setTimeout(() => setAt((s) => ({ ...s, prev: null })), 700)
    return () => window.clearTimeout(id)
  }, [at.prev])

  const pick = (i: number) => setAt((s) => (i === s.index ? s : { index: i, prev: s.index }))
  const sample = REEL[at.index]
  const action = actionOf(sample.model)
  const pokedAt = poke?.id === sample.id ? poke.at : null
  const acting = action !== null && pokedAt !== null && time - pokedAt < action.length

  return (
    <div
      className="showcase"
      data-model={sample.id}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      <div className="showcase__stage" ref={frame}>
        <span className="showcase__halo" aria-hidden="true" />
        <span className="showcase__floor" aria-hidden="true" />
        <span className="showcase__disc" aria-hidden="true" />
        <span className="showcase__wave" key={`wave-${sample.id}`} aria-hidden="true" />
        {at.prev !== null ? (
          <Turntable key={`out-${at.prev}`} sample={REEL[at.prev]} box={box} time={time} yaw={yaw} poke={null} state="out" />
        ) : null}
        <Turntable key={sample.id} sample={sample} box={box} time={time} yaw={yaw} poke={pokedAt} state="in" />

        {action && !reduced ? (
          <button
            className="showcase__poke"
            aria-label={`Play ${clipName(action)}`}
            onClick={() => setPoke({ id: sample.id, at: time })}
          >
            <span className="showcase__chip" data-on={acting || undefined}>
              <Icon name="play" size={9} /> {clipName(action)}
            </span>
          </button>
        ) : null}

        <Gizmo yaw={yaw} />
      </div>

      <div className="showcase__foot">
        {linked ? (
          <button className="showcase__caption" key={`caption-${sample.id}`} onClick={() => navigate(`/editor/${sample.id}`)}>
            <span className="showcase__kind">{KIND[sample.kind] ?? 'Model'}</span>
            <span className="showcase__name">{sample.label}</span>
            <span className="showcase__open">
              Open in the editor <Icon name="arrowRight" size={12} />
            </span>
          </button>
        ) : (
          <div className="showcase__caption" key={`caption-${sample.id}`}>
            <span className="showcase__kind">{KIND[sample.kind] ?? 'Model'}</span>
            <span className="showcase__name">{sample.label}</span>
          </div>
        )}

        <div className="showcase__dots" role="group" aria-label="Models">
          {REEL.map((s, i) => (
            <button
              key={s.id}
              className="showcase__dot"
              aria-label={s.label}
              aria-pressed={i === at.index}
              onClick={() => pick(i)}
            >
              {i === at.index && cycling ? <span className="showcase__countdown" key={at.index} /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})
