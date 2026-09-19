/* ---------------------------------------------------------------
   Blockbench's own save format (.bbmodel), as a typed model.

   The shapes here follow Blockbench 4.x. Two semantics matter more
   than the rest, and both were checked against a reference renderer
   rather than assumed:

   1. An element's `rotation` turns about its `origin`, which is an
      absolute model coordinate - not about the element's centre. So
      a box is hung off a pivot placed at `origin` and offset by
      (centre - origin).
   2. Face UVs are `[x1, y1, x2, y2]` in TEXTURE PIXELS with the
      origin at the top-left, not normalised 0..1. A face's UV
      rectangle does not have to match the face's own proportions;
      when it does not, the texture stretches.
   --------------------------------------------------------------- */

export type Vec3 = [number, number, number]
export type UVRect = [number, number, number, number]

export const FACES = ['north', 'east', 'south', 'west', 'up', 'down'] as const
export type FaceKey = (typeof FACES)[number]

export type Face = {
  uv: UVRect
  /** index into `textures`, or null for an untextured face */
  texture: number | null
  rotation?: 0 | 90 | 180 | 270
}

export type Element = {
  uuid: string
  name: string
  from: Vec3
  to: Vec3
  origin: Vec3
  rotation: Vec3
  faces: Record<FaceKey, Face>
  inflate: number
  boxUv: boolean
  color: number
  visibility: boolean
  locked: boolean
}

export type GroupChild =
  | { kind: 'group'; group: Group }
  | { kind: 'element'; uuid: string }

export type Group = {
  uuid: string
  name: string
  origin: Vec3
  rotation: Vec3
  color: number
  isOpen: boolean
  visibility: boolean
  locked: boolean
  children: GroupChild[]
}

export type Texture = {
  uuid: string
  id: string
  name: string
  width: number
  height: number
  /** data URI */
  source: string
}

export type Channel = 'rotation' | 'position' | 'scale'
export type Interpolation = 'linear' | 'step' | 'catmullrom' | 'bezier'

export type Keyframe = {
  uuid: string
  channel: Channel
  time: number
  value: Vec3
  interpolation: Interpolation
}

export type Animator = {
  boneUuid: string
  name: string
  keyframes: Keyframe[]
}

export type Animation = {
  uuid: string
  name: string
  loop: 'loop' | 'once' | 'hold'
  length: number
  snapping: number
  animators: Animator[]
}

export type Model = {
  name: string
  /** 'free' (Generic Model), 'java_block', 'bedrock', … */
  format: string
  boxUv: boolean
  resolution: { width: number; height: number }
  elements: Element[]
  outliner: Group[]
  textures: Texture[]
  animations: Animation[]
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`

const vec = (v: unknown, dflt: Vec3): Vec3 =>
  Array.isArray(v) && v.length === 3 ? [Number(v[0]), Number(v[1]), Number(v[2])] : dflt

/* ---------------- parse ---------------- */

export function parseBBModel(raw: string | object): Model {
  const src = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, never>
  const j = src as unknown as {
    name?: string
    meta?: { model_format?: string; box_uv?: boolean }
    resolution?: { width?: number; height?: number }
    elements?: unknown[]
    outliner?: unknown[]
    textures?: unknown[]
    animations?: unknown[]
  }

  const resolution = {
    width: j.resolution?.width ?? 16,
    height: j.resolution?.height ?? 16,
  }

  const elements: Element[] = (j.elements ?? [])
    .map((e) => e as Record<string, unknown>)
    // meshes and locators are out of scope; only cubes round-trip
    .filter((e) => (e.type ?? 'cube') === 'cube')
    .map((e) => {
      const rawFaces = (e.faces ?? {}) as Record<string, { uv?: number[]; texture?: unknown; rotation?: number }>
      const faces = {} as Record<FaceKey, Face>
      for (const key of FACES) {
        const f = rawFaces[key]
        faces[key] = {
          uv: (Array.isArray(f?.uv) && f.uv.length === 4 ? f.uv : [0, 0, 0, 0]) as UVRect,
          texture: typeof f?.texture === 'number' ? f.texture : null,
          rotation: (f?.rotation ?? 0) as Face['rotation'],
        }
      }
      return {
        uuid: String(e.uuid ?? uuid()),
        name: String(e.name ?? 'cube'),
        from: vec(e.from, [0, 0, 0]),
        to: vec(e.to, [1, 1, 1]),
        origin: vec(e.origin, [0, 0, 0]),
        rotation: vec(e.rotation, [0, 0, 0]),
        faces,
        inflate: Number(e.inflate ?? 0),
        boxUv: Boolean(e.box_uv ?? j.meta?.box_uv ?? false),
        color: Number(e.color ?? 0),
        visibility: e.visibility !== false,
        locked: Boolean(e.locked),
      }
    })

  const parseGroup = (node: Record<string, unknown>): Group => ({
    uuid: String(node.uuid ?? uuid()),
    name: String(node.name ?? 'group'),
    origin: vec(node.origin, [0, 0, 0]),
    rotation: vec(node.rotation, [0, 0, 0]),
    color: Number(node.color ?? 0),
    isOpen: node.isOpen !== false,
    visibility: node.visibility !== false,
    locked: Boolean(node.locked),
    children: ((node.children ?? []) as unknown[]).map((child) =>
      typeof child === 'string'
        ? { kind: 'element' as const, uuid: child }
        : { kind: 'group' as const, group: parseGroup(child as Record<string, unknown>) },
    ),
  })

  // loose elements at the root are wrapped so the tree always has one shape
  const roots = (j.outliner ?? []) as unknown[]
  const outliner: Group[] = []
  const loose: GroupChild[] = []
  for (const node of roots) {
    if (typeof node === 'string') loose.push({ kind: 'element', uuid: node })
    else outliner.push(parseGroup(node as Record<string, unknown>))
  }
  if (loose.length) {
    outliner.unshift({
      uuid: uuid(),
      name: j.name ?? 'root',
      origin: [0, 0, 0],
      rotation: [0, 0, 0],
      color: 0,
      isOpen: true,
      visibility: true,
      locked: false,
      children: loose,
    })
  }

  const textures: Texture[] = (j.textures ?? []).map((t, i) => {
    const tex = t as Record<string, unknown>
    return {
      uuid: String(tex.uuid ?? uuid()),
      id: String(tex.id ?? i),
      name: String(tex.name ?? `texture_${i}.png`),
      width: Number(tex.width ?? resolution.width),
      height: Number(tex.height ?? resolution.height),
      source: String(tex.source ?? ''),
    }
  })

  const animations: Animation[] = (j.animations ?? []).map((a) => {
    const anim = a as Record<string, unknown>
    const animatorMap = (anim.animators ?? {}) as Record<string, Record<string, unknown>>
    return {
      uuid: String(anim.uuid ?? uuid()),
      name: String(anim.name ?? 'animation'),
      loop: (anim.loop ?? 'loop') as Animation['loop'],
      length: Number(anim.length ?? 1),
      snapping: Number(anim.snapping ?? 24),
      animators: Object.entries(animatorMap).map(([boneUuid, animator]) => ({
        boneUuid,
        name: String(animator.name ?? ''),
        keyframes: ((animator.keyframes ?? []) as Record<string, unknown>[]).map((kf) => {
          const point = ((kf.data_points ?? []) as Record<string, unknown>[])[0] ?? {}
          return {
            uuid: String(kf.uuid ?? uuid()),
            channel: (kf.channel ?? 'rotation') as Channel,
            time: Number(kf.time ?? 0),
            value: [Number(point.x ?? 0), Number(point.y ?? 0), Number(point.z ?? 0)] as Vec3,
            interpolation: (kf.interpolation ?? 'linear') as Interpolation,
          }
        }),
      })),
    }
  })

  return {
    name: String(j.name ?? 'model'),
    format: String(j.meta?.model_format ?? 'free'),
    boxUv: Boolean(j.meta?.box_uv ?? false),
    resolution,
    elements,
    outliner,
    textures,
    animations,
  }
}

/* ---------------- serialize ---------------- */

export function serializeBBModel(model: Model): string {
  const serializeGroup = (g: Group): unknown => ({
    name: g.name,
    origin: g.origin,
    rotation: g.rotation,
    color: g.color,
    uuid: g.uuid,
    export: true,
    isOpen: g.isOpen,
    locked: g.locked,
    visibility: g.visibility,
    autouv: false,
    children: g.children.map((c) => (c.kind === 'element' ? c.uuid : serializeGroup(c.group))),
  })

  return JSON.stringify(
    {
      meta: {
        format_version: '4.5',
        model_format: model.format,
        box_uv: model.boxUv,
      },
      name: model.name,
      model_identifier: '',
      visible_box: [1, 1, 0],
      resolution: model.resolution,
      elements: model.elements.map((e) => ({
        name: e.name,
        box_uv: e.boxUv,
        rescale: false,
        locked: e.locked,
        light_emission: 0,
        render_order: 'default',
        allow_mirror_modeling: true,
        from: e.from,
        to: e.to,
        autouv: 0,
        color: e.color,
        inflate: e.inflate || undefined,
        origin: e.origin,
        rotation: e.rotation,
        uv_offset: [0, 0],
        visibility: e.visibility,
        faces: Object.fromEntries(
          FACES.map((key) => [
            key,
            { uv: e.faces[key].uv, texture: e.faces[key].texture, rotation: e.faces[key].rotation || undefined },
          ]),
        ),
        type: 'cube',
        uuid: e.uuid,
      })),
      outliner: model.outliner.map(serializeGroup),
      textures: model.textures.map((t) => ({
        path: '',
        name: t.name,
        folder: '',
        namespace: '',
        id: t.id,
        width: t.width,
        height: t.height,
        uv_width: model.resolution.width,
        uv_height: model.resolution.height,
        particle: false,
        use_as_default: false,
        layers_enabled: false,
        sync_to_project: '',
        render_mode: 'default',
        render_sides: 'auto',
        frame_time: 1,
        frame_order_type: 'loop',
        frame_order: '',
        frame_interpolate: false,
        visible: true,
        internal: true,
        saved: false,
        uuid: t.uuid,
        relative_path: '',
        source: t.source,
      })),
      animations: model.animations.map((a) => ({
        uuid: a.uuid,
        name: a.name,
        loop: a.loop,
        override: false,
        length: a.length,
        snapping: a.snapping,
        selected: false,
        anim_time_update: '',
        blend_weight: '',
        start_delay: '',
        loop_delay: '',
        animators: Object.fromEntries(
          a.animators.map((an) => [
            an.boneUuid,
            {
              name: an.name,
              type: 'bone',
              keyframes: an.keyframes.map((kf) => ({
                channel: kf.channel,
                data_points: [{ x: kf.value[0], y: kf.value[1], z: kf.value[2] }],
                uuid: kf.uuid,
                time: kf.time,
                color: -1,
                interpolation: kf.interpolation,
                bezier_linked: true,
                bezier_left_time: [-0.1, -0.1, -0.1],
                bezier_left_value: [0, 0, 0],
                bezier_right_time: [0.1, 0.1, 0.1],
                bezier_right_value: [0, 0, 0],
              })),
            },
          ]),
        ),
      })),
    },
    null,
    2,
  )
}

/* ---------------- derived views ---------------- */

/** Blockbench's Element panel shows `from` as Position and `to - from` as Size. */
export const elementSize = (e: Element): Vec3 => [
  e.to[0] - e.from[0],
  e.to[1] - e.from[1],
  e.to[2] - e.from[2],
]

export function setElementSize(e: Element, size: Vec3): Element {
  return { ...e, to: [e.from[0] + size[0], e.from[1] + size[1], e.from[2] + size[2]] }
}

export function setElementPosition(e: Element, from: Vec3): Element {
  const size = elementSize(e)
  return { ...e, from, to: [from[0] + size[0], from[1] + size[1], from[2] + size[2]] }
}

export function findElement(model: Model, uuid: string) {
  return model.elements.find((e) => e.uuid === uuid) ?? null
}

export function findGroup(model: Model, uuid: string): Group | null {
  const walk = (groups: Group[]): Group | null => {
    for (const g of groups) {
      if (g.uuid === uuid) return g
      const nested = walk(g.children.filter((c) => c.kind === 'group').map((c) => (c as { group: Group }).group))
      if (nested) return nested
    }
    return null
  }
  return walk(model.outliner)
}

export type FlatNode =
  | { kind: 'group'; depth: number; group: Group }
  | { kind: 'element'; depth: number; element: Element }

/** The outliner, flattened for list rendering. Collapsed groups hide their subtree. */
export function flattenOutliner(model: Model, collapsed: ReadonlySet<string> = new Set()): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (groups: Group[], depth: number) => {
    for (const g of groups) {
      out.push({ kind: 'group', depth, group: g })
      if (collapsed.has(g.uuid)) continue
      for (const child of g.children) {
        if (child.kind === 'group') walk([child.group], depth + 1)
        else {
          const el = findElement(model, child.uuid)
          if (el) out.push({ kind: 'element', depth: depth + 1, element: el })
        }
      }
    }
  }
  walk(model.outliner, 0)
  return out
}

/* ---------------- animation sampling ---------------- */

const DEFAULTS: Record<Channel, Vec3> = {
  rotation: [0, 0, 0],
  position: [0, 0, 0],
  scale: [1, 1, 1],
}

/** Value of one channel at time `t`, honouring step vs interpolated keyframes. */
export function sampleChannel(keyframes: Keyframe[], channel: Channel, t: number): Vec3 {
  const kfs = keyframes.filter((k) => k.channel === channel).sort((a, b) => a.time - b.time)
  if (!kfs.length) return DEFAULTS[channel]
  if (t <= kfs[0].time) return kfs[0].value
  const last = kfs[kfs.length - 1]
  if (t >= last.time) return last.value

  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]
    const b = kfs[i + 1]
    if (t < a.time || t > b.time) continue
    if (a.interpolation === 'step') return a.value
    const k = (t - a.time) / (b.time - a.time || 1)
    return [
      a.value[0] + (b.value[0] - a.value[0]) * k,
      a.value[1] + (b.value[1] - a.value[1]) * k,
      a.value[2] + (b.value[2] - a.value[2]) * k,
    ]
  }
  return last.value
}

export type Pose = Record<string, { rotation: Vec3; position: Vec3; scale: Vec3 }>

/** Every animated bone's transform at time `t`. Bones with no animator are absent. */
export function samplePose(animation: Animation | null, t: number): Pose {
  if (!animation) return {}
  const pose: Pose = {}
  for (const animator of animation.animators) {
    pose[animator.boneUuid] = {
      rotation: sampleChannel(animator.keyframes, 'rotation', t),
      position: sampleChannel(animator.keyframes, 'position', t),
      scale: sampleChannel(animator.keyframes, 'scale', t),
    }
  }
  return pose
}

/* ---------------- validation ---------------- */

export type Issue = { level: 'error' | 'warning'; message: string }

const JAVA_ROTATIONS = new Set([-45, -22.5, 0, 22.5, 45])

/**
 * The checks Blockbench itself enforces, so the editor can refuse to write a
 * file the real app would reject. `java_block` is the strict one: its limits
 * mirror what Minecraft's own Java block model format allows.
 */
export function validateModel(model: Model): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  for (const el of model.elements) {
    const tag = el.name || el.uuid
    if (seen.has(el.uuid)) issues.push({ level: 'error', message: `Duplicate element uuid on "${tag}"` })
    seen.add(el.uuid)

    for (let i = 0; i < 3; i++) {
      if (el.to[i] < el.from[i]) {
        issues.push({ level: 'error', message: `"${tag}": to[${i}] is behind from[${i}]` })
      }
    }

    for (const key of FACES) {
      const { uv, texture } = el.faces[key]
      if (texture !== null && !model.textures[texture]) {
        issues.push({ level: 'error', message: `"${tag}" ${key} face points at a texture that does not exist` })
      }
      const [x1, y1, x2, y2] = uv
      if (
        Math.min(x1, x2) < 0 ||
        Math.max(x1, x2) > model.resolution.width ||
        Math.min(y1, y2) < 0 ||
        Math.max(y1, y2) > model.resolution.height
      ) {
        issues.push({ level: 'warning', message: `"${tag}" ${key} UV falls outside the texture` })
      }
    }

    if (model.format === 'java_block') {
      for (const v of [...el.from, ...el.to]) {
        if (v < -16 || v > 32) {
          issues.push({ level: 'error', message: `"${tag}": ${v} is outside the Java block range of -16..32` })
        }
      }
      const spun = el.rotation.filter((r) => r !== 0)
      if (spun.length > 1) {
        issues.push({ level: 'error', message: `"${tag}" rotates on ${spun.length} axes; Java blocks allow one` })
      }
      for (const r of el.rotation) {
        if (!JAVA_ROTATIONS.has(r)) {
          issues.push({ level: 'error', message: `"${tag}" rotation ${r}° is not one of -45, -22.5, 0, 22.5, 45` })
        }
      }
    }
  }

  const referenced = new Map<string, number>()
  const walk = (groups: Group[]) => {
    for (const g of groups) {
      for (const child of g.children) {
        if (child.kind === 'element') referenced.set(child.uuid, (referenced.get(child.uuid) ?? 0) + 1)
        else walk([child.group])
      }
    }
  }
  walk(model.outliner)

  for (const [uuid, n] of referenced) {
    if (!model.elements.some((e) => e.uuid === uuid)) {
      issues.push({ level: 'error', message: `The outliner references an element that does not exist` })
    }
    if (n > 1) issues.push({ level: 'error', message: `An element appears ${n} times in the outliner` })
  }
  for (const el of model.elements) {
    if (!referenced.has(el.uuid)) {
      issues.push({ level: 'warning', message: `"${el.name}" is not in the outliner` })
    }
  }

  for (const anim of model.animations) {
    for (const animator of anim.animators) {
      if (!findGroup(model, animator.boneUuid)) {
        issues.push({ level: 'error', message: `"${anim.name}" drives a bone that is not in the outliner` })
      }
      for (const kf of animator.keyframes) {
        if (kf.time < 0 || kf.time > anim.length + 1e-9) {
          issues.push({
            level: 'error',
            message: `"${anim.name}" has a keyframe at ${kf.time}s, outside its ${anim.length}s length`,
          })
        }
      }
      if (anim.loop === 'loop') {
        for (const channel of ['rotation', 'position', 'scale'] as Channel[]) {
          const kfs = animator.keyframes.filter((k) => k.channel === channel)
          if (kfs.length < 2) continue
          const start = sampleChannel(kfs, channel, 0)
          const end = sampleChannel(kfs, channel, anim.length)
          if (start.some((v, i) => Math.abs(v - end[i]) > 1e-9)) {
            issues.push({
              level: 'warning',
              message: `"${anim.name}" ${animator.name}/${channel} does not return to its start pose, so the loop will jump`,
            })
          }
        }
      }
    }
  }

  return issues
}
