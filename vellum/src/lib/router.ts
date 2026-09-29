import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

export type Route = {
  /** path segments after the leading '#/', e.g. ['settings', 'billing'] */
  segments: string[]
  /** raw path, always normalised to start with '/' */
  path: string
}

function read(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return { path, segments: path.split('/').filter(Boolean) }
}

/* ---------------- leaving a page that has unsaved work ---------------- */

// Returning false refuses the navigation; the page can then ask and call `navigate` itself.
// Route changes never unload the document, so `beforeunload` cannot do this.
type Guard = (to: string) => boolean

let guard: Guard | null = null

/* A path `navigate` has already cleared with the guard, so the hashchange
   it causes does not ask again. */
let approved: string | null = null

/** Returns a disposer. Only the registered guard can clear itself. */
export function blockNavigation(fn: Guard): () => void {
  guard = fn
  return () => {
    if (guard === fn) guard = null
  }
}

/** `replace` swaps the current history entry, for a page that moves on by itself. */
export function navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
  const next = path.startsWith('/') ? path : `/${path}`
  if (window.location.hash === `#${next}`) return
  if (guard && !guard(next)) return
  approved = next
  if (replace) window.location.replace(`#${next}`)
  else window.location.hash = `#${next}`
}

/* Pages cross-fade with a view transition where supported. The update must
   land inside its callback, hence flushSync. Settings sections swap in place. */
const inPlace = (from: string, to: string) => from.startsWith('/settings') && to.startsWith('/settings')

function swap(apply: () => void, quiet = false) {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (typeof document.startViewTransition !== 'function' || still || quiet) {
    apply()
    return
  }
  document.startViewTransition(() => flushSync(apply))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read)
  const current = useRef(route.path)

  useEffect(() => {
    // Back and typed URLs arrive as a hashchange after the fact, so a refusal
    // writes the old hash back; `restoring` skips the event that write causes.
    let restoring = false
    const onChange = () => {
      if (restoring) {
        restoring = false
        return
      }
      const next = read()
      if (next.path === approved) {
        approved = null
      } else if (next.path !== current.current && guard && !guard(next.path)) {
        restoring = true
        window.location.hash = `#${current.current}`
        return
      }
      const from = current.current
      current.current = next.path
      swap(() => setRoute(next), inPlace(from, next.path))
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.location.replace('#/')
  }, [])

  return route
}

export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — Vellum` : 'Vellum'
  }, [title])
}
