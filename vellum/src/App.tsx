import { useLayoutEffect } from 'react'
import { Arrival } from './components/Arrival'
import { TopBar } from './components/TopBar'
import { Dashboard } from './pages/Dashboard'
import { Editor } from './pages/Editor'
import { Home } from './pages/Home'
import { Projects } from './pages/Projects'
import { Servers } from './pages/Servers'
import { Settings } from './pages/Settings'
import { SignIn } from './pages/SignIn'
import { useDemoServer } from './pages/dash/demo'
import { Icon } from './lib/icons'
import { navigate, useRoute, useTitle } from './lib/router'

function NotFound({ path }: { path: string }) {
  useTitle('Not found')
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">404</div>
          <h1 className="page-title">This chunk never generated</h1>
          <p className="page-sub">
            There&rsquo;s no page at <code className="mono">#{path}</code>.
          </p>
        </div>
      </div>
      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn--primary" onClick={() => navigate('/dash')}>
          <Icon name="grid" size={14} /> Go to the Dash
        </button>
        <button className="btn btn--ghost" onClick={() => navigate('/projects')}>
          <Icon name="cube" size={14} /> Go to Projects
        </button>
      </div>
    </main>
  )
}

export default function App() {
  const { segments, path } = useRoute()
  const root = segments[0]
  // the demo server keeps reporting on every page, so Settings shows it too
  useDemoServer()

  const surface = root === 'editor' ? 'paper' : 'dark'
  // The home page, sign-in and the server picker come before the Studio and have their own headers.
  const outside = root === undefined || root === 'login' || root === 'servers'
  useLayoutEffect(() => {
    const html = document.documentElement
    if (surface === 'dark') html.dataset.surface = 'dark'
    else delete html.dataset.surface
  }, [surface])

  return (
    <div className="app-shell">
      <button
        className="visually-hidden visually-hidden--focusable"
        onClick={() => {
          const main = document.querySelector('main')
          if (!main) return
          main.tabIndex = -1
          main.focus()
        }}
      >
        Skip to content
      </button>

      {outside ? null : <TopBar segments={segments} />}

      {root === undefined ? (
        <Home />
      ) : root === 'login' ? (
        <SignIn />
      ) : root === 'servers' ? (
        <Servers />
      ) : root === 'dash' ? (
        <Dashboard />
      ) : root === 'projects' ? (
        <Projects segments={segments} />
      ) : root === 'settings' ? (
        <Settings segments={segments} />
      ) : root === 'editor' ? (
        /* Keyed on the model path because the editor reads its document only at mount.
           The unsaved-work guard runs first, so a remount follows only an approved navigation. */
        <Editor key={segments.slice(1).join('/')} segments={segments} />
      ) : (
        <NotFound path={path} />
      )}

      <Arrival path={path} />
    </div>
  )
}
