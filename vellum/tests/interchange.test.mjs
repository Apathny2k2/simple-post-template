/* Models in and out: Blockbench projects and Java JSON coming in, glTF,
   OBJ and Java JSON going out. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

/** A small Blockbench project with a bit of everything the importer reads. */
const bbmodel = (png) =>
  JSON.stringify({
    meta: { format_version: '4.10', model_format: 'bedrock', box_uv: false },
    name: 'critter',
    resolution: { width: 32, height: 32 },
    elements: [
      { name: 'body', type: 'cube', uuid: 'c-body', from: [-4, 0, -4], to: [4, 6, 4], origin: [0, 0, 0], rotation: [0, 10, 0], faces: { north: { uv: [0, 0, 8, 6], texture: 0 }, south: { uv: [8, 0, 16, 6], texture: 0, rotation: 90 }, east: { uv: [0, 6, 8, 12], texture: 0 }, west: { uv: [8, 6, 16, 12], texture: 0 }, up: { uv: [0, 12, 8, 20], texture: 0 }, down: { uv: [8, 12, 16, 20], texture: null } } },
      { name: 'tail', type: 'cube', uuid: 'c-tail', from: [-1, 2, 4], to: [1, 4, 9], origin: [0, 3, 4], faces: { north: { uv: [16, 0, 18, 2], texture: 0 } } },
      { name: 'loose', type: 'cube', uuid: 'c-loose', from: [6, 0, 6], to: [7, 1, 7], faces: {} },
      { name: 'target', type: 'null_object', uuid: 'n-1', position: [0, 3, 12], ik_target: 'g-tail' },
      { name: 'tri', type: 'mesh', uuid: 'm-1', vertices: {}, faces: {} },
    ],
    outliner: [
      { name: 'body', uuid: 'g-body', origin: [0, 0, 0], children: ['c-body', { name: 'tail', uuid: 'g-tail', origin: [0, 3, 4], rotation: [5, 0, 0], children: ['c-tail', 'n-1'] }] },
      'c-loose',
    ],
    textures: [{ name: 'critter', uuid: 't-1', width: 32, height: 32, uv_width: 32, uv_height: 32, source: png }],
    animations: [
      {
        uuid: 'a-1', name: 'animation.critter.wag', loop: 'loop', length: 1, snapping: 20,
        animators: {
          'g-tail': { name: 'tail', type: 'bone', keyframes: [
            { channel: 'rotation', time: 0, interpolation: 'linear', data_points: [{ x: '0', y: '-20', z: 0 }] },
            { channel: 'rotation', time: 0.5, interpolation: 'bezier', data_points: [{ x: 0, y: 20, z: 0 }], bezier_left_time: [-0.1, -0.1, -0.1], bezier_left_value: [0, 0, 0], bezier_right_time: [0.1, 0.1, 0.1], bezier_right_value: [0, 4, 0] },
            { channel: 'position', time: 0.25, interpolation: 'catmullrom', data_points: [{ x: 'math.sin(q.anim_time)', y: 1, z: 0 }] },
          ] },
          effects: { name: 'Effects', type: 'effect', keyframes: [{ channel: 'sound', time: 0.5, data_points: [{ effect: 'mob.wolf.bark', locator: 'n-1' }] }] },
        },
      },
    ],
  })

const tinyPng = (page) =>
  page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const x = c.getContext('2d')
    x.fillStyle = '#c08040'
    x.fillRect(0, 0, 32, 32)
    return c.toDataURL('image/png')
  })

test('a Blockbench project comes in with its rig, textures, clips, effects and nulls', async () => {
  const { page } = await open()
  const text = bbmodel(await tinyPng(page))
  const r = await inApp(
    page,
    async (t) => {
      const I = await import('/src/lib/importers.ts')
      const V = await import('/src/lib/vellum.ts')
      const { model, kind, notes } = I.fromBbmodel(t, 'critter.bbmodel')
      const tail = model.clips[0].tracks.find((x) => x.bone === 'g-tail' && x.channel === 'rotation')
      const pos = model.clips[0].tracks.find((x) => x.channel === 'position')
      const written = V.writeVellum(model)
      return {
        isBb: I.isBbmodel(t),
        kind,
        bones: model.bones.map((b) => [b.name, b.children.map((c) => (c.kind === 'bone' ? c.bone.name : model.cubes.find((x) => x.id === c.id)?.name))]),
        cubes: model.cubes.map((c) => c.name),
        rotation: model.cubes[0].rotation,
        southTurn: model.cubes[0].faces.south.rotation,
        downTex: model.cubes[0].faces.down.texture,
        northTex: model.cubes[0].faces.north.texture,
        texId: model.textures[0].id,
        keys: tail.keys.map((k) => [k.time, k.value[1], k.interp, !!k.handles]),
        posX: pos.keys[0].value[0],
        events: model.clips[0].events,
        nulls: model.nulls.map((n) => [n.name, n.parent, n.ikTarget]),
        notes,
        stable: written === V.writeVellum(V.readVellum(written)),
        issues: (await import('/src/lib/model.ts')).validateModel(model, kind).filter((i) => i.level === 'error').map((i) => i.message),
      }
    },
    text,
  )
  assert.ok(r.isBb)
  assert.equal(r.kind, 'mobs')
  assert.deepEqual(r.bones[0], ['root', ['loose']], 'a cube outside every group goes under a root bone')
  assert.deepEqual(r.bones[1], ['body', ['body', 'tail']])
  assert.deepEqual(r.cubes, ['body', 'tail', 'loose'], 'the mesh is left out')
  assert.deepEqual(r.rotation, [0, 10, 0])
  assert.equal(r.southTurn, 90)
  assert.equal(r.downTex, null)
  assert.equal(r.northTex, r.texId)
  assert.deepEqual(r.keys, [[0, -20, 'linear', false], [0.5, 20, 'bezier', true]])
  assert.equal(r.posX, 0, 'a Molang value reads as the rest value')
  assert.deepEqual(r.events.map((e) => [e.kind, e.effect, e.locator]), [['sound', 'mob.wolf.bark', 'n-1']])
  assert.deepEqual(r.nulls, [['target', 'g-tail', 'g-tail']])
  assert.ok(r.notes.some((n) => /mesh/.test(n)), 'the note says the mesh was left out')
  assert.ok(r.notes.some((n) => /Molang/.test(n)), 'and that Molang was not run')
  assert.ok(r.stable, 'the imported model saves and reopens byte for byte')
  assert.deepEqual(r.issues, [])
  await page.close()
})

test('Java JSON comes in, and a model goes out to Java JSON and back', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const I = await import('/src/lib/importers.ts')
    const E = await import('/src/lib/exporters.ts')
    const S = await import('/src/lib/samples.ts')
    const java = JSON.stringify({
      parent: 'block/block',
      textures: { side: 'block/stone', all: '#side', particle: 'block/stone' },
      elements: [
        { from: [0, 0, 0], to: [16, 8, 16], faces: { up: { uv: [0, 0, 16, 16], texture: '#all' }, north: { texture: '#side' } } },
        { from: [4, 8, 4], to: [12, 12, 12], rotation: { origin: [8, 8, 8], axis: 'y', angle: 22.5 }, faces: { up: { texture: '#side', rotation: 180 } } },
      ],
    })
    const a = I.fromJavaModel(java, 'slab.json')
    let refused = null
    try {
      I.fromJavaModel(JSON.stringify({ parent: 'item/generated', textures: { layer0: 'item/stick' } }), 'stick.json')
    } catch (e) {
      refused = e.message
    }
    const sword = S.samples.find((s) => s.model.kind === 'items' || s.id === 'runic_blade').model
    const out = E.toJavaJson(sword, 'item')
    const back = I.fromJavaModel(out.text, out.name)
    return {
      isJava: I.isJavaModel(java),
      kind: a.kind,
      cubes: a.model.cubes.length,
      rot: a.model.cubes[1].rotation,
      textures: a.model.textures.map((t) => t.name),
      sameTex: a.model.cubes[0].faces.up.texture === a.model.cubes[0].faces.north.texture,
      northUv: a.model.cubes[0].faces.north.uv,
      turn: a.model.cubes[1].faces.up.rotation,
      notes: a.notes,
      refused,
      outCubes: sword.cubes.length,
      backCubes: back.model.cubes.length,
      sameBoxes: sword.cubes.every((c, i) => c.from.every((v, k) => Math.abs(v - back.model.cubes[i].from[k]) < 1e-6)),
    }
  })
  assert.ok(r.isJava)
  assert.equal(r.kind, 'blocks')
  assert.equal(r.cubes, 2)
  assert.deepEqual(r.rot, [0, 22.5, 0])
  assert.deepEqual(r.textures, ['stone.png'], 'a variable pointing at another shares its texture')
  assert.ok(r.sameTex)
  assert.deepEqual(r.northUv, [0, 8, 16, 16], 'a face with no UV takes its outline')
  assert.equal(r.turn, 180)
  assert.ok(r.notes.some((n) => /blank/.test(n)))
  assert.match(r.refused ?? '', /inherits them from "item\/generated"/)
  assert.equal(r.backCubes, r.outCubes)
  assert.ok(r.sameBoxes, 'every element comes back where it was')
  await page.close()
})

test('glTF carries the rig and clips, and every triangle faces outward', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const E = await import('/src/lib/exporters.ts')
    const S = await import('/src/lib/samples.ts')
    const model = S.samples.find((s) => s.id === 'voidling').model
    const g = JSON.parse(E.toGltf(model))
    const bin = Uint8Array.from(atob(g.buffers[0].uri.split(',')[1]), (c) => c.charCodeAt(0))
    const read = (i, Kind) => {
      const a = g.accessors[i]
      const v = g.bufferViews[a.bufferView]
      const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count
      return new Kind(bin.buffer.slice(v.byteOffset, v.byteOffset + n * 4))
    }
    let tris = 0
    let inward = 0
    for (const mesh of g.meshes) {
      for (const p of mesh.primitives) {
        const pos = read(p.attributes.POSITION, Float32Array)
        const nor = read(p.attributes.NORMAL, Float32Array)
        const idx = read(p.indices, Uint32Array)
        for (let t = 0; t < idx.length; t += 3) {
          const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]
          const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
          const [A, B, C] = [P(a), P(b), P(c)]
          const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
          const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
          const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
          const d = n[0] * nor[a * 3] + n[1] * nor[a * 3 + 1] + n[2] * nor[a * 3 + 2]
          tris++
          if (d <= 0) inward++
        }
      }
    }
    const faces = model.cubes.reduce((s, c) => s + Object.values(c.faces).filter((f) => f.uv[0] !== f.uv[2] && f.uv[1] !== f.uv[3]).length, 0)
    const boneCount = (bs) => bs.reduce((s, b) => s + 1 + boneCount(b.children.filter((c) => c.kind === 'bone').map((c) => c.bone)), 0)
    return {
      version: g.asset.version,
      nodes: g.nodes.length,
      bones: boneCount(model.bones),
      clips: model.clips.length,
      animations: g.animations?.length ?? 0,
      tris,
      inward,
      faces,
      nearest: g.samplers?.[0]?.magFilter,
      minmax: !!g.accessors[g.meshes[0].primitives[0].attributes.POSITION].min,
    }
  })
  assert.equal(r.version, '2.0')
  assert.equal(r.nodes, r.bones, 'a node per bone')
  assert.equal(r.animations, r.clips, 'an animation per clip')
  assert.equal(r.tris, r.faces * 2, 'two triangles per textured face')
  assert.equal(r.inward, 0, 'no triangle faces inward')
  assert.equal(r.nearest, 9728, 'pixel art stays sharp')
  assert.ok(r.minmax)
  await page.close()
})

test('OBJ comes out as a zip with the .obj, the .mtl and the textures', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const E = await import('/src/lib/exporters.ts')
    const S = await import('/src/lib/samples.ts')
    const model = S.samples.find((s) => s.id === 'voidling').model
    const zip = E.toObjZip(model)
    const text = new TextDecoder('latin1').decode(zip)
    return { pk: zip[0] === 0x50 && zip[1] === 0x4b, obj: /voidling\.obj/.test(text), mtl: /voidling\.mtl/.test(text), png: /voidling\.png/.test(text), objects: (text.match(/\no /g) || []).length, cubes: model.cubes.length }
  })
  assert.ok(r.pk, 'a zip')
  assert.ok(r.obj && r.mtl && r.png, 'with the .obj, .mtl and texture')
  assert.equal(r.objects, r.cubes, 'an object per cube')
  await page.close()
})

test('the editor opens a .bbmodel from File ▸ Open and says what came in', async () => {
  const { page, errors } = await openEditor()
  const text = bbmodel(await tinyPng(page))
  await page.setInputFiles('input[type=file][accept*="bbmodel"]', { name: 'critter.bbmodel', mimeType: 'application/json', buffer: Buffer.from(text) })
  await page.waitForFunction(() => document.querySelector('.sbar')?.textContent?.includes('critter'))
  assert.match(await page.textContent('.editor-status'), /from Blockbench/)
  const rows = await page.$$eval('.tree__row .tree__name', (els) => els.map((e) => e.textContent))
  assert.ok(rows.includes('tail') && rows.includes('loose'))
  assert.deepEqual(errors, [])
  await page.close()
})

test('a Java model opens with blank textures, and a PNG of the same name fills one in', async () => {
  const { page } = await openEditor()
  const java = JSON.stringify({ parent: 'item/handheld', textures: { 0: 'item/blade' }, elements: [{ from: [7, 0, 7], to: [9, 14, 9], faces: { north: { uv: [0, 0, 2, 14], texture: '#0' } } }] })
  await page.setInputFiles('input[type=file][accept*="bbmodel"]', { name: 'blade.json', mimeType: 'application/json', buffer: Buffer.from(java) })
  await page.waitForFunction(() => document.querySelector('.editor-status')?.textContent?.includes('Java model'))
  assert.equal(await page.locator('.texture-item').count(), 1)
  assert.match(await page.textContent('.texture-list'), /blade\.png/)
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    c.getContext('2d').fillRect(0, 0, 16, 16)
    return c.toDataURL('image/png').split(',')[1]
  })
  await page.setInputFiles('input[type=file][accept="image/png"]', { name: 'blade.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await page.waitForFunction(() => (document.querySelector('.texture-thumb')?.style.backgroundImage ?? '').includes('data:image/png'))
  assert.equal(await page.locator('.texture-item').count(), 1, 'the PNG filled the blank texture rather than adding one')
  await page.close()
})
