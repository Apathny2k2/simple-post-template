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
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Null object")')
  assert.equal(await page.locator('.tree--nulls .tree__row').count(), 1)
  assert.equal(await page.locator('.model-null').count(), 1, 'the null shows in the viewport')
  await page.close()
})

test('the inspector renames, moves to another bone, and shifts the unwrap', async () => {
  const { page } = await openEditor()
  await page.fill('.insp-head__name', 'hips')
  await page.keyboard.press('Enter')
  assert.equal(await page.textContent('.tree__row[aria-selected="true"] .tree__name'), 'hips')
  await page.keyboard.press('Control+z')
  assert.equal(await page.inputValue('.insp-head__name'), 'pelvis', 'undo restores the name in the field')

  const boneOf = () => page.$eval('.insp-bone select', (s) => s.selectedOptions[0].textContent.trim())
  assert.equal(await boneOf(), 'root')
  await page.selectOption('.insp-bone select', { label: ' torso' })
  assert.equal(await boneOf(), 'torso')

  assert.deepEqual(await page.$$eval('.num-field-row--vec:nth-child(2) .num-field__axis', (els) => els.map((e) => e.textContent)), ['W', 'H', 'D'])
  const u = page.locator('input[aria-label="Unwrap U"]')
  const before = await page.$$eval('input[aria-label^="UV "]', (els) => els.map((e) => Number(e.value)))
  await u.fill(String(Number(await u.inputValue()) + 2))
  await u.press('Enter')
  const after = await page.$$eval('input[aria-label^="UV "]', (els) => els.map((e) => Number(e.value)))
  assert.equal(after[0], before[0] + 2, 'U moved the faces two texels right')
  await page.close()
})

test('the History panel lists each step and jumps back and forth', async () => {
  const { page } = await openEditor()
  const n0 = await rows(page)
  await page.click('.outliner-add button:has-text("+ Cube")')
  await page.click('.outliner-add button:has-text("+ Bone")')
  await page.click('.outliner-add button:has-text("+ Cube")')
  assert.equal(await rows(page), n0 + 3)
  await page.click('.panel__head:has-text("History")')
  const steps = await page.$$eval('.hist__row', (els) => els.map((e) => e.textContent))
  assert.deepEqual(steps.slice(1), ['Add cube', 'Add bone', 'Add cube'])
  await page.click('.hist__row >> nth=0')
  assert.equal(await rows(page), n0, 'back to the model as opened')
  assert.equal(await page.locator('.hist__row--undone').count(), 3)
  await page.click('.hist__row >> nth=2')
  assert.equal(await rows(page), n0 + 2, 'forward to the second step')
  await page.close()
})

test('Blender keys, when chosen: G grabs, A selects all, X deletes, Shift+D duplicates', async () => {
  const { page } = await openEditor()
  await page.click('.sbar button:has-text("File")')
  await page.click('[role=menuitem]:has-text("switch to Blender")')
  assert.equal(await page.textContent('.dock__tool:has-text("Move") kbd'), 'G')
  await page.keyboard.press('r')
  await page.keyboard.press('g')
  assert.ok((await page.$$eval('.xform [data-handle]', (els) => els.map((e) => e.dataset.handle))).includes('free'), 'G is the move tool')
  // G also starts a grab; Esc puts it back
  await page.keyboard.press('Escape')
  const n0 = await rows(page)
  await page.click('.tree__row:has-text("yoke")')
  await page.keyboard.press('Shift+D')
  assert.equal(await rows(page), n0 + 1)
  await page.keyboard.press('x')
  assert.equal(await rows(page), n0)
  await page.keyboard.press('a')
  assert.ok((await selectedNames(page)).length >= 20)
  await page.keyboard.press('Alt+a')
  assert.deepEqual(await selectedNames(page), [])
  // the choice is kept for the next visit
  await page.reload()
  await page.waitForSelector('.dock__tool')
  assert.equal(await page.textContent('.dock__tool:has-text("Move") kbd'), 'G')
  await page.close()
})

test('grab: the selection follows the pointer, Esc puts it back, X holds an axis, digits move exactly', async () => {
  const { page, errors } = await openEditor()
  await page.click('.tree__row:has-text("yoke")')
  const at = await fields(page, 0, 3)
  const view = await page.locator('.editor-view .scene3d').boundingBox()
  const cx = view.x + view.width / 2
  const cy = view.y + view.height / 2
  await page.mouse.move(cx, cy)
  await page.keyboard.press('Shift+G')
  assert.match(await page.textContent('.editor-view__hint'), /^Grab/)
  await page.mouse.move(cx + 120, cy + 10, { steps: 6 })
  const moved = await fields(page, 0, 3)
  assert.notDeepEqual(moved, at, 'it follows the pointer')
  await page.keyboard.press('Escape')
  assert.deepEqual(await fields(page, 0, 3), at, 'Esc puts it back')
  assert.equal(await page.locator('.editor-root.is-grabbing').count(), 0)
  // the undo list has no step for a grab that was put back
  await page.click('.panel__head:has-text("History")')
  const steps = await page.locator('.hist__row').count()

  await page.mouse.move(cx, cy)
  await page.keyboard.press('Shift+G')
  await page.keyboard.press('x')
  await page.waitForSelector('.scene3d__guide--x', { timeout: 2000 })
  await page.keyboard.type('4')
  await page.keyboard.press('Enter')
  assert.deepEqual(await fields(page, 0, 3), [at[0] + 4, at[1], at[2]], 'four units along X, exactly')
  assert.equal(await page.locator('.hist__row').count(), steps + 1, 'one undo step')
  await page.keyboard.press('Control+z')
  assert.deepEqual(await fields(page, 0, 3), at)

  // a click puts it down too, and a right click puts it back
  await page.mouse.move(cx, cy)
  await page.keyboard.press('Shift+G')
  await page.mouse.move(cx, cy - 80, { steps: 4 })
  await page.mouse.click(cx, cy - 80, { button: 'right' })
  assert.deepEqual(await fields(page, 0, 3), at)
  assert.deepEqual(errors, [])
  await page.close()
})

test('G G on a picked edge ring slides it, and the slide is one undo step', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await page.click('.sbar button:has-text("File")')
  await page.click('[role=menuitem]:has-text("switch to Blender")')
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Cube")')
  await page.waitForSelector('.model-mface')
  await page.keyboard.press('4')
  await page.locator('.scene3d__edge-hit').first().click()
  await page.click('.chip:has-text("Loop cut")')
  const mid = () =>
    page.$$eval('.num-field-row', (rows) => {
      const row = rows.find((r) => r.textContent.includes('Middle of the pick'))
      return [...row.querySelectorAll('input')].map((i) => Number(i.value))
    })
  const before = await mid()
  const view = await page.locator('.editor-view .scene3d').boundingBox()
  const cx = view.x + view.width / 2
  const cy = view.y + view.height / 2 + 120
  await page.mouse.move(cx, cy)
  await page.keyboard.press('g')
  await page.keyboard.press('g')
  assert.match(await page.textContent('.editor-view__hint'), /^Slide/)
  await page.mouse.move(cx + 80, cy, { steps: 4 })
  await page.mouse.click(cx + 80, cy)
  const after = await mid()
  assert.notDeepEqual(after, before, 'the ring slid')
  await page.keyboard.press('Control+z')
  assert.deepEqual(await mid(), before, 'one undo for the slide')
  assert.deepEqual(errors, [])
  await page.close()
})
