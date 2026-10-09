/* Mob and item config, written beside the model and exported as YAML.

   Each field is declared once in SCHEMA, and the form, the checks and the
   YAML all read that declaration, so a key can't show in one and be
   missing from another. The keys and ranges are Vellum's own (base,
   display-name, ai.goals). They came from the original plugin's loader
   and haven't been checked against the rewritten plugin yet.

   Vocabularies such as entity types are suggestions, because a server
   with other plugins installed has more of them than Vellum can know. */

import type { ProjectKind } from './model'

/* ---------------- the value ---------------- */

export type ConfigValue = string | number | boolean | string[] | Row[]
export type Row = Record<string, string>

/** One entry's body in `mob.yml` or `item.yml`, nested by field path. */
export type Config ={ [key: string]: ConfigValue | Config }

/* ---------------- reading and writing by path ---------------- */

const isBranch = (v: unknown): v is Config =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** The value at a dotted path, or undefined if any step is missing. */
export function getAt(config: Config | undefined, path: string): ConfigValue | undefined {
  let at: unknown = config
  for (const part of path.split('.')) {
    if (!isBranch(at)) return undefined
    at = (at as Config)[part]
  }
  return isBranch(at) ? undefined : (at as ConfigValue | undefined)
}

/** A copy with `path` set. Branches are created as needed. */
export function setAt(config: Config, path: string, value: ConfigValue): Config {
  const parts = path.split('.')
  const out: Config = { ...config }
  let at = out
  for (let i = 0; i < parts.length - 1; i++) {
    const next = at[parts[i]]
    at[parts[i]] = isBranch(next) ? { ...next } : {}
    at = at[parts[i]] as Config
  }
  at[parts[parts.length - 1]] = value
  return out
}

/* ---------------- the description ---------------- */

export type FieldKind = 'text' | 'area' | 'number' | 'bool' | 'select' | 'list' | 'rows'

export type Column = { key: string; label: string; width?: number; suggest?: readonly string[] }

export type Field = {
  key: string
  label: string
  kind: FieldKind
  /** where it lands in the YAML; a dot nests, as in `animations.idle` */
  path: string
  help?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  /** a closed list for `select`, or suggestions for `text` and `list` */
  options?: readonly string[]
  /** columns for `rows` */
  columns?: readonly Column[]
  /** what the runtime uses when the key is absent; an equal value is not written */
  fallback?: ConfigValue
}

export type Section = { id: string; title: string; blurb: string; fields: Field[] }

/* Vocabularies, in Vellum's own spelling. */

/** Suggestions for `base`. The original plugin rejected Brain-driven bases at boot, so this list isn't filtered. */
export const BASES = [
  'ZOMBIE', 'SKELETON', 'WITHER_SKELETON', 'CREEPER', 'SPIDER', 'CAVE_SPIDER', 'ENDERMAN',
  'BLAZE', 'GHAST', 'SLIME', 'MAGMA_CUBE', 'WITCH', 'VINDICATOR', 'EVOKER', 'PILLAGER',
  'RAVAGER', 'PIGLIN', 'PIGLIN_BRUTE', 'HOGLIN', 'ZOGLIN', 'IRON_GOLEM', 'WOLF', 'CAT',
  'HORSE', 'BEE', 'BAT', 'ARMOR_STAND',
] as const

/** The goals the original plugin implemented. */
export const GOALS = [
  'vellum:target_nearest', 'melee_attack', 'leap_at_target', 'circle_strafe',
  'flee', 'wander', 'guard_area', 'look_at_target',
] as const

/** The states a mob config binds clips to. The original plugin dropped `attack` and `death`. */
export const ANIMATION_STATES = ['idle', 'walk'] as const

/** Blank means unset: nothing is written and the base mob's value applies. */
const TRISTATE =['', 'true', 'false'] as const

/* ---------------- the schema ---------------- */

/* A value equal to `fallback` is not written, so a fallback must be the
   runtime's own default. Only `health` has a known default (20), so other
   numbers are text fields and flags are tri-state, where blank inherits. */

const flag = (key: string, label: string, help: string): Field => ({
  key, label, kind: 'select', path: key, options: TRISTATE, fallback: '', help,
})

const MOB_SECTIONS: Section[] = [
  {
    id: 'identity',
    title: 'Identity',
    blurb: 'The base mob, the model and the name shown above it.',
    fields: [
      { key: 'base', label: 'Base entity', kind: 'text', path: 'base', options: BASES,
        placeholder: 'ZOMBIE', fallback: '',
        help: 'The vanilla mob it\u2019s built on. Hitbox, sounds and swimming come from here. The server refuses Brain-based mobs because they ignore goals.' },
      { key: 'display', label: 'Display name', kind: 'text', path: 'display-name',
        placeholder: '&5The Voidling', fallback: '',
        help: 'Colour codes with &. Shown on the name plate.' },
      { key: 'model', label: 'Model', kind: 'text', path: 'model',
        placeholder: 'vellum:voidling', fallback: '',
        help: 'A resource key such as vellum:voidling. Not a number. The plugin saves the rig under this key.' },
    ],
  },
  {
    id: 'flags',
    title: 'Flags',
    blurb: '9 values. Leave one blank to use the base mob\u2019s value.',
    fields: [
      { key: 'health', label: 'Health', kind: 'number', path: 'health',
        min: 0.5, max: 1024, step: 0.5, fallback: 20,
        help: '0.5 to 1024. Default 20, so 20 isn\u2019t written to the file.' },
      { key: 'speed', label: 'Movement speed', kind: 'text', path: 'movement-speed',
        placeholder: 'inherit', fallback: '',
        help: '0 to 2. Leave blank to use the base mob\u2019s speed.' },
      { key: 'scale', label: 'Scale', kind: 'text', path: 'scale',
        placeholder: 'inherit', fallback: '',
        help: '0.0625 to 16. Leave blank to use the base mob\u2019s scale.' },
      flag('gravity', 'Gravity', 'Blank inherits. false makes it hover.'),
      flag('invulnerable', 'Invulnerable', 'Blank inherits. true makes it immune to all damage.'),
      flag('silent', 'Silent', 'Blank inherits. true suppresses its vanilla sounds.'),
      flag('collides', 'Collides', 'Blank inherits. false lets entities walk through it.'),
      flag('saved', 'Saved', 'Blank inherits. false means it is gone when the chunk unloads.'),
      flag('despawns', 'Despawns', 'Blank inherits. false keeps it around away from players.'),
    ],
  },
  {
    id: 'ai',
    title: 'AI',
    blurb: 'The 8 goals the plugin supports, in priority order.',
    fields: [
      { key: 'goals', label: 'Goals', kind: 'rows', path: 'ai.goals',
        columns: [
          { key: 'goal', label: 'Goal', width: 3, suggest: GOALS },
          { key: 'priority', label: 'Priority', width: 1 },
          { key: 'animation', label: 'Animation', width: 2 },
        ],
        help: 'Priority is 1 to 32, lowest first. Swimming always comes first. Every goal except vellum:target_nearest can play a clip.' },
    ],
  },
  {
    id: 'animations',
    title: 'Animations',
    blurb: 'Only idle and walk are set here. Other clips play through a goal.',
    fields: [
      { key: 'idle', label: 'Idle clip', kind: 'text', path: 'animations.idle',
        placeholder: 'idle', fallback: '', help: 'The clip that plays when it is doing nothing else.' },
      { key: 'walk', label: 'Walk clip', kind: 'text', path: 'animations.walk',
        placeholder: 'walk', fallback: '', help: 'The clip that plays while it moves.' },
    ],
  },
]

const ITEM_SECTIONS: Section[] = [
  {
    id: 'identity',
    title: 'Identity',
    blurb: 'Its name, model, lore, stack size and durability.',
    fields: [
      { key: 'display', label: 'Display name', kind: 'text', path: 'display-name',
        placeholder: '&bRunic Blade', fallback: '', help: 'Colour codes with &.' },
      { key: 'model', label: 'Model', kind: 'text', path: 'model',
        placeholder: 'vellum:runic_blade', fallback: '',
        help: 'A resource key such as vellum:runic_blade. Not a custom-model-data number.' },
      { key: 'lore', label: 'Lore', kind: 'list', path: 'lore',
        help: 'One line per entry, shown under the name.' },
      { key: 'stack', label: 'Max stack size', kind: 'text', path: 'max-stack-size',
        placeholder: 'inherit', fallback: '', help: 'Blank leaves it to the base item.' },
      { key: 'durability', label: 'Durability', kind: 'text', path: 'durability',
        placeholder: 'inherit', fallback: '', help: 'Blank leaves it to the base item.' },
    ],
  },
]

/** Config sections per kind. Blocks have none. */
export const SCHEMA: Partial<Record<ProjectKind, Section[]>> = {
  mobs: MOB_SECTIONS,
  items: ITEM_SECTIONS,
}

export const hasConfig = (kind: ProjectKind | undefined) => !!kind && !!SCHEMA[kind]

export const fieldsOf = (kind: ProjectKind): Field[] =>
  (SCHEMA[kind] ?? []).flatMap((s) => s.fields)

/* ---------------- the value ---------------- */

export function emptyConfig(kind: ProjectKind): Config {
  let out: Config = {}
  for (const f of fieldsOf(kind)) {
    const seed =
      f.fallback ??
      (f.kind === 'list' || f.kind === 'rows' ? [] : f.kind === 'bool' ? false : f.kind === 'number' ? 0 : '')
    out = setAt(out, f.path, seed)
  }
  return out
}

/** The stored body with every unset field seeded, for the form to bind to. */
export function withDefaults(kind: ProjectKind, config: Config | undefined): Config {
  let out = emptyConfig(kind)
  if (!config) return out
  // per field path, since a shallow spread would replace a whole branch such as `animations`
  for (const f of fieldsOf(kind)) {
    const v = getAt(config, f.path)
    if (v !== undefined) out = setAt(out, f.path, v)
  }
  return out
}

/** The set fields as a body. Both the `.vellum` and the YAML are written from it. */
export function bodyOf(kind: ProjectKind, config: Config): Config {
  let out: Config = {}
  for (const f of setFields(kind, config)) {
    out = setAt(out, f.path, coerce(f, getAt(config, f.path) as ConfigValue))
  }
  return out
}

/** Fields whose value is non-empty and differs from the fallback. */
export function setFields(kind: ProjectKind, config: Config): Field[] {
  return fieldsOf(kind).filter((f) => written(f, getAt(config, f.path)))
}

function written(f: Field, v: ConfigValue | undefined): boolean {
  if (v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim().length > 0 && v !== f.fallback
  return v !== f.fallback
}

/* ---------------- YAML ---------------- */

type Tree = { [k: string]: Tree | string | number | boolean | string[] }

function scalar(v: string | number | boolean): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  const s = v.trim()
  /* Quote anything YAML would read as something else: a colour code such
     as `&cBoss` starts with &, which YAML takes for an anchor. */
  if (s === '' || /^[-?:,[\]{}#&*!|>'"%@`]/.test(s) || /:\s|\s#/.test(s) || /^(true|false|null|yes|no|on|off|~)$/i.test(s)) {
    return `'${s.replace(/'/g, "''")}'`
  }
  return s
}

function emit(tree: Tree, indent: string, out: string[]) {
  for (const [key, value] of Object.entries(tree)) {
    if (Array.isArray(value)) {
      if (!value.length) continue
      out.push(`${indent}${key}:`)
      for (const item of value) out.push(`${indent}  - ${scalar(item)}`)
    } else if (value !== null && typeof value === 'object') {
      const inner: string[] = []
      emit(value as Tree, `${indent}  `, inner)
      if (!inner.length) continue
      out.push(`${indent}${key}:`)
      out.push(...inner)
    } else {
      out.push(`${indent}${key}: ${scalar(value)}`)
    }
  }
}

/** A row becomes the space-separated line a list entry is written as. */
function rowLine(f: Field, row: Row): string {
  return (f.columns ?? [])
    .map((c) => (row[c.key] ?? '').trim())
    .filter((v) => v.length > 0)
    .join(' ')
}

/** Splits stored lines such as `melee_attack 2 slam` into rows the form can edit. */
export function rowsOf(f: Field, value: ConfigValue | undefined): Row[] {
  if (!Array.isArray(value)) return []
  const cols = f.columns ?? []
  return value.map((entry) => {
    if (entry && typeof entry === 'object') return entry as Row
    // split on whitespace; the form keeps spaces out of every cell
    const parts = String(entry).trim().split(/\s+/).filter(Boolean)
    const row: Row = {}
    cols.forEach((c, i) => { row[c.key] = parts[i] ?? '' })
    return row
  })
}

/** The editing view back to what the file holds. */
export const linesOf = (f: Field, rows: Row[]): string[] =>
  rows.map((r) => rowLine(f, r)).filter((l) => l.length > 0)

/** A switch that can be left blank. A served schema brings its own copy of the options. */
const isTristate = (f: Field) =>
  f.kind === 'select' && f.options?.length === TRISTATE.length && f.options.every((o, i) => o === TRISTATE[i])

/** One value as the file holds it. Tri-state strings become booleans here, where the field is known. */
function coerce(f: Field, v: ConfigValue): ConfigValue {
  if (f.kind === 'rows') return linesOf(f, rowsOf(f, v))
  if (f.kind === 'list') return (v as string[]).map((l) => l.trim()).filter(Boolean)
  // the form holds 'true', and a reopened .vellum holds true
  if (isTristate(f)) return v === true || v === 'true'
  // numbers sit in text fields so blank can inherit; a typed one is written as a number
  if (f.kind === 'text' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return v
}

/** The YAML file for one config, keyed by the model's name under the kind's collection key. */
export function toYaml(id: string, kind: ProjectKind, config: Config): string {
  const body = bodyOf(kind, config)
  const out: string[] = []
  // the original plugin's loader rejected any root key besides these two
  emit({ 'config-version': 1, [collectionKey(kind)]: { [id]: body } } as Tree, '', out)
  return `# ${configPath(kind, id)} — written by Vellum\n${
    Object.keys(body).length ? out.join('\n') : `config-version: 1\n# Nothing set yet.`
  }\n`
}

/** From the original plugin's `ContentLayout.Kind`. Mobs sit in `mobs/` but are keyed `entities`. */
export const MOB_KEY = 'entities'
export const ITEM_KEY = 'items'

/** Kinds whose file layout is confirmed. Blocks are not. */
const LAYOUT:Partial<Record<ProjectKind, { dir: string; file: string; key: string }>> = {
  mobs: { dir: 'mobs', file: 'mob.yml', key: MOB_KEY },
  items: { dir: 'items', file: 'item.yml', key: ITEM_KEY },
}

export const collectionKey = (kind: ProjectKind): string => LAYOUT[kind]?.key ?? kind

/** True when the kind's layout is known, so its config can be exported. */
export const keyConfirmed =(kind: ProjectKind): boolean => !!LAYOUT[kind]

/** Where the file goes, relative to the plugin's data folder. */
export function configPath(kind: ProjectKind, id: string): string {
  const at = LAYOUT[kind]
  /* One directory per id: the original plugin's loader opened
     `<dir>/<id>/<file>` and never read a flat `<id>.yml`. The fallback is
     a guess for kinds keyConfirmed keeps out of the export. */
  return at ? `${at.dir}/${id}/${at.file}` : `${kind}/${id}/${kind}.yml`
}

/* ---------------- the upgrade off the old shape ---------------- */

/** A pre-v7 block, keyed by form field names, moved to field paths. Keys outside the schema are dropped. */
export function canonicalise(kind: ProjectKind, flat: Record<string, unknown>): Config {
  let out: Config = {}
  for (const f of fieldsOf(kind)) {
    const v = flat[f.key] as ConfigValue | undefined
    // a blank switch stays unset; `coerce` would make it `false`
    if (!written(f, v)) continue
    // `coerce` turns old rows into lines and tri-state strings into booleans
    out = setAt(out, f.path, coerce(f, v as ConfigValue))
  }
  return out
}

/** True when a top-level key is a form field name that isn't also a path root. */
export function looksLegacy(kind: ProjectKind, raw: Record<string, unknown>): boolean {
  const paths = new Set(fieldsOf(kind).map((f) => f.path.split('.')[0]))
  const keys = new Set(fieldsOf(kind).map((f) => f.key))
  let legacy = 0
  for (const k of Object.keys(raw)) {
    if (!paths.has(k) && keys.has(k)) legacy++
  }
  return legacy > 0
}

/* ---------------- rules ---------------- */

export type ConfigIssue = { level: 'error' | 'warning'; message: string }

const ID_RULE = /^[A-Za-z0-9_]+$/

/** Errors and warnings for a config, found before the file reaches a server. */
export function validateConfig(
  id: string,
  kind: ProjectKind | undefined,
  config: Config | undefined,
): ConfigIssue[] {
  if (!kind || !config || !hasConfig(kind)) return []
  const out: ConfigIssue[] = []
  // the rules below name fields by key; the block is keyed by path
  const at = (key: string) => {
    const f = fieldsOf(kind).find((x) => x.key === key)
    return f ? getAt(config, f.path) : undefined
  }
  const str = (k: string) => String(at(k) ?? '').trim()
  const rows = (k: string) => {
    const f = fieldsOf(kind).find((x) => x.key === k)
    return f ? rowsOf(f, at(k)) : []
  }
  const touched = setFields(kind, config).length > 0
  if (!touched) return []

  if (!ID_RULE.test(id)) {
    out.push({ level: 'error', message: `"${id}" can\u2019t be an id. Use letters, digits and underscores only` })
  }

  // a blank inherits, so only a typed value is checked
  const range = (key: string, label: string, lo: number, hi: number) => {
    const raw = str(key)
    if (!raw) return
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      out.push({ level: 'error', message: `${label} is "${raw}", which is not a number` })
    } else if (n < lo || n > hi) {
      out.push({ level: 'error', message: `${label} is ${n}. The plugin accepts ${lo} to ${hi}` })
    }
  }

  if (kind === 'mobs') {
    if (!str('base')) {
      out.push({ level: 'error', message: 'No base entity: there is nothing to build this mob on' })
    }

    const hp = Number(at('health') ?? 20)
    if (Number.isFinite(hp) && (hp < 0.5 || hp > 1024)) {
      out.push({ level: 'error', message: `Health is ${hp}. The plugin accepts 0.5 to 1024` })
    }
    range('speed', 'Movement speed', 0, 2)
    range('scale', 'Scale', 0.0625, 16)

    /* Unknown goals are errors. The original plugin swapped content in only
       when no file had an error, so one bad goal held back everything. */
    const goals = rows('goals')
    const seen = new Set<string>()
    for (const r of goals) {
      const g = (r.goal ?? '').trim()
      if (!g) continue
      if (!(GOALS as readonly string[]).includes(g)) {
        out.push({ level: 'error', message: `"${g}" isn\u2019t a goal. Use one of ${GOALS.join(', ')}` })
      }
      if (seen.has(g)) out.push({ level: 'warning', message: `"${g}" is listed twice` })
      seen.add(g)

      const p = Number((r.priority ?? '').trim())
      if ((r.priority ?? '').trim()) {
        if (!Number.isInteger(p) || p < 1 || p > 32) {
          out.push({
            level: 'error',
            message: p === 0
              ? 'Priority 0 isn\u2019t allowed, so swimming always comes first. 1 is the highest'
              : `Priority ${r.priority} isn\u2019t valid. Use 1 to 32, where lower runs first`,
          })
        }
      }

      if (g === 'vellum:target_nearest' && (r.animation ?? '').trim()) {
        out.push({
          level: 'warning',
          message: 'vellum:target_nearest can\u2019t play a clip, so the clip here is ignored',
        })
      }
    }

    if (goals.length && !seen.has('vellum:target_nearest')) {
      out.push({
        level: 'warning',
        message: 'Goals but no vellum:target_nearest, so it won\u2019t pick a target',
      })
    }

    for (const state of ['idle', 'walk'] as const) {
      const clip = str(state)
      if (/\s/.test(clip)) {
        out.push({ level: 'error', message: `"${clip}" as the ${state} clip has a space in it, and clip names can\u2019t` })
      }
      if (clip && /^(attack|death)$/i.test(clip)) {
        out.push({
          level: 'warning',
          message: `"${clip}" as the ${state} clip looks like a retired state. Attack and death are accepted, then dropped. To play a clip like that, set it as a goal\u2019s animation`,
        })
      }
    }
  }

  if (kind === 'items') {
    const model = str('model')
    if (model && /^[0-9]+$/.test(model)) {
      out.push({
        level: 'error',
        message: `"${model}" looks like a custom-model-data number. Use a resource key such as vellum:${id}`,
      })
    }
    range('stack', 'Max stack size', 1, 99)
    range('durability', 'Durability', 1, 32767)
  }

  return out
}
