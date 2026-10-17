/* The sound console on its own, without the Studio around it (sounds.html,
   `pnpm build:sounds`). Same page and code as #/sounds. */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { VellumMark } from './lib/icons'
import { Sounds } from './pages/Sounds'
import './styles/base.css'
import './components/TopBar.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar__left">
            <span className="topbar__brand">
              <VellumMark />
              Vellum Sounds
            </span>
          </div>
        </header>
        <Sounds />
      </div>
    </ErrorBoundary>
  </StrictMode>,
)
