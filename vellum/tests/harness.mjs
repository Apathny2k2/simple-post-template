/* Shared set-up for the browser tests. Each test file starts its own Vite
   dev server on a free port and one Chromium, so `pnpm test` needs nothing
   else running. Pages load app modules straight from the dev server
   (`import('/src/lib/vellum.ts')`), which is how the unit-level tests reach
   the codec, the UV maths and the kinematics without a bundler of their own. */

import { after, before } from 'node:test'
import { existsSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

export const root = fileURLToPath(new URL('..', import.meta.url))

/* The container ships Chromium at /opt/pw-browsers; elsewhere Playwright
   finds its own. CHROMIUM overrides both. */
const executablePath =
  process.env.CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = netServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

export const app = { url: '', browser: null }
let server = null

/** Starts the dev server and the browser once for the calling test file. */
export function startApp() {
  before(async () => {
    const port = await freePort()
    server = await createServer({
      root,
      logLevel: 'error',
      server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
    })
    await server.listen()
    app.url = `http://127.0.0.1:${port}/`
    app.browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] })
  })
  after(async () => {
    await app.browser?.close()
    await server?.close()
  })
  return app
}

/* Requests the page makes to the outside (the Archivo font) fail in a
   sandbox with no network; they say nothing about the app. */
const outside = (text) => /Failed to load resource|fonts\.(googleapis|gstatic)\.com|ERR_CERT|ERR_NAME|ERR_INTERNET/.test(text)

/**
 * A fresh page at `hash`. `errors` collects page errors and console errors
 * for the test to assert on at the end.
 */
export async function open(hash = '', { width = 1440, height = 900, base = app.url } = {}) {
  const page = await app.browser.newPage({ viewport: { width, height } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !outside(m.text())) errors.push(m.text())
  })
  await page.goto(base + hash, { waitUntil: 'load' })
  return { page, errors }
}

/** Opens a sample model in the editor and waits for the viewport. */
export async function openEditor(model = 'voidling', opts) {
  const ctx = await open(`#/editor/${model}`, opts)
  await ctx.page.waitForSelector('.editor-view .scene3d')
  await ctx.page.waitForSelector('.tree__row')
  return ctx
}

/** Runs `fn` in the page with app modules imported by path. */
export function inApp(page, fn, arg) {
  return page.evaluate(fn, arg)
}

/** Switches the editor's mode by its label in the top bar. */
export async function mode(page, label) {
  await page.click(`.sbar__mode:has-text("${label}")`)
}

/** Drags from one point to another in steps, as a hand would. */
export async function drag(page, from, to, steps = 8) {
  await page.mouse.move(from[0], from[1])
  await page.mouse.down()
  await page.mouse.move(to[0], to[1], { steps })
  await page.mouse.up()
}

/** The middle of an element's box. */
export async function centre(locator) {
  const b = await locator.boundingBox()
  if (!b) throw new Error('element has no box')
  return [b.x + b.width / 2, b.y + b.height / 2]
}

/** The outliner rows' names that are selected, in order. */
export const selectedNames = (page) =>
  page.$$eval('.tree__row[aria-selected="true"] .tree__name', (els) => els.map((e) => e.textContent))

/** The values of the first `n` numeric fields in the inspector. */
export const fields = (page, from = 0, n = 6) =>
  page.$$eval('.num-field input', (els, [a, b]) => els.slice(a, a + b).map((e) => Number(e.value)), [from, n])

/** Drags a gizmo handle along its own arrow by `px` screen pixels. */
export async function dragArrow(page, handle, px) {
  const svg = await page.locator('.xform').first().boundingBox()
  const line = await page.$eval(`.xform [data-handle="${handle}"] .xform__stem`, (el) => ['x1', 'y1', 'x2', 'y2'].map((k) => Number(el.getAttribute(k))))
  const [x1, y1, x2, y2] = line
  const len = Math.hypot(x2 - x1, y2 - y1)
  const sx = svg.x + (x1 + x2) / 2
  const sy = svg.y + (y1 + y2) / 2
  await drag(page, [sx, sy], [sx + ((x2 - x1) / len) * px, sy + ((y2 - y1) / len) * px])
}

/** Drags along the first ten points of a rotation ring. */
export async function dragRing(page, handle) {
  const d = await page.$eval(`.xform [data-handle="${handle}"] .xform__ring`, (el) => el.getAttribute('d'))
  const pts = d.slice(1).split('L').map((s) => s.split(',').map(Number))
  const svg = await page.locator('.xform').first().boundingBox()
  await page.mouse.move(svg.x + pts[0][0], svg.y + pts[0][1])
  await page.mouse.down()
  for (let k = 1; k <= 9; k++) await page.mouse.move(svg.x + pts[k][0], svg.y + pts[k][1])
  await page.mouse.up()
}

/**
 * How many elements match, once the page shows `want` of them or five
 * seconds pass. A count read straight after a key press can run before
 * React has drawn the change, which a loaded machine makes likelier.
 */
export async function countOf(page, selector, want) {
  await page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length === n, [selector, want], { timeout: 5000 }).catch(() => {})
  return page.locator(selector).count()
}
