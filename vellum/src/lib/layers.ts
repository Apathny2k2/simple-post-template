/* Texture layers. A layered texture keeps each layer's pixels apart and its
   own `source` as all of them flattened, bottom first, each at its opacity
   and hidden ones left out; so everything that only reads `source` (the
   viewport, the UV sheet, every exporter) sees the finished image and
   needs to know nothing of layers. Painting draws on one layer's canvas.

   Flattening has to be quick enough for every frame of a stroke, so each
   layer's image is decoded once and kept, by its source. */

import type { Texture, TextureLayer } from './model'
import { newId } from './new-model'

const decoded = new Map<string, HTMLCanvasElement>()
const decoding = new Map<string, Promise<HTMLCanvasElement | null>>()

/** A layer's image as a canvas, decoded once per source. Null for an image that can't be decoded. */
export function decodeLayer(source: string, width: number, height: number): Promise<HTMLCanvasElement | null> {
  const got = decoded.get(source)
  if (got) return Promise.resolve(got)
  const pending = decoding.get(source)
  if (pending) return pending
  const p = new Promise<HTMLCanvasElement | null>((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, width)
    canvas.height = Math.max(1, height)
    if (!source) {
      decoded.set(source, canvas)
      resolve(canvas)
      return
    }
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0)
      }
      decoded.set(source, canvas)
      decoding.delete(source)
      resolve(canvas)
    }
    img.onerror = () => {
      decoding.delete(source)
      resolve(null)
    }
    img.src = source
  })
  decoding.set(source, p)
  return p
}

/** Decodes every layer of a texture, so `flatten` can run at once. */
export async function readyLayers(t: Texture): Promise<void> {
  await Promise.all((t.layers ?? []).map((l) => decodeLayer(l.source, t.width, t.height)))
}

/**
 * The texture's layers flattened into one PNG data URL, bottom first. The
 * canvas of the layer being painted can stand in for its source, so a
 * stroke shows before its layer is re-encoded. Null when a layer isn't
 * decoded yet.
 */
export function flatten(t: Texture, live?: { layer: string; canvas: HTMLCanvasElement }): string | null {
  const layers = t.layers ?? []
  const out = document.createElement('canvas')
  out.width = Math.max(1, t.width)
  out.height = Math.max(1, t.height)
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  for (const l of layers) {
    if (!l.visible) continue
    const canvas = live?.layer === l.id ? live.canvas : decoded.get(l.source)
    if (!canvas) return null
    ctx.globalAlpha = Math.max(0, Math.min(1, l.opacity))
    ctx.drawImage(canvas, 0, 0)
  }
  ctx.globalAlpha = 1
  return out.toDataURL('image/png')
}

/** A clear layer the texture's size, as a PNG data URL. */
export function blankLayerSource(width: number, height: number): string {
  const c = document.createElement('canvas')
  c.width = Math.max(1, width)
  c.height = Math.max(1, height)
  return c.toDataURL('image/png')
}

/** The layer a texture paints on: the picked layer if it still exists, else the top layer. */
export function activeLayer(t: Texture, picked: string | undefined): TextureLayer | null {
  const layers = t.layers ?? []
  return layers.find((l) => l.id === picked) ?? layers[layers.length - 1] ?? null
}

/** What painting reads and writes for a texture: the active layer's pixels, or the texture's own. */
export function paintSource(t: Texture, picked: string | undefined): string {
  return t.layers?.length ? (activeLayer(t, picked)?.source ?? '') : t.source
}

/** A texture's first layer split off: its current image becomes "Base", and a clear layer goes on top. */
export function startLayers(t: Texture): { layers: TextureLayer[]; added: string } {
  const added = newId()
  return {
    layers: [
      { id: newId(), name: 'Base', source: t.source || blankLayerSource(t.width, t.height), visible: true, opacity: 1 },
      { id: added, name: 'Layer 2', source: blankLayerSource(t.width, t.height), visible: true, opacity: 1 },
    ],
    added,
  }
}

/** Merges a layer into the layer below it, the upper painted onto the lower at its opacity. */
export async function mergeDown(t: Texture, id: string): Promise<TextureLayer[] | null> {
  const layers = t.layers ?? []
  const i = layers.findIndex((l) => l.id === id)
  if (i < 1) return null
  const [below, above] = [layers[i - 1], layers[i]]
  const a = await decodeLayer(below.source, t.width, t.height)
  const b = await decodeLayer(above.source, t.width, t.height)
  if (!a || !b) return null
  const c = document.createElement('canvas')
  c.width = Math.max(1, t.width)
  c.height = Math.max(1, t.height)
  const ctx = c.getContext('2d')
  if (!ctx) return null
  // each is drawn at its own opacity, so the merged layer, at full strength, looks as the two did
  if (below.visible) {
    ctx.globalAlpha = below.opacity
    ctx.drawImage(a, 0, 0)
  }
  if (above.visible) {
    ctx.globalAlpha = above.opacity
    ctx.drawImage(b, 0, 0)
  }
  const merged: TextureLayer = { ...below, source: c.toDataURL('image/png'), visible: true, opacity: 1 }
  return [...layers.slice(0, i - 1), merged, ...layers.slice(i + 1)]
}
