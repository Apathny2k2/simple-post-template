#!/usr/bin/env node
// Draws the boot screen: Pip swinging at a block while the app loads. The
// frames come from the app's own Pip code and are written into index.html
// between the boot markers, as a sprite used for a mask so Pip takes the
// text colour. Run it again after changing how Pip is drawn:
//
//   node scripts/make-boot.mjs

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FRAMES = 12
const SCALE = 3

const vite = await createServer({
  root: app,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { Pixels, stamp } = await vite.ssrLoadModule('/src/lib/pip/pixels.ts')
const { ORE, CRACKS } = await vite.ssrLoadModule('/src/lib/pip/art.ts')
const { drawPip, standing } = await vite.ssrLoadModule('/src/lib/pip/figure.ts')
const { GROUND, HEIGHT, drawGroundColumn } = await vite.ssrLoadModule('/src/lib/pip/scene.ts')
const { REACH, SWING, swing } = await vite.ssrLoadModule('/src/lib/pip/mine.ts')
await vite.close()

// ---------- the frames ----------

const W = 80
const PIP_X = 34
const ORE_X = PIP_X + REACH

function frame(k) {
  const p = new Pixels(W, HEIGHT)
  p.ink = 0x000000
  for (let x = 0; x < W; x++) drawGroundColumn(p, x, x + 11)
  // the block jumps a pixel as the pick lands, as it does in the app
  const knock = k >= 0.3 && k < 0.36 ? 1 : 0
  const y = GROUND - 8 - knock
  p.clipY = GROUND
  stamp(p, ORE, ORE_X, y)
  for (const [cx, cy] of CRACKS.slice(0, 3)) p.dot(ORE_X + cx, y + cy)
  p.clipY = Infinity
  const me = standing(PIP_X)
  swing(me, k)
  drawPip(p, me, PIP_X, 1)
  return p
}

const frames = Array.from({ length: FRAMES }, (_, i) => frame((i * SWING) / FRAMES))

// crop to what any frame draws above the ground, with a margin
let x0 = W
let x1 = 0
let y0 = HEIGHT
for (const p of frames) {
  for (let y = 0; y < GROUND; y++) {
    for (let x = 0; x < W; x++) {
      if (!p.on(x, y)) continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
    }
  }
}
x0 = Math.max(0, x0 - 6)
x1 = Math.min(W - 1, x1 + 6)
y0 = Math.max(0, y0 - 2)
const fw = x1 - x0 + 1
const fh = HEIGHT - y0

// ---------- a PNG, frames side by side, scaled up ----------

const sheetW = fw * FRAMES * SCALE
const sheetH = fh * SCALE
const raw = Buffer.alloc((sheetW * 4 + 1) * sheetH)
for (let sy = 0; sy < sheetH; sy++) {
  const row = sy * (sheetW * 4 + 1)
  raw[row] = 0
  for (let sx = 0; sx < sheetW; sx++) {
    const f = Math.floor(sx / (fw * SCALE))
    const x = x0 + Math.floor((sx % (fw * SCALE)) / SCALE)
    const y = y0 + Math.floor(sy / SCALE)
    const a = frames[f].data[(y * W + x) * 4 + 3]
    raw[row + 1 + sx * 4 + 3] = a
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(sheetW, 0)
ihdr.writeUInt32BE(sheetH, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

// ---------- into index.html ----------

const w = fw * SCALE
const h = fh * SCALE
const sprite = `url(data:image/png;base64,${png.toString('base64')})`
const markup = `<!-- boot:start (written by scripts/make-boot.mjs) -->
      <style>
        .boot {
          position: fixed;
          inset: 0;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 12px;
          color: var(--ink-muted, #8a8f99);
          font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
          opacity: 0;
          animation: boot-in 240ms ease-out 150ms forwards;
        }
        .boot__pip {
          --sprite: ${sprite};
          width: ${w}px;
          height: ${h}px;
          background: currentColor;
          -webkit-mask: var(--sprite) 0 0 / ${w * FRAMES}px ${h}px no-repeat;
          mask: var(--sprite) 0 0 / ${w * FRAMES}px ${h}px no-repeat;
          animation: boot-swing ${Math.round(SWING * 1000)}ms steps(${FRAMES}) infinite;
        }
        .boot__quip { margin: 0; color: var(--ink-faint, #8a8f99); font-size: 12px; }
        .boot__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        @keyframes boot-in { to { opacity: 1; } }
        @keyframes boot-swing {
          to { -webkit-mask-position: -${w * FRAMES}px 0; mask-position: -${w * FRAMES}px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .boot__pip { animation: none; }
        }
      </style>
      <div class="boot" role="status">
        <div class="boot__pip" aria-hidden="true"></div>
        <p class="boot__quip" aria-hidden="true">Mining the loading block.</p>
        <span class="boot__label">Loading Vellum</span>
      </div>
      <!-- boot:end -->`

const index = path.join(app, 'index.html')
const html = fs.readFileSync(index, 'utf8')
const marked = /<!-- boot:start[\s\S]*?<!-- boot:end -->/
if (!marked.test(html)) {
  console.error('index.html has no boot markers inside #root')
  process.exit(1)
}
fs.writeFileSync(index, html.replace(marked, markup))
console.log(`boot sprite: ${FRAMES} frames of ${fw}x${fh}, ${png.length} bytes`)
