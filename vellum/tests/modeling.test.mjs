/* Model mode: the gizmo tools, selection, the clipboard and the view, driven
   with the mouse and the Blockbench keys. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, dragArrow, dragRing, fields, openEditor, selectedNames, startApp } from './harness.mjs'

startApp()

const handles = (page) => page.$$eval('.xform [data-handle]', (els) => els.map((e) => e.dataset.handle))
const rows = (page) => page.locator('.tree__row').count()

test('the move arrow moves the cube along X, and one undo puts it back', async () => {
  const { page, errors } = await openEditor()
  const before = await fields(page)
  await dragArrow(page, 'x', 60)
  const after = await fields(page)
  assert.ok(after[0] > before[0], `X should grow: ${before[0]} -> ${after[0]}`)
  assert.deepEqual(after.slice(1), before.slice(1), 'only X changes')
  await page.keyboard.press('Control+z')
  assert.deepEqual(await fields(page), before)
  assert.deepEqual(errors, [])
  await page.close()
})

test('V, S, R, P and X switch the gizmo as in Blockbench', async () => {
  const { page } = await openEditor()
  assert.ok((await handles(page)).includes('free'), 'move has a free-move centre')
  await page.keyboard.press('s')
  assert.deepEqual((await handles(page)).sort(), ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'])
  await page.keyboard.press('r')
  assert.deepEqual((await handles(page)).sort(), ['x', 'y', 'z'])
  await page.keyboard.press('p')
  assert.ok((await handles(page)).includes('free'))
  await page.keyboard.press('x')
  assert.equal(await page.locator('.scene3d__vertex--own').count(), 8, 'the selected cube shows its eight corners')
  await page.close()
})

test('resize grows one side and rotate turns in snapped steps', async () => {
  const { page } = await openEditor()
  await page.keyboard.press('s')
  const size = await fields(page, 3, 3)
  const stem = page.locator('.xform [data-handle="y+"] .xform__stem')
  const b = await stem.boundingBox()
  await drag(page, [b.x + b.width / 2, b.y + 4], [b.x + b.width / 2, b.y - 40])
  const grown = await fields(page, 3, 3)
  assert.ok(grown[1] > size[1], `height should grow: ${size[1]} -> ${grown[1]}`)
  assert.equal(grown[0], size[0])

  await page.keyboard.press('r')
  await dragRing(page, 'y')
  const rot = await fields(page, 9, 3)
  assert.notEqual(rot[1], 0, 'the ring turned the cube about Y')
  assert.equal(Math.round(rot[1] / 2.5) * 2.5, rot[1], 'rotation snaps to 2.5 degrees')
  await page.close()
})

test('Ctrl and Shift pick in the outliner; copy, paste, group and delete undo cleanly', async () => {
  const { page } = await openEditor()
  await page.click('.tree__row:has-text("flank_left")', { modifiers: ['Control'] })
  assert.deepEqual(await selectedNames(page), ['pelvis', 'flank_left'])
  await page.click('.tree__row:has-text("yoke")', { modifiers: ['Shift'] })
  assert.deepEqual(await selectedNames(page), ['pelvis', 'flank_left', 'flank_right', 'yoke'])

  const n0 = await rows(page)
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  assert.equal(await rows(page), n0 + 4, 'four pasted cubes')
  await page.keyboard.press('Control+z')
  assert.equal(await rows(page), n0)

  await page.keyboard.press('Control+g')
  assert.equal(await rows(page), n0 + 1, 'one new group bone')
  await page.keyboard.press('Control+z')
  assert.equal(await rows(page), n0)

  await page.click('.tree__row:has-text("yoke")')
  await page.keyboard.press('Delete')
  assert.equal(await rows(page), n0 - 1)
  await page.keyboard.press('Control+z')
  assert.equal(await rows(page), n0)

  await page.keyboard.press('Control+a')
  assert.ok((await selectedNames(page)).length >= 20, 'Ctrl+A selects every cube')
  await page.keyboard.press('Escape')
  assert.deepEqual(await selectedNames(page), [])
  await page.close()
})

test('B box-selects cubes in the viewport', async () => {
  const { page } = await openEditor()
  const scene = await page.locator('.editor-view .scene3d').first().boundingBox()
  const cx = scene.x + scene.width / 2
  const cy = scene.y + scene.height / 2
  await page.keyboard.press('b')
  await drag(page, [cx - 160, cy - 250], [cx + 160, cy + 60], 6)
  assert.ok((await selectedNames(page)).length > 3)
  await page.close()
})

test('the view tabs switch to an orthographic front view and back', async () => {
  const { page } = await openEditor()
  await page.click('.editor-view button:has-text("Front")')
  assert.equal(await page.locator('.scene3d--ortho').count(), 1)
  await page.click('.editor-view button:has-text("Perspective")')
  assert.equal(await page.locator('.scene3d--ortho').count(), 0)
  await page.keyboard.press('Numpad5')
  assert.equal(await page.locator('.scene3d--ortho').count(), 1, 'Numpad 5 toggles the projection')
  await page.close()
})

test('the outliner adds cubes, bones and null objects', async () => {
  const { page } = await openEditor()
  const n0 = await rows(page)
  await page.click('.outliner-add button:has-text("+ Cube")')
  await page.click('.outliner-add button:has-text("+ Bone")')
  assert.equal(await rows(page), n0 + 2)
  await page.click('.outliner-add button:has-text("+ Null")')
  assert.equal(await page.locator('.tree--nulls .tree__row').count(), 1)
  assert.equal(await page.locator('.model-null').count(), 1, 'the null shows in the viewport')
  await page.close()
})
