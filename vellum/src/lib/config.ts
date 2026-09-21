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

   The SHAPE deliberately follows the MythicMobs convention - `Type`,
   `Health`, `BossBar`, `AIGoalSelectors`, skill lines with `~onTimer`.
   Server operators already know that vocabulary and a config they can
   read on sight is worth more than one we invented. Borrowing the
   spelling is not the same as borrowing the reader.

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
export type Config = Record<string, ConfigValue>

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
  const out: Config = {}
  for (const f of fieldsOf(kind)) {
    out[f.key] = f.fallback ?? (f.kind === 'list' || f.kind === 'rows' ? [] : f.kind === 'bool' ? false : f.kind === 'number' ? 0 : '')
  }
  return out
}

/** Only what differs from the fallback, which is all the runtime reads anyway. */
export function setFields(kind: ProjectKind, config: Config): Field[] {
  return fieldsOf(kind).filter((f) => written(f, config[f.key]))
}

function written(f: Field, v: ConfigValue | undefined): boolean {
  if (v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  /* A string has to be compared to its fallback like everything else.
     Checking only that it was non-empty meant a select sitting on its
     own default - BossBar.Color: RED - counted as set, so an untouched
     config wrote two keys and the rules then fired on a mob nobody had
     started configuring. */
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
  const parts = (f.columns ?? [])
    .map((c) => (row[c.key] ?? '').trim())
    .filter((v) => v.length > 0)
  if (f.key === 'enchants') return parts.join(':')
  if (f.key === 'skills') {
    const [skill, trigger, chance] = parts
    return [skill, trigger, chance && `${chance}`].filter(Boolean).join(' ')
  }
  return parts.join(' ')
}

/**
 * The config as the runtime reads it, keyed by the model's own name
 * so that the file and the model cannot drift apart.
 */
export function toYaml(id: string, kind: ProjectKind, config: Config): string {
  const tree: Tree = {}
  const put = (path: string, value: string | number | boolean | string[]) => {
    const parts = path.split('.')
    let at: Tree = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const next = at[parts[i]]
      if (next === undefined || typeof next !== 'object' || Array.isArray(next)) at[parts[i]] = {}
      at = at[parts[i]] as Tree
    }
    at[parts[parts.length - 1]] = value
  }

  for (const f of setFields(kind, config)) {
    const v = config[f.key]
    if (f.kind === 'rows') {
      const lines = (v as Row[]).map((r) => rowLine(f, r)).filter((l) => l.length > 0)
      if (lines.length) put(f.path, lines)
      continue
    }
    if (f.kind === 'list') {
      const lines = (v as string[]).map((l) => l.trim()).filter(Boolean)
      if (lines.length) put(f.path, lines)
      continue
    }
    /* A tri-state is stored as '', 'true' or 'false' because a checkbox
       cannot say "unset". By the time it reaches the writer it has to be
       a real boolean, or `scalar` quotes it - and it is right to: an
       unquoted lore line reading `no` would become a boolean too. So the
       coercion belongs here, where we know the field, rather than there,
       where only the value is visible. */
    if (f.kind === 'select' && f.options === TRISTATE) {
      put(f.path, v === 'true')
      continue
    }
    /* Likewise a number typed into a text field because its default is
       "inherit": write it as a number so the type is not left to YAML. */
    if (f.kind === 'text' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      put(f.path, Number(v))
      continue
    }
    put(f.path, v as string | number | boolean)
  }

  /* THE ROOT IS NOT THE ID. A content file accepts exactly two root
     keys - `config-version` and that kind's collection key - and every
     other root key is an error. And for a mob the collection key is
     `entities`, NOT `mobs`: the directory is `mobs/`, the key is not.
     The directory moved at some point and the key did not. */
  const out: string[] = []
  emit({ 'config-version': 1, [collectionKey(kind)]: { [id]: tree } }, '', out)
  const body = out.join('\n')
  const caveat = keyConfirmed(kind)
    ? ''
    : `# NOTE: the root key "${collectionKey(kind)}" is not confirmed for this kind.\n` +
      `# A mob's directory is mobs/ but its key is "entities", so the directory\n` +
      `# name is not evidence. Check against the plugin before loading this.\n`
  return `# ${configPath(kind, id)} — written by Vellum\n${caveat}${
    hasBody(tree) ? body : `config-version: 1\n# Nothing set yet.`
  }\n`
}

const hasBody = (tree: Tree) => Object.keys(tree).length > 0

/**
 * The root collection key for a kind.
 *
 * `entities` for a mob is confirmed. `items` is NOT - it is inferred
 * from the directory name, and the mob case is the proof that the
 * inference is unsound: there the directory is `mobs/` and the key is
 * `entities`. Until the plugin confirms it, an item file is previewed
 * with the caveat on it and is not written into the export, because a
 * root key the parser does not know is an error that holds back the
 * content swap for every kind on the server at once.
 */
export const MOB_KEY = 'entities'
export const ITEM_KEY_UNCONFIRMED = 'items'
export const collectionKey = (kind: ProjectKind): string =>
  kind === 'mobs' ? MOB_KEY : ITEM_KEY_UNCONFIRMED

/** True where we know the root key, and so may safely write the file. */
export const keyConfirmed = (kind: ProjectKind): boolean => kind === 'mobs'

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
  return kind === 'mobs' ? `mobs/${id}/mob.yml` : `items/${id}/item.yml`
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
  const str = (k: string) => String(config[k] ?? '').trim()
  const rows = (k: string) => (Array.isArray(config[k]) ? (config[k] as Row[]) : [])
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

    const hp = Number(config.health ?? 20)
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
