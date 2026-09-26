/* ---------------------------------------------------------------
   The resource pack.

   A pack is a zip with a shape Minecraft insists on, and getting the
   shape wrong fails in the least helpful way available: the pack does
   not appear in the list, or appears and loads nothing, with no
   message naming what was wrong. So this builds the whole tree rather
   than a model file and a hope.

       pack.mcmeta
       assets/<namespace>/items/<name>.json          <- what points at it
       assets/<namespace>/models/item/<name>.json
       assets/<namespace>/textures/item/<name>.png
       assets/<namespace>/models/block/<name>.json
       assets/<namespace>/textures/block/<name>.png

   `pack_format` is the one number that decides whether any of it
   loads, it is a single integer per Minecraft version, and it changes
   often enough that hard-coding a table here would be a table that
   goes stale and lies. It is asked for instead.

   WHERE THIS BELONGS. A server running the plugin does not need any of
   this: the plugin builds the pack itself and serves it at a URL with
   the hash in it, so the client cache stays correct. Two pipelines that
   can disagree would be worse than one. What this is for is the
   standalone case - the free tier, no plugin, a browser and nothing
   else - where there is otherwise no way to get a pack at all.
   --------------------------------------------------------------- */

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
  /** per item, what had to change to make a model file of it */
  issues: Array<{ id: string; issues: TranslationIssue[] }>
  skipped: Array<{ id: string; why: string }>
}

const utf8 = (s: string) => new TextEncoder().encode(s)

/**
 * JSON with vectors kept on one line.
 *
 * `JSON.stringify(v, null, 2)` puts every number of every `from`, `to`
 * and `uv` on a line of its own, which turned a thirteen-cube sword
 * into sixteen kilobytes nobody could read. Minecraft's own model
 * files keep them inline; so does this.
 */
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

/* `safeId` is defined next to the translation, not here: the model
   file's texture references have to obey the same rule these file names
   do, and two copies of it are two chances to drift apart. */
export { safeId } from './mcmodel'

export const isNamespace = (s: string) => /^[a-z0-9_.-]+$/.test(s)

/** Which folder a kind lives in. A mob has neither, and is left out. */
export const folderOf = (kind: ProjectKind | undefined): 'item' | 'block' | null =>
  kind === 'blocks' ? 'block' : kind === 'items' ? 'item' : null

/**
 * Every file the pack contains, and what it cost to make each one.
 *
 * A mob is skipped rather than half-exported: Minecraft has no entity
 * model in a resource pack, so there is no file that could be written
 * and writing a wrong one would be worse than saying so.
 */
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

  /* One texture can be shared by several models, so it is written once
     under the name it carries rather than once per model that uses it. */
  const written = new Set<string>()

  for (const item of items) {
    const folder = folderOf(item.kind)
    if (!folder) {
      skipped.push({
        id: item.id,
        why:
          item.kind === 'mobs'
            ? 'a mob has no model file in a resource pack — the plugin renders it'
            : `nothing in a pack holds a "${item.kind ?? 'kind-less'}" model`,
      })
      continue
    }

    const name = safeId(item.id)
    const built = toMinecraftModel(item.model, ns, folder, item.display, name)
    issues.push({ id: item.id, issues: built.issues })

    /* Carry the reason, not a pointer to it. "See the problems on it"
       makes someone go looking for a message we already have. */
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

    /* THE FILE THAT MAKES THE MODEL REACHABLE.
       A model under `models/` is only geometry sitting on disk - nothing
       in the game points at it. Since 1.21.4 the thing that does is an
       item definition: an item whose `minecraft:item_model` component is
       `<ns>:<id>` renders whatever this file names. Without it the pack
       loads without complaint and the item keeps its vanilla look, which
       is the failure that is hardest to tell from "the pack didn't
       install". `overrides` on `custom_model_data` was the pre-1.21.4
       way and is deliberately not written: the cutoff is sharp, and the
       plugin's own generator targets the definition form. */
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

/* ---------------- the configs, which are not pack files ----------------

   A config is how a mob becomes a thing in the game, and it does NOT
   belong in a resource pack. Minecraft never reads it; the Vellum
   plugin does, and this behaviour is ours rather than a third party's,
   so the file goes wherever that plugin keeps its definitions - not in
   `resourcepacks/`.

   Hence a second archive rather than a folder inside the first one:
   putting it in the pack would invite someone to drop the whole thing
   in the wrong place, and Minecraft would say nothing at all about the
   files it ignored.

   The paths are the ones the Config tab already names, so what you
   download matches what the panel told you it was. Where they land on
   a server is the plugin's convention to set, not ours to assume, so
   they are written relative and nothing here prefixes them.
   --------------------------------------------------------------- */

/** True once a config says anything - the writer emits a stub when it does not. */
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
    /* Held back rather than guessed. A root key the parser does not
       recognise is an error, and the reload swaps content only when the
       whole report is clean - so one file with the wrong key holds back
       every mob, item and block on the server, not just this one. */
    if (!keyConfirmed(item.kind)) {
      skipped.push({
        id: item.id,
        why: 'its root collection key is not confirmed yet — shipping the wrong one would block the server’s whole content reload, so it is previewed in the Config tab rather than written here',
      })
      continue
    }
    files.push({ path: configPath(item.kind, name), kind: 'text', bytes: utf8(yaml) })
  }

  return { files, issues: [], skipped }
}

/** The report as the archive itself. */
export const packZip = (report: PackReport): Uint8Array =>
  makeZip(report.files.map((f): ZipEntry => ({ path: f.path, bytes: f.bytes })))

export const packBytes = (report: PackReport) =>
  report.files.reduce((n, f) => n + f.bytes.length, 0)
