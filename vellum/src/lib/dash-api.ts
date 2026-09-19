/* ---------------------------------------------------------------
   The Dashboard ingest API.

   The Dash reports a Minecraft realm that Vellum does not run: the
   server's identity, the resource pack it is serving, who is still on
   an old copy, and what the team touched last. None of that is
   knowable from inside a browser tab, so all of it is fed in from
   outside - by a server plugin.

   Three halves, in the order they matter:

   1. `dashEndpoints` - the contract, machine-readable. The reference
      panel on the Dash renders straight from it, so a plugin author
      reads the same object the client calls. `GET /dash/schema`
      returns it, which means a plugin can check at runtime that the
      Vellum it is talking to speaks its dialect.

   2. `dash` - the typed client, one method per endpoint. It writes
      into the in-memory store; the shapes are already what a real
      Vellum server would accept, so the plugin side does not change
      when the store moves behind a socket.

   3. The transports - three ways a plugin's data actually reaches a
      static page, because a page cannot listen on a port:

      - `window.Vellum.dash.*`  a global, for anything sharing the
        document: a launcher's web view, a companion script, devtools.
      - `postMessage`           for an embedding host, origin-checked.
      - `connect(...)`          Vellum polls, or streams over SSE, from
        a URL the plugin serves. This is the one a Paper plugin uses.

   Every path lands in the same validator and the same log, so a card
   cannot be fed by a route that skipped the checks.
   --------------------------------------------------------------- */

import {
  dashStore,
  readFile,
  readPack,
  readPlayers,
  readServer,
  readSubscription,
} from './dash'
import type { DashSnapshot, FileTouch, IngestRecord, Section } from './dash'
import type { EndpointSpec as Spec } from './endpoint'

export const DASH_BASE = '/api/v1'

/** Bump when a field changes meaning. `GET /dash/schema` returns it. */
export const DASH_API_VERSION = 1

export type DashGroup = 'Realm' | 'Pack' | 'Players' | 'Files' | 'Feed'
export type DashEndpoint = Spec<DashGroup>

export const dashEndpoints: DashEndpoint[] = [
  /* ---- Feed ---- */
  {
    method: 'POST',
    path: '/dash/snapshot',
    group: 'Feed',
    summary:
      'Replace every card in one call. The cheapest thing a plugin can do on a timer - send what you know, omit the rest.',
    body: [
      { name: 'server', type: 'Server', note: 'Same body as PATCH /dash/server.' },
      { name: 'pack', type: 'Pack', note: 'Same body as PATCH /dash/pack.' },
      { name: 'players', type: 'Census', note: 'Same body as PUT /dash/players.' },
      { name: 'subscription', type: 'Subscription', note: 'Same body as PATCH /dash/subscription.' },
      { name: 'files', type: 'FileTouch[]', note: 'REPLACES the list. Use POST /dash/files to append.' },
    ],
    returns: '{ ok: true, applied: string[], problems: string[] }',
    usedBy: 'Every card',
  },
  {
    method: 'GET',
    path: '/dash/snapshot',
    group: 'Feed',
    summary:
      'Read the current state back. This is the endpoint Vellum polls when you point it at a plugin - implement it and the Dash fills itself.',
    returns: '{ server, pack, players, subscription, files, meta }',
  },
  {
    method: 'POST',
    path: '/dash/heartbeat',
    group: 'Feed',
    summary:
      'Say the plugin is alive and name itself. Without one, cards fed earlier go stale and then offline rather than pretending to be current.',
    body: [
      { name: 'agent', type: 'string', note: 'Plugin name and version, e.g. "VellumBridge 1.4.0".' },
      { name: 'everySeconds', type: 'integer', note: 'How often you promise to call. 5-3600, default 30.' },
    ],
    returns: '{ ok: true, health: "live" }',
    usedBy: 'Feed status',
  },
  {
    method: 'GET',
    path: '/dash/events',
    group: 'Feed',
    summary:
      'Server-sent events, so the Dash updates the moment something changes instead of on the next poll. Each event carries one section.',
    params: [{ name: 'token', type: 'string', note: 'SSE cannot set headers, so the bearer goes here.' }],
    returns: 'text/event-stream of { section, body }',
  },
  {
    method: 'GET',
    path: '/dash/schema',
    group: 'Feed',
    summary: 'This contract, as JSON. Check it at startup rather than guessing which Vellum you are feeding.',
    returns: '{ version: integer, endpoints: EndpointSpec[], limits: object }',
  },

  /* ---- Realm ---- */
  {
    method: 'PATCH',
    path: '/dash/server',
    group: 'Realm',
    summary: 'The realm card: identity, reachability and what is synced. Every field is optional; omitted fields keep their value.',
    body: [
      { name: 'name', type: 'string', note: 'Display name. Up to 64 characters.' },
      { name: 'host', type: 'string', note: 'Hostname players connect to.' },
      { name: 'ip', type: 'string', note: 'Resolved address. IPv4 or IPv6.' },
      { name: 'status', type: 'string', note: 'Free text: Connected, Restarting, Degraded...' },
      { name: 'online', type: 'boolean', note: 'Drives the status dot.' },
      { name: 'breakdown', type: '{ label, count }[]', note: 'Up to 12 rows, e.g. Assets / Rigs / Mobs.' },
      { name: 'total', type: 'integer', note: 'Total files synced. Omit and Vellum sums the breakdown.' },
    ],
    returns: '{ ok: true, problems: string[] }',
    usedBy: 'Server',
  },
  {
    method: 'PATCH',
    path: '/dash/subscription',
    group: 'Realm',
    summary: 'The realm power card: plan, cloud region and seat usage.',
    body: [
      { name: 'type', type: 'string', note: 'Plan name.' },
      { name: 'cloud', type: 'string', note: 'Region, or N/A.' },
      { name: 'seats', type: 'string', note: 'Free text, e.g. "3 of 5".' },
    ],
    returns: '{ ok: true, problems: string[] }',
    usedBy: 'Realm power',
  },

  /* ---- Pack ---- */
  {
    method: 'PATCH',
    path: '/dash/pack',
    group: 'Pack',
    summary: 'The resource pack card. Send this when you finish building a pack, not on a timer.',
    body: [
      { name: 'archive', type: 'string', required: true, note: 'File name as served.' },
      { name: 'bytes', type: 'integer', required: true, note: 'Size on the wire. Vellum does the formatting.' },
      { name: 'hash', type: 'string', required: true, note: 'The SHA-1 you hand the client. Also what player reports are compared against.' },
      { name: 'pushedAt', type: 'string | integer', note: 'ISO 8601, epoch ms or epoch seconds. Defaults to now.' },
      { name: 'version', type: 'string | null', note: 'Your own build label, if you have one.' },
    ],
    returns: '{ ok: true, problems: string[] }',
    usedBy: 'Resource pack info',
  },

  /* ---- Players ---- */
  {
    method: 'PUT',
    path: '/dash/players',
    group: 'Players',
    summary: 'The adoption card, counted by you. Use this if the plugin already knows both numbers.',
    body: [
      { name: 'correct', type: 'integer', required: true, note: 'Clients on the current pack.' },
      { name: 'wrong', type: 'integer', required: true, note: 'Clients on an old or no pack.' },
      { name: 'sampledAt', type: 'string | integer', note: 'When you counted. Defaults to now.' },
    ],
    returns: '{ ok: true, correct, wrong }',
    usedBy: 'Pack adoption',
  },
  {
    method: 'POST',
    path: '/dash/players/report',
    group: 'Players',
    summary:
      'One client, one pack hash - which is all a join event knows. Vellum keeps the roster and does the counting, so you can call this straight from PlayerResourcePackStatusEvent.',
    body: [
      { name: 'player', type: 'string', required: true, note: 'Name or UUID. The roster key.' },
      { name: 'packHash', type: 'string', note: 'What that client acknowledged. Compared against the current pack hash.' },
      { name: 'left', type: 'boolean', note: 'true removes the player from the roster on quit.' },
    ],
    returns: '{ ok: true, correct, wrong, online }',
    usedBy: 'Pack adoption',
  },

  /* ---- Files ---- */
  {
    method: 'POST',
    path: '/dash/files',
    group: 'Files',
    summary: 'Append to the recent-files table. Newest first, capped at 50 - older rows fall off.',
    body: [
      { name: 'name', type: 'string', required: true, note: 'File name. A row without one is dropped.' },
      { name: 'where', type: 'string', note: 'Directory, as you want it displayed.' },
      { name: 'touchedAt', type: 'string | integer', note: 'Defaults to now.' },
      { name: 'by', type: 'string', note: 'Who touched it.' },
      { name: 'sync', type: 'in-sync | outdated | unknown', note: 'Defaults to unknown.' },
      { name: 'staleClients', type: 'integer', note: 'How many connected clients hold an old copy.' },
    ],
    returns: '{ ok: true, added: integer, problems: string[] }',
    usedBy: 'Recent files',
  },
  {
    method: 'DELETE',
    path: '/dash/files',
    group: 'Files',
    summary: 'Clear the table. For a plugin that rebuilds the list from scratch each cycle.',
    returns: '204',
  },
]

/* ---------------- the client ---------------- */

export type Via = IngestRecord['via']
export type Ack = { ok: boolean; problems: string[] }

type Body = Record<string, unknown>

const asBody = (v: unknown): Body | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Body) : null

function reject(op: string, why: string, via: Via): Ack {
  dashStore.accept(null, op, [why], via, false)
  return { ok: false, problems: [why] }
}

/** Recount adoption from the roster against the pack hash currently served. */
function recountRoster(): { correct: number; wrong: number } {
  const current = dashStore.snapshot.pack.hash.trim().toLowerCase()
  let correct = 0
  let wrong = 0
  for (const hash of dashStore.roster.values()) {
    if (current && hash && hash.trim().toLowerCase() === current) correct += 1
    else wrong += 1
  }
  return { correct, wrong }
}

export const dash = {
  /** POST /dash/snapshot */
  snapshot(input: unknown, via: Via = 'bridge'): Ack & { applied: Section[] } {
    const body = asBody(input)
    if (!body) return { ...reject('POST /dash/snapshot', 'body must be a JSON object', via), applied: [] }

    const problems: string[] = []
    const applied: Section[] = []
    const s = dashStore.snapshot

    if (body.server !== undefined) {
      const r = readServer(asBody(body.server) ?? {}, s.server)
      s.server = r.value
      problems.push(...r.problems)
      applied.push('server')
    }
    if (body.pack !== undefined) {
      const r = readPack(asBody(body.pack) ?? {}, s.pack)
      s.pack = r.value
      problems.push(...r.problems)
      applied.push('pack')
    }
    if (body.players !== undefined) {
      const r = readPlayers(asBody(body.players) ?? {}, s.players)
      s.players = r.value
      problems.push(...r.problems)
      applied.push('players')
    }
    if (body.subscription !== undefined) {
      const r = readSubscription(asBody(body.subscription) ?? {}, s.subscription)
      s.subscription = r.value
      problems.push(...r.problems)
      applied.push('subscription')
    }
    if (body.files !== undefined) {
      if (!Array.isArray(body.files)) {
        problems.push('files: expected an array - the table was left alone')
      } else {
        const rows = (body.files as unknown[])
          .map((row, i) => readFile(asBody(row) ?? {}, i, problems))
          .filter((f): f is FileTouch => f !== null)
        s.files = rows.slice(0, 50)
        applied.push('files')
      }
    }

    if (!applied.length) problems.push('nothing to apply: send at least one of server, pack, players, subscription, files')
    dashStore.accept(null, 'POST /dash/snapshot', problems, via, applied.length > 0)
    // the cards it touched re-render, but a plugin on a timer must not
    // push one log line per card per poll - the log is for writes
    dashStore.notify(applied)
    return { ok: applied.length > 0, applied, problems }
  },

  /** GET /dash/snapshot */
  read(): DashSnapshot & { meta: { version: number; agent: string | null; lastSeen: number | null } } {
    return {
      ...dashStore.snapshot,
      meta: {
        version: DASH_API_VERSION,
        agent: dashStore.meta.agent,
        lastSeen: dashStore.meta.lastSeen,
      },
    }
  },

  /** PATCH /dash/server */
  server(input: unknown, via: Via = 'bridge'): Ack {
    const body = asBody(input)
    if (!body) return reject('PATCH /dash/server', 'body must be a JSON object', via)
    const { value, problems } = readServer(body, dashStore.snapshot.server)
    dashStore.snapshot.server = value
    dashStore.accept('server', 'PATCH /dash/server', problems, via)
    return { ok: true, problems }
  },

  /** PATCH /dash/subscription */
  subscription(input: unknown, via: Via = 'bridge'): Ack {
    const body = asBody(input)
    if (!body) return reject('PATCH /dash/subscription', 'body must be a JSON object', via)
    const { value, problems } = readSubscription(body, dashStore.snapshot.subscription)
    dashStore.snapshot.subscription = value
    dashStore.accept('subscription', 'PATCH /dash/subscription', problems, via)
    return { ok: true, problems }
  },

  /** PATCH /dash/pack */
  pack(input: unknown, via: Via = 'bridge'): Ack {
    const body = asBody(input)
    if (!body) return reject('PATCH /dash/pack', 'body must be a JSON object', via)
    const { value, problems } = readPack(body, dashStore.snapshot.pack)
    dashStore.snapshot.pack = value
    dashStore.accept('pack', 'PATCH /dash/pack', problems, via)

    /* A new pack invalidates every client's acknowledgement, so the
       adoption card is recounted here rather than waiting for the next
       census - otherwise it would claim everyone is up to date the
       instant you push a build nobody has downloaded. */
    if (dashStore.roster.size) {
      const counted = recountRoster()
      dashStore.snapshot.players = { ...counted, sampledAt: new Date().toISOString() }
      dashStore.notify(['players'])
    }
    return { ok: true, problems }
  },

  /** PUT /dash/players */
  players(input: unknown, via: Via = 'bridge'): Ack & { correct: number; wrong: number } {
    const body = asBody(input)
    if (!body) {
      return { ...reject('PUT /dash/players', 'body must be a JSON object', via), correct: 0, wrong: 0 }
    }
    const { value, problems } = readPlayers(body, dashStore.snapshot.players)
    dashStore.snapshot.players = value
    dashStore.accept('players', 'PUT /dash/players', problems, via)
    return { ok: true, problems, correct: value.correct, wrong: value.wrong }
  },

  /** POST /dash/players/report */
  report(input: unknown, via: Via = 'bridge'): Ack & { correct: number; wrong: number; online: number } {
    const body = asBody(input)
    const player = typeof body?.player === 'string' ? body.player.trim().slice(0, 48) : ''
    if (!player) {
      return {
        ...reject('POST /dash/players/report', 'player is required', via),
        correct: 0,
        wrong: 0,
        online: dashStore.roster.size,
      }
    }

    if (body?.left === true) dashStore.roster.delete(player)
    else dashStore.roster.set(player, typeof body?.packHash === 'string' ? body.packHash : '')

    const counted = recountRoster()
    dashStore.snapshot.players = { ...counted, sampledAt: new Date().toISOString() }
    dashStore.accept('players', 'POST /dash/players/report', [], via)
    return { ok: true, problems: [], ...counted, online: dashStore.roster.size }
  },

  /** POST /dash/files */
  files(input: unknown, via: Via = 'bridge'): Ack & { added: number } {
    const rows = Array.isArray(input) ? (input as unknown[]) : [input]
    const problems: string[] = []
    const parsed = rows
      .map((row, i) => readFile(asBody(row) ?? {}, i, problems))
      .filter((f): f is FileTouch => f !== null)

    if (!parsed.length) {
      dashStore.accept(null, 'POST /dash/files', problems.length ? problems : ['no usable rows'], via, false)
      return { ok: false, problems, added: 0 }
    }

    // newest first, and a plugin streaming every save must not grow without bound
    dashStore.snapshot.files = [...parsed.reverse(), ...dashStore.snapshot.files].slice(0, 50)
    dashStore.accept('files', 'POST /dash/files', problems, via)
    return { ok: true, problems, added: parsed.length }
  },

  /** DELETE /dash/files */
  clearFiles(via: Via = 'bridge'): Ack {
    dashStore.snapshot.files = []
    dashStore.accept('files', 'DELETE /dash/files', [], via)
    return { ok: true, problems: [] }
  },

  /** POST /dash/heartbeat */
  heartbeat(input: unknown, via: Via = 'bridge'): Ack {
    const body = asBody(input) ?? {}
    const problems: string[] = []
    const agent = typeof body.agent === 'string' ? body.agent.trim().slice(0, 64) : dashStore.meta.agent
    let every = Number(body.everySeconds ?? dashStore.meta.heartbeatSeconds)
    if (!Number.isFinite(every)) every = 30
    if (every < 5 || every > 3600) {
      problems.push(`everySeconds: ${every} is outside 5..3600 - clamped`)
      every = Math.max(5, Math.min(3600, every))
    }
    dashStore.setAgent(agent || null, Math.round(every))
    dashStore.accept(null, 'POST /dash/heartbeat', problems, via)
    return { ok: true, problems }
  },

  /** GET /dash/schema */
  schema() {
    return { version: DASH_API_VERSION, base: DASH_BASE, endpoints: dashEndpoints }
  },

  /** Not an endpoint: drop back to the frozen sample. */
  reset() {
    dashStore.reset()
  },
}

/* ---------------- transport 1: the in-page bridge ---------------- */

declare global {
  interface Window {
    Vellum?: {
      version: number
      dash: typeof dash
    }
  }
}

/**
 * Hang the client off `window` so anything sharing the document can
 * feed the Dash without a network hop - a launcher's web view, a
 * companion script, or a person in devtools checking their payload
 * before they write the plugin.
 */
export function installBridge() {
  if (typeof window === 'undefined') return
  window.Vellum = { version: DASH_API_VERSION, dash }
}

/* ---------------- transport 2: postMessage ---------------- */

type Envelope = { vellum: number; id?: string; op: string; body?: unknown }

const OPS: Record<string, (body: unknown, via: Via) => unknown> = {
  'dash.snapshot': (b, v) => dash.snapshot(b, v),
  'dash.server': (b, v) => dash.server(b, v),
  'dash.subscription': (b, v) => dash.subscription(b, v),
  'dash.pack': (b, v) => dash.pack(b, v),
  'dash.players': (b, v) => dash.players(b, v),
  'dash.report': (b, v) => dash.report(b, v),
  'dash.files': (b, v) => dash.files(b, v),
  'dash.clearFiles': (_b, v) => dash.clearFiles(v),
  'dash.heartbeat': (b, v) => dash.heartbeat(b, v),
  'dash.schema': () => dash.schema(),
  'dash.read': () => dash.read(),
}

/**
 * Accept writes from an embedding page. The origin allowlist is not
 * optional and has no wildcard: a dashboard that takes numbers from
 * any frame that can reach it is not a dashboard.
 */
export function listenPostMessage(allowedOrigins: string[]): () => void {
  const allowed = new Set(allowedOrigins.filter(Boolean))
  const onMessage = (e: MessageEvent) => {
    if (!allowed.has(e.origin)) return
    const msg = e.data as Envelope | null
    if (!msg || typeof msg !== 'object' || msg.vellum !== DASH_API_VERSION) return
    const handler = OPS[msg.op]
    const result = handler
      ? handler(msg.body, 'postMessage')
      : { ok: false, problems: [`unknown op ${msg.op}`] }
    e.source?.postMessage({ vellum: DASH_API_VERSION, id: msg.id, result }, { targetOrigin: e.origin })
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

/* ---------------- transport 3: the plugin's own endpoint ---------------- */

export type Link = {
  baseUrl: string
  token: string
  intervalMs: number
  /** try Server-Sent Events before falling back to polling */
  stream: boolean
}

export type LinkState = {
  link: Link | null
  status: 'idle' | 'connecting' | 'streaming' | 'polling' | 'error'
  detail: string | null
}

const STORAGE_KEY = 'vellum.dash.link'

export function loadLink(): Link | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Link) : null
  } catch {
    // private mode, or blocked site data - a link that cannot persist still works
    return null
  }
}

function saveLink(link: Link | null) {
  try {
    if (link) localStorage.setItem(STORAGE_KEY, JSON.stringify(link))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to do - the link lives for this session only */
  }
}

let active: { stop: () => void } | null = null

/**
 * Point Vellum at a URL the plugin serves. SSE first, because a card
 * that updates when the pack is pushed beats one that updates up to a
 * minute later; polling is the fallback, and every failure is reported
 * rather than retried in silence.
 *
 * The plugin's server must allow this origin with CORS, and the SSE
 * token travels as a query parameter because EventSource cannot set a
 * header - so treat it as something that will appear in access logs.
 */
export function connect(link: Link, onState: (s: LinkState) => void): () => void {
  disconnect()
  saveLink(link)

  const base = link.baseUrl.replace(/\/+$/, '')
  let stopped = false
  let timer = 0
  let source: EventSource | null = null

  const apply = (payload: unknown, why: string) => {
    const result = dash.snapshot(payload, 'http')
    if (!result.ok) onState({ link, status: 'error', detail: `${why}: ${result.problems[0] ?? 'nothing applied'}` })
  }

  const poll = async () => {
    if (stopped) return
    try {
      const res = await fetch(`${base}/dash/snapshot`, {
        headers: link.token ? { Authorization: `Bearer ${link.token}` } : {},
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      apply(await res.json(), 'poll')
      dash.heartbeat({ everySeconds: Math.round(link.intervalMs / 1000) }, 'http')
      onState({ link, status: 'polling', detail: null })
    } catch (e) {
      onState({ link, status: 'error', detail: (e as Error).message })
    }
    if (!stopped) timer = window.setTimeout(poll, link.intervalMs)
  }

  const startStream = () => {
    const url = `${base}/dash/events${link.token ? `?token=${encodeURIComponent(link.token)}` : ''}`
    try {
      source = new EventSource(url)
    } catch {
      void poll()
      return
    }
    let everArrived = false
    source.onopen = () => onState({ link, status: 'streaming', detail: null })
    source.onmessage = (e) => {
      everArrived = true
      try {
        apply(JSON.parse(e.data), 'stream')
      } catch {
        onState({ link, status: 'error', detail: 'an event was not valid JSON' })
      }
    }
    source.onerror = () => {
      source?.close()
      source = null
      if (stopped) return
      // a stream that never opened means the plugin does not serve one
      onState({
        link,
        status: 'connecting',
        detail: everArrived ? 'stream dropped, polling instead' : 'no event stream, polling instead',
      })
      void poll()
    }
  }

  onState({ link, status: 'connecting', detail: null })
  if (link.stream) startStream()
  else void poll()

  const stop = () => {
    stopped = true
    if (timer) window.clearTimeout(timer)
    source?.close()
    source = null
  }
  active = { stop }
  return stop
}

export function disconnect() {
  active?.stop()
  active = null
  saveLink(null)
}
