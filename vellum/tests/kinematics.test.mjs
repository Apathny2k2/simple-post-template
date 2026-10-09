/* The model-space maths the gizmos and IK stand on. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, startApp } from './harness.mjs'

startApp()

test('rotation matrices agree with the browser’s own CSS transforms', async () => {
  const { page } = await open()
  const out = await inApp(page, async () => {
    const K = await import('/src/lib/kinematics.ts')
    let worst = 0
    let worstEuler = 0
    // a fixed walk through the angles, so a failure repeats
    for (let i = 0; i < 300; i++) {
      const r = [((i * 73) % 360) - 180, ((i * 31) % 170) - 85, ((i * 137) % 360) - 180]
      const a = K.rotationMatrix(r).toFloat64Array()
      const c = K.rotationMatrixFromCss(r).toFloat64Array()
      worst = Math.max(worst, ...a.map((v, j) => Math.abs(v - c[j])))
      const back = K.rotationMatrix(K.eulerOf(K.rotationMatrix(r))).toFloat64Array()
      worstEuler = Math.max(worstEuler, ...a.map((v, j) => Math.abs(v - back[j])))
    }
    return { worst, worstEuler }
  })
  assert.ok(out.worst < 1e-9, `matrix differs from CSS by ${out.worst}`)
  assert.ok(out.worstEuler < 1e-4, `Euler round trip is off by ${out.worstEuler}`)
  await page.close()
})

test('a two-bone arm reaches an IK target', async () => {
  const { page } = await open()
  const end = await inApp(page, async () => {
    const K = await import('/src/lib/kinematics.ts')
    const bone = (id, origin, children = []) => ({ id, name: id, origin, rotation: [0, 0, 0], visible: true, locked: false, children })
    const hand = bone('hand', [0, -2, 0])
    const elbow = bone('elbow', [0, 4, 0], [{ kind: 'bone', bone: hand }])
    const shoulder = bone('shoulder', [0, 10, 0], [{ kind: 'bone', bone: elbow }])
    const model = {
      name: 'arm',
      resolution: { width: 16, height: 16 },
      bones: [shoulder],
      cubes: [],
      textures: [],
      clips: [],
      nulls: [{ id: 'n', name: 'goal', parent: null, position: [7, 6, 0], ikTarget: 'hand', ikChain: 2, visible: true, locked: false }],
    }
    const rig = K.buildRig(model, K.solveIK(model, {}))
    return K.apply(rig.bone.get('hand'), [0, 0, 0])
  })
  assert.ok(Math.hypot(end[0] - 7, end[1] - 6, end[2]) < 0.1, `hand ended at ${end}`)
  await page.close()
})
