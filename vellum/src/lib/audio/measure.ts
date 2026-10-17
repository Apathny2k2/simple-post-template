/* What a rendered sound is like, in numbers: how long it lasts, where its
   pitch starts and ends, how bright it is and how noisy. The tests hold each
   preset to the vanilla sound it imitates with these, so a preset cannot
   drift back into sounding like a chip tune without a test failing. */

export type Measure = {
  /** seconds until it has fallen 40 dB below its loudest: how long it is heard */
  length: number
  /** seconds to the loudest moment */
  peakAt: number
  /** fundamental in Hz near the start and the end of what is voiced, or 0 for a noise */
  pitchStart: number
  pitchEnd: number
  /** the share of loud frames that have a clear pitch, 0..1 */
  voiced: number
  /** spectral centroid in Hz, the median over the loud frames: how bright */
  brightness: number
  /** spectral flatness, the median over the loud frames: 0 a pure tone, 1 white noise */
  noisiness: number
}

const N = 2048
const HOP = 512

/** In-place radix-2 FFT of `re` and `im`, both of length N. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const ar = re[i + k + len / 2]
        const ai = im[i + k + len / 2]
        const tr = ar * wr - ai * wi
        const ti = ar * wi + ai * wr
        re[i + k + len / 2] = re[i + k] - tr
        im[i + k + len / 2] = im[i + k] - ti
        re[i + k] += tr
        im[i + k] += ti
      }
    }
  }
}

/** YIN's cumulative mean normalised difference: the period with the clearest repeat, and how clear. */
function yin(x: Float32Array, at: number, rate: number): { f: number; clarity: number } {
  const W = 1024
  const minLag = Math.floor(rate / 2000)
  const maxLag = Math.min(W - 1, Math.floor(rate / 50))
  const d = new Float64Array(maxLag + 1)
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < W; i++) {
      const a = x[at + i] ?? 0
      const b = x[at + i + lag] ?? 0
      sum += (a - b) * (a - b)
    }
    d[lag] = sum
  }
  let run = 0
  let best = -1
  let bestV = 1
  for (let lag = 1; lag <= maxLag; lag++) {
    run += d[lag]
    const v = run > 0 ? (d[lag] * lag) / run : 1
    d[lag] = v
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (d[lag] < 0.2) {
      // the bottom of the first dip under the threshold
      while (lag + 1 <= maxLag && d[lag + 1] < d[lag]) lag++
      best = lag
      bestV = d[lag]
      break
    }
  }
  if (best < 0) return { f: 0, clarity: 0 }
  // a parabola through the dip finds the period between samples
  const a = d[best - 1] ?? d[best]
  const c = d[best + 1] ?? d[best]
  const den = a - 2 * d[best] + c
  const shift = den ? (0.5 * (a - c)) / den : 0
  return { f: rate / (best + shift), clarity: 1 - bestV }
}

const median = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export function measure(x: Float32Array, rate: number): Measure {
  let peak = 0
  let peakAt = 0
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) > peak) {
      peak = Math.abs(x[i])
      peakAt = i
    }
  }
  // frames: loudness, brightness, noisiness and pitch
  const frames: { rms: number; centroid: number; flat: number; f: number; clarity: number; t: number }[] = []
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let at = 0; at + 256 < x.length; at += HOP) {
    let e = 0
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
      const v = x[at + i] ?? 0
      re[i] = v * w
      im[i] = 0
      e += v * v
    }
    fft(re, im)
    let num = 0
    let den = 0
    let logSum = 0
    let count = 0
    for (let k = 1; k < N / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k] + 1e-12
      const hz = (k * rate) / N
      num += hz * p
      den += p
      logSum += Math.log(p)
      count++
    }
    const { f, clarity } = yin(x, at, rate)
    frames.push({ rms: Math.sqrt(e / N), centroid: num / den, flat: Math.exp(logSum / count) / (den / count), f, clarity, t: at / rate })
  }
  const loudest = Math.max(...frames.map((f) => f.rms), 1e-9)
  let last = 0
  frames.forEach((f, i) => {
    if (f.rms >= loudest / 100) last = i
  })
  const loud = frames.filter((f) => f.rms > loudest * 0.15)
  const voicedFrames = loud.filter((f) => f.clarity > 0.75 && f.f > 0)
  const third = Math.max(1, Math.floor(voicedFrames.length / 3))
  return {
    length: Math.min(x.length, last * HOP + N / 2) / rate,
    peakAt: peakAt / rate,
    pitchStart: median(voicedFrames.slice(0, third).map((f) => f.f)),
    pitchEnd: median(voicedFrames.slice(-third).map((f) => f.f)),
    voiced: loud.length ? voicedFrames.length / loud.length : 0,
    brightness: median(loud.map((f) => f.centroid)),
    noisiness: median(loud.map((f) => f.flat)),
  }
}
