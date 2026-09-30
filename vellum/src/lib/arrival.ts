/* Entering a server's Studio: the portal scene, then the server's title
   over the Dash. The Studio opens underneath as the scene starts, so Pip
   walks over it while it loads, and the scene never waits on the page. */

import { useSyncExternalStore } from 'react'
import { navigate } from './router'
import { enterServer } from './servers'
import type { LinkedServer } from './servers'

export type Arrival = {
  key: number
  server: LinkedServer
  stage: 'portal' | 'title'
  /** the Studio has been opened underneath */
  opened: boolean
  /** swap the history entry, when the list moved on by itself */
  replace: boolean
}

let current: Arrival | null = null
let count = 0
/* A server entered through the portal is live: its Dash runs the demo feed
   until someone stops it there. */
let live = false
const listeners = new Set<() => void>()

function publish(next: Arrival | null) {
  current = next
  for (const fn of [...listeners]) fn()
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Opens `server` and starts the walk over it. With motion reduced there is no walk, only the title. */
export function arrive(server: LinkedServer, { replace = false }: { replace?: boolean } = {}) {
  publish({ key: ++count, server, stage: 'portal', opened: false, replace })
  openStudio()
  if (reduced()) toTitle()
}

/** Enters the server and opens its Dash. Safe to call twice. */
export function openStudio() {
  if (!current || current.opened) return
  enterServer(current.server.id)
  live = true
  navigate('/dash', { replace: current.replace })
  publish({ ...current, opened: true })
}

export function toTitle() {
  if (!current) return
  openStudio()
  publish({ ...current, stage: 'title' })
}

export const finishArrival = () => publish(null)

export const isLive = () => live
export function setLive(on: boolean) {
  live = on
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
const read = () => current

export function useArrival(): Arrival | null {
  return useSyncExternalStore(subscribe, read)
}
