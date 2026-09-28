import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { Card } from '../components/Card'
import { ReloadControl } from '../components/ReloadControl'
import type { ReloadPhase } from '../components/ReloadControl'
import { Menu } from '../components/Menu'
import type { TriggerProps } from '../components/Menu'
import { Icon } from '../lib/icons'
import { useTitle } from '../lib/router'
import { dashStore, formatWhen, healthOf } from '../lib/dash'
import type { Section } from '../lib/dash'
import { connect, dash, disconnect, loadLink } from '../lib/dash-api'
import { saveBlob } from '../lib/download'
import { Scene } from './dash/scene'
import { Hotbar, PackEntry, PlanTooltip, RedstoneLine, ServerConsole, Toasts, XpBar } from './dash/hud'
import { PixelArt } from './dash/pixel'
import { itemForPath } from './dash/sprites'
import { startDemo } from './dash/demo'
import { useDashToasts, useToasts } from './dash/toasts'
import './Dashboard.css'

const dotsTrigger = ({ props }: { props: TriggerProps }) => (
  <button className="icon-btn" {...props} aria-label="Card actions">
    <Icon name="dots" size={16} />
  </button>
)

const subscribe = (fn: () => void) => dashStore.subscribe(fn)
const getVersion = () => dashStore.version

/** Re-renders on every store change, and once a second so ages and health stay current. */
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

/** Marks a card whose numbers are still the built-in sample. */
function SampleBadge({ fed, section }: { fed: Section[]; section: Section }) {
  if (fed.includes(section)) return null
  return (
    <span className="src-mark" title="No plugin has sent this yet">
      sample
    </span>
  )
}

const order = (n: number) => ({ '--n': n }) as CSSProperties

export function Dashboard() {
  useTitle('Dashboard')
  const { snapshot, meta, log, now, health } = useDash()
  const [toasts, pushToast] = useToasts()
  useDashToasts(pushToast)

  // A saved link reconnects on load. A Studio served by the plugin depends on this.
  useEffect(() => {
    const saved = loadLink()
    if (!saved?.baseUrl) return
    return connect(saved, () => {})
  }, [])

  const [linked, setLinked] = useState(() => !!loadLink()?.baseUrl)
  const [demo, setDemo] = useState(false)
  const [phase, setPhase] = useState<ReloadPhase>('idle')

  // Stopping the demo, or leaving the page, puts the sample back.
  useEffect(() => (demo ? startDemo() : undefined), [demo])

  const onUnlink = useCallback(() => {
    disconnect()
    dash.reset()
    setLinked(false)
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

  const { server, pack, players, subscription, files } = snapshot
  const total = players.correct + players.wrong
  const live = meta.fed.length > 0

  // Rows that arrive after the page loaded are highlighted once.
  const fileIds = files.map((f) => f.id).join(',')
  const [rows, setRows] = useState(() => ({ ids: fileIds, known: new Set(files.map((f) => f.id)), fresh: new Set<string>() }))
  if (rows.ids !== fileIds) {
    setRows({
      ids: fileIds,
      known: new Set([...rows.known, ...files.map((f) => f.id)]),
      fresh: new Set(files.filter((f) => !rows.known.has(f.id)).map((f) => f.id)),
    })
  }

  return (
    <main className="page dash">
      <h1 className="vh">Dashboard</h1>
      <Toasts items={toasts} />

      <Scene
        server={server}
        correct={players.correct}
        wrong={players.wrong}
        packHash={pack.hash}
        health={health}
        meta={meta}
        now={now}
        badge={<SampleBadge fed={meta.fed} section="server" />}
        menu={
          <Menu
            align="end"
            entries={[
              { label: 'Copy as JSON', icon: 'copy', onSelect: onCopyServer },
              { kind: 'separator' },
              { label: 'Unlink the plugin', icon: 'close', danger: true, onSelect: onUnlink },
            ]}
            trigger={dotsTrigger}
          />
        }
      />

      {demo ? (
        <div className="dash-note" data-demo>
          <span className="dash-note__dot" aria-hidden="true" />
          <span>Demo server running. It feeds this page through the same API a real plugin uses.</span>
          <button className="btn btn--sm" onClick={() => setDemo(false)}>
            Stop demo
          </button>
        </div>
      ) : live ? null : (
        <div className="dash-note">
          <Icon name="info" size={15} />
          <span>No server connected. These cards show sample data.</span>
          {linked ? null : (
            <button className="btn btn--sm btn--primary" onClick={() => setDemo(true)}>
              <Icon name="play" size={12} /> Run a demo server
            </button>
          )}
        </div>
      )}

      <div className="dash-grid">
        <Card
          className="dash-files"
          style={order(1)}
          eyebrow={
            <>
              Server files <SampleBadge fed={meta.fed} section="server" />
            </>
          }
          title={`${server.total} files synced`}
        >
          <Hotbar rows={server.breakdown} />
        </Card>

        <Card
          className="dash-players"
          style={order(2)}
          eyebrow={
            <>
              Players <SampleBadge fed={meta.fed} section="players" />
            </>
          }
          title="On the current pack"
        >
          <XpBar correct={players.correct} wrong={players.wrong} />
          <p className="dash-players__sum">
            {total
              ? `${players.correct} of ${total} on the current pack. ${
                  players.wrong ? `${players.wrong} still on an old one.` : 'Nobody left behind.'
                }`
              : 'Nobody is online.'}
          </p>
          {total ? <p className="card__note">Counted {formatWhen(players.sampledAt, now)}</p> : null}
        </Card>

        <Card
          className="dash-pack"
          style={order(3)}
          eyebrow={
            <>
              Resource pack <SampleBadge fed={meta.fed} section="pack" />
            </>
          }
        >
          <PackEntry pack={pack} now={now} />
        </Card>

        <Card
          className="dash-plan"
          style={order(4)}
          eyebrow={
            <>
              Plan <SampleBadge fed={meta.fed} section="subscription" />
            </>
          }
        >
          <PlanTooltip plan={subscription} />
        </Card>

        <Card className="dash-console" style={order(5)} eyebrow="Server console" title="What the plugin sent">
          <ServerConsole log={log} />
        </Card>

        <Card
          className="dash-apply"
          style={order(6)}
          eyebrow="Apply"
          title="Push saved changes live"
          note="The server keeps serving the old pack until it reloads."
          dividedHead
        >
          <RedstoneLine phase={phase} linked={linked} />
          <ReloadControl linked={linked} onPhase={setPhase} />
        </Card>

        <Card
          className="dash-recent"
          style={order(7)}
          eyebrow={
            <>
              Recent files <SampleBadge fed={meta.fed} section="files" />
            </>
          }
          title="Last touched"
          note="Files edited since the pack was built."
          dividedHead
          actions={
            <Menu
              align="end"
              entries={[
                { label: 'Export list as CSV', icon: 'download', onSelect: onExportFiles },
                { kind: 'separator' },
                { label: 'Clear history', icon: 'trash', danger: true, onSelect: () => dash.clearFiles('ui') },
              ]}
              trigger={dotsTrigger}
            />
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
                  <tr key={f.id} data-new={rows.fresh.has(f.id) || undefined}>
                    <td className="cell-name">
                      <span className="cell-name__in">
                        <PixelArt sprite={itemForPath(f.where)} scale={1} outline="#4a4a4a" />
                        {f.name}
                      </span>
                    </td>
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
    </main>
  )
}
