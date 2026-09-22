/* ---------------------------------------------------------------
   "Apply on the server" - POST /api/reload, and the report it may
   answer with instead.

   A save bakes; a bake is not live until a reload swaps the content
   set. The control exists so that does not need a console.

   The shape of this component is decided by one fact: the server
   answers 200 for BOTH "swapped" and "declined to swap". A refusal is
   a finished, successful request carrying a validation report, so it
   gets its own resting state with the report rendered verbatim - not
   an error toast, and never a spinner still turning. An author who
   cannot tell those apart waits for something that already happened.
   --------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from 'react'
import { requestReload, type ReloadOutcome } from '../lib/reload'
import { Icon } from '../lib/icons'
import './ReloadControl.css'

type State = { phase: 'idle' } | { phase: 'asking' } | { phase: 'done'; outcome: ReloadOutcome }

export function ReloadControl({ linked }: { linked: boolean }) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const onApply = useCallback(() => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setState({ phase: 'asking' })
    void requestReload(ctl.signal).then((outcome) => {
      if (ctl.signal.aborted) return
      setState({ phase: 'done', outcome })
    })
  }, [])

  const busy = state.phase === 'asking'

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
          {linked
            ? 'Saving writes the files. This swaps them into the running server.'
            : 'Link a server first — there is nothing to reload.'}
        </p>
      </div>

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
      /* NOT an error. The request worked; the content did not pass. The
         report names the file and the key and is written for a person,
         so it is shown as it arrived rather than summarised. */
      <div className="rl__out" data-kind="refused" role="status">
        <p className="rl__head">
          <Icon name="warning" size={16} />
          Nothing was swapped — the content did not pass validation.
        </p>
        <p className="rl__blast">
          The server is still running what it had. One bad file holds back every mob, item, block
          and furniture piece, so this blocks the whole set rather than just the file below.
        </p>
        {outcome.report ? (
          <pre className="rl__report">{outcome.report}</pre>
        ) : (
          <p className="rl__bare">
            The server declined without saying why. That is a gap on its side, not a step you
            missed — check the server console.
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
            ? 'The server gave no verdict.'
            : `The server answered ${outcome.status}.`}
      </p>
      <p className="rl__msg">{outcome.message}</p>
      {/* The exact request, because the two failures that matter look the
          same from the server side: a 404 names an endpoint that does not
          exist, and a 403 on the same path names an auth gate on one that
          does. Whoever reads this is the only one who can tell them apart. */}
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
        /* Named rather than approximated, the same way an unknown schema
           type is named. A stage rendered as "[object Object]" reads
           like a step that ran and did nothing. */
        <ul className="rl__unread">
          {unreadable.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
