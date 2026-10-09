/* Meshes: the geometry in lib/mesh.ts, the v9 file, and editing one in the
   editor the way Blockbench does: add a primitive, pick faces or vertices,
   move them with the gizmo, extrude, merge, delete. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drag, dragArrow, inApp, mode, open, openEditor, startApp } from './harness.mjs'

startApp()

test('every primitive faces outward, and extrude, merge, delete and flip keep it whole', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const at = () => [0, 0]
    const out = {}
    for (const p of M.PRIMITIVES) {
      const m = M.makeMesh(p.id, { parent: null, origin: [0, 0, 0], texture: null, place: at })
      const keys = Object.keys(m.vertices)
      const mid = M.centreOf(m, keys)
      let inward = 0
      for (const f of Object.values(m.faces)) {
        const n = M.faceNormal(m, f)
        const c = M.faceCentre(m, f)
        const d = (c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] + (c[2] - mid[2]) * n[2]
        // a plane has its middle on its face, so it only needs a normal
        if (p.id === 'plane' ? n[1] <= 0 : d <= 0) inward++
      }
      out[p.id] = { faces: Object.keys(m.faces).length, vertices: keys.length, inward }
    }
    const cube = M.makeMesh('cube', { parent: null, origin: [0, 0, 0], texture: null, place: at })
    const top = Object.keys(cube.faces).find((k) => M.faceNormal(cube, cube.faces[k])[1] > 0.9)
    const ex = M.extrudeFaces(cube, [top], 2)
    const topY = Math.min(...M.verticesOf(ex.mesh, ex.faces).map((k) => ex.mesh.vertices[k][1]))
    const two = M.verticesOf(cube, [top]).slice(0, 2)
    const merged = M.mergeVertices(cube, two)
    const flipped = M.flipFaces(cube, [top])
    const gone = M.deleteFaces(cube, [top])
    return {
      out,
      extruded: { faces: Object.keys(ex.mesh.faces).length, vertices: Object.keys(ex.mesh.vertices).length, topY, same: ex.faces[0] === top },
      merged: { vertices: Object.keys(merged.mesh.vertices).length, faces: Object.keys(merged.mesh.faces).length },
      flippedY: M.faceNormal(flipped, flipped.faces[top])[1],
      afterDelete: { faces: Object.keys(gone.faces).length, vertices: Object.keys(gone.vertices).length },
    }
  })
  for (const [kind, v] of Object.entries(r.out)) assert.equal(v.inward, 0, `${kind} has ${v.inward} face(s) facing in`)
  assert.deepEqual([r.out.cube.faces, r.out.cube.vertices], [6, 8])
  assert.deepEqual([r.out.pyramid.faces, r.out.pyramid.vertices], [5, 5])
  assert.deepEqual(r.extruded, { faces: 10, vertices: 12, topY: 10, same: true }, 'four sides join the moved top')
  assert.deepEqual(r.merged, { vertices: 7, faces: 6 }, 'a merged edge leaves every face with three corners or more')
  assert.ok(r.flippedY < -0.9, 'the flipped top faces down')
  assert.deepEqual(r.afterDelete, { faces: 5, vertices: 8 })
  await page.close()
})

test('a mesh round-trips through .vellum version 9 and on', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const M = await import('/src/lib/mesh.ts')
    const S = await import('/src/lib/samples.ts')
    const base = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const mesh = M.makeMesh('cylinder', { parent: base.bones[0].id, origin: [1, 2, 3], texture: base.textures[0].id, place: () => [4, 4] })
    const m = { ...base, meshes: [{ ...mesh, rotation: [0, 22.5, 0] }] }
    const t = V.writeVellum(m)
    const back = V.readVellum(t)
    const b = back.meshes[0]
    return {
      stable: t === V.writeVellum(back),
      version: JSON.parse(t).vellum.version,
      parent: b.parent === base.bones[0].id,
      faces: Object.keys(b.faces).length,
      vertices: Object.keys(b.vertices).length,
      rotation: b.rotation,
      uvKept: Object.keys(mesh.faces).every((k) => JSON.stringify(b.faces[k].uv) === JSON.stringify(mesh.faces[k].uv)),
      noMeshKey: !V.writeVellum(base).includes('"meshes"'),
    }
  })
  assert.ok(r.stable)
  assert.equal(r.version, 11)
  assert.ok(r.parent)
  assert.deepEqual([r.faces, r.vertices], [10, 16])
  assert.deepEqual(r.rotation, [0, 22.5, 0])
  assert.ok(r.uvKept)
  assert.ok(r.noMeshKey, 'a model with no meshes writes no meshes key')
  await page.close()
})

test('add a mesh, pick a face, extrude it, move vertices with the gizmo, undo', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Cube")')
  await page.waitForSelector('.model-mface')
  assert.equal(await page.locator('.model-mface').count(), 6)
  assert.equal(await page.inputValue('.insp-head__name'), 'cube')
  assert.ok((await page.$$eval('.tree__row .tree__name', (els) => els.map((e) => e.textContent))).includes('cube'), 'listed in the outliner')

  // Face mode: pick the face nearest the camera and extrude it
  await page.keyboard.press('2')
  const face = page.locator('.model-mface').first()
  const b = await face.boundingBox()
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  assert.equal(await page.locator('.model-mface--picked').count(), 1)
  await page.keyboard.press('e')
  assert.equal(await page.locator('.model-mface').count(), 10, 'extrude adds four sides')

  // Vertex mode: pick every vertex and move them along X with the arrow
  await page.keyboard.press('3')
  await page.keyboard.press('Control+a')
  assert.equal(await page.locator('.scene3d__vertex--own').count(), 12)
  const mid = () => page.$$eval('.num-field-row', (rows) => {
    const row = rows.find((r) => r.textContent.includes('Middle of the pick'))
    return [...row.querySelectorAll('input')].map((i) => Number(i.value))
  })
  const before = await mid()
  await dragArrow(page, 'x', 60)
  const after = await mid()
  assert.ok(after[0] > before[0], `the pick moved along X: ${before[0]} -> ${after[0]}`)
  assert.deepEqual(after.slice(1), before.slice(1))
  await page.keyboard.press('Control+z')
  assert.deepEqual(await mid(), before, 'one undo for the drag')

  // merge two vertices, then delete the mesh
  await page.keyboard.press('Escape')
  const dots = page.locator('.scene3d__vertex')
  await dots.nth(0).click()
  await dots.nth(1).click({ modifiers: ['Shift'] })
  await page.keyboard.press('m')
  assert.equal(await page.locator('.scene3d__vertex').count(), 11)
  await page.keyboard.press('1')
  await page.click('button[aria-label="Delete cube"]')
  assert.equal(await page.locator('.model-mface').count(), 0)
  assert.deepEqual(errors, [])
  await page.close()
})

test('a mesh in a Blockbench project comes in, exports to glTF facing outward, and Java JSON says it cannot go', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const I = await import('/src/lib/importers.ts')
    const E = await import('/src/lib/exporters.ts')
    const T = await import('/src/lib/mcmodel.ts')
    const bb = JSON.stringify({
      meta: { format_version: '4.10', model_format: 'free' },
      name: 'wedge',
      resolution: { width: 16, height: 16 },
      elements: [
        {
          name: 'wedge', type: 'mesh', uuid: 'm-1', origin: [0, 0, 0], rotation: [0, 0, 0],
          vertices: { a: [0, 0, 0], b: [8, 0, 0], c: [8, 0, 8], d: [0, 0, 8], e: [0, 8, 0], f: [0, 8, 8] },
          faces: {
            bottom: { vertices: ['a', 'b', 'c', 'd'], uv: { a: [0, 0], b: [8, 0], c: [8, 8], d: [0, 8] }, texture: null },
            back: { vertices: ['a', 'd', 'f', 'e'], uv: { a: [0, 0], d: [8, 0], f: [8, 8], e: [0, 8] }, texture: null },
            // starts at another corner, as Blockbench files can
            slope: { vertices: ['e', 'f', 'c', 'b'], uv: { e: [0, 0], f: [8, 0], c: [8, 8], b: [0, 8] }, texture: null },
            left: { vertices: ['a', 'e', 'b'], uv: { a: [0, 0], e: [0, 8], b: [8, 0] }, texture: null },
            right: { vertices: ['d', 'c', 'f'], uv: { d: [0, 0], c: [8, 0], f: [0, 8] }, texture: null },
          },
        },
      ],
      outliner: [{ name: 'root', uuid: 'g-1', origin: [0, 0, 0], children: ['m-1'] }],
      textures: [],
    })
    const { model, notes } = I.fromBbmodel(bb, 'wedge.bbmodel')
    const g = JSON.parse(E.toGltf(model))
    const bin = Uint8Array.from(atob(g.buffers[0].uri.split(',')[1]), (c) => c.charCodeAt(0))
    const read = (i, Kind) => {
      const a = g.accessors[i]
      const v = g.bufferViews[a.bufferView]
      const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count
      return new Kind(bin.buffer.slice(v.byteOffset, v.byteOffset + n * 4))
    }
    let tris = 0
    let outward = 0
    // a point inside the wedge (the slope's plane is x + y = 8)
    const centre = [2 / 16, 2 / 16, 4 / 16]
    for (const mesh of g.meshes) for (const p of mesh.primitives) {
      const pos = read(p.attributes.POSITION, Float32Array)
      const idx = read(p.indices, Uint32Array)
      for (let t = 0; t < idx.length; t += 3) {
        const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
        const [A, B, C] = [P(idx[t]), P(idx[t + 1]), P(idx[t + 2])]
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
        const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
        const mid = [(A[0] + B[0] + C[0]) / 3 - centre[0], (A[1] + B[1] + C[1]) / 3 - centre[1], (A[2] + B[2] + C[2]) / 3 - centre[2]]
        tris++
        if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] > 0) outward++
      }
    }
    const java = T.checkTranslation(model, 'items', 'pack').filter((i) => /mesh/.test(i.message))
    return { meshes: model.meshes?.length, parent: model.meshes?.[0].parent, faces: Object.keys(model.meshes?.[0].faces ?? {}).length, notes, tris, outward, java: java.map((i) => i.level) }
  })
  assert.equal(r.meshes, 1)
  assert.equal(r.parent, 'g-1', 'the mesh keeps its group as its bone')
  assert.equal(r.faces, 5)
  assert.ok(!r.notes.some((n) => /left out/.test(n)), 'nothing was left out')
  assert.equal(r.tris, 8, 'three quads and two triangles')
  assert.equal(r.outward, r.tris, 'every triangle faces outward, whichever corner a face starts at')
  assert.deepEqual(r.java, ['error'])
  await page.close()
})

test('painting on a mesh face in 3D changes its texture', async () => {
  const { page } = await openEditor('runic_blade')
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Cube")')
  await mode(page, 'Paint')
  await page.click('.ptools__view button:has-text("Model")')
  const before = await page.$eval('.texture-thumb', (e) => e.style.backgroundImage)
  const face = page.locator('.editor-view .model-mface').first()
  const b = await face.boundingBox()
  await drag(page, [b.x + b.width / 2, b.y + b.height / 2], [b.x + b.width / 2 + 4, b.y + b.height / 2 + 2], 3)
  await page.waitForTimeout(200)
  assert.notEqual(await page.$eval('.texture-thumb', (e) => e.style.backgroundImage), before)
  await page.close()
})

test('loop cut and subdivide split faces and leave the surface closed', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/mesh.ts')
    const cube = M.makeMesh('cube', { parent: null, origin: [0, 0, 0], texture: null, place: () => [0, 0] })
    // every edge of a closed surface is shared by exactly two faces
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
    const count = (m) => ({ faces: Object.keys(m.faces).length, vertices: Object.keys(m.vertices).length, open: open(m) })
    const cut = M.loopCut(cube, M.edgesOf(cube)[0])
    const all = M.subdivide(cube)
    const top = Object.keys(cube.faces).find((k) => M.faceNormal(cube, cube.faces[k])[1] > 0.9)
    const one = M.subdivide(cube, [top])
    const turned = M.turnFacesUv(cube, [top])
    const mirrored = M.mirrorFacesUv(cube, [top], 'u')
    return {
      edges: M.edgesOf(cube).length,
      cut: { ...count(cut.mesh), ring: cut.edges.length },
      all: count(all),
      one: count(one),
      bounds: [M.uvBoundsOf(cube, [top]), M.uvBoundsOf(mirrored, [top])],
      turnedSize: (() => {
        const [a, b, c, d] = M.uvBoundsOf(cube, [top])
        const [e, f, g, h] = M.uvBoundsOf(turned, [top])
        return [c - a, d - b, g - e, h - f]
      })(),
    }
  })
  assert.equal(r.edges, 12)
  assert.deepEqual(r.cut, { faces: 10, vertices: 12, open: 0, ring: 4 }, 'a ring of four new edges round the cube')
  assert.deepEqual(r.all, { faces: 24, vertices: 26, open: 0 }, 'four quads per face, middles shared')
  assert.deepEqual(r.one, { faces: 9, vertices: 13, open: 0 }, 'the sides take the new middles on their top edges')
  assert.deepEqual(r.bounds[0], r.bounds[1], 'mirroring keeps the bounds')
  assert.deepEqual([r.turnedSize[0], r.turnedSize[1]], [r.turnedSize[3], r.turnedSize[2]], 'a quarter turn swaps width and height')
  await page.close()
})

test('edge mode: pick an edge, loop cut, box-pick vertices, move UVs on the sheet', async () => {
  const { page, errors } = await openEditor('runic_blade')
  await page.click('.mesh-add > button')
  await page.click('.mesh-add__menu button:has-text("Cube")')
  await page.waitForSelector('.model-mface')

  await page.keyboard.press('4')
  await page.waitForSelector('.scene3d__edge-hit')
  assert.equal(await page.locator('.scene3d__edge-hit').count(), 12)
  assert.equal(await page.locator('.scene3d__vertex').count(), 0, 'edge mode draws no dots')
  await page.locator('.scene3d__edge-hit').first().click()
  await page.waitForFunction((n) => document.querySelectorAll('.scene3d__edge--own').length === n, 1, { timeout: 3000 })
  await page.click('.chip:has-text("Loop cut")')
  assert.equal(await page.locator('.model-mface').count(), 10)
  await page.waitForFunction((n) => document.querySelectorAll('.scene3d__edge--own').length === n, 4, { timeout: 3000 })
  await page.keyboard.press('Control+z')
  assert.equal(await page.locator('.model-mface').count(), 6, 'one undo for the cut')

  // Vertex mode: B then a box over the whole view picks every vertex
  await page.keyboard.press('3')
  await page.keyboard.press('b')
  // a box round the whole mesh, from its drawn faces
  const boxes = await page.$$eval('.editor-view .model-mface', (els) => els.map((e) => e.getBoundingClientRect().toJSON()))
  const lo = [Math.min(...boxes.map((q) => q.left)) - 30, Math.min(...boxes.map((q) => q.top)) - 30]
  const hi = [Math.max(...boxes.map((q) => q.right)) + 30, Math.max(...boxes.map((q) => q.bottom)) + 30]
  await drag(page, lo, hi, 6)
  assert.equal(await page.locator('.scene3d__vertex--own').count(), 8)

  // Face mode: the UV panel shows the mesh's faces; dragging a picked one moves its UVs, one undo
  await page.keyboard.press('2')
  const polys = page.locator('.uv-mesh__face')
  assert.equal(await polys.count(), 6)
  await polys.first().scrollIntoViewIfNeeded()
  // a face whose middle isn't under the sheet's zoom buttons
  const key = await page.$$eval('.uv-mesh__face', (els) =>
    els
      .find((e) => {
        const r = e.getBoundingClientRect()
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e
      })
      ?.getAttribute('data-mface'),
  )
  const poly = page.locator(`.uv-mesh__face[data-mface="${key}"]`)
  const pts = () => page.getAttribute(`.uv-mesh__face[data-mface="${key}"]`, 'points')
  const before = await pts()
  const pb = await poly.boundingBox()
  const sheet = await page.locator('.uv--mesh').boundingBox()
  await drag(page, [pb.x + pb.width / 2, pb.y + pb.height / 2], [pb.x + pb.width / 2 + sheet.width / 8, pb.y + pb.height / 2], 5)
  assert.equal(await page.locator('.uv-mesh__face--picked').count(), 1)
  assert.equal(await page.locator('.model-mface--picked').count(), 1, 'the sheet and the viewport share the pick')
  assert.notEqual(await pts(), before)
  await page.keyboard.press('Control+z')
  assert.equal(await pts(), before)

  await page.click('.chip:has-text("Subdivide")')
  assert.equal(await page.locator('.model-mface').count(), 9)
  assert.deepEqual(errors, [])
  await page.close()
})
