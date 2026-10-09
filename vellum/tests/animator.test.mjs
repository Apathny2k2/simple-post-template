/* Animate mode: posing in the viewport keys at the playhead, the dope sheet
   edits keys in bulk, and the effects row, onion skin, graph and IK work. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, dragRing, mode, openEditor, startApp } from './harness.mjs'

startApp()

const keys = (page) => page.locator('.timeline-key').count()
const selectedKeys = (page) => page.locator('.timeline-key[data-selected]').count()

/** Clicks the ruler at `t` seconds, reading the timeline's own zoom. */
async function scrub(page, t) {
  const pxPerS = await page.$eval('.timeline-grid', (g) => parseFloat(getComputedStyle(g).getPropertyValue('--px-per-s')))
  const ruler = await page.locator('.timeline-ruler').boundingBox()
  await page.mouse.click(ruler.x + t * pxPerS + 1, ruler.y + 5)
}

test('Animate has move, rotate and scale, and a clip open', async () => {
  const { page, errors } = await openEditor()
  await mode(page, 'Animate')
  const tools = await page.$$eval('.dock .dock__tool', (els) => els.map((e) => e.title))
  assert.deepEqual(tools.map((t) => t.split(' ')[0]), ['Move', 'Rotate', 'Scale'])
  assert.match(await page.$eval('.timeline-bar select', (s) => s.selectedOptions[0].textContent), /idle/)
  assert.deepEqual(errors, [])
  await page.close()
})

test('turning a bone with the rotate ring adds a key at the playhead', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  await page.locator('.tree__row').filter({ has: page.locator('.tree__name', { hasText: /^head$/ }) }).first().click()
  await scrub(page, 1.5)
  const n0 = await keys(page)
  await page.keyboard.press('r')
  await dragRing(page, 'x')
  assert.equal(await keys(page), n0 + 1)
  assert.match(await page.textContent('.kf__sub'), /^Rotation at 1\.50 s/, 'the new key is selected and shown')
  const titles = await page.$$eval('.timeline-key', (els) => els.map((e) => e.title))
  assert.ok(titles.some((t) => /@\s*1\.50?s/.test(t)), `a key sits at the playhead (1.5s): ${titles.filter((t) => /1\.5/.test(t))}`)
  await page.close()
})

test('keys select all, box select, and drag to a new time', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  await page.keyboard.press('Control+a')
  assert.equal(await selectedKeys(page), await keys(page))
  await page.keyboard.press('Escape')
  assert.equal(await selectedKeys(page), 0)

  const track = await page.locator('.timeline-track').nth(1).boundingBox()
  await drag(page, [track.x + 2, track.y - 30], [track.x + track.width / 3, track.y + 60], 5)
  assert.ok((await selectedKeys(page)) > 0, 'the box picked keys')

  const key = page.locator('.timeline-key[data-selected]').last()
  const before = await key.getAttribute('title')
  const b = await key.boundingBox()
  await drag(page, [b.x + b.width / 2, b.y + b.height / 2], [b.x + b.width / 2 + 40, b.y + b.height / 2], 5)
  const after = await page.locator('.timeline-key[data-selected]').last().getAttribute('title')
  assert.notEqual(after, before, 'the key moved in time')
  await page.keyboard.press('Control+z')
  await page.close()
})

test('the effects row, onion skin and graph editor', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  await page.click('.timeline-name--effects button >> nth=0')
  assert.equal(await page.locator('.timeline-event').count(), 1)
  assert.match(await page.textContent('.editor-column--left'), /Sound id/)

  await page.click('.chip:has-text("Onion skin")')
  assert.ok((await page.locator('.model-ghost').count()) > 0)

  await page.locator('.tree__row').filter({ has: page.locator('.tree__name', { hasText: /^head$/ }) }).first().click()
  await page.click('.chip:has-text("Graph")')
  assert.equal(await page.locator('.graph__curve').count(), 3, 'one curve per axis')
  assert.ok((await page.locator('.graph__key').count()) > 0)
  await page.close()
})

test('Space plays the clip and stops it', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  const t0 = await page.textContent('.timeline-time')
  await page.keyboard.press('Space')
  await page.waitForFunction((t) => document.querySelector('.timeline-time')?.textContent !== t, t0, { timeout: 3000 })
  await page.keyboard.press('Space')
  const stopped = await page.textContent('.timeline-time')
  await page.waitForTimeout(250)
  assert.equal(await page.textContent('.timeline-time'), stopped, 'time holds once stopped')
  await page.close()
})

test('a null object as an IK target bends the arm towards it', async () => {
  const { page } = await openEditor()
  await page.click('.tree__row:has-text("root") >> nth=0')
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Null object")')
  const ik = page.locator('.editor-field', { hasText: 'IK' }).locator('select')
  const claw = await ik.evaluate((s) => [...s.options].find((o) => o.textContent.trim() === 'claw_left')?.value)
  assert.ok(claw, 'claw_left is offered as an IK end')
  await ik.selectOption(claw)
  const at = () => page.locator('.model-group[data-bone="claw_left"] .model-cube').first().evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y] })
  const before = await at()
  const pos = page.locator('.num-field-row', { hasText: 'Position' }).locator('input')
  await pos.nth(0).fill('14')
  await pos.nth(0).press('Enter')
  await pos.nth(1).fill('22')
  await pos.nth(1).press('Enter')
  const after = await at()
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 20, 'the claw moved towards the null')
  await page.close()
})

test('the clip list switches and renames clips; the keyframe panel sets the easing', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  const names = await page.$$eval('.clip-list__name', (els) => els.map((e) => e.textContent))
  assert.ok(names.length >= 2, `clips: ${names}`)
  await page.click(`.clip-list__row:has-text("${names[1]}")`)
  assert.match(await page.$eval('.timeline-bar select', (s) => s.selectedOptions[0].textContent), new RegExp(names[1]))

  await page.dblclick(`.clip-list__row:has-text("${names[1]}")`)
  await page.fill('.clip-list__rename', 'animation.voidling.prowl')
  await page.keyboard.press('Enter')
  assert.ok((await page.$$eval('.clip-list__name', (els) => els.map((e) => e.textContent))).includes('prowl'))

  await page.locator('.timeline-key').first().click()
  await page.click('.kf__ease button:has-text("Step")')
  assert.equal(await page.getAttribute('.kf__ease button:has-text("Step")', 'aria-pressed'), 'true')
  assert.match(await page.textContent('.kf__curve'), /jumps|last key/)
  await page.close()
})

test('a sound key plays a cue tone during playback', async () => {
  const { page } = await openEditor()
  await mode(page, 'Animate')
  await scrub(page, 0.3)
  await page.click('.timeline-name--effects button >> nth=0')
  await scrub(page, 0)
  await page.keyboard.press('Space')
  await page.waitForFunction(() => (window.__vellumCues ?? 0) > 0, null, { timeout: 4000 })
  await page.keyboard.press('Space')
  await page.click('.chip:has-text("Sound cues")')
  const n = await page.evaluate(() => window.__vellumCues)
  await scrub(page, 0)
  await page.keyboard.press('Space')
  await page.waitForTimeout(900)
  await page.keyboard.press('Space')
  assert.equal(await page.evaluate(() => window.__vellumCues), n, 'no cue with Sound cues off')
  await page.close()
})
