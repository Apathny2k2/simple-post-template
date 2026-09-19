import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Card } from '../components/Card'
import { Menu } from '../components/Menu'
import { ApiReference as ApiSurface, EndpointBadge } from '../components/Endpoint'
import { Icon } from '../lib/icons'
import {
  dashStore,
  formatBytes,
  formatWhen,
  healthOf,
} from '../lib/dash'
import type { Health, Section } from '../lib/dash'
import {
  DASH_API_VERSION,
  DASH_BASE,
  connect,
  dash,
  dashEndpoints,
  disconnect,
  loadLink,
} from '../lib/dash-api'
import type { Link, LinkState } from '../lib/dash-api'
import './Dashboard.css'

const inert = { kind: 'label' as const, label: 'Placeholder - no actions wired' }

const dotsTrigger = ({ toggle, id }: { toggle: () => void; id: string }) => (
  <button className="icon-btn" id={id} onClick={toggle} aria-label="Card actions">
    <Icon name="dots" size={16} />
  </button>
)

/* ---------------- reading the store ---------------- */

const subscribe = (fn: () => void) => dashStore.subscribe(fn)
const getVersion = () => dashStore.version

/**
 * The snapshot is mutated in place by the ingest layer, so its identity
 * never changes - the version counter is what React watches. The clock
 * tick is separate: health decays with wall time, not with writes, so a
 * plugin that goes quiet has to be noticed without an event to notice.
 */
function useDash() {
  useSyncExternalStore(subscribe, getVersion)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const { snapshot, meta, log } = dashStore
  return { snapshot, meta, log, now, health: healthOf(meta, now) }
}

/* ---------------- shared bits ---------------- */

const HEALTH_LABEL: Record<Health, string> = {
  live: 'Live',
  stale: 'Stale',
  offline: 'No feed',
}

function HealthPill({ health, meta, now }: { health: Health; meta: { agent: string | null; lastSeen: number | null }; now: number }) {
  const seen = meta.lastSeen === null ? null : formatWhen(new Date(meta.lastSeen).toISOString(), now)
  return (
    <span className="feed-pill" data-health={health} title={meta.agent ?? 'No plugin has reported yet'}>
      <span className="feed-pill__dot" />
      {HEALTH_LABEL[health]}
      {seen ? <span className="feed-pill__seen">{seen}</span> : null}
    </span>
  )
}

/** Marks a card whose numbers are still the built-in sample. */
function SourceMark({ fed, section }: { fed: Section[]; section: Section }) {
  if (fed.includes(section)) return null
  return (
    <span className="src-mark" title={`No plugin has fed this card - showing the built-in sample`}>
      sample
    </span>
  )
}

/* ---------------- the feed card ---------------- */

const VIA_LABEL: Record<string, string> = {
  bridge: 'window',
  postMessage: 'frame',
  http: 'http',
  ui: 'here',
}

function FeedCard({
  health,
  meta,
  log,
  now,
}: {
  health: Health
  meta: { agent: string | null; lastSeen: number | null; heartbeatSeconds: number }
  log: Array<{ id: string; at: number; op: string; ok: boolean; problems: string[]; via: string }>
  now: number
}) {
  const [link, setLink] = useState<Link>(
    () => loadLink() ?? { baseUrl: '', token: '', intervalMs: 15000, stream: true },
  )
  const [state, setState] = useState<LinkState>({ link: null, status: 'idle', detail: null })
  const [demo, setDemo] = useState(false)

  // a saved link reconnects on load, so a reload does not drop the realm
  useEffect(() => {
    const saved = loadLink()
    if (!saved?.baseUrl) return
    const stop = connect(saved, setState)
    return stop
  }, [])

  /* The simulator drives the real endpoints - the same validator, the
     same log - so what you see here is exactly what a plugin gets. It
     exists because without a plugin there is nothing to look at. */
  useEffect(() => {
    if (!demo) return
    let n = 0
    const names = ['keep_warden.vellum', 'brass_lantern.vellum', 'tide_compass.vellum', 'ember_hound.vellum']
    const people = ['g.alex', 'kite', 'nine', 'm.ferris']
    dash.heartbeat({ agent: 'Simulated plugin 0.1', everySeconds: 3 }, 'ui')
    dash.server({ name: 'Vellum PvP', host: 'eu-west-2.vellum.gg', ip: '10.42.6.118', status: 'Connected', online: true }, 'ui')
    const id = window.setInterval(() => {
      n += 1
      dash.heartbeat({ agent: 'Simulated plugin 0.1', everySeconds: 3 }, 'ui')
      dash.report({ player: `player_${n % 19}`, packHash: n % 4 === 0 ? 'sha1:outdated' : dashStore.snapshot.pack.hash }, 'ui')
      if (n % 4 === 0) {
        dash.files(
          {
            name: names[n % names.length],
            where: '/aurelian/mobs',
            by: people[n % people.length],
            sync: n % 8 === 0 ? 'outdated' : 'in-sync',
            staleClients: n % 8 === 0 ? 3 : 0,
          },
          'ui',
        )
      }
      if (n % 9 === 0) {
        dash.pack(
          { archive: 'current.zip', bytes: 43_834_572 + n * 2048, hash: `sha1:${(0x9f2c04e1 + n).toString(16)}` },
          'ui',
        )
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [demo])

  const start = useCallback(() => {
    if (!link.baseUrl.trim()) return
    connect({ ...link, baseUrl: link.baseUrl.trim() }, setState)
  }, [link])

  const stop = useCallback(() => {
    disconnect()
    setState({ link: null, status: 'idle', detail: null })
  }, [])

  const connected = state.status === 'streaming' || state.status === 'polling'

  return (
    <Card
      className="span-feed"
      eyebrow="Plugin feed"
      title="Where these numbers come from"
      note={`${DASH_BASE}/dash · bearer token · JSON in, JSON out · schema v${DASH_API_VERSION}`}
      dividedHead
      actions={<HealthPill health={health} meta={meta} now={now} />}
    >
      <div className="feed">
        <div className="feed__col">
          <p className="feed__lead">
            Point Vellum at a URL your plugin serves and it will read{' '}
            <code>GET {DASH_BASE}/dash/snapshot</code> on an interval, or stream{' '}
            <code>/dash/events</code> if you implement it. Your server has to allow this origin with CORS.
          </p>

          <label className="field">
            <span className="field__label">Plugin base URL</span>
            <input
              className="field__input"
              placeholder="http://realm.example:8123/api/v1"
              value={link.baseUrl}
              spellCheck={false}
              onChange={(e) => setLink((l) => ({ ...l, baseUrl: e.target.value }))}
            />
          </label>

          <div className="feed__row">
            <label className="field">
              <span className="field__label">Bearer token</span>
              <input
                className="field__input"
                type="password"
                placeholder="optional"
                value={link.token}
                onChange={(e) => setLink((l) => ({ ...l, token: e.target.value }))}
              />
            </label>
            <label className="field field--narrow">
              <span className="field__label">Poll</span>
              <select
                className="field__input"
                value={link.intervalMs}
                onChange={(e) => setLink((l) => ({ ...l, intervalMs: Number(e.target.value) }))}
              >
                <option value={5000}>5s</option>
                <option value={15000}>15s</option>
                <option value={30000}>30s</option>
                <option value={60000}>60s</option>
              </select>
            </label>
          </div>

          <label className="feed__check">
            <input
              type="checkbox"
              checked={link.stream}
              onChange={(e) => setLink((l) => ({ ...l, stream: e.target.checked }))}
            />
            Try the event stream first, fall back to polling
          </label>

          <div className="chip-row">
            <button className="btn btn--primary btn--sm" onClick={start} disabled={!link.baseUrl.trim() || connected}>
              <Icon name="cloud" size={13} /> Connect
            </button>
            <button className="btn btn--ghost btn--sm" onClick={stop} disabled={!connected && state.status !== 'error'}>
              Disconnect
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => dash.reset()} title="Drop back to the built-in sample">
              <Icon name="refresh" size={13} /> Reset to sample
            </button>
          </div>

          <p className="feed__state" data-status={state.status}>
            {state.status === 'idle' ? 'Not linked.' : state.status}
            {state.detail ? ` — ${state.detail}` : ''}
          </p>

          <label className="feed__check feed__check--sim">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Simulate a plugin, so you can watch the cards move
          </label>
          <p className="feed__hint">
            No plugin yet? Everything here is also on <code>window.Vellum.dash</code> — open the console and
            call <code>Vellum.dash.pack({'{'} archive: 'x.zip', bytes: 1024, hash: 'sha1:abc' {'}'})</code>.
          </p>
        </div>

        <div className="feed__col feed__col--log">
          <div className="feed__logtitle">
            <Icon name="server" size={12} /> Ingest log
            <span className="feed__logmeta">
              heartbeat every {meta.heartbeatSeconds}s{meta.agent ? ` · ${meta.agent}` : ''}
            </span>
          </div>
          {log.length ? (
            <ul className="feed__log">
              {log.slice(0, 9).map((r) => (
                <li key={r.id} data-ok={r.ok}>
                  <span className="feed__logvia">{VIA_LABEL[r.via] ?? r.via}</span>
                  <code>{r.op}</code>
                  <span className="feed__logtime">{formatWhen(new Date(r.at).toISOString(), now)}</span>
                  {r.problems.length ? (
                    <span className="feed__problems" title={r.problems.join('\n')}>
                      <Icon name="warning" size={10} /> {r.problems.length}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-hint">
              Nothing has been fed yet. Every accepted and refused write lands here, with whatever Vellum had to
              correct — so a plugin author finds out from the API rather than from a broken card.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ---------------- the reference ---------------- */

function DashApiReference() {
  return (
    <ApiSurface
      className="span-api"
      title="Dashboard API"
      note={`Base URL ${DASH_BASE} \u00b7 omitted fields keep their value \u00b7 corrections come back in problems[]`}
      base={DASH_BASE}
      endpoints={dashEndpoints}
      initialOpen="POST /dash/snapshot"
      actions={<EndpointBadge method="GET" path="/dash/schema" base={DASH_BASE} />}
    >
      <section className="api__group">
        <h4 className="api__gname">Without a network</h4>
        <p className="api__note">
          Every endpoint above is also a method on <code className="mono">window.Vellum.dash</code>, and
          the same calls arrive over <code className="mono">postMessage</code> from an allowlisted
          origin as <code className="mono">{'{ vellum: 1, op: "dash.pack", body }'}</code>. All three
          routes land in the same validator, so none of them can feed a card the others would refuse.
        </p>
      </section>
    </ApiSurface>
  )
}

/* ---------------- the page ---------------- */

/**
 * Main / Dash.
 *
 * Every number on this page describes a Minecraft realm that Vellum does
 * not run, so none of it is knowable from inside the tab - it is fed in
 * through the ingest API by a server plugin. Until one reports, each
 * card shows the built-in sample and says so; the moment a card is fed
 * it goes live independently of the others, because a plugin that only
 * knows about the pack should not have to invent a player count.
 */
export function Dashboard() {
  const { snapshot, meta, log, now, health } = useDash()
  const { server, pack, players, subscription, files } = snapshot

  const total = players.correct + players.wrong
  const pct = total ? Math.round((players.correct / total) * 100) : 0
  const live = meta.fed.length > 0

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Main</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            Overview of the linked realm, its resource pack and what the team touched last.
          </p>
        </div>
        <HealthPill health={health} meta={meta} now={now} />
      </div>

      {live ? null : (
        <div className="dash-banner">
          <Icon name="warning" size={16} />
          <span>
            No plugin has reported yet, so every card below is the built-in sample. Point Vellum at your
            server in <strong>Plugin feed</strong>, or push to{' '}
            <code>{DASH_BASE}/dash/snapshot</code> — each card goes live on its own as soon as it is fed.
          </span>
        </div>
      )}

      <div className="dash-grid">
        {/* ---------- server name + file breakdown ---------- */}
        <Card
          className="span-server"
          eyebrow={
            <>
              Server <SourceMark fed={meta.fed} section="server" />
            </>
          }
          title={server.name}
          note={server.host}
          dividedHead
          actions={
            <>
              <EndpointBadge method="PATCH" path="/dash/server" base={DASH_BASE} />
              <span className="server-tag" data-online={server.online}>
                {server.status}
              </span>
              <Menu align="end" entries={[inert, { label: 'Rename realm', icon: 'pencil' }, { label: 'Reconnect', icon: 'refresh' }, { kind: 'separator' }, { label: 'Unlink', icon: 'close', danger: true }]} trigger={dotsTrigger} />
            </>
          }
        >
          <div className="breakdown">
            <div className="breakdown__list">
              {server.breakdown.map((row) => (
                <div className="breakdown__row" key={row.label}>
                  <span className="breakdown__dot" />
                  {row.label}
                  <span className="breakdown__rule" />
                  <span className="breakdown__n">x{row.count}</span>
                </div>
              ))}
              {server.breakdown.length ? null : <p className="dash-hint">The plugin reported no breakdown rows.</p>}
            </div>
            <div className="stat">
              <div className="stat__value">{server.total}</div>
              <div className="stat__label">Total files synced</div>
            </div>
          </div>
        </Card>

        {/* ---------- power / subscription ---------- */}
        <Card
          className="span-power"
          eyebrow={
            <>
              Session <SourceMark fed={meta.fed} section="subscription" />
            </>
          }
          title="Realm power"
          actions={<EndpointBadge method="PATCH" path="/dash/subscription" base={DASH_BASE} />}
        >
          <div className="power">
            <button className="power__btn" type="button" aria-disabled="true" tabIndex={-1}>
              <Icon name="power" size={18} />
              Turn Off Vellum
            </button>
            <div className="kv">
              <div className="kv__row">
                <span className="kv__k">Sub type</span>
                <span className="kv__v">{subscription.type}</span>
              </div>
              <div className="kv__row">
                <span className="kv__k">Cloud</span>
                <span className="kv__v">{subscription.cloud}</span>
              </div>
              <div className="kv__row">
                <span className="kv__k">Seats</span>
                <span className="kv__v">{subscription.seats}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ---------- resource pack ---------- */}
        <Card
          className="span-pack"
          eyebrow={
            <>
              Resource pack info <SourceMark fed={meta.fed} section="pack" />
            </>
          }
          title={pack.version ? `Build ${pack.version}` : 'Current build'}
          note={`Pushed ${formatWhen(pack.pushedAt, now)}`}
          actions={<EndpointBadge method="PATCH" path="/dash/pack" base={DASH_BASE} />}
        >
          <div className="pack__file">
            <Icon name="file" size={18} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pack__name">{pack.archive}</div>
              <div className="pack__meta">
                {formatBytes(pack.bytes)} &middot; {pack.hash}
              </div>
            </div>
            <button className="icon-btn" aria-label="Download archive" tabIndex={-1}>
              <Icon name="download" size={16} />
            </button>
          </div>
          <button
            className="btn btn--primary btn--block"
            type="button"
            aria-disabled="true"
            tabIndex={-1}
            style={{ marginTop: 'var(--sp-3)' }}
          >
            <Icon name="upload" size={14} /> Push fresh
          </button>
        </Card>

        {/* ---------- player pack counts ---------- */}
        <Card
          className="span-count"
          eyebrow={
            <>
              Players <SourceMark fed={meta.fed} section="players" />
            </>
          }
          title="Pack adoption"
          actions={<EndpointBadge method="POST" path="/dash/players/report" base={DASH_BASE} />}
        >
          <div className="counts">
            <div className="count-tile count-tile--ok">
              <div className="count-tile__v">x{players.correct}</div>
              <div className="count-tile__l">On current pack</div>
            </div>
            <div className="count-tile count-tile--warn">
              <div className="count-tile__v">x{players.wrong}</div>
              <div className="count-tile__l">Wrong / old pack</div>
            </div>
          </div>
          <div className="meter" role="img" aria-label={`${pct}% of players on the current pack`}>
            <span className="meter__fill" style={{ width: `${pct}%` }} />
            <span className="meter__rest" style={{ width: `${100 - pct}%` }} />
          </div>
          <p className="card__note" style={{ marginTop: 'var(--sp-2)' }}>
            {total
              ? `${pct}% of ${total} connected players are up to date · counted ${formatWhen(players.sampledAt, now)}`
              : 'Nobody is connected.'}
          </p>
        </Card>

        {/* ---------- the feed itself ---------- */}
        <FeedCard health={health} meta={meta} log={log} now={now} />

        {/* ---------- recent files ---------- */}
        <Card
          className="span-recent"
          eyebrow={
            <>
              Recent files <SourceMark fed={meta.fed} section="files" />
            </>
          }
          title="Last touched"
          note="Also flags players still holding a wrong or outdated pack."
          dividedHead
          actions={
            <>
              <EndpointBadge method="POST" path="/dash/files" base={DASH_BASE} />
              <Menu
                align="end"
                entries={[inert, { label: 'Open folder', icon: 'folder' }, { label: 'Export list', icon: 'download' }, { kind: 'separator' }, { label: 'Clear history', icon: 'trash', danger: true }]}
                trigger={dotsTrigger}
              />
            </>
          }
        >
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Directory</th>
                  <th>Touched</th>
                  <th>By</th>
                  <th>Pack state</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="cell-name">{f.name}</td>
                    <td className="cell-dir">{f.where}</td>
                    <td className="mono">{formatWhen(f.touchedAt, now)}</td>
                    <td>{f.by}</td>
                    <td>
                      {f.sync === 'outdated' ? (
                        <span className="pack-chip pack-chip--old">
                          <Icon name="warning" size={10} />
                          {f.staleClients ? ` old on ${f.staleClients} clients` : ' outdated'}
                        </span>
                      ) : f.sync === 'in-sync' ? (
                        <span className="pack-chip pack-chip--ok">
                          <Icon name="check" size={10} /> in sync
                        </span>
                      ) : (
                        <span className="pack-chip">not reported</span>
                      )}
                    </td>
                  </tr>
                ))}
                {files.length ? null : (
                  <tr>
                    <td colSpan={5} className="dash-empty">
                      No file touches reported. Call <code>POST {DASH_BASE}/dash/files</code> when your plugin
                      sees one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ---------- the contract ---------- */}
        <DashApiReference />
      </div>

      <div className="status-strip">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="status-strip__dot" data-online={server.online} />
          &lt;{server.status}&gt;
        </span>
        <span>{server.ip}</span>
        <span>dash api v{DASH_API_VERSION}</span>
        <span style={{ marginLeft: 'auto' }}>
          {live
            ? `${meta.fed.length} of 5 cards fed · ${meta.agent ?? 'unnamed agent'}`
            : 'Sample data — nothing has been fed yet.'}
        </span>
      </div>
    </main>
  )
}
