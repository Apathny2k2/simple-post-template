/* Texture layers: flattened bottom first at their opacities, merged down,
   kept in the .vellum and the .bbmodel, and painted on one at a time. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, inApp, mode, open, openEditor, startApp } from './harness.mjs'

startApp()

test('layers flatten bottom first at their opacity, hidden ones left out, and merge down as they looked', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const L = await import('/src/lib/layers.ts')
    const fill = (rgba) => {
      const c = document.createElement('canvas')
      c.width = 2
      c.height = 2
      const x = c.getContext('2d')
      x.fillStyle = rgba
      x.fillRect(0, 0, 2, 2)
      return c.toDataURL('image/png')
    }
    const pixel = async (src) => {
      const img = new Image()
      await new Promise((ok) => ((img.onload = ok), (img.src = src)))
      const c = document.createElement('canvas')
      c.width = 2
      c.height = 2
      const x = c.getContext('2d')
      x.drawImage(img, 0, 0)
      return [...x.getImageData(0, 0, 1, 1).data]
    }
    const t = {
      id: 't', name: 't.png', width: 2, height: 2, uvWidth: 2, uvHeight: 2, source: '',
      layers: [
        { id: 'a', name: 'Base', source: fill('rgb(0, 0, 255)'), visible: true, opacity: 1 },
        { id: 'b', name: 'Red', source: fill('rgb(255, 0, 0)'), visible: true, opacity: 0.5 },
        { id: 'c', name: 'Green', source: fill('rgb(0, 255, 0)'), visible: false, opacity: 1 },
      ],
    }
    await L.readyLayers(t)
    const flat = await pixel(L.flatten(t))
    const merged = await L.mergeDown(t, 'b')
    // a new layer's image is decoded before it can be flattened
    await L.readyLayers({ ...t, layers: merged })
    const afterMerge = await pixel(L.flatten({ ...t, layers: merged }))
    const mergedLayer = merged.find((l) => l.id === 'a')
    return { flat, afterMerge, count: merged.length, mergedOpacity: mergedLayer.opacity, active: L.activeLayer(t, 'zzz').id, paint: L.paintSource(t, 'a') === t.layers[0].source }
  })
  assert.deepEqual(r.flat.slice(0, 3).map((v) => Math.round(v / 10)), [13, 0, 13], 'half red over blue; the hidden green left out')
  assert.deepEqual(r.afterMerge.map((v, i) => Math.abs(v - r.flat[i]) <= 2), [true, true, true, true], 'merged down, it looks the same')
  assert.equal(r.count, 2)
  assert.equal(r.mergedOpacity, 1)
  assert.equal(r.active, 'c', 'with no layer picked, the top one is painted on')
  assert.ok(r.paint)
  await page.close()
})

test('layers are kept in the .vellum and the .bbmodel', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const B = await import('/src/lib/bbmodel.ts')
    const S = await import('/src/lib/samples.ts')
    const m = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const t = m.textures[0]
    m.textures[0] = { ...t, layers: [{ id: 'l1', name: 'Base', source: t.source, visible: true, opacity: 1 }, { id: 'l2', name: 'Dirt', source: t.source, visible: false, opacity: 0.4 }] }
    const text = V.writeVellum(m)
    const back = V.readVellum(text)
    const bb = B.fromBbmodel(B.toBbmodel(m)).model
    return {
      kept: back.textures[0].layers.map((l) => [l.name, l.visible, l.opacity]),
      same: V.writeVellum(back) === text,
      bb: V.writeVellum(bb) === text,
      bbSource: JSON.parse(B.toBbmodel(m)).textures[0].source === t.source,
    }
  })
  assert.deepEqual(r.kept, [['Base', true, 1], ['Dirt', false, 0.4]])
  assert.ok(r.same)
  assert.ok(r.bb, 'out to a .bbmodel and back, the layers come too')
  assert.ok(r.bbSource, 'Blockbench gets the flattened image')
  await page.close()
})

test('in Paint: add a layer, paint on it, hide it, flatten', async () => {
  const { page, errors } = await openEditor('voidling')
  await mode(page, 'Paint')
  await page.waitForSelector('.panel__head:has-text("Layers")')
  await page.click('.chip:has-text("Layer")')
  await page.waitForSelector('.layers__row')
  assert.equal(await page.locator('.layers__row').count(), 2)
  assert.equal(await page.textContent('.layers__row--on .layers__name'), 'Layer 2', 'the new layer is the one painted on')
  const thumbs = () => page.$$eval('.layers__thumb', (els) => els.map((e) => e.style.backgroundImage))
  const before = await thumbs()
  const sheet = await page.locator('.psheet__sheet').boundingBox()
  await drag(page, [sheet.x + 10, sheet.y + 10], [sheet.x + 60, sheet.y + 40], 6)
  await page.waitForTimeout(300)
  const after = await thumbs()
  assert.notEqual(after[0], before[0], 'the top layer took the stroke')
  assert.equal(after[1], before[1], 'the base layer did not')
  const painted = await page.$eval('.psheet__sheet', (e) => e.style.backgroundImage)
  await page.click('.layers__row--on .layers__eye')
  await page.waitForTimeout(300)
  assert.notEqual(await page.$eval('.psheet__sheet', (e) => e.style.backgroundImage), painted, 'hidden, the stroke leaves the texture')
  await page.click('.layers .chip:has-text("Flatten")')
  await page.waitForTimeout(300)
  assert.equal(await page.locator('.layers__row').count(), 0, 'flattened, the texture is one image again')
  assert.deepEqual(errors, [])
  await page.close()
})
