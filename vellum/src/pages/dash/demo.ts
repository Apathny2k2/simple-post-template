import { dash } from '../../lib/dash-api'
import type { ReloadOutcome } from '../../lib/reload'

const via = 'ui' as const
const NAMES = ['kite', 'nine', 'aurelia', 'juno', 'pike', 'moss', 'wren', 'ash', 'bram', 'ivy', 'quill', 'sable', 'tove', 'orrin', 'lark', 'fen']
const SAVES = ['ember_hound.vellum', 'tide_crawler.vellum', 'brass_golem.vellum', 'moth_king.vellum']
const hashOf = (build: number) => `sha1:${(Math.imul(build + 101, 2654435761) >>> 0).toString(16).padStart(8, '0')}`

/** A pretend server feeding the Dash through the plugin API. The returned stop function restores the sample. */
export function startDemo(): () => void {
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
  dash.snapshot(
    {
      server: { name: 'Demo SMP', host: 'play.demo.vellum.gg', ip: '127.0.0.1', status: 'Online', online: true, breakdown: breakdown() },
      pack: { archive: 'demo-pack.zip', bytes: 18_874_368, hash: hashOf(build), pushedAt: minutes(180), version: `1.${build}` },
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
      dash.pack({ archive: 'demo-pack.zip', bytes: 18_874_368 + build * 40_960, hash: hashOf(build), version: `1.${build}`, pushedAt: Date.now() }, via)
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
