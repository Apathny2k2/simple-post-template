/* Molang in keyframes: the evaluator, keys that play it, and Molang kept
   through Blockbench, Bedrock and the .vellum file. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, mode, open, openEditor, startApp } from './harness.mjs'

startApp()

test('the evaluator: operators, math in degrees, queries, variables, statements', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/molang.ts')
    const q = { query: { anim_time: 0.25, life_time: 3 } }
    const e = (src) => Math.round(M.evalMolang(src, q, NaN) * 1e6) / 1e6
    return {
      sum: e('1 + 2 * 3 - 4 / 2'),
      unary: e('-(2 + 3) * -2'),
      sin: e('math.sin(q.anim_time * 360)'),
      cos: e('Math.Cos(90)'),
      clamp: e('math.clamp(15, 0, 10)'),
      lerp: e('math.lerp(0, 10, 0.25)'),
      cmp: e('q.life_time > 2 && q.life_time <= 3'),
      ternary: e('q.anim_time < 0.5 ? 10 : 20'),
      halfTernary: e('q.anim_time > 0.5 ? 10'),
      unknownQuery: e('query.is_sneaking'),
      preview: e('q.ground_speed'),
      coalesce: e('v.missing ?? 7'),
      statements: e('v.a = 2; v.b = v.a * 3; return v.a + v.b;'),
      noReturn: e('v.a = 2; v.b = 3;'),
      divZero: e('1 / 0'),
      random: [e('math.random(0, 1)'), e('math.random(0, 1)')],
      pi: e('math.pi'),
      bad: M.molangError('math.nope(1)'),
      broken: M.molangError('1 +'),
      fine: M.molangError('math.sin(q.anim_time * 360) * 30'),
      negated: [M.negated('a + b'), M.negated(M.negated('a + b')), M.negated('-(a) + (b)')],
    }
  })
  assert.equal(r.sum, 5)
  assert.equal(r.unary, 10)
  assert.equal(r.sin, 1, 'a quarter of the way through a 360 turn')
  assert.equal(r.cos, 0, 'names are not case sensitive, trig is in degrees')
  assert.equal(r.clamp, 10)
  assert.equal(r.lerp, 2.5)
  assert.equal(r.cmp, 1)
  assert.equal(r.ternary, 10)
  assert.equal(r.halfTernary, 0, '`c ? a` with no else gives 0')
  assert.equal(r.unknownQuery, 0)
  assert.equal(r.preview, 4)
  assert.equal(r.coalesce, 0, 'an unset variable reads 0, as in game')
  assert.equal(r.statements, 8)
  assert.equal(r.noReturn, 0)
  assert.equal(r.divZero, 0)
  assert.equal(r.random[0], r.random[1], 'random is the same each time a frame plays')
  assert.equal(r.pi, 3.141593)
  assert.match(r.bad, /math\.nope/)
  assert.ok(r.broken)
  assert.equal(r.fine, null)
  assert.deepEqual(r.negated, ['-(a + b)', 'a + b', '-(-(a) + (b))'])
  await page.close()
})

test('Molang keys play, and survive .vellum, Blockbench and Bedrock', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const M = await import('/src/lib/model.ts')
    const V = await import('/src/lib/vellum.ts')
    const BB = await import('/src/lib/bbmodel.ts')
    const BR = await import('/src/lib/bedrock.ts')
    const S = await import('/src/lib/samples.ts')
    const base = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const bone = base.bones[0].id
    const track = { bone, channel: 'rotation', keys: [{ id: 'k1', time: 0, value: [0, 0, 0], interp: 'linear', expr: ['math.sin(q.anim_time * 360) * 30', null, 'q.anim_time * 10'] }] }
    const clip = { id: 'c-wave', name: 'wave', loop: 'loop', length: 1, snapping: 20, tracks: [track] }
    const m = { ...base, clips: [clip] }
    const at = (t) => M.sampleTrack(track, t).map((v) => Math.round(v * 1000) / 1000)
    const vellum = V.readVellum(V.writeVellum(m))
    const bb = BB.fromBbmodel(BB.toBbmodel(m)).model
    const bbText = BB.toBbmodel(m)
    const anim = BR.toBedrockAnimations(m).json
    const br = BR.applyBedrockAnimations({ ...base, clips: [] }, JSON.stringify(anim)).model
    const exprOf = (model) => model.clips[0].tracks[0].keys[0].expr
    return {
      at: [at(0), at(0.25), at(0.5)],
      vellum: exprOf(vellum),
      sameFile: V.writeVellum(bb) === V.writeVellum(m),
      bbPoint: JSON.parse(bbText).animations[0].animators[bone].keyframes[0].data_points[0],
      bedrockKey: anim.animations[Object.keys(anim.animations)[0]].bones[base.bones[0].name].rotation,
      bedrock: exprOf(br),
    }
  })
  assert.deepEqual(r.at, [[0, 0, 0], [30, 0, 2.5], [0, 0, 5]], 'X swings with the sine, Z climbs with the playhead')
  assert.deepEqual(r.vellum, ['math.sin(q.anim_time * 360) * 30', null, 'q.anim_time * 10'])
  assert.ok(r.sameFile, 'out to a .bbmodel and back, the same model')
  assert.equal(r.bbPoint.x, '-(math.sin(q.anim_time * 360) * 30)', 'Blockbench gets the expression with Bedrock’s sign on X')
  assert.equal(r.bbPoint.z, 'q.anim_time * 10')
  assert.deepEqual(r.bedrock, ['math.sin(q.anim_time * 360) * 30', null, 'q.anim_time * 10'], 'and Bedrock, signed the same way, back to the same')
  await page.close()
})

test('in the editor: a key takes Molang, and says when it can’t read it', async () => {
  const { page, errors } = await openEditor('voidling')
  await mode(page, 'Animate')
  await page.locator('.dope__key, .tl-key, [data-key]').first().click()
  await page.click('.kf__molang-open')
  const x = page.locator('input[aria-label$="X Molang"]')
  await x.fill('math.nope(2)')
  await x.press('Enter')
  assert.match(await page.textContent('.kf__molang'), /Can't read it/)
  await x.fill('math.sin(q.anim_time * 360) * 30')
  await x.press('Enter')
  assert.doesNotMatch(await page.textContent('.kf__molang'), /Can't read it/)
  assert.deepEqual(errors, [])
  await page.close()
})
