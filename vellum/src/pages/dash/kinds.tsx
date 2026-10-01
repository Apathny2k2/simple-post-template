/* Pixel icons for the kinds of file a server reports, drawn for the Dash's
   Server files chart. The labels are the plugin's own words, so an icon is
   picked by what the label mentions, and anything unknown is a page. Each
   icon is 16 by 16: o outline, d shade, a the stack's colour, l its light,
   w white, k near black, r g b y paint. */

import type { ReactNode } from 'react'

const ART = {
  model: [
    '.......ww.......',
    '.....ll..ll.....',
    '...ll......ll...',
    '.ll..........ll.',
    'w..............w',
    'lll..........lll',
    'l..ll......ll..l',
    'l....ll..ll....l',
    'l......ww......l',
    'l......ll......l',
    'l......ll......l',
    'w......ll......w',
    '.ll....ll....ll.',
    '...ll..ll..ll...',
    '.....llllll.....',
    '.......ww.......',
  ],
  rig: [
    '.........oooo...',
    '........oolaoo..',
    '........olaaaoo.',
    '........oaaaaaoo',
    '........oolaaaao',
    '.......ooladaado',
    '......ooladoadoo',
    '.....ooladooooo.',
    '.oooooladoo.....',
    'oolaoladoo......',
    'olaaladoo.......',
    'oaaaadoo........',
    'ooaaaaao........',
    '.ooaaado........',
    '..ooadoo........',
    '...oooo.........',
  ],
  mob: [
    '................',
    'oooooooooooooooo',
    'olllllllllllllao',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaawwaaaawwaado',
    'olaawkaaaakwaado',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaaakkkkkkaaado',
    'olaaakwkwkwaaado',
    'olaaaaaaaaaaaado',
    'oadddddddddddddo',
    'oooooooooooooooo',
    '................',
  ],
  texture: [
    '................',
    '....oooooooo....',
    '..ooolllllaooo..',
    '.oollaaaaaalaoo.',
    'oolaaaaaaaaaaaoo',
    'olarraayyaabbaao',
    'olarraayyaabbado',
    'olaaaaaaaaaddado',
    'olggaaaaaadooado',
    'olggaaaaadooooao',
    'oaaaaaaaadooooao',
    'ooaaaaaaaaaooado',
    '.ooadaaaaaaaaooo',
    '..oooadddddooo..',
    '....oooooooo....',
    '................',
  ],
  asset: [
    '................',
    'oooooooooooooooo',
    'olllllllllllllao',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaaaawwwwaaaado',
    'odddddwkkwdddddo',
    'olaaaawwwwaaaado',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'olaaaaaaaaaaaado',
    'oadddddddddddddo',
    'oooooooooooooooo',
    '................',
  ],
  sound: [
    '......oooooo....',
    '......olllaooo..',
    '......oladdlaoo.',
    '......oldooaaao.',
    '......oldoooado.',
    '......oldo.ooao.',
    '......oldo..ooo.',
    '......oldo......',
    '..oooooldo......',
    '.oollllado......',
    '.olaaaaado......',
    '.olaaaaado......',
    '.oaaaaadoo......',
    '.ooadddoo.......',
    '..oooooo........',
    '................',
  ],
  animation: [
    '................',
    'oooooooooooooooo',
    'llllllllllllllla',
    'lkakakakakakakad',
    'laaaaaaaaaaaaaad',
    'lakkkkkaakkkkkad',
    'lawwkkkaakkkkkad',
    'lawwkkkaakkkkkad',
    'lakkkkkaakkkwwad',
    'lakkkkkaakkkwwad',
    'laaaaaaaaaaaaaad',
    'lkakakakakakakad',
    'addddddddddddddd',
    'oooooooooooooooo',
    '................',
    '................',
  ],
  item: [
    '...........oooo.',
    '..........oowwo.',
    '.........oowwwo.',
    '........oowwwoo.',
    '.......oowwwoo..',
    '......oowwwoo...',
    '.oooooowwwoo....',
    '.oaaoowwwoo.....',
    '.ooallawoo......',
    '..ooladoo.......',
    '.ooldddoo.......',
    'ooldooaao.......',
    'oldoooooo.......',
    'oaoo............',
    'ooo.............',
    '................',
  ],
  block: [
    '....ooollooo....',
    '..ooollllllooo..',
    'ooollllllllllooo',
    'ollllllllllllllo',
    'llllllllllllllll',
    'aalllllllllllldd',
    'aaaalllllllldddd',
    'aaaaaalllldddddd',
    'aaaaaaaalldddddd',
    'aaaaaaaadddddddd',
    'aaaaaaaadddddddd',
    'aaaaaaaadddddddd',
    'oaaaaaaadddddddo',
    'oooaaaaadddddooo',
    '..oooaaadddooo..',
    '....oooadooo....',
  ],
  file: [
    '..ooooooooo.....',
    '..ollllllaoo....',
    '..olaaaaaaaoo...',
    '..olaaaaaaaaoo..',
    '..olaaaaaaaaao..',
    '..olaaaaaaaado..',
    '..olakkkkkkado..',
    '..olaaaaaaaado..',
    '..olakkkkkkado..',
    '..olaaaaaaaado..',
    '..olakkkkaaado..',
    '..olaaaaaaaado..',
    '..olaaaaaaaado..',
    '..oadddddddddo..',
    '..oooooooooooo..',
    '................',
  ],
} satisfies Record<string, string[]>

type Kind = keyof typeof ART

const KINDS: [RegExp, Kind][] = [
  [/rig|bone|skelet|armature/i, 'rig'],
  [/mob|entit|creature|monster|npc/i, 'mob'],
  [/textur|skin|sprite|image|paint/i, 'texture'],
  [/anim|clip|motion/i, 'animation'],
  [/sound|audio|music|sfx/i, 'sound'],
  [/item|weapon|tool|sword/i, 'item'],
  [/block/i, 'block'],
  [/model|mesh|geometr/i, 'model'],
  [/asset|pack|bundle/i, 'asset'],
]

const kindOf = (label: string): Kind => KINDS.find(([re]) => re.test(label))?.[1] ?? 'file'

/** One pixel icon, in the colour of the element it sits in (`--hue`). */
export function KindIcon({ label, size = 32 }: { label: string; size?: number }) {
  const kind = kindOf(label)
  const runs: ReactNode[] = []
  ART[kind].forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x]
      let end = x + 1
      while (row[end] === c) end++
      if (c !== '.') runs.push(<rect key={`${x},${y}`} x={x} y={y} width={end - x} height={1} className={`kind-icon__${c}`} />)
      x = end
    }
  })
  return (
    <svg className="kind-icon" data-kind={kind} width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {runs}
    </svg>
  )
}
