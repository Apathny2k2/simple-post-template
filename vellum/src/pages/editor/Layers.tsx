/* Paint mode's Layers panel, top layer first as paint programs list them.
   A click picks the layer strokes go to; the eye hides one, the field sets
   how strongly it shows. With no layers yet, the texture is one image and
   + Layer splits it into a base and a clear layer on top. */

import type { Texture } from '../../lib/model'
import { Icon } from '../../lib/icons'

export type LayerOps = {
  add: (texId: string) => void
  remove: (texId: string, layer: string) => void
  patch: (texId: string, layer: string, patch: Partial<{ name: string; visible: boolean; opacity: number }>, label: string) => void
  move: (texId: string, layer: string, by: 1 | -1) => void
  mergeDown: (texId: string, layer: string) => void
  flatten: (texId: string) => void
  pick: (texId: string, layer: string) => void
}

export function LayersPanel({ texture, active, ops }: { texture: Texture; active: string | null; ops: LayerOps }) {
  const layers = texture.layers ?? []
  if (!layers.length) {
    return (
      <>
        <p className="editor-hint">{texture.name} is one image. Add a layer to paint on top of it without touching it.</p>
        <button className="chip" onClick={() => ops.add(texture.id)}>
          <Icon name="plus" size={11} /> Layer
        </button>
      </>
    )
  }
  const top = [...layers].reverse()
  const at = layers.findIndex((l) => l.id === active)
  return (
    <div className="layers">
      <ol className="layers__list" aria-label={`Layers of ${texture.name}`}>
        {top.map((l) => (
          <li key={l.id} className={`layers__row${l.id === active ? ' layers__row--on' : ''}`}>
            <button
              className="layers__eye"
              aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
              aria-pressed={l.visible}
              onClick={() => ops.patch(texture.id, l.id, { visible: !l.visible }, l.visible ? 'hide layer' : 'show layer')}
            >
              <Icon name={l.visible ? 'eye' : 'eyeOff'} size={13} />
            </button>
            <span className="layers__thumb" style={{ backgroundImage: `url(${l.source})` }} aria-hidden="true" />
            <button className="layers__name" aria-pressed={l.id === active} onClick={() => ops.pick(texture.id, l.id)} title="Paint on this layer">
              {l.name}
            </button>
            <input
              className="layers__opacity"
              type="number"
              min={0}
              max={100}
              step={5}
              aria-label={`Opacity of ${l.name}`}
              value={Math.round(l.opacity * 100)}
              onChange={(e) => ops.patch(texture.id, l.id, { opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 }, 'layer opacity')}
            />
            <span className="layers__pct">%</span>
          </li>
        ))}
      </ol>
      <div className="chip-row">
        <button className="chip" onClick={() => ops.add(texture.id)}>
          <Icon name="plus" size={11} /> Layer
        </button>
        <button className="chip" disabled={at < 0 || at >= layers.length - 1} onClick={() => active && ops.move(texture.id, active, 1)} title="Move the layer up">
          Up
        </button>
        <button className="chip" disabled={at < 1} onClick={() => active && ops.move(texture.id, active, -1)} title="Move the layer down">
          Down
        </button>
        <button className="chip" disabled={at < 1} onClick={() => active && ops.mergeDown(texture.id, active)} title="Paint this layer onto the layer under it">
          Merge down
        </button>
        <button className="chip" onClick={() => ops.flatten(texture.id)} title="Make the texture one image again">
          Flatten
        </button>
        <button className="chip chip--danger" disabled={!active} onClick={() => active && ops.remove(texture.id, active)}>
          Delete
        </button>
      </div>
    </div>
  )
}
