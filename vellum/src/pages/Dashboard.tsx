import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Card } from '../components/Card'
import { Menu } from '../components/Menu'
import type { TriggerProps } from '../components/Menu'
import { Icon } from '../lib/icons'
import { useTitle } from '../lib/router'
import {
  dashStore,
  formatBytes,
  formatWhen,
  healthOf,
} from '../lib/dash'
import type { Health, Section } from '../lib/dash'
import {
  connect,
  dash,
  disconnect,
  loadLink,
} from '../lib/dash-api'
import { saveBlob } from '../lib/download'
import './Dashboard.css'

const dotsTrigger = ({ props }: { props: TriggerProps }) => (
  <button className="icon-btn" {...props} aria-label="Card actions">
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
  useTitle('Dashboard')
  const { snapshot, meta, now, health } = useDash()

  /* A SAVED LINK RECONNECTS ON LOAD — and this lives on the page rather than
     inside a card, because the card it used to live in is gone. Served from the
     plugin, studio-host.js has already written the link before this runs, so
     this effect is the whole of how a plugin-served Studio reaches its server.
     Deleting it with the card would have sent every card silently back to its
     built-in sample. */
  useEffect(() => {
    const saved = loadLink()
    if (!saved?.baseUrl) return
    return connect(saved, () => {})
  }, [])

  const { server, pack, players, subscription, files } = snapshot

  /* These are the two things the dashboard can genuinely do from a
     card menu, and both go through the same API a plugin uses rather
     than a private path. */
  const onUnlink = useCallback(() => {
    disconnect()
    dash.reset()
  }, [])

  const onCopyServer = useCallback(() => {
    void navigator.clipboard?.writeText(JSON.stringify(dash.read().server, null, 2))
  }, [])

  const onExportFiles = useCallback(() => {
    const head = 'name,directory,touched,by,sync,stale_clients'
    const rows = dashStore.snapshot.files.map((f) =>
      [f.name, f.where, f.touchedAt, f.by, f.sync, f.staleClients]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    void saveBlob('recent-files.csv', new Blob([[head, ...rows].join('\n')], { type: 'text/csv' }))
  }, [])

  const total = players.correct + players.wrong
  const pct = total ? Math.round((players.correct / total) * 100) : 0
  const live = meta.fed.length > 0

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <HealthPill health={health} meta={meta} now={now} />
      </div>

      {live ? null : (
        <div className="dash-banner">
          <Icon name="warning" size={16} />
          <span>
            No server has reported yet, so every card below is the built-in sample. Each one goes
            live on its own as soon as your server sends it.
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
              <span className="server-tag" data-online={server.online}>
                {server.status}
              </span>
              {/* Rename realm and Reconnect were inert: the realm's name
                  comes from the plugin, and there is nothing to reconnect
                  to that the link on this page does not already own. */}
              <Menu
                align="end"
                entries={[
                  { label: 'Copy as JSON', icon: 'copy', onSelect: onCopyServer },
                  { kind: 'separator' },
                  { label: 'Unlink the plugin', icon: 'close', danger: true, onSelect: onUnlink },
                ]}
                trigger={dotsTrigger}
              />
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
        >
          <div className="power">
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
        >
          <div className="pack__file">
            <Icon name="file" size={18} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pack__name">{pack.archive}</div>
              <div className="pack__meta">
                {formatBytes(pack.bytes)} &middot; {pack.hash}
              </div>
            </div>
          </div>
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
              <Menu
                align="end"
                entries={[
                  { label: 'Export list as CSV', icon: 'download', onSelect: onExportFiles },
                  { kind: 'separator' },
                  {
                    label: 'Clear history',
                    icon: 'trash',
                    danger: true,
                    onSelect: () => dash.clearFiles('ui'),
                  },
                ]}
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
                      Nothing touched yet. Saves to this pack show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="status-strip">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="status-strip__dot" data-online={server.online} />
          &lt;{server.status}&gt;
        </span>
        <span>{server.ip}</span>
        <span style={{ marginLeft: 'auto' }}>
          {live
            ? (meta.agent ?? server.name)
            : 'Sample data — nothing has reported yet.'}
        </span>
      </div>
    </main>
  )
}
