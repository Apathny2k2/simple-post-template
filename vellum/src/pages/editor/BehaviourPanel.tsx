/* Behaviour editor: the blocks that arm a behaviour, and the stage cycle
   it runs. The cycle can be previewed here without a server. */

import { Icon } from '../../lib/icons'
import {
  COMMON_BLOCKS,
  EMPTY_BEHAVIOUR,
  PARTICLES,
  cycleLength,
  makeRequirement,
  makeStage,
  offsetLabel,
  particleById,
} from '../../lib/behaviour'
import type { Behaviour, BehaviourEffect, EffectKind, StageAt } from '../../lib/behaviour'
import type { Clip, Model, Vec3 } from '../../lib/model'

const EFFECT_KINDS: Array<{ id: EffectKind; label: string }> = [
  { id: 'particles', label: 'Particles' },
  { id: 'shake', label: 'Shake' },
  { id: 'sound', label: 'Sound' },
]

export function BehaviourPanel({
  model,
  behaviour,
  onChange,
  now,
  playing,
  onPlaying,
  onGeyser,
  children,
}: {
  model: Model
  behaviour: Behaviour
  onChange: (next: Behaviour) => void
  /** the preview clock's position, shown on the cycle bar */
  now: StageAt
  playing: boolean
  onPlaying: (p: boolean) => void
  /** fills in the geyser example, matching the model's clips by name */
  onGeyser: () => void
  /** renders Editor's NumRow for these rows */
  children: (rows: { label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number }[]) => React.ReactNode
}) {
  const total = cycleLength(behaviour)
  const clips: Clip[] = model.clips

  const setRequires = (requires: Behaviour['requires']) => onChange({ ...behaviour, requires })
  const setStages = (stages: Behaviour['stages']) => onChange({ ...behaviour, stages })
  const patchStage = (id: string, patch: Partial<Behaviour['stages'][number]>) =>
    setStages(behaviour.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const moveStage = (i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= behaviour.stages.length) return
    const next = [...behaviour.stages]
    ;[next[i], next[j]] = [next[j], next[i]]
    setStages(next)
  }

  const addEffect = (stageId: string, kind: EffectKind) => {
    const effect: BehaviourEffect =
      kind === 'particles'
        ? { kind, id: PARTICLES[0].id, amount: 12, at: [0, 16, 0] }
        : kind === 'shake'
          ? { kind, amount: 0.4 }
          : { kind, id: 'minecraft:block.fire.extinguish', amount: 1 }
    const stage = behaviour.stages.find((s) => s.id === stageId)
    if (stage) patchStage(stageId, { effects: [...stage.effects, effect] })
  }

  const patchEffect = (stageId: string, i: number, patch: Partial<BehaviourEffect>) => {
    const stage = behaviour.stages.find((s) => s.id === stageId)
    if (!stage) return
    patchStage(stageId, { effects: stage.effects.map((e, n) => (n === i ? { ...e, ...patch } : e)) })
  }

  const dropEffect = (stageId: string, i: number) => {
    const stage = behaviour.stages.find((s) => s.id === stageId)
    if (!stage) return
    patchStage(stageId, { effects: stage.effects.filter((_, n) => n !== i) })
  }

  const empty = !behaviour.requires.length && !behaviour.stages.length

  return (
    <>
      {empty ? (
        <div className="behaviour-empty">
          <p className="editor-hint">
            <Icon name="info" size={11} />A behaviour decides when clips play: which blocks must be
            nearby, and the cycle that repeats once they are.
          </p>
          <button className="btn btn--sm btn--block" onClick={onGeyser} style={{ marginTop: 10 }}>
            <Icon name="bucket" size={13} /> Start from the geyser
          </button>
        </div>
      ) : null}

      {/* ---------------- what arms it ---------------- */}
      <div className="behaviour-section">
        <div className="behaviour-section__head">
          <span className="behaviour-section__title">Requires</span>
          <button
            className="chip"
            onClick={() => setRequires([...behaviour.requires, makeRequirement([0, -1, 0], 'minecraft:water')])}
          >
            <Icon name="plus" size={11} /> Add
          </button>
        </div>

        {behaviour.requires.length ? (
          <div className="behaviour-list">
            {behaviour.requires.map((r) => (
              <div className="behaviour-requirement" key={r.id}>
                <div className="behaviour-requirement__top">
                  <select
                    className="editor-select behaviour-requirement__block"
                    value={COMMON_BLOCKS.includes(r.block) ? r.block : '__other'}
                    onChange={(e) =>
                      setRequires(
                        behaviour.requires.map((x) =>
                          x.id === r.id
                            ? { ...x, block: e.target.value === '__other' ? '' : e.target.value }
                            : x,
                        ),
                      )
                    }
                    aria-label="Required block"
                  >
                    {COMMON_BLOCKS.map((b) => (
                      <option key={b} value={b}>
                        {b.replace('minecraft:', '')}
                      </option>
                    ))}
                    <option value="__other">other…</option>
                  </select>
                  <button
                    className="editor-tool behaviour-remove"
                    onClick={() => setRequires(behaviour.requires.filter((x) => x.id !== r.id))}
                    title={`Remove the ${r.block || 'block'} requirement`}
                    aria-label={`Remove the ${r.block || 'block'} requirement`}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>

                {!COMMON_BLOCKS.includes(r.block) ? (
                  <input
                    className="field__input behaviour-requirement__id"
                    value={r.block}
                    placeholder="namespace:block"
                    aria-label="Block id"
                    onChange={(e) =>
                      setRequires(
                        behaviour.requires.map((x) => (x.id === r.id ? { ...x, block: e.target.value } : x)),
                      )
                    }
                  />
                ) : null}

                <div className="num-field-grid">
                  {children([
                    {
                      label: 'At',
                      value: r.at,
                      step: 1,
                      onChange: (at) =>
                        setRequires(behaviour.requires.map((x) => (x.id === r.id ? { ...x, at } : x))),
                    },
                  ])}
                </div>
                {/* the offset in words, since three bare numbers are easy to misread */}
                <div className="behaviour-requirement__says">{offsetLabel(r.at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="behaviour-none">
            Nothing required. The cycle starts as soon as the block is placed.
          </p>
        )}
      </div>

      {/* ---------------- the cycle ---------------- */}
      <div className="behaviour-section">
        <div className="behaviour-section__head">
          <span className="behaviour-section__title">Cycle</span>
          <span className="behaviour-section__meta mono">{total.toFixed(1)}s</span>
          <button
            className="chip"
            onClick={() => setStages([...behaviour.stages, makeStage(`stage ${behaviour.stages.length + 1}`, 2)])}
          >
            <Icon name="plus" size={11} /> Add
          </button>
        </div>

        {behaviour.stages.length ? (
          <>
            <div
              className="behaviour-bar"
              role="img"
              aria-label={`Cycle of ${behaviour.stages.length} stages, ${total.toFixed(1)} seconds`}
            >
              {behaviour.stages.map((s, i) => (
                <div
                  key={s.id}
                  className="behaviour-bar__segment"
                  data-on={i === now.index || undefined}
                  style={{ flexGrow: Math.max(0.01, s.seconds) }}
                  title={`${s.name} · ${s.seconds}s`}
                >
                  <span>{s.name}</span>
                </div>
              ))}
              {total > 0 ? (
                <div
                  className="behaviour-bar__head"
                  style={{ left: `${(elapsed(behaviour, now) / total) * 100}%` }}
                />
              ) : null}
            </div>

            <div className="row-actions behaviour-play">
              <button
                className="btn btn--sm btn--primary"
                onClick={() => onPlaying(!playing)}
                aria-pressed={playing}
              >
                <Icon name={playing ? 'pause' : 'play'} size={12} /> {playing ? 'Pause' : 'Run the cycle'}
              </button>
              <span className="behaviour-play__now mono">
                {now.stage ? `${now.stage.name} · ${now.local.toFixed(1)}s` : 'idle'}
              </span>
            </div>

            <div className="behaviour-list">
              {behaviour.stages.map((s, i) => (
                <div className="behaviour-stage" key={s.id} data-on={i === now.index || undefined}>
                  <div className="behaviour-stage__top">
                    <input
                      className="field__input behaviour-stage__name"
                      value={s.name}
                      aria-label="Stage name"
                      onChange={(e) => patchStage(s.id, { name: e.target.value })}
                    />
                    <input
                      className="field__input behaviour-stage__seconds mono"
                      type="number"
                      min={0}
                      step={0.1}
                      value={s.seconds}
                      aria-label={`${s.name} seconds`}
                      onChange={(e) => patchStage(s.id, { seconds: Number(e.target.value) })}
                    />
                    <button
                      className="editor-tool behaviour-remove"
                      onClick={() => moveStage(i, -1)}
                      disabled={i === 0}
                      title="Earlier in the cycle"
                      aria-label={`Move ${s.name} earlier`}
                    >
                      <Icon name="chevronUp" size={12} />
                    </button>
                    <button
                      className="editor-tool behaviour-remove"
                      onClick={() => moveStage(i, 1)}
                      disabled={i === behaviour.stages.length - 1}
                      title="Later in the cycle"
                      aria-label={`Move ${s.name} later`}
                    >
                      <Icon name="chevronDown" size={12} />
                    </button>
                    <button
                      className="editor-tool behaviour-remove"
                      onClick={() => setStages(behaviour.stages.filter((x) => x.id !== s.id))}
                      title={`Remove ${s.name}`}
                      aria-label={`Remove ${s.name}`}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>

                  <select
                    className="editor-select behaviour-stage__clip"
                    value={s.clip ?? ''}
                    aria-label={`Clip for ${s.name}`}
                    onChange={(e) => patchStage(s.id, { clip: e.target.value || null })}
                  >
                    <option value="">No clip (hold the rest pose)</option>
                    {clips.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {s.effects.map((e, n) => (
                    <div className="behaviour-effect" key={n}>
                      <select
                        className="editor-select behaviour-effect__kind"
                        value={e.kind}
                        aria-label="Effect"
                        onChange={(ev) =>
                          patchEffect(s.id, n, { kind: ev.target.value as EffectKind })
                        }
                      >
                        {EFFECT_KINDS.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label}
                          </option>
                        ))}
                      </select>

                      {e.kind === 'particles' ? (
                        <select
                          className="editor-select behaviour-effect__id"
                          value={particleById(e.id).id}
                          aria-label="Particle"
                          onChange={(ev) => patchEffect(s.id, n, { id: ev.target.value })}
                        >
                          {PARTICLES.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.label}
                            </option>
                          ))}
                        </select>
                      ) : e.kind === 'sound' ? (
                        <input
                          className="field__input behaviour-effect__id"
                          value={e.id ?? ''}
                          placeholder="namespace:sound"
                          aria-label="Sound id"
                          onChange={(ev) => patchEffect(s.id, n, { id: ev.target.value })}
                        />
                      ) : (
                        <span className="behaviour-effect__id behaviour-effect__flat">units</span>
                      )}

                      <input
                        className="field__input behaviour-effect__amount mono"
                        type="number"
                        min={0}
                        step={e.kind === 'shake' ? 0.1 : 1}
                        value={e.amount}
                        aria-label="Amount"
                        onChange={(ev) => patchEffect(s.id, n, { amount: Number(ev.target.value) })}
                      />
                      <button
                        className="editor-tool behaviour-remove"
                        onClick={() => dropEffect(s.id, n)}
                        title="Remove this effect"
                        aria-label={`Remove the ${e.kind} effect from ${s.name}`}
                      >
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ))}

                  <div className="chip-row behaviour-stage__add">
                    {EFFECT_KINDS.map((k) => (
                      <button key={k.id} className="chip" onClick={() => addEffect(s.id, k.id)}>
                        <Icon name="plus" size={10} /> {k.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="behaviour-none">No stages yet, so meeting the requirements does nothing.</p>
        )}
      </div>

      {behaviour !== EMPTY_BEHAVIOUR && !empty ? (
        <p className="editor-hint" style={{ marginTop: 10 }}>
          <Icon name="info" size={11} />
          The plugin checks the requirements against the world and runs this clock. Here it runs on
          its own so you can watch it.
        </p>
      ) : null}
    </>
  )
}

/** Seconds from the start of the cycle to the clock's current position. */
function elapsed(b: Behaviour, now: StageAt): number {
  if (now.index < 0) return 0
  let n = 0
  for (let i = 0; i < now.index; i++) n += Math.max(0, b.stages[i].seconds)
  return n + now.local
}
