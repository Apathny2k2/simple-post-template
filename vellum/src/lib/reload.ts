/* POST /api/reload asks the linked server to swap in what the last save baked.
     200 {reloaded: true,  counts, stages}   swapped
     200 {reloaded: false, report, stages}   refused, because validation found errors
     409  the coordinator refused
     504  still running; check the console
     500  interrupted mid-apply
   One bad file blocks the whole swap, so the report is passed on as written. */

import { loadLink } from './dash-api'

export type ReloadOutcome =
  /** The content set was swapped. */
  | { kind: 'swapped'; counts: Record<string, number>; stages: string[]; unreadable: string[] }
  /** The request succeeded and the server declined to swap. Render `report`. */
  | { kind: 'refused'; report: string; stages: string[]; unreadable: string[] }
  /** The request did not produce a verdict at all. */
  | { kind: 'error'; status: number | null; message: string; url: string | null }

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** `stages` has no fixed shape. Entries without a readable name go to `unreadable`. */
function readStages(raw: unknown): { stages: string[]; unreadable: string[] } {
  if (raw === undefined) return { stages: [], unreadable: [] }
  if (!Array.isArray(raw)) return { stages: [], unreadable: ['stages was not a list'] }

  const stages: string[] = []
  const unreadable: string[] = []
  raw.forEach((entry, i) => {
    if (typeof entry === 'string') {
      stages.push(entry)
      return
    }
    if (isObj(entry)) {
      const name = entry.name ?? entry.label ?? entry.id ?? entry.stage
      if (typeof name === 'string') {
        stages.push(name)
        return
      }
    }
    unreadable.push(`stage ${i} had no name we could read`)
  })
  return { stages, unreadable }
}

/** `counts` is the new content set's size per kind. Values that are not finite numbers go to `unreadable`. */
function readCounts(raw: unknown): { counts: Record<string, number>; unreadable: string[] } {
  if (raw === undefined) return { counts: {}, unreadable: [] }
  if (!isObj(raw)) return { counts: {}, unreadable: ['counts was not an object'] }

  const counts: Record<string, number> = {}
  const unreadable: string[] = []
  for (const [kind, n] of Object.entries(raw)) {
    if (typeof n === 'number' && Number.isFinite(n)) counts[kind] = n
    else unreadable.push(`counts.${kind} was not a number`)
  }
  return { counts, unreadable }
}

/** The body's `error` text, or a stock message for the status. */
function errorMessage(status: number, body: unknown): string {
  if (isObj(body) && typeof body.error === 'string' && body.error.trim()) return body.error
  if (status === 409) return 'The coordinator refused the reload.'
  if (status === 504) return 'The reload is still running. Check the server console.'
  if (status === 500) return 'The server was interrupted while applying the reload.'
  return `The plugin answered ${status}.`
}

/** Asks the linked server to reload. A 401 or 403 means the link is not tied to a Minecraft account. */
export async function requestReload(signal?: AbortSignal): Promise<ReloadOutcome> {
  const link = loadLink()
  if (!link?.baseUrl) {
    return { kind: 'error', status: null, url: null, message: 'No server is linked, so there is nothing to reload.' }
  }

  const base = link.baseUrl.replace(/\/+$/, '')
  const url = `${base}/api/reload`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: link.token ? { Authorization: `Bearer ${link.token}` } : {},
      signal,
    })
  } catch (e) {
    return { kind: 'error', status: null, url, message: `Could not reach the server (${(e as Error).message})` }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = undefined
  }

  if (!res.ok) return { kind: 'error', status: res.status, url, message: errorMessage(res.status, body) }

  if (!isObj(body) || typeof body.reloaded !== 'boolean') {
    return {
      kind: 'error',
      status: res.status,
      url,
      message: 'The server answered 200 without saying whether it reloaded.',
    }
  }

  const stage = readStages(body.stages)

  if (body.reloaded === false) {
    const report = typeof body.report === 'string' ? body.report : ''
    return {
      kind: 'refused',
      report,
      stages: stage.stages,
      unreadable: [...stage.unreadable, ...(report ? [] : ['the refusal carried no report'])],
    }
  }

  const count = readCounts(body.counts)
  return {
    kind: 'swapped',
    counts: count.counts,
    stages: stage.stages,
    unreadable: [...stage.unreadable, ...count.unreadable],
  }
}
