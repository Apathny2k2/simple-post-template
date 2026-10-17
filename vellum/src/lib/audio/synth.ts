/* The sound console's synth. A sound is a stack of layers mixed into one
   mono track, then echo, reverb and a level. Each layer is one source (an
   oscillator, a plucked string, a noise, a crackle or an imported sample)
   with a pitch glide, an envelope, a filter or vowel sweep, modulation,
   drive, a bit crusher and repeats.

   It renders offline, sample by sample, in plain code rather than through
   Web Audio. A sound then sounds the same everywhere, the export is the
   preview, and a seed makes the noise and the jitter repeatable. */

export type Wave = 'sine' | 'triangle' | 'square' | 'saw' | 'pluck' | 'noise' | 'hiss' | 'rumble' | 'crackle' | 'sample'
export type FilterType = 'off' | 'lowpass' | 'highpass' | 'bandpass' | 'vowel'

export type Layer = {
  id: string
  name: string
  muted: boolean
  solo: boolean
  wave: Wave
  /** the imported sample a `sample` layer plays */
  sample?: string
  /** start and length, in seconds */
  at: number
  length: number
  gain: number
  /** Hz at the start and the end; for a sample, 440 plays it at its own speed */
  pitch: number
  pitchEnd: number
  /** -1..1: below 0 the glide starts slow, above 0 it starts fast */
  glide: number
  /** pulse width of the square, 0.05..0.95 */
  duty: number
  /** 0..1: how long a pluck keeps its top end, from a thud to a wire */
  bright: number
  attack: number
  decay: number
  sustain: number
  release: number
  vibratoRate: number
  /** semitones */
  vibratoDepth: number
  tremoloRate: number
  tremoloDepth: number
  fmRatio: number
  fmIndex: number
  filter: FilterType
  cutoff: number
  cutoffEnd: number
  resonance: number
  /** the vowel filter's position at the start and the end: 0 i, 1 e, 2 a, 3 o, 4 u */
  vowel: number
  vowelEnd: number
  /** the vowel filter's formants scaled: below 1 a bigger throat, above 1 a smaller one */
  throat: number
  drive: number
  crush: number
  repeats: number
  /** seconds between repeats */
  gap: number
  /** each repeat's level against the one before */
  repeatDecay: number
  /** semitones each repeat moves */
  repeatPitch: number
  /** semitones of random pitch per repeat */
  jitter: number
}

export type Master = {
  gain: number
  echoTime: number
  echoFeedback: number
  echoMix: number
  reverbSize: number
  reverbMix: number
  normalize: boolean
  /** semitones of random pitch between variants */
  variation: number
}

/** The game's own sound a sound imitates, to compare it with. */
export type Vanilla = {
  /** the sound event, without `minecraft:` */
  event: string
  /** the pitch the game usually plays it at; /playsound needs it to compare fairly */
  pitch: number
  /** what it sounds like, in a few words */
  like: string
}

export type Sound = {
  id: string
  name: string
  group: string
  layers: Layer[]
  master: Master
  seed: number
  /** the sound event it exports as, such as `block.anvil_land`; unset, from the group and name */
  event?: string
  /** how many files the export writes, each a little different */
  variants?: number
  /** the vanilla sound a preset was made to sound like */
  vanilla?: Vanilla
}

export type SampleData = { name: string; rate: number; data: Float32Array }
export type Samples = Record<string, SampleData>

export const RATE = 44100

export const WAVES: { id: Wave; label: string }[] = [
  { id: 'sine', label: 'Sine' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'square', label: 'Square' },
  { id: 'saw', label: 'Saw' },
  { id: 'pluck', label: 'Pluck' },
  { id: 'noise', label: 'Noise' },
  { id: 'hiss', label: 'Hiss' },
  { id: 'rumble', label: 'Rumble' },
  { id: 'crackle', label: 'Crackle' },
  { id: 'sample', label: 'Sample' },
]

/** Pitch means nothing to the two plain noises. For a crackle it is clicks a second. */
export const pitched = (w: Wave) => w !== 'hiss' && w !== 'rumble'

let next = 0
export const uid = (p: string) => `${p}${Date.now().toString(36)}${(next++).toString(36)}`

export function layer(over: Partial<Layer> = {}): Layer {
  return {
    id: uid('l'),
    name: 'Layer',
    muted: false,
    solo: false,
    wave: 'sine',
    at: 0,
    length: 0.4,
    gain: 0.8,
    pitch: 440,
    pitchEnd: 440,
    glide: 0,
    duty: 0.5,
    bright: 0.5,
    attack: 0.005,
    decay: 0.2,
    sustain: 0.4,
    release: 0.08,
    vibratoRate: 0,
    vibratoDepth: 0,
    tremoloRate: 0,
    tremoloDepth: 0,
    fmRatio: 2,
    fmIndex: 0,
    filter: 'off',
    cutoff: 2000,
    cutoffEnd: 2000,
    resonance: 0.7,
    vowel: 2,
    vowelEnd: 2,
    throat: 1,
    drive: 0,
    crush: 0,
    repeats: 1,
    gap: 0.1,
    repeatDecay: 0.8,
    repeatPitch: 0,
    jitter: 0,
    ...over,
  }
}

export function master(over: Partial<Master> = {}): Master {
  return {
    gain: 0.9,
    echoTime: 0.18,
    echoFeedback: 0.3,
    echoMix: 0,
    reverbSize: 0.5,
    reverbMix: 0,
    normalize: true,
    variation: 1,
    ...over,
  }
}

/* ---------------- randomness ---------------- */

/** mulberry32: small, fast and the same in every browser */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------------- pieces ---------------- */

const TAU = Math.PI * 2

/** 0..1 through a glide; `g` above 0 moves fast first, below 0 slow first */
function shape(u: number, g: number) {
  if (g > 0) return 1 - Math.pow(1 - u, 1 + g * 4)
  if (g < 0) return Math.pow(u, 1 - g * 4)
  return u
}

/* PolyBLEP smooths the step in a saw or square, so a high note does not fold
   back into the band as hiss. */
function blep(t: number, dt: number) {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

/** The envelope at time t of one hit lasting `len`. */
function envelope(l: Layer, t: number, len: number) {
  if (t < 0 || t >= len) return 0
  const att = Math.max(0.0005, l.attack)
  let v: number
  if (t < att) v = t / att
  else {
    // the decay reaches the sustain level in about `decay` seconds
    const tau = Math.max(0.001, l.decay) / 5
    v = l.sustain + (1 - l.sustain) * Math.exp(-(t - att) / tau)
  }
  const rel = Math.min(Math.max(0.001, l.release), len)
  if (t > len - rel) {
    const r = (len - t) / rel
    v *= r * r
  }
  return v
}

/* Formants of a man's voice (Peterson and Barney), in the order the vowel
   knob runs: front to back, so a sweep between neighbours sounds natural. */
const VOWELS = [
  [270, 2290, 3010], // i, as in "beet"
  [530, 1840, 2480], // e, as in "bet"
  [730, 1090, 2440], // a, as in "father"
  [570, 840, 2410], // o, as in "bought"
  [300, 870, 2240], // u, as in "boot"
]
const FORMANT_BW = [80, 90, 120]
const FORMANT_GAIN = [1, 0.6, 0.3]

function formants(v: number, throat: number) {
  const x = Math.max(0, Math.min(4, v))
  const a = Math.min(3, Math.floor(x))
  const fr = x - a
  return VOWELS[a].map((f, i) => (f + (VOWELS[a + 1][i] - f) * fr) * throat)
}

class Biquad {
  b0 = 1
  b1 = 0
  b2 = 0
  a1 = 0
  a2 = 0
  x1 = 0
  x2 = 0
  y1 = 0
  y2 = 0

  /** The cookbook filters (Robert Bristow-Johnson). */
  set(type: FilterType, f: number, q: number, rate: number) {
    const w = (TAU * Math.min(f, rate * 0.45)) / rate
    const cs = Math.cos(w)
    const al = Math.sin(w) / (2 * Math.max(0.1, q))
    let b0 = 1
    let b1 = 0
    let b2 = 0
    if (type === 'lowpass') {
      b0 = (1 - cs) / 2
      b1 = 1 - cs
      b2 = (1 - cs) / 2
    } else if (type === 'highpass') {
      b0 = (1 + cs) / 2
      b1 = -(1 + cs)
      b2 = (1 + cs) / 2
    } else if (type === 'bandpass') {
      b0 = al
      b1 = 0
      b2 = -al
    }
    const a0 = 1 + al
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = (-2 * cs) / a0
    this.a2 = (1 - al) / a0
  }

  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

/* ---------------- one layer ---------------- */

/** How long a layer sounds, its repeats included. */
export const layerEnd = (l: Layer) => l.at + Math.max(0, l.repeats - 1) * l.gap + l.length

function renderHit(
  out: Float32Array,
  l: Layer,
  start: number,
  gain: number,
  pitchMul: number,
  rand: () => number,
  samples: Samples,
  rate: number,
) {
  const len = l.length
  const n0 = Math.round(start * rate)
  const n = Math.round(len * rate)
  const filter = new Biquad()
  const vowelBank = l.filter === 'vowel' ? [new Biquad(), new Biquad(), new Biquad()] : null
  const sample = l.wave === 'sample' && l.sample ? samples[l.sample] : undefined
  if (l.wave === 'sample' && !sample) return
  let phase = rand() // a fresh phase per hit keeps repeats from sounding pasted
  let mod = 0
  let held = 0 // the pitched noise's current value
  let brown = 0
  let samplePos = 0
  // the pluck's string: a delay line as long as one period, at most 20 Hz
  const ks = l.wave === 'pluck' ? new Float32Array(Math.ceil(rate / 20) + 4) : null
  let ksAt = 0
  let ksBurst = 0
  let ksLow = 0
  // the burst's average goes round the loop too, so the string's output is DC-blocked
  let ksX = 0
  let ksY = 0
  // the crackle's current click
  let click = 0
  let clickFall = 0
  let crushHold = 0
  let crushVal = 0
  const holdN = 1 + Math.floor(l.crush * l.crush * 16)
  const bits = Math.round(16 - l.crush * 13)
  const levels = 2 ** (bits - 1)
  const k = 1 + l.drive * 12
  const kNorm = Math.tanh(k)
  for (let i = 0; i < n; i++) {
    const idx = n0 + i
    if (idx >= out.length) break
    if (idx < 0) continue
    const t = i / rate
    const u = n > 1 ? i / (n - 1) : 0
    let f = l.pitch * Math.pow(l.pitchEnd / l.pitch, shape(u, l.glide)) * pitchMul
    if (l.vibratoDepth) f *= Math.pow(2, (l.vibratoDepth / 12) * Math.sin(TAU * l.vibratoRate * t))
    const dt = f / rate

    let s: number
    switch (l.wave) {
      case 'sine':
      case 'triangle':
      case 'square':
      case 'saw': {
        let p = phase
        if (l.fmIndex) p += (l.fmIndex * Math.sin(TAU * mod)) / TAU
        p -= Math.floor(p)
        if (l.wave === 'sine') s = Math.sin(TAU * p)
        else if (l.wave === 'triangle') s = 1 - 4 * Math.abs(p - 0.5)
        else if (l.wave === 'saw') s = 2 * p - 1 - blep(p, dt)
        else {
          const d = l.duty
          s = (p < d ? 1 : -1) + blep(p, dt) - blep((p - d + 1) % 1, dt)
        }
        break
      }
      case 'pluck': {
        /* Karplus-Strong: a burst of noise one period long goes round the
           delay line, and the two-point average on each pass takes the top
           off, as a plucked string loses it. */
        const buf = ks!
        const size = buf.length
        const period = Math.min(size - 3, rate / f)
        const back = ksAt - period
        const j = Math.floor(back)
        const fr = back - j
        const at = (k: number) => buf[((k % size) + size) % size]
        const a0 = at(j) * (1 - fr) + at(j + 1) * fr
        const a1 = at(j - 1) * (1 - fr) + at(j) * fr
        const soft = 0.5 - 0.48 * l.bright
        let y = (a0 * (1 - soft) + a1 * soft) * 0.9995
        if (ksBurst < period) {
          // the pluck itself: noise, darker when the string is dull
          ksLow += (rand() * 2 - 1 - ksLow) * (0.15 + 0.85 * l.bright)
          y += ksLow
          ksBurst++
        }
        buf[ksAt % size] = y
        ksAt++
        ksY = y - ksX + 0.998 * ksY
        ksX = y
        s = ksY
        break
      }
      case 'crackle': {
        // clicks at random, `f` a second on average, each a tiny burst of its own size
        if (rand() < f / rate) {
          const r = rand()
          click = (0.25 + 0.75 * r * r) * (rand() < 0.5 ? -1 : 1)
          clickFall = Math.exp(-1 / (rate * (0.0003 + rand() * 0.0025)))
        }
        s = click * (rand() * 2 - 1)
        click *= clickFall
        break
      }
      case 'noise': {
        // a new random value 32 times a cycle, so pitch sets how coarse it is
        const before = Math.floor(phase * 32)
        const after = Math.floor((phase + dt) * 32)
        if (after !== before || i === 0) held = rand() * 2 - 1
        s = held
        break
      }
      case 'hiss':
        s = rand() * 2 - 1
        break
      case 'rumble':
        brown = (brown + 0.02 * (rand() * 2 - 1)) * 0.998
        s = brown * 3.5
        break
      case 'sample': {
        const d = sample!.data
        const j = Math.floor(samplePos)
        if (j + 1 >= d.length) {
          s = 0
          break
        }
        const fr = samplePos - j
        s = d[j] * (1 - fr) + d[j + 1] * fr
        samplePos += (f / 440) * (sample!.rate / rate)
        break
      }
    }
    phase += dt
    if (phase >= 1) phase -= Math.floor(phase)
    mod += dt * l.fmRatio
    if (mod >= 1) mod -= Math.floor(mod)

    if (vowelBank) {
      if ((i & 15) === 0) {
        const fs = formants(l.vowel + (l.vowelEnd - l.vowel) * u, l.throat)
        // resonance 2 gives a voice's own bandwidths; less blurs the vowel, more rings
        for (let b = 0; b < 3; b++) vowelBank[b].set('bandpass', fs[b], (fs[b] / FORMANT_BW[b]) * (l.resonance / 2), rate)
      }
      s = vowelBank[0].run(s) * FORMANT_GAIN[0] + vowelBank[1].run(s) * FORMANT_GAIN[1] + vowelBank[2].run(s) * FORMANT_GAIN[2]
    } else if (l.filter !== 'off') {
      if ((i & 15) === 0) {
        const c = l.cutoff * Math.pow(l.cutoffEnd / l.cutoff, u)
        filter.set(l.filter, c, l.resonance, rate)
      }
      s = filter.run(s)
    }
    if (l.drive) s = Math.tanh(s * k) / kNorm
    if (l.crush) {
      if (crushHold-- <= 0) {
        crushHold = holdN - 1
        crushVal = Math.round(s * levels) / levels
      }
      s = crushVal
    }
    let a = envelope(l, t, len)
    if (l.tremoloDepth) a *= 1 - l.tremoloDepth * (0.5 + 0.5 * Math.sin(TAU * l.tremoloRate * t))
    out[idx] += s * a * gain
  }
}

/* ---------------- the master ---------------- */

/* A small Freeverb: eight damped combs into four allpasses. */
function reverb(x: Float32Array, size: number, rate: number): Float32Array {
  const scale = rate / 44100
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(d * scale * (0.6 + size)))
  const alls = [556, 441, 341, 225].map((d) => Math.round(d * scale))
  const fb = 0.7 + size * 0.28
  const damp = 0.3
  const out = new Float32Array(x.length)
  for (const d of combs) {
    const buf = new Float32Array(d)
    let at = 0
    let low = 0
    for (let i = 0; i < x.length; i++) {
      const y = buf[at]
      low = y * (1 - damp) + low * damp
      buf[at] = x[i] * 0.015 + low * fb
      out[i] += y
      at = at + 1 === d ? 0 : at + 1
    }
  }
  for (const d of alls) {
    const buf = new Float32Array(d)
    let at = 0
    for (let i = 0; i < out.length; i++) {
      const b = buf[at]
      const y = -out[i] + b
      buf[at] = out[i] + b * 0.5
      out[i] = y
      at = at + 1 === d ? 0 : at + 1
    }
  }
  return out
}

/** How long the echo and reverb ring past the last layer. */
function tail(m: Master) {
  let t = 0.02
  if (m.echoMix > 0 && m.echoFeedback > 0) t = Math.max(t, m.echoTime * Math.min(12, Math.log(0.001) / Math.log(m.echoFeedback)))
  else if (m.echoMix > 0) t = Math.max(t, m.echoTime)
  if (m.reverbMix > 0) t = Math.max(t, 0.6 + m.reverbSize * 3)
  return Math.min(t, 5)
}

export type RenderOptions = {
  rate?: number
  /** a different seed gives other noise and jitter: another variant */
  seed?: number
  /** semitones on top of every layer */
  shift?: number
  samples?: Samples
}

/** The sound as mono samples at `rate`, cut where it falls silent. */
export function render(sound: Sound, opts: RenderOptions = {}): Float32Array {
  const rate = opts.rate ?? RATE
  const samples = opts.samples ?? {}
  const rand = rng(opts.seed ?? sound.seed)
  const pitchMul = Math.pow(2, (opts.shift ?? 0) / 12)
  const solo = sound.layers.some((l) => l.solo)
  const live = sound.layers.filter((l) => (solo ? l.solo : !l.muted))
  const m = sound.master
  const end = Math.max(0.01, ...live.map(layerEnd)) + tail(m)
  const out = new Float32Array(Math.ceil(Math.min(end, 20) * rate))
  for (const l of live) {
    for (let r = 0; r < Math.max(1, Math.round(l.repeats)); r++) {
      const semis = l.repeatPitch * r + (l.jitter ? (rand() * 2 - 1) * l.jitter : 0)
      renderHit(out, l, l.at + r * l.gap, l.gain * Math.pow(l.repeatDecay, r), pitchMul * Math.pow(2, semis / 12), rand, samples, rate)
    }
  }
  if (m.echoMix > 0) {
    const d = Math.max(1, Math.round(m.echoTime * rate))
    const wet = new Float32Array(out.length)
    for (let i = d; i < out.length; i++) wet[i] = out[i - d] + wet[i - d] * m.echoFeedback
    for (let i = 0; i < out.length; i++) out[i] += wet[i] * m.echoMix
  }
  if (m.reverbMix > 0) {
    const wet = reverb(out, m.reverbSize, rate)
    for (let i = 0; i < out.length; i++) out[i] = out[i] * (1 - m.reverbMix * 0.5) + wet[i] * m.reverbMix
  }
  let peak = 0
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]))
  const g = (m.normalize && peak > 0 ? 0.89 / peak : 1) * m.gain
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] * g))
  // cut the silent end, then fade the last 5 ms so the cut never clicks
  let last = out.length - 1
  while (last > 0 && Math.abs(out[last]) < 1e-3) last--
  const keep = Math.min(out.length, last + Math.round(0.01 * rate))
  const res = out.slice(0, Math.max(1, keep))
  const fade = Math.min(res.length, Math.round(0.005 * rate))
  for (let i = 0; i < fade; i++) res[res.length - 1 - i] *= i / fade
  return res
}

/** Pitch offsets for `count` variants, spread evenly across ±variation. */
export function variantShifts(count: number, variation: number): number[] {
  if (count <= 1) return [0]
  return Array.from({ length: count }, (_, i) => variation * ((i / (count - 1)) * 2 - 1))
}

/** A sound copied with fresh ids, so the copy edits on its own. */
export function cloneSound(s: Sound, over: Partial<Sound> = {}): Sound {
  return {
    ...s,
    id: uid('s'),
    layers: s.layers.map((l) => ({ ...l, id: uid('l') })),
    master: { ...s.master },
    ...over,
  }
}
