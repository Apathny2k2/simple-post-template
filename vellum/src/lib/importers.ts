/* Bringing models in from other tools. Each importer builds an ordinary
   in-memory model, so once it is open it is a .vellum like any other and
   saves as one. What a format holds that Vellum has no place for is
   listed in `notes`, so nothing is dropped without saying so. */

import { FACES } from './model'
import type { Bone, Cube, Face, FaceKey, ProjectKind, Texture, UVRect, Vec3 } from './model'
import type { Imported } from './bbmodel'
import { newId } from './new-model'

export type { Imported } from './bbmodel'
export { fromBbmodel, isBbmodel, toBbmodel } from './bbmodel'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}
const vec = (v: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 => {
  const a = arr(v)
  return a.length >= 3 ? [num(a[0], fallback[0]), num(a[1], fallback[1]), num(a[2], fallback[2])] : fallback
}
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

/** Whether text is a Java Edition block or item model. */
export function isJavaModel(text: string): boolean {
  try {
    const j = JSON.parse(text)
    return !!j && typeof j === 'object' && !j.meta && !j.vellum && (Array.isArray(j.elements) || typeof j.parent === 'string')
  } catch {
    return false
  }
}

/* ---------------- Java Edition JSON ---------------- */

const AXIS_INDEX: Record<string, number> = { x: 0, y: 1, z: 2 }

/**
 * A Java block or item model. Its UVs are in a 16-unit square whatever the
 * image's size, so the sheet is 16 by 16. Texture variables become blank
 * textures named after their paths; importing a PNG of the same name on
 * the Textures panel fills one in.
 */
export function fromJavaModel(text: string, fileName = 'model.json'): Imported {
  const j = JSON.parse(text) as Json
  const notes: string[] = []
  const elements = arr(j.elements)
  if (!elements.length) {
    throw new Error(`${fileName} has no elements of its own${typeof j.parent === 'string' ? `; it inherits them from "${j.parent}"` : ''}, so there is nothing to open.`)
  }
  const texVars = obj(j.textures)
  const textures: Texture[] = []
  const varTex = new Map<string, string>()
  const blank = (name: string): Texture => {
    const t: Texture = { id: newId(), name, width: 16, height: 16, uvWidth: 16, uvHeight: 16, source: '' }
    textures.push(t)
    return t
  }
  for (const [key, value] of Object.entries(texVars)) {
    if (key === 'particle') continue
    const path = str(value)
    if (path.startsWith('#')) continue
    const t = blank((path.split('/').pop() || key) + '.png')
    varTex.set(`#${key}`, t.id)
  }
  // a variable that points at another, as "#all": "#side", resolves through it
  for (const [key, value] of Object.entries(texVars)) {
    const path = str(value)
    if (path.startsWith('#') && varTex.has(path)) varTex.set(`#${key}`, varTex.get(path)!)
  }
  const cubes: Cube[] = elements.map((raw, i) => {
    const e = obj(raw)
    const from = vec(e.from)
    const to = vec(e.to)
    const r = obj(e.rotation)
    const rotation: Vec3 = [0, 0, 0]
    if (r.axis !== undefined) rotation[AXIS_INDEX[str(r.axis)] ?? 1] = num(r.angle)
    if (r.rescale === true) notes.push(`Element ${i + 1} uses "rescale", which Vellum does not apply.`)
    const facesRaw = obj(e.faces)
    const faces = {} as Record<FaceKey, Face>
    for (const k of FACES) {
      const f = facesRaw[k]
      if (f === undefined) {
        faces[k] = { uv: [0, 0, 0, 0], texture: null }
        continue
      }
      const face = obj(f)
      const uv = arr(face.uv)
      const rot = num(face.rotation, 0)
      faces[k] = {
        uv: (uv.length === 4 ? uv.map((v) => num(v)) : defaultUv(k, from, to)) as UVRect,
        texture: varTex.get(str(face.texture)) ?? textures[0]?.id ?? null,
        ...(rot === 90 || rot === 180 || rot === 270 ? { rotation: rot as 90 | 180 | 270 } : {}),
      }
    }
    return {
      id: newId(),
      name: str(e.name, `element_${i + 1}`),
      from,
      to,
      origin: vec(r.origin, [8, 8, 8]),
      rotation,
      faces,
      inflate: 0,
      boxUv: false,
      visible: true,
      locked: false,
    }
  })
  if (textures.length) notes.push(`The textures are blank: a Java model names its images by path. Import the PNGs on the Textures panel. A PNG with the same file name fills in its texture.`)
  const block = typeof j.parent === 'string' && /block\//.test(j.parent)
  const kind: ProjectKind = block ? 'blocks' : 'items'
  const root: Bone = { id: newId(), name: 'root', origin: [8, 0, 8], rotation: [0, 0, 0], visible: true, locked: false, children: cubes.map((c) => ({ kind: 'cube' as const, id: c.id })) }
  return {
    model: { name: fileName.replace(/\.json$/i, ''), kind, resolution: { width: 16, height: 16 }, bones: [root], cubes, textures, clips: [] },
    kind,
    notes,
  }
}

/** The UV a Java face gets when it names none: the element's own outline on that side. */
function defaultUv(k: FaceKey, from: Vec3, to: Vec3): UVRect {
  switch (k) {
    case 'up':
    case 'down':
      return [from[0], from[2], to[0], to[2]]
    case 'north':
    case 'south':
      return [from[0], 16 - to[1], to[0], 16 - from[1]]
    default:
      return [from[2], 16 - to[1], to[2], 16 - from[1]]
  }
}
