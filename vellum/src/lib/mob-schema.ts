/* The mob schema a linked plugin serves at `GET /api/mob/schema`, as
   Config tab sections. When no plugin answers, config.ts's static
   `SCHEMA` is used. */

import { useEffect, useState } from 'react'
import { loadLink } from './dash-api'
import type { Column, Field, Section } from './config'
import type { ProjectKind } from './model'

/* ---------------- what comes off the wire ---------------- */

/** Types the form can draw. Any other type is reported as a problem, by name. */
export const WIRE_TYPES = ['number', 'boolean', 'duration', 'clip', 'key', 'string'] as const
export type WireType = (typeof WIRE_TYPES)[number]

export type WireOption = {
  name: string
  type: WireType
  help?: string
  /** no default: leave whatever is there alone */
  inherits?: boolean
  default?: number | boolean | string
  min?: number
  max?: number
}

export type WireGoalKind = { key: string; help?: string; options?: WireOption[] }

export type WireState = {
  name: string
  /** false for a Retired state: accepted, warned about once, then dropped */
  plays: boolean
  note?: string
  resting?: boolean
}

export type MobSchema = {
  flags: WireOption[]
  retired?: string[]
  goals?: { priority?: { min?: number; max?: number; help?: string }; kinds?: WireGoalKind[] }
  states?: WireState[]
}

export type SchemaProblem = { where: string; message: string }

/* ---------------- fetching ---------------- */

export type SchemaResult =
  | { ok: true; schema: MobSchema; sections: Section[]; problems: SchemaProblem[] }
  | { ok: false; reason: string }

/** Fetch the linked plugin's catalogue. With no link, returns `ok: false` and the built-in schema stays. */
export async function fetchMobSchema(signal?: AbortSignal): Promise<SchemaResult> {
  const link = loadLink()
  if (!link?.baseUrl) return { ok: false, reason: 'No plugin is linked, so the built-in schema is in use.' }

  const base = link.baseUrl.replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/api/mob/schema`, {
      headers: link.token ? { Authorization: `Bearer ${link.token}` } : {},
      signal,
    })
    if (!res.ok) return { ok: false, reason: `The plugin answered ${res.status} ${res.statusText}.` }
    return readMobSchema(await res.json())
  } catch (e) {
    return { ok: false, reason: `Could not reach the plugin: ${(e as Error).message}` }
  }
}

/* ---------------- the wire into a form ---------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Tri-state, because a checkbox cannot say "inherit". */
const TRISTATE = ['', 'true', 'false'] as const

/* One declared option as a form field, or a problem when its type cannot
   be drawn. An `inherits` option gets a control that can stay blank. */
function fieldOf(opt: WireOption, path: string, where: string): Field | SchemaProblem {
  const base = {
    key: opt.name,
    label: opt.name.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    path,
    help: opt.help,
    min: opt.min,
    max: opt.max,
  }

  if (!(WIRE_TYPES as readonly string[]).includes(opt.type)) {
    return { where, message: `type "${opt.type}" isn’t one this form can show, so it was left out` }
  }

  switch (opt.type) {
    case 'boolean':
      // a checkbox has no blank state, so an `inherits` flag gets a three-way select
      return opt.inherits
        ? { ...base, kind: 'select', options: TRISTATE, fallback: '' }
        : { ...base, kind: 'bool', fallback: opt.default === true }

    case 'number':
    case 'duration':
      /* A duration takes `8` or `8s`, so it is a text field. So is an
         `inherits` number, which must be able to stay blank. */
      return opt.type === 'duration' || opt.inherits
        ? { ...base, kind: 'text', fallback: '', placeholder: opt.inherits ? 'inherit' : String(opt.default ?? '') }
        : { ...base, kind: 'number', step: 0.05, fallback: typeof opt.default === 'number' ? opt.default : undefined }

    case 'clip':
    case 'key':
    case 'string':
      return { ...base, kind: 'text', fallback: '', placeholder: opt.inherits ? 'inherit' : String(opt.default ?? '') }
  }
}

/** The served catalogue as the sections the Config tab renders. */
export function readMobSchema(raw: unknown): SchemaResult {
  if (!isObj(raw)) return { ok: false, reason: 'The plugin answered something that is not a schema.' }
  if (!Array.isArray(raw.flags)) return { ok: false, reason: 'The schema declares no `flags`.' }

  const problems: SchemaProblem[] = []
  const take = (v: Field | SchemaProblem, into: Field[]) => {
    if ('kind' in v) into.push(v)
    else problems.push(v)
  }

  /* ---- identity stays ours: the server does not declare it ---- */
  const identity: Field[] = [
    { key: 'base', label: 'Base entity', kind: 'text', path: 'base', fallback: '',
      placeholder: 'ZOMBIE',
      help: 'The vanilla mob it’s built on. The server refuses Brain-based mobs because they ignore goals.' },
    { key: 'display', label: 'Display name', kind: 'text', path: 'display-name', fallback: '',
      placeholder: '&5The Voidling', help: 'Colour codes with &.' },
    { key: 'model', label: 'Model', kind: 'text', path: 'model', fallback: '',
      placeholder: 'vellum:voidling', help: 'A resource key such as vellum:voidling. Not a number.' },
  ]

  /* ---- the flags, exactly as declared ---- */
  const flags: Field[] = []
  for (const f of raw.flags as WireOption[]) {
    if (!isObj(f) || typeof f.name !== 'string') {
      problems.push({ where: 'flags', message: 'an entry with no name was skipped' })
      continue
    }
    take(fieldOf(f, f.name, `flag "${f.name}"`), flags)
  }

  /* ---- the goals ---- */
  const goals = isObj(raw.goals) ? (raw.goals as MobSchema['goals']) : undefined
  const kinds = (goals?.kinds ?? []).filter((k) => isObj(k) && typeof k.key === 'string')
  const pMin = goals?.priority?.min ?? 1
  const pMax = goals?.priority?.max ?? 32

  const columns: Column[] = [
    { key: 'goal', label: 'Goal', width: 3, suggest: kinds.map((k) => k.key) },
    { key: 'priority', label: 'Priority', width: 1 },
    { key: 'animation', label: 'Animation', width: 2 },
  ]
  const goalField: Field = {
    key: 'goals', label: 'Goals', kind: 'rows', path: 'ai.goals', columns,
    help:
      `${goals?.priority?.help ?? `Priority is ${pMin} to ${pMax}, lowest first.`}` +
      (kinds.length ? ` The server supports ${kinds.length} goals.` : ''),
  }

  /* ---- the states ----
     A retired state (`plays: false`) is reported with its note. An editable
     slot for it would offer a key the loader drops. */
  const states = (raw.states ?? []) as WireState[]
  const live = states.filter((s) => isObj(s) && s.plays)
  const retired = states.filter((s) => isObj(s) && !s.plays)

  const animations: Field[] = live.map((s) => ({
    key: s.name,
    label: `${s.name.replace(/^./, (c) => c.toUpperCase())} clip`,
    kind: 'text',
    path: `animations.${s.name}`,
    fallback: '',
    placeholder: s.name,
    help: s.note,
  }))
  for (const s of retired) {
    problems.push({
      where: `state "${s.name}"`,
      message: s.note ?? 'retired. The server accepts it, warns once, then ignores it',
    })
  }

  const sections: Section[] = [
    { id: 'identity', title: 'Identity', blurb: 'The base mob, the model and the name shown above it.', fields: identity },
    { id: 'flags', title: 'Flags', blurb: `${flags.length} values from the linked plugin.`, fields: flags },
    { id: 'ai', title: 'AI', blurb: `The goals the plugin supports, in priority order.`, fields: [goalField] },
    { id: 'animations', title: 'Animations', blurb: `${live.length} states are set here. Other clips play through a goal.`, fields: animations },
  ].filter((s) => s.fields.length)

  return { ok: true, schema: raw as unknown as MobSchema, sections, problems }
}

/* ---------------- the hook the panel uses ---------------- */

export type SchemaSource =
  | { from: 'built-in'; sections: null; problems: SchemaProblem[]; reason: string }
  | { from: 'plugin'; sections: Section[]; problems: SchemaProblem[]; reason: null }
  | { from: 'asking'; sections: null; problems: []; reason: null }

/** The plugin's catalogue if it answers, else the built-in schema. Not polled, so fields stay put mid-edit. */
export function useMobSchema(kind: ProjectKind): SchemaSource {
  const [state, setState] = useState<SchemaSource>({ from: 'asking', sections: null, problems: [], reason: null })

  useEffect(() => {
    if (kind !== 'mobs') {
      setState({ from: 'built-in', sections: null, problems: [], reason: 'Only a mob has a served catalogue.' })
      return
    }
    const stop = new AbortController()
    let live = true
    void fetchMobSchema(stop.signal).then((r) => {
      if (!live) return
      setState(
        r.ok
          ? { from: 'plugin', sections: r.sections, problems: r.problems, reason: null }
          : { from: 'built-in', sections: null, problems: [], reason: r.reason },
      )
    })
    return () => {
      live = false
      stop.abort()
    }
  }, [kind])

  return state
}
