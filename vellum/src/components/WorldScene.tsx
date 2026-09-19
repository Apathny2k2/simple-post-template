import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ModelView } from './ModelView'
import { Icon } from '../lib/icons'
import { useModal } from '../lib/a11y'
import { BLOCK, buildWorld, defaultPlacement, sceneClip } from '../lib/world'
import type { Placement, TimeOfDay } from '../lib/world'
import type { Clip, Model, ProjectKind } from '../lib/model'
import './WorldScene.css'

const PLACEMENTS: Array<{ id: Placement; label: string; blurb: string }> = [
  { id: 'ground', label: 'On the ground', blurb: 'Standing on the grass, at its real size.' },
  { id: 'air', label: 'Held in the air', blurb: 'Hovering and turning, the way an item model is inspected.' },
  { id: 'dropped', label: 'Dropped', blurb: 'On the floor at a quarter size, turning and bobbing.' },
]

/**
 * Stars, once, at fixed places. Regenerating them every render made the
 * night sky crawl, which is not a thing night skies do.
 */
const STARS = Array.from({ length: 64 }, (_, i) => {
  const n = (k: number) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
    return v - Math.floor(v)
  }
  return {
    left: n(1) * 100,
    top: n(2) * 62,
    size: n(3) > 0.88 ? 3 : 2,
    dim: 0.35 + n(4) * 0.6,
    twinkle: 2.6 + n(5) * 4,
    delay: n(6) * 4,
  }
})

const CLOUDS = [
  { top: 12, left: -20, w: 34, h: 4.5, dur: 190, delay: 0 },
  { top: 19, left: -60, w: 22, h: 3.5, dur: 240, delay: -60 },
  { top: 7, left: -100, w: 44, h: 5, dur: 300, delay: -140 },
  { top: 25, left: -45, w: 17, h: 3, dur: 210, delay: -30 },
]

/**
 * A model, in a world, at a size you can judge.
 *
 * The scene is an ordinary `.vellum` - terrain, the player and the
 * model itself are all cubes on bones - so the renderer, the camera and
 * the animation system need to know nothing about any of this. The sky
 * is the one part that is not: it is flat, it is behind everything, and
 * a cube is the wrong tool for it.
 */
export function WorldScene({
  model,
  kind,
  clip,
  clips,
  onClip,
  onClose,
}: {
  model: Model
  kind: ProjectKind
  clip: Clip | null
  clips: Clip[]
  onClip: (id: string | null) => void
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, onClose)

  const [placement, setPlacement] = useState<Placement>(() => defaultPlacement(kind, model.name))
  const [withPlayer, setWithPlayer] = useState(kind === 'mobs')
  const [sky, setSky] = useState<TimeOfDay>('day')
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)

  /* Rebuilding this paints a 512px sheet, so it is memoised on the few
     things that actually change it rather than on every frame. Night is
     one of them: the world is repainted darker rather than filtered,
     which is why the model keeps its own colours. */
  const built = useMemo(
    () => buildWorld(model, { kind, placement, withPlayer, sky }),
    [model, kind, placement, withPlayer, sky],
  )
  const scene = useMemo(() => sceneClip(built, clip), [built, clip])

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

  const fit = Math.min(box.w * 0.66, box.h * 0.86) / 140
  /* A dropped or hovering item is small on purpose, so the island stops
     being the subject and the camera comes in - the scenery is there for
     scale, not to be looked at. */
  const scale = Math.max(1, Math.min(14, fit * (built.placement === 'ground' ? 1 : 1.95)))

  /* The clock lives in a ref: an effect that depends on `time` and
     resets its own baseline every frame runs at half speed. */
  const timeRef = useRef(0)
  timeRef.current = time
  useEffect(() => {
    if (!playing || !scene) return
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
  }, [playing, scene])

  useEffect(() => {
    setTime(0)
  }, [scene])

  const reset = useCallback(() => setTime(0), [])

  /* Playing the animation here is the point of the scene, so a model
     that has one arrives with it running rather than with "none"
     selected and nothing moving. */
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
  const night = sky === 'night'

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

        <div className="world__stage" ref={stage} data-sky={sky}>
          {/* The sky, behind everything and flat, because it is a sky. */}
          <div className="world__sky" aria-hidden="true">
            <span className="world__body" />
            {night ? (
              <div className="world__stars">
                {STARS.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      left: `${s.left}%`,
                      top: `${s.top}%`,
                      width: s.size,
                      height: s.size,
                      opacity: s.dim,
                      animationDuration: `${s.twinkle}s`,
                      animationDelay: `${s.delay}s`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="world__clouds">
                {CLOUDS.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      top: `${c.top}%`,
                      left: `${c.left}%`,
                      width: `${c.w}%`,
                      height: `${c.h}%`,
                      animationDuration: `${c.dur}s`,
                      animationDelay: `${c.delay}s`,
                    }}
                  />
                ))}
              </div>
            )}
            {/* The stage origin projects to exactly 50% / 46% of this box,
                which is where the model stands - so at night the warm
                pool sits on it however the camera is turned. */}
            {night ? <span className="world__bloom" /> : null}
          </div>

          <ModelView
            key={`${placement}-${withPlayer}-${sky}`}
            model={built.model}
            scale={scale}
            grid={false}
            orbit
            initialYaw={-38}
            initialPitch={-14}
            clip={scene}
            time={time}
            anchorAt="centre"
            anchorOn={built.placement === 'ground' ? null : built.focus}
          />

          {withPlayer ? (
            <span className="world__hint">
              <Icon name="user" size={11} /> The player is two blocks tall. Yours is {label}.
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
            <span className="world__time mono">
              {time.toFixed(2)}s{scene ? ` / ${scene.length.toFixed(2)}s` : ''}
            </span>
          </div>

          <label className="world__field">
            <span>Animation</span>
            <select
              className="ed-select"
              value={clip?.id ?? ''}
              onChange={(e) => onClip(e.target.value || null)}
            >
              <option value="">none</option>
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

          <button
            className="chip"
            aria-pressed={night}
            onClick={() => setSky(night ? 'day' : 'night')}
            title="Darkens the world, not the model - so anything meant to glow does"
          >
            <Icon name={night ? 'moon' : 'sun'} size={11} /> {night ? 'Night' : 'Day'}
          </button>

          <button
            className="chip"
            aria-pressed={withPlayer}
            onClick={() => setWithPlayer((v) => !v)}
            title="A player-sized figure to judge height and reach against"
          >
            <Icon name="user" size={11} /> Player
          </button>

          <span className="world__note">
            {playing ? 'Drag to orbit while it plays' : 'Paused — drag to look around the pose'}
          </span>
        </footer>
      </div>
    </div>
  )
}
