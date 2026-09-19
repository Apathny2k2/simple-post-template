import { useCallback, useMemo, useRef, useState } from 'react'
import { FACES, samplePose } from '../lib/bbmodel'
import type { Animation, Element, FaceKey, Group, Model, Pose, Vec3 } from '../lib/bbmodel'
import './Model3D.css'
import './BBModelView.css'

/* Faces, in the order a CSS box needs them: each is the plane's own size plus
   the transform that swings it onto the right side of the box. */
const FACE_PLACEMENT: Record<
  FaceKey,
  (w: number, h: number, d: number) => { w: number; h: number; transform: string }
> = {
  south: (w, h, d) => ({ w, h, transform: `translateZ(${d / 2}px)` }),
  north: (w, h, d) => ({ w, h, transform: `rotateY(180deg) translateZ(${d / 2}px)` }),
  east: (w, h, d) => ({ w: d, h, transform: `rotateY(90deg) translateZ(${w / 2}px)` }),
  west: (w, h, d) => ({ w: d, h, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }),
  up: (w, h, d) => ({ w, h: d, transform: `rotateX(90deg) translateZ(${h / 2}px)` }),
  down: (w, h, d) => ({ w, h: d, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }),
}

/**
 * Model space is Y-up and right-handed; CSS is Y-down. Mapping (x,y,z) to
 * (x,-y,z) flips the sense of rotation about X and Z but leaves Y alone,
 * which is where the sign flips below come from.
 */
function transformOf(translate: Vec3, rotation: Vec3, scale: number, scl: Vec3 = [1, 1, 1]) {
  const [x, y, z] = translate
  const [rx, ry, rz] = rotation
  const t = `translate3d(${x * scale}px, ${-y * scale}px, ${z * scale}px)`
  const r = `rotateX(${-rx}deg) rotateY(${ry}deg) rotateZ(${-rz}deg)`
  const s = scl[0] === 1 && scl[1] === 1 && scl[2] === 1 ? '' : ` scale3d(${scl[0]}, ${scl[1]}, ${scl[2]})`
  return `${t} ${r}${s}`
}

function Face({
  face,
  name,
  w,
  h,
  transform,
  model,
  scale,
}: {
  face: { uv: [number, number, number, number]; texture: number | null }
  name: FaceKey
  w: number
  h: number
  transform: string
  model: Model
  scale: number
}) {
  const px = { w: w * scale, h: h * scale }
  const texture = face.texture !== null ? model.textures[face.texture] : null

  const style: React.CSSProperties = {
    width: px.w,
    height: px.h,
    marginLeft: -px.w / 2,
    marginTop: -px.h / 2,
    transform,
  }

  if (texture && texture.source) {
    const [x1, y1, x2, y2] = face.uv
    const uw = Math.abs(x2 - x1) || 1
    const uh = Math.abs(y2 - y1) || 1
    // Scale the sheet so the UV rectangle covers this face exactly, then slide
    // it so the rectangle's corner lands on the face's corner. The sheet is
    // measured in UV space, which is not always the PNG's pixel size.
    const sx = px.w / uw
    const sy = px.h / uh
    style.backgroundImage = `url(${texture.source})`
    style.backgroundSize = `${texture.uvWidth * sx}px ${texture.uvHeight * sy}px`
    style.backgroundPosition = `${-Math.min(x1, x2) * sx}px ${-Math.min(y1, y2) * sy}px`
    style.imageRendering = 'pixelated'
    // A reversed UV coordinate is how Blockbench mirrors a face. Normalising
    // the rectangle to min/max would silently throw that away, so the flip is
    // re-applied to the plane instead.
    const flipX = x2 < x1
    const flipY = y2 < y1
    if (flipX || flipY) {
      style.transform = `${transform} scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
    }
  } else {
    style.background = 'rgba(146, 165, 202, 0.25)'
  }

  return <div className="bbface" data-face={name} style={style} />
}

function ElementBox({
  element,
  parentOrigin,
  model,
  scale,
  selected,
  onSelect,
}: {
  element: Element
  parentOrigin: Vec3
  model: Model
  scale: number
  selected: boolean
  onSelect?: (uuid: string) => void
}) {
  if (!element.visibility) return null

  // the format does not guarantee to > from; a reversed box would render
  // inside-out, so it is clamped here and flagged by the validator instead
  const inf = element.inflate || 0
  const w = Math.max(element.to[0] - element.from[0], 0) + inf * 2
  const h = Math.max(element.to[1] - element.from[1], 0) + inf * 2
  const d = Math.max(element.to[2] - element.from[2], 0) + inf * 2
  const centre: Vec3 = [
    (element.from[0] + element.to[0]) / 2,
    (element.from[1] + element.to[1]) / 2,
    (element.from[2] + element.to[2]) / 2,
  ]

  // the pivot sits at the element's origin; the box hangs off it
  const pivotAt: Vec3 = [
    element.origin[0] - parentOrigin[0],
    element.origin[1] - parentOrigin[1],
    element.origin[2] - parentOrigin[2],
  ]
  const boxAt: Vec3 = [
    centre[0] - element.origin[0],
    centre[1] - element.origin[1],
    centre[2] - element.origin[2],
  ]

  return (
    <div className="bbpivot" style={{ transform: transformOf(pivotAt, element.rotation, scale) }}>
      <div
        className={`bbbox${selected ? ' bbbox--selected' : ''}`}
        style={{ transform: transformOf(boxAt, [0, 0, 0], scale) }}
        onPointerDown={onSelect ? () => onSelect(element.uuid) : undefined}
      >
        {FACES.map((name) => {
          const place = FACE_PLACEMENT[name](w * scale, h * scale, d * scale)
          return (
            <Face
              key={name}
              name={name}
              face={element.faces[name]}
              w={place.w / scale}
              h={place.h / scale}
              transform={place.transform}
              model={model}
              scale={scale}
            />
          )
        })}
      </div>
    </div>
  )
}

function BoneGroup({
  group,
  parentOrigin,
  model,
  scale,
  pose,
  selected,
  onSelect,
}: {
  group: Group
  parentOrigin: Vec3
  model: Model
  scale: number
  pose: Pose
  selected: string | null
  onSelect?: (uuid: string) => void
}) {
  if (!group.visibility) return null

  const animated = pose[group.uuid]
  const at: Vec3 = [
    group.origin[0] - parentOrigin[0] + (animated?.position[0] ?? 0),
    group.origin[1] - parentOrigin[1] + (animated?.position[1] ?? 0),
    group.origin[2] - parentOrigin[2] + (animated?.position[2] ?? 0),
  ]
  const rot: Vec3 = [
    group.rotation[0] + (animated?.rotation[0] ?? 0),
    group.rotation[1] + (animated?.rotation[1] ?? 0),
    group.rotation[2] + (animated?.rotation[2] ?? 0),
  ]

  return (
    <div
      className="bbgroup"
      data-bone={group.name}
      style={{ transform: transformOf(at, rot, scale, animated?.scale ?? [1, 1, 1]) }}
    >
      {group.children.map((child, i) =>
        child.kind === 'group' ? (
          <BoneGroup
            key={child.group.uuid}
            group={child.group}
            parentOrigin={group.origin}
            model={model}
            scale={scale}
            pose={pose}
            selected={selected}
            onSelect={onSelect}
          />
        ) : (
          (() => {
            const el = model.elements.find((e) => e.uuid === child.uuid)
            if (!el) return null
            return (
              <ElementBox
                key={`${child.uuid}-${i}`}
                element={el}
                parentOrigin={group.origin}
                model={model}
                scale={scale}
                selected={selected === el.uuid}
                onSelect={onSelect}
              />
            )
          })()
        ),
      )}
    </div>
  )
}

type Props = {
  model: Model
  /** px per model unit */
  scale?: number
  grid?: boolean
  orbit?: boolean
  spin?: boolean
  initialYaw?: number
  initialPitch?: number
  /** pull the camera back; negative moves away */
  zoom?: number
  animation?: Animation | null
  time?: number
  selected?: string | null
  onSelect?: (uuid: string) => void
  className?: string
}

/**
 * Renders a parsed .bbmodel with CSS 3D transforms: the bone hierarchy becomes
 * nested transformed divs, and each face samples its own UV rectangle out of
 * the texture. No WebGL, no meshes - but the geometry, the pivots and the UVs
 * are the real ones from the file.
 */
export function BBModelView({
  model,
  scale = 6,
  grid = true,
  orbit = true,
  spin = false,
  initialYaw = -32,
  initialPitch = -18,
  zoom = 0,
  animation = null,
  time = 0,
  selected = null,
  onSelect,
  className = '',
}: Props) {
  const [yaw, setYaw] = useState(initialYaw)
  const [pitch, setPitch] = useState(initialPitch)
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)

  const pose = useMemo(() => samplePose(animation, time), [animation, time])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!orbit) return
      drag.current = { x: e.clientX, y: e.clientY, yaw, pitch }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [orbit, yaw, pitch],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = drag.current
    if (!start) return
    setYaw(start.yaw + (e.clientX - start.x) * 0.45)
    setPitch(Math.max(-88, Math.min(88, start.pitch - (e.clientY - start.y) * 0.35)))
  }, [])

  const endDrag = useCallback(() => {
    drag.current = null
  }, [])

  // centre the model on its own bounds rather than on the origin
  const centre = useMemo(() => {
    if (!model.elements.length) return [0, 0, 0] as Vec3
    const lo: Vec3 = [Infinity, Infinity, Infinity]
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const el of model.elements) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], el.from[i])
        hi[i] = Math.max(hi[i], el.to[i])
      }
    }
    return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] as Vec3
  }, [model])

  const stage = spin
    ? undefined
    : `translateZ(${zoom}px) rotateX(${pitch}deg) rotateY(${yaw}deg)`

  return (
    <div
      className={`scene3d${spin ? ' scene3d--spin' : ''} ${className}`}
      style={
        {
          '--pitch': `${pitch}deg`,
          '--yaw': `${yaw}deg`,
          '--zoom': `${zoom}px`,
          cursor: orbit ? 'grab' : undefined,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="scene3d__stage" style={{ transform: stage }}>
        {grid ? (
          <div className="scene3d__grid">
            <div
              className="scene3d__grid-plane"
              style={{
                width: Math.round(16 * scale * 2.6),
                height: Math.round(16 * scale * 2.6),
                ['--cell' as string]: `${scale * 4}px`,
              }}
            />
          </div>
        ) : null}
        <div className="scene3d__origin">
          <div
            className="bbroot"
            style={{
              transform: `translate3d(${-centre[0] * scale}px, ${centre[1] * scale}px, ${-centre[2] * scale}px)`,
            }}
          >
            {model.outliner.map((g) => (
              <BoneGroup
                key={g.uuid}
                group={g}
                parentOrigin={[0, 0, 0]}
                model={model}
                scale={scale}
                pose={pose}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
