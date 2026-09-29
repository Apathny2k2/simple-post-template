#!/usr/bin/env node
/**
 * Independent structural check on a .bbmodel. Deliberately does not trust the
 * generator: it re-derives every reference from the file itself.
 *
 *   node tools/validate.mjs <model.bbmodel> [...]
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const DIRS = ['north', 'east', 'south', 'west', 'up', 'down']
const JAVA_ROT = new Set([-45, -22.5, 0, 22.5, 45])

function walkOutliner(nodes, onGroup, onRef, depth = 0) {
  for (const node of nodes) {
    if (typeof node === 'string') {
      onRef(node, depth)
    } else {
      onGroup(node, depth)
      walkOutliner(node.children ?? [], onGroup, onRef, depth + 1)
    }
  }
}

function validate(file) {
  const errors = []
  const warnings = []
  const raw = readFileSync(file, 'utf8')

  let m
  try {
    m = JSON.parse(raw)
  } catch (e) {
    return { file, errors: [`JSON does not parse: ${e.message}`], warnings: [], stats: {} }
  }

  const fmt = m.meta?.model_format ?? '(missing)'
  const res = m.resolution ?? {}
  const elements = m.elements ?? []
  const textures = m.textures ?? []
  const animations = m.animations ?? []

  if (!m.meta?.format_version) errors.push('meta.format_version missing')
  if (!res.width || !res.height) errors.push('resolution.width/height missing')
  if (!elements.length) errors.push('no elements')
  if (!textures.length) errors.push('no textures')

  // --- textures ---
  textures.forEach((t, i) => {
    if (!/^data:image\/png;base64,/.test(t.source ?? '')) {
      errors.push(`textures[${i}] source is not an embedded png data URI`)
    } else {
      const bytes = Buffer.from(t.source.split(',')[1], 'base64')
      if (bytes.slice(1, 4).toString() !== 'PNG') errors.push(`textures[${i}] is not a real PNG`)
      // IHDR width/height live at bytes 16..24
      const w = bytes.readUInt32BE(16)
      const h = bytes.readUInt32BE(20)
      if (w !== t.width || h !== t.height) {
        errors.push(`textures[${i}] declares ${t.width}x${t.height} but the PNG is ${w}x${h}`)
      }
      if (w !== res.width || h !== res.height) {
        warnings.push(`textures[${i}] is ${w}x${h} but resolution is ${res.width}x${res.height}`)
      }
    }
  })

  // --- elements ---
  const elementUuids = new Set()
  for (const el of elements) {
    const tag = el.name ?? el.uuid
    if (!el.uuid) errors.push(`element "${tag}" has no uuid`)
    if (elementUuids.has(el.uuid)) errors.push(`duplicate element uuid on "${tag}"`)
    elementUuids.add(el.uuid)

    for (let i = 0; i < 3; i++) {
      if (!(el.to?.[i] >= el.from?.[i])) {
        errors.push(`element "${tag}": to[${i}] (${el.to?.[i]}) < from[${i}] (${el.from?.[i]})`)
      }
    }
    if (el.to && el.from && el.to.every((v, i) => v === el.from[i])) {
      warnings.push(`element "${tag}" is zero-volume`)
    }

    for (const dir of DIRS) {
      const face = el.faces?.[dir]
      if (!face) {
        warnings.push(`element "${tag}" has no ${dir} face`)
        continue
      }
      if (face.texture === null || face.texture === undefined) continue
      if (typeof face.texture === 'number' && !textures[face.texture]) {
        errors.push(`element "${tag}" ${dir} face points at texture ${face.texture}, which does not exist`)
      }
      const uv = face.uv
      if (!Array.isArray(uv) || uv.length !== 4) {
        errors.push(`element "${tag}" ${dir} face uv is not [x1,y1,x2,y2]`)
        continue
      }
      const [x1, y1, x2, y2] = uv
      if (Math.min(x1, x2) < 0 || Math.max(x1, x2) > res.width ||
          Math.min(y1, y2) < 0 || Math.max(y1, y2) > res.height) {
        errors.push(`element "${tag}" ${dir} uv ${JSON.stringify(uv)} falls outside 0,0..${res.width},${res.height}`)
      }
      if (x1 === x2 || y1 === y2) warnings.push(`element "${tag}" ${dir} uv is degenerate (zero width or height)`)
    }

    if (fmt === 'java_block') {
      for (const v of [...(el.from ?? []), ...(el.to ?? [])]) {
        if (v < -16 || v > 32) errors.push(`java_block element "${tag}": coordinate ${v} outside -16..32`)
      }
      const rot = el.rotation ?? [0, 0, 0]
      const spun = rot.filter((r) => r !== 0)
      if (spun.length > 1) {
        errors.push(`java_block element "${tag}" rotates on ${spun.length} axes; the format allows one`)
      }
      for (const r of rot) {
        if (!JAVA_ROT.has(r)) {
          errors.push(`java_block element "${tag}" rotation ${r} is not one of -45,-22.5,0,22.5,45`)
        }
      }
    }
  }

  // --- outliner ---
  const referenced = []
  const groups = []
  walkOutliner(m.outliner ?? [], (g) => groups.push(g), (uuid) => referenced.push(uuid))

  for (const uuid of referenced) {
    if (!elementUuids.has(uuid)) errors.push(`outliner references unknown element uuid ${uuid}`)
  }
  const counts = referenced.reduce((acc, u) => ((acc[u] = (acc[u] ?? 0) + 1), acc), {})
  for (const [uuid, n] of Object.entries(counts)) {
    if (n > 1) errors.push(`element ${uuid} appears ${n} times in the outliner`)
  }
  for (const el of elements) {
    if (!counts[el.uuid]) errors.push(`element "${el.name ?? el.uuid}" is not in the outliner`)
  }

  const groupUuids = new Set(groups.map((g) => g.uuid))

  // --- animations ---
  for (const anim of animations) {
    const label = anim.name ?? anim.uuid
    if (!(anim.length > 0)) errors.push(`animation "${label}" has no positive length`)
    const animators = Object.entries(anim.animators ?? {})
    if (!animators.length) warnings.push(`animation "${label}" has no animators`)

    for (const [boneUuid, animator] of animators) {
      if (!groupUuids.has(boneUuid)) {
        errors.push(`animation "${label}" drives ${boneUuid}, which is not a group in the outliner`)
      }
      const byChannel = {}
      for (const kf of animator.keyframes ?? []) {
        if (kf.time < 0 || kf.time > anim.length + 1e-9) {
          errors.push(`animation "${label}" bone "${animator.name}" keyframe at t=${kf.time} is outside 0..${anim.length}`)
        }
        if (!['rotation', 'position', 'scale'].includes(kf.channel)) {
          errors.push(`animation "${label}" unknown channel "${kf.channel}"`)
        }
        if (!Array.isArray(kf.data_points) || !kf.data_points.length) {
          errors.push(`animation "${label}" bone "${animator.name}" keyframe at t=${kf.time} has no data_points`)
        }
        ;(byChannel[kf.channel] ??= []).push(kf)
      }

      // a looping animation must land back where it started, per channel
      if (anim.loop === 'loop') {
        for (const [channel, kfs] of Object.entries(byChannel)) {
          const sorted = [...kfs].sort((a, b) => a.time - b.time)
          const first = sorted[0]
          const last = sorted[sorted.length - 1]
          if (Math.abs(first.time) > 1e-9) continue
          if (Math.abs(last.time - anim.length) > 1e-9) {
            warnings.push(`"${label}" ${animator.name}/${channel}: last keyframe at t=${last.time}, not the loop point ${anim.length}`)
            continue
          }
          const a = first.data_points[0] ?? {}
          const b = last.data_points[0] ?? {}
          for (const axis of ['x', 'y', 'z']) {
            if (Number(a[axis] ?? 0) !== Number(b[axis] ?? 0)) {
              errors.push(`"${label}" ${animator.name}/${channel}.${axis} does not loop: ${a[axis]} at t=0 vs ${b[axis]} at t=${anim.length}`)
            }
          }
        }
      }
    }
  }

  return {
    file,
    errors,
    warnings,
    stats: {
      format: fmt,
      resolution: `${res.width}x${res.height}`,
      elements: elements.length,
      groups: groups.length,
      textures: textures.length,
      animations: animations.length,
      keyframes: animations.reduce(
        (n, a) => n + Object.values(a.animators ?? {}).reduce((k, an) => k + (an.keyframes?.length ?? 0), 0),
        0,
      ),
    },
  }
}

let bad = 0
for (const file of process.argv.slice(2)) {
  const r = validate(file)
  const head = `${basename(r.file)}`
  console.log(`\n${head}\n${'-'.repeat(head.length)}`)
  console.log(
    Object.entries(r.stats).map(([k, v]) => `${k}: ${v}`).join('  ·  ') || '(no stats)',
  )
  for (const w of r.warnings) console.log(`  warn  ${w}`)
  for (const e of r.errors) console.log(`  FAIL  ${e}`)
  if (!r.errors.length) console.log(`  ok    no structural errors`)
  if (r.errors.length) bad++
}
process.exit(bad ? 1 : 0)
