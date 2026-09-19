/* ---------------------------------------------------------------
   The configuration half.

   A `.vellum` says what something looks like and how it moves. None of
   that makes it a mob: a model with 400 health, an armour value, a
   faction, a boss bar and a skill on a timer is a boss, and every one
   of those lives in a MythicMobs config rather than in any geometry.
   Modelling one here and then writing its config somewhere else by
   hand is where the two drift apart - the model says `geyser_block`
   and the config says `geyserblock`, and nothing tells you.

   So the config is authored beside the model and written out of it.

   One description drives everything. A field is declared once, in
   SCHEMA below, and the form, the rules and the YAML all read the same
   declaration - which is why a key cannot appear in the editor and be
   missing from the export, or be spelled two ways.

   The keys and their shapes follow MythicMobs' own documentation. Where
   it offers a vocabulary - entity types, AI selectors, bar colours -
   the field carries it as suggestions rather than as a closed list,
   because a server with other plugins on it has more of them than we
   could know.
   --------------------------------------------------------------- */

import type { ProjectKind } from './model'

/* ---------------- the value ---------------- */

export type ConfigValue = string | number | boolean | string[] | Row[]
export type Row = Record<string, string>
export type MythicConfig = Record<string, ConfigValue>

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
  /** what MythicMobs does when the key is absent; an equal value is not written */
  fallback?: ConfigValue
}

export type Section = { id: string; title: string; blurb: string; fields: Field[] }

/* ---------------- vocabularies ---------------- */

export const ENTITY_TYPES = [
  'ZOMBIE', 'SKELETON', 'WITHER_SKELETON', 'CREEPER', 'SPIDER', 'CAVE_SPIDER', 'ENDERMAN',
  'BLAZE', 'GHAST', 'SLIME', 'MAGMA_CUBE', 'WITCH', 'VINDICATOR', 'EVOKER', 'PILLAGER',
  'RAVAGER', 'PIGLIN', 'PIGLIN_BRUTE', 'HOGLIN', 'ZOGLIN', 'WARDEN', 'IRON_GOLEM',
  'VILLAGER', 'WOLF', 'CAT', 'HORSE', 'BEE', 'ALLAY', 'ARMOR_STAND', 'WITHER', 'ENDER_DRAGON',
] as const

export const BAR_COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'PINK', 'WHITE'] as const

export const BAR_STYLES = [
  'SOLID', 'SEGMENTED_6', 'SEGMENTED_10', 'SEGMENTED_12', 'SEGMENTED_20',
] as const

export const AI_GOALS = [
  'clear', 'meleeattack', 'randomstroll', 'lookatplayers', 'lookatentity', 'randomlookaround',
  'opendoors', 'floatinwater', 'breakdoors', 'eatgrass', 'fleegolems', 'gotoowner',
  'bowmaster', 'rangedattack', 'spiderattack', 'skeletonbowattack', 'leapattarget',
] as const

export const AI_TARGETS = [
  'clear', 'players', 'nearestplayer', 'attacker', 'owner', 'monsters', 'villagers',
  'otherfactions', 'specificfaction', 'nearestcreeper', 'golems', 'anyentity',
] as const

export const TRIGGERS = [
  '~onTimer:100', '~onSpawn', '~onDeath', '~onDamaged', '~onAttack', '~onInteract',
  '~onCombat', '~onKillPlayer', '~onPlayerKill', '~onSignal', '~onUse', '~onDrop',
] as const

export const DAMAGE_CAUSES = [
  'FIRE', 'FIRE_TICK', 'LAVA', 'DROWNING', 'FALL', 'EXPLOSION', 'PROJECTILE', 'MAGIC',
  'POISON', 'WITHER', 'FALLING_BLOCK', 'THORNS', 'LIGHTNING', 'ENTITY_ATTACK',
] as const

export const EQUIP_SLOTS = ['HEAD', 'CHEST', 'LEGS', 'FEET', 'HAND', 'OFFHAND'] as const

export const MATERIALS = [
  'DIAMOND_SWORD', 'NETHERITE_SWORD', 'IRON_SWORD', 'STONE_SWORD', 'WOODEN_SWORD',
  'DIAMOND_AXE', 'DIAMOND_PICKAXE', 'DIAMOND_SHOVEL', 'DIAMOND_HOE', 'BOW', 'CROSSBOW',
  'TRIDENT', 'SHIELD', 'POTION', 'SPLASH_POTION', 'BREAD', 'GOLDEN_APPLE', 'COOKED_BEEF',
  'STICK', 'BLAZE_ROD', 'PAPER', 'DIAMOND_HELMET', 'DIAMOND_CHESTPLATE', 'DIAMOND_LEGGINGS',
  'DIAMOND_BOOTS', 'PLAYER_HEAD', 'STONE', 'MAGMA_BLOCK',
] as const

export const ENCHANTS = [
  'SHARPNESS', 'SMITE', 'BANE_OF_ARTHROPODS', 'KNOCKBACK', 'FIRE_ASPECT', 'LOOTING',
  'SWEEPING', 'EFFICIENCY', 'SILK_TOUCH', 'UNBREAKING', 'FORTUNE', 'POWER', 'PUNCH',
  'FLAME', 'INFINITY', 'PROTECTION', 'FIRE_PROTECTION', 'BLAST_PROTECTION',
  'PROJECTILE_PROTECTION', 'THORNS', 'DEPTH_STRIDER', 'MENDING', 'VANISHING_CURSE',
] as const

export const ATTRIBUTE_SLOTS = ['MainHand', 'OffHand', 'Head', 'Chest', 'Legs', 'Feet', 'All'] as const

export const ATTRIBUTES = [
  'Damage', 'AttackSpeed', 'Health', 'MovementSpeed', 'Armor', 'ArmorToughness',
  'KnockbackResistance', 'Luck', 'FollowRange',
] as const

/* ---------------- the schema ---------------- */

const MOB_SECTIONS: Section[] = [
  {
    id: 'identity',
    title: 'Identity',
    blurb: 'What it is built on, and what a player sees above it.',
    fields: [
      { key: 'type', label: 'Base entity', kind: 'text', path: 'Type', options: ENTITY_TYPES,
        placeholder: 'ZOMBIE', fallback: '',
        help: 'The vanilla mob MythicMobs starts from. Its AI, hitbox and sounds come from here.' },
      { key: 'display', label: 'Display name', kind: 'text', path: 'Display',
        placeholder: '&cThe Warden', fallback: '',
        help: 'Colour codes with &. Shown on the name plate and, by default, on the boss bar.' },
      { key: 'faction', label: 'Faction', kind: 'text', path: 'Faction', fallback: '',
        help: 'Groups mobs so they can be targeted - or spared - as a side.' },
      { key: 'mount', label: 'Mount', kind: 'text', path: 'Mount', fallback: '',
        help: 'Another MythicMob this one rides in on.' },
    ],
  },
  {
    id: 'stats',
    title: 'Stats',
    blurb: 'The numbers that decide how long a fight lasts.',
    fields: [
      { key: 'health', label: 'Health', kind: 'number', path: 'Health', min: 1, step: 1, fallback: 20 },
      { key: 'damage', label: 'Damage', kind: 'number', path: 'Damage', min: 0, step: 0.5, fallback: 0,
        help: 'In half-hearts, before armour.' },
      { key: 'armor', label: 'Armour', kind: 'number', path: 'Armor', min: 0, max: 30, step: 1, fallback: 0 },
      { key: 'speed', label: 'Movement speed', kind: 'number', path: 'Options.MovementSpeed',
        min: 0, max: 2, step: 0.01, fallback: 0.2, help: 'Vanilla walking speed is 0.2.' },
      { key: 'follow', label: 'Follow range', kind: 'number', path: 'Options.FollowRange',
        min: 0, max: 128, step: 1, fallback: 16, help: 'Blocks. How far it notices a target.' },
      { key: 'knockback', label: 'Knockback resistance', kind: 'number',
        path: 'Options.KnockbackResistance', min: 0, max: 1, step: 0.05, fallback: 0 },
      { key: 'scale', label: 'Scale', kind: 'number', path: 'Options.Scale', min: 0.1, max: 16, step: 0.1,
        fallback: 1, help: 'Multiplies the hitbox as well as the model.' },
    ],
  },
  {
    id: 'options',
    title: 'Options',
    blurb: 'The switches that decide how it behaves outside a fight.',
    fields: [
      { key: 'despawn', label: 'Despawn', kind: 'bool', path: 'Options.Despawn', fallback: true,
        help: 'Off keeps a boss in the world when the last player walks away.' },
      { key: 'showName', label: 'Always show name', kind: 'bool', path: 'Options.AlwaysShowName', fallback: false },
      { key: 'collidable', label: 'Collidable', kind: 'bool', path: 'Options.Collidable', fallback: true },
      { key: 'pickup', label: 'Prevent item pickup', kind: 'bool', path: 'Options.PreventItemPickup', fallback: false },
      { key: 'otherDrops', label: 'Prevent vanilla drops', kind: 'bool', path: 'Options.PreventOtherDrops', fallback: false,
        help: 'On means it drops what Drops says and nothing else.' },
      { key: 'silent', label: 'Silent', kind: 'bool', path: 'Options.Silent', fallback: false },
      { key: 'gravity', label: 'No gravity', kind: 'bool', path: 'Options.NoGravity', fallback: false },
      { key: 'glowing', label: 'Glowing', kind: 'bool', path: 'Options.Glowing', fallback: false },
      { key: 'invincible', label: 'Invincible', kind: 'bool', path: 'Options.Invincible', fallback: false },
      { key: 'threat', label: 'Threat table', kind: 'bool', path: 'Modules.ThreatTable', fallback: false,
        help: 'Targets by accumulated threat rather than by proximity - what makes a boss fight read as a boss fight.' },
      { key: 'immunity', label: 'Immunity table', kind: 'bool', path: 'Modules.ImmunityTable', fallback: false,
        help: 'Per-attacker damage cooldowns, so a crowd cannot stunlock it.' },
    ],
  },
  {
    id: 'bossbar',
    title: 'Boss bar',
    blurb: 'The bar across the top of the screen. This is most of what makes a mob read as a boss.',
    fields: [
      { key: 'barOn', label: 'Enabled', kind: 'bool', path: 'BossBar.Enabled', fallback: false },
      { key: 'barTitle', label: 'Title', kind: 'text', path: 'BossBar.Title', fallback: '',
        placeholder: 'defaults to the display name' },
      { key: 'barRange', label: 'Range', kind: 'number', path: 'BossBar.Range', min: 1, max: 128, step: 1,
        fallback: 64, help: 'Blocks. Who can see the bar.' },
      { key: 'barColor', label: 'Colour', kind: 'select', path: 'BossBar.Color', options: BAR_COLORS, fallback: 'RED' },
      { key: 'barStyle', label: 'Style', kind: 'select', path: 'BossBar.Style', options: BAR_STYLES, fallback: 'SOLID' },
      { key: 'barFog', label: 'Create fog', kind: 'bool', path: 'BossBar.CreateFog', fallback: false },
      { key: 'barDark', label: 'Darken sky', kind: 'bool', path: 'BossBar.DarkenSky', fallback: false },
      { key: 'barMusic', label: 'Play boss music', kind: 'bool', path: 'BossBar.PlayMusic', fallback: false },
    ],
  },
  {
    id: 'ai',
    title: 'AI',
    blurb: 'What it decides to do, and who it decides to do it to. Start with clear to drop the vanilla set.',
    fields: [
      { key: 'goals', label: 'Goal selectors', kind: 'list', path: 'AIGoalSelectors', options: AI_GOALS, fallback: [] },
      { key: 'targets', label: 'Target selectors', kind: 'list', path: 'AITargetSelectors', options: AI_TARGETS, fallback: [] },
    ],
  },
  {
    id: 'skills',
    title: 'Skills',
    blurb: 'A skill, and what sets it off. This is where a boss stops being a zombie with a lot of health.',
    fields: [
      { key: 'skills', label: 'Skills', kind: 'rows', path: 'Skills', fallback: [],
        columns: [
          { key: 'skill', label: 'Skill', width: 3 },
          { key: 'trigger', label: 'Trigger', width: 2, suggest: TRIGGERS },
          { key: 'chance', label: 'Chance', width: 1 },
        ] },
    ],
  },
  {
    id: 'loot',
    title: 'Equipment and drops',
    blurb: 'What it wears, and what it leaves behind.',
    fields: [
      { key: 'equipment', label: 'Equipment', kind: 'rows', path: 'Equipment', fallback: [],
        columns: [
          { key: 'item', label: 'Item', width: 3 },
          { key: 'slot', label: 'Slot', width: 2, suggest: EQUIP_SLOTS },
        ] },
      { key: 'drops', label: 'Drops', kind: 'rows', path: 'Drops', fallback: [],
        columns: [
          { key: 'item', label: 'Item', width: 3 },
          { key: 'amount', label: 'Amount', width: 1 },
          { key: 'chance', label: 'Chance', width: 1 },
        ] },
      { key: 'modifiers', label: 'Damage modifiers', kind: 'rows', path: 'DamageModifiers', fallback: [],
        columns: [
          { key: 'cause', label: 'Cause', width: 3, suggest: DAMAGE_CAUSES },
          { key: 'multiplier', label: 'x', width: 1 },
        ] },
    ],
  },
  {
    id: 'levels',
    title: 'Levels',
    blurb: 'What one level is worth, so the same mob can be scaled rather than copied.',
    fields: [
      { key: 'lvHealth', label: 'Health per level', kind: 'number', path: 'LevelModifiers.Health', step: 1, fallback: 0 },
      { key: 'lvDamage', label: 'Damage per level', kind: 'number', path: 'LevelModifiers.Damage', step: 0.5, fallback: 0 },
      { key: 'lvArmor', label: 'Armour per level', kind: 'number', path: 'LevelModifiers.Armor', step: 0.5, fallback: 0 },
      { key: 'lvPower', label: 'Power per level', kind: 'number', path: 'LevelModifiers.Power', step: 0.1, fallback: 0,
        help: 'Scales skill damage rather than melee.' },
      { key: 'kills', label: 'Kill messages', kind: 'list', path: 'KillMessages', fallback: [] },
    ],
  },
]

const ITEM_SECTIONS: Section[] = [
  {
    id: 'identity',
    title: 'Identity',
    blurb: 'The vanilla item this is painted onto, and what it is called.',
    fields: [
      { key: 'material', label: 'Material', kind: 'text', path: 'Id', options: MATERIALS,
        placeholder: 'DIAMOND_SWORD', fallback: '',
        help: 'The vanilla item. Its model is replaced by this one through the model data below.' },
      { key: 'display', label: 'Display name', kind: 'text', path: 'Display',
        placeholder: '&bRunic Blade', fallback: '' },
      { key: 'lore', label: 'Lore', kind: 'list', path: 'Lore', fallback: [],
        help: 'One line each, under the name. Colour codes with &.' },
      { key: 'model', label: 'Custom model data', kind: 'number', path: 'Model', min: 0, step: 1, fallback: 0,
        help: 'The number your resource pack maps to this model. Without it the item keeps the vanilla look.' },
      { key: 'amount', label: 'Amount', kind: 'number', path: 'Amount', min: 1, step: 1, fallback: 1 },
    ],
  },
  {
    id: 'options',
    title: 'Options',
    blurb: 'How the item itself behaves in a hand and in a slot.',
    fields: [
      { key: 'unbreakable', label: 'Unbreakable', kind: 'bool', path: 'Options.Unbreakable', fallback: false },
      { key: 'glint', label: 'Glint', kind: 'bool', path: 'Options.Glint', fallback: false,
        help: 'The enchanted shimmer, without an enchantment.' },
      { key: 'hideFlags', label: 'Hide flags', kind: 'bool', path: 'Options.HideFlags', fallback: false,
        help: 'Hides the vanilla attribute and enchantment lines, so the lore is all a player reads.' },
      { key: 'colour', label: 'Colour', kind: 'text', path: 'Options.Color', placeholder: '255,64,32', fallback: '',
        help: 'Leather dye or potion tint, as R,G,B.' },
      { key: 'repair', label: 'Repair cost', kind: 'number', path: 'Options.RepairCost', min: 0, step: 1, fallback: 0 },
      { key: 'durability', label: 'Durability', kind: 'number', path: 'Durability', min: 0, step: 1, fallback: 0 },
    ],
  },
  {
    id: 'power',
    title: 'Enchantments and attributes',
    blurb: 'What it does to whoever holds it.',
    fields: [
      { key: 'enchants', label: 'Enchantments', kind: 'rows', path: 'Enchantments', fallback: [],
        columns: [
          { key: 'name', label: 'Enchantment', width: 3, suggest: ENCHANTS },
          { key: 'level', label: 'Lv', width: 1 },
        ] },
      { key: 'attributes', label: 'Attributes', kind: 'rows', path: 'Attributes', fallback: [],
        columns: [
          { key: 'slot', label: 'Slot', width: 2, suggest: ATTRIBUTE_SLOTS },
          { key: 'attribute', label: 'Attribute', width: 2, suggest: ATTRIBUTES },
          { key: 'value', label: 'Value', width: 1 },
        ] },
    ],
  },
  {
    id: 'skills',
    title: 'Skills and drops',
    blurb: 'What it does when used, and how it behaves on the floor.',
    fields: [
      { key: 'skills', label: 'Skills', kind: 'rows', path: 'Skills', fallback: [],
        columns: [
          { key: 'skill', label: 'Skill', width: 3 },
          { key: 'trigger', label: 'Trigger', width: 2, suggest: TRIGGERS },
          { key: 'chance', label: 'Chance', width: 1 },
        ] },
      { key: 'dropGlow', label: 'Glowing on the ground', kind: 'bool', path: 'DropOptions.Glowing', fallback: false },
      { key: 'dropBeam', label: 'Beacon beam', kind: 'text', path: 'DropOptions.BeaconBeam', fallback: '',
        placeholder: 'RED', help: 'A column of light over the drop, so a rare one is not missed.' },
    ],
  },
]

/** Blocks have no MythicMobs form; a block is a block. */
export const SCHEMA: Partial<Record<ProjectKind, Section[]>> = {
  mobs: MOB_SECTIONS,
  items: ITEM_SECTIONS,
}

export const hasConfig = (kind: ProjectKind | undefined) => !!kind && !!SCHEMA[kind]

export const fieldsOf = (kind: ProjectKind): Field[] =>
  (SCHEMA[kind] ?? []).flatMap((s) => s.fields)

/* ---------------- the value ---------------- */

export function emptyConfig(kind: ProjectKind): MythicConfig {
  const out: MythicConfig = {}
  for (const f of fieldsOf(kind)) {
    out[f.key] = f.fallback ?? (f.kind === 'list' || f.kind === 'rows' ? [] : f.kind === 'bool' ? false : f.kind === 'number' ? 0 : '')
  }
  return out
}

/** Only what differs from the fallback, which is what MythicMobs reads anyway. */
export function setFields(kind: ProjectKind, config: MythicConfig): Field[] {
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

/** MythicMobs reads plain YAML, so this writes plain YAML and nothing clever. */
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

/** A row becomes the space-separated line MythicMobs expects of a list entry. */
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
 * The config as MythicMobs would read it, keyed by the model's own name
 * so that the file and the model cannot drift apart.
 */
export function toYaml(id: string, kind: ProjectKind, config: MythicConfig): string {
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
      /* Attributes are the one shape that is a map rather than a list:
         MythicMobs groups them by the slot they apply in. */
      if (f.key === 'attributes') {
        const bySlot: Tree = {}
        for (const row of v as Row[]) {
          const slot = (row.slot ?? '').trim()
          const attr = (row.attribute ?? '').trim()
          const val = (row.value ?? '').trim()
          if (!slot || !attr || !val) continue
          const group = (bySlot[slot] as Tree) ?? (bySlot[slot] = {})
          const n = Number(val)
          group[attr] = Number.isFinite(n) ? n : val
        }
        if (Object.keys(bySlot).length) put(f.path, bySlot as unknown as string[])
        continue
      }
      if (lines.length) put(f.path, lines)
      continue
    }
    if (f.kind === 'list') {
      const lines = (v as string[]).map((l) => l.trim()).filter(Boolean)
      if (lines.length) put(f.path, lines)
      continue
    }
    put(f.path, v as string | number | boolean)
  }

  const out: string[] = []
  emit({ [id]: tree }, '', out)
  const body = out.join('\n')
  const file = kind === 'mobs' ? 'mobs' : 'items'
  return body
    ? `# ${file}/${id}.yml — written by Vellum\n${body}\n`
    : `# ${file}/${id}.yml — written by Vellum\n# Nothing set yet.\n`
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
  config: MythicConfig | undefined,
): ConfigIssue[] {
  if (!kind || !config || !hasConfig(kind)) return []
  const out: ConfigIssue[] = []
  const str = (k: string) => String(config[k] ?? '').trim()
  const num = (k: string) => Number(config[k] ?? 0)
  const rows = (k: string) => (Array.isArray(config[k]) ? (config[k] as Row[]) : [])
  const list = (k: string) => (Array.isArray(config[k]) ? (config[k] as string[]) : [])
  const touched = setFields(kind, config).length > 0
  if (!touched) return []

  if (!ID_RULE.test(id)) {
    out.push({ level: 'error', message: `"${id}" cannot be a MythicMobs id - letters, digits and underscores only` })
  }

  if (kind === 'mobs') {
    if (!str('type')) {
      out.push({ level: 'error', message: 'No base entity: MythicMobs has nothing to build this mob on' })
    }
    if (num('health') <= 0) {
      out.push({ level: 'error', message: 'Health of 0 or less: it dies the moment it spawns' })
    }
    if (config.barOn && !str('barTitle') && !str('display')) {
      out.push({ level: 'warning', message: 'A boss bar with no title and no display name shows an empty bar' })
    }
    if (config.barOn && num('health') < 100) {
      out.push({ level: 'warning', message: `A boss bar over ${num('health')} health: the bar will empty in a hit or two` })
    }
    const goals = list('goals')
    const targets = list('targets')
    if (goals.length && goals[0] !== 'clear') {
      out.push({ level: 'warning', message: 'Goal selectors that do not start with "clear" are added to the vanilla set rather than replacing it' })
    }
    if (targets.length && targets[0] !== 'clear') {
      out.push({ level: 'warning', message: 'Target selectors that do not start with "clear" are added to the vanilla set rather than replacing it' })
    }
    if (goals.length && !targets.length) {
      out.push({ level: 'warning', message: 'Goals but no target selectors: it will decide how to attack and never decide whom' })
    }
    if (config.threat && !targets.length) {
      out.push({ level: 'warning', message: 'A threat table with no target selectors has nothing to build threat against' })
    }
    for (const r of rows('equipment')) {
      if (r.slot && !(EQUIP_SLOTS as readonly string[]).includes(r.slot.toUpperCase())) {
        out.push({ level: 'error', message: `"${r.slot}" is not an equipment slot` })
      }
    }
    for (const r of rows('drops')) {
      const c = Number(r.chance)
      if (r.chance && (!Number.isFinite(c) || c < 0 || c > 1)) {
        out.push({ level: 'warning', message: `A drop chance of ${r.chance}: MythicMobs reads this as 0 to 1, so 0.25 is a quarter` })
      }
    }
  }

  if (kind === 'items') {
    if (!str('material')) {
      out.push({ level: 'error', message: 'No material: MythicMobs has no vanilla item to build this on' })
    }
    if (num('model') <= 0 && str('material')) {
      out.push({
        level: 'warning',
        message: 'No custom model data, so this item will use the vanilla model rather than the one being built here',
      })
    }
    for (const r of rows('enchants')) {
      const lv = Number(r.level)
      if (r.name && (!Number.isFinite(lv) || lv < 1)) {
        out.push({ level: 'error', message: `"${r.name}" has no level` })
      }
    }
    for (const r of rows('attributes')) {
      if ((r.attribute || r.value) && !r.slot) {
        out.push({ level: 'error', message: `The "${r.attribute || r.value}" attribute names no slot, so nothing applies it` })
      }
      if (r.value && !Number.isFinite(Number(r.value))) {
        out.push({ level: 'error', message: `"${r.value}" is not a number` })
      }
    }
  }

  for (const r of rows('skills')) {
    if (r.skill && !r.trigger) {
      out.push({ level: 'warning', message: `"${r.skill}" has no trigger, so nothing sets it off` })
    }
    if (r.trigger && !r.trigger.startsWith('~')) {
      out.push({ level: 'error', message: `"${r.trigger}" is not a trigger - MythicMobs triggers begin with ~` })
    }
  }

  return out
}
