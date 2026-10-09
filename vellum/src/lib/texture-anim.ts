/* Animated textures. As in Blockbench and Java resource packs, an animated
   texture's image is a strip of frames from top to bottom, each the shape
   of the UV sheet: a 16 by 64 image over a 16 by 16 sheet holds four. UVs
   stay in one frame's space, so the rest of the app reads a frame where it
   read the whole image. */

import type { Model, Texture } from './model'

/** How many frames the image holds: its height over one frame's height, when that divides evenly. */
export function frameCount(t: Texture, model?: Pick<Model, 'resolution'>): number {
  const uw = t.uvWidth || model?.resolution.width || t.width
  const uh = t.uvHeight || model?.resolution.height || t.height
  if (!t.width || !uw || !uh) return 1
  const frameH = (t.width * uh) / uw
  const n = t.height / frameH
  return n >= 2 && Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : 1
}

/** One frame's height in the image's pixels. */
export function frameHeight(t: Texture, model?: Pick<Model, 'resolution'>): number {
  return t.height / frameCount(t, model)
}

/** The frames in the order they play, one entry per step. */
export function frameSequence(t: Texture, model?: Pick<Model, 'resolution'>): number[] {
  const n = frameCount(t, model)
  const a = t.animation
  const order = a?.order?.filter((i) => Number.isInteger(i) && i >= 0 && i < n)
  if (order?.length) return order
  const up = Array.from({ length: n }, (_, i) => i)
  if (a?.mode === 'backwards') return up.reverse()
  if (a?.mode === 'back_and_forth') return n > 2 ? [...up, ...up.slice(1, -1).reverse()] : up
  return up
}

/**
 * The frame showing `seconds` in, and with interpolation the next frame and
 * how far into it: the picture is `a` mixed toward `b` by `mix`.
 */
export function frameAt(t: Texture, seconds: number, model?: Pick<Model, 'resolution'>): { a: number; b: number; mix: number } {
  const seq = frameSequence(t, model)
  if (seq.length < 2) return { a: seq[0] ?? 0, b: seq[0] ?? 0, mix: 0 }
  const ticks = Math.max(0, seconds) * 20
  const per = Math.max(1, t.animation?.frameTime ?? 1)
  const step = ticks / per
  const i = Math.floor(step) % seq.length
  const a = seq[i]
  const b = seq[(i + 1) % seq.length]
  return { a, b, mix: t.animation?.interpolate ? step - Math.floor(step) : 0 }
}

/** Whether any texture of the model has more than one frame. */
export function hasAnimatedTextures(model: Model): boolean {
  return model.textures.some((t) => frameCount(t, model) > 1)
}

/**
 * What the renderer needs per texture to show a frame: v scale, the first
 * frame's v offset, the second's, and the mix between them. Fixed frames
 * win over the clock: Paint holds the frame being painted.
 */
export function textureFrames(model: Model, seconds: number, fixed?: ReadonlyMap<string, number> | null): Map<string, [number, number, number, number]> {
  const out = new Map<string, [number, number, number, number]>()
  for (const t of model.textures) {
    const n = frameCount(t, model)
    if (n < 2) continue
    const held = fixed ? (fixed.get(t.id) ?? 0) : undefined
    const f = held !== undefined ? { a: Math.min(n - 1, Math.max(0, held)), b: 0, mix: 0 } : frameAt(t, seconds, model)
    out.set(t.id, [1 / n, f.a / n, f.b / n, f.mix])
  }
  return out
}

/** A texture as a sheet's background, showing one frame of a strip. */
export function sheetImage(t: Texture | null | undefined, model?: Pick<Model, 'resolution'>, frame = 0): Record<string, string> {
  if (!t?.source) return {}
  const n = frameCount(t, model)
  const f = Math.max(0, Math.min(n - 1, frame))
  return {
    backgroundImage: `url(${t.source})`,
    backgroundSize: `100% ${n * 100}%`,
    backgroundPosition: n > 1 ? `0 ${(f / (n - 1)) * 100}%` : '0 0',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  }
}

/**
 * A strip rebuilt from some of its frames, in the order given (a frame may
 * repeat): how a frame is added (its index twice) or deleted (left out).
 * Returns a PNG data URL `width` wide and `picks.length` frames tall.
 */
export async function restack(source: string, width: number, frameH: number, height: number, picks: readonly number[]): Promise<string> {
  const { decodeLayer } = await import('./layers')
  const from = await decodeLayer(source, width, height)
  const out = document.createElement('canvas')
  out.width = Math.max(1, width)
  out.height = Math.max(1, Math.round(frameH * picks.length))
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.imageSmoothingEnabled = false
  if (from) picks.forEach((f, i) => ctx.drawImage(from, 0, f * frameH, width, frameH, 0, i * frameH, width, frameH))
  return out.toDataURL('image/png')
}
