/* Builds a resource pack for use without the plugin, which builds and
   serves its own:

       pack.mcmeta
       assets/<namespace>/items/<name>.json          <- what points at it
       assets/<namespace>/models/item/<name>.json
       assets/<namespace>/textures/item/<name>.png
       assets/<namespace>/models/block/<name>.json
       assets/<namespace>/textures/block/<name>.png

   `pack_format` changes with the Minecraft version, so it is an option. */

import { safeId, textureName, toMinecraftModel } from './mcmodel'
import type { TranslationIssue } from './mcmodel'
import { dataUriBytes, makeZip } from './zip'
import type { ZipEntry } from './zip'
import { bodyOf, configPath, hasConfig, keyConfirmed, toYaml } from './config'
import type { Model, ProjectKind, Texture, Vec3 } from './model'
import { frameCount, frameHeight, frameSequence } from './texture-anim'
import { pileYaml, stageJson, stagePath, textureRef } from './pile'

export type PackItem = {
  /** the file name inside the pack, without extension */
  id: string
  model: Model
  kind: ProjectKind | undefined
  display?: Record<string, { rotation: Vec3; translation: Vec3; scale: Vec3 }>
}

export type PackOptions = {
  namespace: string
  /** the integer for the Minecraft version this pack is for */
  packFormat: number
  description: string
}

export type PackFile = { path: string; bytes: Uint8Array; kind: 'json' | 'png' | 'text' }

export type PackReport = {
  files: PackFile[]
  /** translation issues, per item */
  issues: Array<{ id: string; issues: TranslationIssue[] }>
  skipped: Array<{ id: string; why: string }>
}

const utf8 = (s: string) => new TextEncoder().encode(s)

/** JSON with number arrays kept on one line, as in Minecraft's own model files. */
function pretty(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'number')) return `[${value.join(', ')}]`
    if (!value.length) return '[]'
    const inner = indent + '  '
    return `[\n${value.map((v) => inner + pretty(v, inner)).join(',\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const rows = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    if (!rows.length) return '{}'
    const inner = indent + '  '
    return `{\n${rows
      .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${pretty(v, inner)}`)
      .join(',\n')}\n${indent}}`
  }
  return JSON.stringify(value)
}

const json = (v: unknown) => utf8(pretty(v) + '\n')

/* Re-exported so texture references and file names share one safeId. */
export { safeId } from './mcmodel'

export const isNamespace = (s: string) => /^[a-z0-9_.-]+$/.test(s)

/** The pack folder for a kind. Mobs have none and are left out. */
export const folderOf = (kind: ProjectKind | undefined): 'item' | 'block' | null =>
  kind === 'blocks' ? 'block' : kind === 'items' ? 'item' : null

/** Every file in the pack. Mobs are skipped: resource packs can't hold entity models. */
export function buildPack(items: PackItem[], opts: PackOptions): PackReport {
  const ns = safeId(opts.namespace)
  const files: PackFile[] = []
  const issues: PackReport['issues'] = []
  const skipped: PackReport['skipped'] = []

  files.push({
    path: 'pack.mcmeta',
    kind: 'json',
    bytes: json({
      pack: { pack_format: opts.packFormat, description: opts.description },
    }),
  })

  /* A texture several models share is written once. Two different images
     with one name get two files, or one model would wear the other's. */
  const written = new Map<string, string>()

  for (const item of items) {
    const folder = folderOf(item.kind)
    if (!folder) {
      skipped.push({
        id: item.id,
        why:
          item.kind === 'mobs'
            ? 'resource packs can’t hold a mob model, so the plugin renders it'
            : `nothing in a pack holds a "${item.kind ?? 'kind-less'}" model`,
      })
      continue
    }

    const name = safeId(item.id)
    const texturePath = (file: string) => `assets/${ns}/textures/${folder}/${file}.png`
    const names = new Map<string, string>()
    const renamed: TranslationIssue[] = []
    for (const tex of item.model.textures) {
      const want = textureName(tex.name, name)
      let file = want
      for (let n = 1; written.has(texturePath(file)) && written.get(texturePath(file)) !== tex.source; n++) {
        file = n === 1 ? `${name}_${want}` : `${name}_${want}_${n}`
      }
      names.set(tex.id, file)
      if (file !== want) {
        renamed.push({ level: 'note', message: `The texture "${tex.name}" is written as ${file}.png: another texture has its name` })
      }
      // claimed now, so this model's own textures can't clash with each other either
      if (!written.has(texturePath(file)) && tex.source) written.set(texturePath(file), tex.source)
    }

    const built = toMinecraftModel(item.model, ns, folder, item.display, name, names)
    issues.push({ id: item.id, issues: [...built.issues, ...renamed] })

    const fatal = built.issues.filter((i) => i.level === 'error')
    if (fatal.length) {
      const first = `${fatal[0].where ? `${fatal[0].where}: ` : ''}${fatal[0].message}`
      skipped.push({
        id: item.id,
        why: fatal.length === 1 ? first : `${first} (and ${fatal.length - 1} more)`,
      })
      continue
    }

    files.push({
      path: `assets/${ns}/models/${folder}/${name}.json`,
      kind: 'json',
      bytes: json(built.json),
    })

    /* The item definition (1.21.4+) that makes the model reachable: an
       item whose `minecraft:item_model` component is `<ns>:<name>`
       renders the model named here. Without it the item keeps its vanilla
       look. The older `custom_model_data` overrides are not written. */
    files.push({
      path: `assets/${ns}/items/${name}.json`,
      kind: 'json',
      bytes: json({
        model: { type: 'minecraft:model', model: `${ns}:${folder}/${name}` },
      }),
    })

    /* A pile set: a model and an item definition for every stage of every
       material, so the plugin's display entity shows a stage through the
       item_model component <ns>:pile/<set>/<material>_<count>. */
    const pile = item.model.pile
    if (pile) {
      for (const m of pile.materials) {
        const tex = textureRef(m, ns, (id) => names.get(id))
        const most = Math.min(pile.max, m.max ?? pile.max)
        for (let n = 1; n <= most; n++) {
          const id = stagePath(name, m.name, n)
          files.push({ path: `assets/${ns}/models/item/${id}.json`, kind: 'json', bytes: json(stageJson(item.model, n, tex)) })
          files.push({ path: `assets/${ns}/items/${id}.json`, kind: 'json', bytes: json({ model: { type: 'minecraft:model', model: `${ns}:item/${id}` } }) })
        }
      }
    }

    for (const tex of item.model.textures) {
      const path = texturePath(names.get(tex.id) ?? textureName(tex.name, name))
      if (files.some((f) => f.path === path)) continue
      const bytes = tex.source ? dataUriBytes(tex.source) : null
      if (!bytes) {
        skipped.push({ id: `${item.id} · ${tex.name}`, why: 'the texture carries no image data' })
        continue
      }
      files.push({ path, kind: 'png', bytes })
      // an animated texture plays in game from the .mcmeta beside it
      const meta = mcmetaOf(tex, item.model)
      if (meta) files.push({ path: `${path}.mcmeta`, kind: 'json', bytes: json(meta) })
    }
  }

  return { files, issues, skipped }
}

/* ---------------- the configs, which are not pack files ---------------- */

export function buildConfigs(items: PackItem[], namespace = 'vellum'): PackReport {
  const files: PackFile[] = []
  const skipped: PackReport['skipped'] = []

  // a pile set's config names its stages, so it needs the pack's namespace
  for (const item of items) {
    if (item.model.pile) files.push({ path: `piles/${safeId(item.id)}.yml`, kind: 'text', bytes: utf8(pileYaml(safeId(item.id), item.model.pile, safeId(namespace))) })
  }

  for (const item of items) {
    // blocks have no config form
    if (!item.kind || !hasConfig(item.kind)) continue
    const name = safeId(item.id)
    const config = item.model.config
    // toYaml writes a stub for an empty config, so the config itself decides
    if (!config || !Object.keys(bodyOf(item.kind, config)).length) {
      skipped.push({ id: item.id, why: 'nothing configured on it yet' })
      continue
    }
    /* Left out until the root key is confirmed: one unknown root key
       fails the plugin's whole content reload. */
    if (!keyConfirmed(item.kind)) {
      skipped.push({
        id: item.id,
        why: 'its root collection key isn’t confirmed yet. A wrong key would block the server’s whole content reload, so it’s left out of the zip. You can preview it in the Config tab',
      })
      continue
    }
    files.push({ path: configPath(item.kind, name), kind: 'text', bytes: utf8(toYaml(name, item.kind, config)) })
  }

  return { files, issues: [], skipped }
}

export const packZip = (report: PackReport): Uint8Array =>
  makeZip(report.files.map((f): ZipEntry => ({ path: f.path, bytes: f.bytes })))

export const packBytes = (report: PackReport) =>
  report.files.reduce((n, f) => n + f.bytes.length, 0)

/**
 * A texture's `.mcmeta` for Java, when its image holds more than one frame:
 * the ticks per frame, blending, and the frames in the order they play. A
 * frame that isn't square says its size, as Java reads square frames
 * otherwise.
 */
export function mcmetaOf(t: Texture, model: Model): Record<string, unknown> | null {
  const n = frameCount(t, model)
  if (n < 2) return null
  const seq = frameSequence(t, model)
  const plain = seq.length === n && seq.every((f, i) => f === i)
  const fh = Math.round(frameHeight(t, model))
  return {
    animation: {
      ...(t.animation?.frameTime && t.animation.frameTime !== 1 ? { frametime: t.animation.frameTime } : {}),
      ...(t.animation?.interpolate ? { interpolate: true } : {}),
      ...(plain ? {} : { frames: seq }),
      ...(fh !== t.width ? { width: t.width, height: fh } : {}),
    },
  }
}
