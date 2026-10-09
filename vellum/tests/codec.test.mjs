/* The .vellum codec: every sample round-trips byte for byte, version 8's
   additions survive, older files open, newer ones are refused. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, startApp } from './harness.mjs'

startApp()

test('every sample writes, reads back and writes the same bytes', async () => {
  const { page } = await open()
  const rows = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const S = await import('/src/lib/samples.ts')
    return S.samples.map((s) => {
      const a = V.writeVellum(s.model)
      return { id: s.id, stable: a === V.writeVellum(V.readVellum(a)), header: a.startsWith(V.HEADER_PREFIX) }
    })
  })
  assert.ok(rows.length >= 7, `expected the seven samples, got ${rows.length}`)
  for (const r of rows) {
    assert.ok(r.stable, `${r.id} changes on a round trip`)
    assert.ok(r.header, `${r.id} does not start with the header`)
  }
  await page.close()
})

test('version 8: null objects, clip events and ping-pong survive', async () => {
  const { page } = await open()
  const out = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const S = await import('/src/lib/samples.ts')
    const m = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const bone = m.bones[0].id
    m.nulls = [{ id: 'n1', name: 'hand_target', parent: bone, position: [4, 8, 0], ikTarget: bone, ikChain: 2, visible: true, locked: false }]
    m.clips[0].loop = 'pingpong'
    m.clips[0].events = [
      { id: 'x', time: 0.5, kind: 'sound', effect: 'minecraft:entity.zombie.ambient', locator: 'n1' },
      { id: 'y', time: 0.1, kind: 'particle', effect: 'minecraft:flame' },
    ]
    m.clips[0].tracks.push({ bone: 'n1', channel: 'position', keys: [{ id: 'q', time: 0, value: [0, 1, 0], interp: 'linear' }] })
    const t1 = V.writeVellum(m)
    const back = V.readVellum(t1)
    return {
      stable: t1 === V.writeVellum(back),
      version: JSON.parse(t1).vellum.version,
      nulls: back.nulls?.map((n) => [n.name, n.ikTarget, n.ikChain]),
      events: back.clips[0].events?.map((e) => `${e.kind}@${e.time}`),
      loop: back.clips[0].loop,
      text: t1,
    }
  })
  assert.ok(out.stable)
  assert.equal(out.version, 8)
  assert.equal(out.nulls.length, 1)
  assert.equal(out.nulls[0][2], 2)
  assert.deepEqual(out.events.sort(), ['particle@0.1', 'sound@0.5'])
  assert.equal(out.loop, 'pingpong')

  const older = await inApp(
    page,
    async (text) => {
      const V = await import('/src/lib/vellum.ts')
      const v7 = V.readVellum(text.replace('"version":8', '"version":7'))
      const bad = JSON.parse(text)
      bad.clips[0].loop = 'sideways'
      bad.clips[0].events.push({ kind: 'laser', effect: 'x', time: 1 })
      const rb = V.readVellum(bad)
      let refused = null
      try {
        V.readVellum(text.replace('"version":8', '"version":9'))
      } catch (e) {
        refused = e.message
      }
      return { v7nulls: v7.nulls?.length, loop: rb.clips[0].loop, events: rb.clips[0].events.length, refused }
    },
    out.text,
  )
  assert.equal(older.v7nulls, 1, 'a version 7 file should still open')
  assert.equal(older.loop, 'loop', 'an unknown loop mode reads as loop')
  assert.equal(older.events, 2, 'an unknown event kind is dropped')
  assert.match(older.refused ?? '', /newer Vellum/)
  await page.close()
})

test('box UV, mirroring and a texture per face survive a round trip', async () => {
  const { page } = await open()
  const out = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const U = await import('/src/lib/uv-edit.ts')
    const S = await import('/src/lib/samples.ts')
    let m = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const c = U.followBoxUv({ ...U.setBoxUv(m.cubes[0], true), mirrorUv: true })
    m = { ...m, cubes: [c, ...m.cubes.slice(1)], textures: [...m.textures, { ...m.textures[0], id: 'extra', name: 'extra.png' }] }
    m = U.assignTexture(m, [c.id], 'extra', ['up'])
    const text = V.writeVellum(m)
    const back = V.readVellum(text)
    const bc = back.cubes[0]
    return { stable: text === V.writeVellum(back), box: bc.boxUv, mirror: bc.mirrorUv, up: bc.faces.up.texture, north: bc.faces.north.texture, textures: back.textures.length, offset: bc.uvOffset }
  })
  assert.ok(out.stable)
  assert.equal(out.box, true)
  assert.equal(out.mirror, true)
  assert.equal(out.up, 'extra')
  assert.notEqual(out.north, 'extra')
  assert.equal(out.textures, 2)
  assert.ok(Array.isArray(out.offset))
  await page.close()
})
