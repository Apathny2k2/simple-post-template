import { useEffect, useState } from 'react'
import { formatBytes, formatWhen } from '../../lib/dash'
import type { BreakdownRow, IngestRecord, PackState, SubscriptionState } from '../../lib/dash'
import { PixelArt, PixelText } from './pixel'
import { CRATE, LAMP_OFF, LAMP_ON, headSprite, itemFor } from './sprites'
import type { Toast } from './toasts'
import type { ReloadPhase } from '../../components/ReloadControl'

const stack = (n: number) => (n >= 10_000 ? `${Math.floor(n / 1000)}k` : String(n))

/**
 * Server files as a hotbar. When a count changes its slot is selected, the
 * item bounces and its name shows above the bar, the way the game shows
 * the item you just switched to.
 */
export function Hotbar({ rows }: { rows: BreakdownRow[] }) {
  const shape = rows.map((r) => `${r.label}=${r.count}`).join('|')
  const [seen, setSeen] = useState(() => ({ shape, counts: new Map(rows.map((r) => [r.label, r.count])) }))
  const [active, setActive] = useState(0)
  const [held, setHeld] = useState(false)
  const [flash, setFlash] = useState(0)
  const [bumps, setBumps] = useState<Record<string, number>>({})

  if (seen.shape !== shape) {
    const changed = rows.findIndex((r) => seen.counts.get(r.label) !== r.count)
    setSeen({ shape, counts: new Map(rows.map((r) => [r.label, r.count])) })
    if (changed >= 0) {
      const label = rows[changed].label
      setActive(changed)
      setFlash((f) => f + 1)
      setBumps((b) => ({ ...b, [label]: (b[label] ?? 0) + 1 }))
    }
  }

  const slots = Array.from({ length: Math.max(9, rows.length) }, (_, i) => rows[i] ?? null)
  const current = rows[Math.min(active, rows.length - 1)]

  return (
    <div className="hotbar-wrap">
      <p className="hotbar__name" key={flash} data-held={held || undefined} aria-hidden="true">
        {current ? `${current.label} × ${current.count}` : ''}
      </p>
      <div className="hotbar" role="list" aria-label="Files on the server, by kind">
        {slots.map((row, i) =>
          row ? (
            <div
              key={row.label}
              role="listitem"
              tabIndex={0}
              className="slot"
              data-active={i === active || undefined}
              aria-label={`${row.label}: ${row.count}`}
              onMouseEnter={() => {
                setActive(i)
                setHeld(true)
              }}
              onMouseLeave={() => setHeld(false)}
              onFocus={() => {
                setActive(i)
                setHeld(true)
              }}
              onBlur={() => setHeld(false)}
            >
              <span className="slot__item" key={bumps[row.label] ?? 0} data-bump={bumps[row.label] ? '' : undefined}>
                <PixelArt sprite={itemFor(row.label)} scale={2} />
              </span>
              {row.count === 1 ? null : <PixelText className="slot__count" text={stack(row.count)} scale={2} />}
            </div>
          ) : (
            <div key={`empty-${i}`} className="slot slot--empty" aria-hidden="true" />
          ),
        )}
      </div>
      {rows.length ? (
        <p className="hotbar__legend">
          {rows.map((r) => (
            <span key={r.label}>
              {r.label} <strong>{r.count}</strong>
            </span>
          ))}
        </p>
      ) : (
        <p className="hotbar__legend">The plugin reported no file kinds.</p>
      )}
    </div>
  )
}

/** Pack adoption drawn as the experience bar: the level is the players on the current pack. */
export function XpBar({ correct, wrong }: { correct: number; wrong: number }) {
  const total = correct + wrong
  const target = total ? correct / total : 0
  const [fill, setFill] = useState(0)
  const [pop, setPop] = useState({ correct, n: 0 })

  // Start empty and fill on the next frame, so the bar visibly counts up.
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  if (pop.correct !== correct) setPop({ correct, n: correct > pop.correct ? pop.n + 1 : pop.n })

  return (
    <div className="xp" data-full={(total > 0 && correct === total) || undefined}>
      <div className="xp__level" key={pop.n} data-pop={pop.n ? '' : undefined} aria-hidden="true">
        <PixelText text={String(correct)} scale={4} color="#80ff20" edge="outline" edgeColor="#10240a" />
      </div>
      <div
        className="xp__bar"
        role="progressbar"
        aria-label="Players on the current pack"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={correct}
      >
        <span className="xp__fill" style={{ transform: `scaleX(${fill})` }} />
      </div>
    </div>
  )
}

/** The build as it looks in the game's resource pack list. A fresh push shimmers. */
export function PackEntry({ pack, now }: { pack: PackState; now: number }) {
  const fresh = now - new Date(pack.pushedAt).getTime() < 10 * 60_000
  return (
    <div className="pack-entry" data-fresh={fresh || undefined}>
      <span className="pack-entry__icon">
        <PixelArt sprite={CRATE} scale={3} />
        <span className="pack-entry__glint" aria-hidden="true" />
      </span>
      <div className="pack-entry__text">
        <p className="pack-entry__name">{pack.archive}</p>
        <p className="pack-entry__line">
          {pack.version ? `Build ${pack.version}` : 'Current build'}, pushed {formatWhen(pack.pushedAt, now)}
        </p>
        <p className="pack-entry__line mono">
          {formatBytes(pack.bytes)} &middot; {pack.hash}
        </p>
      </div>
    </div>
  )
}

function rarityOf(plan: string) {
  if (/enterprise|studio|legend/i.test(plan)) return 'epic'
  if (/pro|team|plus/i.test(plan)) return 'rare'
  if (/free|basic|starter/i.test(plan)) return 'common'
  return 'uncommon'
}

const seatsOf = (s: string) => {
  const m = /(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(s)
  return m ? { used: Number(m[1]), max: Number(m[2]) } : null
}

/** The plan as an item tooltip, coloured by rarity. */
export function PlanTooltip({ plan }: { plan: SubscriptionState }) {
  const seats = seatsOf(plan.seats)
  return (
    <div className="mc-tooltip">
      <p className="mc-tooltip__name" data-rarity={rarityOf(plan.type)}>
        {plan.type}
      </p>
      <p className="mc-tooltip__lore">Cloud: {plan.cloud}</p>
      <p className="mc-tooltip__lore">Seats: {plan.seats}</p>
      {seats && seats.max > 0 ? (
        <div className="mc-tooltip__seats" role="img" aria-label={`${seats.used} of ${seats.max} seats used`}>
          {Array.from({ length: Math.min(seats.max, 12) }, (_, i) => (
            <span key={i} data-free={i >= seats.used || undefined}>
              <PixelArt sprite={headSprite(i + 3)} scale={2} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const two = (n: number) => String(n).padStart(2, '0')
const clock = (t: number) => {
  const d = new Date(t)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

/** What the plugin sent, printed like a server console. Newest at the bottom. */
export function ServerConsole({ log }: { log: IngestRecord[] }) {
  const lines = log.slice(0, 8).reverse()
  return (
    <div className="console" aria-live="off">
      {lines.length ? (
        lines.map((r) => {
          const level = !r.ok ? 'ERROR' : r.problems.length ? 'WARN' : 'INFO'
          return (
            <p key={r.id} className="console__line" data-level={level}>
              <span className="console__meta">
                [{clock(r.at)} {level}]:
              </span>{' '}
              {r.op}
              {r.problems.length ? (
                <span className="console__problem">
                  {' '}
                  {r.problems[0]}
                  {r.problems.length > 1 ? ` (+${r.problems.length - 1} more)` : ''}
                </span>
              ) : null}
            </p>
          )
        })
      ) : (
        <p className="console__line" data-level="INFO">
          <span className="console__meta">[--:--:-- INFO]:</span> Waiting for a plugin to connect
          <span className="console__caret" aria-hidden="true" />
        </p>
      )}
    </div>
  )
}

/** Lever, redstone, lamp. The signal travels while the reload is in flight; the lamp lights when it swapped. */
export function RedstoneLine({ phase, linked }: { phase: ReloadPhase; linked: boolean }) {
  return (
    <div className="redstone" data-phase={phase} data-linked={linked || undefined} aria-hidden="true">
      <span className="redstone__lever">
        <i />
      </span>
      <span className="redstone__dust">
        <span className="redstone__signal" />
      </span>
      <PixelArt sprite={phase === 'swapped' ? LAMP_ON : LAMP_OFF} scale={2} />
    </div>
  )
}

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast" data-leaving={t.leaving || undefined}>
          <span className="toast__icon">
            <PixelArt sprite={t.icon} scale={2} />
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
