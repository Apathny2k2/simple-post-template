/* ---------------------------------------------------------------
   The shipped sample models, built rather than hand-written.

   A `.vellum` is key-ordered JSON with a data-URI texture inside it, so
   authoring one by hand is not a thing a person should do. This builds
   the four animated samples from a spec - cubes, bone tree, clips - and
   paints their sheets texel by texel, then writes them with the real
   writer, through the real packer, so what lands on disk is exactly
   what the editor would have saved.

   Run it against a dev server:

       pnpm dev                       # in one terminal
       node scripts/make-samples.mjs  # in another

   It needs a browser because the codec, the UV packer and the canvas
   the sheets are painted on all live in the app rather than in Node.
   --------------------------------------------------------------- */

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
  args: ['--no-sandbox'],
})
const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage()
const DEV = process.env.VELLUM_DEV ?? 'http://localhost:5173'
p.on('pageerror', e => console.log('PAGEERROR', e.message))
await p.goto(`${DEV}/#/`, { waitUntil: 'networkidle' })

const files = await p.evaluate(async () => {
  const NM = await import('/src/lib/new-model.ts')
  const UV = await import('/src/lib/uv-pack.ts')
  const V = await import('/src/lib/vellum.ts')
  const { makeCube, makeBone, newId } = NM

  /* ---------- a tiny deterministic noise, so the sheets are stable ---------- */
  let seed = 1
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

  const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  const shade = (rgb, k) => `rgb(${clamp(rgb[0]*k)},${clamp(rgb[1]*k)},${clamp(rgb[2]*k)})`

  // up is lit, down is in shadow, the sides sit between
  const FACE_LIGHT = { up: 1.22, north: 1.0, south: 0.94, east: 0.86, west: 0.82, down: 0.66 }

  /**
   * Lay a cube's six islands down on the sheet, one texel at a time,
   * so the noise lands on texels rather than being stretched by a fill.
   */
  function paintCube(ctx, cube, look) {
    const base = hex(look.base)
    for (const face of ['north','east','south','west','up','down']) {
      const [x1,y1,x2,y2] = cube.faces[face].uv
      const x = Math.min(x1,x2), y = Math.min(y1,y2)
      const w = Math.abs(x2-x1), h = Math.abs(y2-y1)
      const light = FACE_LIGHT[face]
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let k = light * (0.94 + rnd() * 0.12)
          // a one-texel rim, which is what makes pixel art read as solid
          if (look.rim !== false && (i === 0 || j === 0 || i === w-1 || j === h-1)) k *= 0.8
          // a lit edge along the top of the side faces
          if (look.sheen && j === 1 && face !== 'down') k *= 1.16
          ctx.fillStyle = shade(base, k)
          ctx.fillRect(x + i, y + j, 1, 1)
        }
      }
      if (look.glow) {
        // an emissive speckle, unshaded, so it reads as light rather than paint
        const g = hex(look.glow)
        const n = Math.max(1, Math.round(w * h * 0.16))
        for (let s = 0; s < n; s++) {
          const gx = x + 1 + Math.floor(rnd() * Math.max(1, w - 2))
          const gy = y + 1 + Math.floor(rnd() * Math.max(1, h - 2))
          ctx.fillStyle = `rgb(${g[0]},${g[1]},${g[2]})`
          ctx.fillRect(gx, gy, 1, 1)
        }
      }
      if (look.pane && face !== 'up' && face !== 'down' && w > 2 && h > 2) {
        /* a pane of glass: clearing the middle of the side faces is what
           lets the level inside a bottle be seen at all. Without it the
           drink clip drains a liquid nobody can look at. */
        ctx.clearRect(x + 1, y + 1, w - 2, h - 2)
        const tint = hex(look.pane)
        for (let j = 1; j < h - 1; j++) {
          for (let i = 1; i < w - 1; i++) {
            // a faint sheen down one side, so it still reads as glass
            if ((i + j) % 7 !== 0) continue
            ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.5)`
            ctx.fillRect(x + i, y + j, 1, 1)
          }
        }
        continue
      }
      if (look.stripe) {
        const st = hex(look.stripe)
        ctx.fillStyle = `rgb(${st[0]},${st[1]},${st[2]})`
        for (let j = 0; j < h; j += 3) ctx.fillRect(x, y + j, w, 1)
      }
    }
  }

  /**
   * Build a model from a flat spec: cubes get packed onto the sheet,
   * bones are named rather than referenced, and the texture is painted
   * from the same spec so a cube and its pixels cannot drift apart.
   */
  function build({ name, kind, subtype, sheet, cubes, bones, clips, behaviour, config, scale = 1 }) {
    /* Authored at whatever size reads well while drawing it, then
       brought into the space the format actually renders in: an item
       lives in a 16-unit slot, and a sword drawn 32 units long is two
       blocks of sword in a player's hand. Scaling here rather than in
       the coordinates keeps the numbers above legible. */
    const s = scale
    if (s !== 1) {
      cubes = cubes.map((c) => ({
        ...c,
        from: c.from.map((v) => v * s),
        to: c.to.map((v) => v * s),
        origin: c.origin?.map((v) => v * s),
      }))
      const shrink = (spec) => ({
        ...spec,
        origin: spec.origin.map((v) => v * s),
        children: spec.children?.map(shrink),
      })
      bones = bones.map(shrink)
      clips = clips.map((c) => ({
        ...c,
        tracks: c.tracks.map((t) =>
          t.channel === 'position'
            ? { ...t, keys: t.keys.map(([time, v, i]) => [time, v.map((n) => n * s), i]) }
            : t,
        ),
      }))
    }
    const texture = {
      id: newId(), name: `${name}.png`,
      width: sheet, height: sheet, uvWidth: sheet, uvHeight: sheet, source: '',
    }
    const model = {
      name, kind, subtype,
      resolution: { width: sheet, height: sheet },
      bones: [], cubes: [], textures: [texture], clips: [],
    }

    const byName = {}
    for (const c of cubes) {
      const size = [c.to[0]-c.from[0], c.to[1]-c.from[1], c.to[2]-c.from[2]]
      const at = UV.findSpot(model, UV.boxSize(size))
      if (!at) throw new Error(`${name}: no room on the sheet for ${c.name}`)
      const cube = makeCube(c.name, c.from, c.to, {
        origin: c.origin, rotation: c.rotation, uvAt: at, texture: texture.id,
      })
      model.cubes.push(cube)
      byName[c.name] = cube
    }

    const canvas = document.createElement('canvas')
    canvas.width = sheet; canvas.height = sheet
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.clearRect(0, 0, sheet, sheet)
    for (const c of cubes) paintCube(ctx, byName[c.name], c.look)
    texture.source = canvas.toDataURL('image/png')

    const boneByName = {}
    const make = (spec) => {
      const children = []
      for (const cn of spec.cubes ?? []) children.push({ kind: 'cube', id: byName[cn].id })
      for (const child of spec.children ?? []) children.push({ kind: 'bone', bone: make(child) })
      const bone = makeBone(spec.name, spec.origin, children)
      boneByName[spec.name] = bone
      return bone
    }
    model.bones = bones.map(make)

    const key = (t, v, interp = 'catmullrom') => ({ id: newId(), time: t, value: v, interp })
    model.clips = clips.map((c) => ({
      id: newId(), name: c.name, loop: c.loop, length: c.length, snapping: c.snapping ?? 24,
      tracks: c.tracks.map((t) => ({
        bone: boneByName[t.bone].id,
        channel: t.channel,
        keys: t.keys.map(([time, value, interp]) => key(time, value, interp)),
      })),
    }))

    /* A behaviour names clips, and a clip's id is only known once the
       model is built - so the spec names them and they are resolved
       here rather than being hand-copied into two places. */
    if (behaviour) {
      const clipId = (n) => model.clips.find((c) => c.name === n)?.id ?? null
      model.behaviour = {
        requires: behaviour.requires.map((r, i) => ({ id: `br${i}`, at: r.at, block: r.block })),
        stages: behaviour.stages.map((st, i) => ({
          id: `bs${i}`,
          name: st.name,
          seconds: st.seconds,
          clip: st.clip ? clipId(st.clip) : null,
          effects: st.effects ?? [],
        })),
      }
    }

    if (config) model.config = config

    return {
      text: V.writeVellum(model),
      cubes: model.cubes.length,
      clips: model.clips.length,
      stages: model.behaviour?.stages.length ?? 0,
    }
  }

  /* ================= 1. Runic Blade ================= */
  const steel  = { base: '#b9c4d6', sheen: true }
  const steel2 = { base: '#a3b0c6', sheen: true }
  const gold   = { base: '#c9a24b', sheen: true }
  const wrap   = { base: '#5a3f34', stripe: '#46312a' }
  const rune   = { base: '#2f6fa8', glow: '#9fe8ff' }

  const runic = build({
    name: 'runic_blade', kind: 'items', subtype: 'weapon', sheet: 64, scale: 0.5,
    /* The other half of shipping a weapon: what it is once it is not
       just a shape. Custom model data is the line that ties this config
       back to the model in the same file. */
    config: {
      material: 'DIAMOND_SWORD',
      display: '&bRunic Blade',
      lore: ['&7Cut from a stone that remembers.', '&8Hums when a rune is near.'],
      model: 1001,
      unbreakable: true,
      hideFlags: true,
      glint: true,
      enchants: [{ name: 'SHARPNESS', level: '4' }, { name: 'FIRE_ASPECT', level: '1' }],
      attributes: [
        { slot: 'MainHand', attribute: 'Damage', value: '11' },
        { slot: 'MainHand', attribute: 'AttackSpeed', value: '1.5' },
      ],
      skills: [{ skill: 'skill{s=RunicArc}', trigger: '~onUse', chance: '0.35' }],
      dropGlow: true,
    },
    cubes: [
      { name: 'pommel',    from: [-2,-2,-2],      to: [2,1,2],        origin: [0,0,0],    look: gold },
      { name: 'grip',      from: [-1,1,-1],       to: [1,7,1],        origin: [0,1,0],    look: wrap },
      { name: 'guard',     from: [-5,7,-1.5],     to: [5,9,1.5],      origin: [0,7,0],    look: gold },
      { name: 'guard_left',  from: [-6.5,7.5,-1], to: [-5,9,1],       origin: [-5,7.5,0], rotation: [0,0,-18], look: gold },
      { name: 'guard_right', from: [5,7.5,-1],    to: [6.5,9,1],      origin: [5,7.5,0],  rotation: [0,0,18],  look: gold },
      { name: 'blade_lower', from: [-2,9,-0.75],  to: [2,17,0.75],    origin: [0,9,0],    look: steel },
      { name: 'blade_upper', from: [-1.5,17,-0.75], to: [1.5,24,0.75],origin: [0,17,0],   look: steel },
      { name: 'blade_neck',  from: [-1,24,-0.5],  to: [1,28,0.5],     origin: [0,24,0],   look: steel2 },
      { name: 'tip',       from: [-0.5,28,-0.5],  to: [0.5,30,0.5],   origin: [0,28,0],   look: steel2 },
      { name: 'rune_lower', from: [-0.5,12,-1.1], to: [0.5,14,1.1],   origin: [0,12,0],   look: rune },
      { name: 'rune_upper', from: [-0.5,19,-1],   to: [0.5,21,1],     origin: [0,19,0],   look: rune },
    ],
    bones: [{
      name: 'root', origin: [0,0,0], children: [
        { name: 'hilt',  origin: [0,0,0], cubes: ['pommel','grip'] },
        { name: 'guard', origin: [0,8,0], cubes: ['guard','guard_left','guard_right'] },
        { name: 'blade', origin: [0,9,0], cubes: ['blade_lower','blade_upper','blade_neck','tip'], children: [
          { name: 'runes', origin: [0,16,0], cubes: ['rune_lower','rune_upper'] },
        ]},
      ],
    }],
    clips: [
      { name: 'idle', loop: 'loop', length: 3.2, tracks: [
        { bone: 'root', channel: 'position', keys: [[0,[0,0,0]],[0.8,[0,0.7,0]],[1.6,[0,0,0]],[2.4,[0,-0.4,0]],[3.2,[0,0,0]]] },
        { bone: 'root', channel: 'rotation', keys: [[0,[0,0,0]],[1.6,[0,0,2.5]],[3.2,[0,0,0]]] },
        { bone: 'runes', channel: 'scale', keys: [[0,[1,1,1]],[1.1,[1.3,1.3,1.3]],[2.1,[1,1,1]],[3.2,[1,1,1]]] },
      ]},
      { name: 'swing', loop: 'once', length: 0.85, tracks: [
        { bone: 'root', channel: 'rotation', keys: [[0,[0,0,0]],[0.18,[-12,0,-42]],[0.42,[18,0,108]],[0.62,[6,0,74]],[0.85,[0,0,0]]] },
        { bone: 'root', channel: 'position', keys: [[0,[0,0,0]],[0.42,[1.5,-1,2]],[0.85,[0,0,0]]] },
        { bone: 'blade', channel: 'rotation', keys: [[0,[0,0,0]],[0.3,[0,0,-9]],[0.55,[0,0,7]],[0.85,[0,0,0]]] },
      ]},
    ],
  })

  /* ================= 2. Emberfang ================= */
  const iron   = { base: '#97897a', sheen: true }
  const darkir = { base: '#6f6559' }
  const emberc = { base: '#c2481f', glow: '#ffd08a' }
  const horn   = { base: '#3b2f2b', stripe: '#2d2320' }
  const bone   = { base: '#cfc2a4', sheen: true }

  const ember = build({
    name: 'emberfang', kind: 'items', subtype: 'weapon', sheet: 64, scale: 0.5,
    cubes: [
      { name: 'pommel', from: [-1.5,-2,-1.5], to: [1.5,0.5,1.5], origin: [0,0,0],   look: bone },
      { name: 'grip',   from: [-1,0.5,-1],    to: [1,6,1],       origin: [0,0.5,0], look: horn },
      { name: 'collar', from: [-2,6,-1.5],    to: [2,7.5,1.5],   origin: [0,6,0],   look: bone },
      { name: 'spine',  from: [-1,7.5,-1],    to: [1,26,1],      origin: [0,7.5,0], look: darkir },
      { name: 'edge',   from: [1,8,-0.6],     to: [4.5,24,0.6],  origin: [1,8,0],   look: iron },
      { name: 'tooth_low', from: [4.5,10,-0.5], to: [6,12,0.5],  origin: [4.5,10,0], look: iron },
      { name: 'tooth_mid', from: [4.5,14,-0.5], to: [6,16,0.5],  origin: [4.5,14,0], look: iron },
      { name: 'tooth_top', from: [4.5,18,-0.5], to: [6,20,0.5],  origin: [4.5,18,0], look: iron },
      { name: 'tip',    from: [-1,26,-0.8],    to: [2.5,30,0.8], origin: [0,26,0], rotation: [0,0,-12], look: iron },
      { name: 'inlay',  from: [1.1,9,-1.0],    to: [2.1,23,1.0], origin: [1.6,9,0], look: emberc },
    ],
    bones: [{
      name: 'root', origin: [0,0,0], children: [
        { name: 'hilt',  origin: [0,0,0],   cubes: ['pommel','grip','collar'] },
        { name: 'blade', origin: [0,7.5,0], cubes: ['spine','edge','tip','inlay'], children: [
          { name: 'teeth', origin: [4.5,10,0], cubes: ['tooth_low','tooth_mid','tooth_top'] },
        ]},
      ],
    }],
    clips: [
      { name: 'idle', loop: 'loop', length: 2.8, tracks: [
        { bone: 'root',  channel: 'position', keys: [[0,[0,0,0]],[0.7,[0,0.5,0]],[1.4,[0,0,0]],[2.1,[0,-0.3,0]],[2.8,[0,0,0]]] },
        { bone: 'teeth', channel: 'scale',    keys: [[0,[1,1,1]],[0.9,[1.18,1.05,1.18]],[1.9,[1,1,1]],[2.8,[1,1,1]]] },
        { bone: 'blade', channel: 'rotation', keys: [[0,[0,0,0]],[1.4,[0,0,-2]],[2.8,[0,0,0]]] },
      ]},
      { name: 'swing', loop: 'once', length: 0.72, tracks: [
        { bone: 'root',  channel: 'rotation', keys: [[0,[0,0,0]],[0.16,[-14,0,-52]],[0.36,[22,0,118]],[0.52,[8,0,82]],[0.72,[0,0,0]]] },
        { bone: 'root',  channel: 'position', keys: [[0,[0,0,0]],[0.36,[2,-1.5,2.5]],[0.72,[0,0,0]]] },
        { bone: 'teeth', channel: 'scale',    keys: [[0,[1,1,1]],[0.36,[1.3,1.1,1.3]],[0.72,[1,1,1]]] },
      ]},
    ],
  })

  /* ================= 3. Tide Flask ================= */
  const glass = { base: '#6f93a6', sheen: true, pane: '#cfe8f2' }
  const glass2= { base: '#5d8093', sheen: true }
  const brine = { base: '#2f8fa8', glow: '#9ff0ff' }
  const cork  = { base: '#9a7748', stripe: '#84633a' }
  const paper = { base: '#d9cfae' }

  const flask = build({
    name: 'tide_flask', kind: 'items', subtype: 'consumable', sheet: 64,
    cubes: [
      { name: 'base',     from: [-3.5,0,-3.5],    to: [3.5,1.5,3.5],   origin: [0,0,0],   look: glass2 },
      { name: 'body',     from: [-3,1.5,-3],      to: [3,7,3],         origin: [0,1.5,0], look: glass },
      { name: 'shoulder', from: [-2,7,-2],        to: [2,9,2],         origin: [0,7,0],   look: glass },
      { name: 'neck',     from: [-1.25,9,-1.25],  to: [1.25,12,1.25],  origin: [0,9,0],   look: glass2 },
      { name: 'stopper',  from: [-1.75,12,-1.75], to: [1.75,14,1.75],  origin: [0,12,0],  look: cork },
      { name: 'fill',     from: [-2.5,2,-2.5],    to: [2.5,6.5,2.5],   origin: [0,2,0],   look: brine },
      { name: 'label',    from: [-2.2,3,-3.2],    to: [2.2,5.5,-2.9],  origin: [0,3,-3],  look: paper },
    ],
    bones: [{
      name: 'root', origin: [0,0,0], cubes: ['base','body','shoulder','neck','label'], children: [
        { name: 'fill',    origin: [0,2,0],  cubes: ['fill'] },
        { name: 'stopper', origin: [0,12,0], cubes: ['stopper'] },
      ],
    }],
    clips: [
      { name: 'idle', loop: 'loop', length: 3, tracks: [
        { bone: 'root', channel: 'rotation', keys: [[0,[0,0,0]],[0.75,[0,0,3]],[1.5,[0,0,0]],[2.25,[0,0,-3]],[3,[0,0,0]]] },
        { bone: 'fill', channel: 'rotation', keys: [[0,[0,0,0]],[0.75,[0,0,-5]],[1.5,[0,0,0]],[2.25,[0,0,5]],[3,[0,0,0]]] },
      ]},
      { name: 'drink', loop: 'once', length: 2, tracks: [
        { bone: 'root',    channel: 'rotation', keys: [[0,[0,0,0]],[0.3,[-18,0,3]],[0.75,[-74,0,6]],[1.4,[-78,0,4]],[2,[0,0,0]]] },
        { bone: 'stopper', channel: 'position', keys: [[0,[0,0,0],'step'],[0.28,[0,0,0],'step'],[0.5,[0,4.5,-2.5]],[0.95,[0,-1,-6]],[2,[0,0,0],'step']] },
        { bone: 'stopper', channel: 'rotation', keys: [[0,[0,0,0],'step'],[0.28,[0,0,0],'step'],[0.5,[38,0,24]],[0.95,[96,0,58]],[2,[0,0,0],'step']] },
        /* linear across the empty stretch: a spline through 0.94 and
           back up to 1 undershoots past zero here, and a negative scale
           turns the liquid inside out */
        { bone: 'fill',    channel: 'scale',    keys: [[0,[1,1,1]],[0.4,[1,0.94,1]],[1.35,[1,0.08,1],'linear'],[1.7,[1,0.08,1],'linear'],[2,[1,1,1],'step']] },
      ]},
    ],
  })

  /* ================= 4. Honeyed Loaf ================= */
  const crust  = { base: '#a9702f', sheen: true }
  const crown  = { base: '#c08a41', sheen: true }
  const honey  = { base: '#e3a94f', glow: '#ffe3a4' }
  const crumbc = { base: '#d8bb87' }

  const loaf = build({
    name: 'honeyed_loaf', kind: 'items', subtype: 'consumable', sheet: 64,
    cubes: [
      { name: 'loaf',      from: [-5,0,-3.5],     to: [5,4.5,3.5],   origin: [0,0,0],    look: crust },
      { name: 'crown',     from: [-4,4.5,-3],     to: [4,6.5,3],     origin: [0,4.5,0],  look: crown },
      { name: 'drizzle_l', from: [-3.5,6.5,-2.5], to: [-1,7.2,2.5],  origin: [-2.25,6.5,0], look: honey },
      { name: 'drizzle_r', from: [0.5,6.5,-2.5],  to: [3.5,7.2,2.5], origin: [2,6.5,0],  look: honey },
      { name: 'crumb_l',   from: [-5.6,0.5,-2],   to: [-5,3,2],      origin: [-5,0.5,0], look: crumbc },
      { name: 'crumb_r',   from: [5,0.5,-2],      to: [5.6,3,2],     origin: [5,0.5,0],  look: crumbc },
    ],
    bones: [{
      name: 'root', origin: [0,0,0], children: [
        { name: 'loaf', origin: [0,0,0], cubes: ['loaf','crown','crumb_l','crumb_r'], children: [
          { name: 'glaze', origin: [0,6.5,0], cubes: ['drizzle_l','drizzle_r'] },
        ]},
      ],
    }],
    clips: [
      { name: 'idle', loop: 'loop', length: 2.4, tracks: [
        { bone: 'root',  channel: 'position', keys: [[0,[0,0,0]],[0.6,[0,0.4,0]],[1.2,[0,0,0]],[1.8,[0,-0.25,0]],[2.4,[0,0,0]]] },
        { bone: 'root',  channel: 'rotation', keys: [[0,[0,0,0]],[1.2,[0,0,2]],[2.4,[0,0,0]]] },
        { bone: 'glaze', channel: 'scale',    keys: [[0,[1,1,1]],[1.2,[1.04,0.92,1.04]],[2.4,[1,1,1]]] },
      ]},
      { name: 'eat', loop: 'once', length: 2.4, tracks: [
        { bone: 'root', channel: 'rotation', keys: [
          [0,[0,0,0]],[0.35,[-26,0,-4]],[0.6,[-8,0,0]],
          [1.05,[-30,0,5]],[1.3,[-8,0,0]],
          [1.75,[-34,0,-5]],[2,[-10,0,0]],[2.4,[0,0,0]]] },
        { bone: 'loaf', channel: 'scale', keys: [
          [0,[1,1,1],'step'],[0.5,[0.8,0.88,0.92],'step'],
          [1.2,[0.58,0.72,0.8],'step'],[1.9,[0.3,0.52,0.62],'step'],
          [2.4,[1,1,1],'step']] },
        { bone: 'glaze', channel: 'scale', keys: [
          [0,[1,1,1],'step'],[0.5,[0.7,1,1],'step'],[1.2,[0.4,1,1],'step'],
          [1.9,[0,1,1],'step'],[2.4,[1,1,1],'step']] },
      ]},
    ],
  })

  /* ================= 5. Alien Sword =================
     The oldest sample in the set, and it looked it: 22 cubes each
     carrying their own rotation, no rig, and a silhouette that read
     as a pile of boxes at thumbnail size. Rebuilt on the same spec
     the others use - a hilt you can name, a guard, a tapering blade,
     and an emissive core that pulses rather than speckling at random. */
  const chitin = { base: '#6b4b8f', sheen: true }
  const chitin2= { base: '#553a73', sheen: true }
  const voidwr = { base: '#3b2c52', stripe: '#2a1d3d' }
  const crystal= { base: '#8fdfe6', sheen: true }
  const crystal2={ base: '#6fb4c6', sheen: true }
  const core   = { base: '#8d3fd6', glow: '#ecc6ff' }

  const alien = build({
    name: 'alien_sword', kind: 'items', subtype: 'weapon', sheet: 64, scale: 0.5,
    cubes: [
      { name: 'pommel',      from: [-2,-2,-2],       to: [2,0,2],        origin: [0,0,0],     look: chitin2 },
      { name: 'grip',        from: [-1.25,0,-1.25],  to: [1.25,6.5,1.25],origin: [0,0,0],     look: voidwr },
      { name: 'guard',       from: [-4.5,6.5,-1.5],  to: [4.5,8.5,1.5],  origin: [0,6.5,0],   look: chitin },
      { name: 'prong_left',  from: [-6.5,8,-1],      to: [-4.5,11.5,1],  origin: [-4.5,8,0],  rotation: [0,0,26],  look: chitin },
      { name: 'prong_right', from: [4.5,8,-1],       to: [6.5,11.5,1],   origin: [4.5,8,0],   rotation: [0,0,-26], look: chitin },
      { name: 'blade_base',  from: [-2,8.5,-0.9],    to: [2,17,0.9],     origin: [0,8.5,0],   look: crystal },
      { name: 'blade_mid',   from: [-1.5,17,-0.8],   to: [1.5,24,0.8],   origin: [0,17,0],    look: crystal },
      { name: 'blade_tip',   from: [-1,24,-0.6],     to: [1,28,0.6],     origin: [0,24,0],    look: crystal2 },
      { name: 'point',       from: [-0.5,28,-0.4],   to: [0.5,30,0.4],   origin: [0,28,0],    look: crystal2 },
      { name: 'core_low',    from: [-0.5,10,-1.1],   to: [0.5,16,1.1],   origin: [0,10,0],    look: core },
      { name: 'core_high',   from: [-0.5,18,-1],     to: [0.5,23,1],     origin: [0,18,0],    look: core },
      { name: 'fin_left',    from: [-3.5,11.5,-0.5], to: [-2,16,0.5],    origin: [-2,11.5,0], rotation: [0,0,17],  look: crystal2 },
      { name: 'fin_right',   from: [2,11.5,-0.5],    to: [3.5,16,0.5],   origin: [2,11.5,0],  rotation: [0,0,-17], look: crystal2 },
    ],
    bones: [{
      name: 'root', origin: [0,0,0], children: [
        { name: 'hilt',  origin: [0,0,0],   cubes: ['pommel','grip'] },
        { name: 'guard', origin: [0,7.5,0], cubes: ['guard','prong_left','prong_right'] },
        { name: 'blade', origin: [0,8.5,0], cubes: ['blade_base','blade_mid','blade_tip','point'], children: [
          { name: 'core', origin: [0,16,0], cubes: ['core_low','core_high'] },
          { name: 'fins', origin: [0,14,0], cubes: ['fin_left','fin_right'] },
        ]},
      ],
    }],
    clips: [
      { name: 'idle', loop: 'loop', length: 3.6, tracks: [
        { bone: 'root',  channel: 'position', keys: [[0,[0,0,0]],[0.9,[0,0.8,0]],[1.8,[0,0,0]],[2.7,[0,-0.5,0]],[3.6,[0,0,0]]] },
        { bone: 'root',  channel: 'rotation', keys: [[0,[0,0,0]],[1.8,[0,0,3]],[3.6,[0,0,0]]] },
        { bone: 'core',  channel: 'scale',    keys: [[0,[1,1,1]],[1.2,[1.35,1.05,1.35]],[2.4,[1,1,1]],[3.6,[1,1,1]]] },
        { bone: 'fins',  channel: 'rotation', keys: [[0,[0,0,0]],[1.8,[0,14,0]],[3.6,[0,0,0]]] },
      ]},
      { name: 'swing', loop: 'once', length: 0.8, tracks: [
        { bone: 'root',  channel: 'rotation', keys: [[0,[0,0,0]],[0.16,[-16,0,-48]],[0.4,[20,0,114]],[0.58,[7,0,78]],[0.8,[0,0,0]]] },
        { bone: 'root',  channel: 'position', keys: [[0,[0,0,0]],[0.4,[1.8,-1.2,2.2]],[0.8,[0,0,0]]] },
        { bone: 'core',  channel: 'scale',    keys: [[0,[1,1,1]],[0.4,[1.5,1.1,1.5]],[0.8,[1,1,1]]] },
        { bone: 'fins',  channel: 'rotation', keys: [[0,[0,0,0]],[0.4,[0,-26,0]],[0.8,[0,0,0]]] },
      ]},
    ],
  })

  /* ================= 6. Geyser Block =================
     The case behaviours were built around. Water over lava beneath it
     arms the thing; then it charges quietly, rumbles as it nears full,
     blows, and settles. None of that is in a clip - a clip cannot say
     "for seven seconds" or "when there is lava below". */
  const stone  = { base: '#5b5a57', sheen: true }
  const stone2 = { base: '#47464a' }
  const scald  = { base: '#2f7f96', glow: '#b6f2ff' }
  const crackc = { base: '#b8471f', glow: '#ffbe6b' }

  const geyser = build({
    name: 'geyser_block', kind: 'blocks', sheet: 64,
    cubes: [
      { name: 'basin',   from: [0,0,0],       to: [16,5,16],      origin: [0,0,0],    look: stone },
      { name: 'rim_n',   from: [0,5,0],       to: [16,7,3],       origin: [0,5,0],    look: stone2 },
      { name: 'rim_s',   from: [0,5,13],      to: [16,7,16],      origin: [0,5,13],   look: stone2 },
      { name: 'rim_w',   from: [0,5,3],       to: [3,7,13],       origin: [0,5,3],    look: stone2 },
      { name: 'rim_e',   from: [13,5,3],      to: [16,7,13],      origin: [13,5,3],   look: stone2 },
      { name: 'crack',   from: [3,4.9,3],     to: [13,5.2,13],    origin: [3,4.9,3],  look: crackc },
      { name: 'throat',  from: [4,5,4],       to: [12,6,12],      origin: [4,5,4],    look: stone2 },
      { name: 'surface', from: [4.5,6,4.5],   to: [11.5,7.5,11.5],origin: [8,6,8],    look: scald },
      { name: 'jet',     from: [6,7.5,6],     to: [10,8,10],      origin: [8,7.5,8],  look: scald },
    ],
    bones: [{
      name: 'root', origin: [8,0,8], children: [
        { name: 'shell', origin: [8,0,8], cubes: ['basin','rim_n','rim_s','rim_w','rim_e','crack'] },
        { name: 'vent',  origin: [8,5,8], cubes: ['throat'], children: [
          { name: 'surface', origin: [8,6,8],   cubes: ['surface'] },
          { name: 'jet',     origin: [8,7.5,8], cubes: ['jet'] },
        ]},
      ],
    }],
    clips: [
      /* Quiet. The pool breathes and the cracks stay dim. */
      { name: 'idle', loop: 'loop', length: 3.4, tracks: [
        { bone: 'surface', channel: 'position', keys: [[0,[0,0,0]],[0.85,[0,0.25,0]],[1.7,[0,0,0]],[2.55,[0,-0.2,0]],[3.4,[0,0,0]]] },
        { bone: 'surface', channel: 'scale',    keys: [[0,[1,1,1]],[1.7,[1.02,1,1.02]],[3.4,[1,1,1]]] },
      ]},
      /* Nearly full. The block itself starts moving. */
      { name: 'rumble', loop: 'loop', length: 0.55, tracks: [
        { bone: 'root',    channel: 'position', keys: [[0,[0,0,0],'linear'],[0.14,[0.35,0,-0.25],'linear'],[0.28,[-0.3,0,0.3],'linear'],[0.42,[0.2,0,0.2],'linear'],[0.55,[0,0,0],'linear']] },
        { bone: 'surface', channel: 'position', keys: [[0,[0,0,0],'linear'],[0.28,[0,0.6,0],'linear'],[0.55,[0,0,0],'linear']] },
        { bone: 'jet',     channel: 'scale',    keys: [[0,[1,1,1],'linear'],[0.28,[1,2.4,1],'linear'],[0.55,[1,1,1],'linear']] },
      ]},
      /* The burst. Linear on the way down: a spline through a value
         this large undershoots past zero, and a negative scale turns
         the column inside out. */
      { name: 'erupt', loop: 'loop', length: 1.6, tracks: [
        { bone: 'jet',     channel: 'scale',    keys: [[0,[1,1,1],'linear'],[0.18,[1.6,30,1.6],'linear'],[0.8,[1.3,24,1.3],'linear'],[1.3,[1,7,1],'linear'],[1.6,[1,1,1],'linear']] },
        { bone: 'surface', channel: 'position', keys: [[0,[0,0,0],'linear'],[0.18,[0,1.2,0],'linear'],[1.0,[0,-0.8,0],'linear'],[1.6,[0,0,0],'linear']] },
        { bone: 'root',    channel: 'position', keys: [[0,[0,0,0],'linear'],[0.12,[0.5,0,0.4],'linear'],[0.3,[-0.4,0,-0.3],'linear'],[0.6,[0,0,0],'linear'],[1.6,[0,0,0],'linear']] },
      ]},
    ],
    behaviour: {
      requires: [
        { at: [0,-1,0], block: 'minecraft:water' },
        { at: [0,-2,0], block: 'minecraft:lava' },
      ],
      stages: [
        { name: 'charge', seconds: 7, clip: 'idle', effects: [
          { kind: 'particles', id: 'minecraft:splash', amount: 2, at: [0,8,0] },
        ]},
        { name: 'rumble', seconds: 2.2, clip: 'rumble', effects: [
          { kind: 'shake', amount: 0.45 },
          { kind: 'particles', id: 'minecraft:block_dust', amount: 16, at: [0,1,0] },
        ]},
        { name: 'erupt', seconds: 1.6, clip: 'erupt', effects: [
          { kind: 'particles', id: 'minecraft:cloud', amount: 40, at: [0,10,0] },
          { kind: 'sound', id: 'minecraft:block.fire.extinguish', amount: 1 },
        ]},
        { name: 'settle', seconds: 2.6, clip: 'idle', effects: [
          { kind: 'particles', id: 'minecraft:cloud', amount: 7, at: [0,9,0] },
        ]},
      ],
    },
  })

  return { runic, ember, flask, loaf, alien, geyser }
})

const out = {
  runic_blade: files.runic, emberfang: files.ember,
  tide_flask: files.flask, honeyed_loaf: files.loaf,
  alien_sword: files.alien,
  geyser_block: files.geyser,
}
for (const [name, r] of Object.entries(out)) {
  writeFileSync(new URL(`../src/models/${name}.vellum`, import.meta.url), r.text)
  console.log(`${name.padEnd(14)} ${String(r.cubes).padStart(2)} cubes, ${r.clips} clips${r.stages ? `, ${r.stages} stages` : ''}, ${(r.text.length/1024).toFixed(1)} KB`)
}
await b.close()
