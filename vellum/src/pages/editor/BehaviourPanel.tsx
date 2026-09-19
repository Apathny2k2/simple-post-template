/* ---------------------------------------------------------------
   Authoring a behaviour: what arms it, and what it does once armed.

   Two lists and a clock. The requirements are checked by the plugin
   against the world; the stages are a cycle this panel can run on the
   spot, so a geyser can be watched charging and blowing before it has
   ever been near a server.
   --------------------------------------------------------------- */

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
  /** where the preview clock is, so the cycle bar can show it */
  now: StageAt
  playing: boolean
  onPlaying: (p: boolean) => void
  /** fill in the worked example, for a model that has the clips for it */
  onGeyser: () => void
  /** the shared numeric row, passed in so there is one implementation */
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
        <div className="bhv-empty">
          <p className="ed-hint">
            <Icon name="info" size={11} />A clip says how this moves. A behaviour says when: what has
            to be around it before anything runs, and the cycle it repeats once that holds.
          </p>
          <button className="btn btn--sm btn--block" onClick={onGeyser} style={{ marginTop: 10 }}>
            <Icon name="bucket" size={13} /> Start from the geyser
          </button>
        </div>
      ) : null}

      {/* ---------------- what arms it ---------------- */}
      <div className="bhv-sec">
        <div className="bhv-sec__head">
          <span className="bhv-sec__title">Requires</span>
          <button
            className="chip"
            onClick={() => setRequires([...behaviour.requires, makeRequirement([0, -1, 0], 'minecraft:water')])}
          >
            <Icon name="plus" size={11} /> Add
          </button>
        </div>

        {behaviour.requires.length ? (
          <div className="bhv-list">
            {behaviour.requires.map((r) => (
              <div className="bhv-req" key={r.id}>
                <div className="bhv-req__top">
                  <select
                    className="ed-select bhv-req__block"
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
                    className="ed-tool bhv-x"
                    onClick={() => setRequires(behaviour.requires.filter((x) => x.id !== r.id))}
                    title={`Remove the ${r.block || 'block'} requirement`}
                    aria-label={`Remove the ${r.block || 'block'} requirement`}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>

                {!COMMON_BLOCKS.includes(r.block) ? (
                  <input
                    className="field__input bhv-req__id"
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

                <div className="nf-grid">
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
                {/* three numbers is exactly where an off-by-one hides */}
                <div className="bhv-req__says">{offsetLabel(r.at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="bhv-none">
            Nothing required — the cycle runs from the moment the block is placed.
          </p>
        )}
      </div>

      {/* ---------------- the cycle ---------------- */}
      <div className="bhv-sec">
        <div className="bhv-sec__head">
          <span className="bhv-sec__title">Cycle</span>
          <span className="bhv-sec__meta mono">{total.toFixed(1)}s</span>
          <button
            className="chip"
            onClick={() => setStages([...behaviour.stages, makeStage(`stage ${behaviour.stages.length + 1}`, 2)])}
          >
            <Icon name="plus" size={11} /> Add
          </button>
        </div>

        {behaviour.stages.length ? (
          <>
            {/* the whole cycle at a glance, with the clock on it */}
            <div
              className="bhv-bar"
              role="img"
              aria-label={`Cycle of ${behaviour.stages.length} stages, ${total.toFixed(1)} seconds`}
            >
              {behaviour.stages.map((s, i) => (
                <div
                  key={s.id}
                  className="bhv-bar__seg"
                  data-on={i === now.index || undefined}
                  style={{ flexGrow: Math.max(0.01, s.seconds) }}
                  title={`${s.name} · ${s.seconds}s`}
                >
                  <span>{s.name}</span>
                </div>
              ))}
              {total > 0 ? (
                <div
                  className="bhv-bar__head"
                  style={{ left: `${(elapsed(behaviour, now) / total) * 100}%` }}
                />
              ) : null}
            </div>

            <div className="row-actions bhv-play">
              <button
                className="btn btn--sm btn--primary"
                onClick={() => onPlaying(!playing)}
                aria-pressed={playing}
              >
                <Icon name={playing ? 'pause' : 'play'} size={12} /> {playing ? 'Pause' : 'Run the cycle'}
              </button>
              <span className="bhv-play__now mono">
                {now.stage ? `${now.stage.name} · ${now.local.toFixed(1)}s` : 'idle'}
              </span>
            </div>

            <div className="bhv-list">
              {behaviour.stages.map((s, i) => (
                <div className="bhv-stage" key={s.id} data-on={i === now.index || undefined}>
                  <div className="bhv-stage__top">
                    <input
                      className="field__input bhv-stage__name"
                      value={s.name}
                      aria-label="Stage name"
                      onChange={(e) => patchStage(s.id, { name: e.target.value })}
                    />
                    <input
                      className="field__input bhv-stage__secs mono"
                      type="number"
                      min={0}
                      step={0.1}
                      value={s.seconds}
                      aria-label={`${s.name} seconds`}
                      onChange={(e) => patchStage(s.id, { seconds: Number(e.target.value) })}
                    />
                    <button
                      className="ed-tool bhv-x"
                      onClick={() => moveStage(i, -1)}
                      disabled={i === 0}
                      title="Earlier in the cycle"
                      aria-label={`Move ${s.name} earlier`}
                    >
                      <Icon name="chevronUp" size={12} />
                    </button>
                    <button
                      className="ed-tool bhv-x"
                      onClick={() => moveStage(i, 1)}
                      disabled={i === behaviour.stages.length - 1}
                      title="Later in the cycle"
                      aria-label={`Move ${s.name} later`}
                    >
                      <Icon name="chevronDown" size={12} />
                    </button>
                    <button
                      className="ed-tool bhv-x"
                      onClick={() => setStages(behaviour.stages.filter((x) => x.id !== s.id))}
                      title={`Remove ${s.name}`}
                      aria-label={`Remove ${s.name}`}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>

                  <select
                    className="ed-select bhv-stage__clip"
                    value={s.clip ?? ''}
                    aria-label={`Clip for ${s.name}`}
                    onChange={(e) => patchStage(s.id, { clip: e.target.value || null })}
                  >
                    <option value="">No clip — hold the rest pose</option>
                    {clips.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {s.effects.map((e, n) => (
                    <div className="bhv-fx" key={n}>
                      <select
                        className="ed-select bhv-fx__kind"
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
                          className="ed-select bhv-fx__id"
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
                          className="field__input bhv-fx__id"
                          value={e.id ?? ''}
                          placeholder="namespace:sound"
                          aria-label="Sound id"
                          onChange={(ev) => patchEffect(s.id, n, { id: ev.target.value })}
                        />
                      ) : (
                        <span className="bhv-fx__id bhv-fx__flat">units</span>
                      )}

                      <input
                        className="field__input bhv-fx__amt mono"
                        type="number"
                        min={0}
                        step={e.kind === 'shake' ? 0.1 : 1}
                        value={e.amount}
                        aria-label="Amount"
                        onChange={(ev) => patchEffect(s.id, n, { amount: Number(ev.target.value) })}
                      />
                      <button
                        className="ed-tool bhv-x"
                        onClick={() => dropEffect(s.id, n)}
                        title="Remove this effect"
                        aria-label={`Remove the ${e.kind} effect from ${s.name}`}
                      >
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ))}

                  <div className="chip-row bhv-stage__add">
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
          <p className="bhv-none">No stages yet, so meeting the requirements does nothing.</p>
        )}
      </div>

      {behaviour !== EMPTY_BEHAVIOUR && !empty ? (
        <p className="ed-hint" style={{ marginTop: 10 }}>
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
