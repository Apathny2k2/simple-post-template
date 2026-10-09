/* The mesh tools beyond the first round: knife, bevel, edge slide, loop
   select, fill, dissolve, inset, turning and scaling a pick, and drawing a
   face whose texture one flat map can't fit. Each must leave the surface
   closed: every edge shared by exactly two faces. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, dragArrow, dragRing, inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

test('knife, bevel, slide, loop, fill, dissolve and inset keep a cube closed', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const cube = M.makeMesh('cube', { parent: null, origin: [0, 0, 0], texture: null, place: () => [0, 0] })
    const open = (m) => {
      const n = new Map()
      for (const f of Object.values(m.faces)) {
        const o = M.faceOrder(m, f)
        o.forEach((a, i) => {
          const e = M.edgeKey(a, o[(i + 1) % o.length])
          n.set(e, (n.get(e) ?? 0) + 1)
        })
      }
      return [...n.values()].filter((c) => c !== 2).length
    }
    const loose = (m) => Object.keys(m.vertices).filter((k) => !Object.values(m.faces).some((f) => f.vertices.includes(k))).length
    const count = (m) => ({ faces: Object.keys(m.faces).length, vertices: Object.keys(m.vertices).length, open: open(m), loose: loose(m) })
    const top = Object.keys(cube.faces).find((k) => M.faceNormal(cube, cube.faces[k])[1] > 0.9)
    const topOrder = M.faceOrder(cube, cube.faces[top])
    const topEdges = topOrder.map((a, i) => M.edgeKey(a, topOrder[(i + 1) % 4]))
    // outward: every face's normal points away from the middle
    const outward = (m) => {
      const mid = M.centreOf(m, Object.keys(m.vertices))
      return Object.values(m.faces).every((f) => {
        const n = M.faceNormal(m, f)
        const c = M.faceCentre(m, f)
        return (c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] + (c[2] - mid[2]) * n[2] > 0
      })
    }

    // a knife from the middle of one top edge to the middle of the opposite one
    const knife = M.knifeCut(cube, [
      { edge: topEdges[0], t: 0.5 },
      { edge: topEdges[2], t: 0.5 },
    ])
    const bevel1 = M.bevelEdges(cube, [topEdges[0]], 1)
    const bevelTop = M.bevelEdges(cube, topEdges, 1)
    const cut = M.loopCut(cube, topEdges[0])
    const loop = M.edgeLoop(cut.mesh, cut.edges[0])
    const before = cut.edges.flatMap(M.edgeEnds).map((k) => cut.mesh.vertices[k])
    const slid = M.slideEdges(cut.mesh, cut.edges, 0.5)
    const after = cut.edges.flatMap(M.edgeEnds).map((k) => slid.vertices[k])
    const gone = M.deleteFaces(cube, [top])
    const filled = M.fillFace(gone, topOrder, null)
    const sub = M.subdivide(cube, [top])
    const inner = Object.keys(sub.faces).filter((k) => M.faceNormal(sub, sub.faces[k])[1] > 0.9)
    const shared = M.edgesOf(sub).find((e) => inner.filter((k) => M.edgeEnds(e).every((v) => sub.faces[k].vertices.includes(v))).length === 2)
    const dissolved = M.dissolveEdges(sub, [shared])
    const inset = M.insetFaces(cube, [top], 1)
    const centre = M.centreOf(cube, M.verticesOf(cube, [top]))
    const turned = M.rotateVertices(cube, M.verticesOf(cube, [top]), [0, 1, 0], 90, centre)
    const scaled = M.scaleVertices(cube, M.verticesOf(cube, [top]), [2, 1, 2], centre)
    return {
      knife: { ...count(knife.mesh), made: knife.edges.length },
      bevel1: { ...count(bevel1.mesh), outward: outward(bevel1.mesh), edges: bevel1.edges.length },
      bevelTop: { ...count(bevelTop.mesh), outward: outward(bevelTop.mesh) },
      loop: loop.length,
      slid: { ...count(slid), moved: before.every((p, i) => p.join() !== after[i].join()), onCube: after.every((p) => Math.abs(p[0]) <= 4 && Math.abs(p[2]) <= 4 && p[1] >= 0 && p[1] <= 8 && (Math.abs(p[0]) === 4 || Math.abs(p[2]) === 4 || p[1] === 0 || p[1] === 8)) },
      filled: { ...count(filled.mesh), outward: outward(filled.mesh) },
      dissolved: { ...count(dissolved.mesh) },
      inset: { ...count(inset.mesh), outward: outward(inset.mesh) },
      turnedSame: JSON.stringify(Object.values(turned.vertices).map((p) => p.map((n) => Math.round(n))).sort()) === JSON.stringify(Object.values(cube.vertices).map((p) => p.map((n) => Math.round(n))).sort()),
      scaledTop: M.verticesOf(scaled, [top]).map((k) => Math.abs(scaled.vertices[k][0])),
    }
  })
  assert.deepEqual(r.knife, { faces: 7, vertices: 10, open: 0, loose: 0, made: 1 }, 'the top splits in two and its sides take the new corners')
  assert.deepEqual(r.bevel1, { faces: 7, vertices: 10, open: 0, loose: 0, outward: true, edges: 2 }, 'one edge: a strip, and the end faces lose a corner each')
  assert.equal(r.bevelTop.open, 0, 'four edges in a row stay closed')
  assert.equal(r.bevelTop.loose, 0)
  assert.ok(r.bevelTop.outward)
  assert.equal(r.loop, 4, 'the loop cut ring is one loop of four')
  assert.deepEqual(r.slid, { faces: 10, vertices: 12, open: 0, loose: 0, moved: true, onCube: true }, 'the ring slides along the faces, staying on the surface')
  assert.deepEqual(r.filled, { faces: 6, vertices: 8, open: 0, loose: 0, outward: true }, 'F closes the hole, facing out')
  assert.deepEqual(r.dissolved, { faces: 8, vertices: 13, open: 0, loose: 0 })
  assert.deepEqual(r.inset, { faces: 10, vertices: 12, open: 0, loose: 0, outward: true })
  assert.ok(r.turnedSame, 'a quarter turn of the top lands its corners on corners')
  assert.deepEqual(r.scaledTop, [8, 8, 8, 8], 'scaled twice as wide about the middle')
  await page.close()
})

test('a face whose UVs are not its own shape is drawn as triangles', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const plane = M.makeMesh('plane', { parent: null, origin: [0, 0, 0], texture: null, place: () => [0, 0] })
    const [key, face] = Object.entries(plane.faces)[0]
    const o = M.faceOrder(plane, face)
    const square = M.facePieces(plane, face).length
    // squeeze one end of the UVs: a trapezoid on a square
    const trapezoid = { ...face, uv: { ...face.uv, [o[0]]: [face.uv[o[0]][0] + 2, face.uv[o[0]][1]] } }
    const bent = { ...plane, vertices: { ...plane.vertices, [o[2]]: [plane.vertices[o[2]][0], 3, plane.vertices[o[2]][2]] } }
    const pieces = M.facePieces(plane, trapezoid)
    return {
      key: !!key,
      square,
      trapezoid: pieces.length,
      outer: pieces.flatMap((p) => p.outer).filter(Boolean).length,
      bent: M.facePieces(bent, face).length,
    }
  })
  assert.equal(r.square, 1, 'a square on a square is one piece')
  assert.equal(r.trapezoid, 2)
  assert.equal(r.outer, 4, 'the outline has four edges; the diagonal is not one of them')
  assert.equal(r.bent, 2, 'a quad bent out of its plane is two triangles')
  await page.close()
})

/** Adds a mesh primitive from the outliner's + More menu. */
async function addMesh(page, label) {
  await page.click('.mesh-add > button')
  await page.click(`.mesh-add__menu button:has-text("${label}")`)
  await page.waitForSelector('.model-mface')
}

const middle = (page) =>
  page.$$eval('.num-field-row', (rows) => {
    const row = rows.find((r) => r.textContent.includes('Middle of the pick'))
    return row ? [...row.querySelectorAll('input')].map((i) => Number(i.value)) : null
  })

test('in the editor: knife a plane, bevel and inset a cube, turn and scale a pick, slide a ring', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await addMesh(page, 'Plane')

  // K starts the knife in Edge mode; two opposite edges, then Enter
  await page.keyboard.press('k')
  await page.waitForSelector('.scene3d__edge-hit')
  assert.equal(await page.locator('.scene3d__edge-hit').count(), 4)
  await page.locator('.scene3d__edge-hit').nth(0).click()
  await page.locator('.scene3d__edge-hit').nth(2).click()
  assert.equal(await page.locator('.scene3d__knife circle').count(), 2)
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.model-mface').count(), 2, 'the plane is cut in two')
  assert.equal(await page.locator('.scene3d__edge--own').count(), 1, 'the cut is picked')
  assert.equal(await page.locator('.scene3d__knife').count(), 0)
  await page.click('button[aria-label="Delete plane"]')

  await addMesh(page, 'Cube')
  // Edge mode: bevel one edge
  await page.keyboard.press('4')
  await page.locator('.scene3d__edge-hit').first().click()
  await page.keyboard.press('Control+b')
  assert.equal(await page.locator('.model-mface').count(), 7, 'a strip, and the end faces lose a corner each')
  assert.equal(await page.locator('.scene3d__edge--own').count(), 2)
  await page.keyboard.press('Control+z')
  assert.equal(await page.locator('.model-mface').count(), 6)

  // Face mode: inset the face nearest the camera
  await page.keyboard.press('2')
  const face = page.locator('.editor-view .model-mface').first()
  const fb = await face.boundingBox()
  await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2)
  await page.keyboard.press('i')
  assert.equal(await page.locator('.model-mface').count(), 10)
  await page.keyboard.press('Control+z')

  // Vertex mode: everything picked, turned on the ring and scaled on an arrow; the middle stays put
  await page.keyboard.press('3')
  await page.keyboard.press('Control+a')
  const before = await middle(page)
  const corners = () => page.$$eval('.scene3d__vertex', (els) => els.map((e) => `${e.style.left},${e.style.top}`).join(';'))
  const c0 = await corners()
  await page.keyboard.press('r')
  await page.waitForSelector('.xform [data-handle="y"] .xform__ring')
  await dragRing(page, 'y')
  await page.waitForTimeout(100)
  assert.notEqual(await corners(), c0, 'the corners turned')
  assert.deepEqual(await middle(page), before, 'about the middle of the pick')
  await page.keyboard.press('s')
  await page.waitForSelector('.xform [data-handle="x"]')
  const c1 = await corners()
  await dragArrow(page, 'x', 60)
  await page.waitForTimeout(100)
  assert.notEqual(await corners(), c1, 'the corners spread')
  await page.keyboard.press('v')

  // Edge mode: loop cut, then slide the new ring with the keyboard
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('4')
  await page.keyboard.press('Escape')
  await page.locator('.scene3d__edge-hit').first().click()
  await page.click('.chip:has-text("Loop cut")')
  const ring = await middle(page)
  const slider = page.locator('input[aria-label="Edge slide"]')
  await slider.focus()
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
  const slid = await middle(page)
  assert.notDeepEqual(slid, ring, 'the ring slid')
  assert.equal(await slider.inputValue(), '0', 'the slider springs back after each step')
  assert.deepEqual(errors, [])
  await page.close()
})

test('a face with a dragged UV corner is drawn as two triangles', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await addMesh(page, 'Cube')
  await page.keyboard.press('2')
  await page.locator('.uv-mesh__face').first().scrollIntoViewIfNeeded()
  const key = await page.$$eval('.uv-mesh__face', (els) =>
    els
      .find((e) => {
        const r = e.getBoundingClientRect()
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e
      })
      ?.getAttribute('data-mface'),
  )
  const poly = page.locator(`.uv-mesh__face[data-mface="${key}"]`)
  const pb = await poly.boundingBox()
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2)
  assert.equal(await page.locator(`.model-mface[data-mface="${key}"]`).count(), 1)
  const corner = page.locator(`.uv-mesh__corner[data-corner^="${key}:"]`).first()
  const cb = await corner.boundingBox()
  await drag(page, [cb.x + cb.width / 2, cb.y + cb.height / 2], [cb.x + cb.width / 2 + 12, cb.y + cb.height / 2 + 9], 4)
  assert.equal(await page.locator(`.model-mface--tri[data-mface="${key}"]`).count(), 2, 'a trapezoid of UVs on a square needs two maps')
  await page.keyboard.press('Control+z')
  assert.equal(await page.locator(`.model-mface[data-mface="${key}"]`).count(), 1)
  assert.deepEqual(errors, [])
  await page.close()
})
