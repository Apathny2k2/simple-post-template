import { useEffect } from 'react'
import { dash, loadLink } from '../../lib/dash-api'
import { setLive, useLive } from '../../lib/arrival'
import { useCurrentServer } from '../../lib/servers'
import { useSession } from '../../lib/session'
import type { ReloadOutcome } from '../../lib/reload'

const via = 'ui' as const
const NAMES = ['kite', 'nine', 'aurelia', 'juno', 'pike', 'moss', 'wren', 'ash', 'bram', 'ivy', 'quill', 'sable', 'tove', 'orrin', 'lark', 'fen']
const SAVES = ['ember_hound.vellum', 'tide_crawler.vellum', 'brass_golem.vellum', 'moth_king.vellum']
const hashOf = (build: number) => `sha1:${(Math.imul(build + 101, 2654435761) >>> 0).toString(16).padStart(8, '0')}`
/** Each build is a little bigger than the last. */
const bytesOf = (build: number) => 18_874_368 + (build - 14) * 40_960

/** Runs the demo server while the entered server is live and no real plugin is linked. Signing out stops it. */
export function useDemoServer() {
  const live = useLive()
  const session = useSession()
  const entered = useCurrentServer()
  useEffect(() => {
    if (!session) setLive(false)
  }, [session])
  useEffect(
    () => (live && !loadLink()?.baseUrl ? startDemo({ name: entered.name, host: entered.host }) : undefined),
    [live, entered.name, entered.host],
  )
}

/** A pretend server feeding the Dash through the plugin API, under `as`'s name. The returned stop function restores the sample. */
export function startDemo(as: { name: string; host: string } = { name: 'Demo SMP', host: 'play.demo.vellum.gg' }): () => void {
  const timers = new Set<number>()
  let stopped = false
  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id)
      if (!stopped) fn()
    }, ms)
    timers.add(id)
  }

  let build = 14
  let nextName = 12
  let nextSave = 0
  const kinds: Record<string, number> = { Models: 9, Rigs: 3, Mobs: 2, Textures: 14 }
  const breakdown = () => Object.entries(kinds).map(([label, count]) => ({ label, count }))
  const online: string[] = []

  const beat = () => {
    dash.heartbeat({ agent: 'Demo server', everySeconds: 5 }, via)
    later(5000, beat)
  }
  beat()

  const minutes = (n: number) => Date.now() - n * 60_000
  // the two builds before this one, as the Studio saw them go out, with the players each reached
  for (const [n, ago, on, of] of [[12, 1500, 14, 16], [13, 380, 11, 13]]) {
    dash.pack({ archive: 'demo-pack.zip', bytes: bytesOf(n), hash: hashOf(n), version: `1.${n}`, pushedAt: minutes(ago) }, via)
    dash.players({ correct: on, wrong: of - on }, via)
  }
  dash.snapshot(
    {
      server: { name: as.name, host: as.host, ip: '127.0.0.1', status: 'Online', online: true, breakdown: breakdown() },
      pack: { archive: 'demo-pack.zip', bytes: bytesOf(build), hash: hashOf(build), pushedAt: minutes(180), version: `1.${build}` },
      subscription: { type: 'Free', cloud: 'N/A', seats: '1 of 1' },
      files: [
        { name: 'keep_warden.vellum', where: '/demo/mobs', by: 'kite', touchedAt: minutes(50), sync: 'in-sync' },
        { name: 'euler.vellum', where: '/demo/rigs', by: 'g.alex', touchedAt: minutes(140), sync: 'in-sync' },
        { name: 'tide_compass.vellum', where: '/demo/items', by: 'juno', touchedAt: minutes(260), sync: 'in-sync' },
      ],
    },
    via,
  )

  const join = (name: string, current: boolean) => {
    if (!online.includes(name)) online.push(name)
    dash.report({ player: name, packHash: hashOf(current ? build : build - 1) }, via)
  }
  // 12 players arrive; 4 of them still hold the previous build.
  ;[1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0].forEach((current, i) => later(500 + i * 320, () => join(NAMES[i], current === 1)))

  const cycle = (stragglers: number) => {
    later(1500, () => {
      kinds.Mobs += 1
      dash.files({ name: SAVES[nextSave++ % SAVES.length], where: '/demo/mobs', by: 'kite', sync: 'outdated', staleClients: online.length }, via)
      dash.server({ breakdown: breakdown() }, via)
    })

    later(4500, () => {
      build += 1
      dash.pack({ archive: 'demo-pack.zip', bytes: bytesOf(build), hash: hashOf(build), version: `1.${build}`, pushedAt: Date.now() }, via)
    })

    const updating = Math.max(0, online.length - stragglers)
    for (let i = 0; i < updating; i++) {
      later(6000 + i * 600, () => {
        const name = online[i]
        if (name) dash.report({ player: name, packHash: hashOf(build) }, via)
      })
    }

    const t = 6000 + updating * 600 + 1500
    later(t, () => {
      const gone = online.shift()
      if (gone) dash.report({ player: gone, left: true }, via)
    })
    later(t + 1200, () => join(NAMES[nextName++ % NAMES.length], true))
    later(t + 3500, () => dash.server({ status: 'Restarting', online: false }, via))
    later(t + 6500, () => dash.server({ status: 'Online', online: true }, via))
    later(t + 8500, () => cycle(stragglers ? 0 : 2))
  }
  later(5200, () => cycle(0))

  return () => {
    stopped = true
    timers.forEach((id) => window.clearTimeout(id))
    timers.clear()
    dash.reset()
  }
}

const RELOADS: ReloadOutcome[] = [
  { kind: 'swapped', counts: { mobs: 2, items: 9, blocks: 3 }, stages: ['validate', 'bake', 'swap'], unreadable: [] },
  {
    kind: 'refused',
    report: [
      'mobs/keep_warden.vellum',
      '  config.health: expected a number, got "lots"',
      'items/brass_lantern.vellum',
      '  texture "lantern_glow" is used by 2 faces but is not in the file',
    ].join('\n'),
    stages: ['validate'],
    unreadable: [],
  },
  {
    kind: 'error',
    status: 500,
    message: 'The server was interrupted while applying the reload.',
    url: 'https://play.demo.vellum.gg/api/reload',
  },
]

let reloads = 0

/** Demo stand-in for POST /api/reload: after 3.2 s it swaps, refuses and fails in turn. */
export function demoReload(signal?: AbortSignal): Promise<ReloadOutcome> {
  const outcome = RELOADS[reloads++ % RELOADS.length]
  return new Promise((resolve) => {
    const id = window.setTimeout(() => resolve(outcome), 3200)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id)
        resolve(outcome)
      },
      { once: true },
    )
  })
}
