/** Rows of palette keys; `.` is transparent. Every sprite here is original art. */
export type Sprite = { rows: string[]; palette: Record<string, string> }

export type Run = { x: number; y: number; w: number; fill: string }

/** One rect per horizontal run of a colour instead of one per pixel. */
export function toRuns(rows: string[], palette: Record<string, string>, dx = 0, dy = 0): Run[] {
  const out: Run[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const fill = palette[row[x]]
      if (!fill) {
        x += 1
        continue
      }
      let w = 1
      while (x + w < row.length && row[x + w] === row[x]) w += 1
      out.push({ x: x + dx, y: y + dy, w, fill })
      x += w
    }
  })
  return out
}

const solidAt = (rows: string[], x: number, y: number) =>
  y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.'

/** A 1px ring around the shape, one pixel bigger on every side. */
function ringOf(rows: string[]): string[] {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const out: string[] = []
  for (let y = -1; y <= h; y++) {
    let line = ''
    for (let x = -1; x <= w; x++) {
      const edge =
        !solidAt(rows, x, y) &&
        (solidAt(rows, x - 1, y) || solidAt(rows, x + 1, y) || solidAt(rows, x, y - 1) || solidAt(rows, x, y + 1))
      line += edge ? 'o' : '.'
    }
    out.push(line)
  }
  return out
}

export function layout(sprite: Sprite, outline?: string) {
  const w = Math.max(...sprite.rows.map((r) => r.length))
  const h = sprite.rows.length
  if (!outline) return { w, h, runs: toRuns(sprite.rows, sprite.palette) }
  return {
    w: w + 2,
    h: h + 2,
    runs: [...toRuns(ringOf(sprite.rows), { o: outline }), ...toRuns(sprite.rows, sprite.palette, 1, 1)],
  }
}

/** A sprite as a CSS background, for tiles that repeat. */
export function spriteUri(sprite: Sprite): string {
  const { w, h, runs } = layout(sprite)
  const body = runs.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/* ---------------- a 5x7 pixel font for numbers ---------------- */

const GLYPHS: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '#...#', '....#', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.', '.', '.', '.', '.', '#', '#'],
  ':': ['.', '#', '#', '.', '#', '#', '.'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
}

export function textRows(text: string, gap = 1): string[] {
  const rows = ['', '', '', '', '', '', '']
  const space = '.'.repeat(gap)
  ;[...text].forEach((ch, i) => {
    const g = GLYPHS[ch] ?? GLYPHS[' ']
    for (let y = 0; y < 7; y++) rows[y] += (i ? space : '') + g[y]
  })
  return rows
}

/* ---------------- sprites ---------------- */

/* Isometric blocks use the game's fixed face shading: top 100%, left 80%, right 60%. */
const CUBE_STONE = [
  '......TTTT......',
  '....TTtTTTTT....',
  '..TTTTTTTTtTTT..',
  'TTtTTTTTTTTTTTtT',
  'LLTTTTTtTTTTTTRR',
  'LLlLTTTTTTTtRRrR',
  'LLLLLlTTTTRRRRRR',
  'LlLLLLLLRRRrRRRR',
  'LLLLlLLLRRRRRRrR',
  'LLLLLLLlRrRRRRRR',
  'LlLLLLLLRRRRrRRR',
  'LLLlLLLLRRRRRRRR',
  '..LLLLlLRRrRRR..',
  '....LLLLRRRR....',
  '......LLRR......',
]

export const STONE: Sprite = {
  rows: CUBE_STONE,
  palette: { T: '#b9b9b3', t: '#a3a39d', L: '#94948f', l: '#82827d', R: '#6f6f6b', r: '#5f5f5b' },
}

export const GRASS: Sprite = {
  rows: [
    '......TTTT......',
    '....TTtTTTTT....',
    '..TTTTTTTTtTTT..',
    'TTtTTTTTTTTTTTtT',
    'GGTTTTTtTTTTTTHH',
    'GGGGTTTTTTTtHHHH',
    'LLGGGGTTTTHHHHRR',
    'LLLLGGGGHHHHRRRR',
    'LlLLLLGGHHRRRrRR',
    'LLLLLLGLRHRRRRRR',
    'LLlLLLLLRRRRRrRR',
    'LLLLLlLLRRrRRRRR',
    '..LLLLLLRRRRRR..',
    '....LlLLRRRR....',
    '......LLRR......',
  ],
  palette: {
    T: '#7dbb4c', t: '#68a63c',
    G: '#64963d', H: '#4b7130',
    L: '#8e6645', l: '#76523a', R: '#6b4d34', r: '#583f2a',
  },
}

export const BONE: Sprite = {
  rows: [
    '................',
    '..........WW....',
    '..........WWWW..',
    '...........WWW..',
    '..........WWWWW.',
    '.........WWS.WW.',
    '........WWS.....',
    '.......WWS......',
    '......WWS.......',
    '.....WWS........',
    '.WW.WWS.........',
    '.WWWWS..........',
    '..WWW...........',
    '..WWWW..........',
    '....WW..........',
    '................',
  ],
  palette: { W: '#efe9d6', S: '#c7bea2' },
}

export const EGG: Sprite = {
  rows: [
    '......BBBB......',
    '.....hBBBBB.....',
    '....hBBSSBBB....',
    '....hBBSSBBD....',
    '...hBBBBBBBBD...',
    '...hSSBBBBBBD...',
    '...BSSBBBBSSD...',
    '...BBBBBBBSSD...',
    '...BBBBBBBBBD...',
    '...BBBSSBBBBD...',
    '....BBSSBBBD....',
    '....BBBBBBBD....',
    '.....BBBBBD.....',
    '......BBDD......',
  ],
  palette: { B: '#4fb58c', h: '#86dcb6', D: '#378262', S: '#1f5c44' },
}

export const SWORD: Sprite = {
  rows: [
    '.............EE.',
    '............EWE.',
    '...........EWE..',
    '..........EWE...',
    '.........EWE....',
    '........EWE.....',
    '...GG..EWE......',
    '....GGEWE.......',
    '.....GEE........',
    '....HGGG........',
    '...HH..G........',
    '..HH............',
    '.PP.............',
    '.PP.............',
  ],
  palette: { W: '#e3eaee', E: '#8c9ca6', G: '#8a6530', H: '#5b3d1e', P: '#8a6530' },
}

export const CRATE: Sprite = {
  rows: [
    '.OOOOOOOOOOOOOO.',
    'OLLLLLLLLLLLLLLO',
    'OLllllllllllllLO',
    'OLllllllllllllLO',
    'OLLLLLLLLLLLLLLO',
    'OOOOOOOOOOOOOOOO',
    'OLLLLLLGGLLLLLLO',
    'OLllllGggGllllLO',
    'OLllllGggGllllLO',
    'OLlllllGGlllllLO',
    'OLllllllllllllLO',
    'OLllllllllllllLO',
    'OLLLLLLLLLLLLLLO',
    '.OOOOOOOOOOOOOO.',
  ],
  palette: { O: '#4a3014', L: '#b88642', l: '#9b6b2f', G: '#f1c451', g: '#b58a24' },
}

export const PAPER: Sprite = {
  rows: [
    '..WWWWWWWFF.....',
    '..WWWWWWWFFF....',
    '..WLLLLLWFFFF...',
    '..WWWWWWWWWWW...',
    '..WLLLLLLLLWW...',
    '..WWWWWWWWWWW...',
    '..WLLLLLLLLWW...',
    '..WWWWWWWWWWW...',
    '..WLLLLLLWWWW...',
    '..WWWWWWWWWWW...',
    '..WWWWWWWWWWW...',
  ],
  palette: { W: '#f6f1e3', F: '#d9cfb6', L: '#aaa18b' },
}

export const BEACON: Sprite = {
  rows: [
    'FFFFFFFFFFFFFFFF',
    'FggggggggggggggF',
    'Fg............gF',
    'Fg...cccccc...gF',
    'Fg..cCCCCCCc..gF',
    'Fg..cCWWWWCc..gF',
    'Fg..cCWWWWCc..gF',
    'Fg..cCWWWWCc..gF',
    'Fg..cCCCCCCc..gF',
    'Fg...cccccc...gF',
    'Fg..DDDDDDDD..gF',
    'Fg.DDdDDDDdDD.gF',
    'Fg.DDDDdDDDDD.gF',
    'Fg............gF',
    'FggggggggggggggF',
    'FFFFFFFFFFFFFFFF',
  ],
  palette: {
    F: '#dff9ff', g: '#a6e4ef',
    c: '#58d8ea', C: '#9cf1fb', W: '#ffffff',
    D: '#2c2140', d: '#43335f',
  },
}

/** A plain stone-brick block for the beacon's base. */
export const BASE_BLOCK: Sprite = {
  rows: [
    'HHHHHHHHHHHHHHHH',
    'HMMMMMMMMMMMMMMD',
    'HMMMMMMMMMMMMMMD',
    'HMMMmMMMMMMMmMMD',
    'HMMMMMMMMMMMMMMD',
    'HMmMMMMMMmMMMMMD',
    'HMMMMMMMMMMMMMMD',
    'HMMMMMMmMMMMMMMD',
    'HMMMMMMMMMMMmMMD',
    'HMMmMMMMMMMMMMMD',
    'HMMMMMMMMmMMMMMD',
    'HMMMMMmMMMMMMMMD',
    'HMMMMMMMMMMMMmMD',
    'HMmMMMMMMMMMMMMD',
    'HMMMMMMMmMMMMMMD',
    'DDDDDDDDDDDDDDDD',
  ],
  palette: { H: '#e6e6e1', M: '#c9c9c3', m: '#b4b4ae', D: '#8d8d88' },
}

export const LAMP_OFF: Sprite = {
  rows: [
    'FFFFFFFFFFFFFFFF',
    'FaaaaaaaaaaaaaaF',
    'FaBBBBBaaBBBBBaF',
    'FaBbbbBaaBbbbBaF',
    'FaBbbbBaaBbbbBaF',
    'FaBBBBBaaBBBBBaF',
    'FaaaaaaaaaaaaaaF',
    'FaaaaaaaaaaaaaaF',
    'FaBBBBBaaBBBBBaF',
    'FaBbbbBaaBbbbBaF',
    'FaBbbbBaaBbbbBaF',
    'FaBBBBBaaBBBBBaF',
    'FaaaaaaaaaaaaaaF',
    'FaaaaaaaaaaaaaaF',
    'FFFFFFFFFFFFFFFF',
  ],
  palette: { F: '#3a2616', a: '#5d3d23', B: '#6e4a2c', b: '#4c321d' },
}

export const LAMP_ON: Sprite = {
  rows: LAMP_OFF.rows,
  palette: { F: '#7a4a1c', a: '#d98a2a', B: '#ffd36b', b: '#fff2b8' },
}

/* ---------------- people ---------------- */

const FIGURE = [
  '.HHHHHH.',
  'HHHHHHHH',
  'HSSSSSSH',
  'SESSSSES',
  'SSSSSSSS',
  '.SSSSSS.',
  '.TTTTTT.',
  'TTTTTTTT',
  'TTTTTTTT',
  'TTTTTTTT',
  'TTTTTTTT',
  'STTTTTTS',
  '.TTTTTT.',
  '.PPPPPP.',
  '.PPPPPP.',
  '.PP..PP.',
  '.PP..PP.',
  '.BB..BB.',
]

const HEAD = [
  'HHHHHHHH',
  'HHHHHHHH',
  'HSSSSSSH',
  'SWESSEWS',
  'SSSSSSSS',
  'SSSNNSSS',
  'SSMMMMSS',
  'SSSSSSSS',
]

const HAIR = ['#3b2a1a', '#6b4423', '#caa25e', '#1f1f22', '#9c4f2c', '#5a5a60']
const SKIN = ['#f1c9a5', '#d9a680', '#a8754f', '#70492f']
const SHIRT = ['#2f7fc1', '#c0392b', '#27ae60', '#8e44ad', '#e08a1e', '#16a085', '#c9a51a', '#546e7a']
const LEGS = ['#34495e', '#3b3b6d', '#4a3b2a', '#2d3a2d']

/** Cheap, stable pseudo-random pick per index, so person #4 always looks the same. */
const pick = <T,>(list: T[], seed: number) => list[(Math.imul(seed + 1, 2654435761) >>> 0) % list.length]

const people = new Map<number, Sprite>()
const heads = new Map<number, Sprite>()

/** Cached per seed, so the page's once-a-second render reuses the same objects. */
export function personSprite(seed: number): Sprite {
  let s = people.get(seed)
  if (!s) {
    s = {
      rows: FIGURE,
      palette: {
        H: pick(HAIR, seed),
        S: pick(SKIN, seed * 7 + 3),
        E: '#1d1d24',
        T: pick(SHIRT, seed * 13 + 5),
        P: pick(LEGS, seed * 5 + 1),
        B: '#262629',
      },
    }
    people.set(seed, s)
  }
  return s
}

export function headSprite(seed: number): Sprite {
  let s = heads.get(seed)
  if (!s) {
    s = {
      rows: HEAD,
      palette: {
        H: pick(HAIR, seed),
        S: pick(SKIN, seed * 7 + 3),
        W: '#f4f4f4',
        E: '#2b4a7a',
        N: '#00000022',
        M: '#7a3b2a',
      },
    }
    heads.set(seed, s)
  }
  return s
}

/* ---------------- tiles ---------------- */

/** One tile of ground seen from the side: two rows of grass, a shadow row, then dirt. */
export const GROUND: Sprite = (() => {
  let s = 7
  const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) % 1000) / 1000
  const drips = [2, 3, 7, 8, 12]
  const rows: string[] = []
  for (let y = 0; y < 16; y++) {
    let row = ''
    for (let x = 0; x < 16; x++) {
      if (y < 2) row += rand() < 0.3 ? 'g' : 'G'
      else if (y === 2 || (y === 3 && drips.includes(x))) row += 'd'
      else row += rand() < 0.14 ? 'e' : rand() < 0.12 ? 'f' : 'D'
    }
    rows.push(row)
  }
  return { rows, palette: { G: '#6fae45', g: '#88c75a', d: '#4f8a33', D: '#8a6242', e: '#6d4c32', f: '#a37752' } }
})()

/* ---------------- choosing an item ---------------- */

/** Breakdown labels are free text from the plugin, so match loosely and fall back to stone. */
export function itemFor(label: string): Sprite {
  if (/mob|entit|creature/i.test(label)) return EGG
  if (/rig|bone|skelet|anim/i.test(label)) return BONE
  if (/item|weapon|tool|sword/i.test(label)) return SWORD
  if (/texture|image|skin|paint|sound/i.test(label)) return PAPER
  return STONE
}

/** For a file, the directory usually says what it is. */
export function itemForPath(path: string): Sprite {
  if (/mob/i.test(path)) return EGG
  if (/rig/i.test(path)) return BONE
  if (/item/i.test(path)) return SWORD
  if (/block/i.test(path)) return STONE
  return PAPER
}
