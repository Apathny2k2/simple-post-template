import type { CSSProperties } from 'react'
import { formatBytes, formatWhen } from '../../lib/dash'
import type { PackBuild } from '../../lib/dash'

const SHOWN = 5

/** "+40.0 KB", "−1.2 MB", or nothing when the size did not change. */
function change(bytes: number) {
  if (!bytes) return null
  return `${bytes > 0 ? '+' : '−'}${formatBytes(Math.abs(bytes))}`
}

/** A short name for a build: its version, or the start of its hash. */
const nameOf = (b: PackBuild) => b.version ?? b.hash.replace(/^sha1:/, '').slice(0, 8)

/** The newest pack builds: when each went out, its size, and how many players had it. */
export function PackBuilds({ builds, now }: { builds: PackBuild[]; now: number }) {
  if (!builds.length) return <p className="builds__empty">No builds yet. The first pack the plugin reports shows here.</p>
  const shown = builds.slice(0, SHOWN)
  return (
    <div className="builds">
      <div className="table-scroll">
        <table className="table builds__table">
          <thead>
            <tr>
              <th scope="col">Build</th>
              <th scope="col">Went out</th>
              <th scope="col">Size</th>
              <th scope="col">Players on it</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b, i) => {
              const grew = builds[i + 1] ? change(b.bytes - builds[i + 1].bytes) : null
              const share = b.players && b.players.of ? b.players.on / b.players.of : 0
              return (
                <tr key={b.hash} data-current={i === 0 || undefined}>
                  <td>
                    <span className="builds__name mono">{nameOf(b)}</span>
                    {i === 0 ? <span className="builds__live">Live</span> : null}
                  </td>
                  <td className="mono">{formatWhen(b.pushedAt, now)}</td>
                  <td className="mono">
                    {formatBytes(b.bytes)}
                    {grew ? <span className="builds__change"> {grew}</span> : null}
                  </td>
                  <td>
                    {b.players ? (
                      <span className="builds__players">
                        <span className="builds__bar" style={{ '--share': share } as CSSProperties} aria-hidden="true" />
                        <span className="mono">
                          {b.players.on} of {b.players.of}
                        </span>
                      </span>
                    ) : (
                      <span className="builds__uncounted">Not counted yet</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 1 ? (
        <p className="builds__note">An older build shows its players as they stood when the next one went out.</p>
      ) : null}
    </div>
  )
}
