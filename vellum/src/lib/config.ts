/* ---------------------------------------------------------------
   The configuration half.

   A `.vellum` says what something looks like and how it moves. None of
   that makes it a mob: a model with 400 health, an armour value, a
   faction, a boss bar and a skill on a timer is a boss, and not one of
   those is geometry. Modelling one here and then writing its stats
   somewhere else by hand is where the two drift apart - the model says
   `geyser_block` and the config says `geyserblock`, and nothing tells
   you.

   So the config is authored beside the model and written out of it.

   THIS IS OURS TO IMPLEMENT, NOT SOMEONE ELSE'S TO READ. Vellum
   replicates this behaviour in-house; there is no third-party plugin
   on the other end of it. That is not a naming detail - it decides who
   owns every default and every range in SCHEMA below. Nothing here can
   be justified with "that is what their docs say", because the
   behaviour is ours: if a field reads 0 to 1 it is because our runtime
   reads 0 to 1, and the plugin half has to implement it.

   The SHAPE is ours as well, and this is the part that changed. An
   earlier draft of this file borrowed another plugin's spelling -
   `Type`, `Health`, `BossBar`, `AIGoalSelectors`, `~onTimer` - on the
   grounds that operators already knew it. That was overturned: a
   borrowed spelling for a config only our own runtime reads buys
   familiarity and costs a permanent translation layer, and it implies
   a compatibility we do not have. The keys in SCHEMA are the ones the
   plugin's loader actually reads - `base`, `display-name`, `ai.goals`
   - not a second spelling of them. See the vocabularies note below.

   One description drives everything. A field is declared once, in
   SCHEMA below, and the form, the rules and the YAML all read the same
   declaration - which is why a key cannot appear in the editor and be
   missing from the export, or be spelled two ways.

   Where a field offers a vocabulary - entity types, AI selectors, bar
   colours - it carries it as suggestions rather than as a closed list,
   because a server with other plugins on it has more of them than we
   could know.
   --------------------------------------------------------------- */

import type { ProjectKind } from './model'

/* ---------------- the value ---------------- */

export type ConfigValue = string | number | boolean | string[] | Row[]
export type Row = Record<string, string>

/**
 * The config block, and it is NOT keyed by whatever the form calls a
 * field - it is the `mob.yml` entity body, verbatim.
 *
 * That is a deliberate change of shape. It used to hold the form's own
 * keys: `speed` where the runtime says `movement-speed`, `idle` and
 * `walk` at the top level where the runtime nests them under
 * `animations:`. Nobody could tell by looking whether a block was meant
 * to load, and `speed` is not an unknown key that fails quietly - it is
 * an ERROR, and one error holds back the content swap for every kind on
 * the server at once.
 *
 * So the block reads exactly as the file it becomes. What it does NOT
 * carry is `config-version`: that belongs to the FILE, beside the
 * collection key, and the writer adds it. This is the body, not the
 * document.
 */
export type Config = { [key: string]: ConfigValue | Config }

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
  /** where it lands in the YAML: `Options.MovementSpeed` nests */
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
  /** what the runtime does when the key is absent; an equal value is not written */
  fallback?: ConfigValue
}

export type Section = { id: string; title: string; blurb: string; fields: Field[] }

/* ---------------- vocabularies ----------------

   These are the plugin's, not MythicMobs'. The operator settled it:
   borrowing another plugin's spelling for a config only our own runtime
   reads buys familiarity and costs a permanent translation layer, plus
   it implies a compatibility we do not have.
   --------------------------------------------------------------- */

/**
 * The vanilla entity a custom mob is built on.
 *
 * Suggestions, not a closed list - but note that the server refuses a
 * base whose AI is Brain-driven, because such a mob would accept every
 * goal below and silently ignore all of them. It checks the live entity
 * registry at boot, so which ones those are is the server's answer and
 * not a list worth freezing here.
 */
export const BASES = [
  'ZOMBIE', 'SKELETON', 'WITHER_SKELETON', 'CREEPER', 'SPIDER', 'CAVE_SPIDER', 'ENDERMAN',
  'BLAZE', 'GHAST', 'SLIME', 'MAGMA_CUBE', 'WITCH', 'VINDICATOR', 'EVOKER', 'PILLAGER',
  'RAVAGER', 'PIGLIN', 'PIGLIN_BRUTE', 'HOGLIN', 'ZOGLIN', 'IRON_GOLEM', 'WOLF', 'CAT',
  'HORSE', 'BEE', 'BAT', 'ARMOR_STAND',
] as const

/** The eight goals the runtime implements. There is no ninth. */
export const GOALS = [
  'vellum:target_nearest', 'melee_attack', 'leap_at_target', 'circle_strafe',
  'flee', 'wander', 'guard_area', 'look_at_target',
] as const

/**
 * The animation states that are live.
 *
 * `attack` and `death` are Retired: accepted for compatibility, warned
 * about once and dropped before the definition is built. A clip that is
 * neither idle nor walk plays through a goal's own `animation` option.
 */
export const ANIMATION_STATES = ['idle', 'walk'] as const

/** Tri-state. Blank is not false - it is "say nothing and inherit". */
const TRISTATE = ['', 'true', 'false'] as const

/* ---------------- the schema ----------------

   WHERE THE DEFAULTS COME FROM. A `fallback` here means "equal to this
   is not written", so a wrong one silently drops a choice the user made
   on purpose. Only two are known from the runtime: `health` is 20, and
   `movement-speed` deliberately has NONE - unset must stay unset, so a
   bat-based mob and a golem-based mob each keep their own base speed.

   Everything else whose default we do not know is left able to say
   nothing at all: the numbers are text (blank = inherit) and the flags
   are tri-state rather than checkboxes. A checkbox cannot express
   "unset", and guessing that unset means false would write `false` over
   a server default of true.
   --------------------------------------------------------------- */

const flag = (key: string, label: string, help: string): Field => ({
  key, label, kind: 'select', path: key, options: TRISTATE, fallback: '', help,
})

const MOB_SECTIONS: Section[] = [
  {
    id: 'identity',
    title: 'Identity',
    blurb: 'What it is built on, what renders, and what a player sees above it.',
    fields: [
      { key: 'base', label: 'Base entity', kind: 'text', path: 'base', options: BASES,
        placeholder: 'ZOMBIE', fallback: '',
        help: 'The vanilla mob this one is built on - its hitbox, sounds and swimming come from here. A Brain-driven base is refused by the server, because it would ignore every goal below.' },
      { key: 'display', label: 'Display name', kind: 'text', path: 'display-name',
        placeholder: '&5The Voidling', fallback: '',
        help: 'Colour codes with &. Shown on the name plate.' },
      { key: 'model', label: 'Model', kind: 'text', path: 'model',
        placeholder: 'vellum:voidling', fallback: '',
        help: 'A resource key, not a number. This is what the rig is baked under.' },
    ],
  },
  {
    id: 'flags',
    title: 'Flags',
    blurb: 'Nine values read straight off the server\u2019s catalogue. Leave one blank to inherit it.',
    fields: [
      { key: 'health', label: 'Health', kind: 'number', path: 'health',
        min: 0.5, max: 1024, step: 0.5, fallback: 20,
        help: 'Half a heart to 1024. The default is 20, and writing 20 writes nothing.' },
      { key: 'speed', label: 'Movement speed', kind: 'text', path: 'movement-speed',
        placeholder: 'inherit', fallback: '',
        help: '0 to 2. Blank inherits the base entity\u2019s own speed, which is why this is not a slider - there is no default to slide away from.' },
      { key: 'scale', label: 'Scale', kind: 'text', path: 'scale',
        placeholder: 'inherit', fallback: '',
        help: '0.0625 to 16. Blank leaves it to the base entity.' },
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
    blurb: 'The eight goals the runtime implements, in priority order.',
    fields: [
      { key: 'goals', label: 'Goals', kind: 'rows', path: 'ai.goals',
        columns: [
          { key: 'goal', label: 'Goal', width: 3, suggest: GOALS },
          { key: 'priority', label: 'Priority', width: 1 },
          { key: 'animation', label: 'Animation', width: 2 },
        ],
        help: 'Priority runs 1 to 32, lower first. 0 is excluded on purpose, so no config can outrank a mob\u2019s ability to swim. Every goal but vellum:target_nearest can name a clip to play while it runs.' },
    ],
  },
  {
    id: 'animations',
    title: 'Animations',
    blurb: 'Only two states are live. Everything else plays through a goal.',
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
    blurb: 'What it is called, what it renders as, and how it stacks.',
    fields: [
      { key: 'display', label: 'Display name', kind: 'text', path: 'display-name',
        placeholder: '&bRunic Blade', fallback: '', help: 'Colour codes with &.' },
      { key: 'model', label: 'Model', kind: 'text', path: 'model',
        placeholder: 'vellum:runic_blade', fallback: '',
        help: 'A resource key naming the item definition, NOT a custom-model-data number. The number was the other plugin\u2019s idea and has no counterpart here.' },
      { key: 'lore', label: 'Lore', kind: 'list', path: 'lore',
        help: 'One line per entry, shown under the name.' },
      { key: 'stack', label: 'Max stack size', kind: 'text', path: 'max-stack-size',
        placeholder: 'inherit', fallback: '', help: 'Blank leaves it to the base item.' },
      { key: 'durability', label: 'Durability', kind: 'text', path: 'durability',
        placeholder: 'inherit', fallback: '', help: 'Blank leaves it to the base item.' },
    ],
  },
]

/** Blocks have no stat form; a block is a block. */
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

/**
 * The stored body with every unset field seeded, for the form to bind to.
 *
 * A shallow spread cannot do this once the block nests: `{...empty,
 * ...stored}` replaces the whole `animations` branch with the stored
 * one, so a model that set only `idle` would lose the seeded `walk`
 * beside it and the control would bind to undefined.
 */
export function withDefaults(kind: ProjectKind, config: Config | undefined): Config {
  let out = emptyConfig(kind)
  if (!config) return out
  for (const f of fieldsOf(kind)) {
    const v = getAt(config, f.path)
    if (v !== undefined) out = setAt(out, f.path, v)
  }
  return out
}

/**
 * Only the fields that say something, as the body they will be written
 * as. This is what goes in the `.vellum` and what goes in the YAML -
 * one shape, so the file cannot disagree with the preview.
 */
export function bodyOf(kind: ProjectKind, config: Config): Config {
  let out: Config = {}
  for (const f of setFields(kind, config)) {
    out = setAt(out, f.path, coerce(f, getAt(config, f.path) as ConfigValue))
  }
  return out
}

/** Only what differs from the fallback, which is all the runtime reads anyway. */
export function setFields(kind: ProjectKind, config: Config): Field[] {
  return fieldsOf(kind).filter((f) => written(f, getAt(config, f.path)))
}

function written(f: Field, v: ConfigValue | undefined): boolean {
  if (v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  /* A string has to be compared to its fallback like everything else.
     Checking only that it was non-empty meant a select sitting on its
     own default counted as set, so an untouched config wrote keys and
     the rules then fired on a mob nobody had started configuring.
     Every select in SCHEMA today falls back to '', which the emptiness
     check already catches, so the fallback comparison is a guard for
     the first field that defaults to a real value rather than a live
     case. It stays: that field is what the bug was. */
  if (typeof v === 'string') return v.trim().length > 0 && v !== f.fallback
  return v !== f.fallback
}

/* ---------------- YAML ---------------- */

type Tree = { [k: string]: Tree | string | number | boolean | string[] }

/** The runtime reads plain YAML, so this writes plain YAML and nothing clever. */
function scalar(v: string | number | boolean): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  const s = v.trim()
  /* Single quotes around anything YAML would read as something else -
     a colour code starts with &, which is an anchor in YAML, and an
     unquoted `&cBoss` is a parse error rather than a red boss. */
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

/**
 * A stored line back into the columns a form can edit.
 *
 * THE BLOCK HOLDS LINES, NOT ROWS, because `ai.goals` in a `mob.yml` is
 * a list of strings - `- melee_attack 2 slam` - and the whole point of
 * the canonical shape is that the block IS the body. The row is the
 * editing view of the line, so the parse lives here rather than the
 * storage bending to suit the form.
 *
 * Whitespace is a safe separator for exactly these columns: a goal is an
 * identifier, a priority is a number and an animation is a clip name.
 */
export function rowsOf(f: Field, value: ConfigValue | undefined): Row[] {
  if (!Array.isArray(value)) return []
  const cols = f.columns ?? []
  return value.map((entry) => {
    if (entry && typeof entry === 'object') return entry as Row
    const parts = String(entry).trim().split(/\s+/).filter(Boolean)
    const row: Row = {}
    cols.forEach((c, i) => { row[c.key] = parts[i] ?? '' })
    return row
  })
}

/** The editing view back to what the file holds. */
export const linesOf = (f: Field, rows: Row[]): string[] =>
  rows.map((r) => rowLine(f, r)).filter((l) => l.length > 0)

/**
 * The config as the runtime reads it, keyed by the model's own name
 * so that the file and the model cannot drift apart.
 */
/**
 * One value, as the file will hold it.
 *
 * A tri-state is stored as '', 'true' or 'false' because a checkbox
 * cannot say "unset" - but it has to reach the file as a real boolean.
 * `scalar` cannot do this for us and is right not to: an unquoted lore
 * line reading `no` would become a boolean too. The coercion belongs
 * where we know the FIELD, not where only the value is visible.
 */
function coerce(f: Field, v: ConfigValue): ConfigValue {
  if (f.kind === 'rows') return linesOf(f, rowsOf(f, v))
  if (f.kind === 'list') return (v as string[]).map((l) => l.trim()).filter(Boolean)
  if (f.kind === 'select' && f.options === TRISTATE) return v === 'true'
  /* A number typed into a text field because its default is "inherit":
     hold it as a number so the type is not left to YAML to guess. */
  if (f.kind === 'text' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return v
}

/**
 * The config as the runtime reads it, keyed by the model's own name.
 *
 * THE ROOT IS NOT THE ID. A content file accepts exactly two root keys -
 * `config-version` and that kind's collection key - and every other root
 * key is an error. And for a mob the collection key is `entities`, NOT
 * `mobs`: the directory is `mobs/`, the key is not.
 *
 * The body is `bodyOf()` and nothing else. Since the stored block is
 * already the body in the runtime's own vocabulary, there is no
 * translation step here to get wrong - which is the whole point of
 * storing it that way.
 */
export function toYaml(id: string, kind: ProjectKind, config: Config): string {
  const body = bodyOf(kind, config)
  const out: string[] = []
  emit({ 'config-version': 1, [collectionKey(kind)]: { [id]: body } } as Tree, '', out)
  return `# ${configPath(kind, id)} — written by Vellum\n${
    Object.keys(body).length ? out.join('\n') : `config-version: 1\n# Nothing set yet.`
  }\n`
}

/**
 * The root collection key for a kind. BOTH ARE NOW CONFIRMED against
 * the plugin's own `ContentLayout.Kind`, neither is inferred.
 *
 * A mob is `mobs/<id>/mob.yml` keyed `entities`; an item is
 * `items/<id>/item.yml` keyed `items`. So the two look like a rule with
 * an exception, and it is worth saying which way round: MOB is the only
 * kind whose collection key differs from its directory name. That is
 * exactly why `items` was refused rather than inferred from `items/` -
 * the one case where the directory would have been misleading is the
 * one case we already had, so the inference had a counterexample before
 * it had an instance.
 *
 * Getting this wrong is not a local error. A root key the parser does
 * not know fails validation, and the reload swaps content only when the
 * whole report is clean, so one file with the wrong key holds back
 * every mob, item and block on the server at once.
 */
export const MOB_KEY = 'entities'
export const ITEM_KEY = 'items'

/**
 * One entry per kind, or nothing. A kind we have no evidence for gets
 * `undefined` rather than a neighbour's answer - the previous version
 * of this returned the item key for anything that was not a mob, which
 * would have handed a block the root key `items` the moment blocks grew
 * a config, and written it into the export without a word.
 */
const LAYOUT: Partial<Record<ProjectKind, { dir: string; file: string; key: string }>> = {
  mobs: { dir: 'mobs', file: 'mob.yml', key: MOB_KEY },
  items: { dir: 'items', file: 'item.yml', key: ITEM_KEY },
}

export const collectionKey = (kind: ProjectKind): string => LAYOUT[kind]?.key ?? kind

/**
 * True where the plugin has told us the root key, and so we may safely
 * write the file. Mobs and items are confirmed against `ContentLayout`;
 * blocks are not, and stay out of the export until they are.
 */
export const keyConfirmed = (kind: ProjectKind): boolean => !!LAYOUT[kind]

/**
 * Where the file goes, relative to the plugin's data folder.
 *
 * ONE DIRECTORY PER THING, and the directory name IS the id - a
 * definition declaring a different key is refused by name. Discovery
 * walks for directories and then opens one fixed file name inside each;
 * it never lists `.yml` files in a kind directory. So a flat
 * `mobs/<id>.yml` is not a wrong path that errors, it is a path no
 * reader ever visits: copied to disk, never opened, never diagnosed.
 */
export function configPath(kind: ProjectKind, id: string): string {
  const at = LAYOUT[kind]
  /* No layout means no confirmed file name either, so this is only ever
     reached for a kind `keyConfirmed` has already held back. */
  return at ? `${at.dir}/${id}/${at.file}` : `${kind}/${id}/${kind}.yml`
}

/* ---------------- the upgrade off the old shape ---------------- */

/**
 * A pre-v7 config block, keyed by the FORM's field names, read into the
 * runtime's own vocabulary.
 *
 * Six of them differed and the rest were already right, which is what
 * made the old shape so easy to miss: a block could look perfectly
 * loadable and carry `speed`, which is not an unknown key that fails
 * quietly - it is an error, and one error holds back the content swap
 * for every kind on the server.
 *
 * Anything not in the schema is dropped rather than carried. There is
 * nowhere legitimate for it to go: the block IS the body now, and a key
 * the runtime does not know is the exact failure this change exists to
 * prevent.
 */
export function canonicalise(kind: ProjectKind, flat: Record<string, unknown>): Config {
  let out: Config = {}
  for (const f of fieldsOf(kind)) {
    const v = flat[f.key]
    if (v === undefined) continue
    /* Through `coerce`, so an old rows value becomes the LINES the file
       holds rather than staying the shape the form happened to use. */
    out = setAt(out, f.path, coerce(f, v as ConfigValue))
  }
  return out
}

/** True where a block is still keyed the way the form was, not the runtime. */
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

/**
 * What would not work on a server, checked here rather than found when
 * the plugin refuses to load the file.
 */
export function validateConfig(
  id: string,
  kind: ProjectKind | undefined,
  config: Config | undefined,
): ConfigIssue[] {
  if (!kind || !config || !hasConfig(kind)) return []
  const out: ConfigIssue[] = []
  /* Read by PATH, because the block is keyed the way the runtime is. */
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
    out.push({ level: 'error', message: `"${id}" cannot be an id - letters, digits and underscores only` })
  }

  /** A blank stays blank: the runtime inherits it. Only a typed value is checked. */
  const range = (key: string, label: string, lo: number, hi: number) => {
    const raw = str(key)
    if (!raw) return
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      out.push({ level: 'error', message: `${label} is "${raw}", which is not a number` })
    } else if (n < lo || n > hi) {
      out.push({ level: 'error', message: `${label} is ${n}; the runtime accepts ${lo} to ${hi}` })
    }
  }

  if (kind === 'mobs') {
    if (!str('base')) {
      out.push({ level: 'error', message: 'No base entity: there is nothing to build this mob on' })
    }

    const hp = Number(at('health') ?? 20)
    if (Number.isFinite(hp) && (hp < 0.5 || hp > 1024)) {
      out.push({ level: 'error', message: `Health is ${hp}; the runtime accepts 0.5 to 1024` })
    }
    range('speed', 'Movement speed', 0, 2)
    range('scale', 'Scale', 0.0625, 16)

    /* The goals are a closed list - there are eight and no ninth - so an
       unknown one is an error rather than a suggestion. It matters more
       than it looks: an unrecognised key is recorded as an ERROR on the
       server, and the content swap only happens when the whole report
       is clean, so one bad mob holds back every item and block on it. */
    const goals = rows('goals')
    const seen = new Set<string>()
    for (const r of goals) {
      const g = (r.goal ?? '').trim()
      if (!g) continue
      if (!(GOALS as readonly string[]).includes(g)) {
        out.push({ level: 'error', message: `"${g}" is not a goal - the runtime implements ${GOALS.join(', ')}` })
      }
      if (seen.has(g)) out.push({ level: 'warning', message: `"${g}" is listed twice` })
      seen.add(g)

      const p = Number((r.priority ?? '').trim())
      if ((r.priority ?? '').trim()) {
        if (!Number.isInteger(p) || p < 1 || p > 32) {
          out.push({
            level: 'error',
            message: p === 0
              ? 'A priority of 0 is excluded on purpose, so no config can outrank a mob\u2019s ability to swim - 1 is the highest'
              : `A priority of ${r.priority}: priorities run 1 to 32, lower first`,
          })
        }
      }

      if (g === 'vellum:target_nearest' && (r.animation ?? '').trim()) {
        out.push({
          level: 'warning',
          message: 'vellum:target_nearest is the one goal that carries no animation - the clip here is ignored',
        })
      }
    }

    if (goals.length && !seen.has('vellum:target_nearest')) {
      out.push({
        level: 'warning',
        message: 'Goals but no vellum:target_nearest: it will decide how to fight and never decide whom',
      })
    }

    for (const state of ['idle', 'walk'] as const) {
      const clip = str(state)
      if (clip && /^(attack|death)$/i.test(clip)) {
        out.push({
          level: 'warning',
          message: `"${clip}" as the ${state} clip looks like a retired state - attack and death are accepted and then dropped; a goal\u2019s own animation is how a clip like that plays`,
        })
      }
    }
  }

  if (kind === 'items') {
    const model = str('model')
    if (model && /^[0-9]+$/.test(model)) {
      out.push({
        level: 'error',
        message: `A model of "${model}": this is a resource key like vellum:${id}, not a custom-model-data number`,
      })
    }
    range('stack', 'Max stack size', 1, 99)
    range('durability', 'Durability', 1, 32767)
  }

  return out
}
