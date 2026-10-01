import { useEffect } from 'react'
import { AccountChip } from '../components/AccountChip'
import { Kinetic } from '../components/Kinetic'
import { ServerIcon } from '../components/ServerIcon'
import { Icon, VellumMark } from '../lib/icons'
import { navigate, useTitle } from '../lib/router'
import { arrive } from '../lib/arrival'
import { formatWhen } from '../lib/dash'
import { currentServer, enterable, roleLabel, servers } from '../lib/servers'
import type { LinkedServer } from '../lib/servers'
import { useSession } from '../lib/session'
import './Servers.css'

/* Every server this account can open: its own, and those where another team gave it a seat. */

/** Ping as four signal bars. */
function Signal({ server }: { server: LinkedServer }) {
  const ping = server.online ? server.ping : null
  const lit = ping === null ? 0 : ping < 80 ? 4 : ping < 150 ? 3 : ping < 300 ? 2 : 1
  return (
    <span className="signal-bars" data-lit={lit} title={ping === null ? 'No answer' : `${ping} ms`}>
      {[1, 2, 3, 4].map((n) => (
        <i key={n} data-on={n <= lit || undefined} />
      ))}
      <span className="visually-hidden">{ping === null ? 'No answer' : `${ping} milliseconds`}</span>
    </span>
  )
}

function ServerRow({ server, last, onEnter }: { server: LinkedServer; last: boolean; onEnter: (s: LinkedServer) => void }) {
  const open = enterable(server)
  const team = server.team
  return (
    <li>
      <button className="server" disabled={!open} data-offline={!server.online || undefined} onClick={() => onEnter(server)}>
        <ServerIcon id={server.id} hue={server.hue} size={56} />
        <span className="server__main">
          <span className="server__top">
            <span className="server__name">{server.name}</span>
            {last ? <span className="server__last">Last opened</span> : null}
          </span>
          <span className="server__motd">{server.motd}</span>
          <span className="server__meta">
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
        <span className="server__side">
          <span className="server__players">
            {server.online ? (
              <>
                <strong>{server.players}</strong>/{server.maxPlayers} players
              </>
            ) : (
              'Offline'
            )}
          </span>
          <Signal server={server} />
          <span className="server__go">
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
  const session = useSession()

  const enter = (s: LinkedServer) => arrive(s)

  // the list is the account's, so it needs someone signed in; signing out here has already left
  useEffect(() => {
    if (!session && window.location.hash.startsWith('#/servers')) navigate('/login', { replace: true })
  }, [session])

  // with only one server to enter, go straight in
  useEffect(() => {
    if (!only || !session) return
    const s = servers.find((x) => x.id === only)
    if (s) arrive(s, { replace: true })
  }, [only, session])

  if (!session) return null

  return (
    <div className="server-picker">
      <header className="server-picker-head">
        <a
          className="server-picker-head__brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <VellumMark />
          Vellum
        </a>
        <AccountChip servers={false} />
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
