import { useEffect, useState } from 'react'

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

export function navigate(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`
  if (window.location.hash !== `#${next}`) window.location.hash = `#${next}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.location.replace('#/')
  }, [])

  return route
}
