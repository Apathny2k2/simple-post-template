import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ModelView } from './ModelView'
import { Icon } from '../lib/icons'
import { useModal } from '../lib/a11y'
import { BLOCK, NO_TRAVEL, buildWorld, defaultPlacement, sceneClip, travelOf } from '../lib/world'
import { cycleLength, hasBehaviour, particleById, stageAt } from '../lib/behaviour'
import type { Behaviour, BehaviourStage } from '../lib/behaviour'
import type { Placement } from '../lib/world'
import type { Clip, Model, ProjectKind, Subtype } from '../lib/model'
import './WorldScene.css'

const PLACEMENTS: Array<{ id: Placement; label: string; blurb: string }> = [
  { id: 'ground', label: 'On the ground', blurb: 'Standing on the floor, at its real size.' },
  { id: 'air', label: 'Held in the air', blurb: 'Hovering and turning, the way an item model is inspected.' },
  { id: 'dropped', label: 'Dropped', blurb: 'On the floor at a quarter size, turning and bobbing.' },
]

/** The model at real size in a small world, which is itself a model that ModelView renders. */
export function WorldScene({
  model,
  kind,
  clip,
  clips,
  onClip,
  onClose,
  subtype,
  behaviour,
}: {
  model: Model
  kind: ProjectKind
  subtype?: Subtype
  behaviour?: Behaviour
  clip: Clip | null
  clips: Clip[]
  onClip: (id: string | null) => void
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, onClose)

  const [placement, setPlacement] = useState<Placement>(() => defaultPlacement(kind, model.name, subtype))
  const [withPlayer, setWithPlayer] = useState(kind === 'mobs')
  const [walking, setWalking] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)

  // buildWorld paints a 1024px texture sheet, so it only reruns when its inputs change
  const built = useMemo(
    () => buildWorld(model, { kind, placement, withPlayer }),
    [model, kind, placement, withPlayer],
  )
  // a behaviour with a cycle picks the clip, overriding the clip picker
  const cyclic = hasBehaviour(behaviour) && cycleLength(behaviour) > 0 ? behaviour : null
  const [runCycle, setRunCycle] = useState(true)
  const cycle = cyclic && runCycle ? cyclic : null
  const [cycleT, setCycleT] = useState(0)
  const now = useMemo(() => (cycle ? stageAt(cycle, cycleT) : null), [cycle, cycleT])

  const subject = useMemo(() => {
    if (!cycle) return clip
    return model.clips.find((c) => c.id === now?.stage?.clip) ?? null
  }, [cycle, clip, model.clips, now?.stage?.clip])

  const travel = useMemo(() => travelOf(model, subject), [model, subject])
  const moving = walking && !cycle ? travel : NO_TRAVEL
  const scene = useMemo(() => sceneClip(built, subject, moving), [built, subject, moving])

  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 900, h: 620 })
  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // frame the subject, and the player too when it is shown
  const subjectUnits = Math.max(built.blocks * BLOCK, withPlayer ? 2 * BLOCK : 0)
  const fit = Math.min(box.w * 0.66, box.h * 0.86) / Math.max(72, subjectUnits * 2.6)
  // dropped and held items are small, so the camera comes in closer
  const scale = Math.max(1, Math.min(18, fit * (built.placement === 'ground' ? 1 : 1.95)))

  /* The clock is read from a ref. An effect that depends on `time` restarts
     every frame, resets its baseline and runs at half speed. */
  const timeRef = useRef(0)
  timeRef.current = time
  useEffect(() => {
    if (!playing || !cycle) return
    let raf = 0
    let last = performance.now()
    const step = (at: number) => {
      const dt = (at - last) / 1000
      last = at
      setCycleT((t) => t + dt)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, cycle])

  useEffect(() => {
    if (!playing || !scene || cycle) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = timeRef.current + dt
      setTime(next >= scene.length ? next % scene.length : next)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, scene, cycle])

  useEffect(() => {
    setTime(0)
  }, [scene])

  const reset = useCallback(() => {
    setTime(0)
    setCycleT(0)
  }, [])

  // the stage's clip loops through the stage: a 2s clip in a 7s stage plays 3.5 times
  const at = cycle && scene?.length ? (now?.local ?? 0) % scene.length : time

  const shake = cycle
    ? (now?.stage?.effects ?? []).filter((e) => e.kind === 'shake').reduce((n, e) => Math.max(n, e.amount), 0)
    : 0

  // on open, start the first clip if none is picked
  const picked = useRef(false)
  useEffect(() => {
    if (picked.current || clip || !clips.length) return
    picked.current = true
    onClip(clips[0].id)
  }, [clip, clips, onClip])

  const label =
    built.blocks >= 1
      ? `${built.blocks} block${built.blocks === 1 ? '' : 's'} tall`
      : `${Math.round(built.blocks * BLOCK)} units tall`

  return (
    <div className="world" role="dialog" aria-modal="true" aria-label="View in the real world">
      <div className="world__scrim" onClick={onClose} />
      <div className="world__panel" ref={panel}>
        <header className="world__head">
          <div className="world__title">
            <Icon name="scene" size={15} />
            <div>
              <div className="eyebrow">In the real world</div>
              <h2 className="card__title">{model.name}</h2>
            </div>
          </div>
          <span className="world__stat mono">{label}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close the scene">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="world__stage" ref={stage}>
          <div
            className="world__shake"
            style={shake > 0 ? ({ '--shake': `${shake * 3}px` } as React.CSSProperties) : undefined}
            data-shaking={shake > 0 || undefined}
          >
          <ModelView
            key={`${placement}-${withPlayer}`}
            model={built.model}
            scale={scale}
            grid={false}
            orbit
            initialYaw={-38}
            initialPitch={-14}
            clip={scene}
            time={at}
            anchorAt="centre"
            anchorOn={built.placement === 'ground' ? null : built.focus}
          />
          </div>

          <Effects stage={cycle ? (now?.stage ?? null) : null} scale={scale} />

          {withPlayer ? (
            <span className="world__hint">
              <Icon name="user" size={11} /> The player is 2 blocks tall. Yours is {label}.
            </span>
          ) : null}
        </div>

        <footer className="world__bar">
          <div className="world__group" role="group" aria-label="Playback">
            <button
              className="ed-tool"
              onClick={() => setPlaying((p) => !p)}
              title={playing ? 'Pause the scene' : 'Play the scene'}
              aria-label={playing ? 'Pause the scene' : 'Play the scene'}
              aria-pressed={playing}
            >
              <Icon name={playing ? 'pause' : 'play'} size={14} />
            </button>
            <button className="ed-tool" onClick={reset} title="Back to the start" aria-label="Back to the start">
              <Icon name="skipBack" size={14} />
            </button>
            {cyclic ? (
              <button
                className="ed-tool"
                onClick={() => setRunCycle((r) => !r)}
                title={runCycle ? 'Play the picked clip instead' : 'Run the behaviour cycle'}
                aria-label={runCycle ? 'Play the picked clip instead' : 'Run the behaviour cycle'}
                aria-pressed={runCycle}
              >
                <Icon name="power" size={14} />
              </button>
            ) : null}
            {/* shows whichever clock is driving: the cycle or the clip */}
            <span className="world__time mono">
              {cycle
                ? `${now?.stage?.name ?? '-'} · ${(now?.local ?? 0).toFixed(1)}s / ${cycleLength(cycle).toFixed(1)}s`
                : `${time.toFixed(2)}s${scene ? ` / ${scene.length.toFixed(2)}s` : ''}`}
            </span>
          </div>

          <label className="world__field">
            <span>{cycle ? 'Cycle' : 'Animation'}</span>
            {/* while the cycle drives, the disabled picker shows the clip it chose */}
            <select
              className="ed-select"
              value={cycle ? (subject?.id ?? '') : (clip?.id ?? '')}
              disabled={!!cycle}
              title={cycle ? 'The behaviour is choosing the clip' : undefined}
              onChange={(e) => onClip(e.target.value || null)}
            >
              <option value="">None</option>
              {clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="world__field">
            <span>Placement</span>
            <select
              className="ed-select"
              value={placement}
              onChange={(e) => setPlacement(e.target.value as Placement)}
              title={PLACEMENTS.find((p) => p.id === placement)?.blurb}
            >
              {PLACEMENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {travel.speed > 0 ? (
            <button
              className="chip"
              aria-pressed={walking}
              onClick={() => setWalking((v) => !v)}
              title={`From the leg swing: ${travel.asked.toFixed(1)} units a cycle, rounded to ${travel.blocks} block${travel.blocks === 1 ? '' : 's'} so the floor loops smoothly`}
            >
              <Icon name="move" size={11} /> {(travel.speed / BLOCK).toFixed(2)} blocks/s
            </button>
          ) : null}

          <button
            className="chip"
            aria-pressed={withPlayer}
            onClick={() => setWithPlayer((v) => !v)}
            title="A player-sized figure to judge height and reach against"
          >
            <Icon name="user" size={11} /> Player
          </button>

          <span className="world__note">
            {!playing
              ? 'Paused. Drag to look around the pose.'
              : moving.speed > 0
                ? 'Walking. The ground moves, so the cycle never ends.'
                : 'Drag to orbit while it plays.'}
          </span>
        </footer>
      </div>
    </div>
  )
}

/* ---------------- particles ---------------- */

/* Each particle is a span with a CSS keyframe, staggered by animation-delay so
   the stream looks continuous. The overlay is flat and the camera orbits, so
   an emitter uses only the effect's height and sits on the model's axis. */

/** A stable spread per index, so a group does not reshuffle every render. */
const spread = (i: number) => {
  const n = Math.sin(i * 12.9898) * 43758.5453
  return n - Math.floor(n)
}

function Effects({ stage, scale }: { stage: BehaviourStage | null; scale: number }) {
  if (!stage) return null
  const groups = stage.effects.filter((e) => e.kind === 'particles' && e.amount > 0)
  if (!groups.length) return null

  return (
    <div className="world__fx" aria-hidden="true">
      {groups.map((e, g) => {
        const kind = particleById(e.id)
        const n = Math.max(1, Math.min(40, Math.round(e.amount)))
        const life = 1.1 + Math.abs(kind.rise) * 0.9
        const up = (e.at?.[1] ?? 0) * scale
        return (
          <div className="world__fxgroup" key={`${stage.id}-${g}`} style={{ top: `calc(46% - ${up}px)` }}>
            {Array.from({ length: n }, (_, i) => (
              <span
                key={i}
                style={
                  {
                    background: kind.colour,
                    '--dx': `${(spread(i + g * 97) - 0.5) * 3.2 * scale}px`,
                    '--dy': `${-kind.rise * 7 * scale}px`,
                    '--sz': `${Math.max(2, scale * 0.42)}px`,
                    animationDuration: `${life}s`,
                    animationDelay: `${(i / n) * life}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
