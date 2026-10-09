/* Texture meshes: built from a texture's pixels, kept through a .bbmodel's
   texture_mesh and the .vellum, and added, scaled and converted in the
   editor. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

/** A 4 by 4 PNG with a plus of five pixels in the middle, made in the page. */
const plus = () => {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 4
  const x = c.getContext('2d')
  x.fillStyle = '#c33'
  for (const [a, b] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) x.fillRect(a, b, 1, 1)
  return c.toDataURL('image/png')
}

test('a texture mesh is the picture in front and behind, and a strip on every edge of a shown pixel', async () => {
  const { page } = await open()
  const r = await inApp(page, async (plusSrc) => {
    const T = await import('/src/lib/texture-mesh.ts')
    const M = await import('/src/lib/mesh.ts')
    const source = new Function(`return (${plusSrc})()`)()
    const tex = { id: 't', name: 'plus.png', width: 4, height: 4, uvWidth: 4, uvHeight: 4, source }
    const g = await T.textureMeshGeometry(tex, { resolution: { width: 4, height: 4 } })
    const mesh = { id: 'm', name: 'm', parent: null, origin: [0, 0, 0], rotation: [0, 0, 0], visible: true, locked: false, ...g }
    const pts = Object.values(g.vertices)
    const span = (i) => [Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))]
    // every face points away from the middle of the pixel it was made for
    const mid = (f) => M.faceCentre(mesh, f)
    const outward = Object.values(g.faces).every((f) => {
      const n = M.faceNormal(mesh, f)
      const c = mid(f)
      // front and back face out along z; a side faces away from the picture's middle in its own direction
      if (Math.abs(n[2]) > 0.9) return Math.sign(n[2]) === Math.sign(c[2])
      return true
    })
    const scaled = await T.textureMeshGeometry(tex, { resolution: { width: 4, height: 4 } }, [2, 1, 1], [0, 1, 0])
    const sp = Object.values(scaled.vertices)
    return {
      faces: Object.keys(g.faces).length,
      x: span(0),
      y: span(1),
      z: span(2),
      outward,
      textured: Object.values(g.faces).every((f) => f.texture === 't'),
      scaledX: [Math.min(...sp.map((p) => p[0])), Math.max(...sp.map((p) => p[0]))],
      movedY: Math.min(...sp.map((p) => p[1])),
    }
  }, plus.toString())
  assert.equal(r.faces, 2 + 12, 'front, back, and the plus has twelve outer pixel edges')
  assert.deepEqual(r.x, [-2, 2], 'centred across')
  assert.deepEqual(r.y, [0, 4], 'standing on its origin')
  assert.deepEqual(r.z, [-0.5, 0.5], 'one pixel deep')
  assert.ok(r.outward)
  assert.ok(r.textured)
  assert.deepEqual(r.scaledX, [-4, 4], 'scale stretches it')
  assert.equal(r.movedY, -1, 'and the local pivot moves it')
  await page.close()
})

test('a .bbmodel texture_mesh opens as one, is built, and saves back as one, through the .vellum too', async () => {
  const { page } = await open()
  const r = await inApp(page, async (plusSrc) => {
    const B = await import('/src/lib/bbmodel.ts')
    const V = await import('/src/lib/vellum.ts')
    const T = await import('/src/lib/texture-mesh.ts')
    const source = new Function(`return (${plusSrc})()`)()
    const project = {
      meta: { format_version: '4.10', model_format: 'free', box_uv: false },
      name: 'sprite',
      resolution: { width: 4, height: 4 },
      elements: [
        { name: 'cube', type: 'cube', uuid: 'cccccccc-0000-4000-a000-000000000001', from: [0, 0, 0], to: [1, 1, 1], origin: [0, 0, 0], faces: {} },
        {
          name: 'sword sprite',
          type: 'texture_mesh',
          uuid: 'dddddddd-0000-4000-a000-000000000001',
          texture: 'eeeeeeee-0000-4000-a000-000000000001',
          origin: [0, 8, 0],
          rotation: [0, 45, 0],
          local_pivot: [0, 2, 0],
          scale: [2, 2, 1],
          render_order: 'behind',
        },
      ],
      outliner: [{ name: 'body', uuid: 'aaaaaaaa-0000-4000-a000-000000000001', origin: [0, 0, 0], children: ['cccccccc-0000-4000-a000-000000000001', 'dddddddd-0000-4000-a000-000000000001'] }],
      textures: [{ name: 'plus.png', uuid: 'eeeeeeee-0000-4000-a000-000000000001', id: '0', width: 4, height: 4, uv_width: 4, uv_height: 4, source }],
      animations: [],
    }
    const got = B.fromBbmodel(JSON.stringify(project), 'sprite.bbmodel')
    const built = await T.rebuildTextureMeshes(got.model)
    const tm = built.meshes[0]
    const out = JSON.parse(B.toBbmodel(V.readVellum(V.writeVellum(built))))
    const el = out.elements.find((e) => e.name === 'sword sprite')
    return {
      notes: got.notes.filter((n) => /texture_mesh|can't show/.test(n)),
      from: tm.fromTexture,
      parent: built.bones[0].id === tm.parent,
      faces: Object.keys(tm.faces).length,
      before: Object.keys(got.model.meshes[0].faces).length,
      el: { type: el.type, texture: el.texture, scale: el.scale, local_pivot: el.local_pivot, origin: el.origin, rotation: el.rotation, render_order: el.render_order, vertices: el.vertices },
    }
  }, plus.toString())
  assert.deepEqual(r.notes, [], 'nothing is left out')
  assert.equal(r.before, 0, 'faces come from the pixels, after decoding')
  assert.equal(r.faces, 14)
  assert.ok(r.parent, 'it rides on its group')
  assert.deepEqual(r.from, { texture: 'eeeeeeee-0000-4000-a000-000000000001', scale: [2, 2, 1], localPivot: [0, 2, 0] })
  assert.deepEqual(r.el, { type: 'texture_mesh', texture: 'eeeeeeee-0000-4000-a000-000000000001', scale: [2, 2, 1], local_pivot: [0, 2, 0], origin: [0, 8, 0], rotation: [0, 45, 0], render_order: 'behind', vertices: undefined })
  await page.close()
})

test('in the editor: add a texture mesh, scale it, and convert it to an ordinary mesh', async () => {
  const { page, errors } = await openEditor('runic_blade')
  const faces0 = await page.locator('.model-mface').count()
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Texture mesh")')
  await page.waitForSelector('.tmesh')
  await page.waitForFunction((n) => document.querySelectorAll('.model-mface').length > n, faces0)
  const extent = () =>
    page.evaluate(() => {
      const rects = [...document.querySelectorAll('.model-mface')].map((e) => e.getBoundingClientRect())
      return Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left))
    })
  const w0 = await extent()
  await page.fill('input[aria-label="Scale X"]', '2')
  await page.waitForFunction((w) => {
    const rects = [...document.querySelectorAll('.model-mface')].map((e) => e.getBoundingClientRect())
    return Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)) > w * 1.3
  }, w0)
  await page.click('.tmesh button:has-text("Convert to mesh")')
  await page.waitForFunction(() => !document.querySelector('.tmesh'))
  await page.keyboard.press('Control+z')
  await page.waitForSelector('.tmesh')
  assert.deepEqual(errors, [])
  await page.close()
})
