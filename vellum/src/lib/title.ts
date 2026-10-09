/* A server's name as a title card: blocky letters with a stepped 3D edge,
   after the way the game's logo is built but in Vellum's own 5x7 letters,
   and in colours drawn from the server. The id seeds the colours and the
   grain, so a server keeps its title. Drawn one art pixel at a time and
   scaled up whole, like the server icons. */

import { hash2, seeded } from './pip/pixels'

/* ---------------- colours ---------------- */

export type Rgb = [number, number, number]

export type ServerColours = {
  /** the face, left to right across the name */
  from: Rgb
  to: Rgb
  /** the lit top edge of each stroke */
  top: Rgb
  /** the stepped edge, near and far */
  side: Rgb
  sideDeep: Rgb
  outline: Rgb
  /** Pip, when he walks into this server */
  pip: Rgb
}

export function hsl(h: number, s: number, l: number): Rgb {
  const S = s / 100
  const L = l / 100
  const k = (n: number) => (n + (((h % 360) + 360) % 360) / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

export const css = ([r, g, b]: Rgb, a = 1) => (a >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`)

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

/** Colours for a server: its icon's hue, and a second hue a random distance away. */
export function serverColours(id: string, hue: number): ServerColours {
  const rand = seeded(seedOf(id))
  const h1 = hue + (rand() - 0.5) * 24
  const h2 = h1 + (rand() < 0.5 ? -1 : 1) * (40 + rand() * 50)
  const s1 = 62 + rand() * 20
  const s2 = 58 + rand() * 22
  return {
    from: hsl(h1, s1, 64 + rand() * 8),
    to: hsl(h2, s2, 54 + rand() * 8),
    top: hsl(h1, s1 - 12, 86),
    side: hsl(h2, 38, 28),
    sideDeep: hsl(h2, 42, 15),
    outline: hsl(h2, 45, 6),
    pip: hsl(h1, 70, 84),
  }
}

/* ---------------- letters ---------------- */

/* 5x7, '#' is on. Thin glyphs are narrower. Anything missing draws as '?'. */
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '.', '#', '#'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '&': ['.##..', '#..#.', '.##..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
}

/* Already bold, 7 wide: thickening these the usual way closes them up. */
const BOLD: Record<string, string[]> = {
  M: ['##...##', '###.###', '##.#.##', '##...##', '##...##', '##...##', '##...##'],
  N: ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##'],
  W: ['##...##', '##...##', '##...##', '##.#.##', '##.#.##', '###.###', '##...##'],
}

const ROWS = 7
/** how far the stepped edge reaches, down and right */
const DEPTH = 3

/** The title as an RGBA image, one art pixel per value. */
export type TitleImage = { w: number; h: number; data: Uint8ClampedArray<ArrayBuffer> }

/** Letters are drawn bold: every lit pixel also lights the one to its right, except in BOLD's. */
function layout(text: string) {
  const chars = [...text.toUpperCase().replace(/[‘’]/g, "'")]
  const glyphs = chars.map((c) => (BOLD[c] ? { rows: BOLD[c], thicken: 0 } : { rows: GLYPHS[c] ?? GLYPHS['?'], thicken: 1 }))
  const widths = glyphs.map((g) => g.rows[0].length + g.thicken)
  const width = widths.reduce((a, b) => a + b, 0) + Math.max(0, glyphs.length - 1)
  const on = new Uint8Array(width * ROWS)
  let x0 = 0
  glyphs.forEach((g, i) => {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < g.rows[y].length; x++) {
        if (g.rows[y][x] !== '#') continue
        for (let t = 0; t <= g.thicken; t++) on[y * width + x0 + x + t] = 1
      }
    }
    x0 += widths[i] + 1
  })
  return { on, width }
}

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * k),
  Math.round(a[1] + (b[1] - a[1]) * k),
  Math.round(a[2] + (b[2] - a[2]) * k),
]
const shade = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as Rgb

/** Draws `text` with a 1px outline, a stepped edge DEPTH deep, and a grained face. */
export function renderTitle(text: string, colours: ServerColours, id: string): TitleImage {
  const { on: face, width } = layout(text)
  const pad = 1
  const w = width + DEPTH + pad * 2
  const h = ROWS + DEPTH + pad * 2
  const at = (x: number, y: number) => y * w + x
  const inFace = (x: number, y: number) => {
    const fx = x - pad
    const fy = y - pad
    return fx >= 0 && fy >= 0 && fx < width && fy < ROWS && face[fy * width + fx] === 1
  }

  // which step of the edge a pixel belongs to: 0 for none
  const step = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inFace(x, y)) continue
      for (let d = 1; d <= DEPTH; d++) {
        if (inFace(x - d, y - d)) {
          step[at(x, y)] = d
          break
        }
      }
    }
  }
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (inFace(x, y) || step[at(x, y)] > 0)

  const data = new Uint8ClampedArray(w * h * 4)
  const put = (x: number, y: number, c: Rgb) => {
    const i = at(x, y) * 4
    data[i] = c[0]
    data[i + 1] = c[1]
    data[i + 2] = c[2]
    data[i + 3] = 255
  }
  const seed = seedOf(id)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inFace(x, y)) {
        const across = width > 1 ? (x - pad) / (width - 1) : 0
        let c = mix(colours.from, colours.to, across)
        // lit from above: the top rows are lighter, the bottom rows darker
        const row = y - pad
        c = shade(c, 1.1 - (row / (ROWS - 1)) * 0.28)
        // a stone-like grain, fixed per server
        c = shade(c, 0.93 + hash2(x + seed, y * 7 + seed) * 0.14)
        if (!inFace(x, y - 1)) c = mix(c, colours.top, 0.55)
        else if (!inFace(x, y + 1)) c = shade(c, 0.86)
        put(x, y, c)
      } else if (step[at(x, y)]) {
        const d = step[at(x, y)]
        put(x, y, mix(colours.side, colours.sideDeep, (d - 1) / Math.max(1, DEPTH - 1)))
      } else {
        // the outline: any empty pixel touching the letters or their edge
        let near = false
        for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) near = solid(x + i, y + j)
        if (near) put(x, y, colours.outline)
      }
    }
  }
  return { w, h, data }
}
