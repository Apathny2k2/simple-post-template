/* Static fixtures for the library shelves, with the real .vellum samples
   prepended so the first cards on each shelf open an actual model. */

import { samples } from './samples'

export type Scene = {
  id: string
  name: string
  blurb: string
  counts: { items: number; mobs: number }
}

export type AssetKind = 'items' | 'mobs'

export type Asset = {
  id: string
  name: string
  file: string
  kind: AssetKind
  sceneId: string
  format: string
  cubes: number
  texture: string
  updated: string
  author: string
  /** drives the placeholder render + hover cube faces */
  hue: [string, string, string]
  /** set on the cards backed by a real .vellum the editor can open */
  sampleId?: string
}

export const scenes: Scene[] = [
  {
    id: 'aurelian',
    name: 'Aurelian Keep',
    blurb: 'Survival flagship - stone, brass and lantern light.',
    counts: { items: 0, mobs: 0 },
  },
  {
    id: 'tidewrack',
    name: 'Tidewrack',
    blurb: 'Drowned ruins pack. Heavy on emissive trims.',
    counts: { items: 0, mobs: 0 },
  },
  {
    id: 'emberfall',
    name: 'Emberfall',
    blurb: 'Seasonal event set, shipped to the PvP realm.',
    counts: { items: 0, mobs: 0 },
  },
]

const itemNames = [
  'Brass Lantern', 'Keep Halberd', 'Vellum Scroll', 'Tide Compass', 'Ember Censer',
  'Oak Buckler', 'Runed Chisel', 'Salt Flask', 'Warden Sigil', 'Cracked Astrolabe',
  'Pitch Torch', 'Iron Caltrop', 'Gilded Key', 'Mariner Hook', 'Ash Ledger',
  'Quarry Pick', 'Signal Horn', 'Wax Seal', 'Bone Fife', 'Copper Still',
  'Frost Phial', 'Mortar Bowl', 'Loom Shuttle', 'Tallow Candle', 'Split Anvil',
  'Verdant Sprig', 'Sextant Mk II', 'Char Kettle', 'Reed Basket', 'Slate Tablet',
  'Pilgrim Stave', 'Ferry Bell', 'Glass Float', 'Hollow Idol',
]

const mobNames = [
  'Keep Warden', 'Tide Revenant', 'Ember Hound', 'Salt Crawler', 'Lantern Moth',
  'Quarry Golem', 'Reed Stalker', 'Brass Sentry', 'Drowned Pilgrim', 'Ash Wisp',
  'Marsh Heron', 'Cinder Ram', 'Bell Ringer', 'Hollow Choir', 'Dune Serpent',
  'Fog Courier', 'Slate Beetle', 'Gutter Imp', 'Reef Drake', 'Night Ferrier',
  'Pale Harrier',
]

const palettes: Array<[string, string, string]> = [
  ['#c8a96a', '#a8854a', '#7d6234'],
  ['#5c7d9c', '#43607a', '#2f455a'],
  ['#a8563f', '#87422f', '#632f21'],
  ['#5b7a63', '#46604d', '#33473a'],
  ['#8a7fa8', '#6c6287', '#4e4764'],
  ['#b9a684', '#96865f', '#6e6244'],
  ['#4f6f78', '#3b555c', '#2a3d43'],
  ['#9c6b4f', '#7a523c', '#59392a'],
]

const formats = ['Java Block/Item', 'Bedrock Entity', 'Generic Model', 'Java Entity']
const textures = ['16 x 16', '32 x 32', '64 x 64', '64 x 32', '128 x 128']
const authors = ['g.alex', 'm.ferris', 'kite', 'nine', 'aurelia']

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function build(names: string[], kind: AssetKind, sceneId: string, seed: number): Asset[] {
  return names.map((name, i) => {
    const n = i + seed
    return {
      id: `${sceneId}-${kind}-${slug(name)}`,
      name,
      file: `${slug(name)}.vellum`,
      kind,
      sceneId,
      format: formats[n % formats.length],
      cubes: 3 + ((n * 7) % 42),
      texture: textures[n % textures.length],
      updated: `0${1 + (n % 9)}/${10 + (n % 18)}/26 ${9 + (n % 12)}:${(n * 7) % 6}${(n * 3) % 10}`,
      author: authors[n % authors.length],
      hue: palettes[n % palettes.length],
    }
  })
}

export const assets: Asset[] = scenes.flatMap((scene, s) => [
  ...build(itemNames.slice(0, scene.counts.items), 'items', scene.id, s * 3),
  ...build(mobNames.slice(0, scene.counts.mobs), 'mobs', scene.id, s * 5 + 1),
])

/* `.vellum` carries no format string - the project kind does that job,
   which is what keeps one model from claiming two different formats. */
const KIND_LABEL: Record<string, string> = {
  items: 'Item Model',
  mobs: 'Rigged Entity',
  blocks: 'Block Model',
}

/* The three models the probes built. These are the only cards whose
   "Open in Editor" lands on the model the card is actually showing. */
const realAssets: Asset[] = samples.map((s, i) => ({
  id: s.id,
  name: s.label,
  file: s.file,
  kind: s.kind === 'mobs' ? 'mobs' : 'items',
  sceneId: scenes[0].id,
  format: KIND_LABEL[s.kind] ?? 'Model',
  cubes: s.model.cubes.length,
  texture: `${s.model.resolution.width} x ${s.model.resolution.height}`,
  updated: '09/19/26 03:18',
  author: 'probe',
  hue: palettes[i % palettes.length],
  sampleId: s.id,
}))

/* Only real models are shelved. The fixture list below still backs the
   dashboard's "recent files" copy, but nothing fabricated is offered as
   something you can open. */
export function assetsFor(sceneId: string, kind: AssetKind) {
  return realAssets.filter((a) => a.sceneId === sceneId && a.kind === kind)
}

/* ---------------- editor fixtures -------------------------------------- */

export type OutlinerNode = {
  id: string
  name: string
  type: 'group' | 'cube' | 'mesh'
  depth: number
  hidden?: boolean
  locked?: boolean
  children?: string[]
}

export const outliner: OutlinerNode[] = [
  { id: 'g-root', name: 'lantern', type: 'group', depth: 0 },
  { id: 'g-frame', name: 'frame', type: 'group', depth: 1 },
  { id: 'c-cap', name: 'cap', type: 'cube', depth: 2 },
  { id: 'c-post_n', name: 'post_north', type: 'cube', depth: 2 },
  { id: 'c-post_s', name: 'post_south', type: 'cube', depth: 2 },
  { id: 'c-base', name: 'base', type: 'cube', depth: 2, locked: true },
  { id: 'g-glass', name: 'glass', type: 'group', depth: 1 },
  { id: 'c-pane', name: 'pane', type: 'cube', depth: 2 },
  { id: 'm-flame', name: 'flame', type: 'mesh', depth: 2 },
  { id: 'g-hanger', name: 'hanger', type: 'group', depth: 1, hidden: true },
  { id: 'c-ring', name: 'ring', type: 'cube', depth: 2, hidden: true },
]

export const editorTextures = [
  { id: 't1', name: 'lantern.png', size: '32 x 32', swatch: '#c8a96a' },
  { id: 't2', name: 'glass_em.png', size: '16 x 16', swatch: '#e8d7a3' },
  { id: 't3', name: 'iron_trim.png', size: '16 x 16', swatch: '#6b7280' },
]

export const animations = [
  { id: 'a1', name: 'idle', length: '2.00s', loop: true },
  { id: 'a2', name: 'flicker', length: '0.75s', loop: true },
  { id: 'a3', name: 'extinguish', length: '1.20s', loop: false },
]

export const keyframeRows = [
  { id: 'k-rot', bone: 'frame', channel: 'rotation', keys: [0, 0.4, 1.1, 1.8] },
  { id: 'k-pos', bone: 'glass', channel: 'position', keys: [0, 0.9, 2] },
  { id: 'k-scl', bone: 'flame', channel: 'scale', keys: [0.2, 0.6, 1.0, 1.4, 1.9] },
]
