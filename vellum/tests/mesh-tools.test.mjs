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
  await page.waitForFunction((n) => document.querySelectorAll('.scene3d__edge--own').length === n, 1, { timeout: 3000 })
  assert.equal(await page.locator('.scene3d__knife').count(), 0)
  await page.click('button[aria-label="Delete plane"]')

  await addMesh(page, 'Cube')
  // Edge mode: bevel one edge
  await page.keyboard.press('4')
  await page.locator('.scene3d__edge-hit').first().click()
  await page.keyboard.press('Control+b')
  assert.equal(await page.locator('.model-mface').count(), 7, 'a strip, and the end faces lose a corner each')
  await page.waitForFunction((n) => document.querySelectorAll('.scene3d__edge--own').length === n, 2, { timeout: 3000 })
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

test('merge by distance, separate, join and cube to mesh', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const K = await import('/src/lib/kinematics.ts')
    const S = await import('/src/lib/samples.ts')
    const cube = M.makeMesh('cube', { parent: null, origin: [0, 0, 0], texture: null, place: () => [0, 0] })
    const top = Object.keys(cube.faces).find((k) => M.faceNormal(cube, cube.faces[k])[1] > 0.9)
    const sep = M.separateFaces(cube, [top], 'lid')
    // joined back, the lid's corners sit on the box's: merge by distance closes it again
    const joined = M.joinMeshes(sep.mesh, [{ mesh: sep.piece, toTarget: (p) => p }])
    const merged = M.mergeByDistance(joined, 0.01)
    const open = (m) => {
      const n = new Map()
      for (const f of Object.values(m.faces)) {
        const o = M.faceOrder(m, f)
        o.forEach((a, i) => n.set(M.edgeKey(a, o[(i + 1) % o.length]), (n.get(M.edgeKey(a, o[(i + 1) % o.length])) ?? 0) + 1))
      }
      return [...n.values()].filter((c) => c !== 2).length
    }
    // a turned, inflated cube from a sample: its mesh has the same corners in the world
    const model = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const c = { ...model.cubes[0], rotation: [10, 20, 30], inflate: 0.5 }
    model.cubes[0] = c
    const owner = [...K.buildRig(model, {}).cubeOwner.entries()].find(([id]) => id === c.id)?.[1] ?? null
    const mesh = M.cubeToMesh(c, owner)
    const withMesh = { ...model, meshes: [mesh] }
    const rig = K.buildRig(withMesh, {})
    const cf = K.cubeFrame(rig, c)
    const mf = K.meshFrame(rig, mesh)
    const lo = c.from.map((v) => v - 0.5)
    const hi = c.to.map((v) => v + 0.5)
    const cubeCorners = []
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) cubeCorners.push(K.apply(cf, [x - c.origin[0], y - c.origin[1], z - c.origin[2]]).map((v) => Math.round(v * 100) / 100).join())
    const meshCorners = Object.values(mesh.vertices).map((p) => K.apply(mf, p).map((v) => Math.round(v * 100) / 100).join())
    // the north face: its top left (seen from outside) is the high x, high y, low z corner, at the UV rect's first corner
    const north = Object.values(mesh.faces).find((f) => {
      const n = M.faceNormal(mesh, f)
      return n[2] < -0.9
    })
    const tl = north.vertices.find((k) => {
      const p = mesh.vertices[k]
      return Math.abs(p[0] - (hi[0] - c.origin[0])) < 1e-6 && Math.abs(p[1] - (hi[1] - c.origin[1])) < 1e-6
    })
    return {
      sep: { rest: Object.keys(sep.mesh.faces).length, piece: Object.keys(sep.piece.faces).length, pieceVerts: Object.keys(sep.piece.vertices).length, restVerts: Object.keys(sep.mesh.vertices).length },
      joined: { faces: Object.keys(joined.faces).length, verts: Object.keys(joined.vertices).length },
      merged: { removed: merged.removed, verts: Object.keys(merged.mesh.vertices).length, open: open(merged.mesh) },
      corners: JSON.stringify(cubeCorners.sort()) === JSON.stringify(meshCorners.sort()),
      faces: Object.keys(mesh.faces).length,
      closed: open(mesh),
      tlUv: north.uv[tl],
      rect: c.faces.north.uv.slice(0, 2),
      turn: c.faces.north.rotation ?? 0,
    }
  })
  assert.deepEqual(r.sep, { rest: 5, piece: 1, pieceVerts: 4, restVerts: 8 }, 'the lid leaves with copies of its corners')
  assert.deepEqual(r.joined, { faces: 6, verts: 12 })
  assert.deepEqual(r.merged, { removed: 4, verts: 8, open: 0 }, 'and merging by distance closes the box again')
  assert.ok(r.corners, 'a turned, inflated cube and its mesh have the same corners in the world')
  assert.equal(r.faces, 6)
  assert.equal(r.closed, 0)
  if (r.turn === 0) assert.deepEqual(r.tlUv, r.rect, 'the north face keeps its UV corner where the cube drew it')
  await page.close()
})

test('in the editor: convert a cube, separate faces, join them back, merge by distance', async () => {
  const { page, errors } = await openEditor()
  await page.click('.tree__row:has-text("yoke")')
  const cubes = await page.locator('.model-cube').count()
  await page.click('button[aria-label="Convert yoke to a mesh"]')
  await page.waitForSelector('.model-mface')
  assert.equal(await page.locator('.model-cube').count(), cubes - 1)
  assert.equal(await page.locator('.model-mface').count(), 6)
  assert.equal(await page.inputValue('.insp-head__name'), 'yoke')

  // Face mode: pick one face and separate it
  await page.keyboard.press('2')
  const face = page.locator('.editor-view .model-mface').first()
  const b = await face.boundingBox()
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForSelector('.model-mface--picked')
  await page.keyboard.press('p')
  await page.waitForFunction(() => document.querySelector('.insp-head__name')?.value === 'yoke_1', null, { timeout: 3000 })

  // pick both meshes and join them
  await page.click('.tree__row:has(.tree__name:text-is("yoke"))', { modifiers: ['Control'] })
  assert.equal((await page.$$('.tree__row[aria-selected="true"]')).length, 2)
  await page.keyboard.press('Control+j')
  await page.waitForFunction(() => /12 vertices( ·|,) 6 faces/.test(document.body.textContent), null, { timeout: 3000 })
  assert.equal(await page.locator('.tree__row:has(.tree__name:text-is("yoke_1"))').count() + (await page.locator('.tree__row:has(.tree__name:text-is("yoke"))').count()), 1, 'one mesh is left')
  assert.match(await page.textContent('body'), /12 vertices( ·|,) 6 faces/)
  await page.keyboard.press('1')
  await page.click('.chip:has-text("Merge by distance")')
  await page.waitForFunction(() => /8 vertices( ·|,) 6 faces/.test(document.body.textContent), null, { timeout: 3000 })
  assert.deepEqual(errors, [])
  await page.close()
})

test('bevel: mitred corners, the whole cube, rounded segments and a vertex', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const cube = M.makeMesh('cube', { parent: null, origin: [0, 0, 0], texture: null, place: () => [0, 0] })
    const shape = (m) => {
      const n = new Map()
      for (const f of Object.values(m.faces)) {
        const o = M.faceOrder(m, f)
        o.forEach((a, i) => n.set(M.edgeKey(a, o[(i + 1) % o.length]), (n.get(M.edgeKey(a, o[(i + 1) % o.length])) ?? 0) + 1))
      }
      const mid = M.centreOf(m, Object.keys(m.vertices))
      const outward = Object.values(m.faces).every((f) => {
        const nn = M.faceNormal(m, f)
        const c = M.faceCentre(m, f)
        return (c[0] - mid[0]) * nn[0] + (c[1] - mid[1]) * nn[1] + (c[2] - mid[2]) * nn[2] > 0
      })
      return { faces: Object.keys(m.faces).length, vertices: Object.keys(m.vertices).length, open: [...n.values()].filter((c) => c !== 2).length, outward }
    }
    const top = Object.keys(cube.faces).find((k) => M.faceNormal(cube, cube.faces[k])[1] > 0.9)
    const o = M.faceOrder(cube, cube.faces[top])
    const ring = o.map((a, i) => M.edgeKey(a, o[(i + 1) % 4]))
    const topRing = M.bevel(cube, { edges: ring }, 1)
    const all = M.bevel(cube, { edges: M.edgesOf(cube) }, 1)
    const round = M.bevel(cube, { edges: [ring[0]] }, 2, 3)
    const corner = M.bevel(cube, { vertices: [o[0]] }, 1)
    // the top face, after the ring's bevel, is a smaller square: its corners mitred 1 in from each side
    const lid = Object.values(topRing.mesh.faces).find((f) => f.vertices.every((v) => Math.abs(topRing.mesh.vertices[v][1] - 8) < 1e-6) && f.vertices.length === 4)
    return {
      ring: shape(topRing.mesh),
      lid: lid ? lid.vertices.map((v) => [Math.abs(topRing.mesh.vertices[v][0]), Math.abs(topRing.mesh.vertices[v][2])]) : null,
      all: shape(all.mesh),
      round: { ...shape(round.mesh), edges: round.edges.length },
      corner: shape(corner.mesh),
    }
  })
  assert.deepEqual(r.ring, { faces: 10, vertices: 12, open: 0, outward: true }, 'four strips meet in mitres, and the sides lose their top corners')
  assert.deepEqual(r.lid, [[3, 3], [3, 3], [3, 3], [3, 3]])
  assert.deepEqual(r.all, { faces: 26, vertices: 24, open: 0, outward: true }, 'every edge: 12 strips and 8 corner triangles')
  assert.equal(r.round.open, 0)
  assert.equal(r.round.faces, 9, 'three faces across the strip')
  assert.ok(r.round.outward)
  assert.deepEqual(r.corner, { faces: 7, vertices: 10, open: 0, outward: true }, 'a bevelled corner is cut off by a triangle')
  await page.close()
})

test('the knife cuts through the inside of a face', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const cube = M.makeMesh('cube', { parent: null, origin: [0, 0, 0], texture: null, place: () => [0, 0] })
    const top = Object.keys(cube.faces).find((k) => M.faceNormal(cube, cube.faces[k])[1] > 0.9)
    const o = M.faceOrder(cube, cube.faces[top])
    const ring = o.map((a, i) => M.edgeKey(a, o[(i + 1) % 4]))
    const shape = (m) => {
      const n = new Map()
      for (const f of Object.values(m.faces)) {
        const fo = M.faceOrder(m, f)
        fo.forEach((a, i) => n.set(M.edgeKey(a, fo[(i + 1) % fo.length]), (n.get(M.edgeKey(a, fo[(i + 1) % fo.length])) ?? 0) + 1))
      }
      return { faces: Object.keys(m.faces).length, vertices: Object.keys(m.vertices).length, open: [...n.values()].filter((c) => c !== 2).length }
    }
    // in at one edge, a bend inside the top face, out at the opposite edge
    const bent = M.knifeCut(cube, [{ edge: ring[0], t: 0.5 }, { face: top, at: [1, 8, 1] }, { edge: ring[2], t: 0.5 }])
    // a run that stops inside the face cuts nothing; its edge point still joins the outline
    const dangling = M.knifeCut(cube, [{ edge: ring[0], t: 0.5 }, { face: top, at: [1, 8, 1] }])
    // the inside point's UV is where it sits on the face's own UVs
    const f = cube.faces[top]
    const us = o.map((k) => f.uv[k][0])
    const vs = o.map((k) => f.uv[k][1])
    const inner = Object.keys(bent.mesh.vertices).find((k) => !cube.vertices[k] && Math.abs(bent.mesh.vertices[k][0] - 1) < 1e-6 && Math.abs(bent.mesh.vertices[k][2] - 1) < 1e-6)
    const uvs = Object.values(bent.mesh.faces).filter((x) => x.vertices.includes(inner)).map((x) => x.uv[inner])
    return {
      bent: { ...shape(bent.mesh), made: bent.edges.length },
      dangling: shape(dangling.mesh),
      inner: uvs.length === 2 && JSON.stringify(uvs[0]) === JSON.stringify(uvs[1]),
      inside: uvs[0] && uvs[0][0] > Math.min(...us) && uvs[0][0] < Math.max(...us) && uvs[0][1] > Math.min(...vs) && uvs[0][1] < Math.max(...vs),
    }
  })
  assert.deepEqual(r.bent, { faces: 7, vertices: 11, open: 0, made: 2 }, 'the top splits along a bent line, the sides take the new edge points')
  assert.deepEqual(r.dangling, { faces: 6, vertices: 9, open: 0 })
  assert.ok(r.inner, 'both halves give the inside point the same UV')
  assert.ok(r.inside, 'and it lies inside the face on the sheet')
  await page.close()
})

test('in the editor: the knife takes a click inside a face', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Plane")')
  await page.waitForSelector('.model-mface')
  await page.keyboard.press('k')
  await page.waitForSelector('.scene3d__edge-hit')
  await page.locator('.scene3d__edge-hit').nth(0).click()
  const face = await page.locator('.editor-view .model-mface').first().boundingBox()
  await page.mouse.click(face.x + face.width * 0.45, face.y + face.height * 0.55)
  await page.locator('.scene3d__edge-hit').nth(2).click()
  assert.equal(await page.locator('.scene3d__knife circle').count(), 3)
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.editor-view .model-mface:not(.model-mface--tri)').count() + (await page.$$eval('.editor-view .model-mface--tri', (els) => new Set(els.map((e) => e.dataset.mface)).size)), 2, 'two faces')
  await page.waitForFunction((n) => document.querySelectorAll('.scene3d__edge--own').length === n, 2, { timeout: 3000 })
  assert.deepEqual(errors, [])
  await page.close()
})
