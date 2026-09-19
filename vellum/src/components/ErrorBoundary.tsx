import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import './ErrorBoundary.css'

/* ---------------------------------------------------------------
   The last line of defence.

   A render that throws takes React's whole tree with it: `#root` is
   emptied and the user is left looking at a white page with no idea
   what happened or whether their work survived. That is the worst
   possible failure mode for an editor, and it is one bad value away at
   any time - a file off disk, a number that became NaN, a shape the
   decoder did not expect.

   This cannot fix the cause, and it does not pretend to. It says what
   broke, keeps the page on screen, and offers the one recovery that
   does not lose anything (try again) before the one that might.
   --------------------------------------------------------------- */

type Props = { children: ReactNode }
type State = { error: Error | null; attempt: number }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // the stack is the only thing that makes this reportable
    console.error('Vellum crashed while rendering:', error, info.componentStack)
  }

  render() {
    const { error, attempt } = this.state
    if (!error) return <div key={attempt}>{this.props.children}</div>

    return (
      <div className="crash">
        <div className="crash__card">
          <h1 className="crash__title">Vellum stopped rendering</h1>
          <p className="crash__lead">
            Something in the last action threw an error the editor could not recover from on its own.
            Nothing has been written to disk, so any file you have saved is untouched.
          </p>
          <pre className="crash__msg">{error.message}</pre>
          <div className="crash__actions">
            <button
              className="btn btn--primary"
              onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
            >
              Try again
            </button>
            <button className="btn btn--ghost" onClick={() => window.location.reload()}>
              Reload the page
            </button>
          </div>
          <p className="crash__note">
            &ldquo;Try again&rdquo; re-renders from the current state and keeps unsaved work if the
            error was transient. Reloading always works and always loses it.
          </p>
        </div>
      </div>
    )
  }
}
