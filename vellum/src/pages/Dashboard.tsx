import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ReloadControl } from '../components/ReloadControl'
import { Menu } from '../components/Menu'
import type { TriggerProps } from '../components/Menu'
import { Icon } from '../lib/icons'
import { useTitle } from '../lib/router'
import { dashStore, formatWhen, healthOf } from '../lib/dash'
import type { Section } from '../lib/dash'
import { connect, dash, disconnect, loadLink } from '../lib/dash-api'
import { saveBlob } from '../lib/download'
import { useCurrentServer } from '../lib/servers'
import { Hero } from './dash/hero'
import {
  AdoptionRing,
  Counter,
  CubeStacks,
  FileGlyph,
  PackBox,
  Person,
  Plan,
  Tile,
  Toasts,
} from './dash/cards'
import { Timeline } from './dash/timeline'
import { demoReload, startDemo } from './dash/demo'
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

export function Dashboard() {
  useTitle('Dashboard')
  const { snapshot, meta, now, health } = useDash()
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

  const { pack, players, subscription, files } = snapshot
  // until a plugin reports its own, the sample stands in for the server you entered
  const entered = useCurrentServer()
  const server = meta.fed.includes('server') ? snapshot.server : { ...snapshot.server, name: entered.name, host: entered.host }

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

      <Hero
        server={server}
        players={players}
        meta={meta}
        health={health}
        now={now}
        demo={demo}
        linked={linked}
        onDemo={setDemo}
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

      <div className="dash-grid">
        <Tile
          className="dash-players"
          n={1}
          label="Players"
          badge={<SampleBadge fed={meta.fed} section="players" />}
          title="On the current pack"
        >
          <AdoptionRing players={players} now={now} />
          <ReloadControl
            key={demo ? 'demo' : 'live'}
            linked={linked || demo}
            hint={demo ? 'This works on the demo server too. Apply a few times to see a swap, a refusal and an error.' : undefined}
            request={demo ? demoReload : undefined}
          />
        </Tile>

        <Tile
          className="dash-files"
          n={2}
          label="Server files"
          badge={<SampleBadge fed={meta.fed} section="server" />}
          title={
            <>
              <Counter value={server.total} /> files synced
            </>
          }
        >
          <CubeStacks rows={server.breakdown} />
        </Tile>

        <Tile className="dash-pack" n={3} label="Resource pack" badge={<SampleBadge fed={meta.fed} section="pack" />}>
          <PackBox pack={pack} now={now} />
        </Tile>

        <Tile className="dash-feed" n={4} label="Plugin activity" title="The last 90 seconds">
          <Timeline now={now} />
        </Tile>
        <Tile className="dash-plan" n={5} label="Plan" badge={<SampleBadge fed={meta.fed} section="subscription" />}>
          <Plan plan={subscription} />
        </Tile>

        <Tile
          className="dash-recent"
          n={6}
          label="Recent files"
          badge={<SampleBadge fed={meta.fed} section="files" />}
          title="Last touched"
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
                        <FileGlyph where={f.where} />
                        {f.name}
                      </span>
                    </td>
                    <td className="cell-dir">{f.where}</td>
                    <td className="mono">{formatWhen(f.touchedAt, now)}</td>
                    <td>
                      <Person name={f.by} />
                    </td>
                    <td>
                      {f.sync === 'outdated' ? (
                        <span className="pack-chip pack-chip--old">
                          <Icon name="warning" size={10} />
                          {f.staleClients ? ` old on ${f.staleClients} client${f.staleClients === 1 ? '' : 's'}` : ' outdated'}
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
        </Tile>
      </div>
    </main>
  )
}
