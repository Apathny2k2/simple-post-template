import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ModelView } from './ModelView'
import { Icon } from '../lib/icons'
import { useModal } from '../lib/a11y'
import { BLOCK, buildWorld, defaultPlacement, sceneClip } from '../lib/world'
import type { Placement } from '../lib/world'
import type { Clip, Model, ProjectKind } from '../lib/model'
import './WorldScene.css'

const PLACEMENTS: Array<{ id: Placement; label: string; blurb: string }> = [
  { id: 'ground', label: 'On the ground', blurb: 'Standing on the grass, at its real size.' },
  { id: 'air', label: 'Held in the air', blurb: 'Hovering and turning, the way an item model is inspected.' },
  { id: 'dropped', label: 'Dropped', blurb: 'On the floor at a quarter size, turning and bobbing.' },
]

/**
 * A model, in a world, at a size you can judge.
 *
 * The scene is an ordinary `.vellum` - terrain, the player and the
 * model itself are all cubes on bones - so the renderer, the camera and
 * the animation system need to know nothing about any of this.
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
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)

  /* Rebuilding this paints two canvases, so it is memoised on the few
     things that actually change it rather than on every frame. */
  const built = useMemo(
    () => buildWorld(model, { kind, placement, withPlayer }),
    [model, kind, placement, withPlayer],
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

  /* The platform is 7 blocks across and the tree stands 4 above it, so
     what has to fit is about 140 units either way. The scene is anchored
     at its middle rather than its floor - there is no grid for it to
     stand on, and standing it on one left the whole island in the top
     half of the frame. */
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

  const label = built.blocks >= 1 ? `${built.blocks} blocks tall` : `${Math.round(built.blocks * BLOCK)} units tall`

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
          <ModelView
            key={`${placement}-${withPlayer}`}
            model={built.model}
            scale={scale}
            grid={false}
            orbit
            initialYaw={-38}
            initialPitch={-14}
            clip={scene}
            time={time}
            anchorAt="centre"
            /* a dropped potion is small, and that is the truth the scene
               is there to tell - so the camera looks at the item and lets
               the island fall where it falls, rather than framing an
               island with a speck on it */
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
