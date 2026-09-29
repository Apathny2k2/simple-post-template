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
import { configPath, keyConfirmed, toYaml } from './config'
import type { Model, ProjectKind, Vec3 } from './model'

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

  /* Deduplicated by path, so a texture several models share is written once. */
  const written = new Set<string>()

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
    const built = toMinecraftModel(item.model, ns, folder, item.display, name)
    issues.push({ id: item.id, issues: built.issues })

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

    for (const tex of item.model.textures) {
      const path = `assets/${ns}/textures/${folder}/${textureName(tex.name, name)}.png`
      if (written.has(path)) continue
      const bytes = tex.source ? dataUriBytes(tex.source) : null
      if (!bytes) {
        skipped.push({ id: `${item.id} · ${tex.name}`, why: 'the texture carries no image data' })
        continue
      }
      written.add(path)
      files.push({ path, kind: 'png', bytes })
    }
  }

  return { files, issues, skipped }
}

/* ---------------- the configs, which are not pack files ---------------- */

/**
 * True when any line is neither blank nor a comment. toYaml's stub for an
 * empty config has `config-version: 1`, so it counts as saying something.
 */
const saysSomething = (yaml: string) =>
  yaml.split('\n').some((line) => line.trim() && !line.trimStart().startsWith('#'))

export function buildConfigs(items: PackItem[]): PackReport {
  const files: PackFile[] = []
  const skipped: PackReport['skipped'] = []

  for (const item of items) {
    if (item.kind !== 'mobs' && item.kind !== 'items') continue
    const name = safeId(item.id)
    const yaml = item.model.config ? toYaml(name, item.kind, item.model.config) : ''
    if (!saysSomething(yaml)) {
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
    files.push({ path: configPath(item.kind, name), kind: 'text', bytes: utf8(yaml) })
  }

  return { files, issues: [], skipped }
}

export const packZip = (report: PackReport): Uint8Array =>
  makeZip(report.files.map((f): ZipEntry => ({ path: f.path, bytes: f.bytes })))

export const packBytes = (report: PackReport) =>
  report.files.reduce((n, f) => n + f.bytes.length, 0)
