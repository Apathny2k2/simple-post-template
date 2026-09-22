/* ---------------------------------------------------------------
   POST /api/reload - ask the linked server to swap its content set.

   A save bakes; a bake is not live until a reload swaps. Without this
   every author edit needs someone at a console.

   THE WHOLE DESIGN IS THAT THERE ARE THREE OUTCOMES, NOT TWO. The
   plugin answers 200 twice, meaning different things:

     200 {reloaded: true,  counts, stages}   swapped
     200 {reloaded: false, report, stages}   REFUSED, and this is the
                                             one that matters

   A refusal is a successful request that declined to swap, because the
   validation report had errors. It is not a network failure and it is
   not a spinner that never stops - if it renders as either, an author
   sits waiting for something that already finished. And the blast
   radius is the reason it has to be loud: one malformed mob file
   blocks the swap for every item, block and furniture piece on the
   server, so the report names the file and the key and is written for
   a person to read. We render it verbatim rather than summarising it.

   The error statuses are their own third outcome:

     409  the coordinator refused
     504  reload still running; check console
     500  interrupted mid-apply
   --------------------------------------------------------------- */

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

/**
 * `stages` has no declared shape yet, so it is read rather than assumed.
 *
 * A stage we can name becomes a line; anything else is counted and
 * reported as unreadable rather than stringified into `[object Object]`,
 * which would read like a stage that ran and did nothing.
 */
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

/** `counts` is the new content set per kind. Non-numbers are dropped, not coerced. */
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

/** The message an error status carries, without inventing one it did not send. */
function errorMessage(status: number, body: unknown): string {
  if (isObj(body) && typeof body.error === 'string' && body.error.trim()) return body.error
  if (status === 409) return 'The coordinator refused the reload.'
  if (status === 504) return 'The reload is still running — check the server console.'
  if (status === 500) return 'The server was interrupted while applying the reload.'
  return `The plugin answered ${status}.`
}

/**
 * Ask the linked server to reload.
 *
 * Person-gated on the plugin's side: it needs a linked Minecraft
 * account, so a 401/403 here means the link is not a person, which the
 * caller shows as an error rather than a refusal - a refusal is a
 * verdict about content and this is a verdict about who is asking.
 */
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
    return { kind: 'error', status: null, url, message: `Could not reach the server — ${(e as Error).message}` }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = undefined
  }

  if (!res.ok) return { kind: 'error', status: res.status, url, message: errorMessage(res.status, body) }

  if (!isObj(body) || typeof body.reloaded !== 'boolean') {
    /* A 200 that does not say whether it swapped is not a success we can
       report. Saying "reloaded" here would be the exact failure this
       file exists to prevent. */
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
