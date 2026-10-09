/* Paint mode as the design draws it: the sheet in the middle, strokes that
   keep to their face, the texel readout, and painting on the model. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, mode, openEditor, startApp } from './harness.mjs'

startApp()

/** The colour of texture pixels, read back from the Textures panel's image. */
const pixels = (page, points) =>
  page.evaluate(async (pts) => {
    const img = new Image()
    img.src = document.querySelector('.texture-thumb').style.backgroundImage.slice(5, -2)
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const x = c.getContext('2d')
    x.drawImage(img, 0, 0)
    return pts.map(([a, b]) => [...x.getImageData(a, b, 1, 1).data.slice(0, 4)].join(','))
  }, points)

test('the sheet fills the middle, and a click on a face picks it', async () => {
  const { page, errors } = await openEditor()
  await mode(page, 'Paint')
  const sheet = page.locator('.psheet__sheet')
  assert.ok(await sheet.isVisible(), 'the sheet is in the middle')
  assert.equal(await page.locator('.editor-view__dock').isVisible(), false, 'the viewport tools step aside')
  // click inside the flank_left cube's up face, wherever it is
  const target = await page.evaluate(async () => {
    const S = await import('/src/lib/samples.ts')
    const m = S.samples.find((x) => x.id === 'voidling').model
    const c = m.cubes.find((x) => x.name === 'flank_left')
    const [x1, y1, x2, y2] = c.faces.up.uv
    return [(Math.min(x1, x2) + Math.max(x1, x2)) / 2, (Math.min(y1, y2) + Math.max(y1, y2)) / 2]
  })
  const b = await sheet.boundingBox()
  const k = b.width / 64
  await page.keyboard.press('c') // the colour picker changes nothing
  await page.mouse.click(b.x + target[0] * k, b.y + target[1] * k)
  assert.equal(await page.textContent('.paint-on__name'), 'flank_left')
  assert.equal(await page.textContent('.paint-on__faces [aria-pressed="true"]'), 'up')
  assert.match(await page.textContent('.editor-status__selection'), /Texel \d+, \d+/)
  assert.deepEqual(errors, [])
  await page.close()
})

test('a stroke keeps inside the face it starts on, unless that is switched off', async () => {
  const { page } = await openEditor()
  await mode(page, 'Paint')
  await page.click('.uv-faces .chip:has-text("north")').catch(() => {})
  const face = await page.evaluate(async () => {
    const S = await import('/src/lib/samples.ts')
    const m = S.samples.find((x) => x.id === 'voidling').model
    const [x1, y1, x2, y2] = m.cubes.find((x) => x.name === 'pelvis').faces.north.uv
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]
  })
  const b = await page.locator('.psheet__sheet').boundingBox()
  const k = b.width / 64
  const y = face[1] + 2.5
  const inside = [Math.floor(face[2] - 1), Math.floor(y)]
  const outside = [face[2] + 1, Math.floor(y)]
  const before = await pixels(page, [inside, outside])
  await drag(page, [b.x + (face[0] + 0.5) * k, b.y + y * k], [b.x + (face[2] + 2.5) * k, b.y + y * k], 12)
  await page.waitForTimeout(200)
  const kept = await pixels(page, [inside, outside])
  assert.notEqual(kept[0], before[0], 'the face was painted to its edge')
  assert.equal(kept[1], before[1], 'and not past it')

  await page.click('.ptools__keep')
  await drag(page, [b.x + (face[0] + 0.5) * k, b.y + y * k], [b.x + (face[2] + 2.5) * k, b.y + y * k], 12)
  await page.waitForTimeout(200)
  assert.notEqual((await pixels(page, [outside]))[0], before[1], 'with the switch off, it runs on')
  await page.close()
})

test('Paint on Model brings the viewport back for painting in 3D', async () => {
  const { page } = await openEditor()
  await mode(page, 'Paint')
  await page.click('.ptools__view button:has-text("Model")')
  assert.equal(await page.locator('.psheet').count(), 0)
  assert.ok(await page.locator('.editor-view .scene3d').first().isVisible())
  const before = await page.$eval('.texture-thumb', (e) => e.style.backgroundImage)
  const face = page.locator('.editor-view .model-face').first()
  const fb = await face.boundingBox()
  await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2)
  await page.waitForTimeout(200)
  assert.notEqual(await page.$eval('.texture-thumb', (e) => e.style.backgroundImage), before, 'a click on the model painted the texture')
  await page.close()
})

test('the Colour panel offers the colours the texture uses most', async () => {
  const { page } = await openEditor()
  await mode(page, 'Paint')
  await page.waitForSelector('.palette__label')
  const dots = await page.$$eval('.palette__label + .palette .palette__dot', (els) => els.map((e) => e.title))
  assert.ok(dots.length >= 6, `palette: ${dots}`)
  await page.locator('.palette__label + .palette .palette__dot').nth(2).click()
  assert.equal((await page.inputValue('.color-hex')).toLowerCase(), dots[2].split(' ')[0].toLowerCase())
  await page.close()
})

test('strength lays colour over, and mirror painting lands on the twin cube', async () => {
  const { page } = await openEditor()
  await mode(page, 'Paint')
  // a cube with a mirror twin on the other side of X, and where to click on it
  const pair = await page.evaluate(async () => {
    const S = await import('/src/lib/samples.ts')
    const U = await import('/src/lib/uv-edit.ts')
    const m = S.samples.find((x) => x.id === 'voidling').model
    for (const c of m.cubes) {
      const t = U.mirrorPoint(m, c, 'north', 0.25, 0.5)
      if (t && t.cube.id !== c.id) {
        const box = (uv) => [Math.min(uv[0], uv[2]), Math.min(uv[1], uv[3]), Math.max(uv[0], uv[2]), Math.max(uv[1], uv[3])]
        const a = box(c.faces.north.uv)
        const b = box(t.cube.faces.north.uv)
        const at = (r, u, v) => [Math.floor(r[0] + u * (r[2] - r[0])), Math.floor(r[1] + v * (r[3] - r[1]))]
        return { name: c.name, twin: t.cube.name, click: [a[0] + 0.25 * (a[2] - a[0]), a[1] + 0.5 * (a[3] - a[1])], here: at(a, 0.25, 0.5), there: at(b, 0.75, 0.5) }
      }
    }
    return null
  })
  assert.ok(pair, 'the voidling has a mirrored pair of cubes')
  await page.click('.ptools__keep:has-text("Mirror painting")')
  await page.fill('.color-hex', '#ffffff')
  await page.press('.color-hex', 'Enter')
  const b = await page.locator('.psheet__sheet').boundingBox()
  const k = b.width / 64
  const before = await pixels(page, [pair.here, pair.there])
  await page.mouse.click(b.x + (pair.click[0] + 0.01) * k, b.y + (pair.click[1] + 0.01) * k)
  await page.waitForTimeout(200)
  const after = await pixels(page, [pair.here, pair.there])
  assert.equal(after[0], '255,255,255,255', `painted on ${pair.name}`)
  assert.equal(after[1], '255,255,255,255', `and on its twin ${pair.twin}`)
  assert.notEqual(before[1], after[1])

  // half strength over the white just painted, in black, gives grey
  await page.click('.ptools__keep:has-text("Mirror painting")')
  await page.fill('.color-hex', '#000000')
  await page.press('.color-hex', 'Enter')
  await page.locator('input[aria-label="Brush strength"]').fill('50')
  await page.mouse.click(b.x + (pair.click[0] + 0.01) * k, b.y + (pair.click[1] + 0.01) * k)
  await page.waitForTimeout(200)
  const [grey] = await pixels(page, [pair.here])
  const [r] = grey.split(',').map(Number)
  assert.ok(r > 100 && r < 155, `half strength mixes: ${grey}`)
  await page.close()
})
