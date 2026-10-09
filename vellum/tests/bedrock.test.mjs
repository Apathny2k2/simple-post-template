/* Bedrock Edition both ways: geometry and animations out of every sample
   and back in, and a hand-written Bedrock file with the forms its keys can
   take. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

test('every sample goes out to Bedrock and comes back the same shape and motion', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const B = await import('/src/lib/bedrock.ts')
    const M = await import('/src/lib/model.ts')
    const S = await import('/src/lib/samples.ts')
    const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3)
    const bonesOf = (m) => {
      const out = []
      const walk = (list) => list.forEach((b) => (out.push(b), walk(b.children.filter((c) => c.kind === 'bone').map((c) => c.bone))))
      walk(m.bones)
      return out
    }
    return S.samples.map((s) => {
      const m = s.model
      const geo = B.toBedrockGeometry(m).json
      const anim = B.toBedrockAnimations(m).json
      const back = B.fromBedrockGeometry(JSON.stringify(geo), `${s.id}.geo.json`).model
      const withClips = B.applyBedrockAnimations(back, JSON.stringify(anim)).model
      const b0 = bonesOf(m)
      const b1 = bonesOf(back)
      const sameBones = b0.length === b1.length && b0.every((b, i) => b.name === b1[i].name && close(b.origin, b1[i].origin) && close(b.rotation, b1[i].rotation))
      // Bedrock lists cubes bone by bone, so compare them in that order
      const inBones = b0.flatMap((b) => b.children.filter((c) => c.kind === 'cube').map((c) => m.cubes.find((x) => x.id === c.id)).filter(Boolean))
      const sameCubes =
        inBones.length === back.cubes.length &&
        inBones.every((c, i) => {
          const d = back.cubes[i]
          const faces = M.FACES.every((k) => !c.faces[k].texture || c.faces[k].uv.every((v, j) => Math.abs(v - d.faces[k].uv[j]) < 1e-3))
          return close(c.from, d.from) && close(c.to, d.to) && (c.rotation.every((v) => v === 0) || (close(c.origin, d.origin) && close(c.rotation, d.rotation))) && faces
        })
      // each clip plays the same: sampled at its keys and between them
      const byName = new Map(bonesOf(withClips).map((b) => [b.name, b.id]))
      let motion = true
      for (const clip of m.clips) {
        const other = withClips.clips.find((c) => c.name.endsWith(B.bedrockName(clip.name)) || c.name === clip.name)
        if (!other) {
          motion = false
          continue
        }
        for (const t of clip.tracks) {
          const bone = b0.find((b) => b.id === t.bone)
          if (!bone) continue
          const u = other.tracks.find((x) => x.bone === byName.get(bone.name) && x.channel === t.channel)
          if (!u) {
            motion = false
            continue
          }
          for (let k = 0; k <= 10; k++) {
            const at = (clip.length * k) / 10
            if (!close(M.sampleTrack(t, at).map((v) => Math.round(v * 10) / 10), M.sampleTrack(u, at).map((v) => Math.round(v * 10) / 10))) {
              if (clip.loop !== 'pingpong') motion = false
            }
          }
        }
      }
      return { id: s.id, sameBones, sameCubes, motion, clips: m.clips.length, back: withClips.clips.length }
    })
  })
  for (const s of r) {
    assert.ok(s.sameBones, `${s.id}: bones keep their pivots and turns`)
    assert.ok(s.sameCubes, `${s.id}: cubes keep their boxes, pivots, turns and UVs`)
    assert.ok(s.motion, `${s.id}: the clips play the same`)
    assert.equal(s.back, s.clips, `${s.id}: every clip comes back`)
  }
  await page.close()
})

test('a hand-written Bedrock file: pre and post, catmull-rom, Molang, one value for a channel, locators', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const B = await import('/src/lib/bedrock.ts')
    const geo = {
      format_version: '1.12.0',
      'minecraft:geometry': [
        {
          description: { identifier: 'geometry.bug', texture_width: 32, texture_height: 32 },
          bones: [
            { name: 'body', pivot: [0, 4, 0], cubes: [{ origin: [-3, 0, -2], size: [6, 4, 4], uv: [0, 0] }] },
            { name: 'wing', parent: 'body', pivot: [-3, 4, 0], rotation: [0, 0, 10], cubes: [{ origin: [-8, 4, -1], size: [5, 1, 2], uv: { north: { uv: [0, 8], uv_size: [5, 1] }, up: { uv: [5, 12], uv_size: [-5, -2] } } }], locators: { tip: [-8, 5, 0] } },
          ],
        },
      ],
    }
    const anim = {
      format_version: '1.8.0',
      animations: {
        'animation.bug.flap': {
          loop: true,
          animation_length: 1,
          bones: {
            wing: { rotation: { '0.0': [0, 0, 0], '0.5': { post: [0, 0, 30], lerp_mode: 'catmullrom' }, '1.0': { pre: [0, 0, 30], post: [0, 0, 0] } } },
            body: { position: [0, 'math.sin(q.anim_time * 360)', 0], scale: 1.5 },
            ghost: { rotation: [1, 2, 3] },
          },
          sound_effects: { '0.5': { effect: 'mob.bat.takeoff' } },
          particle_effects: { '0.25': { effect: 'minecraft:dust', locator: 'tip' } },
        },
      },
    }
    const g = B.fromBedrockGeometry(JSON.stringify(geo), 'bug.geo.json')
    const a = B.applyBedrockAnimations(g.model, JSON.stringify(anim))
    const wing = g.model.bones[0].children.find((c) => c.kind === 'bone').bone
    const wingCube = g.model.cubes[1]
    const clip = a.model.clips[0]
    const rot = clip.tracks.find((t) => t.channel === 'rotation')
    return {
      isGeo: B.isBedrockGeometry(JSON.stringify(geo)),
      isAnim: B.isBedrockAnimation(JSON.stringify(anim)),
      wing: [wing.name, wing.origin, wing.rotation],
      body: [g.model.cubes[0].from, g.model.cubes[0].to, g.model.cubes[0].boxUv, g.model.cubes[0].uvOffset],
      wingCube: [wingCube.from, wingCube.to, wingCube.faces.north.uv, wingCube.faces.up.uv],
      locator: g.model.nulls.map((n) => [n.name, n.position, n.parent === wing.id]),
      keys: rot.keys.map((k) => [k.time, k.value[2], k.interp]),
      body: [clip.tracks.find((t) => t.channel === 'position').keys[0].value, clip.tracks.find((t) => t.channel === 'scale').keys[0].value],
      events: clip.events.map((e) => [e.kind, e.time, e.effect, !!e.locator]),
      loop: clip.loop,
      notes: a.notes,
    }
  })
  assert.ok(r.isGeo && r.isAnim)
  assert.deepEqual(r.wing, ['wing', [3, 4, 0], [0, 0, 10]], 'X runs the other way: pivots flip, turns about X and Y flip')
  assert.deepEqual(r.wingCube[0], [3, 4, -1])
  assert.deepEqual(r.wingCube[1], [8, 5, 1])
  assert.deepEqual(r.wingCube[2], [0, 8, 5, 9])
  assert.deepEqual(r.wingCube[3], [0, 10, 5, 12], 'an up face crosses over end for end')
  assert.deepEqual(r.locator, [['tip', [8, 5, 0], true]])
  assert.deepEqual(r.keys, [[0, 0, 'linear'], [0.5, 30, 'step'], [1, 0, 'linear']], 'a later pre equal to the key before holds that key')
  assert.deepEqual(r.body, [[0, 0, 0], [1.5, 1.5, 1.5]], 'Molang reads as the rest value; one value stands for all three')
  assert.deepEqual(r.events, [['particle', 0.25, 'minecraft:dust', true], ['sound', 0.5, 'mob.bat.takeoff', false]])
  assert.equal(r.loop, 'loop')
  assert.ok(r.notes.some((n) => /ghost/.test(n)), 'an unknown bone is reported')
  assert.ok(r.notes.some((n) => /Molang/.test(n)))
  await page.close()
})

test('meshes go out as poly meshes and keyed nulls as bones, and both come back', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const B = await import('/src/lib/bedrock.ts')
    const M = await import('/src/lib/model.ts')
    const Me = await import('/src/lib/mesh.ts')
    const K = await import('/src/lib/kinematics.ts')
    const S = await import('/src/lib/samples.ts')
    const base = S.samples.find((s) => s.model.kind === 'mobs' && s.model.clips.length).model
    const bone = base.bones[0]
    const cyl = { ...Me.makeMesh('cylinder', { parent: bone.id, origin: [2, 3, -1], size: 6, sides: 8, texture: null, place: () => [0, 0] }), rotation: [0, 30, 15] }
    const pyr = Me.makeMesh('pyramid', { parent: null, origin: [-4, 0, 4], size: 4, texture: null, place: () => [0, 0] })
    const keyed = { id: 'n1', name: 'hand_target', parent: bone.id, position: [1, 2, 3], visible: true, locked: false }
    const still = { id: 'n2', name: 'tip', parent: bone.id, position: [0, 9, 0], visible: true, locked: false }
    const clip = { ...base.clips[0], tracks: [...base.clips[0].tracks, { bone: 'n1', channel: 'position', keys: [{ id: 'k1', time: 0, value: [0, 0, 0], interp: 'linear' }, { id: 'k2', time: base.clips[0].length, value: [3, -1, 2], interp: 'linear' }] }] }
    const m = { ...base, meshes: [cyl, pyr], nulls: [keyed, still], clips: [clip, ...base.clips.slice(1)] }
    const geo = B.toBedrockGeometry(m)
    const anim = B.toBedrockAnimations(m)
    const bones = geo.json['minecraft:geometry'][0].bones
    const polys = bones.flatMap((b) => (b.poly_mesh ? b.poly_mesh.polys : []))
    const back = B.applyBedrockAnimations(B.fromBedrockGeometry(JSON.stringify(geo.json)).model, JSON.stringify(anim.json)).model
    const world = (mesh) => Object.values(mesh.vertices).map((v) => {
      const p = K.rotationMatrix(mesh.rotation).transformPoint(new DOMPoint(...v))
      return [mesh.origin[0] + p.x, mesh.origin[1] + p.y, mesh.origin[2] + p.z].map((x) => Math.round(x * 100) / 100).join(',')
    }).sort()
    // every face faces away from the middle of its (convex) mesh
    const outward = (mesh) => {
      const vs = Object.values(mesh.vertices)
      const mid = [0, 1, 2].map((i) => vs.reduce((a, v) => a + v[i], 0) / vs.length)
      return Object.values(mesh.faces).every((f) => {
        const n = Me.faceNormal(mesh, f)
        const c = Me.faceCentre(mesh, f)
        return n[0] * (c[0] - mid[0]) + n[1] * (c[1] - mid[1]) + n[2] * (c[2] - mid[2]) > 0
      })
    }
    const sorted = (ms) => ms.map(world).map((w) => w.join(' ')).sort()
    const nb = back.nulls.find((n) => n.name === 'hand_target')
    const parentName = (mm, id) => {
      let name = null
      const walk = (list) => list.forEach((b) => (b.id === id && (name = b.name), walk(b.children.filter((c) => c.kind === 'bone').map((c) => c.bone))))
      walk(mm.bones)
      return name
    }
    const track = back.clips[0].tracks.find((t) => t.bone === nb?.id && t.channel === 'position')
    const L = clip.length
    return {
      notes: [...geo.notes, ...anim.notes],
      allQuads: polys.length > 0 && polys.every((p) => p.length === 4),
      rootBone: bones.some((b) => b.name === 'meshes' && b.poly_mesh),
      meshes: back.meshes?.length,
      sameShape: JSON.stringify(sorted(back.meshes ?? [])) === JSON.stringify(sorted([cyl, pyr])),
      outward: (back.meshes ?? []).every(outward) && [cyl, pyr].every(outward),
      faces: (back.meshes ?? []).reduce((a, x) => a + Object.keys(x.faces).length, 0),
      before: [cyl, pyr].reduce((a, x) => a + Object.values(x.faces).reduce((b, f) => b + (f.vertices.length > 4 ? f.vertices.length - 2 : 1), 0), 0),
      ngons: Object.values(cyl.faces).some((f) => f.vertices.length > 4),
      nullBack: !!nb && parentName(back, nb.parent) === bone.name && nb.position.every((v, i) => Math.abs(v - keyed.position[i]) < 1e-3),
      stillBack: back.nulls.some((n) => n.name === 'tip' && parentName(back, n.parent) === bone.name),
      bonesKept: !back.bones.some((b) => b.name === 'hand_target'),
      motion: !!track && [0, L / 3, L].every((t) => M.sampleTrack(track, t).every((v, i) => Math.abs(v - M.sampleTrack(clip.tracks.at(-1), t)[i]) < 1e-3)),
    }
  })
  assert.deepEqual(r.notes.filter((n) => /mesh|null/i.test(n)), [], 'nothing about meshes or nulls is left out')
  assert.ok(r.allQuads, 'every poly is a quad')
  assert.ok(r.rootBone, 'a mesh at the root gets a bone of its own')
  assert.equal(r.meshes, 2, 'both meshes come back')
  assert.ok(r.sameShape, 'their corners are where they were, turn and all')
  assert.ok(r.outward, 'their faces still face out')
  assert.ok(r.ngons, 'the cylinder has eight-sided caps to cut')
  assert.equal(r.faces, r.before, 'a face of five or more corners comes back as triangles, and the rest as they were')
  assert.ok(r.nullBack, 'the keyed null comes back as a null on its bone')
  assert.ok(r.stillBack, 'the unkeyed null is still a locator')
  assert.ok(r.bonesKept, 'no extra bone is left behind')
  assert.ok(r.motion, 'the null moves the same')
  await page.close()
})

test('File ▸ Export writes a Bedrock zip; File ▸ Open adds Bedrock animations to the model', async () => {
  const { page, errors } = await openEditor('voidling')
  await page.click('.sbar button:has-text("File")')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[role=menuitem]:has-text("Bedrock geometry")')])
  assert.match(download.suggestedFilename(), /bedrock\.zip$/)
  const clips = await page.locator('.clip-list li, .clip-list__item').count()
  const anim = JSON.stringify({ format_version: '1.8.0', animations: { 'animation.voidling.nod': { animation_length: 1, bones: { head: { rotation: { '0': [0, 0, 0], '0.5': [20, 0, 0] } } } } } })
  await page.setInputFiles('input[type=file][accept*="bbmodel"]', { name: 'voidling.animation.json', mimeType: 'application/json', buffer: Buffer.from(anim) })
  await page.waitForTimeout(300)
  assert.match(await page.textContent('body'), /Added 1 animation/)
  assert.deepEqual(errors, [])
  await page.close()
})
