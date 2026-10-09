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

test('Display places the item where the game draws it: hand, head, slot, ground and frame', async () => {
  const { page } = await openEditor('runic_blade')
  const r = await page.evaluate(async () => {
    const D = await import('/src/lib/display-scene.ts')
    const P = await import('/src/pages/editor/DisplayPanel.tsx')
    const id = { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [1, 1, 1] }
    // the middle of the item's 16-pixel block, and a point one pixel up from it
    const at = (slot, t = id, p = [8, 8, 8]) => {
      const q = D.displayScene(slot, t).place.transformPoint(new DOMPoint(...p))
      return [q.x, q.y, q.z].map((v) => Math.round(v * 100) / 100)
    }
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    const right = at('thirdperson_righthand')
    const left = at('thirdperson_lefthand')
    return {
      gui: at('gui'),
      guiUnit: len(at('gui'), at('gui', id, [8, 9, 8])),
      right,
      left,
      head: at('head'),
      headUnit: len(at('head'), at('head', id, [8, 9, 8])),
      ground: at('ground', P.DEFAULT_DISPLAY.ground),
      frame: at('fixed'),
      frameUnit: len(at('fixed'), at('fixed', id, [8, 9, 8])),
      firstPerson: at('firstperson_righthand'),
      companions: ['thirdperson_righthand', 'head', 'gui', 'fixed', 'ground'].map((s) => D.displayScene(s, id).companions.map((c) => c.name).join()),
    }
  })
  assert.deepEqual(r.gui, [0, 0, 0], 'a slot centres the item')
  assert.ok(Math.abs(r.guiUnit - 1) < 0.02, `at one pixel a pixel: ${r.guiUnit}`)
  assert.ok(r.right[0] < -4 && r.right[1] > 6 && r.right[1] < 16 && r.right[2] > 0, `the right hand is low on the player's right and in front: ${r.right}`)
  assert.deepEqual([-r.left[0], r.left[1], r.left[2]], r.right, 'the left hand mirrors it')
  assert.ok(Math.abs(r.head[0]) < 0.01 && r.head[1] > 24, `on the head: ${r.head}`)
  assert.ok(Math.abs(r.headUnit - 0.625) < 0.02, `at five eighths: ${r.headUnit}`)
  assert.deepEqual(r.ground, [0, 5.6, 0], 'dropped: a quarter size, lifted by its bob, its height and its translation')
  assert.deepEqual(r.frame, [0, 0, -7], 'in a frame: half a pixel out from the board, whose face is at z = -7.5')
  assert.ok(Math.abs(r.frameUnit - 0.5) < 0.02, `at half size: ${r.frameUnit}`)
  assert.ok(r.firstPerson[0] > 0 && r.firstPerson[1] < 0 && r.firstPerson[2] < 0, `first person: right, low and ahead of the eye: ${r.firstPerson}`)
  assert.deepEqual(r.companions, ['player', 'player', 'slot', 'item frame', ''])
  await page.close()
})

test('Display mode draws the player with the item, and every slot opens', async () => {
  const { page, errors } = await openEditor('runic_blade')
  const cubes = await page.locator('.editor-view .model-cube').count()
  await mode(page, 'Display')
  const lit = () =>
    page.$eval('.editor-view canvas', (c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
      return n
    })
  for (const slot of ['thirdperson_righthand', 'thirdperson_lefthand', 'firstperson_righthand', 'firstperson_lefthand', 'head', 'gui', 'ground', 'fixed']) {
    await page.selectOption('.field select', slot)
    await page.waitForTimeout(150)
    assert.ok((await lit()) > 500, `${slot} draws something`)
    assert.equal(await page.locator('.editor-view .model-cube').count(), cubes, `${slot}: the player and props are drawn, never picked`)
  }
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
