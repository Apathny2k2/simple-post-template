/* Display, Scene and Behaviour do their jobs, not only open: a display
   slot takes and resets a transform, the real-world view opens and
   closes, and a block's behaviour cycle runs and takes a new stage. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mode, openEditor, startApp } from './harness.mjs'

startApp()

const panel = (page, title) => page.locator('.panel', { has: page.locator('.panel__title', { hasText: title }) })

test('Display: a slot takes a rotation, and Reset slot puts it back', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await mode(page, 'Display')
  const field = panel(page, 'Display').locator('.num-field input').first()
  const start = await field.inputValue()
  await field.fill('33')
  await field.press('Enter')
  assert.equal(await field.inputValue(), '33')
  await panel(page, 'Display').locator('button:has-text("Reset slot")').click()
  assert.equal(await field.inputValue(), start)
  assert.deepEqual(errors, [])
  await page.close()
})

test('Scene: View in the real world opens over the editor and closes with Escape', async () => {
  const { page, errors } = await openEditor('voidling')
  await mode(page, 'Scene')
  await page.click('button:has-text("View in the real world")')
  await page.waitForSelector('.world[role="dialog"]')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.world[role="dialog"]', { state: 'detached' })
  assert.deepEqual(errors, [])
  await page.close()
})

test('Behaviour: the cycle runs through its stages, and Add makes another', async () => {
  const { page, errors } = await openEditor('geyser_block')
  await mode(page, 'Behaviour')
  const count = () => panel(page, 'Behaviour').locator('.panel__count').textContent()
  const before = await count()
  await page.click('button:has-text("Run the cycle")')
  const now = page.locator('.behaviour-play__now')
  await page.waitForFunction(() => /\d+\.\ds/.test(document.querySelector('.behaviour-play__now')?.textContent ?? ''), null, { timeout: 4000 })
  assert.match(await now.textContent(), /·/)
  await page.click('button:has-text("Pause")')
  await page.locator('.behaviour-section', { has: page.locator('.behaviour-section__title', { hasText: 'Cycle' }) }).locator('button:has-text("Add")').click()
  assert.notEqual(await count(), before, 'the stage count changed')
  assert.deepEqual(errors, [])
  await page.close()
})
