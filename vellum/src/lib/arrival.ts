/* Entering a server's Studio: the walk into the swirl, played over the
   page it started from, then the server's title over the Dash. The Studio
   opens through the swirl once Pip is in, so the scene never waits on it. */

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

/** Starts the walk into `server`. With motion reduced there is no walk: the Dash opens and the title shows. */
export function arrive(server: LinkedServer, { replace = false }: { replace?: boolean } = {}) {
  publish({ key: ++count, server, stage: 'portal', opened: false, replace })
  if (reduced()) toTitle()
}

/** Enters the server and opens its Dash, from a point on the screen when `through` is given. Safe to call twice. */
export function openStudio(through?: { x: number; y: number }) {
  if (!current || current.opened) return
  enterServer(current.server.id)
  live = true
  if (through) revealFrom(through)
  navigate('/dash', { replace: current.replace })
  publish({ ...current, opened: true })
}

/* The page change that follows is revealed in a circle growing from `at`,
   by the view transition the router starts (see Arrival.css). */
function revealFrom(at: { x: number; y: number }) {
  const root = document.documentElement
  const far = Math.hypot(Math.max(at.x, window.innerWidth - at.x), Math.max(at.y, window.innerHeight - at.y))
  root.style.setProperty('--arrive-x', `${Math.round(at.x)}px`)
  root.style.setProperty('--arrive-y', `${Math.round(at.y)}px`)
  root.style.setProperty('--arrive-r', `${Math.ceil(far)}px`)
  root.dataset.arriving = ''
  window.setTimeout(() => delete root.dataset.arriving, 1200)
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
