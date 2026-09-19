import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Menu } from '../components/Menu'
import type { MenuEntry } from '../components/Menu'
import { BBModelView } from '../components/BBModelView'
import { Icon, VellumMark } from '../lib/icons'
import type { IconName } from '../lib/icons'
import {
  FACES,
  elementSize,
  flattenOutliner,
  parseBBModel,
  serializeBBModel,
  setElementPosition,
  setElementSize,
  validateModel,
} from '../lib/bbmodel'
import type {
  Animation,
  Element as BBElement,
  FaceKey,
  Group,
  Model,
  UVRect,
  Vec3,
} from '../lib/bbmodel'
import { isVellum, readVellum, vellumFileName, writeVellum } from '../lib/vellum'
import type { ProjectKind } from '../lib/bbmodel'
import { sampleById, samples } from '../lib/samples'
import { addBone, addCube, createModel, deleteElement, duplicateElement } from '../lib/new-model'
import type { NewModelKind } from '../lib/new-model'
import {
  bucket,
  faceBounds,
  hexToRgba,
  loadSurface,
  paint as paintTexels,
  pick,
  rgbaToHex,
  strokeBetween,
  texelOfFace,
  toDataUrl,
} from '../lib/texture'
import type { PixelSurface } from '../lib/texture'
import { DEFAULT_DISPLAY, DisplayPanel } from './editor/DisplayPanel'
import type { DisplayState, SlotId } from './editor/DisplayPanel'
import { NewModelDialog } from './editor/NewModelDialog'
import { navigate } from '../lib/router'
import './Editor.css'

type Mode = 'edit' | 'paint' | 'animate' | 'display'

/* ================= menu bar ================= */

function buildMenus(actions: {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onExport: () => void
  onSample: (id: string) => void
  onAddCube: () => void
  onAddBone: () => void
  onDuplicate: () => void
  onDelete: () => void
}): Array<{ label: string; entries: MenuEntry[] }> {
  return [
    {
      label: 'File',
      entries: [
        { label: 'New model\u2026', icon: 'plus', shortcut: 'Ctrl N', onSelect: actions.onNew },
        { kind: 'separator' },
        { kind: 'label', label: 'Sample models' },
        ...samples.map((s) => ({
          label: s.label,
          icon: 'cube' as const,
          onSelect: () => actions.onSample(s.id),
        })),
        { kind: 'separator' },
        { label: 'Open model\u2026', icon: 'folder', shortcut: 'Ctrl O', onSelect: actions.onOpen },
        { label: 'Save .vellum', icon: 'save', shortcut: 'Ctrl S', onSelect: actions.onSave },
        { label: 'Export .bbmodel', icon: 'download', shortcut: 'Ctrl E', onSelect: actions.onExport },
      ],
    },
    {
      label: 'Edit',
      entries: [
        { label: 'Add Cube', icon: 'cube', onSelect: actions.onAddCube },
        { label: 'Add Bone', icon: 'folder', onSelect: actions.onAddBone },
        { kind: 'separator' },
        { label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl D', onSelect: actions.onDuplicate },
        { label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, onSelect: actions.onDelete },
      ],
    },
    {
      label: 'Transform',
      entries: [
        { label: 'Move', icon: 'move' },
        { label: 'Resize', icon: 'resize' },
        { label: 'Rotate', icon: 'rotate' },
        { kind: 'separator' },
        { label: 'Centre Pivot', icon: 'pivot' },
      ],
    },
    {
      label: 'Filter',
      entries: [
        { kind: 'label', label: 'Geometry' },
        { label: 'Sort Outliner', icon: 'layers' },
        { label: 'Validate Model', icon: 'check' },
      ],
    },
    {
      label: 'View',
      entries: [
        { label: 'Quad View', icon: 'grid', shortcut: 'Ctrl 4' },
        { label: 'Toggle Grid', icon: 'grid', shortcut: 'G' },
        { kind: 'separator' },
        { label: 'Screenshot Model', icon: 'camera' },
      ],
    },
    {
      label: 'Help',
      entries: [
        { label: 'Documentation', icon: 'book' },
        { label: 'Report a Bug', icon: 'bug', onSelect: () => navigate('/settings/report-a-bug') },
        { label: 'About Vellum', icon: 'info', onSelect: () => navigate('/settings/about') },
      ],
    },
  ]
}

function MenuBar({
  fileName,
  actions,
}: {
  fileName: string
  actions: Parameters<typeof buildMenus>[0]
}) {
  const menus = useMemo(() => buildMenus(actions), [actions])
  return (
    <div className="ed-menubar">
      <span className="ed-menubar__mark">
        <VellumMark size={15} />
      </span>
      {menus.map((m) => (
        <Menu
          key={m.label}
          align="start"
          entries={m.entries}
          trigger={({ toggle, open, id }) => (
            <button className="ed-menubar__btn" id={id} aria-expanded={open} onClick={toggle}>
              {m.label}
            </button>
          )}
        />
      ))}
      <div className="ed-menubar__title">
        <span className="ed-menubar__dirty">●</span>
        {fileName}
      </div>
    </div>
  )
}

/* ================= toolbar ================= */

const toolsets: Record<Mode, Array<{ id: string; icon: IconName; label: string }>> = {
  edit: [
    { id: 'move', icon: 'move', label: 'Move' },
    { id: 'resize', icon: 'resize', label: 'Resize' },
    { id: 'rotate', icon: 'rotate', label: 'Rotate' },
    { id: 'pivot', icon: 'pivot', label: 'Pivot Tool' },
    { id: 'vertex', icon: 'vertex', label: 'Vertex Snap' },
    { id: 'knife', icon: 'knife', label: 'Knife' },
  ],
  paint: [
    { id: 'brush', icon: 'brush', label: 'Brush' },
    { id: 'eraser', icon: 'eraser', label: 'Eraser' },
    { id: 'bucket', icon: 'bucket', label: 'Paint Bucket' },
    { id: 'pipette', icon: 'pipette', label: 'Colour Picker' },
    { id: 'shape', icon: 'shape', label: 'Draw Shape' },
  ],
  animate: [
    { id: 'move', icon: 'move', label: 'Move' },
    { id: 'resize', icon: 'resize', label: 'Resize' },
    { id: 'rotate', icon: 'rotate', label: 'Rotate' },
    { id: 'pivot', icon: 'pivot', label: 'Pivot Tool' },
  ],
  display: [
    { id: 'move', icon: 'move', label: 'Move' },
    { id: 'resize', icon: 'resize', label: 'Resize' },
    { id: 'rotate', icon: 'rotate', label: 'Rotate' },
  ],
}

const modes: Array<{ id: Mode; label: string }> = [
  { id: 'edit', label: 'Edit' },
  { id: 'paint', label: 'Paint' },
  { id: 'animate', label: 'Animate' },
  { id: 'display', label: 'Display' },
]

function Toolbar({
  mode,
  onMode,
  tool,
  onTool,
  grid,
  onGrid,
  quad,
  onQuad,
  hasAnimations,
  onAddCube,
  onAddBone,
  brush,
  onBrush,
}: {
  mode: Mode
  onMode: (m: Mode) => void
  tool: string
  onTool: (t: string) => void
  grid: boolean
  onGrid: () => void
  quad: boolean
  onQuad: () => void
  hasAnimations: boolean
  onAddCube: () => void
  onAddBone: () => void
  brush: number
  onBrush: (n: number) => void
}) {
  return (
    <div className="ed-toolbar">
      <div className="ed-modes" role="group" aria-label="Editor mode">
        {modes.map((m) => (
          <button
            key={m.id}
            className="ed-mode"
            aria-pressed={m.id === mode}
            // Blockbench greys out Animate when the format carries no animations
            disabled={m.id === 'animate' && !hasAnimations}
            title={m.id === 'animate' && !hasAnimations ? 'This model has no animations' : undefined}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <span className="ed-sep" />

      <div className="ed-tools" role="group" aria-label="Tools">
        {toolsets[mode].map((t) => (
          <button
            key={t.id}
            className="ed-tool"
            title={t.label}
            aria-label={t.label}
            aria-pressed={t.id === tool}
            onClick={() => onTool(t.id)}
          >
            <Icon name={t.icon} size={15} />
          </button>
        ))}
      </div>

      <span className="ed-sep" />

      <div className="ed-tools">
        <button className="ed-tool" title="Add Cube" aria-label="Add Cube" onClick={onAddCube}>
          <Icon name="cube" size={15} />
        </button>
        <button className="ed-tool" title="Add Bone" aria-label="Add Bone" onClick={onAddBone}>
          <Icon name="folder" size={15} />
        </button>
      </div>

      <span className="ed-sep" />

      {mode === 'paint' ? (
        <label className="ed-brush">
          <span>Brush</span>
          <input
            type="range"
            min={1}
            max={8}
            value={brush}
            onChange={(e) => onBrush(Number(e.target.value))}
            aria-label="Brush size"
          />
          <span className="mono">{brush}px</span>
        </label>
      ) : (
        <select className="ed-select" defaultValue="global" aria-label="Transform space">
          <option value="global">Global</option>
          <option value="bone">Bone</option>
          <option value="local">Local</option>
        </select>
      )}

      <div className="ed-toolbar__right">
        <button className="ed-tool" title="Toggle grid" aria-pressed={grid} onClick={onGrid}>
          <Icon name="grid" size={15} />
        </button>
        <button className="ed-tool" title="Quad view" aria-pressed={quad} onClick={onQuad}>
          <Icon name="layers" size={15} />
        </button>
        <button className="ed-tool" title="Magnet snap" aria-pressed={false}>
          <Icon name="magnet" size={15} />
        </button>
        <button className="ed-tool" title="Screenshot">
          <Icon name="camera" size={15} />
        </button>
      </div>
    </div>
  )
}

/* ================= panel shell ================= */

function Panel({
  title,
  count,
  children,
  grow,
  defaultOpen = true,
}: {
  title: string
  count?: ReactNode
  children: ReactNode
  grow?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`panel${grow && open ? ' panel--grow' : ''}`} data-open={open}>
      <button className="panel__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="chevronDown" size={12} className="panel__chev" />
        <span className="panel__title">{title}</span>
        {count !== undefined ? <span className="panel__count">{count}</span> : null}
      </button>
      {open ? <div className="panel__body">{children}</div> : null}
    </section>
  )
}

/* ================= numeric fields ================= */

function NumField({
  axis,
  value,
  onChange,
  step = 1,
  disabled,
}: {
  axis: 'x' | 'y' | 'z' | 'n'
  value: number
  onChange: (v: number) => void
  step?: number
  disabled?: boolean
}) {
  const drag = useRef<{ x: number; start: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="nf" data-disabled={disabled || undefined}>
      <span
        className={`nf__axis nf__axis--${axis}`}
        title="Drag to scrub"
        onPointerDown={(e) => {
          if (disabled) return
          drag.current = { x: e.clientX, start: value }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          onChange(Number((d.start + Math.round((e.clientX - d.x) / 3) * step).toFixed(2)))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        {axis === 'n' ? '#' : axis.toUpperCase()}
      </span>
      <input
        className="nf__input"
        value={draft ?? String(value)}
        inputMode="decimal"
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const next = Number(draft)
            if (Number.isFinite(next)) onChange(next)
            setDraft(null)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(null)
        }}
      />
    </div>
  )
}

function NumRow({
  label,
  value,
  onChange,
  step,
  disabled,
}: {
  label: string
  value: Vec3
  onChange: (v: Vec3) => void
  step?: number
  disabled?: boolean
}) {
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z']
  return (
    <div className="nf-row">
      <span className="nf-row__label">{label}</span>
      {axes.map((a, i) => (
        <NumField
          key={a}
          axis={a}
          step={step}
          disabled={disabled}
          value={value[i]}
          onChange={(v) => {
            const next = [...value] as Vec3
            next[i] = v
            onChange(next)
          }}
        />
      ))}
    </div>
  )
}

/* ================= element panel ================= */

function ElementPanel({
  element,
  format,
  onChange,
}: {
  element: BBElement | null
  format: string
  onChange: (fn: (e: BBElement) => BBElement) => void
}) {
  if (!element) {
    return <p className="ed-hint">Select a cube in the outliner to edit it.</p>
  }

  const size = elementSize(element)
  // Java block models only accept one rotated axis, at fixed angles
  const javaLocked = format === 'java_block'

  return (
    <>
      <div className="nf-grid">
        <NumRow
          label="Position"
          value={element.from}
          onChange={(from) => onChange((e) => setElementPosition(e, from))}
        />
        <NumRow label="Size" value={size} onChange={(s) => onChange((e) => setElementSize(e, s))} />
        <NumRow
          label="Pivot"
          value={element.origin}
          onChange={(origin) => onChange((e) => ({ ...e, origin }))}
        />
        <NumRow
          label="Rotation"
          value={element.rotation}
          step={javaLocked ? 22.5 : 2.5}
          onChange={(rotation) => onChange((e) => ({ ...e, rotation }))}
        />
        <div className="nf-row">
          <span className="nf-row__label">Inflate</span>
          <NumField
            axis="n"
            value={element.inflate}
            onChange={(inflate) => onChange((e) => ({ ...e, inflate }))}
          />
          <span className="nf-row__label" style={{ textAlign: 'right' }}>
            Faces
          </span>
          <NumField
            axis="n"
            value={FACES.filter((f) => element.faces[f].texture !== null).length}
            onChange={() => {}}
            disabled
          />
        </div>
      </div>

      {javaLocked ? (
        <p className="ed-hint ed-hint--warn">
          <Icon name="warning" size={11} /> Java blocks rotate on one axis only, at ±22.5° or ±45°.
        </p>
      ) : null}

      <div className="chip-row">
        <button
          className="chip"
          aria-pressed={element.visibility}
          onClick={() => onChange((e) => ({ ...e, visibility: !e.visibility }))}
        >
          <Icon name={element.visibility ? 'eye' : 'eyeOff'} size={11} /> Visible
        </button>
        <button
          className="chip"
          aria-pressed={element.locked}
          onClick={() => onChange((e) => ({ ...e, locked: !e.locked }))}
        >
          <Icon name="lock" size={11} /> Locked
        </button>
        <button
          className="chip"
          onClick={() =>
            onChange((e) => ({
              ...e,
              origin: [
                (e.from[0] + e.to[0]) / 2,
                (e.from[1] + e.to[1]) / 2,
                (e.from[2] + e.to[2]) / 2,
              ] as Vec3,
            }))
          }
        >
          <Icon name="pivot" size={11} /> Centre pivot
        </button>
      </div>
    </>
  )
}

/* ================= UV ================= */

function UVPanel({
  model,
  element,
  face,
  onFace,
  onChange,
  onPaint,
}: {
  model: Model
  element: BBElement | null
  face: FaceKey
  onFace: (f: FaceKey) => void
  onChange: (fn: (e: BBElement) => BBElement) => void
  /** texel coordinates straight off the sheet, when paint mode is active */
  onPaint?: (x: number, y: number, phase: 'down' | 'move') => void
}) {
  const texture = model.textures[0]
  const { width, height } = model.resolution

  if (!element) return <p className="ed-hint">No cube selected.</p>

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const current = element.faces[face]

  return (
    <>
      <div
        className={`uv${onPaint ? ' uv--paint' : ''}`}
        onPointerDown={
          onPaint
            ? (e) => {
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                const r = e.currentTarget.getBoundingClientRect()
                onPaint(
                  Math.floor(((e.clientX - r.left) / r.width) * width),
                  Math.floor(((e.clientY - r.top) / r.height) * height),
                  'down',
                )
              }
            : undefined
        }
        onPointerMove={
          onPaint
            ? (e) => {
                if (e.buttons !== 1) return
                const r = e.currentTarget.getBoundingClientRect()
                onPaint(
                  Math.floor(((e.clientX - r.left) / r.width) * width),
                  Math.floor(((e.clientY - r.top) / r.height) * height),
                  'move',
                )
              }
            : undefined
        }
        style={
          texture?.source
            ? {
                backgroundImage: `url(${texture.source})`,
                backgroundSize: '100% 100%',
                imageRendering: 'pixelated',
              }
            : undefined
        }
      >
        {FACES.map((key) => {
          const [x1, y1, x2, y2] = element.faces[key].uv
          const left = Math.min(x1, x2)
          const top = Math.min(y1, y2)
          const w = Math.abs(x2 - x1)
          const h = Math.abs(y2 - y1)
          if (!w || !h) return null
          return (
            <button
              key={key}
              className={`uv__face${key === face ? ' uv__face--active' : ''}`}
              style={{
                left: pct(left, width),
                top: pct(top, height),
                width: pct(w, width),
                height: pct(h, height),
                pointerEvents: onPaint ? 'none' : undefined,
              }}
              onClick={() => onFace(key)}
              title={`${key} · ${x1},${y1} → ${x2},${y2}`}
            >
              {key[0].toUpperCase()}
            </button>
          )
        })}
        <span className="uv__ruler" style={{ left: 4, bottom: 3 }}>
          0,0
        </span>
        <span className="uv__ruler" style={{ right: 4, bottom: 3 }}>
          {width},{height}
        </span>
      </div>

      <div className="uv-faces">
        {FACES.map((key) => (
          <button
            key={key}
            className="chip"
            aria-pressed={key === face}
            onClick={() => onFace(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="nf-grid" style={{ marginTop: 9 }}>
        <div className="nf-row">
          <span className="nf-row__label">UV from</span>
          <NumField
            axis="x"
            value={current.uv[0]}
            onChange={(v) => onChange((e) => patchUV(e, face, 0, v))}
          />
          <NumField
            axis="y"
            value={current.uv[1]}
            onChange={(v) => onChange((e) => patchUV(e, face, 1, v))}
          />
          <span className="nf-row__label" />
        </div>
        <div className="nf-row">
          <span className="nf-row__label">UV to</span>
          <NumField
            axis="x"
            value={current.uv[2]}
            onChange={(v) => onChange((e) => patchUV(e, face, 2, v))}
          />
          <NumField
            axis="y"
            value={current.uv[3]}
            onChange={(v) => onChange((e) => patchUV(e, face, 3, v))}
          />
          <span className="nf-row__label" />
        </div>
      </div>
    </>
  )
}

function patchUV(e: BBElement, face: FaceKey, index: number, value: number): BBElement {
  const uv = [...e.faces[face].uv] as UVRect
  uv[index] = value
  return { ...e, faces: { ...e.faces, [face]: { ...e.faces[face], uv } } }
}

/* ================= colour ================= */

function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    const x = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(5)}${f(3)}${f(1)}`
}

function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max ? d / max : 0, max]
}

function ColorPanel({ colour, onColour }: { colour: string; onColour: (hex: string) => void }) {
  const [hue, setHue] = useState(() => hexToHsv(colour)[0])
  const [sat, setSat] = useState(() => hexToHsv(colour)[1])
  const [val, setVal] = useState(() => hexToHsv(colour)[2])

  // the eyedropper writes the parent's colour; the picker follows it
  const external = useRef(colour)
  useEffect(() => {
    if (colour === external.current) return
    external.current = colour
    const [h, s2, v] = hexToHsv(colour)
    setHue(h)
    setSat(s2)
    setVal(v)
  }, [colour])

  const emit = (h: number, s2: number, v: number) => {
    const hex = hsvToHex(h, s2, v)
    external.current = hex
    onColour(hex)
  }

  const pickSV = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return
    const r = e.currentTarget.getBoundingClientRect()
    const s2 = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setSat(s2)
    setVal(v)
    emit(hue, s2, v)
  }

  return (
    <>
      <div
        className="color-sv"
        onPointerDown={pickSV}
        onPointerMove={pickSV}
        style={{ background: `hsl(${hue} 100% 50%)` }}
      >
        <div className="color-sv__layer" style={{ background: 'linear-gradient(90deg, #fff, transparent)' }} />
        <div className="color-sv__layer" style={{ background: 'linear-gradient(0deg, #000, transparent)' }} />
        <span className="color-dot" style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }} />
      </div>

      <div
        className="color-hue"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const h = Math.round(((e.clientX - r.left) / r.width) * 360)
          setHue(h)
          emit(h, sat, val)
        }}
      >
        <span className="color-hue__knob" style={{ left: `${(hue / 360) * 100}%` }} />
      </div>

      <div className="color-foot">
        <span className="color-swatch" style={{ background: colour }} />
        <input className="color-hex" value={colour.toUpperCase()} readOnly />
      </div>

      <div className="palette">
        {['#cd594e', '#b4403a', '#952f2e', '#eda99a', '#92a5ca', '#3d5287', '#2b3d69', '#0a1022',
          '#e3a96f', '#6fae84', '#6f7684', '#f1e8d6'].map((c) => (
          <button
            key={c}
            className="palette__dot"
            style={{ background: c }}
            title={c}
            onClick={() => {
              const [h, s2, v] = hexToHsv(c)
              setHue(h)
              setSat(s2)
              setVal(v)
              external.current = c
              onColour(c)
            }}
          />
        ))}
      </div>
    </>
  )
}

/* ================= outliner ================= */

function Outliner({
  model,
  selected,
  collapsed,
  onSelect,
  onToggleGroup,
  onModel,
}: {
  model: Model
  selected: string | null
  collapsed: Set<string>
  onSelect: (uuid: string) => void
  onToggleGroup: (uuid: string) => void
  onModel: (fn: (m: Model) => Model) => void
}) {
  const rows = useMemo(() => flattenOutliner(model, collapsed), [model, collapsed])

  const setGroup = (uuid: string, patch: Partial<Group>) =>
    onModel((m) => {
      const walk = (groups: Group[]): Group[] =>
        groups.map((g) => ({
          ...(g.uuid === uuid ? { ...g, ...patch } : g),
          children: g.children.map((c) =>
            c.kind === 'group' ? { kind: 'group' as const, group: walk([c.group])[0] } : c,
          ),
        }))
      return { ...m, outliner: walk(m.outliner) }
    })

  const setElement = (uuid: string, patch: Partial<BBElement>) =>
    onModel((m) => ({
      ...m,
      elements: m.elements.map((e) => (e.uuid === uuid ? { ...e, ...patch } : e)),
    }))

  return (
    <div className="tree" role="tree">
      {rows.map((row) => {
        const isGroup = row.kind === 'group'
        const node = isGroup ? row.group : row.element
        const visible = node.visibility
        const locked = node.locked
        return (
          <div
            key={node.uuid}
            role="treeitem"
            aria-selected={!isGroup && node.uuid === selected}
            data-hidden={!visible || undefined}
            className="tree__row"
            style={{ paddingLeft: 6 + row.depth * 13 }}
            onClick={() => (isGroup ? onToggleGroup(node.uuid) : onSelect(node.uuid))}
          >
            {isGroup ? (
              <Icon
                name={collapsed.has(node.uuid) ? 'chevronRight' : 'chevronDown'}
                size={10}
                className="tree__icon"
              />
            ) : null}
            <Icon name={isGroup ? 'folder' : 'cube'} size={12} className="tree__icon" />
            <span className="tree__name">{node.name}</span>
            <button
              className="tree__toggle"
              data-on={locked || undefined}
              title="Lock"
              onClick={(e) => {
                e.stopPropagation()
                if (isGroup) setGroup(node.uuid, { locked: !locked })
                else setElement(node.uuid, { locked: !locked })
              }}
            >
              <Icon name={locked ? 'lock' : 'unlock'} size={11} />
            </button>
            <button
              className="tree__toggle"
              data-on={visible || undefined}
              title="Visibility"
              onClick={(e) => {
                e.stopPropagation()
                if (isGroup) setGroup(node.uuid, { visibility: !visible })
                else setElement(node.uuid, { visibility: !visible })
              }}
            >
              <Icon name={visible ? 'eye' : 'eyeOff'} size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ================= viewport ================= */

const quadViews = [
  { tag: 'Perspective', yaw: -34, pitch: -22 },
  { tag: 'Front', yaw: 0, pitch: 0 },
  { tag: 'Top', yaw: 0, pitch: -89 },
  { tag: 'Right', yaw: -90, pitch: 0 },
]

function Viewport({
  model,
  format,
  grid,
  quad,
  scale,
  animation,
  time,
  selected,
  onSelect,
  onPaint,
  display,
}: {
  model: Model
  format: string
  grid: boolean
  quad: boolean
  scale: number
  animation: Animation | null
  time: number
  selected: string | null
  onSelect: (uuid: string) => void
  onPaint?: (elementUuid: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
}) {
  const [shading, setShading] = useState<'solid' | 'wire'>('solid')

  return (
    <div className="ed-view" data-quad={quad || undefined} data-shading={shading}>
      <div className="ed-view__scene">
        {quad ? (
          <div className="ed-quad">
            {quadViews.map((v) => (
              <div className="ed-quad__cell" key={v.tag}>
                <span className="ed-quad__tag">{v.tag}</span>
                <BBModelView
                  model={model}
                  grid={grid}
                  scale={scale * 0.55}
                  orbit
                  initialYaw={v.yaw}
                  initialPitch={v.pitch}
                  animation={animation}
                  time={time}
                  selected={selected}
                  onSelect={onSelect}
                  onPaint={onPaint}
                  display={display}
                />
              </div>
            ))}
          </div>
        ) : (
          <BBModelView
            model={model}
            grid={grid}
            scale={scale}
            orbit
            animation={animation}
            time={time}
            selected={selected}
            onSelect={onSelect}
            onPaint={onPaint}
            display={display}
          />
        )}

        <div className="ed-view__corner ed-view__corner--tl">
          <Icon name="cube" size={11} /> {format}
        </div>

        <div className="ed-view__corner ed-view__corner--tr">
          {(['solid', 'wire'] as const).map((s) => (
            <button
              key={s}
              className="ed-view__vbtn"
              aria-pressed={shading === s}
              onClick={() => setShading(s)}
            >
              {s === 'solid' ? 'Solid' : 'Wire'}
            </button>
          ))}
        </div>

        <div className="ed-view__corner ed-view__corner--bl">
          {onPaint ? 'paint straight onto the model' : 'drag to orbit · click a cube'}
        </div>

        <svg className="ed-axis-gizmo" viewBox="0 0 60 60" aria-hidden="true">
          <g strokeWidth="1.8" strokeLinecap="round">
            <line x1="30" y1="30" x2="52" y2="38" stroke="#c2544a" />
            <line x1="30" y1="30" x2="30" y2="8" stroke="#6f9268" />
            <line x1="30" y1="30" x2="9" y2="39" stroke="#5877a8" />
          </g>
          <g fontSize="8" fill="currentColor" opacity="0.8">
            <text x="53" y="41">X</text>
            <text x="27" y="7">Y</text>
            <text x="2" y="42">Z</text>
          </g>
        </svg>
      </div>
    </div>
  )
}

/* ================= timeline ================= */

const PX_PER_S = 96

function Timeline({
  model,
  animation,
  onAnimation,
  time,
  onTime,
  playing,
  onPlaying,
}: {
  model: Model
  animation: Animation | null
  onAnimation: (uuid: string) => void
  time: number
  onTime: (t: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
}) {
  const length = animation?.length ?? 1
  const ticks = Math.max(1, Math.ceil(length))
  const trackW = ticks * PX_PER_S

  // one row per bone-channel pair, which is how Blockbench stacks the timeline
  const rows = useMemo(() => {
    if (!animation) return []
    return animation.animators.flatMap((an) => {
      const channels = [...new Set(an.keyframes.map((k) => k.channel))]
      return channels.map((channel) => ({
        key: `${an.boneUuid}:${channel}`,
        bone: an.name,
        channel,
        keyframes: an.keyframes.filter((k) => k.channel === channel),
      }))
    })
  }, [animation])

  useEffect(() => {
    if (!playing || !animation) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      onTime((time + dt) % animation.length)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, animation, time, onTime])

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return
    const r = e.currentTarget.getBoundingClientRect()
    onTime(Math.max(0, Math.min(length, ((e.clientX - r.left) / PX_PER_S))))
  }

  return (
    <div className="ed-timeline">
      <div className="tl-bar">
        <button className="ed-tool" title="Jump to start" onClick={() => onTime(0)}>
          <Icon name="skipBack" size={14} />
        </button>
        <button
          className="ed-tool"
          aria-pressed={playing}
          title={playing ? 'Pause' : 'Play'}
          onClick={() => onPlaying(!playing)}
          disabled={!animation}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} filled={!playing} />
        </button>
        <button className="ed-tool" title="Jump to end" onClick={() => onTime(length)}>
          <Icon name="skipFwd" size={14} />
        </button>
        <span className="tl-time">{time.toFixed(2)}s</span>
        <span className="ed-sep" />
        <select
          className="ed-select"
          value={animation?.uuid ?? ''}
          onChange={(e) => onAnimation(e.target.value)}
          aria-label="Animation"
        >
          {model.animations.map((a) => (
            <option key={a.uuid} value={a.uuid}>
              {a.name.split('.').pop()} · {a.length}s
            </option>
          ))}
        </select>
        <button className="chip" aria-pressed={animation?.loop === 'loop'}>
          <Icon name="refresh" size={11} /> {animation?.loop ?? 'once'}
        </button>
        <div className="ed-toolbar__right">
          <button className="ed-tool" title="Add keyframe">
            <Icon name="key" size={14} />
          </button>
          <button className="ed-tool" title="Delete keyframe">
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      <div className="tl-main">
        <div className="tl-names">
          <div className="tl-name" style={{ height: 22, opacity: 0.6 }}>
            Channels
          </div>
          {rows.map((r) => (
            <div className="tl-name" key={r.key}>
              <Icon name="folder" size={11} />
              {r.bone}
              <span className="tl-name__ch">{r.channel.slice(0, 3)}</span>
            </div>
          ))}
          {!rows.length ? <div className="tl-name">no animators</div> : null}
        </div>

        <div className="tl-track-wrap">
          <div
            className="tl-ruler"
            style={{ width: trackW }}
            onPointerDown={scrub}
            onPointerMove={scrub}
          >
            {Array.from({ length: ticks }, (_, i) => (
              <span className="tl-tick" key={i} style={{ width: PX_PER_S }}>
                {i}s
              </span>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: trackW }}>
            {rows.map((r) => (
              <div className="tl-track" key={r.key} style={{ ['--px-per-s' as string]: `${PX_PER_S}px` }}>
                {r.keyframes.map((kf) => (
                  <button
                    key={kf.uuid}
                    className="tl-key"
                    data-interp={kf.interpolation}
                    style={{ left: kf.time * PX_PER_S }}
                    title={`${r.bone} · ${r.channel} @ ${kf.time.toFixed(2)}s → ${kf.value.join(', ')} (${kf.interpolation})`}
                    onClick={() => onTime(kf.time)}
                  />
                ))}
              </div>
            ))}
            <span className="tl-playhead" style={{ left: time * PX_PER_S }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= splitter ================= */

function Splitter({ onDrag }: { onDrag: (dx: number) => void }) {
  const [dragging, setDragging] = useState(false)
  const last = useRef(0)

  return (
    <div
      className="ed-split"
      data-dragging={dragging || undefined}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        last.current = e.clientX
        setDragging(true)
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragging) return
        onDrag(e.clientX - last.current)
        last.current = e.clientX
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    />
  )
}

/* ================= editor ================= */

export function Editor({ segments }: { segments: string[] }) {
  const initial = useMemo(() => sampleById(segments[1] ?? ''), [segments])

  const [model, setModel] = useState<Model>(initial.model)
  const [fileName, setFileName] = useState(initial.file)
  const [kind, setKind] = useState<ProjectKind>(initial.kind)
  const [mode, setMode] = useState<Mode>('edit')
  const [tool, setTool] = useState('move')
  const [grid, setGrid] = useState(true)
  const [quad, setQuad] = useState(false)
  const [selected, setSelected] = useState<string | null>(initial.model.elements[0]?.uuid ?? null)
  const [face, setFace] = useState<FaceKey>('north')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [leftW, setLeftW] = useState(300)
  const [rightW, setRightW] = useState(284)
  const [animUuid, setAnimUuid] = useState<string | null>(initial.model.animations[0]?.uuid ?? null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // paint
  const [colour, setColour] = useState('#cd594e')
  const [brush, setBrush] = useState(1)
  const surfaces = useRef(new Map<string, PixelSurface>())
  const lastTexel = useRef<[number, number] | null>(null)
  const commitTimer = useRef(0)
  const [modelKey, setModelKey] = useState(0)

  // display
  const [slot, setSlot] = useState<SlotId>('thirdperson_righthand')
  const [displayState, setDisplayState] = useState<DisplayState>(DEFAULT_DISPLAY)

  const [newDialog, setNewDialog] = useState(false)

  const loadModel = useCallback((next: Model, name: string, nextKind: ProjectKind = 'items') => {
    setModelKey((k) => k + 1)
    setModel(next)
    setFileName(vellumFileName(name))
    setKind(nextKind)
    setSelected(next.elements[0]?.uuid ?? null)
    setAnimUuid(next.animations[0]?.uuid ?? null)
    setCollapsed(new Set())
    setTime(0)
    setPlaying(false)
    setMode('edit')
  }, [])

  // the tool palette changes per mode; keep the active tool valid
  useEffect(() => {
    if (!toolsets[mode].some((t) => t.id === tool)) setTool(toolsets[mode][0].id)
  }, [mode, tool])

  // Animate mode opens playing: a still first frame reads as "animation broken"
  useEffect(() => {
    if (mode === 'animate' && model.animations.length) setPlaying(true)
    if (mode !== 'animate') setPlaying(false)
  }, [mode, model])

  /* Decode every texture into a canvas once per loaded model. Painting
     writes into that canvas and the data URI is re-encoded from it, so
     the effect must not re-run on its own output - hence keying on the
     model identity rather than on `model.textures`. */
  useEffect(() => {
    let cancelled = false
    const map = new Map<string, PixelSurface>()
    Promise.all(
      model.textures.map(async (t) => {
        try {
          map.set(t.uuid, await loadSurface(t))
        } catch {
          /* an undecodable texture simply cannot be painted */
        }
      }),
    ).then(() => {
      if (!cancelled) surfaces.current = map
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey])

  /** Re-encode a painted canvas back into the model, batched to a frame. */
  const commitTexture = useCallback((uuid: string) => {
    if (commitTimer.current) return
    commitTimer.current = requestAnimationFrame(() => {
      commitTimer.current = 0
      const surface = surfaces.current.get(uuid)
      if (!surface) return
      const source = toDataUrl(surface)
      setModel((m) => ({
        ...m,
        textures: m.textures.map((t) => (t.uuid === uuid ? { ...t, source } : t)),
      }))
    })
  }, [])

  const animation = useMemo(
    () => model.animations.find((a) => a.uuid === animUuid) ?? model.animations[0] ?? null,
    [model, animUuid],
  )
  const issues = useMemo(() => validateModel(model, kind), [model, kind])
  const errors = issues.filter((i) => i.level === 'error').length
  const element = model.elements.find((e) => e.uuid === selected) ?? null

  const updateElement = useCallback(
    (fn: (e: BBElement) => BBElement) => {
      if (!selected) return
      setModel((m) => ({
        ...m,
        elements: m.elements.map((e) => (e.uuid === selected ? fn(e) : e)),
      }))
    },
    [selected],
  )

  const [openError, setOpenError] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  const runSave = useCallback((fileName: string, text: string) => {
    void saveFile(fileName, text).then((note) => {
      setSaveNote(note)
      window.setTimeout(() => setSaveNote(null), 6000)
    })
  }, [])

  /* One texel, one tool. Everything upstream - the 2D sheet and the 3D
     back-projection - resolves to a call here. */
  const applyTool = useCallback(
    (textureIndex: number, x: number, y: number, bounds: UVRect | null, phase: 'down' | 'move') => {
      const tex = model.textures[textureIndex]
      const surface = tex && surfaces.current.get(tex.uuid)
      if (!surface) return

      if (tool === 'pipette') {
        const sampled = pick(surface, x, y)
        if (sampled && sampled[3] > 0) setColour(rgbaToHex(sampled))
        return
      }

      if (tool === 'bucket') {
        if (phase === 'down') {
          bucket(surface, x, y, hexToRgba(colour), bounds ?? [0, 0, surface.width, surface.height])
          commitTexture(tex.uuid)
        }
        return
      }

      const rgba = tool === 'eraser' ? ([0, 0, 0, 0] as [number, number, number, number]) : hexToRgba(colour)
      const stamp = (px: number, py: number) => paintTexels(surface, px, py, rgba, brush)

      // a fast drag would otherwise dot rather than draw
      if (phase === 'move' && lastTexel.current) strokeBetween(lastTexel.current, [x, y], stamp)
      else stamp(x, y)

      lastTexel.current = [x, y]
      commitTexture(tex.uuid)
    },
    [model.textures, tool, colour, brush, commitTexture],
  )

  useEffect(() => {
    const clear = () => {
      lastTexel.current = null
    }
    window.addEventListener('pointerup', clear)
    return () => window.removeEventListener('pointerup', clear)
  }, [])

  /** A click on the model, back-projected through that face's UV rectangle. */
  const paintOnModel = useCallback(
    (elementUuid: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => {
      const el = model.elements.find((e) => e.uuid === elementUuid)
      if (!el) return
      if (phase === 'down') setSelected(elementUuid)
      const f = el.faces[face]
      if (f.texture === null) return
      const texel = texelOfFace(f.uv, u, v)
      // a zero-area UV has no texel under the click, so there is nothing to paint
      if (!texel) return
      applyTool(f.texture, texel[0], texel[1], faceBounds(f.uv), phase)
    },
    [model.elements, applyTool],
  )

  /* On the sheet, a fill is bounded by the UV island the click landed in -
     the face you clicked, not the face that happens to be selected. A
     click on bare sheet has no island, so the fill is bounded only by
     colour similarity. */
  const paintOnSheet = useCallback(
    (x: number, y: number, phase: 'down' | 'move') => {
      let bounds: UVRect | null = null
      for (const el of model.elements) {
        for (const key of FACES) {
          const [bx1, by1, bx2, by2] = faceBounds(el.faces[key].uv)
          if (x >= bx1 && x < bx2 && y >= by1 && y < by2) {
            bounds = [bx1, by1, bx2, by2]
            break
          }
        }
        if (bounds) break
      }
      applyTool(0, x, y, bounds, phase)
    },
    [applyTool, model.elements],
  )

  const actions = useMemo(
    () => ({
      onOpen: () => fileInput.current?.click(),
      onSave: () => runSave(vellumFileName(fileName), writeVellum(model)),
      onExport: () =>
        runSave(vellumFileName(fileName).replace(/\.vellum$/, '.bbmodel'), serializeBBModel(model)),
      onSample: (id: string) => {
        const s = sampleById(id)
        loadModel(s.model, s.file, s.kind)
      },
      onNew: () => setNewDialog(true),
      onAddCube: () => {
        const next = addCube(model, null)
        setModel(next.model)
        setSelected(next.uuid)
      },
      onAddBone: () => {
        const next = addBone(model, null)
        setModel(next.model)
        setSelected(next.uuid)
      },
      onDuplicate: () => {
        if (!selected) return
        const next = duplicateElement(model, selected)
        if (!next) return
        setModel(next.model)
        setSelected(next.uuid)
      },
      onDelete: () => {
        if (!selected) return
        const next = deleteElement(model, selected)
        setModel(next)
        setSelected(next.elements[0]?.uuid ?? null)
      },
    }),
    [model, fileName, loadModel, runSave, selected],
  )


  /* A .vellum is read natively. A .bbmodel is an import: opening one and
     saving it is the migration, which is why the name is restamped on load. */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const next = isVellum(text) ? readVellum(text) : parseBBModel(text)
      loadModel(next, file.name, kind)
      setOpenError(null)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'That file could not be read as a model.')
    }
    e.target.value = ''
  }

  const onLeft = useCallback((dx: number) => setLeftW((w) => Math.min(460, Math.max(210, w + dx))), [])
  const onRight = useCallback((dx: number) => setRightW((w) => Math.min(460, Math.max(210, w - dx))), [])

  // fit the model to the viewport from its real extent, not its distance
  // from the origin - a tall sword and a 16-unit block both want to fill it
  const scale = useMemo(() => {
    if (!model.elements.length) return 6
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (const el of model.elements) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], el.from[i])
        hi[i] = Math.max(hi[i], el.to[i])
      }
    }
    const extent = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1)
    return Math.max(1.5, Math.min(16, 430 / extent))
  }, [model])

  return (
    <div
      className="editor-root"
      style={{ ['--left-w' as string]: `${leftW}px`, ['--right-w' as string]: `${rightW}px` }}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".vellum,.bbmodel,.json,application/json"
        hidden
        onChange={onFile}
      />

      <MenuBar fileName={fileName} actions={actions} />
      <Toolbar
        mode={mode}
        onMode={setMode}
        tool={tool}
        onTool={setTool}
        grid={grid}
        onGrid={() => setGrid((g) => !g)}
        quad={quad}
        onQuad={() => setQuad((q) => !q)}
        hasAnimations={model.animations.length > 0}
        onAddCube={actions.onAddCube}
        onAddBone={actions.onAddBone}
        brush={brush}
        onBrush={setBrush}
      />

      <div className="ed-body">
        <Viewport
          model={model}
          format={`${model.format} \u00b7 ${kind}`}
          grid={grid}
          quad={quad}
          scale={scale}
          animation={mode === 'animate' ? animation : null}
          time={time}
          selected={selected}
          onSelect={setSelected}
          onPaint={mode === 'paint' ? paintOnModel : undefined}
          display={mode === 'display' ? displayState[slot] : null}
        />

        <div className="ed-rails">
          <div className="ed-col ed-col--left">
            {mode === 'display' ? (
              <Panel title="Display" count={slot.replace(/_/g, ' ')}>
                <DisplayPanel
                  slot={slot}
                  onSlot={setSlot}
                  transform={displayState[slot]}
                  onTransform={(t) => setDisplayState((d) => ({ ...d, [slot]: t }))}
                  onReset={() =>
                    setDisplayState((d) => ({ ...d, [slot]: DEFAULT_DISPLAY[slot] }))
                  }
                >
                  {(rows) =>
                    rows.map((r) => (
                      <NumRow
                        key={r.label}
                        label={r.label}
                        value={r.value}
                        step={r.step}
                        onChange={r.onChange}
                      />
                    ))
                  }
                </DisplayPanel>
              </Panel>
            ) : (
              <Panel title="Element" count={element?.name ?? 'none'}>
                <ElementPanel element={element} format={model.format} onChange={updateElement} />
              </Panel>
            )}

            <Panel title="UV" count={`${model.resolution.width} × ${model.resolution.height}`}>
              <UVPanel
                model={model}
                element={element}
                face={face}
                onFace={setFace}
                onChange={updateElement}
                onPaint={mode === 'paint' ? paintOnSheet : undefined}
              />
            </Panel>

            <Panel
              title="Validation"
              count={errors ? `${errors} errors` : 'clean'}
              defaultOpen={errors > 0 || !!openError}
            >
              {openError ? (
                <p className="ed-hint ed-hint--warn" style={{ marginBottom: 10 }}>
                  <Icon name="warning" size={11} /> {openError}
                </p>
              ) : null}
              {issues.length ? (
                <ul className="ed-issues">
                  {issues.slice(0, 12).map((i, n) => (
                    <li key={n} data-level={i.level}>
                      <Icon name={i.level === 'error' ? 'warning' : 'info'} size={11} />
                      {i.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ed-hint">
                  <Icon name="check" size={11} /> Nothing Blockbench would reject.
                </p>
              )}
            </Panel>
          </div>

          <Splitter onDrag={onLeft} />
          <div className="ed-rails__gap" />
          <Splitter onDrag={onRight} />

          <div className="ed-col ed-col--right">
            <Panel title="Colour" count={mode === 'paint' ? tool : undefined}>
              <ColorPanel colour={colour} onColour={setColour} />
            </Panel>

            <Panel title="Outliner" count={`${model.elements.length} cubes`} grow>
              <Outliner
                model={model}
                selected={selected}
                collapsed={collapsed}
                onSelect={setSelected}
                onToggleGroup={(uuid) =>
                  setCollapsed((s) => {
                    const next = new Set(s)
                    if (next.has(uuid)) next.delete(uuid)
                    else next.add(uuid)
                    return next
                  })
                }
                onModel={(fn) => setModel(fn)}
              />
            </Panel>

            <Panel title="Textures" count={model.textures.length}>
              {model.textures.map((t) => (
                <button key={t.uuid} className="tex-row" aria-selected={t.id === '0'}>
                  <span
                    className="tex-thumb"
                    style={{
                      backgroundImage: `url(${t.source})`,
                      backgroundSize: 'cover',
                      imageRendering: 'pixelated',
                    }}
                  />
                  <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>{t.name}</span>
                  <span className="tex-row__meta">
                    {t.width} x {t.height}
                  </span>
                </button>
              ))}
              {!model.textures.length ? <p className="ed-hint">No textures on this model.</p> : null}
            </Panel>
          </div>
        </div>
      </div>

      {newDialog ? (
        <NewModelDialog
          onClose={() => setNewDialog(false)}
          onCreate={(k: NewModelKind, name: string) => {
            setNewDialog(false)
            loadModel(createModel(k, name), `${name}.vellum`, k)
          }}
        />
      ) : null}

      {mode === 'animate' && model.animations.length ? (
        <Timeline
          model={model}
          animation={animation}
          onAnimation={setAnimUuid}
          time={time}
          onTime={setTime}
          playing={playing}
          onPlaying={setPlaying}
        />
      ) : null}

      <div className="ed-status">
        <span>{fileName}</span>
        <span>{kind}</span>
        <span>{model.elements.length} elements</span>
        <span>
          {model.resolution.width} x {model.resolution.height}
        </span>
        <span className="ed-status__sel">
          {saveNote ?? `selected: ${element?.name ?? 'none'} · ${tool}`}
        </span>
        <div className="ed-status__right">
          <span className={errors ? 'ed-status__bad' : undefined}>
            {errors ? `${errors} errors` : 'valid'}
          </span>
          <span>{mode}</span>
          <span>vellum 0.5.0</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------
   Handing the viewer a file.

   In a browser this is an anchor click and the file is a true
   `.vellum`. Inside the Artifact viewer the page cannot download
   directly - it offers the file through the host, which allowlists
   extensions, and `.vellum` is not among them. The bytes are identical
   either way; only the name the viewer is offered differs, and the
   editor says so rather than letting the save fail silently.
   --------------------------------------------------------------- */
type DownloadsApi = { save: (req: { filename: string; data: string }) => Promise<unknown> }

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> }
  }
}

async function saveFile(name: string, text: string): Promise<string> {
  let host: DownloadsApi | null = null
  try {
    host = ((await window.claude?.use?.('downloads')) as DownloadsApi | null) ?? null
  } catch {
    host = null
  }

  if (host) {
    const filename = name.endsWith('.vellum') ? `${name}.json` : name
    try {
      await host.save({ filename, data: text })
      return filename === name
        ? `Saved ${filename}`
        : `Saved as ${filename} \u2014 this viewer does not allow a .vellum extension`
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'failed'
      return code === 'declined' ? 'Save cancelled' : `Could not save (${code})`
    }
  }

  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return `Saved ${name}`
}
