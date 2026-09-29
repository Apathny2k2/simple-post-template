/* Studio build info, and the check that the linked plugin can talk to this
   studio. The studio ships inside the plugin, so a gap usually means the
   server's plugin is older than the build this studio shipped in. */

export const STUDIO_VERSION = '0.9.0'
export const RENDERER = 'Built in house'
export const AUTHOR = 'TakkyPvp / VeracityPvp'

/** The plugin build this studio was written against. */
export const PLUGIN_VERSION = '0.2a'

/** The oldest plugin this studio can still talk to. */
export const PLUGIN_MIN = '0.2a'

/** Dotted numbers and an optional letter: 0.2 < 0.2a < 0.2b < 0.3. Unparseable input sorts oldest. */
export function parseVersion(raw: string): { parts: number[]; suffix: number } {
  const m = /^v?(\d+(?:\.\d+)*)\s*([a-z])?$/i.exec(raw.trim())
  if (!m) return { parts: [-1], suffix: 0 }
  return {
    parts: m[1].split('.').map(Number),
    suffix: m[2] ? m[2].toLowerCase().charCodeAt(0) - 96 : 0,
  }
}

/** -1, 0 or 1, like a sort comparator. */
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

/** Asks the linked plugin for its version. Network and HTTP failures come back as an `unreachable` report. */
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
      detail: 'Standalone (Free tier). Link a plugin on the Dash to check versions and use paid features.',
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
      detail: `Could not reach ${at}/plugin/version (${err instanceof Error ? err.message : 'no answer'}).`,
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
      detail: `The plugin reports ${plugin}, and this studio needs ${PLUGIN_MIN} or newer. The server's plugin is older than the build this studio shipped in. Update the plugin on the server.`,
      checkedAt: now,
    }

  if (studioMin && compareVersions(STUDIO_VERSION, studioMin) < 0)
    return {
      state: 'studio-behind',
      plugin,
      studio: STUDIO_VERSION,
      studioMin,
      detail: `The plugin needs studio ${studioMin} or newer. This studio is ${STUDIO_VERSION}. Update Vellum.`,
      checkedAt: now,
    }

  return {
    state: 'in-step',
    plugin,
    studio: STUDIO_VERSION,
    studioMin,
    detail:
      compareVersions(plugin, PLUGIN_VERSION) > 0
        ? `The plugin is ${plugin}, newer than the ${PLUGIN_VERSION} this studio was built for. They're still compatible.`
        : `Plugin ${plugin} and studio ${STUDIO_VERSION} are compatible.`,
    checkedAt: now,
  }
}
