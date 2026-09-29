import { useEffect, useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../lib/icons'
import { navigate } from '../../lib/router'
import { formatBytes, formatWhen } from '../../lib/dash'
import type { BreakdownRow, PackState, PlayerCensus, SubscriptionState } from '../../lib/dash'
import { trackPointer, useTween } from '../../lib/motion'
import type { Toast } from './toasts'

const vars = (v: Record<string, string | number>) => v as CSSProperties

/** A dark panel with a light that follows the pointer. `n` staggers its entrance. */
export function Tile({
  label,
  title,
  badge,
  actions,
  className = '',
  n,
  children,
}: {
  label: ReactNode
  title?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  className?: string
  n: number
  children: ReactNode
}) {
  return (
    <section className={`tile ${className}`} style={vars({ '--n': n })} onPointerMove={trackPointer}>
      <header className="tile__head">
        <div className="tile__heading">
          <p className="tile__label">
            {label}
            {badge}
          </p>
          {title ? <h2 className="tile__title">{title}</h2> : null}
        </div>
        {actions ? <div className="tile__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}

/** A number that counts up to its value. Screen readers are given the value itself. */
export function Counter({ value }: { value: number }) {
  const shown = useTween(value)
  return (
    <span className="counter">
      <span aria-hidden="true">{Math.round(shown).toLocaleString()}</span>
      <span className="vh">{value.toLocaleString()}</span>
    </span>
  )
}

/* ---------------- players ---------------- */

const R = 64

function arc(a0: number, a1: number) {
  const at = (a: number) => `${(Math.sin(a) * R).toFixed(2)} ${(-Math.cos(a) * R).toFixed(2)}`
  return `M ${at(a0)} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${at(a1)}`
}

/** One slice per player while they fit, current pack first. A join re-slices the ring. */
export function AdoptionRing({ players, now }: { players: PlayerCensus; now: number }) {
  const { correct, wrong } = players
  const total = correct + wrong
  const share = total ? Math.round((correct / total) * 100) : 0
  const sliced = total > 0 && total <= 48
  const gap = sliced ? Math.min(0.09, (Math.PI * 2) / total / 4) : 0
  const glow = useId()

  return (
    <div className="adopt">
      <div className="adopt__dial">
        <svg className="adopt__ring" viewBox="-84 -84 168 168" aria-hidden="true">
          <defs>
            <radialGradient id={glow}>
              <stop offset="0.55" style={{ stopColor: 'var(--blue)', stopOpacity: 0.22 }} />
              <stop offset="1" style={{ stopColor: 'var(--blue)', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <circle r="82" fill={`url(#${glow})`} className="adopt__bloom" data-on={share === 100 || undefined} />
          <circle r="77" className="adopt__ticks" />
          <circle r={R} className="adopt__track" />
          {sliced
            ? Array.from({ length: total }, (_, i) => {
                const d = arc((i / total) * Math.PI * 2 + gap / 2, ((i + 1) / total) * Math.PI * 2 - gap / 2)
                return (
                  <path
                    key={i}
                    d={d}
                    className="adopt__slice"
                    data-old={i >= correct || undefined}
                    style={vars({ '--i': i, d: `path("${d}")` })}
                  />
                )
              })
            : null}
          {total > 48 ? (
            <>
              <circle r={R} pathLength={100} className="adopt__arc" data-old style={{ strokeDasharray: '100 100' }} />
              <circle r={R} pathLength={100} className="adopt__arc" style={{ strokeDasharray: `${share} 100` }} />
            </>
          ) : null}
        </svg>
        <div className="adopt__centre">
          <p className="adopt__share">
            {total ? (
              <>
                <Counter value={share} />
                <small>%</small>
              </>
            ) : (
              '–'
            )}
          </p>
          <p className="adopt__of">{total ? `${correct} of ${total} players` : 'Nobody online'}</p>
        </div>
      </div>

      <ul className="adopt__legend">
        <li>
          <i data-kind="new" /> <strong>{correct}</strong> on the current pack
        </li>
        <li>
          <i data-kind="old" /> <strong>{wrong}</strong> on an old one
        </li>
      </ul>
      {total ? <p className="adopt__when">Counted {formatWhen(players.sampledAt, now)}</p> : null}
    </div>
  )
}

/* ---------------- files ---------------- */

const HUES = ['#5aa2ff', '#b594ff', '#2ec5b6', '#ffb547', '#ff7ab8', '#7ee081']
const TALLEST = 8

/** Each kind of file as a stack of cubes. Hover a stack to pull it apart. */
export function CubeStacks({ rows }: { rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const unit = Math.ceil(max / TALLEST)
  // cubes that arrive after the first fall straight in, without the opening stagger
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 1800)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="stacks" data-settled={settled || undefined}>
      <div className="stacks__row">
        {rows.map((row, c) => {
          const cubes = row.count ? Math.max(1, Math.ceil(row.count / unit)) : 0
          return (
            <div key={row.label} className="stack" style={vars({ '--hue': HUES[c % HUES.length], '--c': c })}>
              <div className="stack__cubes" aria-hidden="true">
                {Array.from({ length: cubes }, (_, i) => (
                  <span key={i} className="iso" style={vars({ '--lv': i })} />
                ))}
              </div>
              <div className="stack__legend">
                <p className="stack__count">
                  <Counter value={row.count} />
                </p>
                <p className="stack__label">{row.label}</p>
              </div>
            </div>
          )
        })}
      </div>
      {unit > 1 ? <p className="stacks__note">One cube is {unit} files.</p> : null}
    </div>
  )
}

/* ---------------- pack ---------------- */

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom']

/** The pack as a turning crate. A new build drops in; one under ten minutes old glows. */
export function PackBox({ pack, now }: { pack: PackState; now: number }) {
  const age = now - new Date(pack.pushedAt).getTime()
  const fresh = age >= 0 && age < 10 * 60_000

  return (
    <div className="pack" data-fresh={fresh || undefined}>
      <div className="pack__stage" aria-hidden="true">
        <span className="pack__shadow" />
        <div className="pack__drop" key={pack.hash}>
          <div className="pack__cube">
            {FACES.map((f) => (
              <i key={f} className="pack__face" data-face={f} />
            ))}
          </div>
        </div>
        {fresh ? <span className="pack__new">New</span> : null}
      </div>
      <dl className="facts">
        <div>
          <dt>Archive</dt>
          <dd className="mono">{pack.archive}</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd className="mono">{pack.version ?? 'none'}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd className="mono">{formatBytes(pack.bytes)}</dd>
        </div>
        <div>
          <dt>Hash</dt>
          <dd className="mono">{pack.hash}</dd>
        </div>
        <div>
          <dt>Pushed</dt>
          <dd>{formatWhen(pack.pushedAt, now)}</dd>
        </div>
      </dl>
    </div>
  )
}

/* ---------------- plan ---------------- */

export function Plan({ plan }: { plan: SubscriptionState }) {
  const m = /^(\d+)\s*of\s*(\d+)$/i.exec(plan.seats.trim())
  const used = m ? Number(m[1]) : 0
  const seats = m ? Math.min(24, Number(m[2])) : 0

  return (
    <div className="plan">
      <p className="plan__tier">{plan.type}</p>
      <dl className="facts">
        <div>
          <dt>Cloud</dt>
          <dd>{plan.cloud}</dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd>
            {seats ? (
              <span className="plan__seats" aria-hidden="true">
                {Array.from({ length: seats }, (_, i) => (
                  <i key={i} data-used={i < used || undefined} />
                ))}
              </span>
            ) : null}
            {plan.seats}
          </dd>
        </div>
      </dl>
      <button className="btn btn--ghost btn--sm plan__go" onClick={() => navigate('/settings/billing')}>
        Billing <Icon name="arrowRight" size={12} />
      </button>
    </div>
  )
}

/* ---------------- files table ---------------- */

const KIND_HUE: [RegExp, string][] = [
  [/mob/i, '#b594ff'],
  [/item/i, '#ffb547'],
  [/rig/i, '#2ec5b6'],
  [/block/i, '#7ee081'],
  [/texture/i, '#ff7ab8'],
]

/** A small cube coloured by the folder the file lives in. */
export function FileGlyph({ where }: { where: string }) {
  const hue = KIND_HUE.find(([re]) => re.test(where))?.[1] ?? '#5aa2ff'
  return <span className="iso iso--glyph" style={vars({ '--hue': hue })} aria-hidden="true" />
}

export function Person({ name }: { name: string }) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span className="person">
      <i style={vars({ '--h': h })} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </i>
      {name}
    </span>
  )
}

/* ---------------- toasts ---------------- */

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone} data-leaving={t.leaving || undefined}>
          <span className="toast__icon">
            <Icon name={t.icon} size={15} />
          </span>
          <span className="toast__text">
            <span className="toast__title">{t.title}</span>
            <span className="toast__body">{t.body}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
