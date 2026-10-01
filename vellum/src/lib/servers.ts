/* The servers this account owns or has a seat on, as sample data standing in
   for the account service. */

import { useSyncExternalStore } from 'react'

export type ServerRole = 'owner' | 'editor' | 'viewer'

export type LinkedServer = {
  id: string
  name: string
  host: string
  /** the message of the day, as the game's own server list shows it */
  motd: string
  online: boolean
  players: number
  maxPlayers: number
  /** round trip in milliseconds; null while the server is offline */
  ping: number | null
  software: string
  role: ServerRole
  /** the team whose server it is, when it is not yours */
  team: { name: string; owner: string; seatsUsed: number; seats: number } | null
  /** ISO 8601; null if you have never opened it */
  openedAt: string | null
  /** ISO 8601; when the server last answered */
  seenAt: string
  /** the colour its icon is drawn in, as a hue */
  hue: number
}

export const servers: LinkedServer[] = [
  {
    id: 'vellum-pvp',
    name: 'Vellum PvP',
    host: 'eu-west-2.vellum.gg',
    motd: 'Season four is live. New mobs in the Keep.',
    online: true,
    players: 20,
    maxPlayers: 120,
    ping: 38,
    software: 'Paper 1.21.4',
    role: 'owner',
    team: null,
    openedAt: '2026-09-28T21:10:00.000Z',
    seenAt: '2026-09-29T00:00:00.000Z',
    hue: 212,
  },
  {
    id: 'vellum-staging',
    name: 'Vellum Staging',
    host: 'staging.vellum.gg',
    motd: 'Test builds. Expect restarts.',
    online: false,
    players: 0,
    maxPlayers: 20,
    ping: null,
    software: 'Paper 1.21.4',
    role: 'owner',
    team: null,
    openedAt: '2026-09-25T17:32:00.000Z',
    seenAt: '2026-09-27T16:40:00.000Z',
    hue: 32,
  },
  {
    id: 'hollowmere',
    name: 'Hollowmere Network',
    host: 'play.hollowmere.net',
    motd: 'Skyblock, survival and the Hollow Trials.',
    online: true,
    players: 184,
    maxPlayers: 500,
    ping: 64,
    software: 'Paper 1.21.4',
    role: 'editor',
    team: { name: 'Hollowmere Studios', owner: 'aurelia', seatsUsed: 4, seats: 5 },
    openedAt: '2026-09-26T10:05:00.000Z',
    seenAt: '2026-09-29T00:00:00.000Z',
    hue: 268,
  },
  {
    id: 'copperline',
    name: 'Copperline SMP',
    host: 'copperline.gg',
    motd: 'A slow coastal survival server.',
    online: true,
    players: 31,
    maxPlayers: 60,
    ping: 112,
    software: 'Purpur 1.21.1',
    role: 'viewer',
    team: { name: 'Copperline', owner: 'm.ferris', seatsUsed: 3, seats: 3 },
    openedAt: null,
    seenAt: '2026-09-29T00:00:00.000Z',
    hue: 152,
  },
]

export const roleLabel: Record<ServerRole, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' }

/** A server you can open the Studio on right now. */
export const enterable = (s: LinkedServer) => s.online

/* ---------------- the server you are in ---------------- */

const KEY = 'vellum.server'
const listeners = new Set<() => void>()

function readId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    // storage blocked: fall back to the first server you own
    return null
  }
}

let currentId: string | null = readId()

/** The server the Studio is open on: the last one entered, or the first you own. */
export function currentServer(): LinkedServer {
  return servers.find((s) => s.id === currentId) ?? servers.find((s) => s.role === 'owner') ?? servers[0]
}

export function enterServer(id: string) {
  currentId = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  for (const fn of [...listeners]) fn()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useCurrentServer(): LinkedServer {
  return useSyncExternalStore(subscribe, currentServer)
}
