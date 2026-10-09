/* Ground pile sets: the vanilla sets, the checks, every stage as a valid
   Java model, the plugin's config, the pack's files, the .vellum and the
   .bbmodel, and the panel in the editor. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, openEditor, startApp } from './harness.mjs'

startApp()

test('a pile set: vanilla sets, checks, and every stage a valid Java model', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const P = await import('/src/lib/pile.ts')
    const N = await import('/src/lib/new-model.ts')
    const m = N.createModel('items', 'gems', 'pile')
    const set = m.pile
    const big = { ...m, cubes: m.cubes.map((c) => ({ ...c, from: [0, 0, 0], to: [12, 4, 12] })) }
    const turned = { ...m, cubes: m.cubes.map((c) => ({ ...c, rotation: [0, 22.5, 0] })) }
    const twice = { ...set, materials: [...set.materials, { ...set.materials[0], name: 'other' }] }
    const badId = { ...set, materials: [{ ...set.materials[0], match: ['Diamond!'] }] }
    const stages = [1, 4, 8].map((n) => P.stageJson(m, n, 'minecraft:item/diamond'))
    const inside = stages.every((s) => s.elements.every((e) => [...e.from, ...e.to].every((v) => v >= 0 && v <= 16)))
    const turns = new Set(stages.flatMap((s) => s.elements.map((e) => (e.rotation ? `${e.rotation.axis}${e.rotation.angle}` : 'none'))))
    const yaml = P.pileYaml('gems', set, 'vellum')
    return {
      shapes: Object.keys(P.PILE_PRESETS),
      gems: set.materials.map((x) => x.match[0]),
      ingots: P.pileSetOf('ingots').materials.map((x) => x.texture.path),
      clean: P.checkPile(m, set),
      big: P.checkPile(big, set).map((i) => i.message),
      turned: P.checkPile(turned, set).length,
      twice: P.checkPile(m, twice).some((i) => /taken by both/.test(i.message)),
      badId: P.checkPile(m, badId).some((i) => /not an item id/.test(i.message)),
      elements: stages.map((s) => s.elements.length),
      inside,
      turns: [...turns].sort(),
      texture: stages[0].textures['0'],
      yamlStages: (yaml.match(/vellum:pile\/gems\/diamond_\d/g) ?? []).length,
      yamlHead: yaml.split('\n').slice(1, 5),
    }
  })
  assert.deepEqual(r.shapes, ['gems', 'ingots', 'raw', 'dusts'])
  assert.deepEqual(r.gems, ['minecraft:diamond', 'minecraft:emerald', 'minecraft:amethyst_shard', 'minecraft:quartz', 'minecraft:lapis_lazuli'])
  assert.deepEqual(r.ingots, ['minecraft:item/iron_ingot', 'minecraft:item/gold_ingot', 'minecraft:item/copper_ingot', 'minecraft:item/netherite_ingot'])
  assert.deepEqual(r.clean, [], 'a new pile set has nothing wrong with it')
  assert.ok(r.big.some((m) => /12 pixels across/.test(m)) && r.big.some((m) => /4 pixels tall/.test(m)), 'a piece too wide and too tall is refused')
  assert.ok(r.turned > 0, 'a turned piece is refused')
  assert.ok(r.twice, 'an item claimed by two materials is refused')
  assert.ok(r.badId, 'a malformed item id is refused')
  assert.deepEqual(r.elements, [1, 4, 8], 'one element per piece')
  assert.ok(r.inside, 'every stage stays inside the block')
  assert.ok(r.turns.every((t) => t === 'none' || /^y(-?(22\.5|45))$/.test(t)), `only Y turns Java allows: ${r.turns}`)
  assert.equal(r.texture, 'minecraft:item/diamond')
  assert.equal(r.yamlStages, 8, 'the config names a stage per count')
  assert.deepEqual(r.yamlHead, ['piles:', '  gems:', '    max: 8', '    when-full: new-pile'])
  await page.close()
})

test('a pile set goes into the pack and the configs, and is kept by the .vellum and the .bbmodel', async () => {
  const { page } = await open()
  const r = await inApp(page, async () => {
    const N = await import('/src/lib/new-model.ts')
    const K = await import('/src/lib/pack.ts')
    const V = await import('/src/lib/vellum.ts')
    const B = await import('/src/lib/bbmodel.ts')
    const m0 = N.createModel('items', 'gems', 'pile')
    // one custom material, wearing the model's own texture, and a lower limit
    const m = { ...m0, pile: { ...m0.pile, sound: { place: 'minecraft:block.amethyst_block.place' }, materials: [...m0.pile.materials, { name: 'star_gem', match: ['vellum:star_gem'], texture: { kind: 'custom', texture: m0.textures[0].id }, max: 3 }] } }
    const pack = K.buildPack([{ id: 'gems', model: m, kind: 'items' }], { namespace: 'vellum', packFormat: 46, description: 'test' })
    const configs = K.buildConfigs([{ id: 'gems', model: m, kind: 'items' }], 'vellum')
    const paths = pack.files.map((f) => f.path)
    const def = JSON.parse(new TextDecoder().decode(pack.files.find((f) => f.path === 'assets/vellum/items/pile/gems/star_gem_2.json').bytes))
    const star = JSON.parse(new TextDecoder().decode(pack.files.find((f) => f.path === 'assets/vellum/models/item/pile/gems/star_gem_3.json').bytes))
    const yml = configs.files.find((f) => f.path === 'piles/gems.yml')
    return {
      diamondStages: paths.filter((p) => p.startsWith('assets/vellum/models/item/pile/gems/diamond_')).length,
      starStages: paths.filter((p) => p.startsWith('assets/vellum/models/item/pile/gems/star_gem_')).length,
      def,
      starTexture: star.textures['0'],
      starTextureFile: paths.some((p) => p === `assets/vellum/textures/item/${star.textures['0'].split('/').pop()}.png`),
      yml: yml ? new TextDecoder().decode(yml.bytes) : null,
      pile: m.pile,
      vellum: V.readVellum(V.writeVellum(m)).pile,
      bbmodel: B.fromBbmodel(B.toBbmodel(m), 'gems.bbmodel').model.pile,
      version: V.CURRENT_VERSION,
    }
  })
  assert.equal(r.diamondStages, 8)
  assert.equal(r.starStages, 3, "a material's own limit")
  assert.deepEqual(r.def, { model: { type: 'minecraft:model', model: 'vellum:item/pile/gems/star_gem_2' } })
  assert.match(r.starTexture, /^vellum:item\//, 'a custom texture is the pack’s own')
  assert.ok(r.starTextureFile, 'and is in the pack')
  assert.ok(r.yml && /star_gem:\n        match: \["vellum:star_gem"\]\n        max: 3/.test(r.yml), 'the config lists the custom material with its limit')
  assert.ok(r.yml && /place: "minecraft:block.amethyst_block.place"/.test(r.yml))
  assert.deepEqual(r.vellum, r.pile, 'kept by the .vellum')
  assert.deepEqual(r.bbmodel, r.pile, 'kept by the .bbmodel')
  assert.ok(r.version >= 16)
  await page.close()
})

test('in the editor: a pile set shows its panel and preview, takes a material, and Validation names a bad id', async () => {
  const { page, errors } = await openEditor('runic_blade')
  const text = await page.evaluate(async () => {
    const N = await import('/src/lib/new-model.ts')
    const V = await import('/src/lib/vellum.ts')
    return V.writeVellum(N.createModel('items', 'gems', 'pile'))
  })
  await page.setInputFiles('input[type=file][accept*="bbmodel"]', { name: 'gems.vellum', mimeType: 'application/json', buffer: Buffer.from(text) })
  await page.waitForSelector('.pile__view canvas')
  assert.equal(await page.locator('.pile__material').count(), 5)
  await page.selectOption('select[aria-label="Fill from a vanilla set"]', 'ingots')
  await page.waitForFunction(() => document.querySelectorAll('.pile__material').length === 4)
  await page.click('.pile button:has-text("Material")')
  await page.waitForFunction(() => document.querySelectorAll('.pile__material').length === 5)
  const ids = page.locator('input[aria-label="Items for material_5"]')
  await ids.fill('Not An Id')
  await ids.blur()
  const head = page.locator('.panel', { has: page.locator('.panel__title', { hasText: 'Validation' }) }).locator('[aria-expanded]').first()
  if ((await head.getAttribute('aria-expanded')) === 'false') await head.click()
  await page.waitForFunction(() => /is not an item id/.test(document.querySelector('.editor-issues')?.textContent ?? ''))
  await page.fill('input[aria-label="Most in a pile"]', '4')
  await page.waitForFunction(() => document.querySelector('input[aria-label="Pieces in the pile"]')?.max === '4')
  assert.deepEqual(errors, [])
  await page.close()
})
