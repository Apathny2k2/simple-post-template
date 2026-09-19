/* ---------------------------------------------------------------
   Who built this, what it is, and whether the half running on the
   server agrees.

   Vellum ships in two pieces: this studio, and a server plugin that
   feeds it and consumes what it exports. They move at different
   speeds, so "it stopped working" is nearly always a version gap -
   and the only place that could have said so used to read
   "0.4.1-mock".
   --------------------------------------------------------------- */

export const STUDIO_VERSION = '0.9.0'
export const RENDERER = 'Built in house'
export const AUTHOR = 'TakkyPvp / VeracityPvp'

/** The plugin build this studio was written against. */
export const PLUGIN_VERSION = '0.2a'

/** The oldest plugin this studio can still talk to. */
export const PLUGIN_MIN = '0.2a'

/**
 * A version here is dotted numbers with an optional trailing letter:
 * `0.2a` is newer than `0.2`, older than `0.2b`, older than `0.3`.
 * Anything unparseable sorts as older than everything, which is the
 * safe direction - it prompts an upgrade rather than a silent pass.
 */
export function parseVersion(raw: string): { parts: number[]; suffix: number } {
  const m = /^v?(\d+(?:\.\d+)*)\s*([a-z])?$/i.exec(raw.trim())
  if (!m) return { parts: [-1], suffix: 0 }
  return {
    parts: m[1].split('.').map(Number),
    suffix: m[2] ? m[2].toLowerCase().charCodeAt(0) - 96 : 0,
  }
}

/** -1, 0 or 1, the way a comparator is expected to answer. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a)
  const y = parseVersion(b)
  const n = Math.max(x.parts.length, y.parts.length)
  for (let i = 0; i < n; i++) {
    const d = (x.parts[i] ?? 0) - (y.parts[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return x.suffix === y.suffix ? 0 : x.suffix < y.suffix ? -1 : 1
}

export type VersionReport = {
  state: 'in-step' | 'plugin-behind' | 'studio-behind' | 'unreachable' | 'unlinked'
  /** what the plugin said it was, when it answered */
  plugin: string | null
  studio: string
  /** the oldest studio the plugin will talk to, when it says */
  studioMin: string | null
  detail: string
  checkedAt: number
}

/** What `GET {base}/plugin/version` is expected to answer with. */
type PluginVersionBody = {
  plugin?: unknown
  studioMin?: unknown
  api?: unknown
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Asks the linked plugin what it is. Every failure is a report rather
 * than a throw: an unreachable plugin is a thing the panel has to be
 * able to say, not an exception to swallow.
 */
export async function verifyPlugin(
  base: string | null,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VersionReport> {
  const now = Date.now()
  const at = (base ?? '').replace(/\/+$/, '')
  if (!at)
    return {
      state: 'unlinked',
      plugin: null,
      studio: STUDIO_VERSION,
      studioMin: null,
      detail: 'No plugin is linked. Link one on the dashboard to check versions.',
      checkedAt: now,
    }

  let body: PluginVersionBody
  try {
    const res = await fetchImpl(`${at}/plugin/version`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    body = (await res.json()) as PluginVersionBody
  } catch (err) {
    return {
      state: 'unreachable',
      plugin: null,
      studio: STUDIO_VERSION,
      studioMin: null,
      detail: `Could not reach ${at}/plugin/version — ${err instanceof Error ? err.message : 'no answer'}.`,
      checkedAt: now,
    }
  }

  const plugin = str(body.plugin)
  const studioMin = str(body.studioMin)
  if (!plugin)
    return {
      state: 'unreachable',
      plugin: null,
      studio: STUDIO_VERSION,
      studioMin,
      detail: 'The plugin answered without naming a version, so there is nothing to compare.',
      checkedAt: now,
    }

  if (compareVersions(plugin, PLUGIN_MIN) < 0)
    return {
      state: 'plugin-behind',
      plugin,
      studio: STUDIO_VERSION,
      studioMin,
      detail: `The plugin reports ${plugin}; this studio needs ${PLUGIN_MIN} or newer. Update the plugin on the server.`,
      checkedAt: now,
    }

  if (studioMin && compareVersions(STUDIO_VERSION, studioMin) < 0)
    return {
      state: 'studio-behind',
      plugin,
      studio: STUDIO_VERSION,
      studioMin,
      detail: `The plugin wants studio ${studioMin} or newer, and this one is ${STUDIO_VERSION}. Update Vellum.`,
      checkedAt: now,
    }

  return {
    state: 'in-step',
    plugin,
    studio: STUDIO_VERSION,
    studioMin,
    detail:
      compareVersions(plugin, PLUGIN_VERSION) > 0
        ? `The plugin is ${plugin}, ahead of the ${PLUGIN_VERSION} this studio was built against, and still compatible.`
        : `Plugin ${plugin} and studio ${STUDIO_VERSION} are compatible.`,
    checkedAt: now,
  }
}
