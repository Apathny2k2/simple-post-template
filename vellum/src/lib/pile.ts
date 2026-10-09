/* Ground piles: an item right-clicked onto the top of a block lies there as a
   flat piece; more clicks with the same item pile more pieces on, and
   breaking the pile drops them all. The server plugin does the placing
   and dropping; Vellum makes the models it shows and the config it reads.

   A pile set is one shape of piece (a gem, an ingot, a raw chunk, a dust)
   shared by every material that has that shape: the set's model is the
   piece, and each material says which items it is for and which texture
   the piece wears. Every stage (1 piece, 2 pieces, up to the set's most)
   is laid out by `PILE_LAYOUT` and written as a Java model per material
   per stage. `docs/piles.md` is the plugin's half. */

import type { Cube, FaceKey, Model, Texture, Vec3 } from './model'
import { FACES, textureById } from './model'
import { safeId } from './mcmodel'

export type PileTexture = { kind: 'vanilla'; path: string } | { kind: 'custom'; texture: string }

export type PileMaterial = {
  /** the name the stage models and the config use, as `emerald` */
  name: string
  /** item ids (`minecraft:emerald`) or item tags (`#c:gems`) the pile takes */
  match: string[]
  texture: PileTexture
  /** this material's own most, under the set's */
  max?: number
}

export type PileSet = {
  /** how many pieces a full pile holds, 1 to 8 */
  max: number
  /** what a click with the item on a full pile does */
  whenFull: 'new-pile' | 'refuse'
  sound?: { place?: string; break?: string }
  materials: PileMaterial[]
}

export type PileShape = 'gems' | 'ingots' | 'raw' | 'dusts'

/** The most a pile holds, the footprint a piece may take across, and how tall it may stand, in pixels. */
export const PILE_MAX = 8
export const PIECE_SPAN = 8
export const PIECE_HEIGHT = 3

const vanilla = (id: string, colour: string, name = id): PileMaterial & { colour: string } => ({
  name,
  match: [`minecraft:${id}`],
  texture: { kind: 'vanilla', path: `minecraft:item/${id}` },
  colour,
})

/** The vanilla items of each shape, with a colour the preview draws a vanilla texture in. */
export const PILE_PRESETS: Record<PileShape, { label: string; materials: Array<PileMaterial & { colour: string }> }> = {
  gems: {
    label: 'Gems',
    materials: [
      vanilla('diamond', '#4fe3d7'),
      vanilla('emerald', '#17c544'),
      vanilla('amethyst_shard', '#9a5cc6'),
      vanilla('quartz', '#e7e2da'),
      vanilla('lapis_lazuli', '#2a4fc0'),
    ],
  },
  ingots: {
    label: 'Ingots',
    materials: [vanilla('iron_ingot', '#d8d8d8'), vanilla('gold_ingot', '#f5cf3c'), vanilla('copper_ingot', '#d8794e'), vanilla('netherite_ingot', '#4a4446')],
  },
  raw: {
    label: 'Raw chunks',
    materials: [vanilla('raw_iron', '#c9a68a'), vanilla('raw_gold', '#e3a92b'), vanilla('raw_copper', '#c46a49')],
  },
  dusts: {
    label: 'Dusts and pieces',
    materials: [vanilla('redstone', '#c41c12'), vanilla('glowstone_dust', '#f2d266'), vanilla('coal', '#2b2b2b'), vanilla('gold_nugget', '#f5cf3c'), vanilla('iron_nugget', '#d8d8d8')],
  },
}

/** A new pile set of a shape: its vanilla materials, eight to a pile. */
export function pileSetOf(shape: PileShape): PileSet {
  return { max: PILE_MAX, whenFull: 'new-pile', materials: PILE_PRESETS[shape].materials.map(({ colour: _, ...m }) => m) }
}

/** The colour a vanilla texture is previewed in; grey for one the presets don't know. */
export function vanillaColour(path: string): string {
  for (const p of Object.values(PILE_PRESETS)) for (const m of p.materials) if (m.texture.kind === 'vanilla' && m.texture.path === path) return m.colour
  return '#9aa0a8'
}

/* ---------------- the layout ---------------- */

/** Where each piece of a pile lies: its middle on the block's top (pixels), the layer it is on, and its turn about Y. */
export type PiecePlace = { x: number; z: number; layer: number; turn: -45 | -22.5 | 0 | 22.5 | 45 }

/**
 * Eight places, filled in order: four on the block, then four lying across
 * them. Turns are the steps a Java model element may turn by, so every
 * stage is a valid model. Middles stay 4 pixels in from the edges, so an
 * 8-pixel piece never hangs over.
 */
export const PILE_LAYOUT: readonly PiecePlace[] = [
  { x: 8, z: 8, layer: 0, turn: 0 },
  { x: 6, z: 6.5, layer: 0, turn: 22.5 },
  { x: 10, z: 10, layer: 0, turn: -22.5 },
  { x: 10.5, z: 5.5, layer: 0, turn: 45 },
  { x: 7, z: 10.5, layer: 1, turn: -45 },
  { x: 8.5, z: 7, layer: 1, turn: 22.5 },
  { x: 6, z: 8.5, layer: 1, turn: 0 },
  { x: 10, z: 8, layer: 1, turn: -22.5 },
]

/* ---------------- the piece ---------------- */

/** The piece's bounds, from its cubes. */
export function pieceBounds(model: Model): { lo: Vec3; hi: Vec3 } | null {
  if (!model.cubes.length) return null
  const lo = [0, 1, 2].map((i) => Math.min(...model.cubes.map((c) => c.from[i]))) as Vec3
  const hi = [0, 1, 2].map((i) => Math.max(...model.cubes.map((c) => c.to[i]))) as Vec3
  return { lo, hi }
}

/** The texture a material puts on the piece in the preview: its own, or a stand-in for a vanilla one. */
export function previewTexture(model: Model, m: PileMaterial): Texture | null {
  if (m.texture.kind === 'custom') return textureById(model, m.texture.texture)
  const w = model.resolution.width
  const h = model.resolution.height
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  const x = c.getContext('2d')
  if (x) {
    // a gem-cut lozenge in the material's colour: the real icon is the game's, and is drawn there
    x.fillStyle = vanillaColour(m.texture.path)
    x.beginPath()
    x.moveTo(w / 2, h * 0.12)
    x.lineTo(w * 0.88, h / 2)
    x.lineTo(w / 2, h * 0.88)
    x.lineTo(w * 0.12, h / 2)
    x.closePath()
    x.fill()
    x.fillStyle = 'rgba(255,255,255,0.35)'
    x.fillRect(w * 0.42, h * 0.3, w * 0.08, h * 0.08)
  }
  return { id: `pile-${m.name}`, name: `${m.name}.png`, width: c.width, height: c.height, uvWidth: w, uvHeight: h, source: c.toDataURL('image/png') }
}

/**
 * One stage of a pile as a model to look at: the block it lies on, and
 * `count` copies of the piece laid out, wearing the material's texture.
 */
export function pileStageModel(model: Model, m: PileMaterial, count: number): Model {
  const b = pieceBounds(model)
  const tex = previewTexture(model, m)
  const ground: Texture = groundTexture()
  const cubes: Cube[] = [
    {
      id: 'pile-ground',
      name: 'block',
      from: [0, -16, 0],
      to: [16, 0, 16],
      origin: [8, -8, 8],
      rotation: [0, 0, 0],
      faces: Object.fromEntries(FACES.map((k) => [k, { uv: [0, 0, 16, 16], texture: ground.id }])) as Cube['faces'],
      inflate: 0,
      boxUv: false,
      visible: true,
      locked: false,
    },
  ]
  if (b) {
    const mid: Vec3 = [(b.lo[0] + b.hi[0]) / 2, b.lo[1], (b.lo[2] + b.hi[2]) / 2]
    const thick = Math.max(0.5, b.hi[1] - b.lo[1])
    PILE_LAYOUT.slice(0, Math.max(0, count)).forEach((p, n) => {
      const lift = p.layer * thick
      for (const c of model.cubes) {
        const at = (v: Vec3): Vec3 => [v[0] - mid[0] + p.x, v[1] - mid[1] + lift, v[2] - mid[2] + p.z]
        cubes.push({
          ...c,
          id: `pile-${n}-${c.id}`,
          from: at(c.from),
          to: at(c.to),
          origin: [p.x, lift, p.z],
          rotation: [0, p.turn, 0],
          faces: Object.fromEntries(FACES.map((k) => [k, { ...c.faces[k], texture: c.faces[k].texture ? (tex?.id ?? null) : null }])) as Cube['faces'],
        })
      }
    })
  }
  return {
    name: `${model.name} ${m.name} ${count}`,
    kind: 'blocks',
    resolution: model.resolution,
    bones: [{ id: 'pile', name: 'pile', origin: [0, 0, 0], rotation: [0, 0, 0], visible: true, locked: false, children: cubes.map((c) => ({ kind: 'cube' as const, id: c.id })) }],
    cubes,
    textures: [...(tex ? [tex] : []), ground],
    clips: [],
  }
}

let groundCache: Texture | null = null
/** A grass-top block for the pile to lie on. */
function groundTexture(): Texture {
  if (groundCache) return groundCache
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const x = c.getContext('2d')
  if (x) {
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++) {
        x.fillStyle = (i * 7 + j * 13) % 5 === 0 ? '#5d8a3a' : (i + j) % 3 === 0 ? '#6d9b45' : '#679540'
        x.fillRect(i, j, 1, 1)
      }
  }
  groundCache = { id: 'pile-ground', name: 'ground.png', width: 16, height: 16, uvWidth: 16, uvHeight: 16, source: c.toDataURL('image/png') }
  return groundCache
}

/* ---------------- checks ---------------- */

export type PileIssue = { level: 'error' | 'warning'; message: string; fix?: undefined }

const ID = /^#?[a-z0-9_.-]+:[a-z0-9_./-]+$/

/** What stops a pile set from working, or would surprise in the game. */
export function checkPile(model: Model, set: PileSet): PileIssue[] {
  const out: PileIssue[] = []
  const b = pieceBounds(model)
  if (!b) out.push({ level: 'error', message: 'A pile set needs a piece: add the cubes of one flat piece' })
  else {
    const across = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2])
    const tall = b.hi[1] - b.lo[1]
    if (across > PIECE_SPAN + 1e-6) out.push({ level: 'error', message: `The piece is ${+across.toFixed(2)} pixels across. A pile piece is at most ${PIECE_SPAN}, so eight fit on one block` })
    if (tall > PIECE_HEIGHT + 1e-6) out.push({ level: 'error', message: `The piece stands ${+tall.toFixed(2)} pixels tall. A pile piece lies flat, at most ${PIECE_HEIGHT}` })
  }
  if (model.cubes.some((c) => c.rotation.some((v) => v !== 0))) out.push({ level: 'error', message: 'A pile piece turns as a whole on the block, so its own cubes cannot be turned' })
  if (model.meshes?.length) out.push({ level: 'warning', message: 'Java models are boxes only, so the meshes are left out of the pile' })
  if (set.max < 1 || set.max > PILE_MAX) out.push({ level: 'error', message: `A pile holds 1 to ${PILE_MAX} pieces` })
  if (!set.materials.length) out.push({ level: 'error', message: 'A pile set needs a material: the items it takes' })
  const names = new Set<string>()
  const seen = new Map<string, string>()
  for (const m of set.materials) {
    const name = safeId(m.name)
    if (!name) out.push({ level: 'error', message: 'A material needs a name' })
    else if (names.has(name)) out.push({ level: 'error', message: `Two materials are named "${name}"` })
    names.add(name)
    if (!m.match.length) out.push({ level: 'error', message: `"${m.name}" takes no items: give it an item id or a tag` })
    for (const id of m.match) {
      if (!ID.test(id)) out.push({ level: 'error', message: `"${id}" on "${m.name}" is not an item id (minecraft:emerald) or a tag (#c:gems)` })
      const other = seen.get(id)
      if (other && other !== m.name) out.push({ level: 'error', message: `"${id}" is taken by both "${other}" and "${m.name}"` })
      seen.set(id, m.name)
    }
    if (m.texture.kind === 'vanilla' && !ID.test(m.texture.path)) out.push({ level: 'error', message: `"${m.texture.path}" on "${m.name}" is not a texture path (minecraft:item/emerald)` })
    if (m.texture.kind === 'custom' && !textureById(model, m.texture.texture)) out.push({ level: 'error', message: `"${m.name}" wears a texture this model doesn't have` })
    if (m.max !== undefined && (m.max < 1 || m.max > set.max)) out.push({ level: 'warning', message: `"${m.name}" holds ${m.max}, outside the set's 1 to ${set.max}` })
  }
  return out
}

/* ---------------- what the pack and the plugin get ---------------- */

/** The texture reference a material's stage models use. */
export function textureRef(m: PileMaterial, ns: string, customName: (id: string) => string | undefined): string {
  if (m.texture.kind === 'vanilla') return m.texture.path
  return `${ns}:item/${customName(m.texture.texture) ?? safeId(m.name)}`
}

/**
 * One stage's id: its model is `models/item/<id>.json` and its item
 * definition `items/<id>.json`, so a display entity shows it through the
 * `item_model` component `<namespace>:<id>`.
 */
export const stagePath = (set: string, material: string, count: number) => `pile/${safeId(set)}/${safeId(material)}_${count}`

/**
 * One stage as a Java block model: every cube of the piece, at every place
 * up to `count`, turned about Y at its place, wearing `texture` (the
 * material's, from `textureRef`). UVs go from the model's UV units to Java's 0 to 16.
 */
export function stageJson(model: Model, count: number, texture: string): Record<string, unknown> {
  const b = pieceBounds(model)
  const elements: unknown[] = []
  if (b) {
    const mid: Vec3 = [(b.lo[0] + b.hi[0]) / 2, b.lo[1], (b.lo[2] + b.hi[2]) / 2]
    const thick = Math.max(0.5, b.hi[1] - b.lo[1])
    const su = 16 / (model.resolution.width || 16)
    const sv = 16 / (model.resolution.height || 16)
    const r = (v: number) => Math.round(v * 1e4) / 1e4
    PILE_LAYOUT.slice(0, count).forEach((p) => {
      const lift = p.layer * thick
      for (const c of model.cubes) {
        const at = (v: Vec3) => [r(v[0] - mid[0] + p.x), r(v[1] - mid[1] + lift), r(v[2] - mid[2] + p.z)]
        const faces: Record<string, unknown> = {}
        for (const k of FACES as readonly FaceKey[]) {
          const f = c.faces[k]
          if (!f.texture) continue
          const [x1, y1, x2, y2] = f.uv
          if (x1 === x2 || y1 === y2) continue
          faces[k] = { uv: [r(x1 * su), r(y1 * sv), r(x2 * su), r(y2 * sv)], texture: '#0', ...(f.rotation ? { rotation: f.rotation } : {}) }
        }
        elements.push({
          from: at(c.from),
          to: at(c.to),
          ...(p.turn ? { rotation: { angle: p.turn, axis: 'y', origin: [p.x, r(lift), p.z] } } : {}),
          faces,
        })
      }
    })
  }
  return { textures: { '0': texture, particle: texture }, elements }
}

/** The pile set as the plugin's config, in YAML. */
export function pileYaml(setId: string, set: PileSet, ns: string): string {
  const q = (s: string) => JSON.stringify(s)
  const lines = [
    `# Ground piles for the "${setId}" set, written by Vellum. The plugin reads this; see docs/piles.md.`,
    'piles:',
    `  ${safeId(setId)}:`,
    `    max: ${set.max}`,
    `    when-full: ${set.whenFull}`,
  ]
  if (set.sound?.place || set.sound?.break) {
    lines.push('    sound:')
    if (set.sound.place) lines.push(`      place: ${q(set.sound.place)}`)
    if (set.sound.break) lines.push(`      break: ${q(set.sound.break)}`)
  }
  lines.push('    materials:')
  for (const m of set.materials) {
    const name = safeId(m.name)
    const max = Math.min(set.max, m.max ?? set.max)
    lines.push(`      ${name}:`)
    lines.push(`        match: [${m.match.map(q).join(', ')}]`)
    if (m.max !== undefined) lines.push(`        max: ${max}`)
    lines.push('        stages:')
    for (let n = 1; n <= max; n++) lines.push(`          - ${q(`${ns}:${stagePath(setId, name, n)}`)}`)
  }
  return lines.join('\n') + '\n'
}
