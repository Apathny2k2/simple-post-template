/* ---------------------------------------------------------------
   What the Display tab is for a mob.

   The eight display slots are an item's: they pose a model in a hand,
   in a GUI cell, on a head, in an item frame. A mob is never in any of
   them - it stands in the world at its own size - so showing a mob
   modeller "Third person, right hand" is offering a control that does
   nothing and implying a transform the game will never read.

   What a mob modeller actually needs to know is the thing an editor
   viewport cannot tell them: how big this is next to a player, and
   whether the walk they just keyed covers ground or moonwalks. Both
   are measured here rather than eyeballed.
   --------------------------------------------------------------- */

import { BLOCK, travelOf } from '../../lib/world'
import { Icon } from '../../lib/icons'
import type { Clip, Model } from '../../lib/model'

/** A player is two blocks tall, and that is the only yardstick in the game. */
const PLAYER_BLOCKS = 2

function boundsOf(model: Model) {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const c of model.cubes) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], c.from[i])
      hi[i] = Math.max(hi[i], c.to[i])
    }
  }
  return model.cubes.length ? ([0, 1, 2].map((i) => hi[i] - lo[i]) as [number, number, number]) : ([0, 0, 0] as [number, number, number])
}

/** How this reads beside a player, in the words a person would use. */
function against(blocks: number): string {
  if (blocks <= 0) return 'nothing to measure yet'
  const ratio = blocks / PLAYER_BLOCKS
  if (ratio < 0.35) return 'knee-high to a player'
  if (ratio < 0.7) return 'waist-high to a player'
  if (ratio < 0.95) return 'shorter than a player'
  if (ratio <= 1.08) return 'about player height'
  if (ratio < 1.8) return 'taller than a player'
  return `${ratio.toFixed(1)}x a player — it will not fit through a door`
}

export function ScenePanel({
  model,
  clip,
  clips,
  onClip,
  onWorld,
}: {
  model: Model
  clip: Clip | null
  clips: Clip[]
  onClip: (id: string) => void
  onWorld: () => void
}) {
  const [w, h, d] = boundsOf(model)
  const blocks = h / BLOCK
  const travel = travelOf(model, clip)

  return (
    <>
      <div className="kv scene-kv">
        <div className="kv__row">
          <span className="kv__k">Height</span>
          <span className="kv__v">
            {h.toFixed(1)}u &middot; {blocks.toFixed(2)} blocks
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">Footprint</span>
          <span className="kv__v">
            {w.toFixed(1)} x {d.toFixed(1)}u
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">Beside a player</span>
          <span className="kv__v">{against(blocks)}</span>
        </div>
      </div>

      {/* No "none" option: the editor always falls back to the first
          clip, so offering one would be a control that quietly snapped
          back to where it was. */}
      {clips.length ? (
        <label className="field" style={{ marginTop: 12 }}>
          <span className="field__label">Clip the scene loops</span>
          <select
            className="ed-select"
            style={{ width: '100%', height: 'auto', padding: '6px 10px' }}
            value={clip?.id ?? ''}
            onChange={(e) => onClip(e.target.value)}
          >
            {clips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* The one thing the timeline cannot show: a walk plays in place
          there whether or not the legs are carrying the mob anywhere. */}
      <p className="ed-hint scene-travel" data-moving={travel.blocks > 0 || undefined}>
        <Icon name={travel.blocks > 0 ? 'move' : 'info'} size={11} />
        {!clip ? (
          'No clips yet, so it will stand in the world. Key one in Animate.'
        ) : travel.blocks > 0 ? (
          <>
            Its legs ask for <strong>{travel.blocks}</strong> block{travel.blocks === 1 ? '' : 's'} a
            stride, so the ground moves at {(travel.speed / BLOCK).toFixed(2)} blocks/s under it.
          </>
        ) : (
          `"${clip.name}" does not travel — it plays in place, which is right for an idle or an attack and a moonwalk for a walk.`
        )}
      </p>

      <button className="btn btn--primary" style={{ width: '100%', marginTop: 12 }} onClick={onWorld}>
        <Icon name="scene" size={14} /> View in the real world
      </button>

      <p className="ed-hint" style={{ marginTop: 10 }}>
        <Icon name="info" size={11} />
        No display slots: those pose an item in a hand, a GUI cell or an item frame, and a mob is
        never in one. It stands in the world at the size above.
      </p>
    </>
  )
}
