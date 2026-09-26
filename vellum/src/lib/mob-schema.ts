/* ---------------------------------------------------------------
   The mob schema, served by the plugin.

   `GET /api/mob/schema` is the catalogue the runtime actually applies:
   the nine flags, the eight goals with their options, and the animation
   states. Reading it rather than keeping a copy is what makes drift
   impossible instead of something we agree to avoid - a flag the server
   stops applying stops appearing here, without anyone remembering to
   delete it.

   THE STATIC `SCHEMA` IN config.ts DOES NOT GO AWAY. It is the
   standalone shape, for the free tier that has no plugin to ask. This
   module replaces it only when a plugin is linked and answers.

   WHAT THIS DELIBERATELY DOES NOT DO IS GUESS. The server declares
   types this form has never drawn - `duration`, `clip`, `key` - and a
   type it cannot draw is reported, not approximated. Drawing a
   `duration` as a plain number would offer a control whose value the
   loader then refuses, which is worse than saying the field could not
   be rendered.
   --------------------------------------------------------------- */

import { useEffect, useState } from 'react'
import { loadLink } from './dash-api'
import type { Column, Field, Section } from './config'
import type { ProjectKind } from './model'

/* ---------------- what comes off the wire ---------------- */

/** Every type the catalogue may declare. Anything else is refused by name. */
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

/**
 * Ask the linked plugin for its catalogue.
 *
 * With no link there is nothing to ask, and that is not an error - it is
 * the standalone case, which is most of the free tier.
 */
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
    return { ok: false, reason: `Could not reach the plugin — ${(e as Error).message}` }
  }
}

/* ---------------- the wire into a form ---------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Tri-state, because a checkbox cannot say "inherit". */
const TRISTATE = ['', 'true', 'false'] as const

/**
 * One declared option as a field this form can draw, or a problem saying
 * why it cannot.
 *
 * `inherits` decides the control as much as the type does: a value with
 * no default must be able to say nothing at all, so it is a text field
 * where blank means inherit rather than a number spinner sitting on a
 * zero nobody chose.
 */
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
    return { where, message: `type "${opt.type}" is not one this form can draw — it has been left out rather than guessed at` }
  }

  switch (opt.type) {
    case 'boolean':
      /* Declared defaults exist for the flags, so a real checkbox is
         honest here - but only when the server states one. */
      return opt.inherits
        ? { ...base, kind: 'select', options: TRISTATE, fallback: '' }
        : { ...base, kind: 'bool', fallback: opt.default === true }

    case 'number':
    case 'duration':
      /* A duration accepts `8` and `8s` alike, so it is text either way;
         a number with no default has to be able to stay unsaid. */
      return opt.type === 'duration' || opt.inherits
        ? { ...base, kind: 'text', fallback: '', placeholder: opt.inherits ? 'inherit' : String(opt.default ?? '') }
        : { ...base, kind: 'number', step: 0.05, fallback: typeof opt.default === 'number' ? opt.default : undefined }

    case 'clip':
    case 'key':
    case 'string':
      return { ...base, kind: 'text', fallback: '', placeholder: opt.inherits ? 'inherit' : String(opt.default ?? '') }
  }
}

/**
 * The served catalogue as the sections the Config tab renders.
 *
 * Exported separately from the fetch so it can be tested against a
 * literal payload without a server.
 */
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
      help: 'The vanilla mob this one is built on. A Brain-driven base is refused by the server, because it would ignore every goal below.' },
    { key: 'display', label: 'Display name', kind: 'text', path: 'display-name', fallback: '',
      placeholder: '&5The Voidling', help: 'Colour codes with &.' },
    { key: 'model', label: 'Model', kind: 'text', path: 'model', fallback: '',
      placeholder: 'vellum:voidling', help: 'A resource key, not a number.' },
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
      `${goals?.priority?.help ?? `Priority runs ${pMin} to ${pMax}, lower first.`}` +
      (kinds.length ? ` The server implements ${kinds.length} goals.` : ''),
  }

  /* ---- the states: ONE list with a `plays` flag, not two lists ----
     Retired states are declared here on purpose, with the note that says
     where the clip should go instead. Rendering them as editable slots
     would offer a key the loader drops. */
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
      message: s.note ?? 'retired: accepted, warned about once, then dropped before the definition is built',
    })
  }

  const sections: Section[] = [
    { id: 'identity', title: 'Identity', blurb: 'What it is built on, what renders, and what a player sees above it.', fields: identity },
    { id: 'flags', title: 'Flags', blurb: `${flags.length} values read straight off the server’s catalogue.`, fields: flags },
    { id: 'ai', title: 'AI', blurb: `The goals the runtime implements, in priority order.`, fields: [goalField] },
    { id: 'animations', title: 'Animations', blurb: `${live.length} live states. Everything else plays through a goal.`, fields: animations },
  ].filter((s) => s.fields.length)

  return { ok: true, schema: raw as unknown as MobSchema, sections, problems }
}

/* ---------------- the hook the panel uses ---------------- */

export type SchemaSource =
  | { from: 'built-in'; sections: null; problems: SchemaProblem[]; reason: string }
  | { from: 'plugin'; sections: Section[]; problems: SchemaProblem[]; reason: null }
  | { from: 'asking'; sections: null; problems: []; reason: null }

/**
 * The served catalogue if a plugin answers, the built-in schema if not.
 *
 * Asked once per mount rather than polled: a catalogue that changes
 * under an author mid-edit would move controls beneath their hands, and
 * the reload that changes it is a deliberate act anyway.
 */
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
