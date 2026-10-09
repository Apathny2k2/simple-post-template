/* Items live in the 16-unit block a Java model is drawn in, so their middle
   is at x and z 8: the samples are built there, an item built around 0 is
   flagged, and Centre in block moves it over, meshes, pivots and all. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

test('item samples stand in the middle of their block; one built around 0 is flagged and centred', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const S = await import('/src/lib/samples.ts')
    const M = await import('/src/lib/model.ts')
    const C = await import('/src/lib/centre.ts')
    const items = S.samples.filter((s) => s.model.kind === 'items')
    const flagged = (m) => M.validateModel(m, 'items').some((i) => i.fix === 'centre-in-block')
    // the sword moved back to where Vellum's samples used to be built
    const sword = S.samples.find((s) => s.id === 'runic_blade').model
    const shift = (p) => [p[0] - 8, p[1], p[2] - 8]
    const bone = (b) => ({ ...b, origin: shift(b.origin), children: b.children.map((c) => (c.kind === 'bone' ? { ...c, bone: bone(c.bone) } : c)) })
    const atZero = { ...sword, bones: sword.bones.map(bone), cubes: sword.cubes.map((c) => ({ ...c, from: shift(c.from), to: shift(c.to), origin: shift(c.origin) })) }
    const fixed = C.centreInBlock(atZero)
    return {
      samples: items.map((s) => [s.id, flagged(s.model)]),
      zeroFlagged: flagged(atZero),
      fixedFlagged: flagged(fixed),
      same: JSON.stringify(fixed.cubes.map((c) => [c.from, c.to, c.origin])) === JSON.stringify(sword.cubes.map((c) => [c.from, c.to, c.origin])),
      bonesBack: JSON.stringify(fixed.bones) === JSON.stringify(sword.bones),
    }
  })
  for (const [id, f] of r.samples) assert.equal(f, false, `${id} is not flagged`)
  assert.ok(r.zeroFlagged, 'an item built around 0 is flagged')
  assert.ok(!r.fixedFlagged, 'and centred it is not')
  assert.ok(r.same, 'Centre in block puts every cube back where the centred sample has it')
  assert.ok(r.bonesBack, 'and every pivot')
  await page.close()
})

test('Validation offers Centre in block, and one click centres the item', async () => {
  const { page, errors } = await openEditor('runic_blade')
  // the sword as an item built around 0 would be, opened as a file
  const text = await page.evaluate(async () => {
    const S = await import('/src/lib/samples.ts')
    const V = await import('/src/lib/vellum.ts')
    const m = S.samples.find((s) => s.id === 'runic_blade').model
    const shift = (p) => [p[0] - 8, p[1], p[2] - 8]
    const bone = (b) => ({ ...b, origin: shift(b.origin), children: b.children.map((c) => (c.kind === 'bone' ? { ...c, bone: bone(c.bone) } : c)) })
    return V.writeVellum({ ...m, bones: m.bones.map(bone), cubes: m.cubes.map((c) => ({ ...c, from: shift(c.from), to: shift(c.to), origin: shift(c.origin) })) })
  })
  await page.setInputFiles('input[type=file][accept*="bbmodel"]', { name: 'off_centre.vellum', mimeType: 'application/json', buffer: Buffer.from(text) })
  const fix = page.locator('.editor-issues__fix')
  // open the Validation panel if it is folded
  const head = page.locator('.panel', { has: page.locator('.panel__title', { hasText: 'Validation' }) }).locator('[aria-expanded]').first()
  if ((await head.getAttribute('aria-expanded')) === 'false') await head.click()
  await fix.waitFor({ timeout: 5000 })
  await fix.click()
  await page.waitForFunction(() => !document.querySelector('.editor-issues__fix'))
  await page.keyboard.press('Control+z')
  await fix.waitFor({ timeout: 5000 })
  assert.deepEqual(errors, [])
  await page.close()
})
