/* UV editing: the maths in lib/uv-edit.ts, then the UV panel and the
   Textures panel driven in the editor. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, centre, inApp, mode, open, openEditor, startApp } from './harness.mjs'

startApp()

test('uv-edit: resize keeps mirroring, box UV follows size, unwrap and growth', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const U = await import('/src/lib/uv-edit.ts')
    const P = await import('/src/lib/uv-pack.ts')
    const N = await import('/src/lib/new-model.ts')
    const cube = N.makeCube('c', [0, 0, 0], [4, 4, 4], { uvAt: [0, 0], texture: 't' })
    const mirrored = { ...cube, faces: { ...cube.faces, north: { ...cube.faces.north, uv: [8, 4, 4, 8] } } }
    const grown = U.resizeFaceUv(mirrored, 'north', 'e', 2, 0).faces.north.uv
    const shrunkPast = U.resizeFaceUv(cube, 'north', 'w', 99, 0).faces.north.uv
    const boxed = U.setBoxUv(cube, true)
    const wider = U.followBoxUv({ ...boxed, to: [6, 4, 4] })
    const moved = U.moveFaceUv(boxed, 'up', 3, 1)
    const model = { name: 'm', resolution: { width: 16, height: 16 }, bones: [], cubes: [cube], textures: [{ id: 't', name: 't.png', width: 16, height: 16, uvWidth: 16, uvHeight: 16, source: '' }], clips: [] }
    const inPlace = U.reunwrap(model, [cube.id], null)
    const doubled = P.growUvSpace({ ...model, cubes: [{ ...cube, uvOffset: [2, 3] }] }, () => null)
    const twoTex = { ...model, textures: [...model.textures, { ...model.textures[0], id: 'u', name: 'u.png' }] }
    const removed = U.removeTexture(U.assignTexture(twoTex, [cube.id], 'u', ['up']), 'u')
    return {
      grown,
      shrunkPast,
      northWide: wider.faces.north.uv,
      movedOffset: moved.uvOffset,
      movedUp: moved.faces.up.uv,
      upBefore: boxed.faces.up.uv,
      inPlace: inPlace.moved.length + inPlace.failed.length,
      doubledOffset: doubled.cubes[0].uvOffset,
      upAfterRemove: removed.cubes[0].faces.up.texture,
      name: U.freeTextureName(twoTex, 't.png'),
      scale: U.pixelScale(model, { ...model.textures[0], width: 32, height: 32 }),
    }
  })
  assert.deepEqual(r.grown, [10, 4, 4, 8], 'the east edge grows and the face stays mirrored')
  assert.equal(r.shrunkPast[2] - r.shrunkPast[0], 1, 'an edge stops one texel short of the other')
  assert.equal(r.northWide[2] - r.northWide[0], 6, 'box UV follows the new width')
  assert.deepEqual(r.movedOffset, [3, 1])
  assert.deepEqual(r.movedUp, [r.upBefore[0] + 3, r.upBefore[1] + 1, r.upBefore[2] + 3, r.upBefore[3] + 1])
  assert.equal(r.inPlace, 0, 'a cube that still fits stays where it is')
  assert.deepEqual(r.doubledOffset, [4, 6], 'growing the sheet scales the unwrap start')
  assert.equal(r.upAfterRemove, 't', 'faces of a deleted texture take the first one left')
  assert.equal(r.name, 't_2.png')
  assert.deepEqual(r.scale, [2, 2])
  await page.close()
})

const uvFields = (page) => page.$$eval('input[aria-label^="UV "]', (els) => els.map((e) => Number(e.value)))
const texel = async (page) => (await page.locator('.uv').first().boundingBox()).width / 64

test('dragging a face moves it, a handle resizes it, and each drag is one undo', async () => {
  const { page, errors } = await openEditor()
  await page.click('.uv-faces .chip:has-text("north")')
  const start = await uvFields(page)
  await page.locator('.uv').first().scrollIntoViewIfNeeded()
  const k = await texel(page)
  const [fx, fy] = await centre(page.locator('.uv__face[data-face="north"]'))
  await drag(page, [fx, fy], [fx + 3 * k, fy], 6)
  const moved = await uvFields(page)
  assert.deepEqual(moved, [start[0] + 3, start[1], start[2] + 3, start[3]])

  const [hx, hy] = await centre(page.locator('.uv__face[data-face="north"] [data-handle="e"]'))
  await drag(page, [hx, hy], [hx + 2 * k, hy], 6)
  assert.deepEqual(await uvFields(page), [moved[0], moved[1], moved[2] + 2, moved[3]])

  await page.keyboard.press('Control+z')
  assert.deepEqual(await uvFields(page), moved)
  await page.keyboard.press('Control+z')
  assert.deepEqual(await uvFields(page), start)
  assert.deepEqual(errors, [])
  await page.close()
})

test('Box UV makes the faces follow the cube and move as one', async () => {
  const { page } = await openEditor()
  await page.click('.uv-head .uv-switch')
  assert.equal(await page.getAttribute('.uv-head .uv-switch', 'aria-checked'), 'true')
  assert.equal(await page.locator('.uv__handle').count(), 0, 'no per-face handles with box UV on')
  await page.click('.uv-faces .chip:has-text("north")')
  const before = await uvFields(page)
  const sx = page.locator('input[aria-label="Size X"]')
  await sx.fill('10')
  await sx.press('Enter')
  const after = await uvFields(page)
  assert.equal(after[2] - after[0], 10, 'the north face is as wide as the cube')
  assert.equal(after[1], before[1])

  await page.locator('.uv').first().scrollIntoViewIfNeeded()
  const k = await texel(page)
  const [ux, uy] = await centre(page.locator('.uv__face[data-face="up"]'))
  await drag(page, [ux, uy], [ux, uy + 2 * k], 5)
  await page.click('.uv-faces .chip:has-text("north")')
  assert.equal((await uvFields(page))[1], after[1] + 2, 'dragging the up face moved north too')
  await page.close()
})

test('textures: new, import, per face, paint at 2x, delete', async () => {
  const { page } = await openEditor()
  assert.equal(await page.locator('.texture-item').count(), 1)
  await page.click('.panel__actions button:has-text("+ New")')
  assert.equal(await page.locator('.texture-item').count(), 2)

  const png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const x = c.getContext('2d')
    x.fillStyle = '#ff0000'
    x.fillRect(0, 0, 128, 128)
    return c.toDataURL('image/png').split(',')[1]
  })
  await page.setInputFiles('input[type=file][accept="image/png"]', { name: 'red.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await page.waitForFunction(() => document.querySelectorAll('.texture-item').length === 3)
  assert.match(await page.textContent('.texture-list'), /red\.png\s*128 x 128/)

  await page.click('.uv-faces .chip:has-text("north")')
  await page.selectOption('select[aria-label^="Texture on the"]', { label: 'red.png' })
  await page.click('.chip:has-text("Texture to all faces")')
  await page.click('.uv-faces .chip:has-text("west")')
  assert.equal(await page.$eval('select[aria-label^="Texture on the"]', (s) => s.selectedOptions[0].textContent), 'red.png')

  // a click at UV texel (10.5, 40.5) lands on pixel (21, 81) of the 128px image
  await mode(page, 'Paint')
  const sheet = await page.locator('.psheet__sheet').boundingBox()
  const k = sheet.width / 64
  await page.mouse.click(sheet.x + 10.5 * k, sheet.y + 40.5 * k)
  const px = await page.waitForFunction(async () => {
    const row = [...document.querySelectorAll('.texture-row')].find((r) => r.textContent.includes('red.png'))
    const img = new Image()
    img.src = row.querySelector('.texture-thumb').style.backgroundImage.slice(5, -2)
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const x = c.getContext('2d')
    x.drawImage(img, 0, 0)
    const at = (a, b) => [...x.getImageData(a, b, 1, 1).data.slice(0, 3)].join(',')
    return at(21, 81) !== '255,0,0' ? { hit: at(21, 81), beside: at(23, 83) } : null
  })
  const { hit, beside } = await px.jsonValue()
  assert.notEqual(hit, '255,0,0', 'the brush painted the pixel under the click')
  assert.equal(beside, '255,0,0', 'and nothing two pixels away')

  await mode(page, 'Model')
  await page.locator('.texture-item', { hasText: 'red.png' }).hover()
  await page.click('button[aria-label="Delete red.png"]')
  assert.equal(await page.locator('.texture-item').count(), 2)
  assert.equal(await page.$eval('select[aria-label^="Texture on the"]', (s) => s.selectedOptions[0].textContent), 'voidling.png')
  await page.close()
})

test('Re-unwrap moves a grown cube to free room and says so', async () => {
  const { page } = await openEditor()
  const sx = page.locator('input[aria-label="Size X"]')
  await sx.fill('14')
  await sx.press('Enter')
  await page.click('.chip:has-text("Re-unwrap")')
  await page.getByText(/sheet was full|to free room|Unwrapped in place/).first().waitFor()
  const uv = await uvFields(page)
  assert.equal(uv[2] - uv[0], 14, 'the north face is as wide as the cube again')
  await page.close()
})

test('with "Move pixels with the face" on, a moved face takes its pixels along', async () => {
  const { page } = await openEditor()
  await page.click('.uv-faces .chip:has-text("north")')
  await page.click('.uv-carry')
  const start = await uvFields(page)
  const read = (pts) =>
    page.evaluate(async (p) => {
      const img = new Image()
      img.src = document.querySelector('.texture-thumb').style.backgroundImage.slice(5, -2)
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')
      x.drawImage(img, 0, 0)
      return p.map(([a, b]) => [...x.getImageData(a, b, 1, 1).data].join(','))
    }, pts)
  const [x1, y1] = [Math.min(start[0], start[2]), Math.min(start[1], start[3])]
  const before = await read([[x1, y1], [x1 + 1, y1 + 1]])
  await page.locator('.uv').first().scrollIntoViewIfNeeded()
  const k = await texel(page)
  const [fx, fy] = await centre(page.locator('.uv__face[data-face="north"]'))
  await drag(page, [fx, fy], [fx + 3 * k, fy], 6)
  await page.waitForFunction((old) => document.querySelector('.texture-thumb').style.backgroundImage.length !== old, (await page.$eval('.texture-thumb', (e) => e.style.backgroundImage.length)) - 1).catch(() => {})
  await page.waitForTimeout(200)
  const after = await read([[x1 + 3, y1], [x1 + 4, y1 + 1], [x1, y1]])
  assert.equal(after[0], before[0], 'the face’s top-left texel moved with it')
  assert.equal(after[1], before[1])
  assert.equal(after[2].split(',')[3], '0', 'its old place is cleared')
  await page.keyboard.press('Control+z')
  assert.deepEqual(await uvFields(page), start, 'one undo puts the face back')
  assert.deepEqual(await read([[x1, y1]]), [before[0]], 'and its pixels')
  await page.close()
})
