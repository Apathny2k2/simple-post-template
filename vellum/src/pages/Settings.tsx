import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Card } from '../components/Card'
import { Kinetic } from '../components/Kinetic'
import { Pip } from '../components/Pip'
import type { PipMood } from '../components/Pip'
import { TicketForm, ToggleChip } from '../components/TicketForm'
import { Icon } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { navigate, useTitle } from '../lib/router'
import { api } from '../lib/api'
import { blankDraft, subjectOf } from '../lib/support'
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
import type { TicketDraft } from '../lib/support'
import { Support } from './Support'
import './Settings.css'

type SectionId =
  | 'account' | 'profile' | 'directory' | 'report-a-bug' | 'about'
  | 'cloud' | 'billing' | 'teams' | 'support'

type Section = { id: SectionId; label: string; icon: IconName; paid?: boolean; blurb: string }

const freeSections: Section[] = [
  { id: 'account', label: 'Account', icon: 'user', blurb: 'Sign-in and sessions.' },
  { id: 'profile', label: 'Profile', icon: 'book', blurb: 'What collaborators see next to your uploads.' },
  { id: 'directory', label: 'Directory', icon: 'directory', blurb: 'Where Vellum reads and writes on disk.' },
  { id: 'report-a-bug', label: 'Report a bug', icon: 'bug', blurb: 'Send a report with the current session log attached.' },
  { id: 'about', label: 'About', icon: 'info', blurb: 'Build, versions and what changed recently.' },
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
  {
    id: 'support',
    label: 'Support',
    icon: 'support',
    paid: true,
    blurb: 'Tickets you have opened. In this build they stay in your browser and get sample replies.',
  },
]

const allSections = [...freeSections, ...paidSections]

// per-device preferences, kept in this browser
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
    /* storage blocked: the switch keeps its state while it is on screen */
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

/** Files a bug as a support ticket, with an optional session log. */
function ReportABug() {
  const [draft, setDraft] = useState<TicketDraft>(blankDraft)
  const [withLog, setWithLog] = useState(true)
  const [sent, setSent] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [run, setRun] = useState<PipMood | null>(null)

  const sessionLog = () =>
    [
      `route: ${window.location.hash || '#/'}`,
      `viewport: ${window.innerWidth}x${window.innerHeight}`,
      `pixel ratio: ${window.devicePixelRatio}`,
      `agent: ${navigator.userAgent}`,
      `time: ${new Date().toISOString()}`,
    ].join('\n')

  const send = async () => {
    const subject = subjectOf(draft.text)
    if (subject.length < 3 || run) return
    setSent(null)
    setFailed(false)
    setRun('working')
    const area = draft.category ?? 'other'
    const what = draft.text.trim()
    try {
      const ticket = await api.createTicket({
        subject,
        category: area,
        priority: draft.blocking ? 'high' : 'normal',
        description: withLog ? `${what}\n\n---\nSession log\n${sessionLog()}` : what,
        tags: ['bug', area],
      })
      setSent(ticket.id)
      setDraft(blankDraft)
      setRun('done')
    } catch {
      setFailed(true)
      setRun('failed')
    }
  }

  return (
    <Card
      title="Report a bug"
      note="Opens a support ticket. The session log holds the route, viewport, pixel ratio and browser, and no model data."
      dividedHead
    >
      {run ? (
        <div className="bug-run">
          <Pip mood={run} onFinish={() => setRun(null)} className="bug-pip" label="Sending the report" />
        </div>
      ) : (
        <>
          {sent ? (
            <p className="bug-sent">
              <Icon name="check" size={14} />
              <span>
                Opened <span className="mono">{sent}</span>.
              </span>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/settings/support')}>
                View the thread
              </button>
            </p>
          ) : null}
          <TicketForm
            draft={draft}
            onDraft={(d) => {
              setDraft(d)
              setFailed(false)
            }}
            onSend={() => void send()}
            failed={failed}
            placeholder={'What went wrong?\nThe first line becomes the subject. Then what you did, what you expected and what happened.'}
            toggles={
              <ToggleChip on={withLog} onToggle={() => setWithLog(!withLog)} icon="file">
                Attach session log
              </ToggleChip>
            }
          />
        </>
      )}
    </Card>
  )
}

function ToggleRow({ id, title, desc, on }: { id: string; title: string; desc: string; on: boolean }) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <div className="toggle-row__title">{title}</div>
        <div className="toggle-row__description">{desc}</div>
      </div>
      <Switch id={id} on={on} label={title} />
    </div>
  )
}


/* ---------------- about ---------------- */

const BUILT = '09/19/26'

/** Release notes shown until a changelog arrives through `PUT /console/changelog`. */
const BUILT_IN_RELEASES: Release[] = [
  {
    id: 'built-in-9',
    version: STUDIO_VERSION,
    channel: 'studio',
    at: '2026-09-19T00:00:00.000Z',
    title: 'Reachable without a mouse',
    notes: [
      'Dialogs keep focus inside and return it when they close. Menus and the model-kind picker work with the arrow keys.',
      'Every number field has a screen reader label and steps with the arrow keys.',
      'Touch drags work on the UV sheet, the scrub handles and the timeline.',
      'Text meets AA contrast on every page. The viewport fits each model you open.',
    ],
  },
  {
    id: 'built-in-8',
    version: '0.8.0',
    channel: 'studio',
    at: '2026-09-19T00:00:00.000Z',
    title: 'Outliner, timeline and locking',
    notes: [
      'Bones have an inspector. Rows rename in place and drag to a new parent.',
      'The timeline zooms and fits, and playback runs at 1.00x.',
      'Locking now blocks edits, paint and delete. Before, it did nothing.',
    ],
  },
  {
    id: 'built-in-7',
    version: '0.7.0',
    channel: 'plugin',
    at: '2026-09-19T00:00:00.000Z',
    title: 'A data feed for the Dash',
    notes: [
      '12 ingest endpoints, a window bridge and postMessage support.',
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
  unlinked: { icon: 'info', tone: 'idle', label: 'No plugin linked' },
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
        <div className="pairs">
          <div className="pairs__row"><span className="pairs__key">Version</span><span className="pairs__value">{STUDIO_VERSION}</span></div>
          <div className="pairs__row"><span className="pairs__key">Plugin version</span><span className="pairs__value">{PLUGIN_VERSION}</span></div>
          <div className="pairs__row"><span className="pairs__key">Renderer</span><span className="pairs__value">{RENDERER}</span></div>
          <div className="pairs__row"><span className="pairs__key">Author</span><span className="pairs__value">{AUTHOR}</span></div>
          <div className="pairs__row"><span className="pairs__key">Typeface</span><span className="pairs__value">Self-hosted, woff2</span></div>
          <div className="pairs__row"><span className="pairs__key">Built</span><span className="pairs__value">{BUILT}</span></div>
        </div>
      </Card>

      <Card
        title="Versions"
        note={`Ships inside plugin ${PLUGIN_VERSION}. Works with plugin ${PLUGIN_MIN} and newer.`}
        dividedHead
        actions={
          <button className="btn btn--sm btn--primary" onClick={() => void check()} disabled={checking}>
            <Icon name="refresh" size={13} /> {checking ? 'Checking…' : 'Check the plugin'}
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
            <div className="pairs" style={{ marginTop: 'var(--sp-3)' }}>
              <div className="pairs__row"><span className="pairs__key">Studio</span><span className="pairs__value">{report.studio}</span></div>
              <div className="pairs__row"><span className="pairs__key">Plugin</span><span className="pairs__value">{report.plugin ?? 'No answer'}</span></div>
              <div className="pairs__row">
                <span className="pairs__key">Minimum studio</span>
                <span className="pairs__value">{report.studioMin ?? 'Not reported'}</span>
              </div>
              <div className="pairs__row">
                <span className="pairs__key">Checked</span>
                <span className="pairs__value">{formatWhen(new Date(report.checkedAt).toISOString(), Date.now())}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="editor-hint">
            <Icon name="info" size={11} /> Checks the linked plugin's version against this studio. A
            mismatch usually means the server runs an older build.
          </p>
        )}
      </Card>

      <Card
        title="Changelog"
        note={
          pushed.length
            ? `${pushed.length} release${pushed.length === 1 ? '' : 's'} pushed from the Master Console.`
            : 'Notes that ship with this build. The Master Console replaces them when it pushes a changelog.'
        }
        dividedHead
      >
        <ol className="release">
          {releases.map((r) => (
            <li className="release__row" key={r.id}>
              <div className="release__head">
                <span className="release__version mono">{r.version}</span>
                <span className="release__channel" data-channel={r.channel}>
                  {r.channel}
                </span>
                <span className="release__title">{r.title}</span>
                <span className="release__date">{formatWhen(r.at, Date.now())}</span>
              </div>
              {r.notes.length ? (
                <ul className="release__notes">
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
  viewer: 'Opens files. Cannot save over them.',
}

const SYNC_TONE: Record<Workspace['status'], { tone: string; say: string }> = {
  synced: { tone: 'ok', say: 'In sync with the plugin.' },
  syncing: { tone: 'idle', say: 'A sync is running.' },
  paused: { tone: 'idle', say: 'Nothing is syncing. No plugin has reported.' },
  error: { tone: 'warn', say: 'The last sync failed.' },
}

/** The paid workspace as the plugin reports it through `PATCH /cloud/workspace` and `PUT /cloud/members`. */
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

        <div className="pairs" style={{ marginTop: 'var(--sp-3)' }}>
          <div className="pairs__row"><span className="pairs__key">Database</span><span className="pairs__value mono">{cloud.id}</span></div>
          <div className="pairs__row"><span className="pairs__key">Region</span><span className="pairs__value">{cloud.region}</span></div>
          <div className="pairs__row">
            <span className="pairs__key">Storage</span>
            <span className="pairs__value">
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
        note={`${cloud.members.length} ${cloud.members.length === 1 ? 'member' : 'members'} on this workspace.`}
        dividedHead
      >
        <div className="list-rows">
          {cloud.members.map((m) => (
            <div className="list-row" key={m.id}>
              <Icon name={m.role === 'owner' ? 'key' : 'user'} size={14} />
              <span className="list-row__name">{m.name}</span>
              <span className="list-row__role" data-role={m.role} title={ROLE_BLURB[m.role]}>
                {m.role}
              </span>
              <span className="list-row__when mono">
                {m.holding ? `${m.holding} open \u00b7 ` : ''}
                {formatWhen(m.seenAt, Date.now())}
              </span>
            </div>
          ))}
          {!cloud.members.length ? (
            <p className="editor-hint">Nobody has been reported on this workspace yet.</p>
          ) : null}
        </div>
      </Card>

      <Card
        title="Shared files"
        note="The files the plugin syncs. Everyone on your team opens them from the same place."
        dividedHead
      >
        {files.length ? (
          <div className="list-rows">
            {files.slice(0, 8).map((f) => (
              <div className="list-row" key={f.id}>
                <Icon name="file" size={14} />
                <span className="list-row__name">
                  {f.where}/{f.name}
                </span>
                <span className="list-row__tag" data-sync={f.sync}>
                  {f.sync}
                </span>
                <span className="list-row__when mono">
                  {f.by} {'\u00b7'} {formatWhen(f.touchedAt, Date.now())}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="editor-hint">No files have been reported yet.</p>
        )}
      </Card>

      <Card title="Who can read this" dividedHead>
        <p className="editor-hint" style={{ marginTop: 0 }}>
          <Icon name="info" size={11} /> Vellum sets up and runs the workspace database. The account
          owner listed above controls your team's access to it. Vellum's operator also has admin
          access to every workspace it hosts, for support, migration and abuse handling. Keep files
          you don't want stored this way in a local project. Vellum opens local projects by default.
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
          <Card title="Sign-in" note="Lets you sync scenes between machines." dividedHead>
            <div className="field-grid">
              <label className="field">
                <span className="field__label">Email</span>
                <input className="field__input" defaultValue="galex0952@gmail.com" />
              </label>
              <label className="field">
                <span className="field__label">Password</span>
                <input className="field__input" type="password" defaultValue="placeholder" />
                <span className="field__hint">Last changed 04/02/26.</span>
              </label>
            </div>
            <p className="field__hint" style={{ marginTop: 'var(--sp-4)' }}>
              Account details are read-only. The preferences below are kept on this device.
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
          <Card title="Working directories" note="Vellum only reads files inside these folders." dividedHead>
            <div className="list-rows">
              {[
                ['Projects', '~/vellum/scenes'],
                ['Exports', '~/vellum/out'],
                ['Texture cache', '~/.cache/vellum/textures'],
                ['Pack staging', '~/vellum/pack/current'],
              ].map(([tag, path]) => (
                <div className="list-row" key={path}>
                  <Icon name="folder" size={14} />
                  <span className="list-row__name">{path}</span>
                  <span className="list-row__tag">{tag}</span>
                  <button className="btn btn--sm btn--ghost">Change</button>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Watchers" dividedHead>
            <ToggleRow id="reload" title="Reload on external change" desc="Pick up edits made outside the editor." on />
            <ToggleRow id="subfolders" title="Index subfolders" desc="Include nested folders when building the library." on />
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
          <Card title="Plan" note="Free tier. No card on file." dividedHead>
            <div className="pairs">
              <div className="pairs__row"><span className="pairs__key">Current plan</span><span className="pairs__value">Free</span></div>
              <div className="pairs__row"><span className="pairs__key">Cloud storage</span><span className="pairs__value">N/A</span></div>
              <div className="pairs__row"><span className="pairs__key">Renews</span><span className="pairs__value">-</span></div>
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
            <div className="list-rows">
              {[['g.alex', 'Owner'], ['kite', 'Invite pending'], ['nine', 'Invite pending']].map(([who, role]) => (
                <div className="list-row" key={who}>
                  <Icon name="user" size={14} />
                  <span className="list-row__name">{who}</span>
                  <span className="list-row__tag">{role}</span>
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

  /* The entrance plays on arrival only. Moving between sections swaps the
     title and cards in place. */
  const [arrivedOn] = useState(active)
  const [moved, setMoved] = useState(false)
  if (!moved && active !== arrivedOn) setMoved(true)

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
          <h1 className="page-title">
            <Kinetic key={section.id} text={section.label} still={moved} />
          </h1>
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

        <div className="settings__panel" data-still={moved || undefined}>
          <Body section={section} />
        </div>
      </div>
    </main>
  )
}
