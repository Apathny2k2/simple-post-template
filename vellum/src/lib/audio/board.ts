/* The sound board: the sounds a person has made, kept in this browser, and
   how they leave it. A sound exports as Ogg Vorbis, one file per variant,
   and the whole board as a resource pack:

       pack.mcmeta
       assets/<namespace>/sounds.json
       assets/<namespace>/sounds/<group>/<name><n>.ogg
       assets/<namespace>/lang/en_us.json        <- the subtitles

   The game picks one of an event's files at random each time it plays it,
   which is why a sound can export as several variants. */

import { encodeVorbis } from './vorbis'
import { RATE, layerEnd, render, variantShifts } from './synth'
import type { SampleData, Samples, Sound } from './synth'
import { fromPreset, presets } from './presets'
import { makeZip } from '../zip'
import type { ZipEntry } from '../zip'

export type Board = {
  sounds: Sound[]
  namespace: string
  /** 0..1, as the encoder takes it */
  quality: number
  packFormat: number
  description: string
}

const KEY = 'vellum.sounds.v1'
const SAMPLE_KEY = 'vellum.sounds.samples.v1'

/** A first board: a few presets to play with. */
export function starterBoard(): Board {
  const pick = ['Orb chime', 'Pickup pop', 'Wood knock', 'Explosion', 'Teleport', 'Groan', 'Bell', 'Splash']
  return {
    sounds: pick.map((n) => fromPreset(presets.find((p) => p.name === n)!)),
    namespace: 'vellum',
    quality: 0.5,
    packFormat: 84,
    description: 'Sounds made in Vellum',
  }
}

export function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const b = JSON.parse(raw) as Board
      if (Array.isArray(b.sounds)) return { ...starterBoard(), ...b }
    }
  } catch {
    // private windows and blocked storage start from the starter board
  }
  return starterBoard()
}

export function saveBoard(b: Board): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(b))
    return true
  } catch {
    return false
  }
}

/* Samples are kept as 16-bit PCM in base64: half the size of the floats,
   and well past what a sound effect needs. */
function toBase64(data: Float32Array): string {
  const pcm = new Int16Array(data.length)
  for (let i = 0; i < data.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)))
  const bytes = new Uint8Array(pcm.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1)
  return Float32Array.from(pcm, (v) => v / 32767)
}

export function loadSamples(): Samples {
  try {
    const raw = localStorage.getItem(SAMPLE_KEY)
    if (!raw) return {}
    const list = JSON.parse(raw) as Record<string, { name: string; rate: number; pcm: string }>
    return Object.fromEntries(Object.entries(list).map(([id, s]) => [id, { name: s.name, rate: s.rate, data: fromBase64(s.pcm) }]))
  } catch {
    return {}
  }
}

/** False when the browser would not keep them; the samples still work until the page closes. */
export function saveSamples(samples: Samples): boolean {
  try {
    const list = Object.fromEntries(
      Object.entries(samples).map(([id, s]) => [id, { name: s.name, rate: s.rate, pcm: toBase64(s.data) }]),
    )
    localStorage.setItem(SAMPLE_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

/** Longest sample kept, in seconds. A sound effect is rarely past a few. */
export const SAMPLE_MAX = 12

/** Decodes an audio file (wav, mp3, ogg, whatever the browser reads) to mono. */
export async function decodeSample(name: string, bytes: ArrayBuffer): Promise<SampleData> {
  const ctx = new OfflineAudioContext(1, 1, RATE)
  const buf = await ctx.decodeAudioData(bytes)
  const n = Math.min(buf.length, Math.round(SAMPLE_MAX * buf.sampleRate))
  const data = new Float32Array(n)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < n; i++) data[i] += ch[i] / buf.numberOfChannels
  }
  return { name, rate: buf.sampleRate, data }
}

/* ---------------- names ---------------- */

/** lowercase a-z, 0-9 and underscores: what a resource location takes */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sound'

export const eventOf = (s: Sound) => s.event?.trim() || `${slug(s.group)}.${slug(s.name)}`

/** An event takes dots between parts: `block.anvil_land`. */
export const isEvent = (e: string) => /^[a-z0-9_.-]+$/.test(e) && !e.startsWith('.') && !e.endsWith('.')

/** The files an event's variants are kept in, under `sounds/`, without `.ogg`. */
export function filesOf(s: Sound): string[] {
  const e = eventOf(s)
  const dot = e.lastIndexOf('.')
  const dir = dot > 0 ? e.slice(0, dot).replace(/\./g, '/') + '/' : ''
  const base = e.slice(dot + 1)
  const n = Math.max(1, s.variants ?? 1)
  return n === 1 ? [`${dir}${base}`] : Array.from({ length: n }, (_, i) => `${dir}${base}${i + 1}`)
}

/* ---------------- rendering for export ---------------- */

/** Each variant's samples: another seed, and a pitch across ±variation. */
export function renderVariants(s: Sound, samples: Samples): Float32Array[] {
  const n = Math.max(1, s.variants ?? 1)
  const shifts = variantShifts(n, n > 1 ? s.master.variation : 0)
  return shifts.map((shift, i) => render(s, { seed: s.seed + i * 104729, shift, samples }))
}

export function oggOf(data: Float32Array, s: Sound, quality: number): Uint8Array {
  return encodeVorbis(data, {
    sampleRate: RATE,
    quality,
    comments: { title: s.name, encoder: 'Vellum sound console' },
  })
}

/* ---------------- sounds.json ---------------- */

export function soundsJson(board: Board): Record<string, unknown> {
  const ns = board.namespace
  const out: Record<string, unknown> = {}
  for (const s of board.sounds) {
    const e = eventOf(s)
    // long sounds stream from disk rather than load whole, as music and ambience do
    const long = s.layers.some((l) => layerEnd(l) > 10)
    out[e] = {
      subtitle: `subtitles.${ns}.${e}`,
      sounds: filesOf(s).map((f) => (long ? { name: `${ns}:${f}`, stream: true } : `${ns}:${f}`)),
    }
  }
  return out
}

export function langJson(board: Board): Record<string, string> {
  return Object.fromEntries(board.sounds.map((s) => [`subtitles.${board.namespace}.${eventOf(s)}`, s.name]))
}

export type PackFile = { path: string; bytes: Uint8Array }

const text = (v: unknown) => new TextEncoder().encode(JSON.stringify(v, null, 2) + '\n')

/** Every file of the pack. Rendering and encoding the board takes a moment. */
export function buildSoundPack(board: Board, samples: Samples): PackFile[] {
  const ns = board.namespace
  const files: PackFile[] = [
    { path: 'pack.mcmeta', bytes: text({ pack: { pack_format: board.packFormat, description: board.description } }) },
    { path: `assets/${ns}/sounds.json`, bytes: text(soundsJson(board)) },
    { path: `assets/${ns}/lang/en_us.json`, bytes: text(langJson(board)) },
  ]
  for (const s of board.sounds) {
    const paths = filesOf(s)
    renderVariants(s, samples).forEach((data, i) => {
      files.push({ path: `assets/${ns}/sounds/${paths[i]}.ogg`, bytes: oggOf(data, s, board.quality) })
    })
  }
  return files
}

export const zipOf = (files: PackFile[]) => makeZip(files.map((f): ZipEntry => ({ path: f.path, bytes: f.bytes })))

/** Board problems that would stop the pack loading, by sound id ('' for the board). */
export function problems(board: Board): Map<string, string> {
  const out = new Map<string, string>()
  if (!/^[a-z0-9_.-]+$/.test(board.namespace)) out.set('', 'The namespace takes only a-z, 0-9, _ . and -')
  const seen = new Map<string, string>()
  for (const s of board.sounds) {
    const e = eventOf(s)
    if (!isEvent(e)) out.set(s.id, 'The event takes only a-z, 0-9, _ . and -')
    else if (seen.has(e)) out.set(s.id, `Another sound already exports as ${e}`)
    seen.set(e, s.id)
  }
  return out
}
