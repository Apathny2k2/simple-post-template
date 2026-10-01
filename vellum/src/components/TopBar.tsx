import { useEffect, useState } from 'react'
import { Icon, VellumMark } from '../lib/icons'
import { navigate } from '../lib/router'
import { useCurrentServer } from '../lib/servers'
import { AccountChip } from './AccountChip'
import { ServerIcon } from './ServerIcon'
import './TopBar.css'

const links = [
  { path: '/dash', label: 'Dash', match: (s: string[]) => s[0] === 'dash' },
  { path: '/projects', label: 'Projects', match: (s: string[]) => s[0] === 'projects' },
  { path: '/settings', label: 'Settings', match: (s: string[]) => s[0] === 'settings', icon: 'gear' as const },
]

/** mm/dd/yy hh:mm */
function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function TopBar({ segments }: { segments: string[] }) {
  const [now, setNow] = useState(() => new Date())
  const server = useCurrentServer()

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <header className="topbar">
      <div className="topbar__left">
        <a
          className="topbar__brand"
          href="#/dash"
          onClick={(e) => {
            e.preventDefault()
            navigate('/dash')
          }}
        >
          <VellumMark />
          Vellum
        </a>
        <button
          className="topbar__server"
          onClick={() => navigate('/servers')}
          aria-label={`${server.name}. Choose another server`}
          title="Choose another server"
        >
          <ServerIcon id={server.id} hue={server.hue} size={18} />
          <span className="topbar__server-name">{server.name}</span>
          <Icon name="chevronDown" size={12} />
        </button>
      </div>

      <nav className="topbar__nav nav-pill glass" aria-label="Primary">
        {links.map((l) => {
          const active = l.match(segments)
          return (
            <a
              key={l.path}
              className="nav-pill__link"
              href={`#${l.path}`}
              aria-current={active ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                navigate(l.path)
              }}
            >
              {active ? <span className="nav-pill__mark" aria-hidden="true" /> : null}
              {l.icon ? <Icon name={l.icon} size={14} /> : null}
              {l.label}
            </a>
          )
        })}
      </nav>

      <div className="topbar__right">
        <span className="topbar__clock">{stamp(now)}</span>
        <AccountChip />
      </div>
    </header>
  )
}
