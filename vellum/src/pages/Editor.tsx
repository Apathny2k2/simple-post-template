import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Menu } from '../components/Menu'
import type { MenuEntry } from '../components/Menu'
import { ModelView } from '../components/ModelView'
import { Icon, VellumMark } from '../lib/icons'
import { arrowNav } from '../lib/a11y'
import type { IconName } from '../lib/icons'
import {
  FACES,
  boneById,
  cubeSize,
  defaultSubtype,
  flattenBones,
  setCubePosition,
  setCubeSize,
  subtypeFits,
  validateModel,
} from '../lib/model'
import type {
  Bone,
  Channel,
  Clip,
  Cube,
  FaceKey,
  Key,
  Model,
  ProjectKind,
  Track,
  UVRect,
  Vec3,
} from '../lib/model'
import { isVellum, readVellum, vellumFileName, writeVellum } from '../lib/vellum'
import { AUTO_PRESETS, autoAnimate, readRig } from '../lib/auto-rig'
import { WorldScene } from '../components/WorldScene'
import { sampleById, samples } from '../lib/samples'
import {
  addBone,
  addCube,
  createModel,
  deleteBone,
  deleteCube,
  duplicateBone,
  duplicateCube,
  renameNode,
  reparent,
  updateBone,
} from '../lib/new-model'
import {
  CHANNELS,
  addClip,
  boneList,
  closeLoop,
  deleteClip,
  deleteKey,
  deleteTrack,
  duplicateClip,
  findTrack,
  setKey,
  uniqueName,
  updateClip,
  updateKey,
} from '../lib/animation'
import type { BoneRef } from '../lib/animation'
import { useHistory } from '../lib/history'
import {
  bucket,
  faceBounds,
  hexToRgba,
  loadSurface,
  paint as paintTexels,
  pick,
  rgbaToHex,
  drawShape,
  strokeBetween,
  texelOfFace,
  toDataUrl,
} from '../lib/texture'
import type { PixelSurface, ShapeKind } from '../lib/texture'
import type { Rescale } from '../lib/uv-pack'
import { DEFAULT_DISPLAY, DisplayPanel } from './editor/DisplayPanel'
import type { DisplayState, SlotId } from './editor/DisplayPanel'
import { ScenePanel } from './editor/ScenePanel'
import { BehaviourPanel } from './editor/BehaviourPanel'
import { ConfigPanel } from './editor/ConfigPanel'
import { ConfigOutput } from './editor/ConfigOutput'
import { emptyConfig, hasConfig, setFields } from '../lib/mythic'
import type { MythicConfig } from '../lib/mythic'
import { EMPTY_BEHAVIOUR, cycleLength, geyserBehaviour, stageAt } from '../lib/behaviour'
import type { Behaviour } from '../lib/behaviour'
import { ConfirmDialog } from './editor/ConfirmDialog'
import { blockNavigation, navigate, useTitle } from '../lib/router'
import { scenes } from '../lib/data'
import { saveDataUrl, saveFile } from '../lib/download'
import './Editor.css'

type Mode = 'edit' | 'paint' | 'animate' | 'display' | 'behaviour' | 'config'

/* ================= menu bar ================= */

type Actions = {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSample: (id: string) => void
  onAddCube: () => void
  onAddBone: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onNewClip: () => void
  onDuplicateClip: () => void
  onDeleteClip: () => void
  onAddKey: () => void
  onCloseLoop: () => void
  onQuad: () => void
  onGrid: () => void
  onExportTexture: () => void
}

function buildMenus(
  actions: Actions,
  state: { undoLabel: string | null; redoLabel: string | null; hasClip: boolean },
): Array<{ label: string; entries: MenuEntry[] }> {
  return [
    {
      label: 'File',
      entries: [
        { label: 'New model…', icon: 'plus', shortcut: 'Ctrl N', onSelect: actions.onNew },
        { kind: 'separator' },
        { kind: 'label', label: 'Sample models' },
        ...samples.map((s) => ({
          label: s.label,
          icon: 'cube' as const,
          onSelect: () => actions.onSample(s.id),
        })),
        { kind: 'separator' },
        { label: 'Open .vellum…', icon: 'folder', shortcut: 'Ctrl O', onSelect: actions.onOpen },
        { label: 'Save .vellum', icon: 'save', shortcut: 'Ctrl S', onSelect: actions.onSave },
      ],
    },
    {
      label: 'Edit',
      entries: [
        {
          label: state.undoLabel ? `Undo ${state.undoLabel}` : 'Undo',
          icon: 'undo',
          shortcut: 'Ctrl Z',
          onSelect: actions.onUndo,
        },
        {
          label: state.redoLabel ? `Redo ${state.redoLabel}` : 'Redo',
          icon: 'redo',
          shortcut: 'Ctrl ⇧ Z',
          onSelect: actions.onRedo,
        },
        { kind: 'separator' },
        { label: 'Add Cube', icon: 'cube', onSelect: actions.onAddCube },
        { label: 'Add Bone', icon: 'folder', onSelect: actions.onAddBone },
        { kind: 'separator' },
        { label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl D', onSelect: actions.onDuplicate },
        { label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, onSelect: actions.onDelete },
      ],
    },
    {
      label: 'Animation',
      // with no clip the rest would be no-ops, so the menu offers only the
      // one entry that does something
      entries: [
        { label: 'New animation', icon: 'plus', onSelect: actions.onNewClip },
        ...(state.hasClip
          ? ([
              { label: 'Duplicate animation', icon: 'copy', onSelect: actions.onDuplicateClip },
              { kind: 'separator' },
              { label: 'Add keyframe', icon: 'key', shortcut: 'K', onSelect: actions.onAddKey },
              { label: 'Close the loop', icon: 'refresh', onSelect: actions.onCloseLoop },
              { kind: 'separator' },
              {
                label: 'Delete animation',
                icon: 'trash',
                danger: true,
                onSelect: actions.onDeleteClip,
              },
            ] satisfies MenuEntry[])
          : []),
      ],
    },
    {
      label: 'View',
      entries: [
        { label: 'Quad View', icon: 'layers', shortcut: 'Ctrl 4', onSelect: actions.onQuad },
        { label: 'Toggle Grid', icon: 'grid', shortcut: 'G', onSelect: actions.onGrid },
        { kind: 'separator' },
        /* "Screenshot Model" used to sit here doing nothing, and there is
           no honest way to implement it: the viewport is composed from
           CSS 3D transforms, not a canvas, so there is nothing to read
           pixels out of. Exporting the texture is the thing this menu
           can actually do. */
        { label: 'Export texture PNG', icon: 'image', onSelect: actions.onExportTexture },
      ],
    },
    {
      label: 'Help',
      entries: [
        { label: 'Report a Bug', icon: 'bug', onSelect: () => navigate('/settings/report-a-bug') },
        { label: 'About Vellum', icon: 'info', onSelect: () => navigate('/settings/about') },
      ],
    },
  ]
}

function MenuBar({
  fileName,
  kind,
  actions,
  undoLabel,
  redoLabel,
  hasClip,
  dirty,
}: {
  fileName: string
  kind: ProjectKind
  actions: Actions
  undoLabel: string | null
  redoLabel: string | null
  hasClip: boolean
  dirty: boolean
}) {
  const menus = useMemo(
    () => buildMenus(actions, { undoLabel, redoLabel, hasClip }),
    [actions, undoLabel, redoLabel, hasClip],
  )
  return (
    <div className="ed-menubar">
      {/* The editor was a one-way door: every route into it came from the
          library and none led back, so the only way out was the browser's
          own Back button. */}
      <button
        className="ed-menubar__back"
        onClick={() => navigate(`/projects/${scenes[0].id}/${kind === 'mobs' ? 'mobs' : 'items'}`)}
        title="Back to the library"
        aria-label="Back to the library"
      >
        <Icon name="chevronLeft" size={14} />
      </button>
      <span className="ed-menubar__mark">
        <VellumMark size={15} />
      </span>
      {menus.map((m) => (
        <Menu
          key={m.label}
          align="start"
          entries={m.entries}
          trigger={({ props }) => (
            <button className="ed-menubar__btn" {...props}>
              {m.label}
            </button>
          )}
        />
      ))}
      <div className="ed-menubar__title" title={dirty ? 'Unsaved changes' : 'Saved'}>
        {dirty ? (
          <span className="ed-menubar__dirty" aria-label="Unsaved changes">
            ●
          </span>
        ) : null}
        {fileName}
      </div>
    </div>
  )
}

/* ================= toolbar ================= */

const toolsets: Record<Mode, Array<{ id: string; icon: IconName; label: string }>> = {
  // neither a behaviour nor a config is a canvas, so the tool row has
  // nothing to offer either of them
  behaviour: [],
  config: [],
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

const baseModes: Array<{ id: Mode; label: string }> = [
  { id: 'edit', label: 'Edit' },
  { id: 'paint', label: 'Paint' },
  { id: 'animate', label: 'Animate' },
  { id: 'behaviour', label: 'Behaviour' },
  { id: 'config', label: 'Config' },
  { id: 'display', label: 'Display' },
]

/**
 * A mob has no display transforms, so the tab that would edit them says
 * what it actually opens instead - and it has no behaviour either: a
 * mob is animated by what it is doing, not by the blocks around it.
 */
const modesFor = (kind: ProjectKind) =>
  baseModes
    .filter((m) => (m.id === 'behaviour' ? kind !== 'mobs' : m.id === 'config' ? hasConfig(kind) : true))
    .map((m) => (m.id === 'display' && kind === 'mobs' ? { ...m, label: 'Scene' } : m))

function Toolbar({
  kind,
  mode,
  onMode,
  tool,
  onTool,
  grid,
  onGrid,
  quad,
  onQuad,
  onAddCube,
  onAddBone,
  brush,
  onBrush,
  shape,
  onShape,
  shapeFilled,
  onShapeFilled,
  snap,
  onSnap,
  onExportTexture,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoLabel,
  redoLabel,
}: {
  kind: ProjectKind
  mode: Mode
  onMode: (m: Mode) => void
  tool: string
  onTool: (t: string) => void
  grid: boolean
  onGrid: () => void
  quad: boolean
  onQuad: () => void
  onAddCube: () => void
  onAddBone: () => void
  brush: number
  onBrush: (n: number) => void
  shape: ShapeKind
  onShape: (k: ShapeKind) => void
  shapeFilled: boolean
  onShapeFilled: (v: boolean) => void
  snap: boolean
  onSnap: () => void
  onExportTexture: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  undoLabel: string | null
  redoLabel: string | null
}) {
  return (
    <div className="ed-toolbar">
      <div className="ed-modes" role="group" aria-label="Editor mode">
        {modesFor(kind).map((m) => (
          <button key={m.id} className="ed-mode" aria-pressed={m.id === mode} onClick={() => onMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <span className="ed-sep" />

      <div className="ed-tools" role="group" aria-label="History">
        <button
          className="ed-tool"
          title={undoLabel ? `Undo ${undoLabel} (Ctrl Z)` : 'Nothing to undo'}
          aria-label="Undo"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Icon name="undo" size={15} />
        </button>
        <button
          className="ed-tool"
          title={redoLabel ? `Redo ${redoLabel} (Ctrl ⇧ Z)` : 'Nothing to redo'}
          aria-label="Redo"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Icon name="redo" size={15} />
        </button>
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
        <>
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
          {tool === 'shape' ? (
            <div className="ed-tools" role="group" aria-label="Shape">
              {(['rect', 'ellipse'] as const).map((k) => (
                <button
                  key={k}
                  className="ed-tool"
                  title={k === 'rect' ? 'Rectangle' : 'Ellipse'}
                  aria-label={k === 'rect' ? 'Rectangle' : 'Ellipse'}
                  aria-pressed={shape === k}
                  onClick={() => onShape(k)}
                >
                  <Icon name={k === 'rect' ? 'shape' : 'globe'} size={15} />
                </button>
              ))}
              <button
                className="ed-tool"
                title="Fill the shape"
                aria-label="Fill the shape"
                aria-pressed={shapeFilled}
                onClick={() => onShapeFilled(!shapeFilled)}
              >
                <Icon name="bucket" size={15} />
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="ed-toolbar__right">
        <button className="ed-tool" title="Toggle grid (G)" aria-pressed={grid} onClick={onGrid}>
          <Icon name="grid" size={15} />
        </button>
        <button className="ed-tool" title="Quad view (Ctrl 4)" aria-pressed={quad} onClick={onQuad}>
          <Icon name="layers" size={15} />
        </button>
        <button
          className="ed-tool"
          title={snap ? 'Snapping to whole units' : 'Snap to whole units'}
          aria-label="Snap to whole units"
          aria-pressed={snap}
          onClick={onSnap}
        >
          <Icon name="magnet" size={15} />
        </button>
        <button className="ed-tool" title="Export the texture as a PNG" aria-label="Export texture" onClick={onExportTexture}>
          <Icon name="image" size={15} />
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
  forceOpen,
}: {
  title: string
  count?: ReactNode
  children: ReactNode
  grow?: boolean
  defaultOpen?: boolean
  /** opens the panel when it becomes true - `defaultOpen` is only read at mount */
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
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
  name,
  value,
  onChange,
  step = 1,
  disabled,
  onCommit,
  snap,
}: {
  axis: 'x' | 'y' | 'z' | 'n'
  /**
   * What this number is, spelled out. Every one of these used to be an
   * unlabelled box: a screen reader read nineteen inputs called
   * "edit text" and the axis letter beside them was a decoration it
   * never connected to anything.
   */
  name: string
  value: number
  onChange: (v: number) => void
  step?: number
  disabled?: boolean
  /** fired once a scrub ends, so a drag is one undo step rather than forty */
  onCommit?: () => void
  /** round to whole units - what the magnet in the toolbar turns on */
  snap?: boolean
}) {
  const emit = (v: number) => onChange(snap ? Math.round(v) : v)
  const drag = useRef<{ x: number; start: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="nf" data-disabled={disabled || undefined}>
      <span
        className={`nf__axis nf__axis--${axis}`}
        title={`${name} \u2014 drag to scrub`}
        aria-hidden="true"
        onPointerDown={(e) => {
          if (disabled) return
          drag.current = { x: e.clientX, start: value }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          emit(Number((d.start + Math.round((e.clientX - d.x) / 3) * step).toFixed(2)))
        }}
        onPointerUp={() => {
          if (drag.current) onCommit?.()
          drag.current = null
        }}
      >
        {axis === 'n' ? '#' : axis.toUpperCase()}
      </span>
      <input
        className="nf__input"
        value={draft ?? String(value)}
        inputMode="decimal"
        aria-label={name}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const next = Number(draft)
            if (Number.isFinite(next)) emit(next)
            setDraft(null)
            onCommit?.()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(null)
          /* scrubbing is a mouse gesture; the arrows are how the same
             nudge is made without one. Shift takes ten steps at once. */
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (disabled) return
            e.preventDefault()
            const base = draft !== null && Number.isFinite(Number(draft)) ? Number(draft) : value
            const by = step * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
            setDraft(null)
            emit(Number((base + by).toFixed(2)))
            onCommit?.()
          }
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
  onCommit,
  snap,
}: {
  label: string
  value: Vec3
  onChange: (v: Vec3) => void
  step?: number
  disabled?: boolean
  onCommit?: () => void
  snap?: boolean
}) {
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z']
  return (
    <div className="nf-row">
      <span className="nf-row__label">{label}</span>
      {axes.map((a, i) => (
        <NumField
          key={a}
          axis={a}
          name={`${label} ${a.toUpperCase()}`}
          step={step}
          disabled={disabled}
          onCommit={onCommit}
          snap={snap}
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

/* ================= cube panel ================= */

function CubePanel({
  cube,
  kind,
  onChange,
  snap,
}: {
  cube: Cube | null
  kind: ProjectKind
  onChange: (fn: (c: Cube) => Cube) => void
  /** the toolbar magnet: whole units for the fields where they mean something */
  snap: boolean
}) {
  if (!cube) {
    return <p className="ed-hint">Select a cube in the outliner to edit it.</p>
  }

  const size = cubeSize(cube)
  // block models only accept one rotated axis, at fixed angles
  const blockLocked = kind === 'blocks'
  const locked = cube.locked

  return (
    <>
      {locked ? (
        <p className="ed-hint ed-hint--warn" style={{ marginBottom: 9 }}>
          <Icon name="lock" size={11} /> Locked. Unlock it below to move, resize or paint it.
        </p>
      ) : null}

      <div className="nf-grid">
        <NumRow
          label="Position"
          value={cube.from}
          disabled={locked}
          snap={snap}
          onChange={(from) => onChange((c) => setCubePosition(c, from))}
        />
        <NumRow label="Size" value={size} disabled={locked} snap={snap} onChange={(s) => onChange((c) => setCubeSize(c, s))} />
        <NumRow
          label="Pivot"
          value={cube.origin}
          disabled={locked}
          snap={snap}
          onChange={(origin) => onChange((c) => ({ ...c, origin }))}
        />
        <NumRow
          label="Rotation"
          value={cube.rotation}
          disabled={locked}
          step={blockLocked ? 22.5 : 2.5}
          onChange={(rotation) => onChange((c) => ({ ...c, rotation }))}
        />
        <div className="nf-row">
          <span className="nf-row__label">Inflate</span>
          <NumField
            axis="n"
            name="Inflate"
            value={cube.inflate}
            disabled={locked}
            onChange={(inflate) => onChange((c) => ({ ...c, inflate }))}
          />
          <span className="nf-row__label" style={{ textAlign: 'right' }}>
            Faces
          </span>
          <NumField
            axis="n"
            name="Textured faces"
            value={FACES.filter((f) => cube.faces[f].texture !== null).length}
            onChange={() => {}}
            disabled
          />
        </div>
      </div>

      {blockLocked ? (
        <p className="ed-hint ed-hint--warn">
          <Icon name="warning" size={11} /> Block models rotate on one axis only, at {'\u00b1'}22.5{'\u00b0'} or {'\u00b1'}45{'\u00b0'}.
        </p>
      ) : null}

      <div className="chip-row">
        <button
          className="chip"
          aria-pressed={cube.visible}
          onClick={() => onChange((c) => ({ ...c, visible: !c.visible }))}
        >
          <Icon name={cube.visible ? 'eye' : 'eyeOff'} size={11} /> Visible
        </button>
        <button
          className="chip"
          aria-pressed={cube.locked}
          onClick={() => onChange((c) => ({ ...c, locked: !c.locked }))}
        >
          <Icon name="lock" size={11} /> Locked
        </button>
        <button
          className="chip"
          onClick={() =>
            onChange((c) => ({
              ...c,
              origin: [
                (c.from[0] + c.to[0]) / 2,
                (c.from[1] + c.to[1]) / 2,
                (c.from[2] + c.to[2]) / 2,
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
  cube,
  face,
  onFace,
  onChange,
  onPaint,
}: {
  model: Model
  cube: Cube | null
  face: FaceKey
  onFace: (f: FaceKey) => void
  onChange: (fn: (c: Cube) => Cube) => void
  /** texel coordinates straight off the sheet, when paint mode is active */
  onPaint?: (x: number, y: number, phase: 'down' | 'move') => void
}) {
  const texture = model.textures[0]
  const { width, height } = model.resolution

  if (!cube) return <p className="ed-hint">No cube selected.</p>

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const current = cube.faces[face]

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
          const [x1, y1, x2, y2] = cube.faces[key].uv
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
              title={`${key} \u00b7 ${x1},${y1} \u2192 ${x2},${y2}`}
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
          <button key={key} className="chip" aria-pressed={key === face} onClick={() => onFace(key)}>
            {key}
          </button>
        ))}
      </div>

      <div className="nf-grid" style={{ marginTop: 9 }}>
        <div className="nf-row">
          <span className="nf-row__label">UV from</span>
          <NumField axis="x" name="UV from X" value={current.uv[0]} onChange={(v) => onChange((c) => patchUV(c, face, 0, v))} />
          <NumField axis="y" name="UV from Y" value={current.uv[1]} onChange={(v) => onChange((c) => patchUV(c, face, 1, v))} />
          <span className="nf-row__label" />
        </div>
        <div className="nf-row">
          <span className="nf-row__label">UV to</span>
          <NumField axis="x" name="UV to X" value={current.uv[2]} onChange={(v) => onChange((c) => patchUV(c, face, 2, v))} />
          <NumField axis="y" name="UV to Y" value={current.uv[3]} onChange={(v) => onChange((c) => patchUV(c, face, 3, v))} />
          <span className="nf-row__label" />
        </div>
      </div>

      <div className="chip-row">
        <button
          className="chip"
          title="Turn the texture within this face"
          onClick={() =>
            onChange((c) => ({
              ...c,
              faces: {
                ...c.faces,
                [face]: {
                  ...c.faces[face],
                  rotation: (((c.faces[face].rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270,
                },
              },
            }))
          }
        >
          <Icon name="rotate" size={11} /> Rotate texture {current.rotation ?? 0}°
        </button>
        <button
          className="chip"
          title="Swap the UV horizontally - a reversed rectangle is how a face mirrors"
          onClick={() =>
            onChange((c) => {
              const uv = c.faces[face].uv
              return {
                ...c,
                faces: { ...c.faces, [face]: { ...c.faces[face], uv: [uv[2], uv[1], uv[0], uv[3]] as UVRect } },
              }
            })
          }
        >
          <Icon name="flip" size={11} /> Mirror
        </button>
      </div>
    </>
  )
}

function patchUV(c: Cube, face: FaceKey, index: number, value: number): Cube {
  const uv = [...c.faces[face].uv] as UVRect
  uv[index] = value
  return { ...c, faces: { ...c.faces, [face]: { ...c.faces[face], uv } } }
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

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

function ColorPanel({ colour, onColour }: { colour: string; onColour: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
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

  const commitHex = () => {
    if (draft === null) return
    const m = HEX.exec(draft.trim())
    setDraft(null)
    if (!m) return
    const body = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
    const hex = `#${body.toLowerCase()}`
    const [h, s2, v] = hexToHsv(hex)
    setHue(h)
    setSat(s2)
    setVal(v)
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
        {/* it was a read-only input dressed as an editable one, so an exact
            colour could be read and never entered */}
        <input
          className="color-hex"
          value={draft ?? colour.toUpperCase()}
          aria-label="Colour, as hex"
          spellCheck={false}
          maxLength={7}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitHex()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(null)
          }}
        />
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
  onToggleBone,
  onModel,
  onRename,
  onMove,
}: {
  model: Model
  selected: string | null
  collapsed: Set<string>
  onSelect: (id: string) => void
  onToggleBone: (id: string) => void
  onModel: (label: string, fn: (m: Model) => Model) => void
  onRename: (id: string, name: string) => void
  /** null parent means "make it a root" */
  onMove: (id: string, parentId: string | null) => void
}) {
  const rows = useMemo(() => flattenBones(model, collapsed), [model, collapsed])
  const [editing, setEditing] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  /* Pointer events rather than HTML5 drag-and-drop. DnD does not exist
     on touch at all, and it needs the browser's own drag protocol, so
     the gesture would work on a mouse and nowhere else. A movement
     threshold keeps an ordinary click from being read as a drag. */
  const press = useRef<{ id: string; x: number; y: number; pointerId: number; moved: boolean } | null>(null)
  /* pointerup clears the drag before the click fires, so the click has
     to be told separately - otherwise releasing over a bone toggled it
     collapsed and hid the row you had just moved */
  const swallowClick = useRef(false)

  const rowUnder = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-node]') as HTMLElement | null
    return el?.dataset.node ?? null
  }

  const onRowMove = (e: React.PointerEvent) => {
    const held = press.current
    if (!held) return
    if (!held.moved && Math.hypot(e.clientX - held.x, e.clientY - held.y) < 5) return
    if (!held.moved) {
      held.moved = true
      setDragId(held.id)
      /* Capture only once a drag is real. Capturing on pointerdown
         retargets the click that follows to the capture element, which
         quietly killed row selection and double-click-to-rename. */
      e.currentTarget.setPointerCapture(held.pointerId)
    }
    const target = rowUnder(e.clientX, e.clientY)
    setOver(target && target !== held.id && bonesById.has(target) ? target : null)
  }

  const onRowUp = (e: React.PointerEvent) => {
    const held = press.current
    press.current = null
    if (held?.moved && e.currentTarget.hasPointerCapture(held.pointerId)) {
      e.currentTarget.releasePointerCapture(held.pointerId)
    }
    if (!held?.moved) {
      setDragId(null)
      setOver(null)
      return
    }
    swallowClick.current = true
    const target = rowUnder(e.clientX, e.clientY)
    // off the rows entirely means "make it a root"
    if (target !== held.id) onMove(held.id, target && bonesById.has(target) ? target : null)
    setDragId(null)
    setOver(null)
  }

  const bonesById = useMemo(() => {
    const map = new Map<string, true>()
    for (const r of rows) if (r.kind === 'bone') map.set(r.bone.id, true)
    return map
  }, [rows])

  const setBone = (id: string, patch: Partial<Bone>) =>
    onModel('bone toggle', (m) => {
      const walk = (bones: Bone[]): Bone[] =>
        bones.map((b) => ({
          ...(b.id === id ? { ...b, ...patch } : b),
          children: b.children.map((c) =>
            c.kind === 'bone' ? { kind: 'bone' as const, bone: walk([c.bone])[0] } : c,
          ),
        }))
      return { ...m, bones: walk(m.bones) }
    })

  const setCube = (id: string, patch: Partial<Cube>) =>
    onModel('cube toggle', (m) => ({
      ...m,
      cubes: m.cubes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))

  return (
    <div
      className="tree"
      role="tree"
      data-dragging={dragId ? true : undefined}
      onPointerMove={onRowMove}
      onPointerUp={onRowUp}
      onPointerCancel={() => {
        press.current = null
        setDragId(null)
        setOver(null)
      }}
    >
      {rows.map((row) => {
        const isBone = row.kind === 'bone'
        const node = isBone ? row.bone : row.cube
        const visible = node.visible
        const locked = node.locked
        return (
          <div
            key={node.id}
            role="treeitem"
            aria-selected={node.id === selected}
            data-hidden={!visible || undefined}
            data-drop={over === node.id || undefined}
            data-dragged={dragId === node.id || undefined}
            data-node={node.id}
            className="tree__row"
            style={{ paddingLeft: 6 + row.depth * 13 }}
            onPointerDown={(e) => {
              if (editing === node.id || e.button !== 0) return
              /* a fresh press is a fresh gesture: whatever the last drop
                 asked us to swallow, it is not this */
              swallowClick.current = false
              press.current = { id: node.id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, moved: false }
            }}
            onClick={() => {
              // a click that turned into a drag is not a selection
              if (dragId || swallowClick.current) {
                swallowClick.current = false
                return
              }
              onSelect(node.id)
              if (isBone && editing !== node.id) onToggleBone(node.id)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditing(node.id)
            }}
          >
            {isBone ? (
              <Icon
                name={collapsed.has(node.id) ? 'chevronRight' : 'chevronDown'}
                size={10}
                className="tree__icon"
              />
            ) : null}
            <Icon name={isBone ? 'folder' : 'cube'} size={12} className="tree__icon" />

            {editing === node.id ? (
              <input
                className="tree__rename"
                defaultValue={node.name}
                autoFocus
                maxLength={64}
                aria-label={`Rename ${node.name}`}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  onRename(node.id, e.target.value)
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <span className="tree__name" title="Double-click to rename, drag onto a bone to reparent">
                {node.name}
              </span>
            )}

            <button
              className="tree__toggle"
              data-on={locked || undefined}
              title={locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
              aria-label={locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
              onClick={(e) => {
                e.stopPropagation()
                if (isBone) setBone(node.id, { locked: !locked })
                else setCube(node.id, { locked: !locked })
              }}
            >
              <Icon name={locked ? 'lock' : 'unlock'} size={11} />
            </button>
            <button
              className="tree__toggle"
              data-on={visible || undefined}
              title={visible ? `Hide ${node.name}` : `Show ${node.name}`}
              aria-label={visible ? `Hide ${node.name}` : `Show ${node.name}`}
              onClick={(e) => {
                e.stopPropagation()
                if (isBone) setBone(node.id, { visible: !visible })
                else setCube(node.id, { visible: !visible })
              }}
            >
              <Icon name={visible ? 'eye' : 'eyeOff'} size={11} />
            </button>
          </div>
        )
      })}
      <div className="tree__root-drop">{dragId ? 'release here to make it a root' : null}</div>
    </div>
  )
}

/* ================= bone panel ================= */

/**
 * Bones are what animation drives, and they had no inspector at all -
 * selecting one emptied the left column and `Add Bone` produced
 * something fixed at the origin that could never be moved.
 */
function BonePanel({
  bone,
  onChange,
  snap,
}: {
  bone: Bone
  onChange: (patch: Partial<Omit<Bone, 'id' | 'children'>>) => void
  snap: boolean
}) {
  return (
    <>
      <div className="nf-grid">
        <NumRow
          label="Pivot"
          value={bone.origin}
          snap={snap}
          disabled={bone.locked}
          onChange={(origin) => onChange({ origin })}
        />
        <NumRow
          label="Rotation"
          value={bone.rotation}
          step={2.5}
          disabled={bone.locked}
          onChange={(rotation) => onChange({ rotation })}
        />
      </div>

      <p className="ed-hint" style={{ marginTop: 10 }}>
        <Icon name="info" size={11} /> The pivot is the joint this bone turns about, and every cube
        under it turns with it.
      </p>

      <div className="chip-row">
        <button className="chip" aria-pressed={bone.visible} onClick={() => onChange({ visible: !bone.visible })}>
          <Icon name={bone.visible ? 'eye' : 'eyeOff'} size={11} /> Visible
        </button>
        <button className="chip" aria-pressed={bone.locked} onClick={() => onChange({ locked: !bone.locked })}>
          <Icon name="lock" size={11} /> Locked
        </button>
      </div>
    </>
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
  label,
  grid,
  quad,
  extent,
  clip,
  time,
  selected,
  onSelect,
  onDeselect,
  onPaint,
  display,
}: {
  model: Model
  label: string
  grid: boolean
  quad: boolean
  /** the model's longest axis, in model units */
  extent: number
  clip: Clip | null
  time: number
  selected: string | null
  onSelect: (id: string) => void
  onDeselect: () => void
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
}) {
  const [shading, setShading] = useState<'solid' | 'wire'>('solid')

  /* The fit used to be `430 / extent` - a constant that assumed a
     desktop-sized viewport, so on a phone the model was cropped by the
     frame it was supposed to be fitted to. Measure instead. */
  const scene = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 680, h: 680 })
  useLayoutEffect(() => {
    const el = scene.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  /* The model stands ON the grid, and the grid sits at the middle of the
     scene, so the height a model actually has to fit into is the half
     above it - not the whole box. Fitting to the whole box is why the
     head was cropped off at every window size narrower than the one the
     old constant was tuned against. */
  const scale = Math.max(1.5, Math.min(16, Math.min(box.w * 0.6, box.h * 0.44) / extent))

  return (
    <div className="ed-view" data-quad={quad || undefined} data-shading={shading}>
      <div className="ed-view__scene" ref={scene}>
        {quad ? (
          <div className="ed-quad">
            {quadViews.map((v) => (
              <div className="ed-quad__cell" key={v.tag}>
                <span className="ed-quad__tag">{v.tag}</span>
                <ModelView
                  model={model}
                  grid={grid}
                  scale={scale * 0.55}
                  orbit
                  initialYaw={v.yaw}
                  initialPitch={v.pitch}
                  clip={clip}
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
          <ModelView
            model={model}
            grid={grid}
            scale={scale}
            orbit
            clip={clip}
            time={time}
            selected={selected}
            onSelect={onSelect}
            onDeselect={onDeselect}
            onPaint={onPaint}
            display={display}
          />
        )}

        <div className="ed-view__corner ed-view__corner--tl">
          <Icon name="cube" size={11} /> {label}
        </div>

        <div className="ed-view__corner ed-view__corner--tr">
          {(['solid', 'wire'] as const).map((s) => (
            <button key={s} className="ed-view__vbtn" aria-pressed={shading === s} onClick={() => setShading(s)}>
              {s === 'solid' ? 'Solid' : 'Wire'}
            </button>
          ))}
        </div>

        <div className="ed-view__corner ed-view__corner--bl">
          {onPaint
            ? 'drag a face to paint · backdrop or right-drag orbits · shift-drag pans · scroll zooms at the cursor'
            : 'drag to orbit · shift or middle-drag to pan · scroll to zoom at the cursor · click a cube'}
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

/* ================= animation ================= */

/** Everything the Animate-mode UI can do, in one place. */
type AnimApi = {
  clips: Clip[]
  clip: Clip | null
  bones: BoneRef[]
  bone: string | null
  setBone: (id: string) => void
  selectClip: (id: string) => void
  newClip: () => void
  duplicateClip: () => void
  removeClip: () => void
  patchClip: (patch: Partial<Omit<Clip, 'id' | 'tracks'>>) => void
  closeLoop: () => void
  addKey: (bone: string, channel: Channel) => void
  removeKey: (keyId: string) => void
  removeTrack: (bone: string, channel: Channel) => void
  selectedKey: string | null
  selectKey: (id: string | null) => void
  /** a key drag is one undo step, so it is bracketed rather than committed per frame */
  dragKey: (keyId: string, time: number, phase: 'down' | 'move' | 'up') => void
  patchKey: (keyId: string, patch: Partial<Omit<Key, 'id'>>, transient?: boolean) => void
  /** what kind of project this is - auto-animation is mobs only */
  kind: ProjectKind
  /** the model itself, so the rig reader has something to read */
  model: Model
  /** build a preset and select it; returns what it was called, or null */
  autoAnimate: (presetId: string) => string | null
}

/**
 * Strips the Minecraft-style `animation.<model>.` prefix and nothing
 * else. Taking the text after the last dot turned "2.5 second idle"
 * into "5 second idle" and "walk.cycle.v2" into "v2".
 */
export function clipLabel(name: string) {
  const m = /^animation\.[^.]+\.(.+)$/.exec(name)
  return m ? m[1] : name
}

const LOOPS: Array<Clip['loop']> = ['loop', 'once', 'hold']
const SNAPS = [0, 12, 24, 30, 60]

/**
 * What the rig reader made of this model, and the presets it can build
 * from that reading. It says what it found before it offers to animate
 * it, so a wrong guess - a "blade_left" read as an arm - is visible
 * rather than mysterious.
 */
function AutoAnimate({ anim }: { anim: AnimApi }) {
  const [note, setNote] = useState<string | null>(null)
  const rig = useMemo(() => readRig(anim.model), [anim.model])

  if (anim.kind !== 'mobs') {
    return (
      <p className="ed-hint">
        <Icon name="info" size={11} /> Auto-animation reads a skeleton, so it is for mobs. This is a{' '}
        {anim.kind.replace(/s$/, '')} project.
      </p>
    )
  }

  const say = (text: string) => {
    setNote(text)
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 5000)
  }

  return (
    <>
      <p className="ed-hint" style={{ marginTop: 0 }}>
        <Icon name="anim" size={11} /> Read {rig.bones.length} bones and found {rig.summary}.{' '}
        {rig.confidence >= 0.6
          ? 'Mostly from their names.'
          : rig.confidence > 0
            ? 'Mostly from their shape, since the names say little.'
            : 'From their shape alone - nothing is named in a way it recognises.'}
      </p>

      <div className="auto-grid">
        {AUTO_PRESETS.map((preset) => {
          const missing = preset.needs(rig)
          return (
            <button
              key={preset.id}
              className="auto"
              disabled={!!missing}
              title={missing ? `Cannot: ${missing}` : preset.blurb}
              onClick={() => {
                const name = anim.autoAnimate(preset.id)
                say(name ? `Built ${name}. Edit it like any other clip.` : `Nothing to drive for ${preset.label}.`)
              }}
            >
              <span className="auto__name">{preset.label}</span>
              <span className="auto__blurb">{missing ? `Cannot: ${missing}` : preset.blurb}</span>
            </button>
          )
        })}
      </div>

      {note ? <p className="ed-hint ed-hint--warn">{note}</p> : null}
      <p className="ed-hint">
        <Icon name="info" size={11} /> These are a starting pose set, not a finished animation - every
        key lands on the timeline and edits like one you placed yourself.
      </p>
    </>
  )
}

function AnimationPanel({ anim }: { anim: AnimApi }) {
  const { clip } = anim
  const boneList = useRef<HTMLDivElement>(null)

  if (!clip) {
    return (
      <>
        <p className="ed-hint">
          This model has no animations yet. An animation is a name, a length and the bones it drives.
        </p>
        <div className="chip-row">
          <button className="chip chip--go" onClick={anim.newClip}>
            <Icon name="plus" size={11} /> New animation
          </button>
        </div>
        <div className="ed-rule" />
        <AutoAnimate anim={anim} />
      </>
    )
  }

  return (
    <>
      <label className="ed-field">
        <span>Name</span>
        <input
          className="ed-input"
          value={clip.name}
          spellCheck={false}
          onChange={(e) => anim.patchClip({ name: e.target.value })}
        />
      </label>

      <div className="nf-grid" style={{ marginTop: 8 }}>
        <div className="nf-row">
          <span className="nf-row__label">Length</span>
          <NumField
            axis="n"
            name="Clip length in seconds"
            step={0.1}
            value={clip.length}
            onChange={(v) => anim.patchClip({ length: Math.max(0.1, Number(v.toFixed(3))) })}
          />
          <span className="nf-row__label" style={{ textAlign: 'right' }}>
            seconds
          </span>
          <span className="nf-row__label" />
        </div>
      </div>

      <label className="ed-field">
        <span>Loop</span>
        <select
          className="ed-select"
          value={clip.loop}
          onChange={(e) => anim.patchClip({ loop: e.target.value as Clip['loop'] })}
        >
          {LOOPS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="ed-field">
        <span>Snap</span>
        <select
          className="ed-select"
          value={clip.snapping}
          onChange={(e) => anim.patchClip({ snapping: Number(e.target.value) })}
        >
          {SNAPS.map((s) => (
            <option key={s} value={s}>
              {s ? `${s} per second` : 'off'}
            </option>
          ))}
        </select>
      </label>

      <div className="chip-row" style={{ marginTop: 9 }}>
        <button className="chip" onClick={anim.newClip} title="Create another animation">
          <Icon name="plus" size={11} /> New
        </button>
        <button className="chip" onClick={anim.duplicateClip}>
          <Icon name="copy" size={11} /> Duplicate
        </button>
        <button className="chip" onClick={anim.closeLoop} title="Copy each track's first key to the end">
          <Icon name="refresh" size={11} /> Close loop
        </button>
        <button className="chip chip--danger" onClick={anim.removeClip}>
          <Icon name="trash" size={11} /> Delete
        </button>
      </div>

      <p className="ed-hint" style={{ marginTop: 10 }}>
        Animating
      </p>
      {/* the options carried aria-selected but no tab stop, so this list
          could be read and never reached. Roving tabindex: one stop for
          the list, arrows within it, selection follows focus. */}
      <div
        className="tree tree--short"
        role="listbox"
        aria-label="Bone to animate"
        ref={boneList}
        onKeyDown={(e) => arrowNav(boneList.current, e, { select: '[role="option"]' })}
      >
        {anim.bones.map((b) => (
          <div
            key={b.id}
            role="option"
            aria-selected={b.id === anim.bone}
            tabIndex={b.id === anim.bone ? 0 : -1}
            className="tree__row"
            style={{ paddingLeft: 6 + b.depth * 13 }}
            onFocus={() => anim.setBone(b.id)}
            onClick={() => anim.setBone(b.id)}
          >
            <Icon name="folder" size={12} className="tree__icon" />
            <span className="tree__name">{b.name}</span>
            {clip.tracks.some((t) => t.bone === b.id) ? <span className="tl-name__ch">keyed</span> : null}
          </div>
        ))}
        {!anim.bones.length ? <p className="ed-hint">This model has no bones to animate.</p> : null}
      </div>

      <div className="ed-rule" />
      <AutoAnimate anim={anim} />
    </>
  )
}

function KeyframePanel({ anim }: { anim: AnimApi }) {
  const found = useMemo(() => {
    const clip = anim.clip
    const id = anim.selectedKey
    if (!clip || !id) return null
    const track = clip.tracks.find((t) => t.keys.some((k) => k.id === id))
    const key = track?.keys.find((k) => k.id === id)
    return track && key ? { track, key } : null
  }, [anim.clip, anim.selectedKey])

  if (!found) {
    return (
      <p className="ed-hint">
        Select a keyframe on the timeline to edit it, or press the <Icon name="key" size={11} /> beside a
        channel to add one at the playhead.
      </p>
    )
  }

  const { track, key } = found
  const boneName = anim.bones.find((b) => b.id === track.bone)?.name ?? track.bone
  const step = track.channel === 'rotation' ? 2.5 : track.channel === 'scale' ? 0.05 : 0.5

  return (
    <>
      <p className="ed-hint" style={{ marginBottom: 8 }}>
        <Icon name="folder" size={11} /> {boneName} <span className="tl-name__ch">{track.channel}</span>
      </p>

      <div className="nf-grid">
        <NumRow
          label={track.channel}
          value={key.value}
          step={step}
          onChange={(value) => anim.patchKey(key.id, { value }, true)}
          onCommit={() => anim.patchKey(key.id, {})}
        />
        <div className="nf-row">
          <span className="nf-row__label">Time</span>
          <NumField
            axis="n"
            name="Keyframe time in seconds"
            step={0.05}
            value={key.time}
            onChange={(time) => anim.patchKey(key.id, { time })}
          />
          <span className="nf-row__label" style={{ textAlign: 'right' }}>
            of {anim.clip?.length}s
          </span>
          <span className="nf-row__label" />
        </div>
      </div>

      <label className="ed-field">
        <span>Easing</span>
        <select
          className="ed-select"
          value={key.interp}
          onChange={(e) => anim.patchKey(key.id, { interp: e.target.value as Key['interp'] })}
        >
          <option value="linear">linear</option>
          <option value="step">step</option>
          <option value="catmullrom">smooth</option>
        </select>
      </label>

      <div className="chip-row" style={{ marginTop: 9 }}>
        <button className="chip chip--danger" onClick={() => anim.removeKey(key.id)}>
          <Icon name="trash" size={11} /> Delete keyframe
        </button>
        <button className="chip" onClick={() => anim.removeTrack(track.bone, track.channel)}>
          <Icon name="trash" size={11} /> Clear channel
        </button>
      </div>
    </>
  )
}

/* ================= timeline ================= */

/* The scale used to be this constant and nothing else, so a 0.5s clip
   occupied 48px of a 1500px panel with every key within six pixels of
   its neighbour, and a 40s clip could only be scrolled. */
const PX_MIN = 12
const PX_MAX = 1200
const PX_DEFAULT = 96

type Row = { key: string; bone: string; boneName: string; channel: Channel; track: Track | null }

function Timeline({
  anim,
  time,
  onTime,
  playing,
  onPlaying,
}: {
  anim: AnimApi
  time: number
  onTime: (t: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
}) {
  const { clip } = anim
  const length = clip?.length ?? 1
  const [pxPerS, setPxPerS] = useState(PX_DEFAULT)
  const main = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; start: number } | null>(null)

  const clampPx = (v: number) => Math.max(PX_MIN, Math.min(PX_MAX, v))

  /** Fill the panel with the clip, which is what you want nine times in ten. */
  const fit = useCallback(() => {
    const width = main.current?.clientWidth
    if (!width || !clip) return
    setPxPerS(clampPx((width - 178 - 24) / Math.max(clip.length, 0.05)))
  }, [clip])

  // ctrl or shift + wheel zooms the timeline, as it does in every editor
  useEffect(() => {
    const node = main.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.shiftKey) return
      e.preventDefault()
      setPxPerS((v) => clampPx(v * Math.exp(-e.deltaY * 0.002)))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  /* Ticks follow the scale: whole seconds when there is room, tenths
     when the clip is short enough that seconds say nothing. */
  const tickStep = pxPerS >= 220 ? 0.1 : pxPerS >= 60 ? 1 : pxPerS >= 24 ? 5 : 10
  const ticks = Math.max(1, Math.ceil(length / tickStep))
  const trackW = Math.max(ticks * tickStep * pxPerS, 1)

  const nameOf = useCallback(
    (id: string) => anim.bones.find((b) => b.id === id)?.name ?? id,
    [anim.bones],
  )

  /* One row per bone-channel pair. The bone being animated always shows
     all three channels even when empty - that empty row is how you key a
     channel for the first time - and every other keyed bone follows. */
  const rows = useMemo<Row[]>(() => {
    if (!clip) return []
    const out: Row[] = []
    const seen = new Set<string>()
    if (anim.bone) {
      for (const channel of CHANNELS) {
        const key = `${anim.bone}:${channel}`
        seen.add(key)
        out.push({
          key,
          bone: anim.bone,
          boneName: nameOf(anim.bone),
          channel,
          track: findTrack(clip, anim.bone, channel),
        })
      }
    }
    for (const track of clip.tracks) {
      const key = `${track.bone}:${track.channel}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ key, bone: track.bone, boneName: nameOf(track.bone), channel: track.channel, track })
    }
    return out
  }, [clip, anim.bone, nameOf])

  /* The playhead lives in a ref for the duration of a playthrough.
     Depending on `time` tore the loop down and rebuilt it on every
     frame, and `last` was reset each time - so the gap between the
     state update and the effect re-running was simply dropped, and a
     one-second clip took nearly two seconds to play.

     `loop` used to be a label too. The tick wrapped unconditionally, so
     `once` and `hold` were byte-identical to `loop` - and the shipped
     `strike` clip is authored `once` and ran forever. */
  const timeRef = useRef(time)
  useEffect(() => {
    timeRef.current = time
  }, [time])

  useEffect(() => {
    if (!playing || !clip) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = timeRef.current + dt
      timeRef.current = next
      if (next < clip.length) {
        onTime(next)
        raf = requestAnimationFrame(tick)
        return
      }
      if (clip.loop === 'loop') {
        const wrapped = clip.length ? next % clip.length : 0
        timeRef.current = wrapped
        onTime(wrapped)
        raf = requestAnimationFrame(tick)
        return
      }
      // hold freezes on the last pose; once drops back to the rest pose
      const end = clip.loop === 'hold' ? clip.length : 0
      timeRef.current = end
      onTime(end)
      onPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, clip, onTime, onPlaying])

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return
    const r = e.currentTarget.getBoundingClientRect()
    onTime(Math.max(0, Math.min(length, (e.clientX - r.left) / pxPerS)))
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
          disabled={!clip}
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
          value={clip?.id ?? ''}
          onChange={(e) => anim.selectClip(e.target.value)}
          aria-label="Animation"
          disabled={!anim.clips.length}
        >
          {anim.clips.length ? null : <option value="">no animations</option>}
          {anim.clips.map((c) => (
            <option key={c.id} value={c.id}>
              {clipLabel(c.name)} · {c.length}s
            </option>
          ))}
        </select>
        <button className="ed-tool" title="New animation" aria-label="New animation" onClick={anim.newClip}>
          <Icon name="plus" size={14} />
        </button>
        <button
          className="chip"
          title="How this animation ends"
          disabled={!clip}
          onClick={() =>
            clip && anim.patchClip({ loop: LOOPS[(LOOPS.indexOf(clip.loop) + 1) % LOOPS.length] })
          }
        >
          <Icon name="refresh" size={11} /> {clip?.loop ?? 'once'}
        </button>

        <div className="ed-toolbar__right">
          <div className="ed-tools" role="group" aria-label="Timeline zoom">
            <button
              className="ed-tool"
              title="Zoom the timeline out"
              aria-label="Zoom timeline out"
              onClick={() => setPxPerS((v) => clampPx(v / 1.5))}
            >
              <Icon name="minus" size={14} />
            </button>
            <button className="ed-tool" title="Fit the clip to the panel" aria-label="Fit timeline" onClick={fit}>
              <Icon name="resize" size={14} />
            </button>
            <button
              className="ed-tool"
              title="Zoom the timeline in"
              aria-label="Zoom timeline in"
              onClick={() => setPxPerS((v) => clampPx(v * 1.5))}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
          <span className="ed-sep" />
          <button
            className="ed-tool"
            title="Add a keyframe to the animated bone's rotation at the playhead"
            aria-label="Add keyframe"
            disabled={!clip || !anim.bone}
            onClick={() => anim.bone && anim.addKey(anim.bone, 'rotation')}
          >
            <Icon name="key" size={14} />
          </button>
          <button
            className="ed-tool"
            title="Delete the selected keyframe"
            aria-label="Delete keyframe"
            disabled={!anim.selectedKey}
            onClick={() => anim.selectedKey && anim.removeKey(anim.selectedKey)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      {clip ? (
        /* One scroller, not two. The names column and the track column
           used to scroll independently, so a single wheel gesture over
           the tracks offset the labels by up to ten rows and the
           timeline started reporting the wrong bone for every key. The
           names are sticky inside the same grid instead. */
        <div className="tl-main" ref={main}>
          <div
            className="tl-grid"
            style={{ ['--track-w' as string]: `${trackW}px`, ['--px-per-s' as string]: `${pxPerS}px` }}
          >
            <div className="tl-corner">Channels</div>
            <div className="tl-ruler" style={{ width: trackW }} onPointerDown={scrub} onPointerMove={scrub}>
              {Array.from({ length: ticks }, (_, i) => (
                <span className="tl-tick" key={i} style={{ width: tickStep * pxPerS }}>
                  {Number((i * tickStep).toFixed(2))}s
                </span>
              ))}
              <span className="tl-end" style={{ left: length * pxPerS }} title={`clip ends at ${length}s`} />
            </div>

            {rows.map((r) => (
              <Fragment key={r.key}>
                <div className="tl-name" data-on={r.bone === anim.bone || undefined}>
                  <Icon name="folder" size={11} />
                  {/* the row used to be a div carrying aria-selected and a
                      click handler: no role, no tab stop, nothing a
                      keyboard could reach. The label is the button now. */}
                  <button
                    className="tl-name__bone"
                    aria-pressed={r.bone === anim.bone}
                    onClick={() => anim.setBone(r.bone)}
                  >
                    {r.boneName}
                  </button>
                  <span className="tl-name__ch">{r.channel.slice(0, 3)}</span>
                  <button
                    className="tl-name__btn"
                    title={`Key ${r.boneName} ${r.channel} at the playhead`}
                    aria-label={`Key ${r.boneName} ${r.channel}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      anim.addKey(r.bone, r.channel)
                    }}
                  >
                    <Icon name="key" size={11} />
                  </button>
                </div>

                <div
                  className="tl-track"
                  style={{ width: trackW }}
                  onDoubleClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onTime(Math.max(0, Math.min(length, (e.clientX - rect.left) / pxPerS)))
                    anim.addKey(r.bone, r.channel)
                  }}
                >
                  {(r.track?.keys ?? []).map((kf) => (
                    <button
                      key={kf.id}
                      className="tl-key"
                      data-interp={kf.interp}
                      data-selected={kf.id === anim.selectedKey || undefined}
                      data-past-end={kf.time > length + 1e-9 || undefined}
                      style={{ left: kf.time * pxPerS }}
                      title={`${r.boneName} \u00b7 ${r.channel} @ ${kf.time.toFixed(2)}s \u2192 ${kf.value.join(', ')} (${kf.interp})`}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                        drag.current = { id: kf.id, x: e.clientX, start: kf.time }
                        anim.selectKey(kf.id)
                        anim.setBone(r.bone)
                        onTime(Math.min(kf.time, length))
                        onPlaying(false)
                      }}
                      onPointerMove={(e) => {
                        const d = drag.current
                        if (!d || d.id !== kf.id || e.buttons !== 1) return
                        anim.dragKey(kf.id, d.start + (e.clientX - d.x) / pxPerS, 'move')
                      }}
                      onPointerUp={() => {
                        if (drag.current?.id === kf.id) anim.dragKey(kf.id, kf.time, 'up')
                        drag.current = null
                      }}
                    />
                  ))}
                </div>
              </Fragment>
            ))}

            {rows.length ? null : (
              <>
                <div className="tl-name">pick a bone to animate</div>
                <div className="tl-track" style={{ width: trackW }} />
              </>
            )}

            <span className="tl-playhead" style={{ left: `calc(var(--names-w) + ${time * pxPerS}px)` }} />
          </div>
        </div>
      ) : (
        <div className="tl-empty">
          <p>No animation yet.</p>
          <button className="chip chip--go" onClick={anim.newClip}>
            <Icon name="plus" size={11} /> New animation
          </button>
        </div>
      )}
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

/** Which bone holds a given cube, so Animate mode can follow your selection. */
function ownerBone(bones: Bone[], cubeId: string | null): string | null {
  if (!cubeId) return null
  for (const b of bones) {
    if (b.children.some((c) => c.kind === 'cube' && c.id === cubeId)) return b.id
    const nested = ownerBone(
      b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone),
      cubeId,
    )
    if (nested) return nested
  }
  return null
}

/**
 * What the route asks the editor to open.
 *
 * `#/editor/<sample>` opens a model that ships with the app.
 * `#/editor/new/<kind>/<subtype>/<name>` builds one, which is how the
 * library's New Model button gets here: a URL survives a reload and a
 * hand-off through memory does not, so the new model is described
 * rather than passed.
 */
function startFrom(segments: string[]): { model: Model; file: string; kind: ProjectKind } {
  if (segments[1] === 'new') {
    const kind: ProjectKind =
      segments[2] === 'mobs' || segments[2] === 'blocks' ? segments[2] : 'items'
    const sub = subtypeFits(kind, segments[3]) ? segments[3] : defaultSubtype(kind)
    // the URL is user-typeable, so the name goes through the same sieve the dialog uses
    const name =
      decodeURIComponent(segments[4] ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'untitled'
    return { model: createModel(kind, name, sub), file: `${name}.vellum`, kind }
  }
  const sample = sampleById(segments[1] ?? '')
  return { model: sample.model, file: sample.file, kind: sample.kind }
}

export function Editor({ segments }: { segments: string[] }) {
  const initial = useMemo(() => startFrom(segments), [segments])

  const history = useHistory<Model>(initial.model)
  const model = history.present

  const [fileName, setFileName] = useState(initial.file)
  const [kind, setKind] = useState<ProjectKind>(initial.kind)
  /* No state of its own: a subtype is nothing but what the document
     says, and a second copy of it is a second thing to keep in step. */
  const subtype = model.subtype
  const [mode, setMode] = useState<Mode>('edit')
  const [tool, setTool] = useState('move')
  const [grid, setGrid] = useState(true)
  const [quad, setQuad] = useState(false)
  const [selected, setSelected] = useState<string | null>(initial.model.cubes[0]?.id ?? null)
  const [face, setFace] = useState<FaceKey>('north')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [leftW, setLeftW] = useState(300)
  const [rightW, setRightW] = useState(284)
  const fileInput = useRef<HTMLInputElement>(null)

  // animation
  const [clipId, setClipId] = useState<string | null>(initial.model.clips[0]?.id ?? null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pickedBone, setPickedBone] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // paint
  const [colour, setColour] = useState('#cd594e')
  const [brush, setBrush] = useState(1)
  const [shape, setShape] = useState<ShapeKind>('rect')
  const [shapeFilled, setShapeFilled] = useState(false)
  const [snap, setSnap] = useState(true)
  const [textureIndex, setTextureIndex] = useState(0)
  const shapeFrom = useRef<[number, number] | null>(null)
  const shapeUndo = useRef<ImageData | null>(null)
  const surfaces = useRef(new Map<string, PixelSurface>())
  const lastTexel = useRef<[number, number] | null>(null)
  const commitTimer = useRef(0)

  // display
  const [slot, setSlot] = useState<SlotId>('thirdperson_righthand')
  const [displayState, setDisplayState] = useState<DisplayState>(DEFAULT_DISPLAY)

  const [openError, setOpenError] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  /* Dirty is the model we have now against the last one written to disk
     or read from it. Every edit produces a new Model object, so this
     needs no diffing and cannot drift - it is exact. */
  const [savedModel, setSavedModel] = useState<Model>(initial.model)
  const dirty = model !== savedModel
  /** the scene overlay: the model in a world, at a size you can judge */
  const [worldOpen, setWorldOpen] = useState(false)

  /* Behaviour preview. Its clock is separate from the animation
     playhead: the cycle is minutes long where a clip is seconds, and
     scrubbing one has nothing to do with the other. */
  const [bhvTime, setBhvTime] = useState(0)
  const [bhvPlaying, setBhvPlaying] = useState(false)
  // the tab carries the unsaved marker too, not only the menu bar
  useTitle(`${dirty ? '\u2022 ' : ''}${fileName}`)

  /** Something irreversible, waiting on an answer. */
  const [pending, setPending] = useState<{
    title: string
    body: string
    confirmLabel: string
    run: () => void
  } | null>(null)

  /** Set for exactly one navigation, once the user has said to discard. */
  const allowNav = useRef(false)

  /* What was selected when each model was current. Undo used to leave
     the panels pointing at nothing - or, after undoing a delete, at the
     wrong cube - because selection lived outside the history entirely.
     A WeakMap keyed on the model object needs no bookkeeping and cannot
     hold a model alive. */
  const selectionAt = useRef(new WeakMap<Model, string | null>())

  const loadModel = useCallback(
    (next: Model, name: string, nextKind: ProjectKind = 'items') => {
      // what the document says it is beats what the last one was
      const resolved = next.kind ?? nextKind
      history.reset(next)
      setSavedModel(next)
      setFileName(vellumFileName(name))
      setKind(resolved)
      setSelected(next.cubes[0]?.id ?? null)
      setClipId(next.clips[0]?.id ?? null)
      setPickedBone(null)
      setSelectedKey(null)
      setCollapsed(new Set())
      setTime(0)
      setPlaying(false)
      setMode('edit')
      // display slots are a preview of THIS model, not the last one
      setDisplayState(DEFAULT_DISPLAY)
      setSlot('thirdperson_righthand')
    },
    [history],
  )

  /* Order matters here. Recording runs first, so on the render an undo
     produces it would stamp the *new* selection onto the *old* model and
     the restore below would read back what it was trying to replace. It
     stands down for exactly that render instead. */
  const lastTravel = useRef(0)

  useEffect(() => {
    if (history.travel !== lastTravel.current) return
    selectionAt.current.set(model, selected)
  }, [model, selected, history.travel])

  useEffect(() => {
    if (history.travel === lastTravel.current) return
    lastTravel.current = history.travel
    const was = selectionAt.current.get(history.present)
    if (was !== undefined) setSelected(was)
  }, [history.travel, history.present])

  /* The tool palette changes per mode; keep the active tool valid.
     Behaviour has no tools at all - it is two lists, not a canvas - so
     there is nothing to fall back to and the tool is simply left as it
     was for whichever mode comes next. */
  useEffect(() => {
    const set = toolsets[mode]
    if (set.length && !set.some((t) => t.id === tool)) setTool(set[0].id)
  }, [mode, tool])

  // Animate mode opens playing when there is something to play: a still
  // first frame reads as "animation broken". Any edit stops it again.
  useEffect(() => {
    if (mode !== 'animate') setPlaying(false)
  }, [mode])

  /* Painting writes into a decoded canvas and re-encodes the model's
     data URI out of it, so the cache and the model can disagree - and
     when they do, the cache wins the next time a stroke lands. Undo is
     exactly that case: it puts the old texture back on the model and
     leaves the canvas holding the pixels it just took away, so the next
     stroke re-encodes the whole stale canvas over the top and the
     undone stroke reappears.

     So the cache remembers what it last encoded. Anything that changes
     a texture from outside painting - an undo, a redo, a file opened -
     no longer matches, and is decoded again before it can be painted
     on. Keying this on the loaded model instead was the bug. */
  const encoded = useRef(new Map<string, string>())
  const decoding = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false

    // a texture the model no longer carries must not linger in the cache
    const live = new Set(model.textures.map((t) => t.id))
    for (const id of [...surfaces.current.keys()]) {
      if (live.has(id)) continue
      surfaces.current.delete(id)
      encoded.current.delete(id)
    }

    const stale = model.textures.filter((t) => encoded.current.get(t.id) !== t.source)
    if (!stale.length) return

    for (const t of stale) decoding.current.add(t.id)
    void Promise.all(
      stale.map(async (t) => {
        try {
          const surface = await loadSurface(t)
          if (cancelled) return
          surfaces.current.set(t.id, surface)
          encoded.current.set(t.id, t.source)
        } catch {
          /* an undecodable texture simply cannot be painted */
        } finally {
          decoding.current.delete(t.id)
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [model.textures])

  /** Re-encode a painted canvas back into the model, batched to a frame. */
  const writeTexture = useCallback(
    (id: string) => {
      const surface = surfaces.current.get(id)
      if (!surface) return
      const source = toDataUrl(surface)
      // recorded before the write, so the effect above can tell this
      // change came from the cache and must not be decoded straight back
      encoded.current.set(id, source)
      history.amend((m) => ({
        ...m,
        textures: m.textures.map((t) => (t.id === id ? { ...t, source } : t)),
      }))
    },
    [history],
  )

  const pendingTexture = useRef<string | null>(null)
  const commitTexture = useCallback(
    (id: string) => {
      pendingTexture.current = id
      if (commitTimer.current) return
      commitTimer.current = requestAnimationFrame(() => {
        commitTimer.current = 0
        pendingTexture.current = null
        writeTexture(id)
      })
    },
    [writeTexture],
  )

  /* Growing the UV sheet means redrawing every texture at double size.
     The decoded canvas is already in hand, so this is a nearest-
     neighbour blit - lossless for pixel art, and synchronous. */
  const rescale = useCallback<Rescale>((texture, factor) => {
    const surface = surfaces.current.get(texture.id)
    if (!surface) return null
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(surface.width * factor))
    canvas.height = Math.max(1, Math.round(surface.height * factor))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(surface.canvas, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }, [])

  /** Land the last frame of a stroke before its undo step is closed. */
  const flushTexture = useCallback(() => {
    if (!commitTimer.current) return
    cancelAnimationFrame(commitTimer.current)
    commitTimer.current = 0
    const id = pendingTexture.current
    pendingTexture.current = null
    if (id) writeTexture(id)
  }, [writeTexture])

  const clip = useMemo(
    () => model.clips.find((c) => c.id === clipId) ?? model.clips[0] ?? null,
    [model.clips, clipId],
  )

  const behaviour = model.behaviour ?? EMPTY_BEHAVIOUR
  const config = useMemo(
    () => ({ ...(hasConfig(kind) ? emptyConfig(kind) : {}), ...(model.config ?? {}) }),
    [kind, model.config],
  )
  const bhvNow = useMemo(() => stageAt(behaviour, bhvTime), [behaviour, bhvTime])

  /* The stage's clip loops inside the stage for as long as the stage
     lasts: a 7s charge on a 2s idle plays it three and a half times,
     which is what "plays while it charges" has to mean. */
  const bhvClip = useMemo(
    () => model.clips.find((c) => c.id === bhvNow.stage?.clip) ?? null,
    [model.clips, bhvNow.stage],
  )
  const bhvClipTime = bhvClip?.length ? bhvNow.local % bhvClip.length : 0

  useEffect(() => {
    if (!bhvPlaying || mode !== 'behaviour' || cycleLength(behaviour) <= 0) return
    let raf = 0
    let last = performance.now()
    const tick = (at: number) => {
      const dt = (at - last) / 1000
      last = at
      setBhvTime((t) => t + dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bhvPlaying, mode, behaviour])

  const setBehaviour = useCallback(
    (next: Behaviour) => history.commit('behaviour', (m) => ({ ...m, behaviour: next })),
    [history],
  )

  const setConfig = useCallback(
    (next: MythicConfig) => history.commit('config', (m) => ({ ...m, config: next })),
    [history],
  )
  const bones = useMemo(() => boneList(model.bones), [model.bones])
  const animBone = useMemo(() => {
    if (pickedBone && bones.some((b) => b.id === pickedBone)) return pickedBone
    return ownerBone(model.bones, selected) ?? bones[0]?.id ?? null
  }, [pickedBone, bones, model.bones, selected])

  const issues = useMemo(() => validateModel(model, kind), [model, kind])
  const errors = issues.filter((i) => i.level === 'error').length
  /* A panel that says "clean" while holding a warning is worse than one
     that says nothing: it is the thing the user checks before shipping. */
  const warnings = issues.length - errors
  const cube = model.cubes.find((c) => c.id === selected) ?? null
  const selectedBone = selected ? boneById(model, selected) : null

  /* Selecting a bone in the outliner is also how you choose what Animate
     mode drives, so the two never disagree. */
  const selectNode = useCallback(
    (id: string) => {
      setSelected(id)
      if (bones.some((b) => b.id === id)) setPickedBone(id)
    },
    [bones],
  )

  const rename = useCallback(
    (id: string, name: string) => history.commit('rename', (m) => renameNode(m, id, name)),
    [history],
  )

  const move = useCallback(
    (id: string, parentId: string | null) => {
      history.commit('reparent', (m) => reparent(m, id, parentId))
      /* Drop into a collapsed bone and the row you just moved vanished:
         it was inside a branch nothing was showing. Open the branch you
         dropped into, the way every file tree does. */
      if (parentId)
        setCollapsed((s) => {
          if (!s.has(parentId)) return s
          const next = new Set(s)
          next.delete(parentId)
          return next
        })
    },
    [history],
  )

  const editBone = useCallback(
    (id: string, patch: Partial<Omit<Bone, 'id' | 'children'>>) =>
      history.commit('bone edit', (m) => updateBone(m, id, patch), true),
    [history],
  )

  const editCube = useCallback(
    (fn: (c: Cube) => Cube) => {
      if (!selected) return
      /* A padlock that stops nothing is decoration. It is stored, it is
         serialised, it dims the outliner row - and every transform,
         every brush stroke and Delete all went straight through it. */
      if (model.cubes.find((c) => c.id === selected)?.locked) return
      history.commit(
        'cube edit',
        (m) => ({ ...m, cubes: m.cubes.map((c) => (c.id === selected ? fn(c) : c)) }),
        true,
      )
    },
    [selected, history, model.cubes],
  )

  /** Say why nothing happened, once, rather than ignoring the gesture. */
  const refuseLocked = useCallback((what: string) => {
    setSaveNote(`${what} is locked \u2014 unlock it in the outliner first.`)
    window.setTimeout(() => setSaveNote(null), 3000)
  }, [])

  /* Four gestures used to throw work away without a word: reload,
     leaving for another route, New model, and Open. The browser owns
     the first - `beforeunload` is the only hook it offers. The other
     three are ours, because a hash change never unloads the document
     and neither dialog knew there was anything to lose. */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const unsaved = `${fileName} has changes that have not been saved, and undo does not reach back across a model change.`

  useEffect(() => {
    if (!dirty) return
    return blockNavigation((to) => {
      if (allowNav.current) {
        allowNav.current = false
        return true
      }
      setPending({
        title: 'Leave the editor?',
        body: unsaved,
        confirmLabel: 'Discard and leave',
        run: () => {
          allowNav.current = true
          navigate(to)
        },
      })
      return false
    })
  }, [dirty, unsaved])

  /** Run `next`, asking first when it would discard unsaved work. */
  const guarded = useCallback(
    (title: string, confirmLabel: string, next: () => void) => {
      if (!dirty) {
        next()
        return
      }
      setPending({ title, body: unsaved, confirmLabel, run: next })
    },
    [dirty, unsaved],
  )

  const runSave = useCallback((name: string, text: string, snapshot: Model) => {
    void saveFile(name, text).then((note) => {
      // a declined or failed save wrote nothing, so the model is still dirty
      if (note.startsWith('Saved')) setSavedModel(snapshot)
      setSaveNote(note)
      window.setTimeout(() => setSaveNote(null), 6000)
    })
  }, [])

  /* One texel, one tool. Everything upstream - the 2D sheet and the 3D
     back-projection - resolves to a call here. */
  const applyTool = useCallback(
    (
      textureId: string,
      x: number,
      y: number,
      bounds: UVRect | null,
      phase: 'down' | 'move',
      /**
       * Where a brush or shape stamp may write. Set when painting on the
       * model, where a stamp that runs off the face lands on some other
       * cube; null on the 2D sheet, where the whole atlas is the canvas
       * and clipping to an island would make half the tools useless.
       * `bounds` is separate: it is what a fill is bounded by.
       */
      clip: UVRect | null = null,
    ) => {
      const surface = surfaces.current.get(textureId)
      /* A stroke started in the same frame as an undo would otherwise
         land on the canvas being replaced, and re-encode it. Dropping
         those few texels is the cheaper mistake. */
      if (!surface || decoding.current.has(textureId)) return

      if (tool === 'pipette') {
        const sampled = pick(surface, x, y)
        // a transparent texel used to be indistinguishable from a missed click
        if (!sampled) return
        if (sampled[3] === 0) {
          setSaveNote('That texel is transparent \u2014 nothing to pick.')
          window.setTimeout(() => setSaveNote(null), 2500)
          return
        }
        setColour(rgbaToHex(sampled))
        return
      }

      /* Rectangle or ellipse between where the drag started and where it
         is now. The canvas is restored from a snapshot on every move so
         the shape follows the cursor instead of leaving a smear - which
         is what this tool did before, being the brush with a new icon. */
      if (tool === 'shape') {
        if (phase === 'down') {
          shapeFrom.current = [x, y]
          shapeUndo.current = surface.ctx.getImageData(0, 0, surface.width, surface.height)
          lastTexel.current = [x, y]
          return
        }
        const from = shapeFrom.current
        const snapshot = shapeUndo.current
        if (!from || !snapshot) return
        surface.ctx.putImageData(snapshot, 0, 0)
        drawShape(surface, from, [x, y], hexToRgba(colour), shape, shapeFilled, brush, clip)
        lastTexel.current = [x, y]
        commitTexture(textureId)
        return
      }

      if (tool === 'bucket') {
        if (phase === 'down') {
          bucket(surface, x, y, hexToRgba(colour), bounds ?? [0, 0, surface.width, surface.height])
          commitTexture(textureId)
        }
        return
      }

      const rgba = tool === 'eraser' ? ([0, 0, 0, 0] as [number, number, number, number]) : hexToRgba(colour)
      const stamp = (px: number, py: number) => paintTexels(surface, px, py, rgba, brush, clip)

      // a fast drag would otherwise dot rather than draw
      if (phase === 'move' && lastTexel.current) strokeBetween(lastTexel.current, [x, y], stamp)
      else stamp(x, y)

      lastTexel.current = [x, y]
      commitTexture(textureId)
    },
    [tool, colour, brush, shape, shapeFilled, commitTexture],
  )

  /* A stroke is one undo step, however many texels it wrote. The last
     frame is flushed first, or it would land after the step closed. */
  useEffect(() => {
    const done = () => {
      shapeFrom.current = null
      shapeUndo.current = null
      if (!lastTexel.current && !commitTimer.current) return
      lastTexel.current = null
      flushTexture()
      history.end()
    }
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
    return () => {
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
    }
  }, [flushTexture, history])

  /** A click on the model, back-projected through that face's UV rectangle. */
  const paintOnModel = useCallback(
    (cubeId: string, faceKey: FaceKey, u: number, v: number, phase: 'down' | 'move') => {
      const target = model.cubes.find((c) => c.id === cubeId)
      if (!target) return
      if (target.locked) {
        if (phase === 'down') refuseLocked(`"${target.name}"`)
        return
      }
      if (phase === 'down') {
        // the pipette reads a pixel; it is not an edit and must not
        // leave an empty step for the user to click back through
        if (tool !== 'pipette') history.begin('paint')
        setSelected(cubeId)
        setFace(faceKey)
      }
      const f = target.faces[faceKey]
      if (f.texture === null) return
      const texel = texelOfFace(f.uv, u, v)
      // a zero-area UV has no texel under the click, so there is nothing to paint
      if (!texel) return
      applyTool(f.texture, texel[0], texel[1], faceBounds(f.uv), phase, faceBounds(f.uv))
    },
    [model.cubes, applyTool, history, tool, refuseLocked],
  )

  /* On the sheet, a fill is bounded by the UV island the click landed in -
     the face you clicked, not the face that happens to be selected. A
     click on bare sheet has no island, so the fill is bounded only by
     colour similarity. */
  const paintOnSheet = useCallback(
    (x: number, y: number, phase: 'down' | 'move') => {
      const texture = model.textures[0]
      if (!texture) return
      if (phase === 'down' && tool !== 'pipette') history.begin('paint')
      let bounds: UVRect | null = null
      for (const c of model.cubes) {
        for (const key of FACES) {
          const [bx1, by1, bx2, by2] = faceBounds(c.faces[key].uv)
          if (x >= bx1 && x < bx2 && y >= by1 && y < by2) {
            bounds = [bx1, by1, bx2, by2]
            break
          }
        }
        if (bounds) break
      }
      applyTool(texture.id, x, y, bounds, phase)
    },
    [applyTool, model.cubes, model.textures, history, tool],
  )

  /* ---------------- animation ---------------- */

  const anim = useMemo<AnimApi>(() => {
    const withClip = (label: string, fn: (m: Model, id: string) => Model, coalesce = false) => {
      if (!clip) return
      setPlaying(false)
      history.commit(label, (m) => fn(m, clip.id), coalesce)
    }

    return {
      clips: model.clips,
      clip,
      bones,
      bone: animBone,
      setBone: setPickedBone,
      selectClip: (id) => {
        setClipId(id)
        setSelectedKey(null)
        setTime(0)
      },
      newClip: () => {
        const next = addClip(model)
        history.commit('new animation', next.model)
        setClipId(next.id)
        setSelectedKey(null)
        setTime(0)
        setPlaying(false)
        setMode('animate')
      },
      duplicateClip: () => {
        if (!clip) return
        const next = duplicateClip(model, clip.id)
        if (!next) return
        history.commit('duplicate animation', next.model)
        setClipId(next.id)
      },
      removeClip: () => {
        if (!clip) return
        history.commit('delete animation', deleteClip(model, clip.id))
        setClipId(model.clips.find((c) => c.id !== clip.id)?.id ?? null)
        setSelectedKey(null)
      },
      patchClip: (patch) => {
        withClip('animation settings', (m, id) => updateClip(m, id, patch), true)
        // a 3s playhead on a 1s clip renders past the end of the ruler
        if (patch.length !== undefined) setTime((t) => Math.min(t, Math.max(0, patch.length!)))
      },
      closeLoop: () => withClip('close the loop', (m, id) => closeLoop(m, id)),
      addKey: (bone, channel) =>
        withClip('add keyframe', (m, id) => setKey(m, id, bone, channel, time)),
      removeKey: (keyId) => {
        withClip('delete keyframe', (m, id) => deleteKey(m, id, keyId))
        setSelectedKey((k) => (k === keyId ? null : k))
      },
      removeTrack: (bone, channel) => {
        withClip('clear channel', (m, id) => deleteTrack(m, id, bone, channel))
        setSelectedKey(null)
      },
      selectedKey,
      selectKey: setSelectedKey,
      dragKey: (keyId, t, phase) => {
        if (phase === 'up') return
        withClip('move keyframe', (m, id) => updateKey(m, id, keyId, { time: t }), true)
        if (clip) setTime(Math.max(0, Math.min(clip.length, t)))
      },
      patchKey: (keyId, patch, transient) =>
        withClip('keyframe', (m, id) => updateKey(m, id, keyId, patch), transient !== false),
      kind,
      model,
      autoAnimate: (presetId) => {
        const built = autoAnimate(model, presetId)
        if (!built) return null
        const named = { ...built, name: uniqueName(model.clips.map((c) => c.name), built.name) }
        history.commit(`auto ${presetId}`, { ...model, clips: [...model.clips, named] })
        setClipId(named.id)
        setSelectedKey(null)
        setTime(0)
        setPlaying(false)
        return named.name
      },
    }
  }, [model, kind, clip, bones, animBone, selectedKey, time, history])

  /* ---------------- file + edit actions ---------------- */

  const actions = useMemo<Actions>(
    () => ({
      onOpen: () => guarded('Open another model?', 'Discard and open', () => fileInput.current?.click()),
      onSave: () => {
        const doc = { ...model, kind }
        runSave(vellumFileName(fileName), writeVellum(doc), model)
      },
      onSample: (id: string) => {
        const s = sampleById(id)
        guarded(`Open ${s.label}?`, 'Discard and open', () => loadModel(s.model, s.file, s.kind))
      },
      /* Creation lives on the shelf now, so this goes there rather than
         opening a second copy of the same dialog in a second place. The
         guard still runs, because leaving a dirty editor is leaving a
         dirty editor however you do it. */
      onNew: () =>
        navigate(`/projects/${scenes[0].id}/${kind === 'mobs' ? 'mobs' : 'items'}/new`),
      onUndo: history.undo,
      onRedo: history.redo,
      /* Where a new node goes: into the selected bone, or into the bone
         that owns the selected cube. `addCube` has always taken a parent
         id - the UI just never passed the one it already had, so
         everything landed on the first root however deep you were. */
      onAddCube: () => {
        const parent = bones.some((b) => b.id === selected) ? selected : ownerBone(model.bones, selected)
        const next = addCube(model, parent, rescale)
        history.commit('add cube', next.model)
        setSelected(next.id)
      },
      onAddBone: () => {
        const parent = bones.some((b) => b.id === selected) ? selected : ownerBone(model.bones, selected)
        const next = addBone(model, parent)
        history.commit('add bone', next.model)
        setSelected(next.id)
        setPickedBone(next.id)
      },
      onDuplicate: () => {
        if (!selected) return
        // a bone duplicates with its whole subtree; it used to do nothing at all
        const next = bones.some((b) => b.id === selected)
          ? duplicateBone(model, selected)
          : duplicateCube(model, selected)
        if (!next) return
        history.commit(bones.some((b) => b.id === selected) ? 'duplicate bone' : 'duplicate cube', next.model)
        setSelected(next.id)
      },
      onDelete: () => {
        if (!selected) return
        const isBone = bones.some((b) => b.id === selected)
        /* After an undo the selection can name something the model no
           longer has. Deleting it used to build a new model object that
           differed from nothing, commit a step for it, and truncate the
           redo branch - so the cube you had just undone became
           unrecoverable. */
        if (!isBone && !model.cubes.some((c) => c.id === selected)) return

        const lockedCube = model.cubes.find((c) => c.id === selected && c.locked)
        const lockedBone = isBone && bones.find((b) => b.id === selected)
        if (lockedCube) {
          refuseLocked(`"${lockedCube.name}"`)
          return
        }
        if (lockedBone && boneById(model, selected)?.locked) {
          refuseLocked(`"${lockedBone.name}"`)
          return
        }
        // a bone takes its subtree with it; a cube goes alone
        const next = isBone ? deleteBone(model, selected) : deleteCube(model, selected)
        if (next === model) return
        history.commit(isBone ? 'delete bone' : 'delete cube', next)
        setSelected(next.cubes[0]?.id ?? null)
      },
      onQuad: () => setQuad((q) => !q),
      onGrid: () => setGrid((g) => !g),
      onExportTexture: () => {
        const texture = model.textures[textureIndex] ?? model.textures[0]
        if (!texture) {
          setSaveNote('This model has no texture to export.')
          window.setTimeout(() => setSaveNote(null), 4000)
          return
        }
        // the decoded canvas is the painted one; the model's URI may lag a frame
        const surface = surfaces.current.get(texture.id)
        const url = surface ? toDataUrl(surface) : texture.source
        void saveDataUrl(texture.name.replace(/\.png$/i, '') + '.png', url).then((note: string) => {
          setSaveNote(note)
          window.setTimeout(() => setSaveNote(null), 6000)
        })
      },
      onNewClip: () => anim.newClip(),
      onDuplicateClip: () => anim.duplicateClip(),
      onDeleteClip: () => anim.removeClip(),
      onAddKey: () => animBone && anim.addKey(animBone, 'rotation'),
      onCloseLoop: () => anim.closeLoop(),
    }),
    [model, fileName, kind, textureIndex, loadModel, runSave, selected, bones, history, anim, animBone, guarded, rescale, refuseLocked],
  )

  /* Keyboard. Anything typed into a field belongs to that field, so the
     shortcuts stand down while one has focus. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      const mod = e.ctrlKey || e.metaKey

      /* Save is the one shortcut that must work with a field focused:
         typing a number and hitting Ctrl+S is a single gesture, and
         standing down here hands the keystroke to the browser's own
         "Save page as" dialog, which is worse than doing nothing. */
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        actions.onSave()
        return
      }
      // everything else belongs to the field while one has focus
      if (typing) return

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) history.redo()
        else history.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        history.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        // Animate duplicates the clip; geometry is not what this mode edits
        if (mode === 'animate') anim.duplicateClip()
        else actions.onDuplicate()
        return
      }
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        actions.onOpen()
        return
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        actions.onNew()
        return
      }
      if (mod && e.key === '4') {
        e.preventDefault()
        setQuad((q) => !q)
        return
      }
      if (mod) return

      /* Delete means "the thing this mode edits", and nothing else.
         Falling through to cube deletion whenever no keyframe happened
         to be selected quietly dismantled the model one press at a
         time, which is the last thing a texture or animation pass
         should be able to do. */
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (mode === 'animate') {
          if (selectedKey) anim.removeKey(selectedKey)
        } else if (mode === 'edit') {
          actions.onDelete()
        }
        return
      }
      if (e.key.toLowerCase() === 'k' && mode === 'animate' && animBone) {
        e.preventDefault()
        anim.addKey(animBone, 'rotation')
        return
      }
      if (e.key.toLowerCase() === 'g') setGrid((g) => !g)
      if (e.key === ' ' && mode === 'animate') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, actions, anim, mode, selectedKey, animBone])

  /* Only `.vellum` opens here. The format is the editor's own, and a
     file that is not one is refused by name rather than half-parsed. */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      if (!isVellum(text)) {
        throw new Error(`${file.name} is not a .vellum - Vellum opens the models it writes.`)
      }
      loadModel(readVellum(text), file.name, kind)
      setOpenError(null)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'That file could not be read as a model.')
    }
    e.target.value = ''
  }

  const onLeft = useCallback((dx: number) => setLeftW((w) => Math.min(460, Math.max(210, w + dx))), [])
  const onRight = useCallback((dx: number) => setRightW((w) => Math.min(460, Math.max(210, w - dx))), [])

  // fit the model from its real extent, not its distance from the origin -
  // a tall sword and a 16-unit block both want to fill the viewport
  const extent = useMemo(() => {
    if (!model.cubes.length) return 24
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (const c of model.cubes) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], c.from[i])
        hi[i] = Math.max(hi[i], c.to[i])
      }
    }
    return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1)
  }, [model])

  return (
    <div
      className="editor-root"
      style={{ ['--left-w' as string]: `${leftW}px`, ['--right-w' as string]: `${rightW}px` }}
    >
      <input ref={fileInput} type="file" accept=".vellum,application/json" hidden onChange={onFile} />

      <MenuBar
        fileName={fileName}
        kind={kind}
        actions={actions}
        undoLabel={history.undoLabel}
        redoLabel={history.redoLabel}
        hasClip={!!clip}
        dirty={dirty}
      />
      <Toolbar
        kind={kind}
        mode={mode}
        onMode={setMode}
        tool={tool}
        onTool={setTool}
        grid={grid}
        onGrid={() => setGrid((g) => !g)}
        quad={quad}
        onQuad={() => setQuad((q) => !q)}
        onAddCube={actions.onAddCube}
        onAddBone={actions.onAddBone}
        brush={brush}
        onBrush={setBrush}
        shape={shape}
        onShape={setShape}
        shapeFilled={shapeFilled}
        onShapeFilled={setShapeFilled}
        snap={snap}
        onSnap={() => setSnap((v) => !v)}
        onExportTexture={actions.onExportTexture}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        undoLabel={history.undoLabel}
        redoLabel={history.redoLabel}
      />

      {/* the editor had no main landmark and no h1 at all: "skip to
          content" had nothing to skip to, and the document announced
          itself as a page about nothing */}
      <main className="ed-body">
        <h1 className="vh">
          {fileName} {'\u2014'} {kind} model, {mode} mode
        </h1>
        <Viewport
          model={model}
          label={kind}
          grid={grid}
          quad={quad}
          extent={extent}
          clip={mode === 'animate' ? clip : mode === 'behaviour' ? bhvClip : null}
          time={mode === 'behaviour' ? bhvClipTime : time}
          selected={selected}
          onSelect={selectNode}
          onDeselect={() => setSelected(null)}
          onPaint={mode === 'paint' ? paintOnModel : undefined}
          display={mode === 'display' && kind !== 'mobs' ? displayState[slot] : null}
        />

        <div className="ed-rails">
          <div className="ed-col ed-col--left">
            {mode === 'config' && hasConfig(kind) ? (
              <Panel title="Config" count={setFields(kind, config).length || 'none'}>
                <ConfigPanel kind={kind} config={config} onChange={setConfig} />
              </Panel>
            ) : mode === 'behaviour' ? (
              <Panel
                title="Behaviour"
                count={
                  behaviour.stages.length
                    ? `${behaviour.stages.length} stage${behaviour.stages.length === 1 ? '' : 's'}`
                    : 'none'
                }
              >
                <BehaviourPanel
                  model={model}
                  behaviour={behaviour}
                  onChange={setBehaviour}
                  now={bhvNow}
                  playing={bhvPlaying}
                  onPlaying={(p) => {
                    if (p && cycleLength(behaviour) <= 0) return
                    setBhvPlaying(p)
                  }}
                  onGeyser={() => {
                    const find = (re: RegExp) => model.clips.find((c) => re.test(c.name))?.id
                    setBehaviour(
                      geyserBehaviour({
                        idle: find(/idle|rest|charge/i),
                        rumble: find(/rumble|shake|tremor/i),
                        erupt: find(/erupt|burst|blow|use|swing/i),
                      }),
                    )
                  }}
                >
                  {(rows) =>
                    rows.map((r) => (
                      <NumRow key={r.label} label={r.label} value={r.value} step={r.step} onChange={r.onChange} />
                    ))
                  }
                </BehaviourPanel>
              </Panel>
            ) : mode === 'display' && kind === 'mobs' ? (
              <Panel title="Scene" count={`${model.clips.length} clip${model.clips.length === 1 ? '' : 's'}`}>
                <ScenePanel
                  model={model}
                  clip={clip}
                  clips={model.clips}
                  onClip={setClipId}
                  onWorld={() => setWorldOpen(true)}
                />
              </Panel>
            ) : mode === 'display' ? (
              <Panel title="Display" count={slot.replace(/_/g, ' ')}>
                <DisplayPanel
                  slot={slot}
                  onSlot={setSlot}
                  transform={displayState[slot]}
                  onTransform={(t) => setDisplayState((d) => ({ ...d, [slot]: t }))}
                  all={displayState}
                  onWorld={() => setWorldOpen(true)}
                  onReset={() => setDisplayState((d) => ({ ...d, [slot]: DEFAULT_DISPLAY[slot] }))}
                >
                  {(rows) =>
                    rows.map((r) => (
                      <NumRow key={r.label} label={r.label} value={r.value} step={r.step} onChange={r.onChange} />
                    ))
                  }
                </DisplayPanel>
              </Panel>
            ) : mode === 'animate' ? (
              <>
                <Panel title="Animation" count={clip ? clipLabel(clip.name) : 'none'}>
                  <AnimationPanel anim={anim} />
                </Panel>
                <Panel title="Keyframe" count={selectedKey ? 'selected' : undefined}>
                  <KeyframePanel anim={anim} />
                </Panel>
              </>
            ) : selectedBone ? (
              <Panel title="Bone" count={selectedBone.name}>
                <BonePanel
                  bone={selectedBone}
                  snap={snap}
                  onChange={(patch) => editBone(selectedBone.id, patch)}
                />
              </Panel>
            ) : (
              <Panel title="Cube" count={cube?.name ?? 'none'}>
                <CubePanel cube={cube} kind={kind} onChange={editCube} snap={snap} />
              </Panel>
            )}

            <Panel title="UV" count={`${model.resolution.width} × ${model.resolution.height}`}>
              <UVPanel
                model={model}
                cube={cube}
                face={face}
                onFace={setFace}
                onChange={editCube}
                onPaint={mode === 'paint' ? paintOnSheet : undefined}
              />
            </Panel>

            <Panel
              title="Validation"
              count={errors ? `${errors} errors` : warnings ? `${warnings} warnings` : 'clean'}
              defaultOpen={errors > 0 || warnings > 0 || !!openError}
              // a refused file arrives long after mount, and in silence otherwise
              forceOpen={!!openError}
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
                  <Icon name="check" size={11} /> Nothing the writer would refuse.
                </p>
              )}
            </Panel>
          </div>

          <Splitter onDrag={onLeft} />
          {/* The middle column is normally a hole through to the
              viewport. In Config mode there is nothing to look at
              through it, and a great deal to read. */}
          <div className="ed-rails__gap">
            {mode === 'config' && hasConfig(kind) ? (
              <ConfigOutput id={model.name} kind={kind} config={config} />
            ) : null}
          </div>
          <Splitter onDrag={onRight} />

          <div className="ed-col ed-col--right">
            <Panel title="Colour" count={mode === 'paint' ? tool : undefined}>
              <ColorPanel colour={colour} onColour={setColour} />
            </Panel>

            <Panel title="Outliner" count={`${model.cubes.length} cubes`} grow>
              <Outliner
                model={model}
                selected={selected}
                collapsed={collapsed}
                onSelect={selectNode}
                onToggleBone={(id) =>
                  setCollapsed((s) => {
                    const next = new Set(s)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                onModel={(label, fn) => history.commit(label, fn)}
                onRename={rename}
                onMove={move}
              />
            </Panel>

            <Panel title="Textures" count={model.textures.length}>
              {model.textures.map((t, i) => (
                <button
                  key={t.id}
                  className="tex-row"
                  /* aria-selected means nothing on a button; this is
                     "the one of the set you are on", which is aria-current */
                  aria-current={i === textureIndex}
                  title={`${t.name} \u2014 click to select, then View \u25b8 Export texture PNG`}
                  onClick={() => setTextureIndex(i)}
                >
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
      </main>

      {worldOpen ? (
        <WorldScene
          model={model}
          kind={kind}
          subtype={subtype}
          behaviour={model.behaviour}
          clip={clip}
          clips={model.clips}
          onClip={(id) => setClipId(id)}
          onClose={() => setWorldOpen(false)}
        />
      ) : null}

      {pending ? (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const run = pending.run
            setPending(null)
            run()
          }}
        />
      ) : null}


      {mode === 'animate' ? (
        <Timeline anim={anim} time={time} onTime={setTime} playing={playing} onPlaying={setPlaying} />
      ) : null}

      <div className="ed-status">
        <span>{fileName}</span>
        <span>{subtype ? `${kind} \u00b7 ${subtype}` : kind}</span>
        <span>{model.cubes.length} cubes</span>
        <span>
          {model.resolution.width} x {model.resolution.height}
        </span>
        <span className="ed-status__sel">
          {saveNote ?? openError ?? `selected: ${cube?.name ?? selectedBone?.name ?? 'none'} · ${tool}`}
        </span>
        <div className="ed-status__right">
          <span className={errors || warnings ? 'ed-status__bad' : undefined}>
            {errors
              ? `${errors} error${errors === 1 ? '' : 's'}`
              : warnings
                ? `${warnings} warning${warnings === 1 ? '' : 's'}`
                : 'valid'}
          </span>
          <span>{mode}</span>
          <span>vellum 0.6.0</span>
        </div>
      </div>
    </div>
  )
}
