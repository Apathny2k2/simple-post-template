/* The Studio layout: every mode opens without errors, nothing covers a
   control, and the pieces sit where the design puts them. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mode, open, openEditor, startApp } from './harness.mjs'

startApp()

/** Controls whose centre is covered by something else; ones scrolled out of view are skipped. */
const covered = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.editor-root button, .editor-root select, .editor-root input')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') return false
        const x = r.x + r.width / 2
        const y = r.y + r.height / 2
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false
        for (let s = el.parentElement; s; s = s.parentElement) {
          const o = getComputedStyle(s)
          const sr = s.getBoundingClientRect()
          if (/auto|hidden|scroll/.test(o.overflowY + o.overflowX) && (y < sr.top || y > sr.bottom || x < sr.left || x > sr.right)) return false
        }
        const hit = document.elementFromPoint(x, y)
        return !(hit === el || el.contains(hit))
      })
      .map((el) => (el.textContent.trim() || el.getAttribute('aria-label') || el.title || el.className).slice(0, 40)),
  )

/* a mob, an item and a block between them show every mode the editor has */
for (const model of ['voidling', 'runic_blade', 'geyser_block']) {
  test(`every mode of ${model} opens without errors and nothing covers a control`, async () => {
    const { page, errors } = await openEditor(model)
    const modes = await page.$$eval('.sbar__mode', (els) => els.map((e) => e.textContent.trim()))
    assert.ok(modes.length >= 4, `modes: ${modes}`)
    for (const m of modes) {
      await mode(page, m)
      await page.waitForTimeout(150)
      assert.equal(await page.$eval('.sbar__mode[aria-pressed="true"]', (e) => e.textContent.trim()), m)
      assert.deepEqual(await covered(page), [], `covered controls in ${m}`)
    }
    assert.deepEqual(errors, [])
    await page.close()
  })
}

test('the top bar, columns and status bar follow the design', async () => {
  const { page } = await openEditor()
  const bar = await page.locator('.sbar').boundingBox()
  const pill = await page.locator('.sbar__mode').first().boundingBox()
  const save = await page.locator('.sbar__savegroup').boundingBox()
  assert.equal(Math.round(bar.y), 0, 'the bar is at the top')
  assert.ok(pill.x > bar.width * 0.25 && pill.x < bar.width * 0.6, 'the modes sit in the middle')
  assert.ok(save.x + save.width > bar.width - 40, 'Save is at the right')
  const outliner = await page.locator('.panel__title', { hasText: 'Outliner' }).boundingBox()
  assert.ok(outliner.x < 100, 'the outliner is on the left in Model')
  const add = await page.locator('.outliner-add button:has-text("+ More")').boundingBox()
  const left = await page.locator('.editor-column--right').boundingBox()
  assert.ok(add.x + add.width <= left.x + left.width, 'the outliner’s buttons stay inside its column')
  assert.match(await page.textContent('.editor-status'), /cubes/)
  await page.close()
})

test('the timeline opens the clip fitted to its width', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  const grid = await page.locator('.timeline-main').boundingBox()
  const end = await page.locator('.timeline-end').boundingBox()
  assert.ok(end.x > grid.x + grid.width * 0.8, 'the clip’s end is near the right edge')
  assert.ok(end.x <= grid.x + grid.width, 'and still in view')
  await page.close()
})

test('the other pages load without errors', async () => {
  for (const hash of ['#/', '#/projects', '#/settings/support']) {
    const { page, errors } = await open(hash)
    await page.waitForTimeout(500)
    assert.deepEqual(errors, [], `errors on ${hash}`)
    await page.close()
  }
})
