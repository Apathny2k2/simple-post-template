/* Blockbench projects both ways. A model saved as a .bbmodel must open
   again exactly as its .vellum would, and a Blockbench project must keep
   what Vellum has no field for (display settings, cullfaces, colours,
   render modes) so that saving it back loses nothing. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

test('every sample saved as a .bbmodel opens again byte for byte', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const B = await import('/src/lib/bbmodel.ts')
    const V = await import('/src/lib/vellum.ts')
    const S = await import('/src/lib/samples.ts')
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return S.samples.map((s) => {
      const m = { ...s.model, kind: s.kind }
      const text = B.toBbmodel(m)
      const bb = JSON.parse(text)
      const back = B.fromBbmodel(text, `${s.id}.bbmodel`)
      const ids = new Set(bb.elements.map((e) => e.uuid))
      const refs = []
      const walk = (list) => list.forEach((x) => (typeof x === 'string' ? refs.push(x) : walk(x.children)))
      walk(bb.outliner)
      return {
        id: s.id,
        same: V.writeVellum(back.model) === V.writeVellum(m),
        notes: back.notes,
        version: bb.meta.format_version,
        uuids: bb.elements.every((e) => UUID.test(e.uuid)) && bb.textures.every((t) => UUID.test(t.uuid)),
        placed: refs.length === ids.size && refs.every((x) => ids.has(x)),
        extras: back.model.blockbench === undefined,
      }
    })
  })
  for (const s of r) {
    assert.ok(s.same, `${s.id}: the .bbmodel reopens as the same model`)
    assert.deepEqual(s.notes, [], `${s.id}: nothing to report`)
    assert.equal(s.version, '4.10')
    assert.ok(s.uuids, `${s.id}: every element and texture has a uuid`)
    assert.ok(s.placed, `${s.id}: every element sits once in the outliner`)
    assert.ok(s.extras, `${s.id}: a model from Vellum carries no Blockbench extras`)
  }
  await page.close()
})

/** A Blockbench project with things Vellum has no field for. */
const project = (groupsApart) => {
  const body = { name: 'body', uuid: 'aaaaaaaa-0000-4000-a000-000000000001', origin: [0, 0, 0], color: 3, children: ['bbbbbbbb-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000002'] }
  const arm = { name: 'arm', uuid: 'aaaaaaaa-0000-4000-a000-000000000002', origin: [0, 6, 0], children: ['bbbbbbbb-0000-4000-a000-000000000003', 'cccccccc-0000-4000-a000-000000000001'] }
  const outliner = groupsApart
    ? [{ uuid: body.uuid, isOpen: true, children: [...body.children, { uuid: arm.uuid, isOpen: false, children: arm.children }] }]
    : [{ ...body, children: [...body.children, arm] }]
  return JSON.stringify({
    meta: { format_version: groupsApart ? '5.0' : '4.10', model_format: 'bedrock', box_uv: false },
    name: 'golem',
    model_identifier: 'golem',
    display: { thirdperson_righthand: { rotation: [10, 20, 30] } },
    resolution: { width: 16, height: 16 },
    elements: [
      { name: 'torso', type: 'cube', uuid: 'bbbbbbbb-0000-4000-a000-000000000001', color: 5, from: [-2, 0, -2], to: [2, 6, 2], origin: [0, 0, 0], faces: { north: { uv: [0, 0, 4, 6], texture: 0, cullface: 'north', tint: 1 }, south: { uv: [4, 0, 8, 6], texture: 0 } } },
      { name: 'head', type: 'cube', uuid: 'bbbbbbbb-0000-4000-a000-000000000002', from: [-1, 6, -1], to: [1, 8, 1], origin: [0, 6, 0], faces: {} },
      { name: 'hand', type: 'cube', uuid: 'bbbbbbbb-0000-4000-a000-000000000003', from: [2, 4, -1], to: [4, 6, 1], origin: [2, 6, 0], faces: {} },
      { name: 'reach', type: 'null_object', uuid: 'cccccccc-0000-4000-a000-000000000001', position: [6, 2, 0], ik_target: 'aaaaaaaa-0000-4000-a000-000000000002', ik_source: 'aaaaaaaa-0000-4000-a000-000000000001' },
      { name: 'decor', type: 'texture_mesh', uuid: 'dddddddd-0000-4000-a000-000000000001', texture_name: 'x' },
    ],
    outliner,
    ...(groupsApart ? { groups: [{ ...body, children: undefined }, { ...arm, children: undefined }] } : {}),
    textures: [{ name: 'golem.png', uuid: 'eeeeeeee-0000-4000-a000-000000000001', id: '1', width: 16, height: 16, uv_width: 16, uv_height: 16, render_mode: 'emissive', source: 'data:image/png;base64,iVBORw0KGgo=' }],
    animations: [
      {
        uuid: 'ffffffff-0000-4000-a000-000000000001', name: 'wave', loop: 'loop', length: 1, snapping: 20, blend_weight: '0.5',
        animators: { 'aaaaaaaa-0000-4000-a000-000000000002': { name: 'arm', type: 'bone', keyframes: [
          { channel: 'rotation', time: 0, interpolation: 'linear', data_points: [{ x: 0, y: 0, z: 30 }], easing: 'linear', easingArgs: [] },
          { channel: 'scale', time: 0.5, interpolation: 'bezier', data_points: [{ x: 1, y: 1, z: 1 }], uniform: true, bezier_linked: true, bezier_left_time: [-0.1, -0.1, -0.1], bezier_left_value: [0, 0, 0], bezier_right_time: [0.1, 0.1, 0.1], bezier_right_value: [0, 0, 0] },
        ] } },
      },
    ],
  })
}

test('a Blockbench project keeps what Vellum has no field for, through .vellum and back', async () => {
  const { page } = await open()
  const r = await inApp(
    page,
    async ([four, five]) => {
      const B = await import('/src/lib/bbmodel.ts')
      const V = await import('/src/lib/vellum.ts')
      const read = (t) => B.fromBbmodel(t, 'golem.bbmodel')
      const a = read(four)
      // through a .vellum file and out again
      const out = JSON.parse(B.toBbmodel(V.readVellum(V.writeVellum(a.model))))
      const again = read(JSON.stringify(out))
      const b = read(five)
      const torso = out.elements.find((e) => e.name === 'torso')
      return {
        bones: a.model.bones.map((x) => [x.name, x.children.map((c) => (c.kind === 'bone' ? c.bone.name : 'cube'))]),
        fiveBones: b.model.bones.map((x) => [x.name, x.origin, x.children.map((c) => (c.kind === 'bone' ? c.bone.name + '@' + c.bone.origin.join() : 'cube'))]),
        sameModel: V.writeVellum(a.model) === V.writeVellum(b.model.blockbench ? { ...b.model, blockbench: a.model.blockbench } : b.model),
        ikChain: a.model.nulls[0].ikChain,
        ikSource: out.elements.find((e) => e.name === 'reach').ik_source,
        display: out.display,
        identifier: out.model_identifier,
        cullface: torso.faces.north.cullface,
        tint: torso.faces.north.tint,
        color: torso.color,
        groupColor: out.outliner[0].color,
        renderMode: out.textures[0].render_mode,
        blend: out.animations[0].blend_weight,
        keyExtras: Object.values(out.animations[0].animators).flatMap((x) => x.keyframes).map((k) => [k.channel, k.easing, k.easingArgs, k.uniform, k.bezier_linked]),
        texId: out.textures[0].id,
        format: out.meta.model_format,
        decor: out.elements.some((e) => e.type === 'texture_mesh') && out.outliner.includes('dddddddd-0000-4000-a000-000000000001'),
        notes: a.notes,
        stable: V.writeVellum(again.model) === V.writeVellum(a.model),
      }
    },
    [project(false), project(true)],
  )
  assert.deepEqual(r.bones, [['body', ['cube', 'cube', 'arm']]])
  assert.deepEqual(r.fiveBones, [['body', [0, 0, 0], ['cube', 'cube', 'arm@0,6,0']]], 'Blockbench 5 lists groups apart; they come in the same')
  assert.equal(r.ikChain, 1, 'the IK source one bone up is a chain of one')
  assert.equal(r.ikSource, 'aaaaaaaa-0000-4000-a000-000000000001')
  assert.deepEqual(r.display, { thirdperson_righthand: { rotation: [10, 20, 30] } })
  assert.equal(r.identifier, 'golem')
  assert.equal(r.cullface, 'north')
  assert.equal(r.tint, 1)
  assert.equal(r.color, 5)
  assert.equal(r.groupColor, 3)
  assert.equal(r.renderMode, 'emissive')
  assert.equal(r.blend, '0.5')
  assert.deepEqual(r.keyExtras, [['rotation', 'linear', [], undefined, undefined], ['scale', undefined, undefined, true, true]], "a key's easing, uniform scale and linked handles are kept")
  assert.equal(r.texId, '1', 'a texture keeps the id Blockbench gave it')
  assert.equal(r.format, 'bedrock')
  assert.ok(r.decor, 'a texture mesh Vellum cannot show is kept and written back')
  assert.ok(r.notes.some((n) => /texture_mesh/.test(n)), 'and the import says so')
  assert.ok(r.stable, 'out and in again, the model is the same')
  await page.close()
})

test('a model whose ids are not uuids, with ping-pong and odd track order, comes back the same', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const B = await import('/src/lib/bbmodel.ts')
    const V = await import('/src/lib/vellum.ts')
    const S = await import('/src/lib/samples.ts')
    const base = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    // rename every id to a short one, everywhere it appears
    let text = V.writeVellum(base)
    const ids = [...new Set(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g))]
    ids.forEach((id, i) => (text = text.split(id).join(`id${i}`)))
    const m = V.readVellum(text)
    const clip = m.clips.find((c) => c.tracks.length > 1)
    clip.loop = 'pingpong'
    clip.tracks.reverse()
    const out = B.toBbmodel(m)
    return { same: V.writeVellum(B.fromBbmodel(out).model) === V.writeVellum(m), uuids: !/"uuid": "id\d/.test(out) }
  })
  assert.ok(r.uuids, 'every id goes out as a uuid')
  assert.ok(r.same)
  await page.close()
})

test('Save offers .vellum or .bbmodel; the .bbmodel opens again and saves back as one', async () => {
  const { page, errors } = await openEditor('runic_blade')
  assert.match(await page.textContent('.sbar__save'), /\.vellum/)
  await page.click('button[aria-label="Choose the format to save in"]')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[role="menuitem"]:has-text(".bbmodel")')])
  assert.equal(download.suggestedFilename(), 'runic_blade.bbmodel')
  const fs = await import('node:fs/promises')
  const text = await fs.readFile(await download.path(), 'utf8')
  const bb = JSON.parse(text)
  assert.equal(bb.meta.format_version, '4.10')
  assert.equal(bb.vellum.kind, 'items')
  assert.match(await page.textContent('.sbar__save'), /\.bbmodel/, 'the choice sticks for Save and Ctrl S')

  // open it again: same cubes, and Save stays .bbmodel
  const cubes = await page.locator('.model-cube').count()
  await page.setInputFiles('input[type=file][accept*="bbmodel"]', { name: 'runic_blade.bbmodel', mimeType: 'application/json', buffer: Buffer.from(text) })
  await page.waitForTimeout(300)
  assert.equal(await page.locator('.model-cube').count(), cubes)
  assert.match(await page.textContent('.sbar__save'), /\.bbmodel/)
  const [again] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')])
  assert.equal(again.suggestedFilename(), 'runic_blade.bbmodel')
  assert.deepEqual(errors, [])
  await page.close()
})
