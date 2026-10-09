/* Bedrock animation controllers: states that play clips together and move
   on at Molang conditions, blending as they go; kept in the .vellum, the
   .bbmodel and Bedrock's own files; made and played in Animate. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, mode, open, openEditor, startApp } from './harness.mjs'

startApp()

test('a controller moves between states, adds clips together and cross-fades', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const C = await import('/src/lib/controllers.ts')
    const S = await import('/src/lib/samples.ts')
    const base = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const bone = base.bones[0].id
    const steady = (id, value) => ({ id, name: id, loop: 'loop', length: 1, snapping: 20, tracks: [{ bone, channel: 'rotation', keys: [{ id: id + 'k', time: 0, value, interp: 'linear' }] }] })
    const m = { ...base, clips: [steady('idle', [10, 0, 0]), steady('walk', [0, 20, 0]), steady('look', [0, 0, 30])] }
    const ctrl = {
      id: 'c',
      name: 'move',
      initial: 'a',
      states: [
        { id: 'a', name: 'default', clips: [{ clip: 'idle' }, { clip: 'look', weight: '0.5' }], transitions: [{ to: 'b', when: 'q.is_moving' }], onEntry: 'v.entered = v.entered + 1;' },
        { id: 'b', name: 'moving', clips: [{ clip: 'walk' }], transitions: [{ to: 'a', when: '!q.is_moving' }], blend: 0.5 },
      ],
    }
    const out = []
    let run = C.startController(ctrl, { is_moving: 0 })
    out.push(['start', run.state, run.variables.entered])
    run = C.stepController(ctrl, run, 0.1, { is_moving: 0 })
    out.push(['still', run.state, C.controllerPose(m, ctrl, run, 0.1, {})[bone].rotation])
    run = C.stepController(ctrl, run, 1, { is_moving: 1 })
    out.push(['moving', run.state, C.controllerPose(m, ctrl, run, 1, {})[bone].rotation.map((v) => Math.round(v))])
    out.push(['halfway', run.state, C.controllerPose(m, ctrl, run, 1.25, {})[bone].rotation.map((v) => Math.round(v * 10) / 10)])
    run = C.stepController(ctrl, run, 1.6, { is_moving: 1 })
    out.push(['settled', run.state, C.controllerPose(m, ctrl, run, 1.6, {})[bone].rotation, !!run.from])
    run = C.stepController(ctrl, run, 2, { is_moving: 0 })
    out.push(['back', run.state, run.variables.entered])
    return out
  })
  assert.deepEqual(r[0], ['start', 'a', 1], 'the first state’s entry script runs')
  assert.deepEqual(r[1], ['still', 'a', [10, 0, 15]], 'idle and half of look, added together')
  assert.deepEqual(r[2], ['moving', 'b', [10, 0, 15]], 'the moment it moves on, the old pose still shows')
  assert.deepEqual(r[3], ['halfway', 'b', [5, 10, 7.5]], 'half way through the blend, half of each')
  assert.deepEqual(r[4], ['settled', 'b', [0, 20, 0], false], 'after the blend, only the new state')
  assert.deepEqual(r[5], ['back', 'a', 2], 'and back, its entry script running again')
  await page.close()
})

test('controllers survive the .vellum, the .bbmodel and Bedrock’s files', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const V = await import('/src/lib/vellum.ts')
    const BB = await import('/src/lib/bbmodel.ts')
    const BR = await import('/src/lib/bedrock.ts')
    const S = await import('/src/lib/samples.ts')
    const base = structuredClone(S.samples.find((x) => x.id === 'voidling').model)
    const [c1, c2] = base.clips
    const ctrl = {
      id: 'c',
      name: 'move',
      initial: 'b',
      states: [
        { id: 'a', name: 'idle', clips: [{ clip: c1.id }], transitions: [{ to: 'b', when: 'q.is_moving' }], onEntry: 'v.x = 1;' },
        { id: 'b', name: 'walk', clips: [{ clip: c2.id, weight: 'q.ground_speed / 4' }], transitions: [{ to: 'a', when: '!q.is_moving' }], blend: 0.25 },
      ],
    }
    const m = { ...base, controllers: [ctrl] }
    const vellum = V.readVellum(V.writeVellum(m))
    const bb = BB.fromBbmodel(BB.toBbmodel(m)).model
    const json = BR.toBedrockControllers(m)
    const entity = BR.toBedrockEntity(m)
    const back = BR.applyBedrockControllers({ ...base }, JSON.stringify(json)).model.controllers[0]
    const shape = (c) => ({ initial: c.states.find((s) => s.id === c.initial).name, states: c.states.map((s) => [s.name, s.clips.map((x) => [base.clips.find((k) => k.id === x.clip).name, x.weight ?? '']), s.transitions.map((t) => [c.states.find((x) => x.id === t.to).name, t.when]), s.blend ?? 0, s.onEntry ?? '']) })
    return {
      vellum: V.writeVellum(vellum) === V.writeVellum(m),
      bb: V.writeVellum(bb) === V.writeVellum(m),
      json,
      isCtrl: BR.isBedrockControllers(JSON.stringify(json)),
      bedrock: shape(back),
      original: shape(ctrl),
      entity: entity['minecraft:client_entity'].description,
    }
  })
  assert.ok(r.vellum, 'the .vellum keeps them byte for byte')
  assert.ok(r.bb, 'and so does the .bbmodel, under its vellum key')
  assert.ok(r.isCtrl)
  const id = Object.keys(r.json.animation_controllers)[0]
  assert.match(id, /^controller\.animation\.voidling\.move$/)
  assert.equal(r.json.animation_controllers[id].initial_state, 'walk')
  assert.deepEqual(r.bedrock.states.map((s) => s.slice(0, 3)), r.original.states.map((s) => s.slice(0, 3)), 'Bedrock’s file gives back the same states, clips, weights and conditions')
  assert.equal(r.bedrock.initial, 'walk')
  assert.deepEqual(r.bedrock.states.map((s) => s[3]), [0, 0.25])
  assert.match(r.bedrock.states[0][4], /v\.x = 1;/)
  assert.deepEqual(r.entity.scripts.animate, ['move'], 'the entity file runs the controller')
  assert.equal(r.entity.animations.move, id)
  await page.close()
})

test('in Animate: make a controller, give it two states, play it and watch it move on', async () => {
  const { page, errors } = await openEditor('voidling')
  await mode(page, 'Animate')
  await page.click('.panel__head:has-text("Controllers")')
  await page.click('.ctrl .chip:has-text("Controller"), .panel .chip:has-text("Controller")')
  await page.waitForSelector('.ctrl__state')
  // the default state plays the first clip; a second state plays the second
  await page.locator('.ctrl__state').first().locator('.chip').first().click()
  await page.click('.ctrl > .chip:has-text("State")')
  const second = page.locator('.ctrl__state').nth(1)
  await second.locator('.chip').nth(1).click()
  await page.locator('.ctrl__state').first().locator('.chip:has-text("Transition")').click()
  const cond = page.locator('.ctrl__state').first().locator('input[aria-label="Condition"]')
  await cond.fill('q.is_moving')
  await cond.press('Enter')
  await page.click('.ctrl__head .chip:has-text("Play")')
  await page.waitForSelector('.ctrl__state--on')
  assert.equal(await page.locator('.ctrl__state').first().getAttribute('class'), 'ctrl__state ctrl__state--on', 'it starts in the first state')
  await page.click('.ctrl__check:has-text("Moving") input')
  await page.waitForFunction(() => document.querySelectorAll('.ctrl__state')[1]?.classList.contains('ctrl__state--on'), null, { timeout: 3000 })
  await page.click('.ctrl__head .chip:has-text("Stop")')
  assert.equal(await page.locator('.ctrl__state--on').count(), 0)
  assert.deepEqual(errors, [])
  await page.close()
})
