/* The signed-in account, as a sample: the sign-in page accepts any email,
   keeps the name and email in this browser, and sends nothing anywhere.
   The password is never stored. */

import { useSyncExternalStore } from 'react'

export type Session = { name: string; email: string }

/** The sample account the sign-in page fills in. */
export const DEMO_ACCOUNT = { email: 'g.alex@example.com', password: 'minecraft' }

const KEY = 'vellum.session'
const listeners = new Set<() => void>()

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Partial<Session>) : null
    return v && typeof v.name === 'string' && typeof v.email === 'string' ? { name: v.name, email: v.email } : null
  } catch {
    return null
  }
}

let current: Session | null = read()

function publish(next: Session | null) {
  current = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the session lasts for this visit */
  }
  for (const fn of [...listeners]) fn()
}

export const getSession = () => current

/** The part of the email before the @ is the name the Studio shows. */
export function signIn(email: string): Session {
  const clean = email.trim()
  const session = { name: clean.split('@')[0] || clean, email: clean }
  publish(session)
  return session
}

export const signOut = () => publish(null)

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession)
}
