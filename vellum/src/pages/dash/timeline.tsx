import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../../lib/icons'
import type { IconName } from '../../lib/icons'
import { dashStore } from '../../lib/dash'
import type { IngestRecord } from '../../lib/dash'

const WINDOW_S = 90

const CHANNELS: { key: string; label: string; icon: IconName }[] = [
  { key: 'players', label: 'Players', icon: 'users' },
  { key: 'pack', label: 'Pack', icon: 'layers' },
  { key: 'files', label: 'Files', icon: 'file' },
  { key: 'server', label: 'Server', icon: 'server' },
  { key: 'beat', label: 'Heartbeat', icon: 'clock' },
]

function channelOf(op: string): string {
  if (op.includes('/heartbeat')) return 'beat'
  if (op.includes('/players')) return 'players'
  if (op.includes('/pack')) return 'pack'
  if (op.includes('/files')) return 'files'
  return 'server'
}

const TICKS = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
  at: (i / 6) * 100,
  label: i === 6 ? 'now' : `${WINDOW_S - i * 15}s`,
}))

/**
 * Every write from the plugin as a keyframe on its channel, sliding left
 * as it ages, the way the animator's timeline reads. The store only keeps
 * the last forty writes, so this keeps its own ninety seconds.
 */
export function Timeline({ now }: { now: number }) {
  const [events, setEvents] = useState<IngestRecord[]>(() => [...dashStore.log].reverse())

  useEffect(
    () =>
      dashStore.subscribe((e) => {
        if (e.type === 'ingest') {
          const cutoff = Date.now() - (WINDOW_S + 5) * 1000
          const record = e.record
          setEvents((list) => [...list.filter((r) => r.at > cutoff), record])
        } else if (e.type === 'meta' && !dashStore.log.length) {
          // the store was reset
          setEvents([])
        }
      }),
    [],
  )

  const shown = events.filter((r) => now - r.at <= (WINDOW_S + 2) * 1000)

  return (
    <div className="feed">
      <p className="vh">
        {shown.length} {shown.length === 1 ? 'report' : 'reports'} from the plugin in the last {WINDOW_S} seconds.
      </p>
      <ul className="feed__names" aria-hidden="true">
        {CHANNELS.map((ch) => (
          <li key={ch.key} data-channel={ch.key}>
            <Icon name={ch.icon} size={13} />
            <span>{ch.label}</span>
          </li>
        ))}
      </ul>

      <div className="feed__lanes" aria-hidden="true">
        <div className="feed__ruler">
          {TICKS.map((t) => (
            <span key={t.label} style={{ left: `${t.at}%` } as CSSProperties}>
              {t.label}
            </span>
          ))}
        </div>
        <ul className="feed__tracks">
          {CHANNELS.map((ch) => (
            <li key={ch.key} className="feed__track" data-channel={ch.key}>
              {shown
                .filter((r) => channelOf(r.op) === ch.key)
                .map((r) => {
                  const age = Math.max(0, (now - r.at) / 1000)
                  const x = 100 - (age / WINDOW_S) * 100
                  return (
                    <span key={r.id} className="feed__key" style={{ transform: `translateX(${x}%)` }}>
                      <i data-bad={!r.ok || undefined} title={`${r.op}${r.ok ? '' : ` (refused: ${r.problems[0] ?? ''})`}`} />
                    </span>
                  )
                })}
            </li>
          ))}
        </ul>
        <span className="feed__playhead" />
      </div>

      {shown.length ? null : <p className="feed__empty">No reports yet. Each one lands here as it arrives.</p>}
    </div>
  )
}
