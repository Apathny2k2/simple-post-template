/* The sound console: the Ogg Vorbis encoder held to the browser's own
   decoder, the synth and every preset, the pack's files, and the page. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inApp, open, startApp } from './harness.mjs'

startApp()

test('the Vorbis encoder: the fast MDCT, valid Ogg pages, and a decode that matches', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const V = await import('/src/lib/audio/vorbis.ts')
    const O = await import('/src/lib/audio/ogg.ts')
    const x = Float64Array.from({ length: 2048 }, (_, i) => Math.sin(i * 0.37) * 0.6 + Math.sin(i * 0.013))
    const a = V.mdct(x)
    const b = V.mdctDirect(x)
    let mdctErr = 0
    for (let i = 0; i < a.length; i++) mdctErr = Math.max(mdctErr, Math.abs(a[i] - b[i]))

    const rate = 44100
    const n = 30000
    const sig = Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / rate) + 0.15 * Math.sin((2 * Math.PI * 2900 * i) / rate))
    const quality = {}
    let bytes
    for (const q of [0.2, 0.6, 1]) {
      bytes = V.encodeVorbis(sig, { sampleRate: rate, quality: q })
      const buf = await new OfflineAudioContext(1, 1, rate).decodeAudioData(bytes.buffer.slice(0))
      const y = buf.getChannelData(0)
      let se = 0
      let ss = 0
      for (let i = 0; i < n; i++) {
        se += (y[i] - sig[i]) ** 2
        ss += sig[i] ** 2
      }
      quality[q] = { snr: 10 * Math.log10(ss / se), size: bytes.length, len: buf.length, rate: buf.sampleRate, channels: buf.numberOfChannels }
    }

    // walk the pages: magic, CRC and the last granule
    const pages = []
    let at = 0
    while (at < bytes.length) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset + at)
      const magic = String.fromCharCode(...bytes.subarray(at, at + 4))
      const segs = bytes[at + 26]
      let body = 0
      for (let i = 0; i < segs; i++) body += bytes[at + 27 + i]
      const len = 27 + segs + body
      const page = bytes.slice(at, at + len)
      const crc = dv.getUint32(22, true)
      new DataView(page.buffer).setUint32(22, 0, true)
      pages.push({ magic, flags: bytes[at + 5], granule: dv.getUint32(6, true), crcOk: O.oggCrc(page) === crc })
      at += len
    }
    const id = String.fromCharCode(...bytes.subarray(28, 35))
    return { mdctErr, quality, pages, id, silent: [5000, rate * 10].map((n) => V.encodeVorbis(new Float32Array(n), { sampleRate: rate }).length) }
  })
  assert.ok(r.mdctErr < 1e-9, `the fast MDCT matches the sum (${r.mdctErr})`)
  assert.equal(r.id, '\u0001vorbis')
  assert.ok(r.pages.every((p) => p.magic === 'OggS' && p.crcOk), 'every page is OggS with a good CRC')
  assert.equal(r.pages[0].flags & 2, 2, 'the first page begins the stream')
  assert.equal(r.pages.at(-1).flags & 4, 4, 'the last page ends it')
  assert.equal(r.pages.at(-1).granule, 30000, 'the last granule is the sample count')
  for (const [q, v] of Object.entries(r.quality)) {
    assert.equal(v.channels, 1)
    assert.equal(v.rate, 44100)
    assert.ok(v.len >= 30000, `quality ${q} decodes every sample`)
  }
  assert.ok(r.quality[0.6].snr > 22, `quality 0.6 keeps the signal (${r.quality[0.6].snr.toFixed(1)} dB)`)
  assert.ok(r.quality[1].snr > r.quality[0.2].snr + 8, 'more quality, less error')
  assert.ok(r.quality[1].size > r.quality[0.2].size, 'more quality, more bytes')
  assert.ok(r.silent[1] - r.silent[0] < 1200, `ten seconds of silence costs next to nothing (${r.silent.join(' vs ')} bytes)`)
  assert.deepEqual(errors, [])
  await page.close()
})

test('every preset renders, encodes and decodes; variants differ; the seed repeats', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const S = await import('/src/lib/audio/synth.ts')
    const P = await import('/src/lib/audio/presets.ts')
    const B = await import('/src/lib/audio/board.ts')
    const out = []
    for (const p of P.presets) {
      const s = P.fromPreset(p)
      const d = S.render(s)
      let peak = 0
      let finite = true
      for (const v of d) {
        if (!Number.isFinite(v)) finite = false
        peak = Math.max(peak, Math.abs(v))
      }
      const ogg = B.oggOf(d, s, 0.5)
      const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(ogg.buffer.slice(0))
      out.push({ name: p.name, finite, peak, secs: d.length / 44100, decoded: buf.length >= d.length })
    }
    const s = P.fromPreset(P.presets.find((p) => p.name === 'Eat'))
    const same = S.render(s).every((v, i, a) => v === S.render(s)[i])
    const vs = B.renderVariants({ ...s, variants: 3 }, {})
    const differ = vs[0].length !== vs[2].length || vs[0].some((v, i) => v !== vs[2][i])
    const muted = S.render({ ...s, layers: s.layers.map((l) => ({ ...l, muted: true })) }).length
    const solo = S.render({ ...s, layers: s.layers.map((l, i) => ({ ...l, solo: i === 1 })) })
    return { out, same, differ, groups: [...new Set(P.presets.map((p) => p.group))], muted, soloLen: solo.length, shifts: S.variantShifts(3, 2) }
  })
  assert.ok(r.out.length >= 30, `a full library (${r.out.length})`)
  for (const p of r.out) {
    assert.ok(p.finite, `${p.name} has no NaN`)
    assert.ok(p.peak > 0.5 && p.peak <= 1, `${p.name} is normalized (${p.peak})`)
    assert.ok(p.secs > 0.02 && p.secs < 12, `${p.name} has a sensible length (${p.secs})`)
    assert.ok(p.decoded, `${p.name} decodes in full`)
  }
  assert.deepEqual(r.groups, ['Player', 'Blocks', 'Notes', 'World', 'Mobs'])
  assert.ok(r.same, 'the same seed renders the same samples')
  assert.ok(r.differ, 'variants are not copies of each other')
  assert.ok(r.muted < 2000, 'all layers muted is (nearly) nothing')
  assert.ok(r.soloLen > 100, 'solo plays the soloed layer')
  assert.deepEqual(r.shifts, [-2, 0, 2])
  assert.deepEqual(errors, [])
  await page.close()
})

test('the resource pack: sounds.json, subtitles, variant files and the name checks', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const B = await import('/src/lib/audio/board.ts')
    const P = await import('/src/lib/audio/presets.ts')
    const pick = (n) => P.fromPreset(P.presets.find((p) => p.name === n))
    const board = {
      ...B.starterBoard(),
      namespace: 'mymobs',
      sounds: [{ ...pick('Groan'), variants: 3 }, { ...pick('Anvil land'), event: 'block.heavy.land' }],
    }
    const files = B.buildSoundPack(board, {})
    const dec = new TextDecoder()
    const json = (p) => JSON.parse(dec.decode(files.find((f) => f.path === p).bytes))
    const dup = { ...board, sounds: [board.sounds[0], { ...board.sounds[1], event: 'mobs.groan' }] }
    const bad = { ...board, namespace: 'My Mobs', sounds: [{ ...board.sounds[0], event: 'Bad Name!' }] }
    const zip = B.zipOf(files)
    return {
      paths: files.map((f) => f.path),
      sounds: json('assets/mymobs/sounds.json'),
      lang: json('assets/mymobs/lang/en_us.json'),
      mcmeta: json('pack.mcmeta'),
      oggs: files.filter((f) => f.path.endsWith('.ogg')).map((f) => String.fromCharCode(...f.bytes.subarray(0, 4))),
      dup: [...B.problems(dup).values()],
      bad: [...B.problems(bad).entries()],
      zipHead: [...zip.subarray(0, 4)],
      slug: B.slug('Orb Chime #2!'),
    }
  })
  assert.deepEqual(r.paths, [
    'pack.mcmeta',
    'assets/mymobs/sounds.json',
    'assets/mymobs/lang/en_us.json',
    'assets/mymobs/sounds/mobs/groan1.ogg',
    'assets/mymobs/sounds/mobs/groan2.ogg',
    'assets/mymobs/sounds/mobs/groan3.ogg',
    'assets/mymobs/sounds/block/heavy/land.ogg',
  ])
  assert.deepEqual(r.sounds, {
    'mobs.groan': { subtitle: 'subtitles.mymobs.mobs.groan', sounds: ['mymobs:mobs/groan1', 'mymobs:mobs/groan2', 'mymobs:mobs/groan3'] },
    'block.heavy.land': { subtitle: 'subtitles.mymobs.block.heavy.land', sounds: ['mymobs:block/heavy/land'] },
  })
  assert.deepEqual(r.lang, { 'subtitles.mymobs.mobs.groan': 'Groan', 'subtitles.mymobs.block.heavy.land': 'Anvil land' })
  assert.equal(r.mcmeta.pack.pack_format, 84)
  assert.ok(r.oggs.every((m) => m === 'OggS'))
  assert.ok(r.dup.some((m) => /already exports as mobs.groan/.test(m)), 'two sounds on one event are caught')
  assert.equal(r.bad.length, 2, 'a bad namespace and a bad event are both caught')
  assert.deepEqual(r.zipHead, [0x50, 0x4b, 0x03, 0x04])
  assert.equal(r.slug, 'orb_chime_2')
  assert.deepEqual(errors, [])
  await page.close()
})

/** A mono 16-bit WAV of a short decaying tone. */
function wav(secs = 0.3, rate = 22050) {
  const n = Math.round(secs * rate)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i * 0.12) * Math.exp(-i / 3000) * 20000), 44 + i * 2)
  return buf
}

test('the console: pads and keys, knobs with undo, layers, the display, import and export', async () => {
  const { page, errors } = await open('#/sounds')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.pad')
  assert.equal(await page.locator('.pad').count(), 8, 'the starter board')

  // a key plays its pad and opens it
  await page.keyboard.press('2')
  await page.waitForFunction(() => document.querySelector('.deck__name')?.value === 'Pickup pop')
  assert.equal(await page.locator('.pad[aria-pressed="true"] .pad__name').textContent(), 'Pickup pop')

  // a knob turns with the keyboard and the turn undoes
  const pitch = page.getByRole('slider', { name: 'Pitch', exact: true })
  const before = Number(await pitch.getAttribute('aria-valuenow'))
  await pitch.focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp')
  const after = Number(await pitch.getAttribute('aria-valuenow'))
  assert.ok(after > before, `pitch went up (${before} → ${after})`)
  await page.locator('.deck__bar').click({ position: { x: 2, y: 2 } })
  await page.keyboard.press('Control+z')
  await page.waitForFunction((v) => Number(document.querySelector('[role="slider"][aria-label="Pitch"]').getAttribute('aria-valuenow')) === v, before)

  // a layer from the add strip, then mute it
  const strips = await page.locator('.mixer__strips .strip').count()
  await page.getByRole('button', { name: 'Add a layer' }).click()
  await page.getByRole('menuitem', { name: 'Hiss' }).click()
  assert.equal(await page.locator('.mixer__strips .strip').count(), strips + 1)
  assert.equal(await page.locator('.insp__name').inputValue(), `Hiss ${strips + 1}`)
  await page.getByRole('button', { name: `Mute Hiss ${strips + 1}` }).click()
  assert.equal(await page.locator('.scope__lane[data-off]').count(), 1)

  // the spectrum draws
  await page.getByRole('radio', { name: 'Spectrum' }).click()
  const lit = await page.$eval('.scope__screen canvas', (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 120) n++
    return n
  })
  assert.ok(lit > 50, `the spectrogram shows energy (${lit} px)`)

  // export one file and check it is Ogg Vorbis the browser can play
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .ogg' }).click()])
  assert.equal(dl.suggestedFilename(), 'pickup_pop.ogg')
  const bytes = [...(await import('node:fs')).readFileSync(await dl.path())]
  const decoded = await page.evaluate(async (b) => {
    const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(new Uint8Array(b).buffer)
    return buf.duration
  }, bytes)
  assert.ok(decoded > 0.05, `the exported file decodes (${decoded} s)`)

  // variants export as a zip
  await page.getByRole('button', { name: 'More variants' }).click()
  await page.getByRole('button', { name: 'More variants' }).click()
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download 3 \.ogg files/ }).click()])
  assert.equal(zip.suggestedFilename(), 'player.pickup_pop.zip')

  // import audio: a new sound with a sample layer
  await page.locator('input[type="file"]').setInputFiles({ name: 'blip.wav', mimeType: 'audio/wav', buffer: wav() })
  await page.waitForFunction(() => document.querySelector('.deck__name')?.value === 'blip')
  assert.equal(await page.locator('.pad').count(), 9)
  assert.equal(await page.locator('.strip__wave').first().textContent(), 'Sample')

  // the board survives a reload
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForSelector('.pad')
  assert.equal(await page.locator('.pad').count(), 9)
  assert.deepEqual(errors, [])
  await page.close()
})

test('the console fits a phone: no sideways scroll', async () => {
  const { page, errors } = await open('#/sounds', { width: 390, height: 844 })
  await page.waitForSelector('.pad')
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(over <= 0, `no horizontal scroll (${over}px over)`)
  assert.deepEqual(errors, [])
  await page.close()
})
