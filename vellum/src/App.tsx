import { TopBar } from './components/TopBar'
import { Dashboard } from './pages/Dashboard'
import { Editor } from './pages/Editor'
import { Projects } from './pages/Projects'
import { Settings } from './pages/Settings'
import { useRoute } from './lib/router'

export default function App() {
  const { segments } = useRoute()
  const root = segments[0]

  return (
    <div className="app-shell">
      <TopBar segments={segments} />
      {root === 'projects' ? (
        <Projects segments={segments} />
      ) : root === 'settings' ? (
        <Settings segments={segments} />
      ) : root === 'editor' ? (
        <Editor segments={segments} />
      ) : (
        <Dashboard />
      )}
    </div>
  )
}
