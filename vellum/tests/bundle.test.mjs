/* The single-file build the artifact is published from. Skipped until
   `pnpm build:single` has written dist/vellum.html. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { app, mode, open, root, startApp } from './harness.mjs'

startApp()

const file = join(root, 'dist', 'vellum.html')

test('dist/vellum.html opens the editor and switches modes', { skip: !existsSync(file) && 'no build yet' }, async () => {
  const { page, errors } = await open('#/editor/voidling', { base: pathToFileURL(file).href })
  await page.waitForSelector('.editor-view .scene3d')
  for (const m of ['Paint', 'Animate', 'Model']) await mode(page, m)
  assert.ok((await page.locator('.timeline-key').count()) === 0, 'the timeline closes when leaving Animate')
  assert.ok((await page.locator('.xform [data-handle]').count()) > 0, 'the gizmo is back in Model')
  // the minifier must not drop the unprefixed backdrop-filter (see CLAUDE.md)
  const lost = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) => {
      let rules
      try {
        rules = [...sheet.cssRules]
      } catch {
        return [] // the font stylesheet is another origin and cannot be read
      }
      return rules.filter((r) => r.style && /backdrop-filter/.test(r.cssText) && !r.style.backdropFilter).map((r) => r.selectorText)
    }),
  )
  assert.deepEqual(lost, [], 'every rule with a backdrop filter keeps the unprefixed one Chrome reads')
  assert.deepEqual(errors, [])
  assert.ok(app.browser)
  await page.close()
})
