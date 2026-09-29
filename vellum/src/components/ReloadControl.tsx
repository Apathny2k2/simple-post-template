/* POST /api/reload. The server answers 200 both when it swaps and when it
   declines, so a refusal is a finished request with a report to show. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { requestReload, type ReloadOutcome } from '../lib/reload'
import { Icon } from '../lib/icons'
import { Pip } from './Pip'
import './ReloadControl.css'

// 'landing': the answer is in and Pip is playing his ending; the verdict shows after
type State =
  | { phase: 'idle' }
  | { phase: 'asking' }
  | { phase: 'landing'; outcome: ReloadOutcome }
  | { phase: 'done'; outcome: ReloadOutcome }

export function ReloadControl({
  linked,
  hint,
  request = requestReload,
}: {
  linked: boolean
  /** replaces the line next to the button */
  hint?: string
  /** Sends the reload request. The demo passes its own. */
  request?: (signal: AbortSignal) => Promise<ReloadOutcome>
}) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const onApply = useCallback(() => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setState({ phase: 'asking' })
    void request(ctl.signal).then((outcome) => {
      if (ctl.signal.aborted) return
      setState({ phase: 'landing', outcome })
    })
  }, [request])

  const onLanded = useCallback(() => {
    setState((s) => (s.phase === 'landing' ? { phase: 'done', outcome: s.outcome } : s))
  }, [])

  const busy = state.phase === 'asking' || state.phase === 'landing'
  const landing = state.phase === 'landing' ? state.outcome : null

  return (
    <div className="rl">
      <div className="rl__row">
        <button
          type="button"
          className="rl__go"
          onClick={onApply}
          disabled={busy || !linked}
          aria-busy={busy}
        >
          {busy ? 'Applying…' : 'Apply on the server'}
        </button>
        <p className="rl__hint">
          {!linked
            ? 'No server linked.'
            : hint ?? 'Saving writes the files. This swaps them into the running server.'}
        </p>
      </div>

      {busy ? (
        <Pip
          className="rl__pip"
          label="Applying the files on the server"
          mood={landing ? (landing.kind === 'swapped' ? 'done' : 'failed') : 'working'}
          failure={landing?.kind === 'refused' ? 'wall' : 'lava'}
          onFinish={onLanded}
        />
      ) : null}
      {state.phase === 'done' ? <Verdict outcome={state.outcome} /> : null}
    </div>
  )
}

function Verdict({ outcome }: { outcome: ReloadOutcome }) {
  if (outcome.kind === 'swapped') {
    const kinds = Object.entries(outcome.counts)
    return (
      <div className="rl__out" data-kind="swapped" role="status">
        <p className="rl__head">
          <Icon name="check" size={16} />
          Swapped. The server is running what you saved.
        </p>
        {kinds.length ? (
          <ul className="rl__counts">
            {kinds.map(([kind, n]) => (
              <li key={kind}>
                <span className="rl__n">{n}</span> {kind}
              </li>
            ))}
          </ul>
        ) : null}
        <Stages stages={outcome.stages} unreadable={outcome.unreadable} />
      </div>
    )
  }

  if (outcome.kind === 'refused') {
    return (
      /* The request succeeded and the content failed validation. The report
         is written for people, so it is shown as sent. */
      <div className="rl__out" data-kind="refused" role="status">
        <p className="rl__head">
          <Icon name="warning" size={16} />
          Nothing was swapped. The content failed validation.
        </p>
        <p className="rl__blast">
          The server is still running the content it had before. One bad file holds back every mob,
          item, block and furniture piece until you fix it.
        </p>
        {outcome.report ? (
          <pre className="rl__report">{outcome.report}</pre>
        ) : (
          <p className="rl__bare">
            The server declined without saying why. That's a gap on the server's side. You didn't
            miss a step. Check the server console.
          </p>
        )}
        <Stages stages={outcome.stages} unreadable={outcome.unreadable} />
      </div>
    )
  }

  return (
    <div className="rl__out" data-kind="error" role="alert">
      <p className="rl__head">
        <Icon name="warning" size={16} />
        {outcome.status === null
          ? 'The server could not be reached.'
          : outcome.status < 400
            ? 'The server did not confirm the reload.'
            : `The server answered ${outcome.status}.`}
      </p>
      <p className="rl__msg">{outcome.message}</p>
      {/* The URL lets a reader tell a wrong path (404) from an auth gate on
          the right one (403). */}
      {outcome.url ? (
        <p className="rl__what">
          <code>POST {outcome.url}</code>
          {outcome.status === null ? null : <> → <strong>{outcome.status}</strong></>}
        </p>
      ) : null}
    </div>
  )
}

function Stages({ stages, unreadable }: { stages: string[]; unreadable: string[] }) {
  if (!stages.length && !unreadable.length) return null
  return (
    <>
      {stages.length ? (
        <ol className="rl__stages">
          {stages.map((s, i) => (
            <li key={`${s}-${i}`}>{s}</li>
          ))}
        </ol>
      ) : null}
      {unreadable.length ? (
        /* parts of the response that could not be read, listed by name */
        <ul className="rl__unread">
          {unreadable.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
