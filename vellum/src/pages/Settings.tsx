import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Card } from '../components/Card'
import { Icon } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { navigate, useTitle } from '../lib/router'
import { api } from '../lib/api'
import { categories } from '../lib/support'
import { dashStore, formatBytes, formatWhen, healthOf } from '../lib/dash'
import type { Member, Release, Workspace } from '../lib/dash'
import { loadLink } from '../lib/dash-api'
import {
  AUTHOR,
  PLUGIN_MIN,
  PLUGIN_VERSION,
  RENDERER,
  STUDIO_VERSION,
  verifyPlugin,
} from '../lib/version'
import type { VersionReport } from '../lib/version'
import type { TicketCategory } from '../lib/support'
import { Support } from './Support'
import './Settings.css'

type SectionId =
  | 'account' | 'profile' | 'directory' | 'report-a-bug' | 'about'
  | 'cloud' | 'billing' | 'teams' | 'support'

type Section = { id: SectionId; label: string; icon: IconName; paid?: boolean; blurb: string }

const freeSections: Section[] = [
  { id: 'account', label: 'Account', icon: 'user', blurb: 'Sign-in, sessions and how this machine is identified.' },
  { id: 'profile', label: 'Profile', icon: 'book', blurb: 'What collaborators see next to your uploads.' },
  { id: 'directory', label: 'Directory', icon: 'directory', blurb: 'Where Vellum reads and writes on disk.' },
  { id: 'report-a-bug', label: 'Report A Bug', icon: 'bug', blurb: 'Send a report with the current session log attached.' },
  { id: 'about', label: 'About', icon: 'info', blurb: 'Build, licences and what changed recently.' },
]

const paidSections: Section[] = [
  {
    id: 'cloud',
    label: 'Cloud',
    icon: 'cloud',
    paid: true,
    blurb: 'The workspace your team shares, and who is in it.',
  },
  { id: 'billing', label: 'Billing', icon: 'card', paid: true, blurb: 'Plan, payment method and invoice history.' },
  { id: 'teams', label: 'Teams', icon: 'users', paid: true, blurb: 'Seats, roles and shared scene access.' },
  { id: 'support', label: 'Support', icon: 'support', paid: true, blurb: 'Priority queue and direct escalation.' },
]

const allSections = [...freeSections, ...paidSections]

/* These are per-device preferences, so they live where the device can
   keep them. They used to reset on every reload, which made three
   switches that looked like settings and behaved like decoration. */
const PREF_KEY = 'vellum.prefs'

function readPref(id: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    return typeof all[id] === 'boolean' ? all[id] : fallback
  } catch {
    // private mode, or blocked site data: the default is still correct
    return fallback
  }
}

function writePref(id: string, value: boolean) {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    all[id] = value
    localStorage.setItem(PREF_KEY, JSON.stringify(all))
  } catch {
    /* it holds for this session and no longer, which is better than nothing */
  }
}

function Switch({ id, on, label }: { id: string; on: boolean; label: string }) {
  const [checked, setChecked] = useState(() => readPref(id, on))
  return (
    <button
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        const next = !checked
        setChecked(next)
        writePref(id, next)
      }}
    />
  )
}

/**
 * A bug report is a support ticket - the app already has a ticketing
 * API, so the form that said "Goes straight to the tracker" now does.
 * It used to do nothing at all, and was happy to send an empty one.
 */
function ReportABug() {
  // the areas ARE the ticket categories; one list, not two that drift
  const [area, setArea] = useState<TicketCategory>('editor')
  const [severity, setSeverity] = useState('normal')
  const [what, setWhat] = useState('')
  const [withLog, setWithLog] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  const valid = what.trim().length >= 12

  const sessionLog = () =>
    [
      `route: ${window.location.hash || '#/'}`,
      `viewport: ${window.innerWidth}x${window.innerHeight}`,
      `pixel ratio: ${window.devicePixelRatio}`,
      `agent: ${navigator.userAgent}`,
      `time: ${new Date().toISOString()}`,
    ].join('\n')

  const send = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      const ticket = await api.createTicket({
        subject: `[${area}] ${what.trim().slice(0, 96)}`,
        category: area,
        priority: severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'normal',
        description: withLog ? `${what.trim()}\n\n---\nSession log\n${sessionLog()}` : what.trim(),
        tags: ['bug', area, severity],
      })
      setSent(ticket.id)
      setWhat('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Report a bug" note="Opens a support ticket you can follow up on." dividedHead>
      <div className="field-grid">
        <label className="field">
          <span className="field__label">Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value as TicketCategory)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">Cosmetic</option>
            <option value="normal">Normal</option>
            <option value="high">Blocks my work</option>
          </select>
        </label>
        <label className="field field--wide">
          <span className="field__label">What happened</span>
          <textarea
            value={what}
            placeholder="Steps, what you expected, what you got instead."
            onChange={(e) => setWhat(e.target.value)}
          />
          <span className="field__hint">
            {valid ? 'Ready to send.' : `${Math.max(0, 12 - what.trim().length)} more characters needed.`}
          </span>
        </label>
      </div>

      <label className="toggle-row" style={{ cursor: 'pointer' }}>
        <div className="toggle-row__text">
          <div className="toggle-row__t">Include a session log</div>
          <div className="toggle-row__d">Route, viewport, pixel ratio and browser. No model data.</div>
        </div>
        <input
          type="checkbox"
          checked={withLog}
          aria-label="Include a session log"
          onChange={(e) => setWithLog(e.target.checked)}
        />
      </label>

      <div className="row-actions" style={{ marginTop: 'var(--sp-4)' }}>
        <button className="btn btn--primary" disabled={!valid || busy} onClick={send}>
          <Icon name="bug" size={14} /> {busy ? 'Sending\u2026' : 'Send report'}
        </button>
        {sent ? (
          <button className="btn btn--ghost" onClick={() => navigate('/settings/support')}>
            Opened {sent} \u2014 view the thread
          </button>
        ) : null}
      </div>
    </Card>
  )
}

function ToggleRow({ id, title, desc, on }: { id: string; title: string; desc: string; on: boolean }) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <div className="toggle-row__t">{title}</div>
        <div className="toggle-row__d">{desc}</div>
      </div>
      <Switch id={id} on={on} label={title} />
    </div>
  )
}


/* ---------------- about ---------------- */

const BUILT = '09/19/26'

/**
 * What this build knows about itself. The Master Console replaces this
 * the moment it pushes a changelog; until then a studio that has never
 * been fed still has something true to show, rather than a card that
 * says release notes "would render here".
 */
const BUILT_IN_RELEASES: Release[] = [
  {
    id: 'built-in-9',
    version: STUDIO_VERSION,
    channel: 'studio',
    at: '2026-09-19T00:00:00.000Z',
    title: 'Reachable without a mouse',
    notes: [
      'Dialogs trap focus and hand it back; menus and the model-kind picker take the arrow keys.',
      'Every number field is named and steps on the arrows.',
      'Touch drags work on the UV sheet, the scrub handles and the timeline.',
      'Text clears AA contrast on every route, and the viewport fits the model it is given.',
    ],
  },
  {
    id: 'built-in-8',
    version: '0.8.0',
    channel: 'studio',
    at: '2026-09-19T00:00:00.000Z',
    title: 'The outliner became an outliner',
    notes: [
      'Bones have an inspector; rows rename in place and drag to reparent.',
      'The timeline zooms and fits, and playback runs at 1.00x.',
      'Locking refuses edits, paint and delete instead of doing nothing quietly.',
    ],
  },
  {
    id: 'built-in-7',
    version: '0.7.0',
    channel: 'plugin',
    at: '2026-09-19T00:00:00.000Z',
    title: 'The dashboard opened to a feed',
    notes: [
      'Twelve ingest endpoints, a window bridge and a postMessage door.',
      'Every correction Vellum makes comes back in problems[].',
    ],
  },
]

const subscribeStore = (fn: () => void) => dashStore.subscribe(fn)

function useReleases(): Release[] {
  const version = useSyncExternalStore(
    subscribeStore,
    () => dashStore.version,
    () => dashStore.version,
  )
  // the store mutates in place, so the counter is what changes identity
  return useMemo(() => dashStore.releases, [version])
}

const VERSION_TONE: Record<VersionReport['state'], { icon: IconName; tone: string; label: string }> = {
  'in-step': { icon: 'check', tone: 'ok', label: 'In step' },
  'plugin-behind': { icon: 'warning', tone: 'warn', label: 'Plugin is behind' },
  'studio-behind': { icon: 'warning', tone: 'warn', label: 'Studio is behind' },
  unreachable: { icon: 'warning', tone: 'warn', label: 'No answer' },
  unlinked: { icon: 'info', tone: 'idle', label: 'Standalone' },
}

function About() {
  const pushed = useReleases()
  const releases = pushed.length ? pushed : BUILT_IN_RELEASES
  const [report, setReport] = useState<VersionReport | null>(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    const link = loadLink()
    setReport(await verifyPlugin(link?.baseUrl ?? null, link?.token ?? ''))
    setChecking(false)
  }, [])

  const tone = report ? VERSION_TONE[report.state] : null

  return (
    <>

      <Card title="Vellum" note={`Studio ${STUDIO_VERSION} \u00b7 plugin ${PLUGIN_VERSION}`} dividedHead>
        <div className="kv">
          <div className="kv__row"><span className="kv__k">Version</span><span className="kv__v">{STUDIO_VERSION}</span></div>
          <div className="kv__row"><span className="kv__k">Plugin version</span><span className="kv__v">{PLUGIN_VERSION}</span></div>
          <div className="kv__row"><span className="kv__k">Renderer</span><span className="kv__v">{RENDERER}</span></div>
          <div className="kv__row"><span className="kv__k">Author</span><span className="kv__v">{AUTHOR}</span></div>
          <div className="kv__row"><span className="kv__k">Typeface</span><span className="kv__v">Self-hosted, woff2</span></div>
          <div className="kv__row"><span className="kv__k">Built</span><span className="kv__v">{BUILT}</span></div>
        </div>
      </Card>

      <Card
        title="Versions"
        note={`Shipped inside plugin ${PLUGIN_VERSION}; still talks to ${PLUGIN_MIN} and newer.`}
        dividedHead
        actions={
          <button className="btn btn--sm btn--primary" onClick={() => void check()} disabled={checking}>
            <Icon name="refresh" size={13} /> {checking ? 'Checking' : 'Check the plugin'}
          </button>
        }
      >
        {report ? (
          <>
            <p className="verify" data-tone={tone?.tone}>
              <Icon name={tone?.icon ?? 'info'} size={13} />
              <span>
                <strong>{tone?.label}.</strong> {report.detail}
              </span>
            </p>
            <div className="kv" style={{ marginTop: 'var(--sp-3)' }}>
              <div className="kv__row"><span className="kv__k">Studio</span><span className="kv__v">{report.studio}</span></div>
              <div className="kv__row"><span className="kv__k">Plugin</span><span className="kv__v">{report.plugin ?? 'no answer'}</span></div>
              <div className="kv__row">
                <span className="kv__k">Plugin wants studio</span>
                <span className="kv__v">{report.studioMin ?? 'did not say'}</span>
              </div>
              <div className="kv__row">
                <span className="kv__k">Checked</span>
                <span className="kv__v">{formatWhen(new Date(report.checkedAt).toISOString(), Date.now())}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="ed-hint">
            <Icon name="info" size={11} /> Studio and plugin ship together, so they should never
            disagree. When they do, it is because this studio was opened against a server running an
            older build &mdash; which looks exactly like a bug. This asks the linked plugin what it
            is and compares.
          </p>
        )}
      </Card>

      <Card
        title="Changelog"
        note={
          pushed.length
            ? `${pushed.length} release${pushed.length === 1 ? '' : 's'} pushed from the Master Console.`
            : 'What this build knows about itself. The Master Console replaces this when it pushes.'
        }
        dividedHead
      >
        <ol className="rel">
          {releases.map((r) => (
            <li className="rel__row" key={r.id}>
              <div className="rel__head">
                <span className="rel__v mono">{r.version}</span>
                <span className="rel__ch" data-channel={r.channel}>
                  {r.channel}
                </span>
                <span className="rel__t">{r.title}</span>
                <span className="rel__at">{formatWhen(r.at, Date.now())}</span>
              </div>
              {r.notes.length ? (
                <ul className="rel__notes">
                  {r.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
    </>
  )
}

/* ---------------- cloud ---------------- */

const ROLE_BLURB: Record<Member['role'], string> = {
  owner: 'Full access, including the workspace itself.',
  editor: 'Opens and saves files in the workspace.',
  viewer: 'Opens files; cannot save over them.',
}

const SYNC_TONE: Record<Workspace['status'], { tone: string; say: string }> = {
  synced: { tone: 'ok', say: 'In sync with the plugin.' },
  syncing: { tone: 'idle', say: 'A sync is running.' },
  paused: { tone: 'idle', say: 'Nothing is syncing - no plugin has reported.' },
  error: { tone: 'warn', say: 'The last sync failed.' },
}

/**
 * The workspace a paid account is allocated, as the plugin reports it.
 * Everything here is fed through `PATCH /cloud/workspace` and
 * `PUT /cloud/members`, which is the same door the dashboard cards use -
 * there is no second, private path, and nothing here is invented when
 * the plugin has said nothing.
 */
function Cloud() {
  const version = useSyncExternalStore(
    subscribeStore,
    () => dashStore.version,
    () => dashStore.version,
  )
  const { cloud, files, meta } = useMemo(
    () => ({
      cloud: dashStore.snapshot.cloud,
      files: dashStore.snapshot.files,
      meta: dashStore.meta,
    }),
    [version],
  )

  const fed = meta.fed.includes('cloud')
  const tone = SYNC_TONE[cloud.status]
  const used = cloud.quotaBytes ? Math.min(100, (cloud.usedBytes / cloud.quotaBytes) * 100) : 0
  const health = healthOf(meta)

  return (
    <>

      <Card
        title="Workspace"
        note={fed ? `Reported by the plugin \u00b7 ${health}` : 'No plugin has reported a workspace yet.'}
        dividedHead
      >
        <p className="verify" data-tone={tone.tone}>
          <Icon name="cloud" size={13} />
          <span>
            <strong>{cloud.status}.</strong> {tone.say} Last sync{' '}
            {formatWhen(cloud.syncedAt, Date.now())}.
          </span>
        </p>

        <div className="kv" style={{ marginTop: 'var(--sp-3)' }}>
          <div className="kv__row"><span className="kv__k">Database</span><span className="kv__v mono">{cloud.id}</span></div>
          <div className="kv__row"><span className="kv__k">Region</span><span className="kv__v">{cloud.region}</span></div>
          <div className="kv__row">
            <span className="kv__k">Storage</span>
            <span className="kv__v">
              {formatBytes(cloud.usedBytes)} of {formatBytes(cloud.quotaBytes)}
            </span>
          </div>
        </div>

        <div className="quota" role="img" aria-label={`${Math.round(used)}% of the workspace quota used`}>
          <span style={{ width: `${Math.max(used, 1.5)}%` }} />
        </div>
      </Card>

      <Card
        title="Members"
        note={`${cloud.members.length} ${cloud.members.length === 1 ? 'identity' : 'identities'} on this workspace.`}
        dividedHead
      >
        <div className="dir-list">
          {cloud.members.map((m) => (
            <div className="dir-row" key={m.id}>
              <Icon name={m.role === 'owner' ? 'key' : 'user'} size={14} />
              <span className="dir-row__path">{m.name}</span>
              <span className="mem__role" data-role={m.role} title={ROLE_BLURB[m.role]}>
                {m.role}
              </span>
              <span className="mem__seen mono">
                {m.holding ? `${m.holding} open \u00b7 ` : ''}
                {formatWhen(m.seenAt, Date.now())}
              </span>
            </div>
          ))}
          {!cloud.members.length ? (
            <p className="ed-hint">Nobody has been reported on this workspace yet.</p>
          ) : null}
        </div>
      </Card>

      <Card
        title="Shared files"
        note="The same list the plugin syncs, so a team opens the same files from the same place."
        dividedHead
      >
        {files.length ? (
          <div className="dir-list">
            {files.slice(0, 8).map((f) => (
              <div className="dir-row" key={f.id}>
                <Icon name="file" size={14} />
                <span className="dir-row__path">
                  {f.where}/{f.name}
                </span>
                <span className="dir-row__tag" data-sync={f.sync}>
                  {f.sync}
                </span>
                <span className="mem__seen mono">
                  {f.by} {'\u00b7'} {formatWhen(f.touchedAt, Date.now())}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ed-hint">No files have been reported yet.</p>
        )}
      </Card>

      {/* Said plainly, because it is true and because a shared database
          somebody else administers is not what everybody assumes a
          "cloud workspace" means. */}
      <Card title="Who can read this" dividedHead>
        <p className="ed-hint" style={{ marginTop: 0 }}>
          <Icon name="info" size={11} /> The workspace database is allocated and administered by
          Vellum. The account owner listed above administers your team's access to it, and Vellum's
          operator retains administrative access to every workspace it hosts - for support, for
          migration and for abuse handling. Files you do not want held that way belong in a local
          project, which is what Vellum opens by default.
        </p>
      </Card>
    </>
  )
}

function Body({ section }: { section: Section }) {
  switch (section.id) {
    case 'account':
      return (
        <>
          <Card title="Sign-in" note="Used to sync scenes between machines." dividedHead>
            <div className="field-grid">
              <label className="field">
                <span className="field__label">Email</span>
                <input className="field__input" defaultValue="galex0952@gmail.com" />
              </label>
              <label className="field">
                <span className="field__label">Password</span>
                <input className="field__input" type="password" defaultValue="placeholder" />
                <span className="field__hint">Last rotated 04/02/26.</span>
              </label>
            </div>
            {/* "Revoke other sessions" needed a session store that does not
                exist here, so it is gone rather than looking live. The
                switches below are per-device and are kept for real. */}
            <p className="field__hint" style={{ marginTop: 'var(--sp-4)' }}>
              Account details are read-only in this build — the preferences below are the part
              this device keeps.
            </p>
          </Card>
          <Card title="This machine" dividedHead>
            <ToggleRow id="stay" title="Keep me signed in" desc="Skip the login prompt on this device." on />
            <ToggleRow id="crash" title="Send crash reports" desc="Anonymous stack traces only." on />
            <ToggleRow id="beta" title="Beta channel" desc="Opt into pre-release editor builds." on={false} />
          </Card>
        </>
      )

    case 'profile':
      return (
        <>
          <Card title="Public profile" note="Shown beside anything you publish to a shared scene." dividedHead>
            <div className="field-grid">
              <label className="field">
                <span className="field__label">Display name</span>
                <input className="field__input" defaultValue="g.alex" />
              </label>
              <label className="field">
                <span className="field__label">Handle</span>
                <input className="field__input" defaultValue="@galex" />
              </label>
              <label className="field field--wide">
                <span className="field__label">Bio</span>
                <textarea defaultValue="Builds lanterns and other small brass things for the Aurelian Keep set." />
              </label>
            </div>
          </Card>
        </>
      )

    case 'directory':
      return (
        <>
          <Card title="Working directories" note="Vellum only reads inside these roots." dividedHead>
            <div className="dir-list">
              {[
                ['Projects', '~/vellum/scenes'],
                ['Exports', '~/vellum/out'],
                ['Texture cache', '~/.cache/vellum/textures'],
                ['Pack staging', '~/vellum/pack/current'],
              ].map(([tag, path]) => (
                <div className="dir-row" key={path}>
                  <Icon name="folder" size={14} />
                  <span className="dir-row__path">{path}</span>
                  <span className="dir-row__tag">{tag}</span>
                  <button className="btn btn--sm btn--ghost">Change</button>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Watchers" dividedHead>
            <ToggleRow id="reload" title="Reload on external change" desc="Pick up edits made outside the editor." on />
            <ToggleRow id="subfolders" title="Index subfolders" desc="Walk nested directories when building the library." on />
          </Card>
        </>
      )

    case 'report-a-bug':
      return <ReportABug />

    case 'about':
      return <About />

    case 'cloud':
      return <Cloud />

    case 'billing':
      return (
        <>
          <Card title="Plan" note="Free tier - no card on file." dividedHead>
            <div className="kv">
              <div className="kv__row"><span className="kv__k">Current plan</span><span className="kv__v">Free</span></div>
              <div className="kv__row"><span className="kv__k">Cloud storage</span><span className="kv__v">N/A</span></div>
              <div className="kv__row"><span className="kv__k">Renews</span><span className="kv__v">-</span></div>
            </div>
            <div className="row-actions" style={{ marginTop: 'var(--sp-4)' }}>
              <button className="btn btn--primary">Upgrade</button>
              <button className="btn">Compare tiers</button>
            </div>
          </Card>
        </>
      )

    case 'teams':
      return (
        <>
          <Card title="Seats" note="1 of 1 used on the free tier." dividedHead>
            <div className="dir-list">
              {[['g.alex', 'Owner'], ['kite', 'Invite pending'], ['nine', 'Invite pending']].map(([who, role]) => (
                <div className="dir-row" key={who}>
                  <Icon name="user" size={14} />
                  <span className="dir-row__path">{who}</span>
                  <span className="dir-row__tag">{role}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )

    case 'support':
      return <Support />
  }
}

export function Settings({ segments }: { segments: string[] }) {
  const [query, setQuery] = useState('')
  const active = (allSections.find((s) => s.id === segments[1])?.id ?? 'account') as SectionId
  const section = allSections.find((s) => s.id === active)!
  useTitle(section.label)

  const q = query.trim().toLowerCase()
  const match = (list: Section[]) =>
    q ? list.filter((s) => s.label.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)) : list

  const free = useMemo(() => match(freeSections), [q])
  const paid = useMemo(() => match(paidSections), [q])

  const renderLink = (s: Section) => (
    <button
      key={s.id}
      className="settings__link"
      aria-current={s.id === active ? 'page' : undefined}
      onClick={() => navigate(`/settings/${s.id}`)}
    >
      <Icon name={s.icon} size={15} />
      {s.label}
      {s.paid ? <Icon name="lock" size={12} className="settings__lock" /> : null}
    </button>
  )

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="page-title">{section.label}</h1>
          <p className="page-sub">{section.blurb}</p>
        </div>
      </div>

      <div className="settings">
        <nav className="settings__nav" aria-label="Settings sections">
          <div className="settings__search">
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search settings"
            />
          </div>

          {free.length ? <div className="settings__group">{free.map(renderLink)}</div> : null}

          {paid.length ? (
            <div className="settings__group">
              <div className="settings__grouplabel">
                <Icon name="key" size={11} /> Manage
              </div>
              {paid.map(renderLink)}
            </div>
          ) : null}

          {!free.length && !paid.length ? (
            <p className="settings__none">No section matches &ldquo;{query}&rdquo;.</p>
          ) : null}
        </nav>

        <div className="settings__panel">
          <Body section={section} />
        </div>
      </div>
    </main>
  )
}
