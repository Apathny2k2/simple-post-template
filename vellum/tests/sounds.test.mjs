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
      out.push({ name: p.name, finite, peak, gain: s.master.gain, secs: d.length / 44100, decoded: buf.length >= d.length })
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
    // an accent's master gain sets it under the game sound it goes on
    assert.ok(p.peak > 0.5 * p.gain && p.peak <= 1, `${p.name} is normalized (${p.peak} at gain ${p.gain})`)
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

test('the pluck holds its pitch, the vowel filter shapes vowels, the crackle clicks at its rate', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const S = await import('/src/lib/audio/synth.ts')
    const M = await import('/src/lib/audio/measure.ts')
    const one = (l) => S.render({ id: 's', name: 't', group: 'Player', seed: 5, layers: [S.layer(l)], master: S.master({ variation: 0 }) })
    const plucks = [92.5, 185, 370, 740, 1480].map((f) => M.measure(one({ wave: 'pluck', pitch: f, pitchEnd: f, length: 0.8, decay: 0.7, sustain: 0, bright: 0.7 }), S.RATE).pitchStart)
    // a voice at 120 Hz through each vowel: how strong its 19th harmonic (2280 Hz, near i's second
    // formant) is against its 7th (840 Hz, near u's)
    const level = (d, f) => {
      let re = 0
      let im = 0
      for (let n = 0; n < d.length; n++) {
        re += d[n] * Math.cos((2 * Math.PI * f * n) / S.RATE)
        im += d[n] * Math.sin((2 * Math.PI * f * n) / S.RATE)
      }
      return Math.hypot(re, im)
    }
    const vowel = (v) => {
      const d = one({ wave: 'saw', pitch: 120, pitchEnd: 120, length: 0.6, sustain: 1, filter: 'vowel', vowel: v, vowelEnd: v, resonance: 2 })
      return { pitch: M.measure(d, S.RATE).pitchStart, front: level(d, 2280) / level(d, 840) }
    }
    const clicks = (rate) => {
      const d = one({ wave: 'crackle', pitch: rate, pitchEnd: rate, length: 4, attack: 0.001, sustain: 1, release: 0.001 })
      // a click is a burst after at least 2 ms of quiet
      let n = 0
      let quiet = 1e9
      for (const v of d) {
        if (Math.abs(v) > 0.02) {
          if (quiet > 88) n++
          quiet = 0
        } else quiet++
      }
      return n
    }
    // a layer saved before the new knobs existed opens with their defaults
    localStorage.setItem('vellum.sounds.v1', JSON.stringify({ sounds: [{ id: 'old', name: 'Old', group: 'Player', seed: 1, master: S.master(), layers: [{ ...S.layer(), bright: undefined, vowel: undefined, vowelEnd: undefined, throat: undefined }] }] }))
    const B = await import('/src/lib/audio/board.ts')
    const old = B.loadBoard().sounds[0].layers[0]
    localStorage.removeItem('vellum.sounds.v1')
    return { plucks, i: vowel(0), u: vowel(4), a: vowel(2), few: clicks(20), many: clicks(200), old: [old.bright, old.vowel, old.throat] }
  })
  ;[92.5, 185, 370, 740, 1480].forEach((f, i) => assert.ok(Math.abs(r.plucks[i] / f - 1) < 0.02, `a pluck at ${f} Hz sounds at ${r.plucks[i].toFixed(1)}`))
  assert.ok(r.i.front > r.a.front * 3 && r.i.front > r.u.front * 3, `i carries its second formant high (${[r.i, r.a, r.u].map((m) => m.front.toFixed(2))})`)
  assert.ok(Math.abs(r.i.pitch - 120) < 3, 'the vowel filter keeps the voice’s pitch')
  assert.ok(r.few > 40 && r.few < 130, `about 20 clicks a second (${r.few} in 4 s)`)
  assert.ok(r.many > r.few * 4, `more clicks at 200 a second (${r.many})`)
  assert.deepEqual(r.old, [0.5, 2, 1])
  assert.deepEqual(errors, [])
  await page.close()
})

test('bubbles, roughness, wobble and the steep filter do what they say', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const S = await import('/src/lib/audio/synth.ts')
    const M = await import('/src/lib/audio/measure.ts')
    const one = (l) => S.render({ id: 's', name: 't', group: 'Player', seed: 5, layers: [S.layer(l)], master: S.master({ variation: 0 }) })
    const rms = (d, a = 0, b = d.length) => {
      let s = 0
      for (let i = a; i < b; i++) s += d[i] * d[i]
      return Math.sqrt(s / (b - a))
    }
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
    const bub = one({ wave: 'bubbles', pitch: 25, pitchEnd: 25, length: 1, sustain: 1, bubble: 900 })
    const tone = { wave: 'saw', pitch: 110, pitchEnd: 110, length: 1, sustain: 1 }
    const smooth = one(tone)
    const rough = one({ ...tone, rough: 0.6 })
    // the level of each 50 ms block: steady without wobble, uneven with it
    const spread = (d) => {
      const v = []
      for (let i = 2205; i + 2205 < d.length - 4410; i += 2205) v.push(rms(d, i, i + 2205))
      return Math.max(...v) / Math.min(...v)
    }
    const flat = one({ ...tone, wave: 'sine' })
    const wob = one({ ...tone, wave: 'sine', wobbleRate: 6, wobbleAmp: 0.8 })
    const pitches = (d) => {
      const out = []
      for (let i = 0; i + 8820 < d.length - 4410; i += 4410) out.push(M.measure(d.slice(i, i + 8820), S.RATE).pitchStart)
      return out
    }
    const bend = pitches(one({ ...tone, wave: 'sine', pitch: 440, pitchEnd: 440, wobbleRate: 4, wobblePitch: 6 }))
    const lp = { wave: 'noise', pitch: 30, pitchEnd: 30, length: 1, sustain: 1, filter: 'lowpass', cutoff: 500, cutoffEnd: 500 }
    // power at 2-4 kHz against 100-300 Hz, summed over 30 frequencies each
    const band = (d, lo, hi) => {
      let p = 0
      for (let k = 0; k < 30; k++) {
        const f = lo + ((hi - lo) * k) / 29
        let re = 0
        let im = 0
        for (let n = 0; n < d.length; n++) {
          re += d[n] * Math.cos((2 * Math.PI * f * n) / S.RATE)
          im += d[n] * Math.sin((2 * Math.PI * f * n) / S.RATE)
        }
        p += re * re + im * im
      }
      return p
    }
    const hi = (d) => band(d, 2000, 4000) / band(d, 100, 300)
    const B = await import('/src/lib/audio/board.ts')
    localStorage.setItem('vellum.sounds.v1', JSON.stringify({ sounds: [{ id: 'old', name: 'Old', group: 'Player', seed: 1, master: S.master(), layers: [{ ...S.layer(), grain: undefined, bubble: undefined, rough: undefined, wobbleRate: undefined, wobblePitch: undefined, wobbleAmp: undefined, steep: undefined }] }] }))
    const old = B.loadBoard().sounds[0].layers[0]
    localStorage.removeItem('vellum.sounds.v1')
    return {
      bubFinite: bub.every(Number.isFinite),
      bubLevel: rms(bub),
      roughDiffers: !same(smooth, rough),
      roughFinite: rough.every(Number.isFinite),
      flat: spread(flat),
      wob: spread(wob),
      bend: Math.max(...bend) / Math.min(...bend),
      steep: hi(one({ ...lp, steep: true })) / hi(one(lp)),
      old: [old.grain, old.bubble, old.rough, old.wobbleRate, old.wobblePitch, old.wobbleAmp, old.steep],
    }
  })
  assert.ok(r.bubFinite && r.bubLevel > 0.005, `bubbles make sound (${r.bubLevel.toFixed(4)})`)
  assert.ok(r.roughDiffers && r.roughFinite, 'roughness changes the wave')
  assert.ok(r.flat < 1.05 && r.wob > 1.3, `wobble moves the level (${r.flat.toFixed(2)} → ${r.wob.toFixed(2)})`)
  assert.ok(r.bend > 1.03, `wobble moves the pitch (${r.bend.toFixed(3)})`)
  assert.ok(r.steep < 0.1, `the steep filter leaves less above its cutoff (${r.steep.toFixed(2)})`)
  assert.deepEqual(r.old, [1, 800, 0, 6, 0, 0, false])
  assert.deepEqual(errors, [])
  await page.close()
})

/* Ranges each preset is held to, measured with measure.ts from the game's
   own files played at the preset's pitch (and the file's own pitch from
   sounds.json): length from the shortest file's 0.6x to the longest's 1.6x,
   brightness from half the darkest to twice the brightest, a tone or a
   noise where every file is one, and the note blocks' F# within 4%. The
   files are Mojang's and are not in the repository. */
const VANILLA = {
  'Orb pickup': { len: [0.29, 0.76], tone: true, f0: [1063.7, 1152.3], bright: [2100, 8500] },
  'Level up': { len: [0.72, 1.9], tone: true, rises: true, bright: [2300, 9400] },
  Click: { len: [0.084, 0.22], noise: true, bright: [1000, 4100] },
  'Item pickup': { len: [0.021, 0.056], noise: true, bright: [880, 3500] },
  Hurt: { len: [0.063, 0.19], noise: true, bright: [1100, 9100] },
  'Bow shot': { len: [0.077, 0.2], noise: true, bright: [430, 1700] },
  Eat: { len: [0.17, 0.46], noise: true, bright: [880, 5200] },
  'Grass step': { len: [0.2, 0.82], noise: true, bright: [4500, 20000] },
  'Wood break': { len: [0.077, 0.98], noise: true, bright: [93, 460] },
  'Stone break': { len: [0.15, 0.98], noise: true, bright: [84, 710] },
  'Glass break': { len: [0.24, 1.0], noise: true, bright: [1400, 13000] },
  Lever: { len: [0.14, 0.37], noise: true, bright: [710, 2800] },
  'Anvil land': { len: [0.38, 1.0], bright: [990, 4000] },
  Harp: { len: [0.28, 0.74], tone: true, f0: [355.2, 384.8], bright: [190, 770] },
  Bell: { len: [0.24, 0.63], tone: true, f0: [1420.8, 1539.2], bright: [740, 3000] },
  Bass: { len: [0.21, 0.56], tone: true, f0: [88.8, 96.2], bright: [53, 210] },
  Pling: { len: [0.3, 0.8], tone: true, f0: [355.2, 384.8], bright: [240, 970] },
  'Lava pop': { len: [0.077, 0.2], noise: true, bright: [320, 1300] },
  Portal: { len: [2.9, 7.8], tone: true, f0: [83.5, 90.5], bright: [60, 240] },
  Teleport: { len: [0.27, 0.93], tone: true, bright: [99, 1000] },
}

test('every preset that imitates a game sound is held to what it is like', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const S = await import('/src/lib/audio/synth.ts')
    const P = await import('/src/lib/audio/presets.ts')
    const M = await import('/src/lib/audio/measure.ts')
    return P.presets.filter((p) => p.vanilla).map((p) => ({ name: p.name, vanilla: p.vanilla, m: M.measure(S.render(P.fromPreset(p)), S.RATE) }))
  })
  assert.deepEqual(r.map((p) => p.name).sort(), Object.keys(VANILLA).sort(), 'every imitation has a reference, and every reference a preset')
  const inside = (v, [lo, hi]) => v >= lo && v <= hi
  for (const { name, vanilla, m } of r) {
    const want = VANILLA[name]
    const at = `${name} (${JSON.stringify(m, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))})`
    assert.match(vanilla.event, /^[a-z_]+(\.[a-z_]+)+$/, `${name} names a sound event`)
    assert.ok(vanilla.pitch >= 0.5 && vanilla.pitch <= 2, `${name}'s pitch is one /playsound can play`)
    assert.ok(inside(m.length, want.len), `${at}: heard for ${want.len.join('–')} s`)
    if (want.tone) assert.ok(m.voiced > 0.6, `${at}: a tone`)
    if (want.noise) assert.ok(m.voiced < 0.3, `${at}: a noise`)
    if (want.f0) assert.ok(inside(m.pitchStart, want.f0), `${at}: pitched ${want.f0.join('–')} Hz`)
    if (want.falls) assert.ok(m.pitchEnd < m.pitchStart, `${at}: falls in pitch`)
    if (want.rises) assert.ok(m.pitchEnd > m.pitchStart, `${at}: rises in pitch`)
    if (want.bright) assert.ok(inside(m.brightness, want.bright), `${at}: centred ${want.bright.join('–')} Hz`)
  }
  const by = Object.fromEntries(r.map((p) => [p.name, p.m]))
  assert.ok(by.Lever.brightness < by.Click.brightness, 'the lever is the click played lower')
  assert.deepEqual(errors, [])
  await page.close()
})

/* Accents go on top of the game's own recording, which the console can't
   make (a boom, a roar, a creak). Each names the sounds it goes on, at a
   pitch and volume a Game sound cue can take, and stays short unless it is
   a tail. */
test('every accent names the game sounds it goes on, and is short', async () => {
  const { page, errors } = await open()
  const r = await inApp(page, async () => {
    const S = await import('/src/lib/audio/synth.ts')
    const P = await import('/src/lib/audio/presets.ts')
    const M = await import('/src/lib/audio/measure.ts')
    return P.presets.map((p) => {
      const d = S.render(P.fromPreset(p))
      return { name: p.name, both: !!p.vanilla === !!p.accent, accent: P.fromPreset(p).accent, m: M.measure(d, S.RATE), finite: d.every(Number.isFinite) }
    })
  })
  assert.deepEqual(r.filter((p) => p.both).map((p) => p.name), [], 'each preset either imitates or accents')
  const accents = r.filter((p) => p.accent)
  assert.ok(accents.length >= 15, `${accents.length} accents`)
  for (const { name, accent, m, finite } of accents) {
    assert.ok(accent.on.length >= 1 && accent.adds.length > 20, `${name} says what it goes on and what it adds`)
    for (const c of accent.on) {
      assert.match(c.event, /^[a-z_]+(\.[a-z_]+)+$/, `${name} goes on a sound event`)
      assert.ok(c.pitch >= 0.5 && c.pitch <= 2, `${name}: ${c.event} at a pitch a cue can take`)
      assert.ok(c.volume > 0 && c.volume <= 4, `${name}: ${c.event} at a volume a cue can take`)
    }
    assert.ok(accent.after >= 0 && accent.after <= 0.5, `${name} starts with its sound, or just after`)
    assert.ok(finite && m.length > 0.05 && m.length < 4, `${name} is heard for ${m.length.toFixed(2)} s`)
  }
  const len = Object.fromEntries(accents.map((p) => [p.name, p.m.length]))
  for (const n of ['Ground slam', 'Lightning strike', 'Fireball shot', 'Chest open', 'Skeleton', 'Slime']) assert.ok(len[n] < 0.6, `${n} is a short accent (${len[n].toFixed(2)} s)`)
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
      sounds: [{ ...pick('Zombie'), variants: 3 }, { ...pick('Anvil land'), event: 'block.heavy.land' }],
    }
    const files = B.buildSoundPack(board, {})
    const dec = new TextDecoder()
    const json = (p) => JSON.parse(dec.decode(files.find((f) => f.path === p).bytes))
    const dup = { ...board, sounds: [board.sounds[0], { ...board.sounds[1], event: 'mobs.zombie' }] }
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
    'assets/mymobs/sounds/mobs/zombie1.ogg',
    'assets/mymobs/sounds/mobs/zombie2.ogg',
    'assets/mymobs/sounds/mobs/zombie3.ogg',
    'assets/mymobs/sounds/block/heavy/land.ogg',
  ])
  assert.deepEqual(r.sounds, {
    'mobs.zombie': { subtitle: 'subtitles.mymobs.mobs.zombie', sounds: ['mymobs:mobs/zombie1', 'mymobs:mobs/zombie2', 'mymobs:mobs/zombie3'] },
    'block.heavy.land': { subtitle: 'subtitles.mymobs.block.heavy.land', sounds: ['mymobs:block/heavy/land'] },
  })
  assert.deepEqual(r.lang, { 'subtitles.mymobs.mobs.zombie': 'Zombie', 'subtitles.mymobs.block.heavy.land': 'Anvil land' })
  assert.equal(r.mcmeta.pack.pack_format, 84)
  assert.ok(r.oggs.every((m) => m === 'OggS'))
  assert.ok(r.dup.some((m) => /already exports as mobs.zombie/.test(m)), 'two sounds on one event are caught')
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
  await page.waitForFunction(() => document.querySelector('.deck__name')?.value === 'Item pickup')
  assert.equal(await page.locator('.pad[aria-pressed="true"] .pad__name').textContent(), 'Item pickup')

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
  assert.equal(dl.suggestedFilename(), 'item_pickup.ogg')
  // the vanilla sound to compare with, at the pitch the game plays it
  assert.equal(await page.locator('.sb-compare code').textContent(), '/playsound minecraft:entity.item.pickup master @s ~ ~ ~ 1 2')
  const bytes = [...(await import('node:fs')).readFileSync(await dl.path())]
  const decoded = await page.evaluate(async (b) => {
    const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(new Uint8Array(b).buffer)
    return buf.duration
  }, bytes)
  assert.ok(decoded > 0.02, `the exported file decodes (${decoded} s)`)

  // variants export as a zip
  await page.getByRole('button', { name: 'More variants' }).click()
  await page.getByRole('button', { name: 'More variants' }).click()
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download 3 \.ogg files/ }).click()])
  assert.equal(zip.suggestedFilename(), 'player.item_pickup.zip')

  // an accent says which game sounds it goes on, and gives the lines that play them together
  await page.getByRole('button', { name: 'Add Ground slam to the board' }).click()
  await page.waitForFunction(() => document.querySelector('.deck__name')?.value === 'Ground slam')
  assert.equal(await page.locator('.sb-compare:not(.sb-accent)').count(), 0, 'an accent has nothing to imitate')
  assert.equal(
    await page.locator('.sb-accent code').textContent(),
    '/playsound minecraft:entity.generic.explode master @s ~ ~ ~ 1.5 0.6\n/playsound minecraft:block.anvil.land master @s ~ ~ ~ 0.8 0.5\n/playsound vellum:world.ground_slam master @s',
  )
  assert.match(await page.locator('.sb-accent').textContent(), /heard further away/)

  // import audio: a new sound with a sample layer
  await page.locator('input[type="file"]').setInputFiles({ name: 'blip.wav', mimeType: 'audio/wav', buffer: wav() })
  await page.waitForFunction(() => document.querySelector('.deck__name')?.value === 'blip')
  assert.equal(await page.locator('.pad').count(), 10)
  assert.equal(await page.locator('.strip__wave').first().textContent(), 'Sample')

  // the board survives a reload
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForSelector('.pad')
  assert.equal(await page.locator('.pad').count(), 10)
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

test('the console on its own (sounds.html): no Studio around it, and it plays', async () => {
  const { page, errors } = await open('sounds.html', { width: 390, height: 844 })
  await page.waitForSelector('.pad')
  assert.equal(await page.locator('.pad').count(), 8)
  assert.equal(await page.locator('.topbar__brand').textContent(), 'Vellum Sounds')
  assert.equal(await page.locator('.topbar nav, .topbar__server').count(), 0, 'no Studio links or server picker')
  await page.keyboard.press('2')
  await page.waitForFunction(() => document.querySelector('.deck__name')?.value === 'Item pickup')
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(over <= 0, `no horizontal scroll (${over}px over)`)
  assert.deepEqual(errors, [])
  await page.close()
})
