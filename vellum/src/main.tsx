import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installBridge, listenPostMessage } from './lib/dash-api'
import './styles/base.css'

/* The Dash is fed from outside the app. The bridge goes in before React renders, so a
   launcher can push state early. postMessage is accepted from this origin only. */
installBridge()
listenPostMessage([window.location.origin])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
