import { TopBar } from './components/TopBar'
import { Dashboard } from './pages/Dashboard'
import { Editor } from './pages/Editor'
import { Projects } from './pages/Projects'
import { Settings } from './pages/Settings'
import { Icon } from './lib/icons'
import { navigate, useRoute, useTitle } from './lib/router'

/**
 * Anything that is not a route. It used to render the dashboard, which
 * meant a mistyped or dead link looked like it had worked and quietly
 * showed you somebody else's page.
 */
function NotFound({ path }: { path: string }) {
  useTitle('Not found')
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">404</div>
          <h1 className="page-title">No such page</h1>
          <p className="page-sub">
            Nothing is routed at <code className="mono">#{path}</code>.
          </p>
        </div>
      </div>
      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn--primary" onClick={() => navigate('/')}>
          <Icon name="grid" size={14} /> Back to the dashboard
        </button>
        <button className="btn btn--ghost" onClick={() => navigate('/projects')}>
          <Icon name="cube" size={14} /> Open the library
        </button>
      </div>
    </main>
  )
}

export default function App() {
  const { segments, path } = useRoute()
  const root = segments[0]

  return (
    <div className="app-shell">
      {/* the first tab stop on every page: a keyboard user should not
          have to walk the whole top bar to reach the thing they came
          for. Hidden until it is focused. */}
      <button
        className="vh vh--focusable"
        onClick={() => {
          const main = document.querySelector('main')
          if (!main) return
          main.tabIndex = -1
          main.focus()
        }}
      >
        Skip to content
      </button>

      <TopBar segments={segments} />

      {root === undefined ? (
        <Dashboard />
      ) : root === 'projects' ? (
        <Projects segments={segments} />
      ) : root === 'settings' ? (
        <Settings segments={segments} />
      ) : root === 'editor' ? (
        /* Keyed on the model the route names: the editor reads its
           document once, at mount, so without this a hash change from
           one model to another left the previous one on screen. The
           dirty guard runs before the route settles, so a remount here
           only ever follows a navigation the user approved. */
        <Editor key={segments.slice(1).join('/')} segments={segments} />
      ) : (
        <NotFound path={path} />
      )}
    </div>
  )
}
