/* The miner and his world, drawn for this app. The textures are made up
   per pixel from a hash of the block's position, so no two blocks match
   and nothing here is copied from the game. */

import { hash2, sprite } from './pixels'
import type { Rgb } from './pixels'

export const C = {
  hat: 0xf4c430,
  hatShade: 0xcf9a1a,
  brim: 0xa9790f,
  lamp: 0xfff6c4,
  hair: 0x4a2f22,
  skin: 0xe4ab7c,
  skinShade: 0xc98b5d,
  eye: 0x1b1b22,
  vest: 0xf07b2a,
  vestShade: 0xc75e18,
  stripe: 0xf6f1d8,
  belt: 0x3b2a1f,
  sleeve: 0x55698e,
  sleeveShade: 0x43557a,
  pants: 0x3b4a6e,
  pantsShade: 0x2d3955,
  boot: 0x4b3020,
  bootShade: 0x33200f,

  steel: 0xc9d3e0,
  steelHi: 0xeef3fa,
  steelDark: 0x55607a,
  wood: 0x9a6538,
  woodDark: 0x6a4222,

  grass: 0x5da643,
  grassHi: 0x78c555,
  grassLo: 0x468a33,
  dirt: 0x8a5a36,
  dirtHi: 0x9f6d46,
  dirtLo: 0x6c4428,
  stone: 0x7f8089,
  stoneHi: 0x94959d,
  stoneLo: 0x676870,
  ore: 0x5aa2ff,
  oreHi: 0xb4d6ff,
  oreLo: 0x2d6bd3,
  brick: 0x8e8f97,
  brickHi: 0xa3a4ab,
  mortar: 0x5b5c64,
  obsidian: 0x1d1230,
  obsidianHi: 0x3e2a5e,
  obsidianLo: 0x100a1c,
  lava: 0xff7417,
  lavaHi: 0xffae34,
  lavaHot: 0xffe28a,
  lavaLo: 0xc9390b,
  crack: 0x26262c,

  skyTop: 0x080d22,
  skyMid: 0x0e1633,
  skyLow: 0x172248,
  star: 0xdfe6ff,
  moon: 0xe9edf6,
  moonShade: 0xbac1d2,
  hillFar: 0x131d3b,
  hillNear: 0x0d152c,

  check: 0x3ddc97,
  checkShade: 0x16784c,
  cloud: 0x5b6275,
  cloudHi: 0x747c90,
  rain: 0x8fb3e8,
  spark: 0xffe066,
} as const

export const PORTAL = [0x3b1591, 0x5a22c8, 0x7a38f0, 0x9d64ff, 0xc7a3ff] as const
export const FIRE = [0xb52a0c, 0xe8540f, 0xff8a1f, 0xffc23d, 0xfff0a0] as const

const MINER = {
  Y: C.hat,
  y: C.hatShade,
  B: C.brim,
  L: C.lamp,
  H: C.hair,
  S: C.skin,
  s: C.skinShade,
  E: C.eye,
  V: C.vest,
  v: C.vestShade,
  R: C.stripe,
  K: C.belt,
  C: C.sleeve,
  c: C.sleeveShade,
  P: C.pants,
  p: C.pantsShade,
  O: C.boot,
  o: C.bootShade,
}

/* Facing right. The head block is columns 1-8; the brim hangs one pixel
   past it on both sides and the lamp sits on the front of the dome. */
export const HEAD = sprite(
  [
    '...YYYY...', //
    '..yYYYYY..',
    '..yYYYYYL.',
    'BBBBBBBBBB',
    '.HHSSSSSS.',
    '.HSSSSSES.',
    '.HSSSSSSS.',
    '.ssssssss.',
  ],
  MINER,
)

export const TORSO = sprite(['VVVV', 'VVVV', 'RRRR', 'VVVV', 'vvvv', 'KKKK'], MINER)

/** Pivot at the shoulder, (1.5, 0.5). */
export const ARM = sprite(['CCC', 'CCC', 'CCC', 'ccc', 'SSS', 'SSS', 'sss'], MINER)

/** Pivot at the hip, (1.5, 0). The toe points forward. */
export const LEG = sprite(['PPP.', 'PPP.', 'ppp.', 'ppp.', 'OOO.', 'OOOo'], MINER)

/** Handle pointing down, head at the top. Held at (4.5, 8.5). */
export const PICK = sprite(
  [
    '..kkkkk..', //
    '.kmMMMmk.',
    'kmmkWkmmk',
    'kmk.W.kmk',
    'kk..W..kk',
    '....W....',
    '....W....',
    '....W....',
    '....w....',
    '....w....',
  ],
  { k: C.steelDark, m: C.steel, M: C.steelHi, W: C.wood, w: C.woodDark },
)

export const GEM = sprite(['.o.', 'oOo', '.o.'], { o: C.ore, O: C.oreHi })

export const MOON = sprite(
  ['MMMMMMM', 'MMmMMMM', 'MMMMMmM', 'MmMMMMM', 'MMMMMMM', 'MMMmMMM', 'MMMMMMM'],
  { M: C.moon, m: C.moonShade },
)

export const CHECK = sprite(
  [
    '.........G', //
    '........GG',
    'G......GG.',
    'GG....GG..',
    '.GG..GG...',
    '..GGGG....',
    '...GG.....',
  ],
  { G: C.check },
)

export const STAR = sprite(['.y.', 'yYy', '.y.'], { y: 0xd9a600, Y: 0xffe066 })

export const CLOUD = sprite(
  [
    '....aaaa....', //
    '..aaAAAAaa..',
    '.aAAAAAAAAa.',
    'aaaaaaaaaaaa',
  ],
  { a: C.cloud, A: C.cloudHi },
)

/* ---------------- block faces, 8x8, made up per pixel ---------------- */

const pick3 = (h: number, lo: Rgb, mid: Rgb, hi: Rgb) => (h < 0.18 ? lo : h > 0.84 ? hi : mid)

export function grassBlock(u: number, v: number, b: number): Rgb {
  const h = hash2(b * 8 + u, v)
  // the grass hangs a little lower in some columns
  const lip = 2 + (hash2(b * 8 + u, 91) > 0.62 ? 1 : 0)
  if (v === 0) return h > 0.7 ? C.grassHi : C.grass
  if (v < lip) return h > 0.8 ? C.grassHi : h < 0.25 ? C.grassLo : C.grass
  return pick3(h, C.dirtLo, C.dirt, C.dirtHi)
}

export function stoneBlock(u: number, v: number, b: number): Rgb {
  return pick3(hash2(b * 8 + u, v + 40), C.stoneLo, C.stone, C.stoneHi)
}

export function oreBlock(u: number, v: number, b: number): Rgb {
  const h = hash2(b * 8 + u, v + 70)
  // three clusters of the blue, the rest is stone
  const spot = (u - 2) ** 2 + (v - 2) ** 2 < 2.2 || (u - 5.5) ** 2 + (v - 4.5) ** 2 < 2.2 || (u - 2) ** 2 + (v - 6) ** 2 < 1.2
  if (spot) return h > 0.7 ? C.oreHi : h < 0.3 ? C.oreLo : C.ore
  return stoneBlock(u, v, b)
}

export function brickBlock(u: number, v: number, b: number): Rgb {
  const row = v >> 2
  const joint = (u + (row % 2 === 0 ? 0 : 4)) % 8 === 0
  if (v % 4 === 3 || joint) return C.mortar
  return hash2(b * 8 + u, v + 13) > 0.8 ? C.brickHi : C.brick
}

export function obsidianBlock(u: number, v: number, b: number): Rgb {
  const h = hash2(b * 8 + u, v + 55)
  return h > 0.86 ? C.obsidianHi : h < 0.3 ? C.obsidianLo : C.obsidian
}

const band = (n: number, colours: readonly Rgb[]) =>
  colours[Math.max(0, Math.min(colours.length - 1, Math.floor(n * colours.length)))]

/** Slow, rolling lava. x and y are world pixels, t is seconds. */
export function lava(x: number, y: number, t: number): Rgb {
  const n =
    Math.sin(x * 0.5 + t * 1.2) + Math.sin(y * 0.9 - t * 0.7 + x * 0.2) + Math.sin((x - y) * 0.33 + t * 0.5)
  return band((n + 3) / 6, [C.lavaLo, C.lava, C.lava, C.lavaHi, C.lavaHot])
}

/** The portal's swirl, around its own centre. */
export function portal(x: number, y: number, t: number): Rgb {
  const r = Math.hypot(x, y)
  const a = Math.atan2(y, x)
  const n = Math.sin(r * 0.9 - t * 4 + a * 2) + Math.sin(x * 0.7 + t * 2.1) * 0.6 + Math.sin(y * 0.5 - t * 2.9) * 0.6
  return band((n + 2.2) / 4.4, PORTAL)
}

export function fire(k: number): Rgb {
  return band(k, FIRE)
}

