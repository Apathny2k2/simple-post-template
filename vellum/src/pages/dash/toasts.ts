import { useCallback, useEffect, useRef, useState } from 'react'
import { dashStore } from '../../lib/dash'
import type { IconName } from '../../lib/icons'

export type Toast = {
  id: number
  title: string
  body: string
  icon: IconName
  tone: 'info' | 'ok' | 'warn' | 'bad'
  leaving?: boolean
}

let seq = 0

/** At most three on screen. Each stays about four seconds. */
export function useToasts() {
  const [items, setItems] = useState<Toast[]>([])
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq
    setItems((list) => [...list.slice(-2), { ...t, id }])
    timers.current.push(
      window.setTimeout(() => setItems((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 4200),
      window.setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 4700),
    )
  }, [])

  return [items, push] as const
}

type Mark = {
  agent: string | null
  hash: string
  online: boolean
  correct: number
  wrong: number
  topFile: string | null
  lastLog: string | null
  fed: string[]
}

const markOf = (): Mark => ({
  agent: dashStore.meta.agent,
  hash: dashStore.snapshot.pack.hash,
  online: dashStore.snapshot.server.online,
  correct: dashStore.snapshot.players.correct,
  wrong: dashStore.snapshot.players.wrong,
  topFile: dashStore.snapshot.files[0]?.id ?? null,
  lastLog: dashStore.log[0]?.id ?? null,
  fed: dashStore.meta.fed,
})

/**
 * Turns changes in the store into toasts. A section's first report is not
 * news, so nothing fires until that section was already live.
 */
export function useDashToasts(push: (t: Omit<Toast, 'id'>) => void) {
  const version = dashStore.version
  const prev = useRef<Mark | null>(null)

  useEffect(() => {
    const was = prev.current
    const now = markOf()
    prev.current = now
    if (!was || !now.fed.length) return

    const { snapshot } = dashStore
    const liveBefore = (s: string) => was.fed.includes(s)

    if (!was.agent && now.agent) push({ title: 'Plugin connected', body: now.agent, icon: 'power', tone: 'ok' })

    if (liveBefore('pack') && was.hash !== now.hash) {
      const name = snapshot.pack.version ? `Build ${snapshot.pack.version}` : snapshot.pack.archive
      push({ title: 'New pack pushed', body: `${name}. Players are downloading it.`, icon: 'upload', tone: 'info' })
    }

    if (liveBefore('server') && was.online !== now.online) {
      push(
        now.online
          ? { title: 'Server is back', body: snapshot.server.status, icon: 'server', tone: 'ok' }
          : { title: 'Server went offline', body: snapshot.server.status, icon: 'server', tone: 'bad' },
      )
    }

    if (liveBefore('players') && was.wrong > 0 && now.wrong === 0 && now.correct > 0) {
      push({
        title: "Everyone's on the new pack",
        body: `${now.correct} of ${now.correct} players.`,
        icon: 'users',
        tone: 'ok',
      })
    }

    const top = snapshot.files[0]
    if (liveBefore('files') && top && now.topFile !== was.topFile) {
      push({ title: `${top.by} saved a file`, body: top.name, icon: 'save', tone: 'info' })
    }

    const rec = dashStore.log[0]
    if (rec && rec.id !== was.lastLog && !rec.ok) {
      push({ title: 'The plugin sent a bad request', body: rec.op, icon: 'bug', tone: 'bad' })
    }
  }, [version, push])
}
