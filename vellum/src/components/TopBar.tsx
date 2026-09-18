import { useEffect, useState } from 'react'
import { Icon, VellumMark } from '../lib/icons'
import { navigate } from '../lib/router'
import type { Theme } from '../lib/useTheme'
import './TopBar.css'

const links = [
  { path: '/', label: 'Dash', match: (s: string[]) => s.length === 0 },
  { path: '/projects', label: 'Projects', match: (s: string[]) => s[0] === 'projects' },
  { path: '/settings', label: 'Settings', match: (s: string[]) => s[0] === 'settings', icon: 'gear' as const },
]

/** mm/dd/yy hh:mm, exactly as the sketch corner reads */
function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function TopBar({
  segments,
  theme,
  onToggleTheme,
}: {
  segments: string[]
  theme: Theme
  onToggleTheme: () => void
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <header className="topbar">
      <a
        className="topbar__brand"
        href="#/"
        onClick={(e) => {
          e.preventDefault()
          navigate('/')
        }}
      >
        <VellumMark />
        Vellum
      </a>

      <nav className="topbar__nav nav-pill" aria-label="Primary">
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
              {l.icon ? <Icon name={l.icon} size={14} /> : null}
              {l.label}
            </a>
          )
        })}
      </nav>

      <div className="topbar__right">
        <span className="topbar__clock">{stamp(now)}</span>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Switch to midnight' : 'Switch to parchment'}
          aria-label={theme === 'light' ? 'Switch to midnight' : 'Switch to parchment'}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
        </button>
      </div>
    </header>
  )
}
