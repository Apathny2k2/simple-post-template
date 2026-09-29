import { useEffect } from 'react'
import { Kinetic } from '../components/Kinetic'
import { ServerIcon } from '../components/ServerIcon'
import { Icon, VellumMark } from '../lib/icons'
import { navigate, useTitle } from '../lib/router'
import { formatWhen } from '../lib/dash'
import { currentServer, enterServer, enterable, roleLabel, servers } from '../lib/servers'
import type { LinkedServer } from '../lib/servers'
import './Servers.css'

/* The way into the Studio: every server this account can open, the
   ones it owns and the ones where another team has given it a seat.
   With only one to go to there is nothing to ask, so it goes straight
   in. */

/** Signal bars, as the game's own server list draws them. */
function Signal({ server }: { server: LinkedServer }) {
  const ping = server.online ? server.ping : null
  const lit = ping === null ? 0 : ping < 80 ? 4 : ping < 150 ? 3 : ping < 300 ? 2 : 1
  return (
    <span className="srv-bars" data-lit={lit} title={ping === null ? 'No answer' : `${ping} ms`}>
      {[1, 2, 3, 4].map((n) => (
        <i key={n} data-on={n <= lit || undefined} />
      ))}
      <span className="vh">{ping === null ? 'No answer' : `${ping} milliseconds`}</span>
    </span>
  )
}

function ServerRow({ server, last, onEnter }: { server: LinkedServer; last: boolean; onEnter: (s: LinkedServer) => void }) {
  const open = enterable(server)
  const team = server.team
  return (
    <li>
      <button className="srv" disabled={!open} data-offline={!server.online || undefined} onClick={() => onEnter(server)}>
        <ServerIcon id={server.id} hue={server.hue} size={56} />
        <span className="srv__main">
          <span className="srv__top">
            <span className="srv__name">{server.name}</span>
            {last ? <span className="srv__last">Last opened</span> : null}
          </span>
          <span className="srv__motd">{server.motd}</span>
          <span className="srv__meta">
            <span className="mono">{server.host}</span>
            <span>{server.software}</span>
            {team ? (
              <span>
                {roleLabel[server.role]} seat on {team.name}, {team.seatsUsed} of {team.seats} seats filled
              </span>
            ) : (
              <span>You own it</span>
            )}
          </span>
        </span>
        <span className="srv__side">
          <span className="srv__players">
            {server.online ? (
              <>
                <strong>{server.players}</strong>/{server.maxPlayers} players
              </>
            ) : (
              'Offline'
            )}
          </span>
          <Signal server={server} />
          <span className="srv__go">
            {open ? (
              <>
                Enter <Icon name="arrowRight" size={13} />
              </>
            ) : (
              `Last seen ${formatWhen(server.seenAt)}`
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

export function Servers() {
  useTitle('Choose a server')
  const own = servers.filter((s) => s.team === null)
  const seats = servers.filter((s) => s.team !== null)
  const ready = servers.filter(enterable)
  const only = ready.length === 1 ? ready[0].id : null
  const last = currentServer().id

  const enter = (s: LinkedServer) => {
    enterServer(s.id)
    navigate('/dash')
  }

  // one server to go to is not a choice
  useEffect(() => {
    if (!only) return
    enterServer(only)
    navigate('/dash', { replace: true })
  }, [only])

  return (
    <div className="gate">
      <header className="gate-head">
        <a
          className="gate-head__brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <VellumMark />
          Vellum
        </a>
        <span className="topbar__who glass" title="Signed in as g.alex">
          <span className="topbar__dot" />
          g.alex
        </span>
      </header>

      <main className="page servers">
        <div className="page-head">
          <div>
            <div className="eyebrow">Studio</div>
            <h1 className="page-title">
              <Kinetic text="What server would you like to enter?" />
            </h1>
            <p className="page-sub">The servers you own, and the ones where a team has given you a seat.</p>
          </div>
        </div>

        <section className="servers__group" aria-labelledby="servers-own">
          <h2 className="servers__label" id="servers-own">
            Your servers <span className="mono">{own.length}</span>
          </h2>
          <ul className="servers__list">
            {own.map((s) => (
              <ServerRow key={s.id} server={s} last={s.id === last} onEnter={enter} />
            ))}
          </ul>
        </section>

        <section className="servers__group" aria-labelledby="servers-seats">
          <h2 className="servers__label" id="servers-seats">
            Seats on other teams <span className="mono">{seats.length}</span>
          </h2>
          <ul className="servers__list">
            {seats.map((s) => (
              <ServerRow key={s.id} server={s} last={s.id === last} onEnter={enter} />
            ))}
          </ul>
        </section>

        <p className="servers__note">These are sample servers. Servers you link to your account show up here.</p>
      </main>
    </div>
  )
}
