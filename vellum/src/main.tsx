import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installBridge, listenPostMessage } from './lib/dash-api'
import './styles/base.css'

/* The dashboard reports a realm this app does not run, so its numbers
   have to be fed in from outside. The bridge goes up before React does,
   so a launcher or companion script can push state at any point - even
   before anyone navigates to the Dash.

   postMessage is opt-in per origin and has no wildcard. Same-origin is
   the only default: a dashboard that accepts numbers from any frame
   that can reach it is not a dashboard. */
installBridge()
listenPostMessage([window.location.origin])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
