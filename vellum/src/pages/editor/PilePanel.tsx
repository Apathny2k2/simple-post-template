/* A pile set's settings in Model mode: how many pieces a pile holds, what a
   full pile does, the sounds, and the materials (which items pile with this
   piece, and in which texture), with a look at any stage of any material. */

import { useMemo, useState } from 'react'
import type { Model } from '../../lib/model'
import { Icon } from '../../lib/icons'
import { ModelView } from '../../components/ModelView'
import { PILE_MAX, PILE_PRESETS, pileSetOf, pileStageModel } from '../../lib/pile'
import type { PileMaterial, PileSet, PileShape } from '../../lib/pile'

export function PilePanel({ model, set, onChange }: { model: Model; set: PileSet; onChange: (next: PileSet, label: string) => void }) {
  const [shown, setShown] = useState(0)
  const [count, setCount] = useState(Math.min(5, set.max))
  const material = set.materials[Math.min(shown, set.materials.length - 1)]
  const stage = useMemo(() => (material ? pileStageModel(model, material, Math.min(count, material.max ?? set.max, set.max)) : null), [model, material, count, set.max])

  const patch = (i: number, m: Partial<PileMaterial>, label: string) =>
    onChange({ ...set, materials: set.materials.map((x, j) => (j === i ? { ...x, ...m } : x)) }, label)

  return (
    <div className="pile">
      <p className="editor-hint">
        This model is one flat piece. Placed on a block, the items below lie there as it, up to {set.max} to a pile, and breaking the pile drops them. The plugin does the placing.
      </p>

      {stage ? (
        <div className="pile__preview">
          <div className="pile__view">
            <ModelView model={stage} scale={6} grid={false} orbit zoomable={false} initialYaw={-30} initialPitch={-35} anchorOn={[8, 0, 8]} />
          </div>
          <div className="pile__controls">
            <select className="editor-select" aria-label="Material shown" value={shown} onChange={(e) => setShown(Number(e.target.value))}>
              {set.materials.map((m, i) => (
                <option key={i} value={i}>
                  {m.name}
                </option>
              ))}
            </select>
            <label className="pile__count">
              <input type="range" min={1} max={set.max} value={Math.min(count, set.max)} aria-label="Pieces in the pile" onChange={(e) => setCount(Number(e.target.value))} />
              <span className="mono">{Math.min(count, set.max)}</span>
            </label>
          </div>
        </div>
      ) : null}

      <div className="pile__row">
        <label>
          <span>Most in a pile</span>
          <input
            type="number"
            min={1}
            max={PILE_MAX}
            aria-label="Most in a pile"
            value={set.max}
            onChange={(e) => onChange({ ...set, max: Math.max(1, Math.min(PILE_MAX, Math.round(Number(e.target.value) || 1))) }, 'pile size')}
          />
        </label>
        <label>
          <span>When full</span>
          <select className="editor-select" aria-label="When full" value={set.whenFull} onChange={(e) => onChange({ ...set, whenFull: e.target.value as PileSet['whenFull'] }, 'when full')}>
            <option value="new-pile">Start a new pile</option>
            <option value="refuse">Take no more</option>
          </select>
        </label>
      </div>
      <div className="pile__row">
        <label>
          <span>Place sound</span>
          <input
            aria-label="Place sound"
            placeholder="minecraft:block.amethyst_block.place"
            defaultValue={set.sound?.place ?? ''}
            onBlur={(e) => onChange({ ...set, sound: { ...set.sound, place: e.target.value.trim() || undefined } }, 'pile sound')}
          />
        </label>
        <label>
          <span>Break sound</span>
          <input
            aria-label="Break sound"
            placeholder="minecraft:block.amethyst_block.break"
            defaultValue={set.sound?.break ?? ''}
            onBlur={(e) => onChange({ ...set, sound: { ...set.sound, break: e.target.value.trim() || undefined } }, 'pile sound')}
          />
        </label>
      </div>

      <div className="pile__head">
        <span>Materials</span>
        <select
          className="editor-select"
          aria-label="Fill from a vanilla set"
          value=""
          onChange={(e) => {
            const shape = e.target.value as PileShape
            if (shape) onChange({ ...set, materials: pileSetOf(shape).materials }, 'pile materials')
          }}
        >
          <option value="">Fill from a vanilla set…</option>
          {(Object.keys(PILE_PRESETS) as PileShape[]).map((k) => (
            <option key={k} value={k}>
              {PILE_PRESETS[k].label}
            </option>
          ))}
        </select>
      </div>
      <ul className="pile__materials">
        {set.materials.map((m, i) => (
          <li key={i} className="pile__material">
            <div className="pile__line">
              <input
                className="pile__name"
                aria-label="Material name"
                defaultValue={m.name}
                key={`${i}:${m.name}`}
                onBlur={(e) => e.target.value.trim() !== m.name && patch(i, { name: e.target.value.trim() }, 'material name')}
              />
              <button className="insp-head__delete" aria-label={`Remove ${m.name}`} onClick={() => onChange({ ...set, materials: set.materials.filter((_, j) => j !== i) }, 'remove material')}>
                <Icon name="trash" size={13} />
              </button>
            </div>
            <input
              aria-label={`Items for ${m.name}`}
              placeholder="minecraft:emerald, #c:gems"
              defaultValue={m.match.join(', ')}
              key={`${i}:${m.match.join()}`}
              onBlur={(e) =>
                patch(
                  i,
                  {
                    match: e.target.value
                      .split(/[\s,]+/)
                      .map((v) => v.trim())
                      .filter(Boolean),
                  },
                  'material items',
                )
              }
            />
            <div className="pile__line">
              <select
                className="editor-select"
                aria-label={`Texture kind for ${m.name}`}
                value={m.texture.kind}
                onChange={(e) =>
                  patch(
                    i,
                    {
                      texture:
                        e.target.value === 'custom'
                          ? { kind: 'custom', texture: model.textures[0]?.id ?? '' }
                          : { kind: 'vanilla', path: m.match.find((x) => !x.startsWith('#'))?.replace(':', ':item/') ?? 'minecraft:item/' },
                    },
                    'material texture',
                  )
                }
              >
                <option value="vanilla">Vanilla</option>
                <option value="custom">Custom</option>
              </select>
              {m.texture.kind === 'vanilla' ? (
                <input
                  aria-label={`Vanilla texture for ${m.name}`}
                  defaultValue={m.texture.path}
                  key={`${i}:${m.texture.path}`}
                  onBlur={(e) => patch(i, { texture: { kind: 'vanilla', path: e.target.value.trim() } }, 'material texture')}
                />
              ) : (
                <select
                  className="editor-select"
                  aria-label={`Custom texture for ${m.name}`}
                  value={m.texture.texture}
                  onChange={(e) => patch(i, { texture: { kind: 'custom', texture: e.target.value } }, 'material texture')}
                >
                  {model.textures.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button
        className="chip"
        onClick={() => onChange({ ...set, materials: [...set.materials, { name: `material_${set.materials.length + 1}`, match: [], texture: { kind: 'vanilla', path: 'minecraft:item/' } }] }, 'add material')}
      >
        <Icon name="plus" size={11} /> Material
      </button>
      <p className="editor-hint">
        A vanilla texture is the game&rsquo;s own icon and changes with a player&rsquo;s texture pack. The preview shows it as a plain swatch of its colour. A custom texture is one of this model&rsquo;s.
      </p>
    </div>
  )
}
