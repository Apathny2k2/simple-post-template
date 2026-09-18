import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Icon } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { navigate } from '../lib/router'
import { Support } from './Support'
import './Settings.css'

type SectionId =
  | 'account' | 'profile' | 'directory' | 'report-a-bug' | 'about'
  | 'billing' | 'teams' | 'support'

type Section = { id: SectionId; label: string; icon: IconName; paid?: boolean; blurb: string }

const freeSections: Section[] = [
  { id: 'account', label: 'Account', icon: 'user', blurb: 'Sign-in, sessions and how this machine is identified.' },
  { id: 'profile', label: 'Profile', icon: 'book', blurb: 'What collaborators see next to your uploads.' },
  { id: 'directory', label: 'Directory', icon: 'directory', blurb: 'Where Vellum reads and writes on disk.' },
  { id: 'report-a-bug', label: 'Report A Bug', icon: 'bug', blurb: 'Send a report with the current session log attached.' },
  { id: 'about', label: 'About', icon: 'info', blurb: 'Build, licences and what changed recently.' },
]

const paidSections: Section[] = [
  { id: 'billing', label: 'Billing', icon: 'card', paid: true, blurb: 'Plan, payment method and invoice history.' },
  { id: 'teams', label: 'Teams', icon: 'users', paid: true, blurb: 'Seats, roles and shared scene access.' },
  { id: 'support', label: 'Support', icon: 'support', paid: true, blurb: 'Priority queue and direct escalation.' },
]

const allSections = [...freeSections, ...paidSections]

function Switch({ on }: { on: boolean }) {
  const [checked, setChecked] = useState(on)
  return (
    <button
      className="switch"
      role="switch"
      aria-checked={checked}
      onClick={() => setChecked((c) => !c)}
    />
  )
}

function ToggleRow({ title, desc, on }: { title: string; desc: string; on: boolean }) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <div className="toggle-row__t">{title}</div>
        <div className="toggle-row__d">{desc}</div>
      </div>
      <Switch on={on} />
    </div>
  )
}

/** The dashed region from the sketch - the same card, drawn empty. */
function SectionSlot({ title, note }: { title: string; note: string }) {
  return (
    <Card variant="dashed">
      <div className="card__placeholder">
        <Icon name="layers" size={22} />
        <div className="card__title">{title}</div>
        <p>{note}</p>
      </div>
    </Card>
  )
}

function PaidGate({ label }: { label: string }) {
  return (
    <div className="tier-note">
      <Icon name="lock" size={13} />
      <span>
        {label} sits behind a paid tier. The layout is shown; the controls are placeholders.
      </span>
    </div>
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
            <div className="row-actions" style={{ marginTop: 'var(--sp-4)' }}>
              <button className="btn btn--primary">Save changes</button>
              <button className="btn">Revoke other sessions</button>
            </div>
          </Card>
          <Card title="This machine" dividedHead>
            <ToggleRow title="Keep me signed in" desc="Skip the login prompt on this device." on />
            <ToggleRow title="Send crash reports" desc="Anonymous stack traces only." on />
            <ToggleRow title="Beta channel" desc="Opt into pre-release editor builds." on={false} />
          </Card>
          <SectionSlot
            title="Reusable card for section sectioning"
            note="Every settings panel is composed from this one card. Drawn dashed where a region is reserved but not yet filled."
          />
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
          <SectionSlot title="Avatar & banner" note="Reserved for the upload region - same card, dashed." />
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
            <ToggleRow title="Reload on external change" desc="Pick up edits made outside the editor." on />
            <ToggleRow title="Index subfolders" desc="Walk nested directories when building the library." on />
          </Card>
        </>
      )

    case 'report-a-bug':
      return (
        <>
          <Card title="Report a bug" note="Goes straight to the tracker with your session log." dividedHead>
            <div className="field-grid">
              <label className="field">
                <span className="field__label">Area</span>
                <select defaultValue="editor">
                  <option value="editor">Editor / viewport</option>
                  <option value="library">Library</option>
                  <option value="pack">Resource pack sync</option>
                  <option value="other">Something else</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Severity</span>
                <select defaultValue="normal">
                  <option value="low">Cosmetic</option>
                  <option value="normal">Normal</option>
                  <option value="high">Blocks my work</option>
                </select>
              </label>
              <label className="field field--wide">
                <span className="field__label">What happened</span>
                <textarea placeholder="Steps, what you expected, what you got instead." />
              </label>
            </div>
            <div className="row-actions" style={{ marginTop: 'var(--sp-4)' }}>
              <button className="btn btn--primary">
                <Icon name="bug" size={14} /> Send report
              </button>
              <button className="btn">
                <Icon name="file" size={14} /> Attach session log
              </button>
            </div>
          </Card>
        </>
      )

    case 'about':
      return (
        <>
          <Card title="Vellum" note="Layout study - not a shipping build." dividedHead>
            <div className="kv">
              <div className="kv__row"><span className="kv__k">Version</span><span className="kv__v">0.4.1-mock</span></div>
              <div className="kv__row"><span className="kv__k">Renderer</span><span className="kv__v">CSS transforms (stand-in)</span></div>
              <div className="kv__row"><span className="kv__k">Typeface</span><span className="kv__v">Self-hosted, woff2</span></div>
              <div className="kv__row"><span className="kv__k">Built</span><span className="kv__v">09/18/26</span></div>
            </div>
          </Card>
          <SectionSlot title="Changelog" note="Reserved region - release notes would render here." />
        </>
      )

    case 'billing':
      return (
        <>
          <PaidGate label="Billing" />
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
          <SectionSlot title="Invoices" note="Reserved region - invoice history for paid tiers." />
        </>
      )

    case 'teams':
      return (
        <>
          <PaidGate label="Teams" />
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
          <SectionSlot title="Shared scene access" note="Reserved region - per-scene role matrix." />
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
                <Icon name="key" size={11} /> Paid tiers
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
