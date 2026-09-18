import { Card } from '../components/Card'
import { Menu } from '../components/Menu'
import { Icon } from '../lib/icons'
import {
  packInfo,
  playerCounts,
  recentFiles,
  serverSummary,
  subscription,
} from '../lib/data'
import './Dashboard.css'

const inert = { kind: 'label' as const, label: 'Placeholder - no actions wired' }

const dotsTrigger = ({ toggle, id }: { toggle: () => void; id: string }) => (
  <button className="icon-btn" id={id} onClick={toggle} aria-label="Card actions">
    <Icon name="dots" size={16} />
  </button>
)

/**
 * Main / Dash.
 * Deliberately static: the numbers are a frozen snapshot and nothing on this
 * page mutates state. It exists to show the card composition.
 */
export function Dashboard() {
  const total = playerCounts.correct + playerCounts.wrong
  const pct = Math.round((playerCounts.correct / total) * 100)

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
        <span className="stale-tag">
          <Icon name="clock" size={11} /> Snapshot - static mock
        </span>
      </div>

      <div className="dash-banner">
        <Icon name="warning" size={16} />
        <span>
          Temporary verbiage. This screen is a layout study - the figures below are fixed sample
          data, the controls are inert, and nothing here refreshes.
        </span>
      </div>

      <div className="dash-grid">
        {/* ---------- server name + file breakdown ---------- */}
        <Card
          className="span-server"
          eyebrow="Server"
          title={serverSummary.name}
          note={serverSummary.host}
          dividedHead
          actions={
            <>
              <span className="server-tag">{serverSummary.status}</span>
              <Menu align="end" entries={[inert, { label: 'Rename realm', icon: 'pencil' }, { label: 'Reconnect', icon: 'refresh' }, { kind: 'separator' }, { label: 'Unlink', icon: 'close', danger: true }]} trigger={dotsTrigger} />
            </>
          }
        >
          <div className="breakdown">
            <div className="breakdown__list">
              {serverSummary.breakdown.map((row) => (
                <div className="breakdown__row" key={row.label}>
                  <span className="breakdown__dot" />
                  {row.label}
                  <span className="breakdown__rule" />
                  <span className="breakdown__n">x{row.count}</span>
                </div>
              ))}
            </div>
            <div className="stat">
              <div className="stat__value">{serverSummary.total}</div>
              <div className="stat__label">Total files synced</div>
            </div>
          </div>
        </Card>

        {/* ---------- power / subscription ---------- */}
        <Card className="span-power" eyebrow="Session" title="Realm power">
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
          eyebrow="Resource pack info"
          title="Current build"
          note={`Pushed ${packInfo.pushed}`}
        >
          <div className="pack__file">
            <Icon name="file" size={18} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pack__name">{packInfo.archive}</div>
              <div className="pack__meta">
                {packInfo.size} &middot; {packInfo.hash}
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
        <Card className="span-count" eyebrow="Players" title="Pack adoption">
          <div className="counts">
            <div className="count-tile count-tile--ok">
              <div className="count-tile__v">x{playerCounts.correct}</div>
              <div className="count-tile__l">On current pack</div>
            </div>
            <div className="count-tile count-tile--warn">
              <div className="count-tile__v">x{playerCounts.wrong}</div>
              <div className="count-tile__l">Wrong / old pack</div>
            </div>
          </div>
          <div className="meter" role="img" aria-label={`${pct}% of players on the current pack`}>
            <span className="meter__fill" style={{ width: `${pct}%` }} />
            <span className="meter__rest" style={{ width: `${100 - pct}%` }} />
          </div>
          <p className="card__note" style={{ marginTop: 'var(--sp-2)' }}>
            {pct}% of {total} connected players are up to date.
          </p>
        </Card>

        {/* ---------- recent files ---------- */}
        <Card
          className="span-recent"
          eyebrow="Recent files"
          title="Last touched"
          note="Also flags players still holding a wrong or outdated pack."
          dividedHead
          actions={
            <Menu
              align="end"
              entries={[inert, { label: 'Open folder', icon: 'folder' }, { label: 'Export list', icon: 'download' }, { kind: 'separator' }, { label: 'Clear history', icon: 'trash', danger: true }]}
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
              {recentFiles.map((f, i) => (
                <tr key={f.name}>
                  <td className="cell-name">{f.name}</td>
                  <td className="cell-dir">{f.where}</td>
                  <td className="mono">{f.touched}</td>
                  <td>{f.by}</td>
                  <td>
                    {i % 3 === 2 ? (
                      <span className="pack-chip pack-chip--old">
                        <Icon name="warning" size={10} /> old on 7 clients
                      </span>
                    ) : (
                      <span className="pack-chip pack-chip--ok">
                        <Icon name="check" size={10} /> in sync
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <div className="status-strip">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="status-strip__dot" />
          &lt;{serverSummary.status}&gt;
        </span>
        <span>{serverSummary.ip}</span>
        <span>build 0.4.1-mock</span>
        <span style={{ marginLeft: 'auto' }}>Data frozen - nothing on this page is live.</span>
      </div>
    </main>
  )
}
