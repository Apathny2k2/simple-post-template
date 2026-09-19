import { useEffect, useRef, useState } from 'react'

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

/* ---------------- leaving a page that has unsaved work ----------------

   A page can refuse a navigation and handle it itself - ask, then
   navigate again once the answer is in. `beforeunload` cannot help
   here: moving between routes never unloads the document, so without
   this, clicking the top nav threw away an afternoon's work in
   silence.

   The guard has to cover Back as well as our own links. A hashchange
   has already happened by the time we hear about it, so a refusal puts
   the hash back where it was; `restoring` keeps that from recursing. */

type Guard = (to: string) => boolean

let guard: Guard | null = null

/* A path `navigate` has already cleared with the guard. Writing the
   hash fires a hashchange, and asking the same guard about the same
   navigation a second time is how a confirmed "discard and leave"
   ended up bouncing straight back into the editor. */
let approved: string | null = null

/** Returns a disposer. Only the registered guard can clear itself. */
export function blockNavigation(fn: Guard): () => void {
  guard = fn
  return () => {
    if (guard === fn) guard = null
  }
}

export function navigate(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`
  if (window.location.hash === `#${next}`) return
  if (guard && !guard(next)) return
  approved = next
  window.location.hash = `#${next}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read)
  const current = useRef(route.path)

  useEffect(() => {
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
      current.current = next.path
      setRoute(next)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.location.replace('#/')
  }, [])

  return route
}

/**
 * Every route rendered as "Vellum" in the tab and in history, so a
 * browser's back list was eight identical entries and a screen reader
 * announced nothing on navigation.
 */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — Vellum` : 'Vellum'
  }, [title])
}
