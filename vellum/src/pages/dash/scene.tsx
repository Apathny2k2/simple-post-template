import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { dashStore, formatWhen } from '../../lib/dash'
import type { DashMeta, Health, ServerState } from '../../lib/dash'
import { PixelArt, PixelText } from './pixel'
import { BASE_BLOCK, BEACON, GRASS, GROUND, personSprite, spriteUri } from './sprites'
import type { Sprite } from './sprites'

type Sky = 'dawn' | 'day' | 'dusk' | 'night'

const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60

function skyAt(d: Date): Sky {
  const h = hourOf(d)
  if (h >= 5.5 && h < 7.5) return 'dawn'
  if (h >= 7.5 && h < 18) return 'day'
  if (h >= 18 && h < 20) return 'dusk'
  return 'night'
}

/** Sun from 6:00 to 19:00, moon the rest of the time, each on a shallow arc. */
function bodyAt(d: Date) {
  const h = hourOf(d)
  const day = h >= 6 && h < 19
  const t = day ? (h - 6) / 13 : ((h + 24 - 19) % 24) / 11
  return { moon: !day, left: 4 + t * 70, top: 58 - Math.sin(Math.PI * t) * 44 }
}

const CLOUD: Sprite = {
  rows: ['.....WWWWWW.........', '..WWWWWWWWWWW..WWW..', 'WWWWWWWWWWWWWWWWWWWW', 'SSSSSSSSSSSSSSSSSSSS'],
  palette: { W: '#ffffff', S: '#dde9f4' },
}

// `rest` is where each cloud sits when motion is reduced.
const CLOUDS = [
  { top: 14, delay: -8, speed: 110, rest: 12 },
  { top: 34, delay: -61, speed: 150, rest: 48 },
  { top: 6, delay: -97, speed: 130, rest: 70 },
]

const STARS = [
  [8, 12],
  [17, 30],
  [24, 8],
  [33, 22],
  [41, 40],
  [52, 14],
  [58, 34],
  [66, 6],
  [71, 26],
  [79, 16],
  [86, 38],
  [92, 10],
  [12, 44],
  [47, 4],
]

const GROUND_TILE = spriteUri(GROUND)
const MAX_PEOPLE = 28

type Person = { key: string; seed: number; old: boolean }

const seedOf = (name: string) => [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)

/** Named players when the plugin reports them one by one, otherwise the census counts. */
function crowdOf(correct: number, wrong: number, packHash: string): Person[] {
  if (dashStore.roster.size) {
    const current = packHash.trim().toLowerCase()
    return [...dashStore.roster].map(([name, hash]) => ({
      key: name,
      seed: seedOf(name),
      old: !current || hash.trim().toLowerCase() !== current,
    }))
  }
  return Array.from({ length: correct + wrong }, (_, i) => ({
    key: `p${i}`,
    seed: i,
    old: i >= correct,
  }))
}

function Crowd({ correct, wrong, packHash }: { correct: number; wrong: number; packHash: string }) {
  const people = crowdOf(correct, wrong, packHash)
  const shape = people.map((p) => `${p.key}:${p.old ? 0 : 1}`).join(',')
  const [seen, setSeen] = useState(() => ({
    shape,
    old: new Map(people.map((p) => [p.key, p.old])),
  }))
  const [sparks, setSparks] = useState<Record<string, number>>({})

  // A player who moves onto the current pack gets a burst of XP.
  if (seen.shape !== shape) {
    const fresh: Record<string, number> = {}
    for (const p of people) {
      if (seen.old.get(p.key) === true && !p.old) fresh[p.key] = (sparks[p.key] ?? 0) + 1
    }
    setSeen({ shape, old: new Map(people.map((p) => [p.key, p.old])) })
    if (Object.keys(fresh).length) setSparks((s) => ({ ...s, ...fresh }))
  }

  const shown = people.slice(0, MAX_PEOPLE)
  const oldCount = people.filter((p) => p.old).length
  return (
    <>
      <div
        className="crowd"
        role="img"
        aria-label={people.length ? `${people.length} players online, ${oldCount} on an old pack` : 'Nobody is online'}
      >
        {shown.map((p, i) => (
          <span key={p.key} className="person" data-old={p.old || undefined} style={{ '--i': i } as CSSProperties}>
            {p.old ? (
              <span className="person__flag">
                <PixelText text="!" scale={2} color="#ff4b3a" edgeColor="#5c0f08" />
              </span>
            ) : null}
            {sparks[p.key] ? <span className="person__spark" key={sparks[p.key]} /> : null}
            <PixelArt sprite={personSprite(p.seed)} scale={2} />
          </span>
        ))}
      </div>
      {/* Outside the crowd so its fade-out never hides the count. */}
      {people.length > MAX_PEOPLE ? (
        <span className="crowd-more" aria-hidden="true">
          <PixelText text={`+${people.length - MAX_PEOPLE}`} scale={2} />
        </span>
      ) : null}
    </>
  )
}

function Beacon({ on }: { on: boolean }) {
  const beat = dashStore.log.find((r) => r.op === 'POST /dash/heartbeat' && r.ok)?.id
  return (
    <div className="beacon" data-on={on || undefined} aria-hidden="true">
      <div className="beacon__beam">{on && beat ? <span className="beacon__pulse" key={beat} /> : null}</div>
      <PixelArt className="beacon__block" sprite={BEACON} scale={2} />
      <div className="beacon__base">
        <PixelArt sprite={BASE_BLOCK} scale={2} />
        <PixelArt sprite={BASE_BLOCK} scale={2} />
        <PixelArt sprite={BASE_BLOCK} scale={2} />
      </div>
    </div>
  )
}

function Signal({ health, meta, now }: { health: Health; meta: DashMeta; now: number }) {
  const waiting = meta.lastSeen === null
  const ago = meta.lastSeen === null ? '' : formatWhen(new Date(meta.lastSeen).toISOString(), now)
  const label = waiting
    ? 'Waiting for a plugin'
    : health === 'live'
      ? `Live, ${ago}`
      : health === 'stale'
        ? `Quiet since ${ago}`
        : `Lost the plugin ${ago}`
  return (
    <div className="signal" data-state={waiting ? 'waiting' : health} title={meta.agent ?? undefined}>
      <span className="signal__bars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} style={{ '--n': n } as CSSProperties} />
        ))}
      </span>
      <span className="signal__label">{label}</span>
    </div>
  )
}

/**
 * The top of the Dash: the server as it appears in the game's server list,
 * over a small scene. The beacon is lit while the server is online and
 * pulses on every plugin heartbeat. Each figure is a connected player.
 */
export function Scene({
  server,
  correct,
  wrong,
  packHash,
  health,
  meta,
  now,
  badge,
  menu,
}: {
  server: ServerState
  correct: number
  wrong: number
  packHash: string
  health: Health
  meta: DashMeta
  now: number
  badge: ReactNode
  menu: ReactNode
}) {
  const date = new Date(now)
  const sky = skyAt(date)
  const body = bodyAt(date)
  const online = correct + wrong

  return (
    <section className="dash-scene" data-sky={sky} aria-label="Server">
      {sky === 'night' || sky === 'dusk' || sky === 'dawn' ? (
        <div className="dash-scene__stars" aria-hidden="true">
          {STARS.map(([x, y], i) => (
            <i key={i} style={{ left: `${x}%`, top: `${y}%`, '--i': i } as CSSProperties} />
          ))}
        </div>
      ) : null}

      <span
        className={body.moon ? 'dash-scene__moon' : 'dash-scene__sun'}
        style={{ left: `${body.left}%`, top: `${body.top}%` }}
        aria-hidden="true"
      />

      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="dash-scene__cloud"
          style={
            {
              top: `${c.top}%`,
              animationDuration: `${c.speed}s`,
              animationDelay: `${c.delay}s`,
              '--rest': `${c.rest}%`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <PixelArt sprite={CLOUD} scale={4} />
        </div>
      ))}

      <Beacon on={server.online} />
      <Crowd correct={correct} wrong={wrong} packHash={packHash} />
      <div className="dash-scene__ground" style={{ backgroundImage: GROUND_TILE }} aria-hidden="true" />

      <div className="server-entry">
        <PixelArt className="server-entry__icon" sprite={GRASS} scale={3} />
        <div className="server-entry__main">
          <h2 className="server-entry__name">
            {server.name}
            {badge}
          </h2>
          <p className="server-entry__motd">
            <span className="mono">{server.host}</span>
            <span className="server-entry__status" data-online={server.online}>
              {server.status}
            </span>
          </p>
          <p className="server-entry__ip mono">{server.ip}</p>
        </div>
        <div className="server-entry__side">
          <div className="server-entry__online">
            <PixelText text={String(online)} scale={2} color="#ffffff" edgeColor="#3f3f3f" />
            <span>online</span>
          </div>
          <Signal health={health} meta={meta} now={now} />
        </div>
        <div className="server-entry__menu">{menu}</div>
      </div>
    </section>
  )
}
