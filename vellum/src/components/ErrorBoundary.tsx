import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import './ErrorBoundary.css'

type Props = { children: ReactNode }
type State = { error: Error | null; attempt: number }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Vellum crashed while rendering:', error, info.componentStack)
  }

  render() {
    const { error, attempt } = this.state
    if (!error) return <div key={attempt}>{this.props.children}</div>

    return (
      <div className="crash">
        <div className="crash__card">
          <h1 className="crash__title">Vellum tripped over a block</h1>
          <p className="crash__lead">
            Something went wrong while drawing this page. Files you&rsquo;ve saved are safe.
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
            Try again keeps unsaved work if the problem was brief. Reloading always works, but loses
            unsaved work.
          </p>
        </div>
      </div>
    )
  }
}
