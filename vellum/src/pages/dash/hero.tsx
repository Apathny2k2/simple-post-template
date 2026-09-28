import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../lib/icons'
import type { DashMeta, Health, PlayerCensus, ServerState } from '../../lib/dash'
import { Counter } from './cards'
import { Showcase } from './showcase'

/** The server's name, dropped in a letter at a time. Hovering a letter nudges it and its neighbours. */
function Kinetic({ text }: { text: string }) {
  let i = 0
  return (
    <span className="kinetic" aria-hidden="true">
      {text.split(' ').map((word, w) => (
        <Fragment key={w}>
          {w > 0 ? ' ' : null}
          <span className="kinetic__word">
            {[...word].map((ch) => (
              <span key={i} className="kinetic__ch" style={{ '--i': i++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

export function Hero({
  server,
  players,
  meta,
  health,
  now,
  demo,
  linked,
  onDemo,
  badge,
  menu,
}: {
  server: ServerState
  players: PlayerCensus
  meta: DashMeta
  health: Health
  now: number
  demo: boolean
  linked: boolean
  onDemo: (on: boolean) => void
  badge: ReactNode
  menu: ReactNode
}) {
  const live = meta.fed.length > 0
  const total = players.correct + players.wrong
  const share = total ? Math.round((players.correct / total) * 100) : 0
  const quiet = meta.lastSeen === null ? '' : ago(now - meta.lastSeen)
  const feed = !live
    ? 'Sample data'
    : health === 'live'
      ? 'Live'
      : health === 'stale'
        ? `Quiet for ${quiet}`
        : `No word for ${quiet}`

  return (
    <section className="hero" aria-labelledby="dash-server-name">
      <div className="hero__aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="hero__text">
        <div className="hero__status">
          <span className="hero__dot" data-up={server.online || undefined} aria-hidden="true" />
          <span className="hero__state">{server.status}</span>
          <span className="hero__host mono">{server.host}</span>
          <span className="hero__feed" data-health={live ? health : 'sample'}>
            {feed}
          </span>
          {live ? badge : null}
          {menu}
        </div>

        <h2 className="hero__title" id="dash-server-name" style={{ '--len': server.name.length } as CSSProperties}>
          <span className="vh">{server.name}</span>
          <Kinetic key={server.name} text={server.name} />
        </h2>

        <dl className="hero__stats">
          <div>
            <dt>Files synced</dt>
            <dd>
              <Counter value={server.total} />
            </dd>
          </div>
          <div>
            <dt>Players online</dt>
            <dd>
              <Counter value={total} />
            </dd>
          </div>
          <div>
            <dt>On the current pack</dt>
            <dd>
              {total ? (
                <>
                  <Counter value={share} />
                  <small>%</small>
                </>
              ) : (
                '–'
              )}
            </dd>
          </div>
        </dl>

        <div className="hero__actions">
          {demo ? (
            <>
              <button className="btn hero__btn" onClick={() => onDemo(false)}>
                <Icon name="pause" size={12} /> Stop demo
              </button>
              <p className="hero__note">
                <span className="hero__rec" aria-hidden="true" />
                Demo server running. It talks to this page through the plugin API.
              </p>
            </>
          ) : !live && !linked ? (
            <>
              <button className="btn btn--primary hero__btn" onClick={() => onDemo(true)}>
                <Icon name="play" size={12} /> Run a demo server
              </button>
              <p className="hero__note">No server connected yet.</p>
            </>
          ) : !live ? (
            <p className="hero__note">Linked. Waiting for the plugin's first report.</p>
          ) : meta.agent ? (
            <p className="hero__note">
              Reporting: <span className="mono">{meta.agent}</span>
            </p>
          ) : null}
        </div>
      </div>

      <Showcase />
    </section>
  )
}
