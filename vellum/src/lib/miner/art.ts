/* The miner and his props, drawn for this app in one colour, after the
   offline dinosaur game: solid figures with holes for the details, and
   the world around them in thin lines. */

import { mask } from './pixels'

/* Facing right. The head is a square in columns 1-8 with the hat on
   top; the brim hangs a pixel past it on both sides and the gap under
   it is the hat's band. The eye is a hole. */
export const HEAD = mask([
  '...####...', //
  '..######..',
  '##########',
  '.#......#.',
  '.########.',
  '.#####.##.',
  '.########.',
  '.########.',
  '.########.',
  '.########.',
])

/** The same head knocked silly: the eye is a cross. */
export const HEAD_DAZED = mask([
  '...####...', //
  '..######..',
  '##########',
  '.#......#.',
  '.####.#.#.',
  '.#####.##.',
  '.####.#.#.',
  '.########.',
  '.########.',
  '.########.',
])

/** The gap across the middle is the reflective stripe on his vest. */
export const TORSO = mask(['######', '######', '......', '######', '######', '######'])

/** Pivot at the shoulder, (1.5, 0.5). */
export const ARM = mask(['###', '###', '###', '###', '###', '###'])

/** Pivot at the hip, (1.5, 0). The boot points forward. */
export const LEG = mask(['###.', '###.', '###.', '###.', '####'])

/** Handle pointing down, head at the top. Held at (4.5, 8.5). */
export const PICK = mask([
  '..#####..', //
  '.#######.',
  '##..#..##',
  '#...#...#',
  '....#....',
  '....#....',
  '....#....',
  '....#....',
  '....#....',
  '....#....',
])

/** An ore block: an outline with the gems in it. */
export const ORE = mask([
  '########', //
  '#......#',
  '#.##...#',
  '#.##.#.#',
  '#....#.#',
  '#.#....#',
  '#......#',
  '########',
])

/** Where the cracks show, in the order they appear. */
export const CRACKS: [number, number][] = [
  [4, 1],
  [4, 2],
  [3, 3],
  [5, 4],
  [6, 5],
  [2, 4],
  [1, 5],
  [3, 5],
  [4, 6],
]

export const GEM = mask(['.#.', '#.#', '.#.'])

export const CLOUD = mask([
  '......####......', //
  '....##....##....',
  '..##........##..',
  '.#............##',
  '################',
])

export const RAIN_CLOUD = mask([
  '...####....', //
  '.##....##..',
  '#........##',
  '###########',
])

export const STAR = mask(['.#.', '###', '.#.'])

export const RING = mask(['.#.', '#.#', '.#.'])

export const PUFF = mask(['.##.', '#..#', '#..#', '.##.'])

export const CHECK = mask([
  '.........#', //
  '........##',
  '.......##.',
  '#.....##..',
  '##...##...',
  '.##.##....',
  '..###.....',
  '...#......',
])

export const FLAMES = [
  mask(['..#..', '..#..', '.##..', '.###.', '#####', '##.##']),
  mask(['.#...', '.##..', '.##..', '.###.', '####.', '##.##']),
  mask(['...#.', '..##.', '..##.', '.###.', '.####', '##.##']),
]

/** 3x5 figures for the counter in the corner. */
export const DIGITS = [
  ['###', '#.#', '#.#', '#.#', '###'],
  ['.#.', '##.', '.#.', '.#.', '###'],
  ['###', '..#', '###', '#..', '###'],
  ['###', '..#', '.##', '..#', '###'],
  ['#.#', '#.#', '###', '..#', '..#'],
  ['###', '#..', '###', '..#', '###'],
  ['###', '#..', '###', '#.#', '###'],
  ['###', '..#', '.#.', '.#.', '.#.'],
  ['###', '#.#', '###', '#.#', '###'],
  ['###', '#.#', '###', '..#', '###'],
].map(mask)
