import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Menu } from '../components/Menu'
import type { MenuEntry } from '../components/Menu'
import { Model3D, lanternModel } from '../components/Model3D'
import { Icon, VellumMark } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { animations, assets, editorTextures, keyframeRows, outliner } from '../lib/data'
import { navigate } from '../lib/router'
import './Editor.css'

type Mode = 'edit' | 'paint' | 'animate' | 'display'

/* ================= menu bar ================= */

const menus: Array<{ label: string; entries: MenuEntry[] }> = [
  {
    label: 'File',
    entries: [
      { label: 'New Model', icon: 'plus', shortcut: 'Ctrl N' },
      { label: 'Open Model', icon: 'folder', shortcut: 'Ctrl O' },
      { kind: 'separator' },
      { label: 'Save', icon: 'save', shortcut: 'Ctrl S' },
      { label: 'Save As', icon: 'save', shortcut: '⇧ Ctrl S' },
      { label: 'Export', icon: 'download', shortcut: 'Ctrl E' },
      { kind: 'separator' },
      { label: 'Close Project', icon: 'close' },
    ],
  },
  {
    label: 'Edit',
    entries: [
      { label: 'Undo', icon: 'undo', shortcut: 'Ctrl Z' },
      { label: 'Redo', icon: 'redo', shortcut: 'Ctrl Y' },
      { kind: 'separator' },
      { label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl D' },
      { label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true },
      { kind: 'separator' },
      { label: 'Select All', icon: 'check', shortcut: 'Ctrl A' },
      { label: 'Invert Selection', icon: 'flip' },
    ],
  },
  {
    label: 'Transform',
    entries: [
      { label: 'Move', icon: 'move' },
      { label: 'Resize', icon: 'resize' },
      { label: 'Rotate', icon: 'rotate' },
      { kind: 'separator' },
      { label: 'Flip X', icon: 'flip' },
      { label: 'Center Pivot', icon: 'pivot' },
      { label: 'Scale Model', icon: 'sliders' },
    ],
  },
  {
    label: 'Filter',
    entries: [
      { kind: 'label', label: 'Geometry' },
      { label: 'Sort Outliner', icon: 'layers' },
      { label: 'Optimise UV', icon: 'image' },
      { label: 'Remove Blank Faces', icon: 'eraser' },
      { kind: 'separator' },
      { label: 'Validate Model', icon: 'check' },
    ],
  },
  {
    label: 'View',
    entries: [
      { label: 'Quad View', icon: 'grid', shortcut: 'Ctrl 4' },
      { label: 'Toggle Grid', icon: 'grid', shortcut: 'G' },
      { label: 'Wireframe', icon: 'vertex' },
      { kind: 'separator' },
      { label: 'Screenshot Model', icon: 'camera' },
      { label: 'Fullscreen', icon: 'external', shortcut: 'F11' },
    ],
  },
  {
    label: 'Help',
    entries: [
      { label: 'Documentation', icon: 'book' },
      { label: 'Keybindings', icon: 'sliders' },
      { label: 'Report a Bug', icon: 'bug', onSelect: () => navigate('/settings/report-a-bug') },
      { kind: 'separator' },
      { label: 'About Vellum', icon: 'info', onSelect: () => navigate('/settings/about') },
    ],
  },
]

function MenuBar({ fileName }: { fileName: string }) {
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
}: {
  mode: Mode
  onMode: (m: Mode) => void
  tool: string
  onTool: (t: string) => void
  grid: boolean
  onGrid: () => void
  quad: boolean
  onQuad: () => void
}) {
  return (
    <div className="ed-toolbar">
      <div className="ed-modes" role="group" aria-label="Editor mode">
        {modes.map((m) => (
          <button
            key={m.id}
            className="ed-mode"
            aria-pressed={m.id === mode}
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
        <button className="ed-tool" title="Add Cube" aria-label="Add Cube">
          <Icon name="cube" size={15} />
        </button>
        <button className="ed-tool" title="Add Group" aria-label="Add Group">
          <Icon name="folder" size={15} />
        </button>
        <button className="ed-tool" title="Add Mesh" aria-label="Add Mesh">
          <Icon name="vertex" size={15} />
        </button>
      </div>

      <span className="ed-sep" />

      <select className="ed-select" defaultValue="global" aria-label="Transform space">
        <option value="global">Global</option>
        <option value="bone">Bone</option>
        <option value="local">Local</option>
      </select>

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
}: {
  axis: 'x' | 'y' | 'z' | 'n'
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  const drag = useRef<{ x: number; start: number } | null>(null)

  return (
    <div className="nf">
      <span
        className={`nf__axis nf__axis--${axis}`}
        title="Drag to scrub"
        onPointerDown={(e) => {
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
        value={value}
        inputMode="decimal"
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange(Number.isFinite(next) ? next : 0)
        }}
      />
    </div>
  )
}

type Vec = [number, number, number]

function NumRow({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: Vec
  onChange: (v: Vec) => void
  step?: number
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
          value={value[i]}
          onChange={(v) => {
            const next = [...value] as Vec
            next[i] = v
            onChange(next)
          }}
        />
      ))}
    </div>
  )
}

/* ================= UV ================= */

const uvFaces = [
  { id: 'up', label: 'U', left: '25%', top: '0%', w: '25%', h: '25%' },
  { id: 'down', label: 'D', left: '50%', top: '0%', w: '25%', h: '25%' },
  { id: 'east', label: 'E', left: '0%', top: '25%', w: '25%', h: '37.5%' },
  { id: 'north', label: 'N', left: '25%', top: '25%', w: '25%', h: '37.5%' },
  { id: 'west', label: 'W', left: '50%', top: '25%', w: '25%', h: '37.5%' },
  { id: 'south', label: 'S', left: '75%', top: '25%', w: '25%', h: '37.5%' },
]

function UVPanel() {
  const [face, setFace] = useState('north')
  return (
    <>
      <div className="uv">
        {uvFaces.map((f) => (
          <button
            key={f.id}
            className={`uv__face${f.id === face ? ' uv__face--active' : ''}`}
            style={{ left: f.left, top: f.top, width: f.w, height: f.h }}
            onClick={() => setFace(f.id)}
            title={f.id}
          >
            {f.label}
          </button>
        ))}
        <span className="uv__ruler" style={{ left: 4, bottom: 3 }}>
          0,0
        </span>
        <span className="uv__ruler" style={{ right: 4, bottom: 3 }}>
          32,32
        </span>
      </div>
      <div className="chip-row">
        <button className="chip" aria-pressed>
          <Icon name="magnet" size={11} /> Auto UV
        </button>
        <button className="chip">
          <Icon name="flip" size={11} /> Mirror
        </button>
        <button className="chip">
          <Icon name="sun" size={11} /> Shade
        </button>
      </div>
    </>
  )
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

function ColorPanel() {
  const [hue, setHue] = useState(38)
  const [sat, setSat] = useState(0.47)
  const [val, setVal] = useState(0.78)
  const hex = hsvToHex(hue, sat, val)

  const pickSV = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return
    const r = e.currentTarget.getBoundingClientRect()
    setSat(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
    setVal(1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))
  }

  return (
    <>
      <div
        className="color-sv"
        onPointerDown={pickSV}
        onPointerMove={pickSV}
        style={{ background: `hsl(${hue} 100% 50%)` }}
      >
        <div
          className="color-sv__layer"
          style={{ background: 'linear-gradient(90deg, #fff, transparent)' }}
        />
        <div
          className="color-sv__layer"
          style={{ background: 'linear-gradient(0deg, #000, transparent)' }}
        />
        <span className="color-dot" style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }} />
      </div>

      <div
        className="color-hue"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setHue(Math.round(((e.clientX - r.left) / r.width) * 360))
        }}
      >
        <span className="color-hue__knob" style={{ left: `${(hue / 360) * 100}%` }} />
      </div>

      <div className="color-foot">
        <span className="color-swatch" style={{ background: hex }} />
        <input className="color-hex" value={hex} readOnly />
      </div>

      <div className="palette">
        {['#c8a96a', '#b08d3f', '#96742f', '#f1e8d6', '#8fa2c4', '#5c7d9c', '#26395f', '#16223c',
          '#a8563f', '#5b7a63', '#6f7684', '#0b1220'].map((c) => (
          <button key={c} className="palette__dot" style={{ background: c }} title={c} />
        ))}
      </div>
    </>
  )
}

/* ================= outliner ================= */

function Outliner({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(outliner.filter((n) => n.hidden).map((n) => [n.id, true])),
  )
  const [locked, setLocked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(outliner.filter((n) => n.locked).map((n) => [n.id, true])),
  )

  const icon = (type: string): IconName =>
    type === 'group' ? 'folder' : type === 'mesh' ? 'vertex' : 'cube'

  return (
    <div className="tree" role="tree">
      {outliner.map((n) => (
        <div
          key={n.id}
          role="treeitem"
          aria-selected={n.id === selected}
          data-hidden={hidden[n.id] || undefined}
          className="tree__row"
          style={{ paddingLeft: 6 + n.depth * 13 }}
          onClick={() => onSelect(n.id)}
        >
          {n.type === 'group' ? <Icon name="chevronDown" size={10} className="tree__icon" /> : null}
          <Icon name={icon(n.type)} size={12} className="tree__icon" />
          <span className="tree__name">{n.name}</span>
          <button
            className="tree__toggle"
            data-on={locked[n.id] || undefined}
            title="Lock"
            onClick={(e) => {
              e.stopPropagation()
              setLocked((m) => ({ ...m, [n.id]: !m[n.id] }))
            }}
          >
            <Icon name={locked[n.id] ? 'lock' : 'unlock'} size={11} />
          </button>
          <button
            className="tree__toggle"
            data-on={!hidden[n.id] || undefined}
            title="Visibility"
            onClick={(e) => {
              e.stopPropagation()
              setHidden((m) => ({ ...m, [n.id]: !m[n.id] }))
            }}
          >
            <Icon name={hidden[n.id] ? 'eyeOff' : 'eye'} size={11} />
          </button>
        </div>
      ))}
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
  grid,
  quad,
  boxes,
  format,
}: {
  grid: boolean
  quad: boolean
  boxes: ReturnType<typeof lanternModel>
  format: string
}) {
  const [shading, setShading] = useState<'solid' | 'wire'>('solid')

  return (
    <div className="ed-view" data-quad={quad || undefined}>
      <div className="ed-view__scene">
        {quad ? (
          <div className="ed-quad">
            {quadViews.map((v) => (
              <div className="ed-quad__cell" key={v.tag}>
                <span className="ed-quad__tag">{v.tag}</span>
                <Model3D
                  boxes={boxes}
                  grid={grid}
                  gridSize={260}
                  orbit
                  initialYaw={v.yaw}
                  initialPitch={v.pitch}
                  zoom={-170}
                />
              </div>
            ))}
          </div>
        ) : (
          <Model3D boxes={boxes} grid={grid} gridSize={340} orbit zoom={40} />
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

        <div className="ed-view__corner ed-view__corner--bl">drag to orbit</div>

        <svg className="ed-axis-gizmo" viewBox="0 0 60 60" aria-hidden="true">
          <g strokeWidth="1.8" strokeLinecap="round">
            <line x1="30" y1="30" x2="52" y2="38" stroke="#b4614c" />
            <line x1="30" y1="30" x2="30" y2="8" stroke="#6f8f63" />
            <line x1="30" y1="30" x2="9" y2="39" stroke="#5b7ba6" />
          </g>
          <g fontSize="8" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.8">
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
const LENGTH_S = 2.4
const TICKS = Math.ceil(LENGTH_S)
const TRACK_W = TICKS * PX_PER_S

function Timeline() {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0.6)
  const [anim, setAnim] = useState(animations[0].id)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTime((t) => (t + dt) % LENGTH_S)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  return (
    <div className="ed-timeline">
      <div className="tl-bar">
        <button className="ed-tool" title="Jump to start" onClick={() => setTime(0)}>
          <Icon name="skipBack" size={14} />
        </button>
        <button
          className="ed-tool"
          aria-pressed={playing}
          title={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying((p) => !p)}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} filled={!playing} />
        </button>
        <button className="ed-tool" title="Jump to end" onClick={() => setTime(LENGTH_S)}>
          <Icon name="skipFwd" size={14} />
        </button>
        <span className="tl-time">{time.toFixed(2)}s</span>
        <span className="ed-sep" />
        <select
          className="ed-select"
          value={anim}
          onChange={(e) => setAnim(e.target.value)}
          aria-label="Animation"
        >
          {animations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.length}
            </option>
          ))}
        </select>
        <button className="chip" aria-pressed>
          <Icon name="refresh" size={11} /> Loop
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
          <div className="tl-name" style={{ height: 20, opacity: 0.6 }}>
            Channels
          </div>
          {keyframeRows.map((r) => (
            <div className="tl-name" key={r.id}>
              <Icon name="cube" size={11} />
              {r.bone}
              <span className="tl-name__ch">{r.channel.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        <div className="tl-track-wrap">
          <div className="tl-ruler" style={{ width: TRACK_W }}>
            {Array.from({ length: TICKS }, (_, i) => (
              <span className="tl-tick" key={i} style={{ width: PX_PER_S }}>
                {i}s
              </span>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: TRACK_W }}>
            {keyframeRows.map((r) => (
              <div
                className="tl-track"
                key={r.id}
                style={{ ['--px-per-s' as string]: `${PX_PER_S}px` }}
              >
                {r.keys.map((k) => (
                  <button
                    key={k}
                    className="tl-key"
                    style={{ left: k * PX_PER_S }}
                    title={`${r.bone} · ${r.channel} @ ${k.toFixed(2)}s`}
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
  const asset = useMemo(
    () => assets.find((a) => a.id === segments[1]) ?? assets[0],
    [segments],
  )

  const [mode, setMode] = useState<Mode>('edit')
  const [tool, setTool] = useState('move')
  const [grid, setGrid] = useState(true)
  const [quad, setQuad] = useState(false)
  const [selected, setSelected] = useState('c-pane')
  const [leftW, setLeftW] = useState(292)
  const [rightW, setRightW] = useState(276)
  const [texture, setTexture] = useState(editorTextures[0].id)

  const [position, setPosition] = useState<Vec>([0, 4, 0])
  const [size, setSize] = useState<Vec>([13, 17.5, 13])
  const [rotation, setRotation] = useState<Vec>([0, 45, 0])
  const [pivot, setPivot] = useState<Vec>([0, 0, 0])

  const selectedIndex = outliner.findIndex((n) => n.id === selected)
  const boxes = useMemo(
    () => lanternModel(asset.hue, Math.max(0, selectedIndex - 2)),
    [asset.hue, selectedIndex],
  )

  // the tool palette changes per mode; keep the active tool valid
  useEffect(() => {
    if (!toolsets[mode].some((t) => t.id === tool)) setTool(toolsets[mode][0].id)
  }, [mode, tool])

  const onLeft = useCallback((dx: number) => {
    setLeftW((w) => Math.min(460, Math.max(210, w + dx)))
  }, [])
  const onRight = useCallback((dx: number) => {
    setRightW((w) => Math.min(460, Math.max(210, w - dx)))
  }, [])

  const selectedNode = outliner[selectedIndex]

  return (
    <div
      className="editor-root"
      style={{ ['--left-w' as string]: `${leftW}px`, ['--right-w' as string]: `${rightW}px` }}
    >
      <MenuBar fileName={asset.file} />
      <Toolbar
        mode={mode}
        onMode={setMode}
        tool={tool}
        onTool={setTool}
        grid={grid}
        onGrid={() => setGrid((g) => !g)}
        quad={quad}
        onQuad={() => setQuad((q) => !q)}
      />

      <div className="ed-body">
        {/* ---- left column ---- */}
        <div className="ed-col ed-col--left">
          <Panel title="Element" count={selectedNode?.name}>
            <div className="nf-grid">
              <NumRow label="Position" value={position} onChange={setPosition} />
              <NumRow label="Size" value={size} onChange={setSize} />
              <NumRow label="Pivot" value={pivot} onChange={setPivot} />
              <NumRow label="Rotation" value={rotation} onChange={setRotation} step={2.5} />
              <div className="nf-row">
                <span className="nf-row__label">Inflate</span>
                <NumField axis="n" value={0} onChange={() => {}} />
                <span className="nf-row__label" style={{ textAlign: 'right' }}>
                  Stretch
                </span>
                <NumField axis="n" value={1} onChange={() => {}} />
              </div>
            </div>
            <div className="chip-row">
              <button className="chip" aria-pressed>
                <Icon name="check" size={11} /> Visible
              </button>
              <button className="chip">
                <Icon name="lock" size={11} /> Locked
              </button>
              <button className="chip">
                <Icon name="sun" size={11} /> Shade
              </button>
            </div>
          </Panel>

          <Panel title="UV" count={asset.texture}>
            <UVPanel />
          </Panel>

          <Panel title="Variant placement" defaultOpen={false}>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>
              Display slots and per-variant overrides land here.
            </p>
          </Panel>
        </div>

        <Splitter onDrag={onLeft} />

        {/* ---- viewport ---- */}
        <Viewport grid={grid} quad={quad} boxes={boxes} format={asset.format} />

        <Splitter onDrag={onRight} />

        {/* ---- right column ---- */}
        <div className="ed-col ed-col--right">
          <Panel title="Colour">
            <ColorPanel />
          </Panel>

          <Panel title="Outliner" count={outliner.length} grow>
            <Outliner selected={selected} onSelect={setSelected} />
          </Panel>

          <Panel title="Textures" count={editorTextures.length}>
            {editorTextures.map((t) => (
              <button
                key={t.id}
                className="tex-row"
                aria-selected={t.id === texture}
                onClick={() => setTexture(t.id)}
              >
                <span
                  className="tex-thumb"
                  style={{
                    backgroundColor: t.swatch,
                    backgroundImage:
                      'linear-gradient(45deg, rgba(0,0,0,.2) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.2) 75%), linear-gradient(45deg, rgba(0,0,0,.2) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.2) 75%)',
                  }}
                />
                <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>{t.name}</span>
                <span className="tex-row__meta">{t.size}</span>
              </button>
            ))}
          </Panel>
        </div>
      </div>

      {mode === 'animate' ? <Timeline /> : null}

      <div className="ed-status">
        <span>{asset.format}</span>
        <span>{outliner.filter((n) => n.type !== 'group').length} elements</span>
        <span>{asset.texture}</span>
        <span className="ed-status__sel">
          selected: {selectedNode?.name ?? 'none'} · {tool}
        </span>
        <div className="ed-status__right">
          <span>{mode}</span>
          <span>60 fps</span>
          <span>vellum 0.4.1-mock</span>
        </div>
      </div>
    </div>
  )
}
