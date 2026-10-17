/* An Ogg Vorbis encoder, mono only. Minecraft reads its sounds as Ogg Vorbis
   and no browser writes that format, so the sound console carries its own.

   It is the smallest Vorbis that sounds right: one block size, one mode, a
   floor 1 curve per block and a residue 1 with five partition classes. The
   codebooks are fitted to each file. The first pass quantizes every block and
   counts what each book will be asked to say, then the books are built from
   those counts and written into the setup header, and the second pass writes
   the packets with them. A short sound gets books made for that sound.

   Every rule here is the decoder's rule run backwards, so the comments name
   the part of the Vorbis I specification each step answers to. */

import { OggWriter } from './ogg'

export type VorbisOptions = {
  sampleRate: number
  /** 0 to 1. Higher keeps more detail and makes a bigger file. */
  quality?: number
  vendor?: string
  comments?: Record<string, string>
}

const BLOCK = 2048 // samples per block; both of the stream's block sizes
const HALF = BLOCK / 2
const RANGE = 128 // floor 1 with multiplier 2: Y values 0..127, 1 dB-ish steps
const MULT = 2
const PART = 16 // residue partition size
const K = 40 // the coarse residue book reaches ±31K

/* ---------------- bits, packed least significant first ---------------- */

class Bits {
  private buf = new Uint8Array(1024)
  private n = 0 // bits written

  write(value: number, bits: number) {
    for (let i = 0; i < bits; i++) {
      const byte = this.n >> 3
      if (byte >= this.buf.length) {
        const next = new Uint8Array(this.buf.length * 2)
        next.set(this.buf)
        this.buf = next
      }
      // `value` may be wider than 31 bits; divide instead of shifting
      const bit = Math.floor(value / 2 ** i) & 1
      if (bit) this.buf[byte] |= 1 << (this.n & 7)
      this.n++
    }
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, (this.n + 7) >> 3)
  }
}

const ilog = (x: number) => {
  let n = 0
  while (x > 0) {
    n++
    x = Math.floor(x / 2)
  }
  return n
}

/* The 32-bit float of the codebook header: 21-bit mantissa, 10-bit exponent
   biased by 788, sign on top. Every value written here is a small integer. */
function vorbisFloat(v: number): number {
  const m = Math.abs(Math.round(v))
  return (v < 0 ? 0x80000000 : 0) + 788 * 2 ** 21 + m
}

/* ---------------- codebooks ---------------- */

type Lookup = { min: number; delta: number; mults: number[] }

type Book = {
  dim: number
  entries: number
  lookup: Lookup | null
  counts: Float64Array
  lengths: Uint8Array
  codes: Uint32Array
}

function book(dim: number, entries: number, lookup: Lookup | null = null): Book {
  return {
    dim,
    entries,
    lookup,
    counts: new Float64Array(entries),
    lengths: new Uint8Array(entries),
    codes: new Uint32Array(entries),
  }
}

/** Huffman code lengths for the counts. Every entry gets a code, so the tree is full. */
function huffmanLengths(counts: Float64Array, limit = 24): Uint8Array {
  let w = Array.from(counts, (c) => c + 1)
  for (;;) {
    const lengths = new Uint8Array(w.length)
    type Node = { w: number; leaves: number[] }
    let nodes: Node[] = w.map((x, i) => ({ w: x, leaves: [i] }))
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.w - b.w)
      const [a, b] = nodes
      for (const l of a.leaves) lengths[l]++
      for (const l of b.leaves) lengths[l]++
      nodes = [{ w: a.w + b.w, leaves: a.leaves.concat(b.leaves) }, ...nodes.slice(2)]
    }
    if (Math.max(...lengths) <= limit) return lengths
    // too deep: flatten the counts and build again
    w = w.map((x) => Math.floor(x / 2) + 1)
  }
}

/* Codewords from lengths, in entry order, the way the decoder makes them
   (section 3.2.1): each entry takes the lowest free codeword of its length. */
function assignCodes(b: Book) {
  const marker = new Uint32Array(33)
  for (let i = 0; i < b.entries; i++) {
    const len = b.lengths[i]
    let entry = marker[len]
    if (len < 32 && entry >>> len) throw new Error('codebook is overspecified')
    b.codes[i] = entry
    for (let j = len; j > 0; j--) {
      if (marker[j] & 1) {
        marker[j] = j === 1 ? marker[1] + 1 : marker[j - 1] << 1
        break
      }
      marker[j]++
    }
    for (let j = len + 1; j < 33; j++) {
      if (marker[j] >>> 1 === entry) {
        entry = marker[j]
        marker[j] = marker[j - 1] << 1
      } else break
    }
  }
}

function finish(b: Book) {
  b.lengths = huffmanLengths(b.counts)
  assignCodes(b)
}

/** A codeword goes out most significant bit first. */
function put(out: Bits, b: Book, entry: number) {
  const len = b.lengths[entry]
  const code = b.codes[entry]
  for (let i = len - 1; i >= 0; i--) out.write((code >>> i) & 1, 1)
}

function writeBook(out: Bits, b: Book) {
  out.write(0x564342, 24)
  out.write(b.dim, 16)
  out.write(b.entries, 24)
  out.write(0, 1) // not ordered
  out.write(0, 1) // not sparse: every entry has a length
  for (let i = 0; i < b.entries; i++) out.write(b.lengths[i] - 1, 5)
  if (!b.lookup) {
    out.write(0, 4)
    return
  }
  const bits = Math.max(1, ilog(Math.max(...b.lookup.mults)))
  out.write(1, 4)
  out.write(vorbisFloat(b.lookup.min), 32)
  out.write(vorbisFloat(b.lookup.delta), 32)
  out.write(bits - 1, 4)
  out.write(0, 1) // not a sequence
  for (const m of b.lookup.mults) out.write(m, bits)
}

/* ---------------- the books this encoder uses ---------------- */

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function makeBooks() {
  return {
    floor: book(1, RANGE),
    classes: book(1, 5),
    // residue class 1: four values of -1..1 per codeword
    tiny: book(4, 81, { min: -1, delta: 1, mults: range(3) }),
    // class 2: two values of -4..4
    small: book(2, 81, { min: -4, delta: 1, mults: range(9) }),
    // class 3, and the second pass of class 4: one value of -15..15
    fine: book(1, 31, { min: -15, delta: 1, mults: range(31) }),
    // class 4's first pass: a multiple of 31
    coarse: book(1, 2 * K + 1, { min: -31 * K, delta: 31, mults: range(2 * K + 1) }),
  }
}

type Books = ReturnType<typeof makeBooks>
const ORDER: (keyof Books)[] = ['floor', 'classes', 'tiny', 'small', 'fine', 'coarse']
const index = (k: keyof Books) => ORDER.indexOf(k)
const MAXV = 31 * K + 15

/* ---------------- floor 1 ---------------- */

/* Posts spread geometrically, densest in the bass where the ear is, then put
   in coarse-to-fine order so each post is predicted from close neighbours. */
const POSTS: number[] = (() => {
  const inner: number[] = []
  const n = 32
  for (let i = 0; i < n; i++) {
    const x = Math.round(Math.exp(Math.log(2) + (Math.log(HALF - 24) - Math.log(2)) * (i / (n - 1))))
    inner.push(Math.max(x, (inner[inner.length - 1] ?? 0) + 1))
  }
  const order: number[] = []
  const queue: [number, number][] = [[0, inner.length - 1]]
  while (queue.length) {
    const [lo, hi] = queue.shift()!
    if (lo > hi) continue
    const mid = (lo + hi) >> 1
    order.push(inner[mid])
    queue.push([lo, mid - 1], [mid + 1, hi])
  }
  return [0, HALF, ...order]
})()

const LOW: number[] = []
const HIGH: number[] = []
for (let i = 2; i < POSTS.length; i++) {
  let lo = 0
  let hi = 1
  for (let j = 0; j < i; j++) {
    if (POSTS[j] < POSTS[i] && POSTS[j] > POSTS[lo]) lo = j
    if (POSTS[j] > POSTS[i] && POSTS[j] < POSTS[hi]) hi = j
  }
  LOW[i] = lo
  HIGH[i] = hi
}
const SORTED = POSTS.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]).map((p) => p[1])

/* floor1_inverse_dB_table: 256 steps of about 0.55 dB up to 1.0 */
const STEP = -Math.log(1.0649863e-7) / 255
const DB = Float64Array.from({ length: 256 }, (_, i) => Math.exp((i - 255) * STEP))

function renderPoint(x0: number, y0: number, x1: number, y1: number, x: number) {
  const dy = y1 - y0
  const adx = x1 - x0
  const off = Math.trunc((Math.abs(dy) * (x - x0)) / adx)
  return dy < 0 ? y0 - off : y0 + off
}

function renderLine(x0: number, y0: number, x1: number, y1: number, out: Int32Array) {
  const dy = y1 - y0
  const adx = x1 - x0
  const base = Math.trunc(dy / adx)
  const sy = dy < 0 ? base - 1 : base + 1
  const ady = Math.abs(dy) - Math.abs(base * adx)
  let y = y0
  let err = 0
  const end = Math.min(x1, HALF)
  if (x0 < end) out[x0] = y
  for (let x = x0 + 1; x < end; x++) {
    err += ady
    if (err >= adx) {
      err -= adx
      y += sy
    } else y += base
    out[x] = y
  }
}

type Floor = { y0: number; y1: number; vals: number[]; curve: Float64Array }

/** Codes the wanted post heights (section 7.2.4) and returns what the decoder will draw. */
function fitFloor(want: number[]): Floor {
  const fin: number[] = [want[0], want[1]]
  const drawn: boolean[] = [true, true]
  const vals: number[] = []
  for (let i = 2; i < POSTS.length; i++) {
    const lo = LOW[i]
    const hi = HIGH[i]
    const p = renderPoint(POSTS[lo], fin[lo], POSTS[hi], fin[hi], POSTS[i])
    const hiroom = RANGE - p
    const loroom = p
    const room = Math.min(hiroom, loroom) * 2
    const t = want[i]
    const d = t - p
    let val: number
    if (d === 0) val = 0
    else if (d > 0 && 2 * d < room) val = 2 * d
    else if (d < 0 && -2 * d - 1 < room) val = -2 * d - 1
    else val = hiroom > loroom ? t : RANGE - 1 - t
    // run the decoder's rule so the encoder agrees with it exactly
    let y: number
    if (val === 0) y = p
    else if (val >= room) y = hiroom > loroom ? val - loroom + p : p - val + hiroom - 1
    else y = val & 1 ? p - ((val + 1) >> 1) : p + (val >> 1)
    if (val) drawn[lo] = drawn[hi] = true
    drawn[i] = val !== 0
    fin[i] = y
    vals.push(val)
  }
  const line = new Int32Array(HALF)
  let lx = 0
  let ly = Math.min(255, Math.max(0, fin[0] * MULT))
  for (let s = 1; s < SORTED.length; s++) {
    const i = SORTED[s]
    if (!drawn[i]) continue
    const hx = POSTS[i]
    const hy = Math.min(255, Math.max(0, fin[i] * MULT))
    renderLine(lx, ly, hx, hy, line)
    lx = hx
    ly = hy
  }
  for (let x = lx; x < HALF; x++) line[x] = ly
  return { y0: want[0], y1: want[1], vals, curve: Float64Array.from(line, (v) => DB[v]) }
}

/* ---------------- the transform ---------------- */

/* The Vorbis window: sin(π/2 · sin²(π(n+½)/N)). Squared, it and its
   neighbour add to one, so blocks overlap-add back to the signal. */
const WINDOW = Float64Array.from({ length: BLOCK }, (_, n) => {
  const s = Math.sin((Math.PI * (n + 0.5)) / BLOCK)
  return Math.sin((Math.PI / 2) * s * s)
})

/* Forward MDCT through a DCT-IV of half the length, done with a quarter-length
   complex FFT. Scaled by 4/N, which is what the decoders take back to the
   signal back. */
const Q = BLOCK / 4
const TW = (() => {
  const c = new Float64Array(Q)
  const s = new Float64Array(Q)
  for (let n = 0; n < Q; n++) {
    c[n] = Math.cos((Math.PI * (n + 0.125)) / (BLOCK / 2) * 1)
    s[n] = Math.sin((Math.PI * (n + 0.125)) / (BLOCK / 2) * 1)
  }
  return { c, s }
})()

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
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/** X[k] = 4/N Σ x[n] cos(2π/N (n + ½ + N/4)(k + ½)), for a windowed block. */
export function mdct(x: Float64Array): Float64Array {
  const M = HALF
  const v = new Float64Array(M)
  // fold the four quarters into a DCT-IV input
  for (let n = 0; n < Q; n++) {
    v[n] = -x[3 * Q - 1 - n] - x[3 * Q + n]
    v[Q + n] = x[n] - x[2 * Q - 1 - n]
  }
  // DCT-IV of length M through an M/2 complex FFT
  const re = new Float64Array(Q)
  const im = new Float64Array(Q)
  for (let n = 0; n < Q; n++) {
    const a = v[2 * n]
    const b = v[M - 1 - 2 * n]
    re[n] = a * TW.c[n] + b * TW.s[n]
    im[n] = b * TW.c[n] - a * TW.s[n]
  }
  fft(re, im)
  const out = new Float64Array(M)
  const scale = 4 / BLOCK
  for (let k = 0; k < Q; k++) {
    const r = re[k] * TW.c[k] + im[k] * TW.s[k]
    const i = im[k] * TW.c[k] - re[k] * TW.s[k]
    out[2 * k] = r * scale
    out[M - 1 - 2 * k] = -i * scale
  }
  return out
}

/** The same transform written out, for the tests to hold the fast one to. */
export function mdctDirect(x: Float64Array): Float64Array {
  const out = new Float64Array(HALF)
  for (let k = 0; k < HALF; k++) {
    let s = 0
    for (let n = 0; n < BLOCK; n++) s += x[n] * Math.cos(((2 * Math.PI) / BLOCK) * (n + 0.5 + BLOCK / 4) * (k + 0.5))
    out[k] = (s * 4) / BLOCK
  }
  return out
}

export const VORBIS_BLOCK = BLOCK

/* ---------------- one block ---------------- */

type Block = {
  silent: boolean
  floor: Floor | null
  classes: Uint8Array
  q: Int32Array
}

/* The floor follows the loudest line near each post, lowered by `scale`.
   The residue is the spectrum over the floor, rounded, so `scale` sets how
   fine the rounding is against the signal. */
function analyse(spec: Float64Array, scale: number): Block {
  const sortedX = SORTED.map((i) => POSTS[i])
  const peak = new Map<number, number>()
  for (let s = 0; s < sortedX.length; s++) {
    const x = sortedX[s]
    const a = s === 0 ? 0 : Math.ceil((sortedX[s - 1] + x) / 2)
    const b = s === sortedX.length - 1 ? HALF - 1 : Math.floor((x + sortedX[s + 1]) / 2)
    let m = 0
    for (let k = a; k <= Math.min(b, HALF - 1); k++) m = Math.max(m, Math.abs(spec[k]))
    peak.set(x, m)
  }
  const want = POSTS.map((x) => {
    // the ear hears rounding less in the treble, so it is coarser up there
    const a = peak.get(x)! * scale * (1 + 2 * (x / HALF) ** 1.5)
    if (a <= DB[0]) return 0
    const idx = 255 + Math.log(a) / STEP
    return Math.max(0, Math.min(RANGE - 1, Math.round(idx / MULT)))
  })
  const floor = fitFloor(want)
  const q = new Int32Array(HALF)
  let any = false
  for (let k = 0; k < HALF; k++) {
    const v = Math.round(spec[k] / floor.curve[k])
    q[k] = Math.max(-MAXV, Math.min(MAXV, v))
    if (q[k]) any = true
  }
  const classes = new Uint8Array(HALF / PART)
  for (let p = 0; p < classes.length; p++) {
    let m = 0
    for (let k = p * PART; k < (p + 1) * PART; k++) m = Math.max(m, Math.abs(q[k]))
    classes[p] = m === 0 ? 0 : m <= 1 ? 1 : m <= 4 ? 2 : m <= 15 ? 3 : 4
  }
  return { silent: !any, floor: any ? floor : null, classes, q }
}

/* Each block's codes, in the order the decoder reads them. `emit` is called
   with a book and an entry; the counting pass and the writing pass share it. */
function codes(b: Block, books: Books, emit: (bk: Book, entry: number) => void) {
  if (!b.floor) return
  for (const v of b.floor.vals) emit(books.floor, v)
  const coarse = (v: number) => Math.max(-K, Math.min(K, Math.round(v / 31)))
  for (let pass = 0; pass < 2; pass++) {
    for (let p = 0; p < b.classes.length; p++) {
      const c = b.classes[p]
      if (pass === 0) emit(books.classes, c)
      const at = p * PART
      if (pass === 0 && c === 1)
        for (let i = 0; i < PART; i += 4) {
          let e = 0
          for (let j = 3; j >= 0; j--) e = e * 3 + (b.q[at + i + j] + 1)
          emit(books.tiny, e)
        }
      if (pass === 0 && c === 2)
        for (let i = 0; i < PART; i += 2) emit(books.small, (b.q[at + i] + 4) + 9 * (b.q[at + i + 1] + 4))
      if (pass === 0 && c === 3) for (let i = 0; i < PART; i++) emit(books.fine, b.q[at + i] + 15)
      if (c === 4)
        for (let i = 0; i < PART; i++) {
          const d = coarse(b.q[at + i])
          if (pass === 0) emit(books.coarse, d + K)
          else emit(books.fine, b.q[at + i] - 31 * d + 15)
        }
    }
  }
}

/* ---------------- headers ---------------- */

function magic(out: Bits, type: number) {
  out.write(type, 8)
  for (const ch of 'vorbis') out.write(ch.charCodeAt(0), 8)
}

function identification(rate: number): Uint8Array {
  const out = new Bits()
  magic(out, 1)
  out.write(0, 32) // version
  out.write(1, 8) // channels
  out.write(rate, 32)
  out.write(0, 32) // bitrate maximum, nominal, minimum: unset
  out.write(0, 32)
  out.write(0, 32)
  out.write(ilog(BLOCK) - 1, 4)
  out.write(ilog(BLOCK) - 1, 4)
  out.write(1, 1)
  return out.bytes()
}

function comment(vendor: string, tags: Record<string, string>): Uint8Array {
  const out = new Bits()
  const enc = new TextEncoder()
  magic(out, 3)
  const v = enc.encode(vendor)
  out.write(v.length, 32)
  for (const c of v) out.write(c, 8)
  const list = Object.entries(tags).map(([k, val]) => enc.encode(`${k.toUpperCase()}=${val}`))
  out.write(list.length, 32)
  for (const t of list) {
    out.write(t.length, 32)
    for (const c of t) out.write(c, 8)
  }
  out.write(1, 1)
  return out.bytes()
}

function setup(books: Books): Uint8Array {
  const out = new Bits()
  magic(out, 5)
  out.write(ORDER.length - 1, 8)
  for (const k of ORDER) writeBook(out, books[k])
  out.write(0, 6) // one time-domain transform, a placeholder
  out.write(0, 16)

  // floor 1: eight partitions of class 0, which codes four posts with the floor book
  out.write(0, 6)
  out.write(1, 16)
  const parts = (POSTS.length - 2) / 4
  out.write(parts, 5)
  for (let i = 0; i < parts; i++) out.write(0, 4)
  out.write(4 - 1, 3) // dimensions
  out.write(0, 2) // no subclasses, so no master book
  out.write(index('floor') + 1, 8)
  out.write(MULT - 1, 2)
  out.write(ilog(HALF) - 1, 4)
  for (let i = 2; i < POSTS.length; i++) out.write(POSTS[i], ilog(HALF) - 1)

  // residue 1 over the whole half-block
  out.write(0, 6)
  out.write(1, 16)
  out.write(0, 24)
  out.write(HALF, 24)
  out.write(PART - 1, 24)
  out.write(5 - 1, 6)
  out.write(index('classes'), 8)
  const cascade = [[], ['tiny'], ['small'], ['fine'], ['coarse', 'fine']] as (keyof Books)[][]
  for (const c of cascade) {
    out.write((1 << c.length) - 1, 3)
    out.write(0, 1)
  }
  for (const c of cascade) for (const k of c) out.write(index(k), 8)

  // one mapping, one submap, no coupling
  out.write(0, 6)
  out.write(0, 16)
  out.write(0, 1)
  out.write(0, 1)
  out.write(0, 2)
  out.write(0, 8)
  out.write(0, 8)
  out.write(0, 8)

  // one mode: the one block size
  out.write(0, 6)
  out.write(0, 1)
  out.write(0, 16)
  out.write(0, 16)
  out.write(0, 8)
  out.write(1, 1)
  return out.bytes()
}

/* ---------------- the stream ---------------- */

/** How fine the residue rounding is, from quality 0..1. */
const scaleFor = (quality: number) => 0.35 * Math.pow(0.06, Math.max(0, Math.min(1, quality)))

/**
 * Encodes mono samples (-1..1) as Ogg Vorbis. The stream's granule positions
 * trim it to exactly `samples.length` samples.
 */
export function encodeVorbis(samples: Float32Array, opts: VorbisOptions): Uint8Array {
  const scale = scaleFor(opts.quality ?? 0.6)
  const total = samples.length
  // packet k covers samples (k-1)·N/2 .. (k+1)·N/2; the decoder returns
  // k·N/2 samples after it, so packets run until that passes the end
  const packets = Math.ceil(total / HALF) + 1
  const blocks: Block[] = []
  const frame = new Float64Array(BLOCK)
  for (let k = 0; k < packets; k++) {
    const start = (k - 1) * HALF
    for (let n = 0; n < BLOCK; n++) {
      const i = start + n
      frame[n] = i >= 0 && i < total ? samples[i] * WINDOW[n] : 0
    }
    blocks.push(analyse(mdct(frame), scale))
  }

  const books = makeBooks()
  for (const b of blocks) codes(b, books, (bk, e) => (bk.counts[e] += 1))
  for (const k of ORDER) finish(books[k])

  const ogg = new OggWriter()
  ogg.packet(identification(opts.sampleRate), 0, { bos: true, flush: true })
  ogg.packet(comment(opts.vendor ?? 'Vellum sound console', opts.comments ?? {}), 0)
  ogg.packet(setup(books), 0, { flush: true })
  blocks.forEach((b, k) => {
    const out = new Bits()
    out.write(0, 1) // audio packet; one mode, so no mode bits
    if (!b.floor) out.write(0, 1)
    else {
      out.write(1, 1)
      out.write(b.floor.y0, ilog(RANGE - 1))
      out.write(b.floor.y1, ilog(RANGE - 1))
    }
    codes(b, books, (bk, e) => put(out, bk, e))
    const last = k === blocks.length - 1
    ogg.packet(out.bytes(), Math.min(total, k * HALF), { eos: last })
  })
  return ogg.bytes()
}
