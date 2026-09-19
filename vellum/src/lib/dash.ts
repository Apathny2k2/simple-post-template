/* ---------------------------------------------------------------
   Dashboard state, and the gate everything entering it goes through.

   Every value on the Dash comes from outside this app - a server
   plugin reports its realm, its pack build and who is running an old
   copy. So this module has two jobs, and the second one matters more:

   1. Hold that state and tell anyone who cares when it changes.
   2. Refuse to store anything it cannot render.

   An ingest endpoint that trusts its caller is a crash waiting for a
   plugin bug. Everything here is coerced into range, truncated to a
   length the layout survives, and reported back to the caller when it
   had to be corrected - so a plugin author finds out from the API
   rather than from a broken card. Nothing is thrown away silently.

   The seed below is the frozen sample the Dash has always shown. It
   stays until a plugin feeds a card, and each card knows individually
   whether it is still a fixture or now live.
   --------------------------------------------------------------- */

export type Health = 'live' | 'stale' | 'offline'
export type Source = 'fixture' | 'plugin'

export type BreakdownRow = { label: string; count: number }

export type ServerState = {
  name: string
  host: string
  ip: string
  /** free text from the plugin - Connected, Restarting, Degraded... */
  status: string
  online: boolean
  breakdown: BreakdownRow[]
  /** total files synced; derived from `breakdown` when the plugin omits it */
  total: number
}

export type PackState = {
  archive: string
  /** bytes on the wire; the card does the formatting */
  bytes: number
  hash: string
  pushedAt: string
  version: string | null
}

export type PlayerCensus = {
  correct: number
  wrong: number
  sampledAt: string
}

export type SubscriptionState = {
  type: string
  cloud: string
  seats: string
}

export type PackSync = 'in-sync' | 'outdated' | 'unknown'

export type FileTouch = {
  id: string
  name: string
  where: string
  touchedAt: string
  by: string
  sync: PackSync
  /** how many connected clients still hold an old copy of this file */
  staleClients: number
}

/**
 * One person with access to a paid account's workspace. The identity is
 * per-member rather than per-seat: a shared workspace where two people
 * are both "the licence" tells you nothing about who touched what.
 */
export type Member = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  /** ISO 8601 */
  seenAt: string
  /** files this member currently has open for editing */
  holding: number
}

/**
 * The database Vellum allocates to a paid account. The plugin syncs
 * against it, so a team opens the same files from the same place.
 */
export type Workspace = {
  id: string
  region: string
  status: 'synced' | 'syncing' | 'paused' | 'error'
  usedBytes: number
  quotaBytes: number
  /** ISO 8601 */
  syncedAt: string
  members: Member[]
}

export type DashSnapshot = {
  server: ServerState
  pack: PackState
  players: PlayerCensus
  subscription: SubscriptionState
  files: FileTouch[]
  cloud: Workspace
}

export type Section = keyof DashSnapshot

/**
 * One release note, pushed into a studio from the Master Console. The
 * About panel used to reserve a region for these and render nothing;
 * this is the shape that fills it.
 */
export type Release = {
  id: string
  version: string
  /** which half of Vellum the note is about */
  channel: 'studio' | 'plugin'
  /** ISO 8601, already normalised */
  at: string
  title: string
  notes: string[]
}

export type DashMeta = {
  /** the plugin's self-reported name and version, from its heartbeat */
  agent: string | null
  /** epoch ms of the last accepted write, or null if never fed */
  lastSeen: number | null
  /** how often the plugin promises to report; drives staleness */
  heartbeatSeconds: number
  /** the sections a plugin has fed; the rest are still the sample */
  fed: Section[]
}

/** One accepted or rejected write, for the feed log on the Dash. */
export type IngestRecord = {
  id: string
  at: number
  op: string
  ok: boolean
  /** values that had to be corrected, or the reason it was refused */
  problems: string[]
  via: 'bridge' | 'postMessage' | 'http' | 'ui'
}

/* ---------------- limits ----------------
   Chosen from what the cards can actually lay out, not from a database
   column width. A name longer than this does not get rejected - it gets
   truncated, and the caller is told. */

export const LIMITS = {
  name: 64,
  host: 120,
  ip: 45, // an IPv6 literal with a scope id
  status: 32,
  label: 32,
  breakdownRows: 12,
  archive: 96,
  hash: 80,
  version: 32,
  plan: 32,
  seats: 24,
  fileName: 120,
  filePath: 160,
  author: 48,
  region: 32,
  workspaceId: 48,
  members: 40,
  /** the table scrolls, but a plugin streaming every save would grow forever */
  files: 50,
  releaseTitle: 96,
  releaseNote: 200,
  releaseNotes: 12,
  releases: 30,
  count: 1_000_000_000,
} as const

/* ---------------- coercion ----------------
   Each helper takes what arrived, pushes it into range, and appends a
   note to `problems` when it had to. `problems` is the return value the
   endpoints hand back - a 200 with corrections is not a silent success. */

type Problems = string[]

/** `JSON.stringify` turns NaN and Infinity into "null", naming a value nobody sent. */
const show = (v: unknown) =>
  typeof v === 'number' && !Number.isFinite(v) ? String(v) : JSON.stringify(v)

function str(v: unknown, field: string, max: number, fallback: string, problems: Problems): string {
  if (v === undefined || v === null) return fallback
  if (typeof v !== 'string') {
    problems.push(`${field}: expected a string, got ${typeof v} - kept the previous value`)
    return fallback
  }
  // a control character would not render; a tab in a table cell is a mess
  // oxlint-disable-next-line no-control-regex -- stripping them is the point
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (!clean) return fallback
  if (clean.length > max) {
    problems.push(`${field}: truncated to ${max} characters`)
    return clean.slice(0, max)
  }
  return clean
}

function num(
  v: unknown,
  field: string,
  opts: { min: number; max: number; fallback: number; integer?: boolean },
  problems: Problems,
): number {
  if (v === undefined || v === null) return opts.fallback
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) {
    problems.push(`${field}: ${show(v)} is not a finite number - kept the previous value`)
    return opts.fallback
  }
  const rounded = opts.integer === false ? n : Math.round(n)
  if (rounded < opts.min || rounded > opts.max) {
    problems.push(`${field}: ${rounded} is outside ${opts.min}..${opts.max} - clamped`)
    return Math.max(opts.min, Math.min(opts.max, rounded))
  }
  return rounded
}

function bool(v: unknown, field: string, fallback: boolean, problems: Problems): boolean {
  if (v === undefined || v === null) return fallback
  if (typeof v === 'boolean') return v
  /* `online: 1` is the natural shape out of Java, SQL and PHP, and this
     is the field that says whether the realm is up - silently keeping
     the old value was the worst place in the API to do that. */
  if (v === 1 || v === 0) {
    problems.push(`${field}: got ${v}, read as ${v === 1} - send a boolean`)
    return v === 1
  }
  problems.push(`${field}: expected a boolean, got ${typeof v} - kept the previous value`)
  return fallback
}

/**
 * Timestamps arrive as ISO 8601, epoch millis or epoch seconds, because
 * every plugin language reaches for a different one. All three are
 * accepted; anything else falls back rather than rendering "Invalid Date".
 */
function when(v: unknown, field: string, fallback: string, problems: Problems): string {
  if (v === undefined || v === null) return fallback
  let d: Date
  if (typeof v === 'number') {
    // a plugin sending seconds would otherwise land in 1970
    d = new Date(v < 1e11 ? v * 1000 : v)
  } else if (typeof v === 'string') {
    d = new Date(/^\d+$/.test(v) ? Number(v) * (v.length <= 10 ? 1000 : 1) : v)
  } else {
    problems.push(`${field}: expected ISO 8601 or an epoch number`)
    return fallback
  }
  if (Number.isNaN(d.getTime())) {
    problems.push(`${field}: ${show(v)} is not a readable timestamp`)
    return fallback
  }
  return d.toISOString()
}

function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[], fallback: T, problems: Problems): T {
  if (v === undefined || v === null) return fallback
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T
  problems.push(`${field}: ${show(v)} is not one of ${allowed.join(' | ')} - used ${fallback}`)
  return fallback
}

/**
 * Reports unknown keys, and counts the known ones actually present.
 * A body carrying none of them applied nothing, and an endpoint that
 * answers `ok` to that has told the caller their plugin is working.
 */
function scan(body: Record<string, unknown>, known: readonly string[], problems: Problems) {
  const extra = Object.keys(body).filter((k) => !known.includes(k))
  if (extra.length) problems.push(`ignored unknown field(s): ${extra.join(', ')}`)
  return { touched: known.filter((k) => body[k] !== undefined), known }
}

/* ---------------- the sample the Dash starts on ---------------- */

const SEED: DashSnapshot = {
  server: {
    name: 'Vellum PvP',
    host: 'eu-west-2.vellum.gg',
    ip: '10.42.6.118',
    status: 'Connected',
    online: true,
    breakdown: [
      { label: 'Assets', count: 13 },
      { label: 'Rigs', count: 4 },
      { label: 'Mobs', count: 1 },
    ],
    total: 18,
  },
  pack: {
    archive: 'current.zip',
    bytes: 43_834_572,
    hash: 'sha1:9f2c04e1',
    pushedAt: '2026-09-12T14:02:00.000Z',
    version: null,
  },
  players: { correct: 13, wrong: 7, sampledAt: '2026-09-18T23:30:00.000Z' },
  subscription: { type: 'Free', cloud: 'N/A', seats: '1 of 1' },
  files: [
    ['euler.vellum', '/aurelian/rigs', '2026-09-16T18:41:00.000Z', 'g.alex', 'in-sync', 0],
    ['keep_warden.vellum', '/aurelian/mobs', '2026-09-16T11:07:00.000Z', 'kite', 'in-sync', 0],
    ['brass_lantern.vellum', '/aurelian/items', '2026-09-15T22:19:00.000Z', 'nine', 'outdated', 7],
    ['tide_compass.vellum', '/tidewrack/items', '2026-09-14T09:55:00.000Z', 'm.ferris', 'in-sync', 0],
    ['ember_hound.vellum', '/emberfall/mobs', '2026-09-13T16:30:00.000Z', 'aurelia', 'in-sync', 0],
  ].map(([name, where, touchedAt, by, sync, staleClients], i) => ({
    id: `seed-${i}`,
    name: name as string,
    where: where as string,
    touchedAt: touchedAt as string,
    by: by as string,
    sync: sync as PackSync,
    staleClients: staleClients as number,
  })),
  cloud: {
    id: 'ws_aurelian_7f21',
    region: 'eu-west-2',
    status: 'paused',
    usedBytes: 0,
    quotaBytes: 5_368_709_120,
    syncedAt: '2026-09-18T23:30:00.000Z',
    members: [
      { id: 'm-1', name: 'g.alex', role: 'owner', seenAt: '2026-09-19T09:12:00.000Z', holding: 0 },
    ],
  },
}

const clone = (s: DashSnapshot): DashSnapshot => ({
  server: { ...s.server, breakdown: s.server.breakdown.map((r) => ({ ...r })) },
  pack: { ...s.pack },
  players: { ...s.players },
  subscription: { ...s.subscription },
  files: s.files.map((f) => ({ ...f })),
  cloud: { ...s.cloud, members: s.cloud.members.map((m) => ({ ...m })) },
})

/* ---------------- store ---------------- */

export type DashEvent =
  | { type: 'section'; section: Section }
  | { type: 'meta' }
  | { type: 'ingest'; record: IngestRecord }
  | { type: 'releases' }

type Listener = (e: DashEvent) => void

let seq = 0
const nextId = (p: string) => `${p}-${(seq += 1).toString(36)}-${Date.now().toString(36)}`

class DashStore {
  snapshot: DashSnapshot = clone(SEED)
  meta: DashMeta = { agent: null, lastSeen: null, heartbeatSeconds: 30, fed: [] }
  /** newest first, capped - the feed log on the Dash reads this */
  log: IngestRecord[] = []
  /**
   * player -> the pack hash that client last acknowledged. Kept so a
   * plugin can report one client at a time (which is all a join event
   * knows) and let Vellum do the counting.
   */
  roster = new Map<string, string>()

  /**
   * Release notes from the Master Console. Empty until one pushes:
   * the About panel falls back to what this build knows about itself,
   * which is honest rather than blank.
   */
  releases: Release[] = []

  /**
   * Bumped on every change. The snapshot is mutated in place, so its
   * identity never changes and React would see nothing - this counter
   * is what `useSyncExternalStore` actually watches.
   */
  version = 0

  private listeners = new Set<Listener>()

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit(e: DashEvent) {
    this.version += 1
    for (const fn of [...this.listeners]) fn(e)
  }

  /** Re-render the given cards without adding a line to the feed log. */
  notify(sections: Section[]) {
    for (const section of sections) {
      if (!this.meta.fed.includes(section)) this.meta = { ...this.meta, fed: [...this.meta.fed, section] }
      this.emit({ type: 'section', section })
    }
  }

  /** Record a write and mark the section live. Returns what was corrected. */
  accept(
    section: Section | null,
    op: string,
    problems: string[],
    via: IngestRecord['via'],
    ok = true,
  ): IngestRecord {
    const record: IngestRecord = { id: nextId('ing'), at: Date.now(), op, ok, problems, via }
    this.log = [record, ...this.log].slice(0, 40)

    if (ok) {
      this.meta = {
        ...this.meta,
        lastSeen: record.at,
        fed: section && !this.meta.fed.includes(section) ? [...this.meta.fed, section] : this.meta.fed,
      }
      if (section) this.emit({ type: 'section', section })
      this.emit({ type: 'meta' })
    }
    this.emit({ type: 'ingest', record })
    return record
  }

  setReleases(releases: Release[]) {
    this.releases = releases
    this.emit({ type: 'releases' })
  }

  setAgent(agent: string | null, heartbeatSeconds: number) {
    this.meta = { ...this.meta, agent, heartbeatSeconds }
    this.emit({ type: 'meta' })
  }

  /** Back to the frozen sample, as if no plugin had ever connected. */
  reset() {
    this.snapshot = clone(SEED)
    this.meta = { agent: null, lastSeen: null, heartbeatSeconds: 30, fed: [] }
    this.log = []
    this.roster.clear()
    this.releases = []
    this.emit({ type: 'releases' })
    this.emit({ type: 'meta' })
    for (const s of ['server', 'pack', 'players', 'subscription', 'files', 'cloud'] as Section[]) {
      this.emit({ type: 'section', section: s })
    }
  }
}

export const dashStore = new DashStore()

/* ---------------- validators, one per card ---------------- */

export function readServer(body: Record<string, unknown>, current: ServerState) {
  const problems: Problems = []
  const scanned = scan(body, ['name', 'host', 'ip', 'status', 'online', 'breakdown', 'total'], problems)

  let breakdown = current.breakdown
  if (body.breakdown !== undefined) {
    if (!Array.isArray(body.breakdown)) {
      problems.push('breakdown: expected an array - kept the previous value')
    } else {
      const rows = body.breakdown as Array<Record<string, unknown>>
      if (rows.length > LIMITS.breakdownRows) {
        problems.push(`breakdown: kept the first ${LIMITS.breakdownRows} of ${rows.length} rows`)
      }
      breakdown = rows.slice(0, LIMITS.breakdownRows).map((row, i) => ({
        label: str(row?.label, `breakdown[${i}].label`, LIMITS.label, `row ${i + 1}`, problems),
        count: num(row?.count, `breakdown[${i}].count`, { min: 0, max: LIMITS.count, fallback: 0 }, problems),
      }))
    }
  }

  const value: ServerState = {
    name: str(body.name, 'name', LIMITS.name, current.name, problems),
    host: str(body.host, 'host', LIMITS.host, current.host, problems),
    ip: str(body.ip, 'ip', LIMITS.ip, current.ip, problems),
    status: str(body.status, 'status', LIMITS.status, current.status, problems),
    online: bool(body.online, 'online', current.online, problems),
    breakdown,
    // a plugin that reports rows but no total means the sum of the rows
    total:
      body.total === undefined
        ? breakdown.reduce((n, r) => n + r.count, 0)
        : num(body.total, 'total', { min: 0, max: LIMITS.count, fallback: current.total }, problems),
  }
  return { value, problems, touched: scanned.touched, known: scanned.known }
}

export function readPack(body: Record<string, unknown>, current: PackState) {
  const problems: Problems = []
  const scanned = scan(body, ['archive', 'bytes', 'hash', 'pushedAt', 'version'], problems)
  const value: PackState = {
    archive: str(body.archive, 'archive', LIMITS.archive, current.archive, problems),
    bytes: num(body.bytes, 'bytes', { min: 0, max: 1e12, fallback: current.bytes }, problems),
    hash: str(body.hash, 'hash', LIMITS.hash, current.hash, problems),
    pushedAt: when(body.pushedAt, 'pushedAt', current.pushedAt, problems),
    version:
      body.version === undefined || body.version === null
        ? current.version
        : str(body.version, 'version', LIMITS.version, current.version ?? '', problems) || null,
  }
  return { value, problems, touched: scanned.touched, known: scanned.known }
}

export function readPlayers(body: Record<string, unknown>, current: PlayerCensus) {
  const problems: Problems = []
  const scanned = scan(body, ['correct', 'wrong', 'sampledAt'], problems)
  const value: PlayerCensus = {
    correct: num(body.correct, 'correct', { min: 0, max: LIMITS.count, fallback: current.correct }, problems),
    wrong: num(body.wrong, 'wrong', { min: 0, max: LIMITS.count, fallback: current.wrong }, problems),
    sampledAt: when(body.sampledAt, 'sampledAt', new Date().toISOString(), problems),
  }
  return { value, problems, touched: scanned.touched, known: scanned.known }
}

export function readSubscription(body: Record<string, unknown>, current: SubscriptionState) {
  const problems: Problems = []
  const scanned = scan(body, ['type', 'cloud', 'seats'], problems)
  const value: SubscriptionState = {
    type: str(body.type, 'type', LIMITS.plan, current.type, problems),
    cloud: str(body.cloud, 'cloud', LIMITS.plan, current.cloud, problems),
    seats: str(body.seats, 'seats', LIMITS.seats, current.seats, problems),
  }
  return { value, problems, touched: scanned.touched, known: scanned.known }
}

export function readMember(body: Record<string, unknown>, index: number, problems: Problems): Member | null {
  const name = str(body?.name, `members[${index}].name`, LIMITS.name, '', problems)
  if (!name) {
    problems.push(`members[${index}]: dropped, it has no name`)
    return null
  }
  return {
    id: typeof body?.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : nextId('m'),
    name,
    role: oneOf(body?.role, `members[${index}].role`, ['owner', 'editor', 'viewer'] as const, 'viewer', problems),
    seenAt: when(body?.seenAt, `members[${index}].seenAt`, new Date().toISOString(), problems),
    holding: num(body?.holding, `members[${index}].holding`, { min: 0, max: LIMITS.files, fallback: 0 }, problems),
  }
}

export function readCloud(body: Record<string, unknown>, current: Workspace) {
  const problems: Problems = []
  const known = ['id', 'region', 'status', 'usedBytes', 'quotaBytes', 'syncedAt', 'members'] as const
  const scanned = scan(body, known, problems)

  let members = current.members
  if (body.members !== undefined) {
    if (!Array.isArray(body.members)) {
      problems.push('members: expected an array - kept the previous list')
    } else {
      if (body.members.length > LIMITS.members)
        problems.push(`members: ${body.members.length} listed, kept the first ${LIMITS.members}`)
      members = body.members
        .slice(0, LIMITS.members)
        .map((m, i) => readMember((m ?? {}) as Record<string, unknown>, i, problems))
        .filter((m): m is Member => m !== null)
    }
  }

  const value: Workspace = {
    id: str(body.id, 'id', LIMITS.workspaceId, current.id, problems),
    region: str(body.region, 'region', LIMITS.region, current.region, problems),
    status: oneOf(body.status, 'status', ['synced', 'syncing', 'paused', 'error'] as const, current.status, problems),
    usedBytes: num(body.usedBytes, 'usedBytes', { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: current.usedBytes }, problems),
    quotaBytes: num(body.quotaBytes, 'quotaBytes', { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: current.quotaBytes }, problems),
    syncedAt: when(body.syncedAt, 'syncedAt', current.syncedAt, problems),
    members,
  }
  return { value, problems, touched: scanned.touched, known }
}

export function readFile(body: Record<string, unknown>, index: number, problems: Problems): FileTouch | null {
  const name = str(body?.name, `files[${index}].name`, LIMITS.fileName, '', problems)
  if (!name) {
    problems.push(`files[${index}]: dropped, it has no name`)
    return null
  }
  return {
    id: nextId('f'),
    name,
    where: str(body?.where, `files[${index}].where`, LIMITS.filePath, '/', problems),
    touchedAt: when(body?.touchedAt, `files[${index}].touchedAt`, new Date().toISOString(), problems),
    by: str(body?.by, `files[${index}].by`, LIMITS.author, 'unknown', problems),
    sync: oneOf(body?.sync, `files[${index}].sync`, ['in-sync', 'outdated', 'unknown'] as const, 'unknown', problems),
    staleClients: num(
      body?.staleClients,
      `files[${index}].staleClients`,
      { min: 0, max: LIMITS.count, fallback: 0 },
      problems,
    ),
  }
}

/**
 * One entry of a changelog push. Notes that are not strings are dropped
 * with a line in `problems` rather than rendered as "[object Object]".
 */
export function readRelease(body: Record<string, unknown>, index: number, problems: Problems): Release | null {
  const version = str(body?.version, `releases[${index}].version`, LIMITS.version, '', problems)
  if (!version) {
    problems.push(`releases[${index}]: dropped, it names no version`)
    return null
  }

  let notes: string[] = []
  if (body?.notes !== undefined) {
    if (!Array.isArray(body.notes)) {
      problems.push(`releases[${index}].notes: expected an array - dropped`)
    } else {
      if (body.notes.length > LIMITS.releaseNotes)
        problems.push(
          `releases[${index}].notes: ${body.notes.length} notes, kept the first ${LIMITS.releaseNotes}`,
        )
      notes = body.notes
        .slice(0, LIMITS.releaseNotes)
        .map((n, i) => str(n, `releases[${index}].notes[${i}]`, LIMITS.releaseNote, '', problems))
        .filter(Boolean)
    }
  }

  return {
    id: nextId('rel'),
    version,
    channel: oneOf(body?.channel, `releases[${index}].channel`, ['studio', 'plugin'] as const, 'studio', problems),
    at: when(body?.at, `releases[${index}].at`, new Date().toISOString(), problems),
    title: str(body?.title, `releases[${index}].title`, LIMITS.releaseTitle, version, problems),
    notes,
  }
}

/** The whole changelog, newest first, however the console ordered it. */
export function readReleases(value: unknown, problems: Problems): Release[] {
  if (!Array.isArray(value)) {
    problems.push('releases: expected an array - nothing applied')
    return []
  }
  if (value.length > LIMITS.releases)
    problems.push(`releases: ${value.length} entries, kept the newest ${LIMITS.releases}`)
  const out = value
    .slice(0, LIMITS.releases)
    .map((r, i) => readRelease((r ?? {}) as Record<string, unknown>, i, problems))
    .filter((r): r is Release => r !== null)
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return out
}

/* ---------------- derived ---------------- */

/**
 * Live until a heartbeat is missed, stale for the next few, then offline.
 * A dashboard that keeps showing yesterday's numbers as though they were
 * current is worse than one that admits it lost the plugin.
 */
export function healthOf(meta: DashMeta, now = Date.now()): Health {
  if (meta.lastSeen === null) return 'offline'
  const age = (now - meta.lastSeen) / 1000
  if (age <= meta.heartbeatSeconds * 2) return 'live'
  if (age <= meta.heartbeatSeconds * 6) return 'stale'
  return 'offline'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

export function formatWhen(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'unknown'
  const secs = Math.round((now - t) / 1000)
  if (secs < 45) return 'just now'
  if (secs < 5400) return `${Math.round(secs / 60)}m ago`
  if (secs < 172800) return `${Math.round(secs / 3600)}h ago`
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
