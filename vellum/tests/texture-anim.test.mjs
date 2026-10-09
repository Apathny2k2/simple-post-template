/* Animated textures: a strip of frames counted from the image, played in
   the order and at the speed set, kept through the .vellum, the .bbmodel
   and a Java pack's .mcmeta; and in Paint, adding a frame, painting on it
   alone, and the viewport playing the frames. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, mode, open, openEditor, startApp } from './harness.mjs'

startApp()

test('frames are counted from the image, and play in the order and at the speed set', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const A = await import('/src/lib/texture-anim.ts')
    const P = await import('/src/lib/pack.ts')
    const res = { resolution: { width: 16, height: 16 } }
    const t = (height, animation) => ({ id: 't', name: 't.png', width: 16, height, uvWidth: 16, uvHeight: 16, source: '', ...(animation ? { animation } : {}) })
    const at = (tex, s) => A.frameAt(tex, s, res)
    return {
      counts: [A.frameCount(t(16), res), A.frameCount(t(64), res), A.frameCount(t(40), res)],
      // frame time 2 ticks: a frame lasts 0.1 s
      loop: [0, 0.1, 0.2, 0.3, 0.4].map((s) => at(t(64, { frameTime: 2 }), s).a),
      backwards: A.frameSequence(t(64, { frameTime: 1, mode: 'backwards' }), res),
      bounce: A.frameSequence(t(64, { frameTime: 1, mode: 'back_and_forth' }), res),
      order: A.frameSequence(t(64, { frameTime: 1, order: [0, 0, 3, 9] }), res),
      blend: at(t(64, { frameTime: 4, interpolate: true }), 0.1),
      // the renderer's numbers for the second frame: v scale and offset
      frames: [...A.textureFrames({ ...res, textures: [t(64)] }, 0.05).values()][0],
      held: [...A.textureFrames({ ...res, textures: [t(64)] }, 0.05, new Map()).values()][0],
      mcmeta: P.mcmetaOf(t(64, { frameTime: 3, mode: 'backwards', interpolate: true }), res),
      still: P.mcmetaOf(t(16), res),
      wide: P.mcmetaOf({ ...t(32), uvHeight: 8 }, res),
    }
  })
  assert.deepEqual(r.counts, [1, 4, 1], 'a strip four frames tall holds four; an uneven one is still')
  assert.deepEqual(r.loop, [0, 1, 2, 3, 0])
  assert.deepEqual(r.backwards, [3, 2, 1, 0])
  assert.deepEqual(r.bounce, [0, 1, 2, 3, 2, 1])
  assert.deepEqual(r.order, [0, 0, 3], 'a frame the strip lacks is left out of the order')
  assert.equal(r.blend.a, 0)
  assert.equal(r.blend.b, 1)
  assert.ok(Math.abs(r.blend.mix - 0.5) < 1e-9, 'halfway through a frame, half blended into the next')
  assert.deepEqual(r.frames, [0.25, 0.25, 0.5, 0])
  assert.deepEqual(r.held, [0.25, 0, 0, 0], 'held frames show the first unless told otherwise')
  assert.deepEqual(r.mcmeta, { animation: { frametime: 3, interpolate: true, frames: [3, 2, 1, 0] } })
  assert.equal(r.still, null, 'one frame writes no .mcmeta')
  assert.deepEqual(r.wide, { animation: { width: 16, height: 8 } }, 'a frame that is not square says its size')
  await page.close()
})

test('a texture animation is kept in the .vellum and the .bbmodel, and glTF shows its first frame', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const B = await import('/src/lib/bbmodel.ts')
    const E = await import('/src/lib/exporters.ts')
    const S = await import('/src/lib/samples.ts')
    const base = S.samples.find((s) => s.id === 'runic_blade').model
    const t0 = base.textures[0]
    // the same sheet, twice over: two frames
    const img = new Image()
    img.src = t0.source
    await img.decode()
    const c = document.createElement('canvas')
    c.width = t0.width
    c.height = t0.height * 2
    c.getContext('2d').drawImage(img, 0, 0)
    c.getContext('2d').drawImage(img, 0, t0.height)
    const animation = { frameTime: 4, mode: 'back_and_forth', interpolate: true }
    const m = { ...base, textures: [{ ...t0, height: t0.height * 2, source: c.toDataURL('image/png'), animation }, ...base.textures.slice(1)] }
    const viaVellum = V.readVellum(V.writeVellum(m)).textures[0]
    const bb = JSON.parse(B.toBbmodel(m))
    const viaBb = B.fromBbmodel(JSON.stringify(bb), 'x.bbmodel').model.textures[0]
    const plain = JSON.parse(B.toBbmodel(base)).textures[0]
    const gltf = JSON.parse(E.toGltf(m))
    const gltfBase = JSON.parse(E.toGltf(base))
    // the furthest-down v of every textured primitive, read from the embedded buffer
    const vs = (g) => {
      const bin = Uint8Array.from(atob(g.buffers[0].uri.split(',')[1]), (ch) => ch.charCodeAt(0))
      let most = 0
      for (const mesh of g.meshes)
        for (const prim of mesh.primitives) {
          const acc = g.accessors[prim.attributes.TEXCOORD_0]
          const view = g.bufferViews[acc.bufferView]
          const f = new Float32Array(bin.buffer.slice(view.byteOffset + (acc.byteOffset ?? 0), view.byteOffset + (acc.byteOffset ?? 0) + acc.count * 8))
          for (let i = 1; i < f.length; i += 2) most = Math.max(most, f[i])
        }
      return most
    }
    return {
      vellum: viaVellum.animation,
      bbFields: [bb.textures[0].frame_time, bb.textures[0].frame_order_type, bb.textures[0].frame_interpolate],
      bb: viaBb.animation,
      plain: [plain.frame_time, plain.frame_order_type],
      plainBack: B.fromBbmodel(B.toBbmodel(base), 'x.bbmodel').model.textures[0].animation,
      version: V.CURRENT_VERSION,
      gltf: [vs(gltf), vs(gltfBase)],
    }
  })
  assert.equal(r.version, 14)
  assert.deepEqual(r.vellum, { frameTime: 4, mode: 'back_and_forth', interpolate: true })
  assert.deepEqual(r.bbFields, [4, 'back_and_forth', true])
  assert.deepEqual(r.bb, { frameTime: 4, mode: 'back_and_forth', interpolate: true })
  assert.deepEqual(r.plain, [1, 'loop'], 'a still texture writes Blockbench defaults')
  assert.equal(r.plainBack, undefined, 'and reads back with no animation')
  assert.ok(Math.abs(r.gltf[0] - r.gltf[1] / 2) < 1e-6, `glTF UVs reach half as far down a two-frame strip: ${r.gltf}`)
  await page.close()
})

test('in Paint: add a frame, paint on it alone, set its timing; the viewport plays the frames', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await mode(page, 'Paint')
  await page.waitForSelector('.psheet__frames')
  const h0 = await page.evaluate(() => document.querySelector('.psheet__title').textContent)
  await page.click('.psheet__frames button:has-text("Frame")')
  await page.waitForFunction(() => document.querySelector('.psheet__frame-no')?.textContent.includes('2 / 2'))
  assert.match(await page.textContent('.psheet__title'), /× \d+/)
  assert.notEqual(await page.textContent('.psheet__title'), h0, 'the image grew by a frame')

  // a stroke on frame two changes only the bottom half
  const read = () =>
    page.evaluate(async () => {
      const img = new Image()
      img.src = document.querySelector('.texture-thumb').style.backgroundImage.slice(5, -2)
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      const half = (top) => {
        let sum = 0
        for (let y = top ? 0 : c.height / 2; y < (top ? c.height / 2 : c.height); y++) for (let i = 0; i < c.width * 4; i++) sum = (sum * 31 + d[(y * c.width) * 4 + i]) >>> 0
        return sum
      }
      return [half(true), half(false), c.height]
    })
  const before = await read()
  await page.click('.uv-faces .chip:has-text("north")').catch(() => {})
  const b = await page.locator('.psheet__sheet').boundingBox()
  // paint across the middle of the sheet, wherever faces are
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.5, { steps: 6 })
  await page.mouse.up()
  await page.waitForFunction(async (h) => {
    const img = new Image()
    img.src = document.querySelector('.texture-thumb').style.backgroundImage.slice(5, -2)
    await img.decode()
    return img.height === h
  }, before[2])
  const after = await read()
  assert.equal(after[0], before[0], 'frame one is untouched')
  assert.notEqual(after[1], before[1], 'frame two took the stroke')

  // timing goes onto the texture
  await page.fill('input[aria-label="Ticks per frame"]', '5')
  await page.selectOption('select[aria-label="Frame order"]', 'back_and_forth')
  assert.equal(await page.inputValue('input[aria-label="Ticks per frame"]'), '5', 'the texture took the frame time')
  assert.equal(await page.inputValue('select[aria-label="Frame order"]'), 'back_and_forth')

  // in Model mode the viewport plays: two moments a frame apart draw differently
  await mode(page, 'Model')
  const snap = () => page.$eval('.editor-view canvas', (c) => c.toDataURL())
  const shots = new Set()
  for (let i = 0; i < 8 && shots.size < 2; i++) {
    shots.add(await snap())
    await page.waitForTimeout(130)
  }
  assert.ok(shots.size >= 2, 'the viewport shows more than one frame over time')
  assert.deepEqual(errors, [])
  await page.close()
})
