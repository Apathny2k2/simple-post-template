/* Animate mode's Controllers panel: Bedrock animation controllers, made
   and played here. A controller is a set of states; each state plays some
   clips together and moves on when a Molang condition holds. Play runs the
   controller in the viewport with the conditions below it standing in for
   the mob (moving, on the ground, sneaking, in water, its health). */

import { useState } from 'react'
import type { Controller, ControllerState, Model } from '../../lib/model'
import { newId } from '../../lib/new-model'
import { molangError } from '../../lib/molang'
import { Icon } from '../../lib/icons'

/** What Play stands in for the mob, as Molang queries. */
export type PreviewQueries = { is_moving: number; ground_speed: number; is_on_ground: number; is_sneaking: number; is_in_water: number; health: number }

export const DEFAULT_PREVIEW: PreviewQueries = { is_moving: 0, ground_speed: 0, is_on_ground: 1, is_sneaking: 0, is_in_water: 0, health: 20 }

/** A clip's name without its `animation.<model>.` part, which every clip in the model shares. */
const shortName = (name: string) => name.replace(/^animation\.[^.]+\./, '')

function newState(name: string): ControllerState {
  return { id: newId(), name, clips: [], transitions: [] }
}

/** A Molang field that says under itself when it can't be read. */
function MolangInput({ value, label, placeholder, onCommit }: { value: string; label: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  const error = text.trim() ? molangError(text) : null
  return (
    <span className="ctrl__molang">
      <input
        key={value}
        className={`kf__molang-field${error ? ' kf__molang-field--bad' : ''}`}
        aria-label={label}
        placeholder={placeholder}
        spellCheck={false}
        defaultValue={value}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => e.target.value !== value && onCommit(e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {error ? <span className="ctrl__error">{error}</span> : null}
    </span>
  )
}

export function ControllersPanel({
  model,
  onChange,
  playing,
  onPlay,
  current,
  preview,
  onPreview,
}: {
  model: Model
  onChange: (controllers: Controller[], label: string) => void
  /** the controller playing in the viewport, if any */
  playing: string | null
  onPlay: (id: string | null) => void
  /** the state the playing controller is in */
  current: string | null
  preview: PreviewQueries
  onPreview: (q: PreviewQueries) => void
}) {
  const list = model.controllers ?? []
  const [pick, setPick] = useState<string | null>(list[0]?.id ?? null)
  const c = list.find((x) => x.id === pick) ?? list[0] ?? null

  const put = (next: Controller, label: string) => onChange(list.map((x) => (x.id === next.id ? next : x)), label)
  const putState = (st: ControllerState, label: string) => c && put({ ...c, states: c.states.map((x) => (x.id === st.id ? st : x)) }, label)

  const add = () => {
    const first = newState('default')
    const made: Controller = { id: newId(), name: `controller_${list.length + 1}`, initial: first.id, states: [first] }
    onChange([...list, made], 'add controller')
    setPick(made.id)
  }

  if (!c) {
    return (
      <>
        <p className="editor-hint">
          A controller switches between clips as the mob moves, as Bedrock does: a state plays clips together, and moves on when its Molang condition holds.
        </p>
        <button className="chip" onClick={add}>
          <Icon name="plus" size={11} /> Controller
        </button>
      </>
    )
  }

  return (
    <div className="ctrl">
      <div className="ctrl__head">
        {list.length > 1 ? (
          <select className="editor-select" aria-label="Controller" value={c.id} onChange={(e) => setPick(e.target.value)}>
            {list.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          key={`${c.id}:${c.name}`}
          className="insp-head__name"
          aria-label="Controller name"
          defaultValue={c.name}
          spellCheck={false}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && put({ ...c, name: e.target.value.trim() }, 'rename controller')}
        />
        <button className="chip" aria-pressed={playing === c.id} onClick={() => onPlay(playing === c.id ? null : c.id)} title="Run the controller in the viewport">
          <Icon name={playing === c.id ? 'pause' : 'play'} size={11} /> {playing === c.id ? 'Stop' : 'Play'}
        </button>
        <button className="insp-head__delete" aria-label={`Delete ${c.name}`} onClick={() => onChange(list.filter((x) => x.id !== c.id), 'delete controller')}>
          <Icon name="trash" size={14} />
        </button>
      </div>

      {playing === c.id ? (
        <div className="ctrl__preview" role="group" aria-label="What the mob is doing">
          {(
            [
              ['is_moving', 'Moving'],
              ['is_on_ground', 'On ground'],
              ['is_sneaking', 'Sneaking'],
              ['is_in_water', 'In water'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="ctrl__check">
              <input
                type="checkbox"
                checked={!!preview[k]}
                onChange={(e) => onPreview({ ...preview, [k]: e.target.checked ? 1 : 0, ...(k === 'is_moving' ? { ground_speed: e.target.checked ? 4 : 0 } : {}) })}
              />
              {label}
            </label>
          ))}
          <label className="ctrl__check">
            Health
            <input type="number" min={0} max={100} value={preview.health} aria-label="Health" onChange={(e) => onPreview({ ...preview, health: Number(e.target.value) || 0 })} />
          </label>
        </div>
      ) : null}

      {c.states.map((st) => (
        <section key={st.id} className={`ctrl__state${current === st.id && playing === c.id ? ' ctrl__state--on' : ''}`} aria-label={`State ${st.name}`}>
          <div className="ctrl__row">
            <input
              key={`${st.id}:${st.name}`}
              className="ctrl__name"
              aria-label="State name"
              defaultValue={st.name}
              spellCheck={false}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== st.name && putState({ ...st, name: e.target.value.trim() }, 'rename state')}
            />
            <label className="ctrl__check" title="The state the controller starts in">
              <input type="radio" name={`initial-${c.id}`} checked={c.initial === st.id} onChange={() => put({ ...c, initial: st.id }, 'start state')} />
              Start
            </label>
            <button
              className="insp-head__delete"
              aria-label={`Delete state ${st.name}`}
              disabled={c.states.length < 2}
              onClick={() => {
                const states = c.states.filter((x) => x.id !== st.id).map((x) => ({ ...x, transitions: x.transitions.filter((t) => t.to !== st.id) }))
                put({ ...c, states, initial: c.initial === st.id ? states[0].id : c.initial }, 'delete state')
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>

          <div className="ctrl__label">Plays</div>
          <div className="chip-row">
            {model.clips.map((clip) => {
              const on = st.clips.some((x) => x.clip === clip.id)
              return (
                <button
                  key={clip.id}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => putState({ ...st, clips: on ? st.clips.filter((x) => x.clip !== clip.id) : [...st.clips, { clip: clip.id }] }, on ? 'drop clip from state' : 'add clip to state')}
                >
                  {shortName(clip.name)}
                </button>
              )
            })}
          </div>
          {st.clips.map((x) => {
            const clip = model.clips.find((k) => k.id === x.clip)
            return clip ? (
              <div key={x.clip} className="ctrl__row ctrl__row--sub">
                <span className="ctrl__what">{shortName(clip.name)} at</span>
                <MolangInput
                  value={x.weight ?? ''}
                  label={`Weight of ${clip.name}`}
                  placeholder="1"
                  onCommit={(weight) => putState({ ...st, clips: st.clips.map((y) => (y.clip === x.clip ? { clip: y.clip, ...(weight ? { weight } : {}) } : y)) }, 'clip weight')}
                />
              </div>
            ) : null
          })}

          <div className="ctrl__label">Moves on</div>
          {st.transitions.map((t, i) => (
            <div key={i} className="ctrl__row ctrl__row--sub">
              <span className="ctrl__what">to</span>
              <select
                className="editor-select"
                aria-label="Next state"
                value={t.to}
                onChange={(e) => putState({ ...st, transitions: st.transitions.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) }, 'transition')}
              >
                {c.states
                  .filter((x) => x.id !== st.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
              <span className="ctrl__what">when</span>
              <MolangInput
                value={t.when}
                label="Condition"
                placeholder="q.is_moving"
                onCommit={(when) => putState({ ...st, transitions: st.transitions.map((x, j) => (j === i ? { ...x, when } : x)) }, 'transition')}
              />
              <button className="insp-head__delete" aria-label="Remove this transition" onClick={() => putState({ ...st, transitions: st.transitions.filter((_, j) => j !== i) }, 'remove transition')}>
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
          <div className="ctrl__row">
            <button
              className="chip"
              disabled={c.states.length < 2}
              onClick={() => {
                const to = c.states.find((x) => x.id !== st.id)
                if (to) putState({ ...st, transitions: [...st.transitions, { to: to.id, when: '' }] }, 'add transition')
              }}
            >
              <Icon name="plus" size={11} /> Transition
            </button>
            <label className="ctrl__check" title="Seconds to cross-fade into this state">
              Blend
              <input
                type="number"
                min={0}
                step={0.05}
                aria-label="Blend seconds"
                value={st.blend ?? 0}
                onChange={(e) => putState({ ...st, blend: Math.max(0, Number(e.target.value) || 0) || undefined }, 'blend')}
              />
            </label>
          </div>
          <div className="ctrl__row ctrl__row--sub">
            <span className="ctrl__what">on entry</span>
            <MolangInput value={st.onEntry ?? ''} label="On entry" placeholder="v.landed = 1;" onCommit={(onEntry) => putState({ ...st, ...(onEntry ? { onEntry } : { onEntry: undefined }) }, 'on entry')} />
          </div>
        </section>
      ))}
      <button className="chip" onClick={() => put({ ...c, states: [...c.states, newState(`state_${c.states.length + 1}`)] }, 'add state')}>
        <Icon name="plus" size={11} /> State
      </button>
      {list.length ? (
        <button className="chip" style={{ marginLeft: 6 }} onClick={add}>
          <Icon name="plus" size={11} /> Controller
        </button>
      ) : null}
    </div>
  )
}
