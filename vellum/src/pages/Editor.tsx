import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Menu } from '../components/Menu'
import type { MenuEntry } from '../components/Menu'
import { ModelView } from '../components/ModelView'
import type { MeshPick, PickMods, VertexLayer, ViewApi } from '../components/ModelView'
import type { GizmoEvent, GizmoSpec } from '../components/Gizmo'
import { add, apply, applyDir, buildRig, cubeCorners, cubeFrame, eulerAxes, meshFrame, norm, nullWorld, parentFrame, posedAt, sub, toParentDir } from '../lib/kinematics'
import {
  copyNodes,
  findBone,
  flipNodes,
  groupNodes,
  movePivots,
  pasteNodes,
  readClipboard,
  rehomeNulls,
  reorderNode,
  resizeCube,
  setRotations,
  topLevel,
  translateNodes,
} from '../lib/transform'
import { addHitRegion, hitReport, isRegionBone, modeLine } from '../lib/hitregions'
import { Icon } from '../lib/icons'
import { arrowNav } from '../lib/a11y'
import type { IconName } from '../lib/icons'
import {
  FACES,
  boneById,
  cubeSize,
  defaultSubtype,
  flattenBones,
  samplePose,
  sampleTrack,
  setCubePosition,
  setCubeSize,
  subtypeFits,
  textureById,
  validateModel,
} from '../lib/model'
import type {
  Bone,
  Channel,
  Clip,
  Cube,
  FaceKey,
  Key,
  Mesh,
  Model,
  NullObject,
  ClipEvent,
  Pose,
  ProjectKind,
  Texture,
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
  newId,
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
  addEvent,
  copyKeys,
  deleteEvent,
  deleteKeys,
  moveKeys,
  patchKeys,
  pasteKeys,
  readKeyClipboard,
  updateEvent,
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
  topColours,
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
import {
  assignTexture,
  followBoxUv,
  freeTextureName,
  moveFaceUv,
  moveFacesUv,
  pixelScale,
  removeTexture,
  resizeFaceUv,
  reunwrap,
  mirrorPoint,
  setBoxUv,
  unwrapOrigin,
} from '../lib/uv-edit'
import type { UvHandle } from '../lib/uv-edit'
import { PRIMITIVES, centreOf, faceOrder, deleteEdges, deleteFaces, deleteVertices, edgeEnds, edgeVerticesOf, edgesOf, extrudeFaces, flipFaces, loopCut, makeMesh, mergeVertices, moveVertices, subdivide, verticesOf, mirrorFacesUv, projectUv, turnFacesUv, bevel, cubeToMesh, joinMeshes, mergeByDistance, separateFaces, dissolveEdges, edgeLoop, fillFace, insetFaces, knifeCut, rotateVertices, scaleVertices, slideEdges } from '../lib/mesh'
import type { KnifePoint } from '../lib/mesh'
import type { Primitive } from '../lib/mesh'
import { boxSize, findSpot } from '../lib/uv-pack'
import { DEFAULT_DISPLAY, DisplayPanel } from './editor/DisplayPanel'
import type { DisplayState, SlotId } from './editor/DisplayPanel'
import { ScenePanel } from './editor/ScenePanel'
import { BehaviourPanel } from './editor/BehaviourPanel'
import { ConfigPanel } from './editor/ConfigPanel'
import { ConfigOutput } from './editor/ConfigOutput'
import { PaintSheet } from './editor/PaintSheet'
import { MeshUvPanel } from './editor/MeshUv'
import { hasConfig, setFields, withDefaults } from '../lib/config'
import { checkTranslation } from '../lib/mcmodel'
import type { Config } from '../lib/config'
import { EMPTY_BEHAVIOUR, cycleLength, geyserBehaviour, stageAt } from '../lib/behaviour'
import type { Behaviour } from '../lib/behaviour'
import { ConfirmDialog } from './editor/ConfirmDialog'
import { blockNavigation, navigate, useTitle } from '../lib/router'
import { scenes } from '../lib/data'
import { saveBlob, saveDataUrl, saveFile } from '../lib/download'
import { toGltf, toJavaJson, toObjZip } from '../lib/exporters'
import { fromBbmodel, fromJavaModel, isBbmodel, isJavaModel, toBbmodel } from '../lib/importers'
import './Editor.css'
import './EditorStudio.css'

type Mode = 'edit' | 'paint' | 'animate' | 'display' | 'behaviour' | 'config'

/* ================= menu bar ================= */

type Actions = {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSample: (id: string) => void
  onAddCube: () => void
  onAddBone: () => void
  onAddNull: () => void
  onAddMesh: (kind: Primitive) => void
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
  /** the selected cubes become meshes */
  onCubeToMesh: () => void
  /** Blender's grab: the selection follows the pointer */
  onGrab: () => void
  onExportTexture: () => void
  onExportGltf: () => void
  onExportObj: () => void
  onExportJava: () => void
  /** saves in the format named; Save and Ctrl S then keep using it */
  onSaveAs: (format: SaveFormat) => void
  onSelectAll: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onGroup: () => void
  onFlip: (axis: 0 | 1 | 2, centreLine?: boolean) => void
  onView: (yaw: number, pitch: number) => void
  onOrtho: () => void
  onFocus: () => void
  onFrameAll: () => void
  onHide: () => void
  onShowAll: () => void
}

/** The two formats a model saves in: Vellum's own, or a Blockbench project. */
type SaveFormat = 'vellum' | 'bbmodel'

function buildMenus(
  actions: Actions,
  state: { undoLabel: string | null; redoLabel: string | null; hasClip: boolean; keymap: Keymap; onKeymap: (k: Keymap) => void },
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
        { label: 'Open .vellum, .bbmodel or Java JSON…', icon: 'folder', shortcut: 'Ctrl O', onSelect: actions.onOpen },
        { label: 'Save as .vellum', icon: 'save', onSelect: () => actions.onSaveAs('vellum') },
        { label: 'Save as Blockbench .bbmodel', icon: 'save', onSelect: () => actions.onSaveAs('bbmodel') },
        { kind: 'separator' },
        { kind: 'label', label: 'Export' },
        { label: 'glTF, with the rig and clips (Blender)', icon: 'download', onSelect: actions.onExportGltf },
        { label: 'OBJ and textures (.zip)', icon: 'download', onSelect: actions.onExportObj },
        { label: 'Java model JSON', icon: 'download', onSelect: actions.onExportJava },
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
        {
          label: state.keymap === 'blender' ? 'Keys: Blender (switch to Blockbench)' : 'Keys: Blockbench (switch to Blender)',
          icon: 'sliders',
          onSelect: () => state.onKeymap(state.keymap === 'blender' ? 'blockbench' : 'blender'),
        },
        { kind: 'separator' },
        { label: 'Cut', icon: 'copy', shortcut: 'Ctrl X', onSelect: actions.onCut },
        { label: 'Copy', icon: 'copy', shortcut: 'Ctrl C', onSelect: actions.onCopy },
        { label: 'Paste', icon: 'copy', shortcut: 'Ctrl V', onSelect: actions.onPaste },
        { label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl D', onSelect: actions.onDuplicate },
        { label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, onSelect: actions.onDelete },
        { kind: 'separator' },
        { label: 'Select all', icon: 'layers', shortcut: 'Ctrl A', onSelect: actions.onSelectAll },
        { label: 'Hide selected', icon: 'eyeOff', shortcut: 'H', onSelect: actions.onHide },
        { label: 'Show all', icon: 'eye', shortcut: 'Alt H', onSelect: actions.onShowAll },
        { kind: 'separator' },
        { label: 'Add cube', icon: 'cube', onSelect: actions.onAddCube },
        ...PRIMITIVES.map((p) => ({ label: `Add mesh: ${p.label.toLowerCase()}`, icon: 'vertex' as const, onSelect: () => actions.onAddMesh(p.id) })),
        { label: 'Add bone', icon: 'folder', onSelect: actions.onAddBone },
        { label: 'Add null object', icon: 'pivot', onSelect: actions.onAddNull },
        { label: 'Group selection', icon: 'folder', shortcut: 'Ctrl G', onSelect: actions.onGroup },
        { label: 'Convert cube to mesh', icon: 'vertex', onSelect: actions.onCubeToMesh },
      ],
    },
    {
      label: 'Transform',
      entries: [
        { label: 'Grab (follows the pointer)', icon: 'move', shortcut: state.keymap === 'blender' ? 'G' : '⇧ G', onSelect: actions.onGrab },
        { kind: 'separator' },
        { label: 'Flip X', icon: 'move', onSelect: () => actions.onFlip(0) },
        { label: 'Flip Y', icon: 'move', onSelect: () => actions.onFlip(1) },
        { label: 'Flip Z', icon: 'move', onSelect: () => actions.onFlip(2) },
        { kind: 'separator' },
        { label: 'Mirror across the centre line (X)', icon: 'move', onSelect: () => actions.onFlip(0, true) },
        { label: 'Mirror across the centre line (Z)', icon: 'move', onSelect: () => actions.onFlip(2, true) },
      ],
    },
    {
      label: 'Animation',
      // without a clip the other entries would do nothing
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
        { label: 'Front', icon: 'cube', shortcut: 'Num 1', onSelect: () => actions.onView(0, 0) },
        { label: 'Back', icon: 'cube', shortcut: 'Ctrl Num 1', onSelect: () => actions.onView(180, 0) },
        { label: 'Right', icon: 'cube', shortcut: 'Num 3', onSelect: () => actions.onView(-90, 0) },
        { label: 'Left', icon: 'cube', shortcut: 'Ctrl Num 3', onSelect: () => actions.onView(90, 0) },
        { label: 'Top', icon: 'cube', shortcut: 'Num 7', onSelect: () => actions.onView(0, -90) },
        { label: 'Bottom', icon: 'cube', shortcut: 'Ctrl Num 7', onSelect: () => actions.onView(0, 90) },
        { label: 'Perspective / orthographic', icon: 'cube', shortcut: 'Num 5', onSelect: actions.onOrtho },
        { kind: 'separator' },
        { label: 'Focus on selection', icon: 'search', shortcut: 'F', onSelect: actions.onFocus },
        { label: 'Frame whole model', icon: 'search', shortcut: 'Home', onSelect: actions.onFrameAll },
        { kind: 'separator' },
        { label: 'Quad view', icon: 'layers', shortcut: 'Ctrl 4', onSelect: actions.onQuad },
        { label: 'Toggle grid', icon: 'grid', shortcut: 'G', onSelect: actions.onGrid },
        { kind: 'separator' },
        { label: 'Export texture PNG', icon: 'image', onSelect: actions.onExportTexture },
      ],
    },
    {
      label: 'Help',
      entries: [
        { label: 'Report a bug', icon: 'bug', onSelect: () => navigate('/settings/report-a-bug') },
        { label: 'About Vellum', icon: 'info', onSelect: () => navigate('/settings/about') },
      ],
    },
  ]
}

/* ================= toolbar ================= */

const toolsets: Record<Mode, Array<{ id: string; icon: IconName; label: string; key?: string }>> = {
  // these modes have no canvas, so no tools
  behaviour: [],
  config: [],
  edit: [
    { id: 'move', icon: 'move', label: 'Move tool', key: 'V' },
    { id: 'resize', icon: 'resize', label: 'Resize tool', key: 'S' },
    { id: 'rotate', icon: 'rotate', label: 'Rotate tool', key: 'R' },
    { id: 'pivot', icon: 'pivot', label: 'Pivot tool', key: 'P' },
    { id: 'vertex', icon: 'vertex', label: 'Vertex snap tool', key: 'X' },
  ],
  paint: [
    { id: 'brush', icon: 'brush', label: 'Brush', key: 'B' },
    { id: 'eraser', icon: 'eraser', label: 'Eraser', key: 'E' },
    { id: 'bucket', icon: 'bucket', label: 'Fill tool', key: 'F' },
    { id: 'pipette', icon: 'pipette', label: 'Color picker', key: 'C' },
    { id: 'shape', icon: 'shape', label: 'Draw shape', key: 'U' },
  ],
  animate: [
    { id: 'move', icon: 'move', label: 'Move tool', key: 'V' },
    { id: 'rotate', icon: 'rotate', label: 'Rotate tool', key: 'R' },
    { id: 'scale', icon: 'resize', label: 'Scale tool', key: 'S' },
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
 * Mobs have no display transforms, so their Display tab is labelled Scene.
 * Mobs get no Behaviour tab, and Config appears only for kinds that have one.
 */
const modesFor = (kind: ProjectKind) =>
  baseModes
    .filter((m) => (m.id === 'behaviour' ? kind !== 'mobs' : m.id === 'config' ? hasConfig(kind) : true))
    .map((m) => (m.id === 'display' && kind === 'mobs' ? { ...m, label: 'Scene' } : m))

/* ================= the Studio editor bar ================= */

/**
 * The bar along the top of the editor, as the Studio design draws it: the
 * model's name and file on the left, the modes in a pill in the middle, and
 * undo, redo, problems, the File menu and Save on the right. Every menu the
 * editor has lives under File, grouped by heading.
 */
function EditorBar({
  title,
  subtitle,
  dirty,
  kind,
  mode,
  onMode,
  menus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoLabel,
  redoLabel,
  problems,
  onProblems,
  onSave,
  saveFormat,
  onSaveAs,
}: {
  title: string
  subtitle: string
  dirty: boolean
  kind: ProjectKind
  mode: Mode
  onMode: (m: Mode) => void
  menus: Array<{ label: string; entries: MenuEntry[] }>
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  undoLabel: string | null
  redoLabel: string | null
  problems: number
  onProblems: () => void
  onSave: () => void
  saveFormat: SaveFormat
  onSaveAs: (format: SaveFormat) => void
}) {
  const fileEntries = useMemo<MenuEntry[]>(
    () =>
      menus.flatMap((m, i) => [
        ...(i ? [{ kind: 'separator' } as MenuEntry] : []),
        { kind: 'label', label: m.label } as MenuEntry,
        ...m.entries.filter((e) => !('kind' in e && e.kind === 'label' && m.label !== 'File')),
      ]),
    [menus],
  )
  return (
    <header className="sbar">
      <button
        className="sbar__icon"
        onClick={() => navigate(`/projects/${scenes[0].id}/${kind === 'mobs' ? 'mobs' : 'items'}`)}
        title="Back to the library"
        aria-label="Back to the library"
      >
        <Icon name="chevronLeft" size={16} />
      </button>
      <div className="sbar__title">
        <div className="sbar__name">
          {title}
          {dirty ? <span className="sbar__dirty" title="Unsaved changes" aria-label="Unsaved changes" /> : null}
        </div>
        <div className="sbar__sub">{subtitle}</div>
      </div>

      <nav className="sbar__modes" aria-label="Editor mode">
        {modesFor(kind).map((m) => (
          <button key={m.id} className="sbar__mode" aria-pressed={m.id === mode} onClick={() => onMode(m.id)}>
            {m.id === 'edit' ? 'Model' : m.label}
          </button>
        ))}
      </nav>

      <div className="sbar__right">
        <button className="sbar__icon" title={undoLabel ? `Undo ${undoLabel} (Ctrl Z)` : 'Nothing to undo'} aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
          <Icon name="undo" size={16} />
        </button>
        <button className="sbar__icon" title={redoLabel ? `Redo ${redoLabel} (Ctrl Shift Z)` : 'Nothing to redo'} aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
          <Icon name="redo" size={16} />
        </button>
        {problems ? (
          <button className="sbar__pill sbar__pill--warn" onClick={onProblems} title="Show what Validation found">
            <Icon name="warning" size={13} /> {problems} problem{problems === 1 ? '' : 's'}
          </button>
        ) : null}
        <Menu
          align="end"
          entries={fileEntries}
          trigger={({ props }) => (
            <button className="sbar__pill" {...props}>
              File <Icon name="chevronDown" size={12} />
            </button>
          )}
        />
        <span className="sbar__savegroup">
          <button className="sbar__save" onClick={onSave} title={`Save the .${saveFormat} (Ctrl S)`}>
            Save <span className="sbar__format">.{saveFormat}</span>
          </button>
          <Menu
            align="end"
            entries={[
              { kind: 'label', label: 'Save as' },
              { label: '.vellum, Vellum’s own', icon: saveFormat === 'vellum' ? 'check' : 'save', onSelect: () => onSaveAs('vellum') },
              { label: '.bbmodel, a Blockbench project', icon: saveFormat === 'bbmodel' ? 'check' : 'save', onSelect: () => onSaveAs('bbmodel') },
            ]}
            trigger={({ props }) => (
              <button className="sbar__save sbar__save--more" aria-label="Choose the format to save in" {...props}>
                <Icon name="chevronDown" size={12} />
              </button>
            )}
          />
        </span>
      </div>
    </header>
  )
}

/** The tool pill at the bottom of the viewport: each tool with its name and key. */
function ToolDock({
  tools,
  tool,
  onTool,
  extra,
}: {
  /** more buttons after the tools, such as a mesh's selection modes */
  extra?: ReactNode
  tools: Array<{ id: string; icon: IconName; label: string; key?: string }>
  tool: string
  onTool: (id: string) => void
}) {
  if (!tools.length) return null
  return (
    <div className="dock" role="toolbar" aria-label="Tools" onPointerDown={(e) => e.stopPropagation()}>
      {tools.map((t) => (
        <button key={t.id} className="dock__tool" aria-pressed={t.id === tool} title={t.key ? `${t.label} (${t.key})` : t.label} onClick={() => onTool(t.id)}>
          <Icon name={t.icon} size={14} />
          <span>{t.label.replace(/ tool$/, '')}</span>
          {t.key ? <kbd>{t.key}</kbd> : null}
        </button>
      ))}
      {extra}
    </div>
  )
}

/** Paint mode's left column: the tools with their keys, then the brush. */
function PaintTools({
  tool,
  onTool,
  brush,
  onBrush,
  shape,
  onShape,
  shapeFilled,
  onShapeFilled,
  view,
  onView,
  keepInside,
  onKeepInside,
  opacity,
  onOpacity,
  mirror,
  onMirror,
}: {
  opacity: number
  onOpacity: (v: number) => void
  mirror: boolean
  onMirror: (v: boolean) => void
  view: 'sheet' | 'model'
  onView: (v: 'sheet' | 'model') => void
  keepInside: boolean
  onKeepInside: (v: boolean) => void
  tool: string
  onTool: (id: string) => void
  brush: number
  onBrush: (n: number) => void
  shape: ShapeKind
  onShape: (k: ShapeKind) => void
  shapeFilled: boolean
  onShapeFilled: (v: boolean) => void
}) {
  return (
    <>
      <div className="ptools">
        {toolsets.paint.map((t) => (
          <button key={t.id} className="ptools__row" aria-pressed={t.id === tool} onClick={() => onTool(t.id)}>
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
            {t.key ? <kbd>{t.key}</kbd> : null}
          </button>
        ))}
      </div>
      <div className="studio-label">Paint on</div>
      <div className="studio-seg ptools__view" role="group" aria-label="Paint on">
        <button aria-pressed={view === 'sheet'} onClick={() => onView('sheet')} title="The flat texture sheet, large in the middle">
          Sheet
        </button>
        <button aria-pressed={view === 'model'} onClick={() => onView('model')} title="Straight onto the model in 3D">
          Model
        </button>
      </div>
      <div className="studio-label">Brush</div>
      <div className="studio-seg" role="group" aria-label="Brush size">
        {[1, 2, 3, 4, 6, 8].map((n) => (
          <button key={n} aria-pressed={brush === n} onClick={() => onBrush(n)}>
            {n} px
          </button>
        ))}
      </div>
      {tool === 'shape' ? (
        <div className="studio-seg" role="group" aria-label="Shape" style={{ marginTop: 8 }}>
          <button aria-pressed={shape === 'rect'} onClick={() => onShape('rect')}>
            Rectangle
          </button>
          <button aria-pressed={shape === 'ellipse'} onClick={() => onShape('ellipse')}>
            Ellipse
          </button>
          <button aria-pressed={shapeFilled} onClick={() => onShapeFilled(!shapeFilled)}>
            Filled
          </button>
        </div>
      ) : null}
      <label className="ptools__strength">
        <span>Strength</span>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={Math.round(opacity * 100)}
          aria-label="Brush strength"
          onChange={(e) => onOpacity(Number(e.target.value) / 100)}
        />
        <span className="ptools__pct">{Math.round(opacity * 100)}%</span>
      </label>
      <button
        className="uv-switch ptools__keep"
        role="switch"
        aria-checked={mirror}
        title="A brush or eraser stroke also lands on the cube mirrored across X, as in Blockbench"
        onClick={() => onMirror(!mirror)}
      >
        <span>Mirror painting</span> <span className="uv-switch__track" />
      </button>
      <button
        className="uv-switch ptools__keep"
        role="switch"
        aria-checked={keepInside}
        title="A stroke that starts on a face stays inside that face"
        onClick={() => onKeepInside(!keepInside)}
      >
        <span>Keep strokes inside the face</span> <span className="uv-switch__track" />
      </button>
    </>
  )
}

/** The status bar's texel readout in Paint, updated straight from pointer moves. */
function StatusTexel({ sink, fallback }: { sink: React.MutableRefObject<((text: string | null) => void) | null>; fallback: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    sink.current = setText
    return () => {
      sink.current = null
    }
  }, [sink])
  return <>{text ?? fallback}</>
}

/* ================= keymap ================= */

/** Blockbench's keys by default; Blender's for people who come from there. */
type Keymap = 'blockbench' | 'blender'

const KEYMAP_STORE = 'vellum.keymap'
const readKeymap = (): Keymap => {
  try {
    return localStorage.getItem(KEYMAP_STORE) === 'blender' ? 'blender' : 'blockbench'
  } catch {
    return 'blockbench'
  }
}

/** The key a tool shows on the dock under each keymap; Blender grabs with G. */
const keyFor = (keymap: Keymap, id: string, key?: string) => (keymap === 'blender' && id === 'move' ? 'G' : keymap === 'blender' && id === 'vertex' ? undefined : key)

/* ================= panel shell ================= */

function Panel({
  title,
  count,
  children,
  grow,
  defaultOpen = true,
  forceOpen,
  actions,
}: {
  title: string
  count?: ReactNode
  /** buttons beside the title, outside the toggle so they do not nest in it */
  actions?: ReactNode
  children: ReactNode
  grow?: boolean
  defaultOpen?: boolean
  /** opens the panel when it becomes true. `defaultOpen` is read only at mount. */
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  return (
    <section className={`panel${grow && open ? ' panel--grow' : ''}`} data-open={open}>
      <div className="panel__bar">
        <button className="panel__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name="chevronDown" size={12} className="panel__chevron" />
          <span className="panel__title">{title}</span>
          {count !== undefined ? <span className="panel__count">{count}</span> : null}
        </button>
        {actions ? <span className="panel__actions">{actions}</span> : null}
      </div>
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
  tag,
}: {
  /** a letter shown in place of the axis's own, such as W for a width */
  tag?: string
  axis: 'x' | 'y' | 'z' | 'n'
  /** the input's accessible name, also used in the scrub tooltip */
  name: string
  value: number
  onChange: (v: number) => void
  step?: number
  disabled?: boolean
  /** called once when a scrub, typed edit or arrow nudge ends */
  onCommit?: () => void
  /** round to whole units (the toolbar's magnet) */
  snap?: boolean
}) {
  const emit = (v: number) => onChange(snap ? Math.round(v) : v)
  const drag = useRef<{ x: number; start: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="num-field" data-disabled={disabled || undefined}>
      <span
        className={`num-field__axis num-field__axis--${axis}`}
        title={`${name}. Drag to scrub.`}
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
        {tag ?? (axis === 'n' ? '#' : axis.toUpperCase())}
      </span>
      <input
        className="num-field__input"
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
          // keyboard version of scrubbing, since the axis handle is pointer-only
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
  tags,
}: {
  tags?: [string, string, string]
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
    <div className="num-field-row num-field-row--vec">
      <span className="num-field-row__label">{label}</span>
      {axes.map((a, i) => (
        <NumField
          key={a}
          axis={a}
          tag={tags?.[i]}
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
  model,
  parent,
  bones,
  onRename,
  onMove,
  onDelete,
  onToMesh,
}: {
  /** Blockbench's Convert to mesh */
  onToMesh: () => void
  model: Model
  /** the bone the cube is in, or null at the root */
  parent: string | null
  bones: Array<{ id: string; name: string; depth: number }>
  onRename: (name: string) => void
  onMove: (bone: string | null) => void
  onDelete: () => void
  cube: Cube | null
  kind: ProjectKind
  onChange: (fn: (c: Cube) => Cube) => void
  /** the toolbar magnet; applies to position, size and pivot */
  snap: boolean
}) {
  if (!cube) {
    return <p className="editor-hint">Select a cube in the outliner to edit it.</p>
  }

  const size = cubeSize(cube)
  // block models only accept one rotated axis, at fixed angles
  const blockLocked = kind === 'blocks'
  const locked = cube.locked

  const texture = textureById(model, cube.faces.north.texture) ?? model.textures[0] ?? null
  const [u0, v0] = unwrapOrigin(cube)
  const box = boxSize(size)

  return (
    <>
      <div className="insp-head">
        <Icon name="cube" size={15} />
        <input
          key={`${cube.id}:${cube.name}`}
          className="insp-head__name"
          defaultValue={cube.name}
          aria-label="Cube name"
          spellCheck={false}
          disabled={locked}
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== cube.name) onRename(name)
            else e.target.value = cube.name
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              ;(e.target as HTMLInputElement).value = cube.name
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        <button className="insp-head__delete" aria-label={`Convert ${cube.name} to a mesh`} title="Convert to a mesh, to shape it by its faces and vertices" disabled={locked} onClick={onToMesh}>
          <Icon name="vertex" size={15} />
        </button>
        <button className="insp-head__delete" aria-label={`Delete ${cube.name}`} title="Delete this cube (Del)" disabled={locked} onClick={onDelete}>
          <Icon name="trash" size={15} />
        </button>
      </div>
      <label className="clip-props__row insp-bone">
        <span>In bone</span>
        <select className="editor-select" value={parent ?? ''} disabled={locked} onChange={(e) => onMove(e.target.value || null)}>
          <option value="">(no bone)</option>
          {bones.map((b) => (
            <option key={b.id} value={b.id}>
              {'\u2002'.repeat(b.depth)}
              {b.name}
            </option>
          ))}
        </select>
      </label>

      {locked ? (
        <p className="editor-hint editor-hint--warn" style={{ marginBottom: 9 }}>
          <Icon name="lock" size={11} /> Locked. Unlock it below to move, resize or paint it.
        </p>
      ) : null}

      <div className="num-field-grid">
        <NumRow
          label="Position"
          value={cube.from}
          disabled={locked}
          snap={snap}
          onChange={(from) => onChange((c) => setCubePosition(c, from))}
        />
        <NumRow label="Size" tags={['W', 'H', 'D']} value={size} disabled={locked} snap={snap} onChange={(s) => onChange((c) => followBoxUv(setCubeSize(c, s)))} />
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
        <div className="num-field-row">
          <span className="num-field-row__label">Inflate</span>
          <NumField
            axis="n"
            name="Inflate"
            value={cube.inflate}
            disabled={locked}
            onChange={(inflate) => onChange((c) => ({ ...c, inflate }))}
          />
          <span className="num-field-row__label" style={{ textAlign: 'right' }}>
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
        <p className="editor-hint editor-hint--warn">
          <Icon name="warning" size={11} /> Block models rotate on 1 axis only, at {'\u00b1'}22.5{'\u00b0'} or {'\u00b1'}45{'\u00b0'}.
        </p>
      ) : null}

      <div className="insp-tex">
        <div className="insp-tex__head">
          <span className="studio-label">Texture</span>
          <button
            className="uv-switch"
            role="switch"
            aria-checked={cube.boxUv}
            disabled={locked}
            title="Box UV: the faces are one unwrap that follows the cube's size"
            onClick={() => onChange((c) => setBoxUv(c, !c.boxUv))}
          >
            Box UV <span className="uv-switch__track" />
          </button>
        </div>
        <div className="insp-tex__uv">
          <NumField axis="n" tag="U" name="Unwrap U" value={u0} disabled={locked} onChange={(v) => onChange((c) => moveFacesUv(c, FACES, v - unwrapOrigin(c)[0], 0))} />
          <NumField axis="n" tag="V" name="Unwrap V" value={v0} disabled={locked} onChange={(v) => onChange((c) => moveFacesUv(c, FACES, 0, v - unwrapOrigin(c)[1]))} />
        </div>
        {texture?.source ? (
          <div className="insp-tex__sheet" style={{ backgroundImage: `url(${texture.source})`, aspectRatio: `${model.resolution.width} / ${model.resolution.height}` }}>
            {FACES.map((k) => {
              const r = faceBounds(cube.faces[k].uv)
              if (r[2] <= r[0] || r[3] <= r[1]) return null
              const { width: W, height: H } = model.resolution
              return <span key={k} style={{ left: `${(r[0] / W) * 100}%`, top: `${(r[1] / H) * 100}%`, width: `${((r[2] - r[0]) / W) * 100}%`, height: `${((r[3] - r[1]) / H) * 100}%` }} />
            })}
          </div>
        ) : null}
        <p className="editor-hint">
          {cube.boxUv
            ? `The ${cube.name}\u2019s box UV: ${box[0]} \u00d7 ${box[1]} texels at ${u0}, ${v0}. Its faces follow when you resize it.`
            : `Its faces start at ${u0}, ${v0}, and each is set on its own in the UV panel. Turn on Box UV to keep them one unwrap.`}
        </p>
      </div>

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

const UV_HANDLES: UvHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Snaps a UV drag: whole texels, Shift half texels, Ctrl free. */
const snapUv = (v: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) =>
  e.ctrlKey || e.metaKey ? Math.round(v * 100) / 100 : e.shiftKey ? Math.round(v * 2) / 2 : Math.round(v)

function UVPanel({
  model,
  cube,
  face,
  onFace,
  onChange,
  onPaint,
  onDrag,
  fallbackTexture,
  onReunwrap,
  carry,
  onCarry,
}: {
  /** moving a face takes its pixels with it */
  carry: boolean
  onCarry: (v: boolean) => void
  model: Model
  cube: Cube | null
  face: FaceKey
  onFace: (f: FaceKey) => void
  onChange: (fn: (c: Cube) => Cube) => void
  /** gets a point on the sheet in UV units; set only in paint mode */
  onPaint?: (u: number, v: number, phase: 'down' | 'move') => void
  /** one undo step per drag: `set` replaces the cube with each new version */
  onDrag: { begin: () => void; set: (c: Cube) => void; end: () => void }
  /** shown when the face has no texture of its own */
  fallbackTexture: Texture | null
  onReunwrap: () => void
}) {
  const { width, height } = model.resolution
  const sheet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; start: Cube; face: FaceKey; handle: UvHandle | null; moved: boolean } | null>(null)
  // the sheet's zoom: 1 fits the panel; Ctrl + wheel or the buttons change it
  const [zoom, setZoom] = useState(1)
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = frame.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => Math.max(1, Math.min(8, z * Math.exp(-e.deltaY * 0.004))))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [cube === null])

  if (!cube) return <p className="editor-hint">No cube selected.</p>

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const current = cube.faces[face]
  const texture = textureById(model, current.texture) ?? fallbackTexture
  const locked = cube.locked

  /** where the pointer is on the sheet, in UV units */
  const at = (e: { clientX: number; clientY: number }) => {
    const r = sheet.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height] as const
  }

  const beginDrag = (e: React.PointerEvent, key: FaceKey, handle: UvHandle | null) => {
    if (onPaint || e.button !== 0) return
    e.stopPropagation()
    onFace(key)
    if (locked) return
    sheet.current?.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: cube, face: key, handle, moved: false }
  }

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !sheet.current) return
    const r = sheet.current.getBoundingClientRect()
    let dx = snapUv(((e.clientX - d.x) / r.width) * width, e)
    let dy = snapUv(((e.clientY - d.y) / r.height) * height, e)
    if (!d.moved) {
      if (!dx && !dy) return
      d.moved = true
      onDrag.begin()
    }
    let next: Cube
    if (d.handle) {
      next = resizeFaceUv(d.start, d.face, d.handle, dx, dy)
    } else {
      // a move stops at the sheet's edges; a box unwrap moves as one
      const keys = d.start.boxUv ? FACES : [d.face]
      const rects = keys.map((k) => faceBounds(d.start.faces[k].uv))
      const lo = [Math.min(...rects.map((q) => q[0])), Math.min(...rects.map((q) => q[1]))]
      const hi = [Math.max(...rects.map((q) => q[2])), Math.max(...rects.map((q) => q[3]))]
      dx = Math.max(-lo[0], Math.min(width - hi[0], dx))
      dy = Math.max(-lo[1], Math.min(height - hi[1], dy))
      next = moveFaceUv(d.start, d.face, dx, dy)
    }
    onDrag.set(next)
  }

  const endDrag = () => {
    if (drag.current?.moved) onDrag.end()
    drag.current = null
  }

  // other cubes' faces, faintly, so free room on the sheet shows
  const others = model.cubes.flatMap((c) =>
    c.id === cube.id
      ? []
      : FACES.map((k) => ({ id: `${c.id}:${k}`, name: c.name, r: faceBounds(c.faces[k].uv) })).filter((o) => o.r[2] > o.r[0] && o.r[3] > o.r[1]),
  )
  const mine = FACES.map((k) => faceBounds(cube.faces[k].uv)).filter((r) => r[2] > r[0] && r[3] > r[1])
  const clash = others.find((o) => mine.some((r) => r[0] < o.r[2] && o.r[0] < r[2] && r[1] < o.r[3] && o.r[1] < r[3]))

  return (
    <>
      <div className="uv-head">
        <label className="uv-head__texture">
          <span>Texture</span>
          <select
            className="editor-select"
            aria-label={`Texture on the ${face} face`}
            value={current.texture ?? ''}
            disabled={locked}
            onChange={(e) => {
              const id = e.target.value || null
              onChange((c) => ({ ...c, faces: { ...c.faces, [face]: { ...c.faces[face], texture: id } } }))
            }}
          >
            <option value="">None</option>
            {model.textures.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="uv-switch"
          role="switch"
          aria-checked={cube.boxUv}
          disabled={locked}
          title="Box UV: the faces follow the cube's size and move as one unwrap, as Minecraft's own models do"
          onClick={() => onChange((c) => setBoxUv(c, !c.boxUv))}
        >
          Box UV <span className="uv-switch__track" />
        </button>
      </div>

      <div className="uv-frame">
      <div className="uv-zoom" role="group" aria-label="UV sheet zoom">
        <button aria-label="Zoom the UV sheet out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z / 1.5))}>
          <Icon name="minus" size={12} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom the UV sheet in" disabled={zoom >= 8} onClick={() => setZoom((z) => Math.min(8, z * 1.5))}>
          <Icon name="plus" size={12} />
        </button>
      </div>
      <div className="uv-scroll" ref={frame}>
      <div
        ref={sheet}
        className={`uv${onPaint ? ' uv--paint' : ''}${cube.boxUv ? ' uv--box' : ''}`}
        style={{
          width: `${zoom * 100}%`,
          aspectRatio: `${width} / ${height}`,
          ...(texture?.source ? { backgroundImage: `url(${texture.source})`, backgroundSize: '100% 100%', imageRendering: 'pixelated' } : {}),
        }}
        onPointerDown={
          onPaint
            ? (e) => {
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                const [u, v] = at(e)
                onPaint(u, v, 'down')
              }
            : undefined
        }
        onPointerMove={
          onPaint
            ? (e) => {
                if (e.buttons !== 1) return
                const [u, v] = at(e)
                onPaint(u, v, 'move')
              }
            : moveDrag
        }
        onPointerUp={onPaint ? undefined : endDrag}
        onPointerCancel={onPaint ? undefined : endDrag}
      >
        {others.map((o) => (
          <span
            key={o.id}
            className="uv__other"
            title={o.name}
            style={{ left: pct(o.r[0], width), top: pct(o.r[1], height), width: pct(o.r[2] - o.r[0], width), height: pct(o.r[3] - o.r[1], height) }}
          />
        ))}
        {FACES.map((key) => {
          const [x1, y1, x2, y2] = cube.faces[key].uv
          const left = Math.min(x1, x2)
          const top = Math.min(y1, y2)
          const w = Math.abs(x2 - x1)
          const h = Math.abs(y2 - y1)
          if (!w || !h) return null
          const active = key === face
          return (
            <div
              key={key}
              role="button"
              tabIndex={-1}
              data-face={key}
              className={`uv__face${active ? ' uv__face--active' : ''}`}
              style={{
                left: pct(left, width),
                top: pct(top, height),
                width: pct(w, width),
                height: pct(h, height),
                pointerEvents: onPaint ? 'none' : undefined,
                cursor: locked ? 'not-allowed' : 'move',
              }}
              onPointerDown={(e) => beginDrag(e, key, null)}
              title={`${key} · ${x1},${y1} → ${x2},${y2}${locked ? '' : '. Drag to move it.'}`}
            >
              {key[0].toUpperCase()}
              {active && !onPaint && !locked && !cube.boxUv
                ? UV_HANDLES.map((hd) => (
                    <span
                      key={hd}
                      className={`uv__handle uv__handle--${hd}`}
                      data-handle={hd}
                      onPointerDown={(e) => beginDrag(e, key, hd)}
                    />
                  ))
                : null}
            </div>
          )
        })}
        <span className="uv__ruler" style={{ left: 4, bottom: 3 }}>
          0,0
        </span>
        <span className="uv__ruler" style={{ right: 4, bottom: 3 }}>
          {width},{height}
        </span>
      </div>
      </div>
      </div>
      {clash ? <p className="editor-hint editor-hint--warn">Overlaps {clash.name} on the sheet, so painting one paints both.</p> : null}
      <button
        className="uv-switch uv-carry"
        role="switch"
        aria-checked={carry}
        title="When a face is dragged to a new place on the sheet, its pixels go with it"
        onClick={() => onCarry(!carry)}
      >
        <span>Move pixels with the face</span> <span className="uv-switch__track" />
      </button>

      <div className="uv-faces">
        {FACES.map((key) => (
          <button key={key} className="chip" aria-pressed={key === face} onClick={() => onFace(key)}>
            {key}
          </button>
        ))}
      </div>

      <div className="num-field-grid" style={{ marginTop: 9 }}>
        <div className="num-field-row">
          <span className="num-field-row__label">UV from</span>
          <NumField axis="x" name="UV from X" value={current.uv[0]} disabled={locked || cube.boxUv} onChange={(v) => onChange((c) => patchUV(c, face, 0, v))} />
          <NumField axis="y" name="UV from Y" value={current.uv[1]} disabled={locked || cube.boxUv} onChange={(v) => onChange((c) => patchUV(c, face, 1, v))} />
          <span className="num-field-row__label" />
        </div>
        <div className="num-field-row">
          <span className="num-field-row__label">UV to</span>
          <NumField axis="x" name="UV to X" value={current.uv[2]} disabled={locked || cube.boxUv} onChange={(v) => onChange((c) => patchUV(c, face, 2, v))} />
          <NumField axis="y" name="UV to Y" value={current.uv[3]} disabled={locked || cube.boxUv} onChange={(v) => onChange((c) => patchUV(c, face, 3, v))} />
          <span className="num-field-row__label" />
        </div>
      </div>
      {cube.boxUv ? <p className="editor-hint">Box UV is on, so drag the unwrap to move it. Turn it off to edit faces one by one.</p> : null}

      <div className="chip-row">
        <button
          className="chip"
          title="Turn the texture within this face"
          disabled={locked}
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
          title={cube.boxUv ? 'Mirror the whole unwrap, as Blockbench’s Mirror UV does' : 'Mirror the texture on this face by swapping its UV horizontally'}
          disabled={locked}
          onClick={() =>
            onChange((c) => {
              if (c.boxUv) return followBoxUv({ ...c, mirrorUv: !c.mirrorUv || undefined })
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
        <button
          className="chip"
          title="Lay the selected cubes out as a box at their current size. A cube that does not fit where it is moves to free room on the sheet."
          disabled={locked}
          onClick={onReunwrap}
        >
          <Icon name="resize" size={11} /> Re-unwrap
        </button>
        <button
          className="chip"
          title="Give every face of this cube the texture this face has"
          disabled={locked}
          onClick={() => onChange((c) => ({ ...c, faces: Object.fromEntries(FACES.map((k) => [k, { ...c.faces[k], texture: current.texture }])) as Cube['faces'] }))}
        >
          <Icon name="cube" size={11} /> Texture to all faces
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

/** Starting palette for painting, named after familiar blocks. */
const PAINTS: [name: string, hex: string][] = [
  ['Coal', '#1f1f23'],
  ['Stone', '#7d7d7d'],
  ['Snow', '#eef2f2'],
  ['Dirt', '#86603f'],
  ['Oak', '#a2824e'],
  ['Sand', '#d9cb9a'],
  ['Grass', '#5f9a3a'],
  ['Water', '#3f76e4'],
  ['Diamond', '#4ecdc4'],
  ['Amethyst', '#8a5ec2'],
  ['Redstone', '#b3261e'],
  ['Gold', '#f2c53d'],
]

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

function ColorPanel({ colour, onColour, palette }: { colour: string; onColour: (hex: string) => void; palette?: string[] }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [hue, setHue] = useState(() => hexToHsv(colour)[0])
  const [sat, setSat] = useState(() => hexToHsv(colour)[1])
  const [val, setVal] = useState(() => hexToHsv(colour)[2])

  /* Resync HSV only when the colour changes from outside (the pipette).
     Re-deriving it from our own output would lose the hue of a grey. */
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

      {palette?.length ? <div className="studio-label palette__label">On this model</div> : null}
      <div className="palette">
        {(palette?.length ? palette.map((c) => [c, c] as const) : PAINTS).map(([name, c]) => (
          <button
            key={c}
            className="palette__dot"
            style={{ background: c }}
            title={`${name} ${c}`}
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

type Drop = { id: string; where: 'before' | 'after' | 'into' }

/** An outliner row: a bone or cube from the tree, or a mesh listed under its bone. */
type OutlineRow = ReturnType<typeof flattenBones>[number] | { kind: 'mesh'; depth: number; mesh: Mesh }

function Outliner({
  model,
  selection,
  collapsed,
  onSelect,
  onToggleBone,
  onModel,
  onRename,
  onMove,
  onPlace,
  renameRequest,
}: {
  model: Model
  selection: readonly string[]
  collapsed: Set<string>
  /** `range` is the ids from the last pick to this one, for Shift-click */
  onSelect: (id: string, mods: PickMods, range: string[]) => void
  onToggleBone: (id: string) => void
  onModel: (label: string, fn: (m: Model) => Model) => void
  onRename: (id: string, name: string) => void
  /** null parent means "make it a root" */
  onMove: (id: string, parentId: string | null) => void
  /** put a node just before or after another one, among that one's siblings */
  onPlace: (id: string, beside: string, after: boolean) => void
  /** F2: the id to start renaming, with a counter so the same id can be asked twice */
  renameRequest: { id: string; n: number } | null
}) {
  /* The bone tree, with each bone's meshes listed first under it (a mesh
     names its bone; the tree itself does not list meshes), and meshes at
     the root last. */
  const rows = useMemo(() => {
    const meshes = model.meshes ?? []
    const out: OutlineRow[] = []
    const bonesSeen = new Set<string>()
    for (const r of flattenBones(model, collapsed)) {
      out.push(r)
      if (r.kind !== 'bone') continue
      bonesSeen.add(r.bone.id)
      if (collapsed.has(r.bone.id)) continue
      for (const m of meshes) if (m.parent === r.bone.id) out.push({ kind: 'mesh', depth: r.depth + 1, mesh: m })
    }
    const allBones = new Set<string>()
    const walk = (bs: Bone[]) => bs.forEach((b) => (allBones.add(b.id), walk(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))))
    walk(model.bones)
    for (const m of meshes) if (!m.parent || !allBones.has(m.parent)) out.push({ kind: 'mesh', depth: 0, mesh: m })
    return out
  }, [model, collapsed])
  const [editing, setEditing] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<Drop | null>(null)
  const picked = useMemo(() => new Set(selection), [selection])
  const primary = selection[selection.length - 1] ?? null

  useEffect(() => {
    if (renameRequest) setEditing(renameRequest.id)
  }, [renameRequest])

  /* The top and bottom quarter of a row put the dragged node beside it;
     the middle of a bone puts it inside. */
  const dropAt = (x: number, y: number): Drop | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-node]') as HTMLElement | null
    const id = el?.dataset.node
    if (!el || !id) return null
    const r = el.getBoundingClientRect()
    const k = (y - r.top) / r.height
    const bone = bonesById.has(id)
    if (k < (bone ? 0.28 : 0.5)) return { id, where: 'before' }
    if (k > (bone ? 0.72 : 0.5)) return { id, where: 'after' }
    return { id, where: 'into' }
  }

  /* Pointer events, because HTML5 drag-and-drop does not work on touch.
     A 5px threshold keeps a click from starting a drag. */
  const press = useRef<{ id: string; x: number; y: number; pointerId: number; moved: boolean } | null>(null)
  /* pointerup clears the drag before click fires, so this flag stops the
     click from selecting and collapsing the row that was just dropped */
  const swallowClick = useRef(false)

  const onRowMove = (e: React.PointerEvent) => {
    const held = press.current
    if (!held) return
    if (!held.moved && Math.hypot(e.clientX - held.x, e.clientY - held.y) < 5) return
    if (!held.moved) {
      held.moved = true
      setDragId(held.id)
      /* Capture only once the drag starts. Capturing on pointerdown sends
         the following click to the capture element, which breaks row
         selection and double-click rename. */
      e.currentTarget.setPointerCapture(held.pointerId)
    }
    const target = dropAt(e.clientX, e.clientY)
    setOver(target && target.id !== held.id ? target : null)
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
    const target = dropAt(e.clientX, e.clientY)
    if (!target) onMove(held.id, null)
    else if (target.id !== held.id) {
      if (target.where === 'into') onMove(held.id, target.id)
      else onPlace(held.id, target.id, target.where === 'after')
    }
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

  const setMesh = (id: string, patch: Partial<Mesh>) =>
    onModel('mesh toggle', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

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
        const isMesh = row.kind === 'mesh'
        const node = row.kind === 'bone' ? row.bone : row.kind === 'mesh' ? row.mesh : row.cube
        const visible = node.visible
        const locked = node.locked
        const region = isBone && isRegionBone(model, row.bone)
        return (
          <div
            key={node.id}
            role="treeitem"
            aria-selected={picked.has(node.id)}
            data-primary={node.id === primary || undefined}
            data-hidden={!visible || undefined}
            data-region={region || undefined}
            data-drop={over?.id === node.id ? over.where : undefined}
            data-dragged={dragId === node.id || undefined}
            data-node={node.id}
            className="tree__row"
            style={{ paddingLeft: 6 + row.depth * 13 }}
            onPointerDown={(e) => {
              if (editing === node.id || e.button !== 0) return
              // a new press clears a swallow left over from the last drop
              swallowClick.current = false
              press.current = { id: node.id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, moved: false }
            }}
            onClick={(e) => {
              // ignore the click that ends a drag
              if (dragId || swallowClick.current) {
                swallowClick.current = false
                return
              }
              const mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
              const ids = rows.map((r) => (r.kind === 'bone' ? r.bone.id : r.kind === 'mesh' ? r.mesh.id : r.cube.id))
              const a = primary ? ids.indexOf(primary) : -1
              const b = ids.indexOf(node.id)
              const range = a >= 0 && b >= 0 ? ids.slice(Math.min(a, b), Math.max(a, b) + 1) : [node.id]
              onSelect(node.id, mods, range)
              // the chevron area collapses; a plain click on a selected bone does too, as before
              if (isBone && editing !== node.id && !mods.shift && !mods.ctrl) onToggleBone(node.id)
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
            <Icon name={isBone ? 'folder' : isMesh ? 'vertex' : 'cube'} size={12} className="tree__icon" />

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
              <span className="tree__name" title="Double-click or F2 to rename. Drag onto a bone to put it inside, or above or below a row to reorder.">
                {node.name}
              </span>
            )}

            {/* Mobs only. Adds or removes a hit region: a child bone holding
                one hidden cube (see lib/hitregions). */}
            {isBone && model.kind === 'mobs' ? (
              region ? (
                <button
                  className="tree__toggle"
                  data-on
                  data-region
                  title={`${node.name} is a hit region. Click to remove it.`}
                  aria-label={`Remove the hit region ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onModel('remove hit region', (m) => deleteBone(m, node.id))
                  }}
                >
                  <Icon name="shape" size={11} />
                </button>
              ) : (
                <button
                  className="tree__toggle"
                  title={`Add a hit region on ${node.name}`}
                  aria-label={`Add a hit region on ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onModel('add hit region', (m) => addHitRegion(m, node.id)?.model ?? m)
                  }}
                >
                  <Icon name="shape" size={11} />
                </button>
              )
            ) : null}

            <button
              className="tree__toggle"
              data-on={locked || undefined}
              title={locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
              aria-label={locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
              onClick={(e) => {
                e.stopPropagation()
                if (isBone) setBone(node.id, { locked: !locked })
                else if (isMesh) setMesh(node.id, { locked: !locked })
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
                else if (isMesh) setMesh(node.id, { visible: !visible })
                else setCube(node.id, { visible: !visible })
              }}
            >
              <Icon name={visible ? 'eye' : 'eyeOff'} size={11} />
            </button>
          </div>
        )
      })}
      <div className="tree__root-drop">{dragId ? 'Release here to make it a root' : null}</div>
    </div>
  )
}

/* ================= bone panel ================= */

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
      <div className="num-field-grid">
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

      <p className="editor-hint" style={{ marginTop: 10 }}>
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

/* ================= null objects ================= */

/** A null object's settings: where it is, which bone it rides on, and the IK chain that reaches for it. */
/** The inspector for a mesh: its place, how it is being picked, and the edits on the pick. */
type MeshMode = 'object' | 'face' | 'vertex' | 'edge'
const MESH_MODES: MeshMode[] = ['object', 'face', 'vertex', 'edge']
const MESH_NOUN: Record<MeshMode, [string, string]> = { object: ['mesh', 'meshes'], face: ['face', 'faces'], vertex: ['vertex', 'vertices'], edge: ['edge', 'edges'] }
type MeshOps = {
  extrude: () => void
  remove: () => void
  merge: () => void
  flip: () => void
  selectAll: () => void
  loopCut: () => void
  subdivide: () => void
  bevel: () => void
  inset: () => void
  fill: () => void
  dissolve: () => void
  knife: () => void
  mergeNear: () => void
  separate: () => void
  join: () => void
  /** an edge slide is a drag: begin, set the amount (-1 to 1) as it goes, end */
  slide: { begin: () => void; set: (amount: number) => void; end: () => void }
}

/**
 * Lays some faces of a mesh out flat at one texel per unit, each packed into
 * room the rest of the sheet leaves free. The faces' old UVs don't count as
 * taken. `crowded` says some found no room and sit at the corner.
 */
function packMeshFaces(model: Model, mesh: Mesh, faces: readonly string[]): { mesh: Mesh; crowded: boolean } {
  const cleared = { ...mesh, faces: Object.fromEntries(Object.entries(mesh.faces).map(([k, f]) => [k, faces.includes(k) ? { ...f, uv: {} } : f])) }
  const others = (model.meshes ?? []).filter((x) => x.id !== mesh.id)
  const room = { ...model, meshes: [...others, cleared] }
  const placed: UVRect[] = []
  let crowded = false
  const next = projectUv(mesh, [...faces], (w, h) => {
    const spot = findSpot(room, [w, h], placed)
    if (!spot) crowded = true
    const [x, y] = spot ?? [0, 0]
    placed.push([x, y, x + w, y + h])
    return [x, y]
  })
  return { mesh: next, crowded }
}

function MeshPanel({
  segments,
  onSegments,
  distance,
  onDistance,
  joinable,
  amount,
  onAmount,
  knife,
  onKnifeCancel,
  mesh,
  model,
  bones,
  snap,
  mode,
  onMode,
  picked,
  keys,
  ops,
  onEdit,
  onRename,
  onMove,
  onDelete,
  pickedFaces,
}: {
  mesh: Mesh
  model: Model
  bones: Array<{ id: string; name: string; depth: number }>
  snap: boolean
  mode: MeshMode
  onMode: (m: MeshMode) => void
  picked: number
  keys: string[]
  ops: MeshOps
  onEdit: (label: string, fn: (m: Mesh) => Mesh) => void
  onRename: (name: string) => void
  onMove: (bone: string | null) => void
  onDelete: () => void
  pickedFaces: string[]
  /** faces across a bevel's strip */
  segments: number
  onSegments: (v: number) => void
  /** how close vertices must be to merge by distance */
  distance: number
  onDistance: (v: number) => void
  /** other meshes picked in the outliner, which Join would bring in */
  joinable: number
  /** how far bevel and inset go */
  amount: number
  onAmount: (v: number) => void
  /** the knife's points, while it cuts */
  knife: number | null
  onKnifeCancel: () => void
}) {
  const locked = mesh.locked
  const [slide, setSlide] = useState(0)
  const centre = centreOf(mesh, keys)
  const faceKeys = pickedFaces.length ? pickedFaces : Object.keys(mesh.faces)
  const textures = new Set(faceKeys.map((k) => mesh.faces[k]?.texture ?? ''))
  return (
    <>
      <div className="insp-head">
        <Icon name="vertex" size={15} />
        <input
          key={`${mesh.id}:${mesh.name}`}
          className="insp-head__name"
          defaultValue={mesh.name}
          aria-label="Mesh name"
          spellCheck={false}
          disabled={locked}
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== mesh.name) onRename(name)
            else e.target.value = mesh.name
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <button className="insp-head__delete" aria-label={`Delete ${mesh.name}`} title="Delete this mesh" disabled={locked} onClick={onDelete}>
          <Icon name="trash" size={15} />
        </button>
      </div>
      <label className="clip-props__row insp-bone">
        <span>In bone</span>
        <select className="editor-select" value={mesh.parent ?? ''} disabled={locked} onChange={(e) => onMove(e.target.value || null)}>
          <option value="">(no bone)</option>
          {bones.map((b) => (
            <option key={b.id} value={b.id}>
              {'\u2002'.repeat(b.depth)}
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <div className="num-field-grid">
        <NumRow label="Position" value={mesh.origin} disabled={locked} snap={snap} onChange={(origin) => onEdit('move mesh', (m) => ({ ...m, origin }))} />
        <NumRow label="Rotation" value={mesh.rotation} disabled={locked} step={2.5} onChange={(rotation) => onEdit('turn mesh', (m) => ({ ...m, rotation }))} />
      </div>

      <div className="insp-tex">
        <div className="insp-tex__head">
          <span className="studio-label">Edit</span>
          <span className="studio-seg mesh-modes" role="group" aria-label="Mesh selection">
            {MESH_MODES.map((m, i) => (
              <button key={m} aria-pressed={mode === m} title={`${m[0].toUpperCase() + m.slice(1)} (${i + 1})`} onClick={() => onMode(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </span>
        </div>
        {mode === 'object' ? (
          <>
            <p className="editor-hint">The gizmo moves, turns and re-pivots the whole mesh. Pick Face, Vertex or Edge (2, 3, 4) to shape it.</p>
            <div className="chip-row" style={{ marginTop: 10 }}>
              <button className="chip" disabled={locked} onClick={ops.subdivide} title="Split every face into four">
                Subdivide
              </button>
              <button className="chip" disabled={locked} onClick={ops.knife} title="Cut across faces: click points on edges, then Enter (K)">
                Knife
              </button>
              <button className="chip" disabled={locked} onClick={ops.mergeNear} title={`Merge vertices closer than ${distance} to each other`}>
                Merge by distance
              </button>
              <button className="chip" disabled={locked || !joinable} onClick={ops.join} title="Bring the other meshes picked in the outliner into this one (Ctrl+J)">
                Join{joinable ? ` ${joinable + 1}` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="editor-hint">
              {picked
                ? `${picked} ${MESH_NOUN[mode][picked === 1 ? 0 : 1]} picked. Drag the gizmo to move ${picked === 1 ? 'it' : 'them'}.`
                : `Click ${mode === 'face' ? 'a face' : mode === 'edge' ? 'an edge' : 'a vertex'} in the viewport. Shift adds, B draws a box, Ctrl+A picks all.`}
            </p>
            {keys.length ? (
              <div className="num-field-grid">
                <NumRow
                  label="Middle of the pick"
                  value={centre.map((v) => Math.round(v * 1000) / 1000) as Vec3}
                  disabled={locked}
                  snap={snap}
                  onChange={(to) => onEdit(`move ${MESH_NOUN[mode][1]}`, (m) => moveVertices(m, keys, sub(to, centreOf(m, keys))))}
                />
              </div>
            ) : null}
            {knife !== null ? (
              <div className="mesh-knife" role="status">
                <span>
                  Knife: {knife ? `${knife} ${knife === 1 ? 'point' : 'points'}` : 'click points on edges'}. Enter cuts, Esc stops.
                </span>
                <button className="chip" disabled={knife < 2} onClick={ops.knife}>
                  Cut
                </button>
                <button className="chip" onClick={onKnifeCancel}>
                  Cancel
                </button>
              </div>
            ) : null}
            {mode === 'vertex' ? (
              <div className="num-field-grid">
                <div className="num-field-row">
                  <span className="num-field-row__label">Distance</span>
                  <NumField axis="n" tag="D" name="Merge distance" value={distance} step={0.05} onChange={(v) => onDistance(Math.max(0.001, Math.round(v * 1000) / 1000))} />
                  <span className="num-field-row__label" />
                  <span className="num-field-row__label" />
                </div>
              </div>
            ) : null}
            {mode === 'face' || mode === 'edge' || mode === 'vertex' ? (
              <div className="num-field-grid">
                <div className="num-field-row">
                  <span className="num-field-row__label">{mode === 'face' ? 'Inset' : 'Bevel'}</span>
                  <NumField axis="n" tag="W" name={mode === 'face' ? 'Inset by' : 'Bevel width'} value={amount} step={0.5} onChange={(v) => onAmount(Math.max(0.05, Math.round(v * 100) / 100))} />
                  {mode === 'face' ? (
                    <span className="num-field-row__label" />
                  ) : (
                    <NumField axis="n" tag="N" name="Bevel segments" value={segments} step={1} onChange={(v) => onSegments(Math.max(1, Math.min(16, Math.round(v))))} />
                  )}
                  <span className="num-field-row__label" />
                </div>
              </div>
            ) : null}
            <div className="chip-row" style={{ marginTop: 10 }}>
              {mode === 'face' ? (
                <>
                  <button className="chip" disabled={!picked || locked} onClick={ops.extrude} title="Pull the picked faces out by 1, joined by new sides (E)">
                    Extrude
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.inset} title="Shrink the picked faces inward, joined by a ring of new faces (I)">
                    Inset
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.flip} title="Turn the picked faces to face the other way (Shift+F)">
                    Flip
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.subdivide} title="Split the picked faces into four each">
                    Subdivide
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.separate} title="Move the picked faces into a mesh of their own (P)">
                    Separate
                  </button>
                </>
              ) : mode === 'edge' ? (
                <>
                  <button className="chip" disabled={picked !== 1 || locked} onClick={ops.loopCut} title="Cut a ring of new edges across the quads this edge runs through (Ctrl+R)">
                    Loop cut
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.bevel} title="Turn the picked edges into strips, as wide as the width (Ctrl+B)">
                    Bevel
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.dissolve} title="Join the two faces on each picked edge into one">
                    Dissolve
                  </button>
                  <button className="chip" disabled={picked < 2 || locked} onClick={ops.fill} title="Make a face between the picked edges (F)">
                    Fill
                  </button>
                </>
              ) : (
                <>
                  <button className="chip" disabled={picked < 2 || locked} onClick={ops.merge} title="Merge the picked vertices into one at their middle (M)">
                    Merge
                  </button>
                  <button className="chip" disabled={!picked || locked} onClick={ops.bevel} title="Cut the picked corners off, as wide as the bevel width (Ctrl+B)">
                    Bevel
                  </button>
                  <button className="chip" disabled={picked < 3 || locked} onClick={ops.fill} title="Make a face through the picked vertices (F)">
                    Fill
                  </button>
                  <button className="chip" disabled={locked} onClick={ops.mergeNear} title={`Merge the picked vertices (or all) closer than ${distance} to each other`}>
                    Merge by distance
                  </button>
                </>
              )}
              <button className="chip" disabled={locked} aria-pressed={knife !== null} onClick={knife !== null ? onKnifeCancel : ops.knife} title="Cut across faces: click points on edges, then Enter (K)">
                Knife
              </button>
              <button className="chip chip--danger" disabled={!picked || locked} onClick={ops.remove} title="Delete the pick (Del)">
                Delete
              </button>
            </div>
            {mode === 'edge' ? (
              <label className="mesh-slide">
                <span>Slide</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.02}
                  value={slide}
                  disabled={!picked || locked}
                  aria-label="Edge slide"
                  title="Slide the picked edges along the faces beside them. Alt+click an edge picks its whole loop."
                  onPointerDown={ops.slide.begin}
                  onKeyDown={ops.slide.begin}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSlide(v)
                    ops.slide.set(v)
                  }}
                  onPointerUp={() => {
                    ops.slide.end()
                    setSlide(0)
                  }}
                  onKeyUp={() => {
                    ops.slide.end()
                    setSlide(0)
                  }}
                  onBlur={() => {
                    ops.slide.end()
                    setSlide(0)
                  }}
                />
              </label>
            ) : null}
          </>
        )}
      </div>

      <label className="clip-props__row">
        <span>Texture</span>
        <select
          className="editor-select"
          aria-label={pickedFaces.length ? 'Texture on the picked faces' : 'Texture on every face'}
          value={textures.size === 1 ? [...textures][0] : 'mixed'}
          disabled={locked}
          onChange={(e) => {
            const id = e.target.value || null
            onEdit('mesh texture', (m) => ({
              ...m,
              faces: Object.fromEntries(Object.entries(m.faces).map(([k, f]) => [k, faceKeys.includes(k) ? { ...f, texture: id } : f])),
            }))
          }}
        >
          {textures.size > 1 ? <option value="mixed" disabled>Mixed</option> : null}
          <option value="">None</option>
          {model.textures.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="editor-hint">{pickedFaces.length ? 'Sets the texture on the picked faces.' : 'Sets the texture on every face. Pick faces to set some.'}</p>
    </>
  )
}

function NullPanel({
  item,
  bones,
  snap,
  onChange,
  onDelete,
}: {
  item: NullObject
  bones: BoneRef[]
  snap: boolean
  onChange: (patch: Partial<Omit<NullObject, 'id'>>) => void
  onDelete: () => void
}) {
  return (
    <>
      <label className="editor-field">
        <span>Name</span>
        <input className="editor-input" value={item.name} maxLength={64} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label className="editor-field">
        <span>Moves with</span>
        <select className="editor-select" value={item.parent ?? ''} onChange={(e) => onChange({ parent: e.target.value || null })}>
          <option value="">The model root</option>
          {bones.map((b) => (
            <option key={b.id} value={b.id}>
              {'\u00a0'.repeat(b.depth * 2)}
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="num-field-grid">
        <NumRow label="Position" value={item.position} snap={snap} disabled={item.locked} onChange={(position) => onChange({ position })} />
      </div>
      <label className="editor-field">
        <span>IK: the bone that reaches for it</span>
        <select className="editor-select" value={item.ikTarget ?? ''} onChange={(e) => onChange({ ikTarget: e.target.value || undefined })}>
          <option value="">No IK, a plain locator</option>
          {bones.map((b) => (
            <option key={b.id} value={b.id}>
              {'\u00a0'.repeat(b.depth * 2)}
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {item.ikTarget ? (
        <label className="editor-field">
          <span>Bones that bend</span>
          <input
            className="editor-input"
            type="number"
            min={1}
            max={8}
            value={item.ikChain ?? 2}
            onChange={(e) => onChange({ ikChain: Math.max(1, Math.min(8, Math.round(Number(e.target.value) || 2))) })}
          />
        </label>
      ) : null}
      <p className="editor-hint" style={{ marginTop: 10 }}>
        <Icon name="info" size={11} />{' '}
        {item.ikTarget
          ? 'Move this point and the chain above the chosen bone bends so the bone reaches it. Key its position in Animate.'
          : 'A locator marks where an effect plays. Pick a bone above to make it an IK target.'}
      </p>
      <div className="chip-row">
        <button className="chip" aria-pressed={item.visible} onClick={() => onChange({ visible: !item.visible })}>
          <Icon name={item.visible ? 'eye' : 'eyeOff'} size={11} /> Visible
        </button>
        <button className="chip" aria-pressed={item.locked} onClick={() => onChange({ locked: !item.locked })}>
          <Icon name="lock" size={11} /> Locked
        </button>
        <button className="chip" onClick={onDelete}>
          <Icon name="trash" size={11} /> Delete
        </button>
      </div>
    </>
  )
}

/** The model's null objects, listed under the outliner tree. */
function NullList({
  nulls,
  selection,
  onSelect,
}: {
  nulls: NullObject[]
  selection: readonly string[]
  onSelect: (id: string, mods: PickMods) => void
}) {
  if (!nulls.length) return null
  return (
    <div className="tree tree--nulls" role="tree" aria-label="Null objects">
      <div className="tree__heading">Null objects</div>
      {nulls.map((n) => (
        <div
          key={n.id}
          role="treeitem"
          aria-selected={selection.includes(n.id)}
          data-hidden={!n.visible || undefined}
          className="tree__row"
          style={{ paddingLeft: 6 }}
          onClick={(e) => onSelect(n.id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
        >
          <span className="tree__null" aria-hidden="true" />
          <span className="tree__name">{n.name}</span>
          {n.ikTarget ? <span className="tree__badge">IK</span> : null}
        </div>
      ))}
    </div>
  )
}

/* ================= viewport ================= */

type ViewPreset = 'Perspective' | 'Front' | 'Side' | 'Top'
const VIEW_PRESETS: ViewPreset[] = ['Perspective', 'Front', 'Side', 'Top']
const VIEW_KEYS: Record<ViewPreset, string> = {
  Perspective: 'Perspective view (Numpad 5)',
  Front: 'Front, orthographic (Numpad 1)',
  Side: 'Side, orthographic (Numpad 3)',
  Top: 'Top, orthographic (Numpad 7)',
}

const quadViews = [
  { tag: 'Perspective', yaw: -34, pitch: -22, ortho: false },
  { tag: 'Front', yaw: 0, pitch: 0, ortho: true },
  { tag: 'Top', yaw: 0, pitch: -90, ortho: true },
  { tag: 'Right', yaw: -90, pitch: 0, ortho: true },
]


/** What the bottom-left hint says for each tool. */
const TOOL_HINTS: Record<string, string> = {
  move: 'Move: drag an arrow, a square or the centre. Shift finer, Ctrl free.',
  resize: 'Resize: drag a handle to grow that side. Shift finer, Ctrl free.',
  rotate: 'Rotate: drag a ring. Ctrl turns freely.',
  pivot: 'Pivot: drag to move the point it turns about.',
  vertex: 'Vertex snap: click a yellow corner, then the corner it should meet.',
  scale: 'Scale: drag a handle, or the centre for all three.',
}

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
  selection,
  gizmo,
  onGizmo,
  snapStep,
  ortho,
  onOrtho,
  viewRef,
  onBoxSelect,
  vertices,
  hint,
  ghosts,
  showNulls,
  flash,
  dock,
  controls,
  view,
  onViewPreset,
  meshPick,
  onPaintMesh,
  guide,
}: {
  /** the axis a grab is held to */
  guide?: 0 | 1 | 2 | null
  meshPick?: MeshPick | null
  onPaintMesh?: (meshId: string, face: string, u: number, v: number, phase: 'down' | 'move') => void
  model: Model
  label: string
  grid: boolean
  quad: boolean
  /** the model's longest axis, in model units */
  extent: number
  clip: Clip | null
  time: number
  selected: string | null
  selection: readonly string[]
  onSelect: (id: string, mods: PickMods) => void
  onDeselect: () => void
  gizmo: GizmoSpec | null
  onGizmo: (e: GizmoEvent) => void
  snapStep: number
  ortho: boolean
  onOrtho: (v: boolean) => void
  viewRef: React.Ref<ViewApi>
  onBoxSelect: (ids: string[], add: boolean) => void
  vertices: VertexLayer | null
  hint: string | null
  ghosts?: Array<{ time: number; side: 'before' | 'after' }>
  showNulls: boolean
  /** an effect that just played, shown for a moment */
  flash: string | null
  /** the tool pill drawn at the bottom of the viewport */
  dock?: ReactNode
  /** extra controls at the top right, beside Solid and Wire */
  controls?: ReactNode
  /** which view tab is lit */
  view: ViewPreset
  onViewPreset: (v: ViewPreset) => void
  onPaint?: (cubeId: string, face: FaceKey, u: number, v: number, phase: 'down' | 'move') => void
  display?: { rotation: Vec3; translation: Vec3; scale: Vec3 } | null
}) {
  const [shading, setShading] = useState<'solid' | 'wire'>('solid')

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
  /* The model stands on the grid at the middle of the scene, so its
     height has to fit in the top half of the box (0.44 of it). */
  const scale = Math.max(1.5, Math.min(16, Math.min(box.w * 0.6, box.h * 0.44) / extent))

  return (
    <div className="editor-view" data-quad={quad || undefined} data-shading={shading}>
      <div className="editor-view__scene" ref={scene}>
        {quad ? (
          <div className="editor-quad">
            {quadViews.map((v) => (
              <div className="editor-quad__cell" key={v.tag}>
                <span className="editor-quad__tag">{v.tag}</span>
                <ModelView
                  model={model}
                  grid={grid}
                  scale={scale * 0.55}
                  orbit
                  initialYaw={v.yaw}
                  initialPitch={v.pitch}
                  ortho={v.ortho}
                  clip={clip}
                  time={time}
                  selected={selected}
                  selection={selection}
                  onSelect={onSelect}
                  onPaint={onPaint}
                  meshPick={meshPick}
                  onPaintMesh={onPaintMesh}
                  display={display}
                  gizmo={gizmo}
                  onGizmo={onGizmo}
                  snapStep={snapStep}
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
            selection={selection}
            onSelect={onSelect}
            onDeselect={onDeselect}
            onPaint={onPaint}
                  meshPick={meshPick}
                  onPaintMesh={onPaintMesh}
            display={display}
            gizmo={gizmo}
            onGizmo={onGizmo}
            snapStep={snapStep}
            ortho={ortho}
            onOrtho={onOrtho}
            nav
            viewRef={viewRef}
            onBoxSelect={onBoxSelect}
            vertices={vertices}
            ghosts={ghosts}
            showNulls={showNulls}
            guide={guide ?? null}
          />
        )}

        <div className="editor-view__corner editor-view__corner--top-left studio-seg" role="group" aria-label={`View of the ${label} model`}>
          {VIEW_PRESETS.map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => onViewPreset(v)} title={VIEW_KEYS[v]}>
              {v}
            </button>
          ))}
        </div>
        {flash ? (
          <div className="editor-view__flash" role="status" key={flash}>
            {flash}
          </div>
        ) : null}

        <div className="editor-view__corner editor-view__corner--top-right">
          <div className="studio-seg" role="group" aria-label="Shading">
            {(['solid', 'wire'] as const).map((s) => (
              <button key={s} aria-pressed={shading === s} onClick={() => setShading(s)}>
                {s === 'solid' ? 'Solid' : 'Wire'}
              </button>
            ))}
          </div>
          {controls}
        </div>
        {dock ? <div className="editor-view__dock">{dock}</div> : null}

        <div className="editor-view__corner editor-view__corner--bottom-left">
          {hint ? <span className="editor-view__hint">{hint}</span> : null}
          <span>
          {onPaint
            ? 'drag a face to paint · right-drag orbit · shift-drag pan · scroll zoom'
            : 'drag orbit · shift-drag pan · scroll zoom · Ctrl-drag select'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ================= animation ================= */

/** State and actions shared by the Animate-mode panels. */
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
  selectedKeys: string[]
  /** 'set' replaces the selection, 'add' adds to it, 'toggle' flips each id */
  selectKeys: (ids: string[], how: 'set' | 'add' | 'toggle') => void
  /** drags every selected key by `dt` seconds; start and end bracket one undo step */
  moveKeys: (dt: number, phase: 'start' | 'move' | 'end') => void
  removeKeys: () => void
  copyKeys: () => void
  pasteKeys: () => void
  setEasing: (interp: Key['interp']) => void
  /** one undo step made of many writes, for graph-editor drags */
  burst: { begin: (label: string) => void; amend: (fn: (m: Model) => Model) => void; end: () => void }
  onion: boolean
  setOnion: (v: boolean) => void
  /** a short tone at each sound key during playback */
  cues: boolean
  setCues: (v: boolean) => void
  nulls: NullObject[]
  events: ClipEvent[]
  selectedEvent: string | null
  selectEvent: (id: string | null) => void
  addEvent: (kind: ClipEvent['kind']) => void
  patchEvent: (id: string, patch: Partial<Omit<ClipEvent, 'id'>>, transient?: boolean) => void
  removeEvent: (id: string) => void
  /** each move is a coalesced commit, so a continuous drag is one undo step */
  dragKey: (keyId: string, time: number, phase: 'down' | 'move' | 'up') => void
  patchKey: (keyId: string, patch: Partial<Omit<Key, 'id'>>, transient?: boolean) => void
  /** auto-animation is offered for mobs only */
  kind: ProjectKind
  /** read by readRig */
  model: Model
  /** builds a preset clip and selects it; returns the clip's name, or null */
  autoAnimate: (presetId: string) => string | null
}

/** Strips only the `animation.<model>.` prefix, so dots later in the name are kept. */
export function clipLabel(name: string) {
  const m = /^animation\.[^.]+\.(.+)$/.exec(name)
  return m ? m[1] : name
}

const LOOPS: Array<Clip['loop']> = ['loop', 'once', 'hold', 'pingpong']
const SNAPS = [0, 12, 24, 30, 60]

/**
 * Shows what readRig found before offering presets, so a wrong guess
 * (a "blade_left" read as an arm) is visible.
 */
function AutoAnimate({ anim }: { anim: AnimApi }) {
  const [note, setNote] = useState<string | null>(null)
  const rig = useMemo(() => readRig(anim.model), [anim.model])

  if (anim.kind !== 'mobs') {
    return (
      <p className="editor-hint">
        <Icon name="info" size={11} /> Auto-animation reads a skeleton, so it only works for mobs. This project makes{' '}
        {anim.kind.replace(/s$/, '')} models.
      </p>
    )
  }

  const say = (text: string) => {
    setNote(text)
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 5000)
  }

  return (
    <>
      <p className="editor-hint" style={{ marginTop: 0 }}>
        <Icon name="anim" size={11} /> Read {rig.bones.length} bones and found {rig.summary}.{' '}
        {rig.confidence >= 0.6
          ? 'Mostly from their names.'
          : rig.confidence > 0
            ? 'Mostly from their shape, since the names say little.'
            : 'From their shape alone, because no bone names were recognised.'}
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
                say(name ? `Built ${name}. Edit it like any other clip.` : `No bones for ${preset.label} to move.`)
              }}
            >
              <span className="auto__name">{preset.label}</span>
              <span className="auto__blurb">{missing ? `Cannot: ${missing}` : preset.blurb}</span>
            </button>
          )
        })}
      </div>

      {note ? <p className="editor-hint editor-hint--warn">{note}</p> : null}
      <p className="editor-hint">
        <Icon name="info" size={11} /> A starting point. Every key is editable on the timeline.
      </p>
    </>
  )
}

function AnimationPanel({ anim }: { anim: AnimApi }) {
  const { clip } = anim
  const list = useRef<HTMLDivElement>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  if (!clip) {
    return (
      <>
        <p className="editor-hint">No animations yet. Add one with + Clip, or let auto-animate read the rig.</p>
        <div className="editor-rule" />
        <AutoAnimate anim={anim} />
      </>
    )
  }

  return (
    <>
      {/* the clips as a list, as in the design; Enter or a double-click renames */}
      <div
        className="clip-list"
        role="listbox"
        aria-label="Clips"
        ref={list}
        onKeyDown={(e) => {
          if (renaming) return
          if (e.key === 'F2' || e.key === 'Enter') {
            e.preventDefault()
            setRenaming(clip.id)
            return
          }
          arrowNav(list.current, e, { select: '[role="option"]' })
        }}
      >
        {anim.clips.map((c) => (
          <div
            key={c.id}
            role="option"
            aria-selected={c.id === clip.id}
            tabIndex={c.id === clip.id ? 0 : -1}
            className="clip-list__row"
            onFocus={() => c.id !== clip.id && anim.selectClip(c.id)}
            onClick={() => anim.selectClip(c.id)}
            onDoubleClick={() => setRenaming(c.id)}
            title={`${c.name}. Double-click to rename.`}
          >
            {renaming === c.id ? (
              <input
                className="clip-list__rename"
                autoFocus
                defaultValue={c.name}
                spellCheck={false}
                aria-label="Clip name"
                onBlur={(e) => {
                  const name = e.target.value.trim().replace(/\s+/g, '_')
                  if (name && name !== c.name) anim.patchClip({ name })
                  setRenaming(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <span className="clip-list__name">{clipLabel(c.name)}</span>
            )}
            <span className="clip-list__len">{c.length.toFixed(2)} s</span>
          </div>
        ))}
      </div>

      <div className="clip-props">
        <label className="clip-props__row">
          <span>Length</span>
          <NumField
            axis="n"
            name="Clip length in seconds"
            step={0.1}
            value={clip.length}
            onChange={(v) => anim.patchClip({ length: Math.max(0.1, Number(v.toFixed(3))) })}
          />
          <span className="clip-props__unit">s</span>
        </label>
        <div className="clip-props__row">
          <span>Loop</span>
          <span className="studio-seg clip-props__loop" role="group" aria-label="Loop">
            {LOOPS.map((l) => (
              <button key={l} aria-pressed={clip.loop === l} onClick={() => anim.patchClip({ loop: l })} title={LOOP_TIPS[l]}>
                {l === 'pingpong' ? 'Ping-pong' : l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </span>
        </div>
        <label className="clip-props__row">
          <span>Snap</span>
          <select className="editor-select" value={clip.snapping} onChange={(e) => anim.patchClip({ snapping: Number(e.target.value) })}>
            {SNAPS.map((s) => (
              <option key={s} value={s}>
                {s ? `${s} per second` : 'off'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="chip-row" style={{ marginTop: 12 }}>
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
    </>
  )
}

const LOOP_TIPS: Record<Clip['loop'], string> = {
  loop: 'Plays again from the start',
  once: 'Plays once and returns to the rest pose',
  hold: 'Plays once and holds the last frame',
  pingpong: 'Plays forwards, then backwards',
}

const EASINGS: Array<{ id: Key['interp']; label: string }> = [
  { id: 'linear', label: 'Linear' },
  { id: 'catmullrom', label: 'Smooth (Catmull-Rom)' },
  { id: 'bezier', label: 'Bezier' },
  { id: 'step', label: 'Step' },
]

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
      <p className="editor-hint">
        Select a keyframe on the timeline to edit it, or pose a bone with the gizmo to key it at the playhead. Drag across the
        timeline to select several.
      </p>
    )
  }

  const many = anim.selectedKeys.length > 1
  const { track, key } = found
  const boneName = anim.bones.find((b) => b.id === track.bone)?.name ?? anim.nulls.find((n) => n.id === track.bone)?.name ?? track.bone
  const step = track.channel === 'rotation' ? 2.5 : track.channel === 'scale' ? 0.05 : 0.5

  if (many) {
    const interps = new Set(anim.clip!.tracks.flatMap((t) => t.keys.filter((k) => anim.selectedKeys.includes(k.id)).map((k) => k.interp)))
    return (
      <>
        <p className="editor-hint" style={{ marginBottom: 8 }}>
          {anim.selectedKeys.length} keyframes selected. Drag any of them on the timeline to move them together.
        </p>
        <label className="editor-field">
          <span>Easing</span>
          <select className="editor-select" value={interps.size === 1 ? [...interps][0] : ''} onChange={(e) => anim.setEasing(e.target.value as Key['interp'])}>
            {interps.size === 1 ? null : <option value="">Mixed</option>}
            {EASINGS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="chip-row" style={{ marginTop: 9 }}>
          <button className="chip" onClick={anim.copyKeys}>
            <Icon name="copy" size={11} /> Copy
          </button>
          <button className="chip chip--danger" onClick={anim.removeKeys}>
            <Icon name="trash" size={11} /> Delete {anim.selectedKeys.length}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="kf__bone">{boneName}</p>
      <p className="kf__sub">
        {track.channel[0].toUpperCase() + track.channel.slice(1)} at {key.time.toFixed(2)} s
      </p>

      <div className="kf__axes">
        {(['x', 'y', 'z'] as const).map((a, i) => (
          <NumField
            key={a}
            axis={a}
            name={`${track.channel} ${a.toUpperCase()}`}
            step={step}
            value={key.value[i]}
            onChange={(v) => {
              const value = [...key.value] as Vec3
              value[i] = v
              anim.patchKey(key.id, { value }, true)
            }}
            onCommit={() => anim.patchKey(key.id, {})}
          />
        ))}
      </div>

      <div className="studio-label">Into the next key</div>
      <div className="studio-seg kf__ease" role="group" aria-label="Easing to the next key">
        {EASE_ORDER.map((id) => (
          <button key={id} aria-pressed={key.interp === id} onClick={() => anim.patchKey(key.id, { interp: id })}>
            {EASE_SHORT[id]}
          </button>
        ))}
      </div>
      <EaseCurve track={track} keyId={key.id} />

      {key.interp === 'bezier' ? (
        <div className="num-field-grid" style={{ marginTop: 10 }}>
          <NumRow
            label="Out time"
            value={key.handles?.rightTime ?? [0.1, 0.1, 0.1]}
            step={0.01}
            onChange={(rightTime) => anim.patchKey(key.id, { handles: { ...bezierDefaults(key), rightTime } }, true)}
            onCommit={() => anim.patchKey(key.id, {})}
          />
          <NumRow
            label="Out value"
            value={key.handles?.rightValue ?? [0, 0, 0]}
            step={step}
            onChange={(rightValue) => anim.patchKey(key.id, { handles: { ...bezierDefaults(key), rightValue } }, true)}
            onCommit={() => anim.patchKey(key.id, {})}
          />
        </div>
      ) : null}

      <label className="clip-props__row" style={{ marginTop: 12 }}>
        <span>Time</span>
        <NumField axis="n" name="Keyframe time in seconds" step={0.05} value={key.time} onChange={(time) => anim.patchKey(key.id, { time })} />
        <span className="clip-props__unit">of {anim.clip?.length.toFixed(2)} s</span>
      </label>

      <div className="kf__actions">
        <button className="chip" onClick={anim.copyKeys} title="Copy this key (Ctrl+C); paste it at the playhead with Ctrl+V">
          Copy key
        </button>
        <button className="chip chip--danger" onClick={() => anim.removeKey(key.id)}>
          Delete key
        </button>
      </div>
      <button className="kf__clear" onClick={() => anim.removeTrack(track.bone, track.channel)}>
        Clear the whole {track.channel} channel
      </button>
    </>
  )
}

const EASE_ORDER: Key['interp'][] = ['catmullrom', 'linear', 'step', 'bezier']
const EASE_SHORT: Record<Key['interp'], string> = { catmullrom: 'Smooth', linear: 'Linear', step: 'Step', bezier: 'Bezier' }
const EASE_LINE: Record<Key['interp'], string> = {
  catmullrom: 'Eases out of this key and into the next.',
  linear: 'Keeps an even speed to the next key.',
  step: 'Holds this value, then jumps at the next key.',
  bezier: 'Follows its handles. Drag them in the Graph view.',
}

/**
 * The motion from a key to the next, drawn on the axis that changes most,
 * so the easing choice can be seen at a glance.
 */
function EaseCurve({ track, keyId }: { track: Track; keyId: string }) {
  const keys = [...track.keys].sort((a, b) => a.time - b.time)
  const i = keys.findIndex((k) => k.id === keyId)
  const key = keys[i]
  const next = keys[i + 1]
  const W = 220
  const H = 86
  if (!key) return null
  if (!next) {
    return (
      <div className="kf__curve">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <line className="kf__base" x1={10} y1={H / 2} x2={W - 10} y2={H / 2} />
          <rect className="kf__dot" x={6} y={H / 2 - 4} width={8} height={8} transform={`rotate(45 10 ${H / 2})`} />
        </svg>
        <p>The last key: the pose holds to the end of the clip.</p>
      </div>
    )
  }
  const axis = [0, 1, 2].reduce((best, a) => (Math.abs(next.value[a] - key.value[a]) > Math.abs(next.value[best] - key.value[best]) ? a : best), 0)
  const from = key.value[axis]
  const to = next.value[axis]
  const span = to - from || 1
  const pts: string[] = []
  for (let n = 0; n <= 40; n++) {
    const t = key.time + ((next.time - key.time) * n) / 40
    const v = (sampleTrack(track, t)[axis] - from) / span
    pts.push(`${(10 + (n / 40) * (W - 20)).toFixed(1)},${(H - 12 - Math.max(-0.3, Math.min(1.3, v)) * (H - 24)).toFixed(1)}`)
  }
  return (
    <div className="kf__curve">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <line className="kf__base" x1={10} y1={H - 12} x2={W - 10} y2={H - 12} />
        <polyline className="kf__line" points={pts.join(' ')} />
        <rect className="kf__dot" x={6} y={H - 16} width={8} height={8} transform={`rotate(45 10 ${H - 12})`} />
        <rect className="kf__dot" x={W - 14} y={8} width={8} height={8} transform={`rotate(45 ${W - 10} 12)`} />
      </svg>
      <p>{EASE_LINE[key.interp]}</p>
    </div>
  )
}

/** A key's handles, or flat ones a tenth of a second long, so editing one field gives a full set. */
const bezierDefaults = (key: Key) =>
  key.handles ?? {
    leftTime: [-0.1, -0.1, -0.1] as Vec3,
    leftValue: [0, 0, 0] as Vec3,
    rightTime: [0.1, 0.1, 0.1] as Vec3,
    rightValue: [0, 0, 0] as Vec3,
  }

/** A sound, particle or script on the timeline. */
function EventPanel({ anim }: { anim: AnimApi }) {
  const ev = anim.events.find((e) => e.id === anim.selectedEvent)
  if (!ev) return null
  const suggestions =
    ev.kind === 'sound'
      ? ['minecraft:entity.generic.hurt', 'minecraft:entity.zombie.ambient', 'minecraft:entity.player.attack.sweep', 'minecraft:block.anvil.land', 'minecraft:item.trident.throw']
      : ev.kind === 'particle'
        ? ['minecraft:flame', 'minecraft:smoke', 'minecraft:crit', 'minecraft:heart', 'minecraft:explosion']
        : []
  return (
    <>
      <label className="editor-field">
        <span>Kind</span>
        <select className="editor-select" value={ev.kind} onChange={(e) => anim.patchEvent(ev.id, { kind: e.target.value as ClipEvent['kind'] }, false)}>
          <option value="sound">Sound</option>
          <option value="particle">Particle</option>
          <option value="script">Script</option>
        </select>
      </label>
      <label className="editor-field">
        <span>{ev.kind === 'script' ? 'Script' : ev.kind === 'sound' ? 'Sound id' : 'Particle id'}</span>
        {ev.kind === 'script' ? (
          <textarea className="editor-input mono" rows={3} value={ev.effect} onChange={(e) => anim.patchEvent(ev.id, { effect: e.target.value })} />
        ) : (
          <>
            <input className="editor-input mono" list="effect-ids" value={ev.effect} onChange={(e) => anim.patchEvent(ev.id, { effect: e.target.value })} />
            <datalist id="effect-ids">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </>
        )}
      </label>
      {ev.kind !== 'script' ? (
        <label className="editor-field">
          <span>Plays at</span>
          <select className="editor-select" value={ev.locator ?? ''} onChange={(e) => anim.patchEvent(ev.id, { locator: e.target.value || undefined }, false)}>
            <option value="">The model</option>
            {anim.nulls.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="num-field-grid">
        <div className="num-field-row">
          <span className="num-field-row__label">Time</span>
          <NumField axis="n" name="Effect time in seconds" step={0.05} value={ev.time} onChange={(time) => anim.patchEvent(ev.id, { time })} />
          <span className="num-field-row__label" />
          <span className="num-field-row__label" />
        </div>
      </div>
      <div className="chip-row" style={{ marginTop: 9 }}>
        <button className="chip chip--danger" onClick={() => anim.removeEvent(ev.id)}>
          <Icon name="trash" size={11} /> Delete effect
        </button>
      </div>
    </>
  )
}

/* ================= timeline ================= */

// timeline zoom, in pixels per second
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
  const [view, setView] = useState<'dope' | 'graph'>('dope')
  // the panel's height, dragged from its top edge as in Blockbench
  const [height, setHeight] = useState(260)
  const resize = useRef<{ y: number; h: number } | null>(null)
  const main = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  /** a key or event drag in progress: where it began and what it moves */
  const drag = useRef<{ x: number; moved: boolean; kind: 'keys' | 'event'; id?: string; start?: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; add: boolean } | null>(null)

  const clampPx = (v: number) => Math.max(PX_MIN, Math.min(PX_MAX, v))

  /** Zoom so the whole clip fills the track area (178px is the names column). */
  const fit = useCallback(() => {
    const width = main.current?.clientWidth
    if (!width || !clip) return
    setPxPerS(clampPx((width - 178 - 24) / Math.max(clip.length, 0.05)))
  }, [clip])

  // a clip opens fitted to the panel, as in the design; zoom stays the user's after that
  const clipName = clip?.name
  useLayoutEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipName])

  /* Ctrl or Shift + wheel zooms. Attached by hand because React's wheel
     listener is passive and cannot call preventDefault. */
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

  // tick spacing follows the zoom: tenths, seconds, 5s or 10s
  const tickStep = pxPerS >= 220 ? 0.1 : pxPerS >= 60 ? 1 : pxPerS >= 24 ? 5 : 10
  const ticks = Math.max(1, Math.ceil(length / tickStep))
  const trackW = Math.max(ticks * tickStep * pxPerS, 1)

  const nameOf = useCallback(
    (id: string) => anim.bones.find((b) => b.id === id)?.name ?? anim.nulls.find((n) => n.id === id)?.name ?? id,
    [anim.bones, anim.nulls],
  )
  const picked = useMemo(() => new Set(anim.selectedKeys), [anim.selectedKeys])

  /* One row per bone and channel. The selected bone shows all three
     channels, since an empty row is where a channel gets its first key.
     Other bones show only channels that have a track. */
  const rows = useMemo<Row[]>(() => {
    if (!clip) return []
    const out: Row[] = []
    const seen = new Set<string>()
    if (anim.bone) {
      const isNull = anim.nulls.some((n) => n.id === anim.bone)
      for (const channel of isNull ? (['position'] as Channel[]) : CHANNELS) {
        const key = `${anim.bone}:${channel}`
        seen.add(key)
        out.push({ key, bone: anim.bone, boneName: nameOf(anim.bone), channel, track: findTrack(clip, anim.bone, channel) })
      }
    }
    for (const track of clip.tracks) {
      const key = `${track.bone}:${track.channel}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ key, bone: track.bone, boneName: nameOf(track.bone), channel: track.channel, track })
    }
    return out
  }, [clip, anim.bone, anim.nulls, nameOf])

  /* Playback keeps the playhead in a ref so `time` stays out of the loop's
     deps. Restarting the loop each frame would reset `last` and lose time. */
  const timeRef = useRef(time)
  useEffect(() => {
    timeRef.current = time
  }, [time])

  /** ping-pong plays forward, then back: -1 while it runs backwards */
  const direction = useRef(1)

  useEffect(() => {
    if (!playing || !clip) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (clip.loop === 'pingpong' && clip.length > 0) {
        let next = timeRef.current + dt * direction.current
        if (next > clip.length) {
          next = 2 * clip.length - next
          direction.current = -1
        } else if (next < 0) {
          next = -next
          direction.current = 1
        }
        next = Math.max(0, Math.min(clip.length, next))
        timeRef.current = next
        onTime(next)
        raf = requestAnimationFrame(tick)
        return
      }
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
      // hold stops on the last frame; once goes back to time 0
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

  /* Keys: a click selects one, Ctrl toggles, Shift adds, and a drag moves
     every selected key together, as one undo step. */
  const onKeyDown = (e: React.PointerEvent, kf: Key, bone: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl) anim.selectKeys([kf.id], 'toggle')
    else if (e.shiftKey) anim.selectKeys([kf.id], 'add')
    else if (!picked.has(kf.id)) anim.selectKeys([kf.id], 'set')
    anim.setBone(bone)
    onPlaying(false)
    if (ctrl) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, moved: false, kind: 'keys' }
    onTime(Math.min(kf.time, length))
  }
  const onKeyMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.kind !== 'keys' || e.buttons !== 1) return
    const dt = (e.clientX - d.x) / pxPerS
    if (!d.moved && Math.abs(e.clientX - d.x) < 3) return
    if (!d.moved) {
      d.moved = true
      anim.moveKeys(0, 'start')
    }
    anim.moveKeys(dt, 'move')
  }
  const onKeyUp = () => {
    const d = drag.current
    if (d?.kind === 'keys' && d.moved) anim.moveKeys(0, 'end')
    drag.current = null
  }

  /* An empty stretch of track: drag draws a box that selects the keys inside it. */
  const boxStart = (e: React.PointerEvent) => {
    if (e.button !== 0 || !grid.current) return
    const r = grid.current.getBoundingClientRect()
    setMarquee({ x0: e.clientX - r.left, y0: e.clientY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top, add: e.shiftKey || e.ctrlKey || e.metaKey })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const boxMove = (e: React.PointerEvent) => {
    if (!marquee || !grid.current) return
    const r = grid.current.getBoundingClientRect()
    setMarquee({ ...marquee, x1: e.clientX - r.left, y1: e.clientY - r.top })
  }
  const boxEnd = (e: React.PointerEvent) => {
    if (!marquee || !grid.current) return
    const r = grid.current.getBoundingClientRect()
    const [lx, hx] = [Math.min(marquee.x0, marquee.x1), Math.max(marquee.x0, marquee.x1)]
    const [ly, hy] = [Math.min(marquee.y0, marquee.y1), Math.max(marquee.y0, marquee.y1)]
    const moved = hx - lx > 3 || hy - ly > 3
    const ids: string[] = []
    if (moved) {
      grid.current.querySelectorAll<HTMLElement>('.timeline-key[data-key]').forEach((el) => {
        const b = el.getBoundingClientRect()
        const cx = b.left + b.width / 2 - r.left
        const cy = b.top + b.height / 2 - r.top
        if (cx >= lx && cx <= hx && cy >= ly && cy <= hy) ids.push(el.dataset.key!)
      })
      anim.selectKeys(ids, marquee.add ? 'add' : 'set')
    } else if (!marquee.add) {
      // a click on empty track moves the playhead there and clears the selection
      anim.selectKeys([], 'set')
      const track = (e.target as HTMLElement).closest('.timeline-track')
      if (track) onTime(Math.max(0, Math.min(length, (e.clientX - track.getBoundingClientRect().left) / pxPerS)))
    }
    setMarquee(null)
  }

  const EVENT_GLYPH: Record<ClipEvent['kind'], string> = { sound: '♪', particle: '✦', script: '{}' }

  return (
    <div className="editor-timeline" style={{ height }}>
      <div
        className="timeline-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the timeline"
        title="Drag to resize the timeline"
        onPointerDown={(e) => {
          resize.current = { y: e.clientY, h: height }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const r = resize.current
          if (r) setHeight(Math.max(150, Math.min(Math.round(window.innerHeight * 0.65), r.h - (e.clientY - r.y))))
        }}
        onPointerUp={() => {
          resize.current = null
        }}
      />
      <div className="timeline-bar">
        <button className="editor-tool" title="Jump to start" onClick={() => onTime(0)}>
          <Icon name="skipBack" size={14} />
        </button>
        <button
          className="editor-tool"
          aria-pressed={playing}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          onClick={() => onPlaying(!playing)}
          disabled={!clip}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} filled={!playing} />
        </button>
        <button className="editor-tool" title="Jump to end" onClick={() => onTime(length)}>
          <Icon name="skipFwd" size={14} />
        </button>
        <span className="timeline-time">{time.toFixed(2)}s</span>
        <span className="editor-separator" />

        <select
          className="editor-select"
          value={clip?.id ?? ''}
          onChange={(e) => anim.selectClip(e.target.value)}
          aria-label="Animation"
          disabled={!anim.clips.length}
        >
          {anim.clips.length ? null : <option value="">No animations</option>}
          {anim.clips.map((c) => (
            <option key={c.id} value={c.id}>
              {clipLabel(c.name)} · {c.length}s
            </option>
          ))}
        </select>
        <button className="editor-tool" title="New animation" aria-label="New animation" onClick={anim.newClip}>
          <Icon name="plus" size={14} />
        </button>
        <button
          className="chip"
          title="How this animation ends"
          disabled={!clip}
          onClick={() => clip && anim.patchClip({ loop: LOOPS[(LOOPS.indexOf(clip.loop) + 1) % LOOPS.length] })}
        >
          <Icon name="refresh" size={11} /> {clip?.loop === 'pingpong' ? 'ping-pong' : (clip?.loop ?? 'once')}
        </button>
        <span className="editor-separator" />
        <div className="seg" role="group" aria-label="Timeline view">
          <button className="chip" aria-pressed={view === 'dope'} onClick={() => setView('dope')} title="Dope sheet: keys on rows">
            Dope sheet
          </button>
          <button className="chip" aria-pressed={view === 'graph'} onClick={() => setView('graph')} title="Graph editor: curves and handles">
            Graph
          </button>
        </div>
        <button
          className="chip"
          aria-pressed={anim.onion}
          onClick={() => anim.setOnion(!anim.onion)}
          title="Onion skin: show the pose at the previous and next keyframes"
        >
          Onion skin
        </button>
        <button
          className="chip"
          aria-pressed={anim.cues}
          onClick={() => anim.setCues(!anim.cues)}
          title="Play a short tone at each sound key during playback. The sounds themselves play in the game, which Vellum has no files for."
        >
          Sound cues
        </button>

        <div className="editor-toolbar__right">
          <div className="editor-tools" role="group" aria-label="Timeline zoom">
            <button className="editor-tool" title="Zoom the timeline out" aria-label="Zoom timeline out" onClick={() => setPxPerS((v) => clampPx(v / 1.5))}>
              <Icon name="minus" size={14} />
            </button>
            <button className="editor-tool" title="Fit the clip to the panel" aria-label="Fit timeline" onClick={fit}>
              <Icon name="resize" size={14} />
            </button>
            <button className="editor-tool" title="Zoom the timeline in" aria-label="Zoom timeline in" onClick={() => setPxPerS((v) => clampPx(v * 1.5))}>
              <Icon name="plus" size={14} />
            </button>
          </div>
          <span className="editor-separator" />
          <button
            className="editor-tool"
            title="Add a keyframe to the animated bone's rotation at the playhead (K)"
            aria-label="Add keyframe"
            disabled={!clip || !anim.bone}
            onClick={() => anim.bone && anim.addKey(anim.bone, anim.nulls.some((n) => n.id === anim.bone) ? 'position' : 'rotation')}
          >
            <Icon name="key" size={14} />
          </button>
          <button
            className="editor-tool"
            title="Delete the selected keyframes (Del)"
            aria-label="Delete keyframes"
            disabled={!anim.selectedKeys.length}
            onClick={anim.removeKeys}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      {clip && view === 'graph' ? (
        <GraphEditor anim={anim} time={time} onTime={onTime} pxPerS={pxPerS} trackW={trackW} ticks={ticks} tickStep={tickStep} />
      ) : clip ? (
        /* names and tracks share one scroller so their rows stay aligned;
           the names column is sticky */
        <div className="timeline-main" ref={main}>
          <div
            className="timeline-grid"
            ref={grid}
            style={{ ['--track-w' as string]: `${trackW}px`, ['--px-per-s' as string]: `${pxPerS}px` }}
            onPointerMove={boxMove}
            onPointerUp={boxEnd}
          >
            <div className="timeline-corner">Channels</div>
            <div className="timeline-ruler" style={{ width: trackW }} onPointerDown={scrub} onPointerMove={scrub}>
              {Array.from({ length: ticks }, (_, i) => (
                <span className="timeline-tick" key={i} style={{ width: tickStep * pxPerS }}>
                  {Number((i * tickStep).toFixed(2))}s
                </span>
              ))}
              <span className="timeline-end" style={{ left: length * pxPerS }} title={`Clip ends at ${length}s`} />
            </div>

            {/* Effects: sounds, particles and scripts, Blockbench's effect keyframes */}
            <div className="timeline-name timeline-name--effects">
              <Icon name="bell" size={11} />
              <span className="timeline-name__bone">Effects</span>
              {(['sound', 'particle', 'script'] as const).map((k) => (
                <button
                  key={k}
                  className="timeline-name__button"
                  title={`Add a ${k} effect at the playhead`}
                  aria-label={`Add a ${k} effect`}
                  onClick={() => anim.addEvent(k)}
                >
                  {EVENT_GLYPH[k]}
                </button>
              ))}
            </div>
            <div className="timeline-track timeline-track--effects" style={{ width: trackW }} onPointerDown={boxStart}>
              {anim.events.map((ev) => (
                <button
                  key={ev.id}
                  className="timeline-event"
                  data-kind={ev.kind}
                  data-selected={ev.id === anim.selectedEvent || undefined}
                  style={{ left: ev.time * pxPerS }}
                  title={`${ev.kind} @ ${ev.time.toFixed(2)}s: ${ev.effect || '(no effect yet)'}`}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (e.button !== 0) return
                    anim.selectEvent(ev.id)
                    onTime(Math.min(ev.time, length))
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                    drag.current = { x: e.clientX, moved: false, kind: 'event', id: ev.id, start: ev.time }
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current
                    if (!d || d.kind !== 'event' || d.id !== ev.id || e.buttons !== 1) return
                    if (!d.moved && Math.abs(e.clientX - d.x) < 3) return
                    d.moved = true
                    anim.patchEvent(ev.id, { time: d.start! + (e.clientX - d.x) / pxPerS }, true)
                  }}
                  onPointerUp={() => {
                    drag.current = null
                  }}
                >
                  {EVENT_GLYPH[ev.kind]}
                </button>
              ))}
            </div>

            {rows.map((r) => (
              <Fragment key={r.key}>
                <div className="timeline-name" data-on={r.bone === anim.bone || undefined}>
                  <Icon name={anim.nulls.some((n) => n.id === r.bone) ? 'pivot' : 'folder'} size={11} />
                  <button className="timeline-name__bone" aria-pressed={r.bone === anim.bone} onClick={() => anim.setBone(r.bone)}>
                    {r.boneName}
                  </button>
                  <span className="timeline-name__channel">{r.channel.slice(0, 3)}</span>
                  <button
                    className="timeline-name__button"
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
                  className="timeline-track"
                  style={{ width: trackW }}
                  onPointerDown={boxStart}
                  onDoubleClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onTime(Math.max(0, Math.min(length, (e.clientX - rect.left) / pxPerS)))
                    anim.addKey(r.bone, r.channel)
                  }}
                >
                  {(r.track?.keys ?? []).map((kf) => (
                    <button
                      key={kf.id}
                      className="timeline-key"
                      data-key={kf.id}
                      data-interp={kf.interp}
                      data-selected={picked.has(kf.id) || undefined}
                      data-past-end={kf.time > length + 1e-9 || undefined}
                      style={{ left: kf.time * pxPerS }}
                      title={`${r.boneName} · ${r.channel} @ ${kf.time.toFixed(2)}s → ${kf.value.join(', ')} (${kf.interp})`}
                      onPointerDown={(e) => onKeyDown(e, kf, r.bone)}
                      onPointerMove={onKeyMove}
                      onPointerUp={onKeyUp}
                    />
                  ))}
                </div>
              </Fragment>
            ))}

            {rows.length ? null : (
              <>
                <div className="timeline-name">Pick a bone to animate</div>
                <div className="timeline-track" style={{ width: trackW }} />
              </>
            )}

            <span className="timeline-playhead" style={{ left: `calc(var(--names-w) + ${time * pxPerS}px)` }} />
            {marquee ? (
              <span
                className="timeline-marquee"
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="timeline-empty">
          <p>No animation yet. It&rsquo;s a statue for now.</p>
          <button className="chip chip--go" onClick={anim.newClip}>
            <Icon name="plus" size={11} /> New animation
          </button>
        </div>
      )}
    </div>
  )
}

/* ================= graph editor ================= */

const AXIS_COLOURS = ['#ff3b4e', '#7ad21c', '#2f8dff']

/**
 * Blockbench's graph editor: the picked bone's channel drawn as one curve per
 * axis. Drag a key up and down to change its value and sideways to retime it;
 * a bezier key shows its handles, which drag too. Each drag is one undo step.
 */
function GraphEditor({
  anim,
  time,
  onTime,
  pxPerS,
  trackW,
  ticks,
  tickStep,
}: {
  anim: AnimApi
  time: number
  onTime: (t: number) => void
  pxPerS: number
  trackW: number
  ticks: number
  tickStep: number
}) {
  const clip = anim.clip!
  const isNull = anim.nulls.some((n) => n.id === anim.bone)
  const [channel, setChannel] = useState<Channel>(isNull ? 'position' : 'rotation')
  const [axes, setAxes] = useState([true, true, true])
  const track = anim.bone ? findTrack(clip, anim.bone, isNull ? 'position' : channel) : null
  const picked = new Set(anim.selectedKeys)
  const drag = useRef<{ kind: 'key' | 'left' | 'right'; id: string; axis: number; x: number; y: number; t0: number; v0: number; scale: number } | null>(null)

  // the plot fills whatever height the timeline panel has
  const scroller = useRef<HTMLDivElement>(null)
  const [GRAPH_H, setGraphH] = useState(160)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setGraphH(Math.max(90, el.clientHeight - 30)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // the value range on screen, padded, and never flatter than one unit
  const keys = track ? [...track.keys].sort((a, b) => a.time - b.time) : []
  const samples = useMemo(() => {
    if (!track) return [] as Vec3[]
    const n = Math.max(2, Math.ceil(clip.length * pxPerS / 3))
    return Array.from({ length: n + 1 }, (_, i) => sampleTrack(track, (i / n) * clip.length))
  }, [track, clip.length, pxPerS])
  const all = [...samples.flatMap((v) => v.filter((_, i) => axes[i])), ...keys.flatMap((k) => k.value.filter((_, i) => axes[i]))]
  let lo = all.length ? Math.min(...all) : -1
  let hi = all.length ? Math.max(...all) : 1
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2
    lo = mid - 0.5
    hi = mid + 0.5
  }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const yOf = (v: number) => GRAPH_H - ((v - lo) / (hi - lo)) * GRAPH_H
  const unitsPerPx = (hi - lo) / GRAPH_H

  const handleOf = (k: Key, side: 'left' | 'right', axis: number): [number, number] => {
    const i = keys.indexOf(k)
    const span = side === 'right' ? (keys[i + 1]?.time ?? k.time + 0.3) - k.time : k.time - (keys[i - 1]?.time ?? k.time - 0.3)
    const h = k.handles
    const dt = side === 'right' ? (h?.rightTime[axis] ?? span / 3) : (h?.leftTime[axis] ?? -span / 3)
    const dv = side === 'right' ? (h?.rightValue[axis] ?? 0) : (h?.leftValue[axis] ?? 0)
    return [k.time + dt, k.value[axis] + dv]
  }

  const begin = (kind: 'key' | 'left' | 'right', k: Key, axis: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    anim.selectKeys([k.id], e.shiftKey ? 'add' : 'set')
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const [t0, v0] = kind === 'key' ? [k.time, k.value[axis]] : handleOf(k, kind, axis)
    drag.current = { kind, id: k.id, axis, x: e.clientX, y: e.clientY, t0, v0, scale: unitsPerPx }
    anim.burst.begin(kind === 'key' ? 'move keyframe' : 'bezier handle')
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !track) return
    const dt = (e.clientX - d.x) / pxPerS
    const dv = -(e.clientY - d.y) * d.scale
    anim.burst.amend((m) => {
      const c = m.clips.find((x) => x.id === clip.id)
      const k = c?.tracks.flatMap((t) => t.keys).find((x) => x.id === d.id)
      if (!c || !k) return m
      if (d.kind === 'key') {
        const value: Vec3 = [...k.value]
        value[d.axis] = Math.round((d.v0 + dv) * 1000) / 1000
        // Shift keeps the time; otherwise the key follows the pointer sideways too
        return updateKey(m, c.id, k.id, e.shiftKey ? { value } : { value, time: d.t0 + dt })
      }
      const span = 0.3
      const h = k.handles ?? { leftTime: [-span / 3, -span / 3, -span / 3] as Vec3, leftValue: [0, 0, 0] as Vec3, rightTime: [span / 3, span / 3, span / 3] as Vec3, rightValue: [0, 0, 0] as Vec3 }
      const next = { leftTime: [...h.leftTime] as Vec3, leftValue: [...h.leftValue] as Vec3, rightTime: [...h.rightTime] as Vec3, rightValue: [...h.rightValue] as Vec3 }
      const t = d.t0 + dt - k.time
      const v = d.v0 + dv - k.value[d.axis]
      if (d.kind === 'right') {
        next.rightTime[d.axis] = Math.max(0.001, t)
        next.rightValue[d.axis] = v
      } else {
        next.leftTime[d.axis] = Math.min(-0.001, t)
        next.leftValue[d.axis] = v
      }
      return updateKey(m, c.id, k.id, { handles: next, interp: 'bezier' })
    })
  }
  const end = () => {
    if (drag.current) anim.burst.end()
    drag.current = null
  }

  if (!anim.bone) return <div className="timeline-empty"><p>Pick a bone to see its curves.</p></div>

  return (
    <div className="graph">
      <div className="graph__side">
        <div className="graph__title">{anim.bones.find((b) => b.id === anim.bone)?.name ?? anim.nulls.find((n) => n.id === anim.bone)?.name}</div>
        {(isNull ? (['position'] as Channel[]) : CHANNELS).map((c) => (
          <button key={c} className="chip" aria-pressed={(isNull ? 'position' : channel) === c} onClick={() => setChannel(c)}>
            {c}
          </button>
        ))}
        <div className="graph__axes">
          {['X', 'Y', 'Z'].map((a, i) => (
            <button
              key={a}
              className="chip"
              aria-pressed={axes[i]}
              style={{ color: AXIS_COLOURS[i] }}
              onClick={() => setAxes((v) => v.map((on, j) => (j === i ? !on : on)))}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="editor-hint">Drag a key to change it. Shift keeps its time. Drag a handle to shape a bezier.</p>
      </div>
      <div className="graph__scroll" ref={scroller}>
        <div className="timeline-ruler" style={{ width: trackW }} onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onTime(Math.max(0, Math.min(clip.length, (e.clientX - r.left) / pxPerS)))
        }}>
          {Array.from({ length: ticks }, (_, i) => (
            <span className="timeline-tick" key={i} style={{ width: tickStep * pxPerS }}>
              {Number((i * tickStep).toFixed(2))}s
            </span>
          ))}
        </div>
        <svg className="graph__plot" width={trackW} height={GRAPH_H} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <line className="graph__zero" x1={0} x2={trackW} y1={yOf(0)} y2={yOf(0)} />
          <line className="graph__playhead" x1={time * pxPerS} x2={time * pxPerS} y1={0} y2={GRAPH_H} />
          {[0, 1, 2].map((i) =>
            axes[i] && samples.length ? (
              <polyline
                key={`c${i}`}
                className="graph__curve"
                style={{ stroke: AXIS_COLOURS[i] }}
                points={samples.map((v, j) => `${((j / (samples.length - 1)) * clip.length * pxPerS).toFixed(1)},${yOf(v[i]).toFixed(1)}`).join(' ')}
              />
            ) : null,
          )}
          {keys.flatMap((k) =>
            [0, 1, 2].flatMap((i) => {
              if (!axes[i]) return []
              const x = k.time * pxPerS
              const y = yOf(k.value[i])
              const out = []
              if (k.interp === 'bezier' && picked.has(k.id)) {
                for (const side of ['left', 'right'] as const) {
                  const [ht, hv] = handleOf(k, side, i)
                  out.push(
                    <g key={`${k.id}${i}${side}`}>
                      <line className="graph__arm" x1={x} y1={y} x2={ht * pxPerS} y2={yOf(hv)} />
                      <circle className="graph__handle" cx={ht * pxPerS} cy={yOf(hv)} r={4} style={{ stroke: AXIS_COLOURS[i] }} onPointerDown={begin(side, k, i)} />
                    </g>,
                  )
                }
              }
              out.push(
                <rect
                  key={`${k.id}${i}`}
                  className="graph__key"
                  data-selected={picked.has(k.id) || undefined}
                  x={x - 4.5}
                  y={y - 4.5}
                  width={9}
                  height={9}
                  transform={`rotate(45 ${x} ${y})`}
                  style={{ fill: AXIS_COLOURS[i] }}
                  onPointerDown={begin('key', k, i)}
                >
                  <title>{`${'XYZ'[i]} ${k.value[i]} @ ${k.time.toFixed(2)}s (${k.interp})`}</title>
                </rect>,
              )
              return out
            }),
          )}
        </svg>
        <div className="graph__range" style={{ height: GRAPH_H - 8 }}>
          <span>{hi.toFixed(1)}</span>
          <span>{lo.toFixed(1)}</span>
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
      className="editor-split"
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
/** Whether a point is inside a polygon, by counting edge crossings. */
function insidePolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** `base`, or `base_2`, `base_3` and so on: a name no cube, bone or mesh has yet. */
function freeName(model: Model, base: string): string {
  const stem = base.replace(/_\d+$/, '')
  const taken = new Set<string>([...model.cubes.map((c) => c.name), ...(model.meshes ?? []).map((m) => m.name)])
  const walk = (bs: Bone[]) => bs.forEach((b) => (taken.add(b.name), walk(b.children.filter((c) => c.kind === 'bone').map((c) => (c as { bone: Bone }).bone))))
  walk(model.bones)
  if (!taken.has(stem)) return stem
  let i = 2
  while (taken.has(`${stem}_${i}`)) i++
  return `${stem}_${i}`
}

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
 * `#/editor/<sample>` opens a bundled sample. `#/editor/new/<kind>/<subtype>/<name>`
 * creates a model, described in the URL so a reload creates it again.
 */
function startFrom(segments: string[]): { model: Model; file: string; kind: ProjectKind } {
  if (segments[1] === 'new') {
    const kind: ProjectKind =
      segments[2] === 'mobs' || segments[2] === 'blocks' ? segments[2] : 'items'
    const sub = subtypeFits(kind, segments[3]) ? segments[3] : defaultSubtype(kind)
    // the URL can be typed by hand, so clean the name as NewModelDialog does
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
  /** what Save writes: a .bbmodel that was opened saves back as one */
  const [saveFormat, setSaveFormat] = useState<SaveFormat>(/\.bbmodel$/i.test(initial.file) ? 'bbmodel' : 'vellum')
  const [kind, setKind] = useState<ProjectKind>(initial.kind)
  // read from the model so undo and file loads keep it current
  const subtype = model.subtype
  const [mode, setMode] = useState<Mode>('edit')
  const [tool, setTool] = useState('move')
  const [grid, setGrid] = useState(true)
  const [quad, setQuad] = useState(false)
  /* The selection, in pick order; the last id is the primary one that the
     panels and the gizmo follow, as in Blockbench. */
  const [selection, setSelection] = useState<string[]>(initial.model.cubes[0] ? [initial.model.cubes[0].id] : [])
  const selected = selection[selection.length - 1] ?? null
  const setSelected = useCallback((id: string | null) => setSelection(id ? [id] : []), [])
  const [space, setSpace] = useState<'global' | 'local'>('global')
  const [increment, setIncrement] = useState(1)
  // number fields round to whole units while the grid snap is a whole unit or more
  const snap = increment >= 1
  const [ortho, setOrtho] = useState(false)
  const [renameRequest, setRenameRequest] = useState<{ id: string; n: number } | null>(null)
  /** vertex snap: the corner of the selection picked first */
  const [vertexFrom, setVertexFrom] = useState<number | null>(null)
  const viewApi = useRef<ViewApi>(null)
  const [viewPreset, setViewPreset] = useState<ViewPreset>('Perspective')
  /** bumped by the problems pill, which opens Validation */
  const [showProblems, setShowProblems] = useState(0)

  // the Studio design's typeface; without it the app's own sans-serif stands in
  useEffect(() => {
    if (document.getElementById('font-archivo')) return
    const link = document.createElement('link')
    link.id = 'font-archivo'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap'
    document.head.appendChild(link)
  }, [])
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
  /* keyframes in pick order; the Keyframe panel edits the last */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const selectedKey = selectedKeys[selectedKeys.length - 1] ?? null
  const setSelectedKey = useCallback((id: string | null) => setSelectedKeys(id ? [id] : []), [])
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [onion, setOnion] = useState(false)
  const [meshMenu, setMeshMenu] = useState(false)
  const [cues, setCues] = useState(true)
  const audio = useRef<AudioContext | null>(null)

  // paint
  const [colour, setColour] = useState(PAINTS[1][1])
  const [brush, setBrush] = useState(1)
  // Paint mode paints on the large sheet by default, as the design has it, or on the model
  const [paintView, setPaintView] = useState<'sheet' | 'model'>('sheet')
  const [keepInside, setKeepInside] = useState(true)
  /** brush strength, 0.1 to 1; below 1 a stroke is laid over the texture */
  const [opacity, setOpacity] = useState(1)
  /** Blockbench's mirror painting: a stroke on one side lands on the cube mirrored across X too */
  const [mirrorPaint, setMirrorPaint] = useState(false)
  const mirrorTexel = useRef<[number, number] | null>(null)
  const strokeTouched = useRef<Set<number>>(new Set())
  /** the texture picked on the sheet's bar; null follows the selected face */
  const [paintPick, setPaintPick] = useState<string | null>(null)
  /** where a sheet stroke may write, in pixels: the face it started on */
  const strokeClip = useRef<UVRect | null>(null)
  /** the status bar's texel readout, set without re-rendering the editor */
  const hoverSink = useRef<((text: string | null) => void) | null>(null)
  const [shape, setShape] = useState<ShapeKind>('rect')
  const [shapeFilled, setShapeFilled] = useState(false)
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
  /** a line in the status bar that clears itself */
  const notify = useCallback((note: string, ms = 6000) => {
    setSaveNote(note)
    window.setTimeout(() => setSaveNote((n) => (n === note ? null : n)), ms)
  }, [])

  /* Dirty compares the current model with the last one saved or opened,
     by identity. Every edit makes a new Model object. */
  const [savedModel, setSavedModel] = useState<Model>(initial.model)
  const dirty = model !== savedModel
  /** the WorldScene overlay, which shows the model at real size */
  const [worldOpen, setWorldOpen] = useState(false)

  // behaviour preview clock, separate from the animation playhead
  const [bhvTime, setBhvTime] = useState(0)
  const [bhvPlaying, setBhvPlaying] = useState(false)
  useTitle(`${dirty ? '\u2022 ' : ''}${fileName}`)

  /** A destructive action waiting for confirmation. */
  const [pending, setPending] = useState<{
    title: string
    body: string
    confirmLabel: string
    run: () => void
  } | null>(null)

  /** Lets one navigation through after the user chose to discard. */
  const allowNav = useRef(false)

  /* The selection for each model in the history, so undo and redo can
     restore it. A WeakMap lets discarded models be collected. */
  const selectionAt = useRef(new WeakMap<Model, string[]>())

  const loadModel = useCallback(
    (next: Model, name: string, nextKind: ProjectKind = 'items') => {
      // the file's own kind wins over `nextKind`
      const resolved = next.kind ?? nextKind
      history.reset(next)
      setSavedModel(next)
      setFileName(vellumFileName(name))
      setSaveFormat(/\.bbmodel$/i.test(name) ? 'bbmodel' : 'vellum')
      setKind(resolved)
      setSelected(next.cubes[0]?.id ?? null)
      setClipId(next.clips[0]?.id ?? null)
      setPickedBone(null)
      setSelectedKey(null)
      setCollapsed(new Set())
      setTime(0)
      setPlaying(false)
      setMode('edit')
      // the display transforms belonged to the previous model
      setDisplayState(DEFAULT_DISPLAY)
      setSlot('thirdperson_righthand')
    },
    [history, setSelected],
  )

  /* Order matters. The recording effect runs first, so on the render after
     an undo or redo it would store the stale selection against the
     restored model before the restore effect reads it. It skips that render. */
  const lastTravel = useRef(0)

  useEffect(() => {
    if (history.travel !== lastTravel.current) return
    selectionAt.current.set(model, selection)
  }, [model, selection, history.travel])

  useEffect(() => {
    if (history.travel === lastTravel.current) return
    lastTravel.current = history.travel
    const was = selectionAt.current.get(history.present)
    if (was !== undefined) setSelection(was)
  }, [history.travel, history.present])

  /* Keep the active tool valid for the mode. Modes with no tools
     (behaviour, config) leave it as it was. */
  useEffect(() => {
    const set = toolsets[mode]
    if (set.length && !set.some((t) => t.id === tool)) setTool(set[0].id)
  }, [mode, tool])

  // leaving Animate mode stops playback
  useEffect(() => {
    if (mode !== 'animate') setPlaying(false)
  }, [mode])

  /* Painting draws on a cached canvas per texture and re-encodes it into
     the model. `encoded` holds the source each canvas last produced. A
     texture changed any other way (undo, redo, open) won't match, so it
     is decoded again before the next stroke can write a stale canvas over it. */
  const encoded = useRef(new Map<string, string>())
  const decoding = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false

    // drop cached canvases for textures removed from the model
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
          /* an undecodable texture gets no canvas and can't be painted */
        } finally {
          decoding.current.delete(t.id)
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [model.textures])

  /** Re-encodes a painted canvas into the model. commitTexture batches calls to one per frame. */
  const writeTexture = useCallback(
    (id: string) => {
      const surface = surfaces.current.get(id)
      if (!surface) return
      const source = toDataUrl(surface)
      // set before the write so the effect above sees a match and skips decoding it again
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

  /* Called when the UV sheet grows. Scales the cached canvas with
     nearest-neighbour sampling, which keeps pixel art exact and is synchronous. */
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

  /** Writes a stroke's pending frame before its undo step is closed. */
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
    () => (hasConfig(kind) ? withDefaults(kind, model.config) : {}),
    [kind, model.config],
  )
  const bhvNow = useMemo(() => stageAt(behaviour, bhvTime), [behaviour, bhvTime])

  // a stage's clip loops for as long as the stage lasts
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
    (next: Config) => history.commit('config', (m) => ({ ...m, config: next })),
    [history],
  )
  const bones = useMemo(() => boneList(model.bones), [model.bones])
  const animBone = useMemo(() => {
    if (pickedBone && bones.some((b) => b.id === pickedBone)) return pickedBone
    return ownerBone(model.bones, selected) ?? bones[0]?.id ?? null
  }, [pickedBone, bones, model.bones, selected])

  const issues = useMemo(() => validateModel(model, kind), [model, kind])
  // what a resource pack can't express; validateModel checks the model itself
  const translate = useMemo(() => checkTranslation(model, kind), [model, kind])
  // hit regions exist only on mobs
  const hit = useMemo(() => (kind === 'mobs' ? hitReport(model) : null), [model, kind])
  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.length - errors
  const cube = model.cubes.find((c) => c.id === selected) ?? null
  const selectedBone = selected ? boneById(model, selected) : null

  /* Picking follows Blockbench: a click selects one node, Ctrl-click
     toggles one, Shift-click adds (a range, in the outliner). Selecting a
     bone also picks it for Animate mode. */
  const selectNode = useCallback(
    (id: string, mods: PickMods = { shift: false, ctrl: false }, range?: string[]) => {
      setSelection((cur) => {
        if (mods.ctrl) return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
        if (mods.shift) {
          const extra = range ?? [id]
          return [...cur.filter((x) => !extra.includes(x)), ...extra.filter((x) => x !== id), id]
        }
        return [id]
      })
      // a cube picked in Animate poses the bone that holds it, as in Blockbench
      if (bones.some((b) => b.id === id)) setPickedBone(id)
      else if (mode === 'animate') {
        const owner = ownerBone(model.bones, id)
        if (owner) setPickedBone(owner)
      }
      setVertexFrom(null)
    },
    [bones, mode, model.bones],
  )

  /* ---------------- gizmo ---------------- */

  /* In Animate mode the gizmo works on the pose the viewport shows, IK
     included; in every other mode on the rest pose. */
  const pose = useMemo(() => (mode === 'animate' ? posedAt(model, clip, time) : {}), [mode, model, clip, time])
  const rig = useMemo(() => buildRig(model, pose), [model, pose])
  const selectedNull = useMemo(() => (model.nulls ?? []).find((n) => n.id === selected) ?? null, [model.nulls, selected])

  /* ---------------- mesh editing ---------------- */

  /* A selected mesh is edited as a whole (Object), or by its faces or its
     vertices, as Blockbench's selection modes do. 1, 2 and 3 switch. */
  const selectedMesh = useMemo(() => (model.meshes ?? []).find((m) => m.id === selected) ?? null, [model.meshes, selected])
  const [meshMode, setMeshMode] = useState<MeshMode>('object')
  const [meshFaces, setMeshFaces] = useState<string[]>([])
  const [meshVerts, setMeshVerts] = useState<string[]>([])
  const [meshEdges, setMeshEdges] = useState<string[]>([])
  /** the knife's points so far, while it is cutting; null when it isn't */
  const [knife, setKnife] = useState<KnifePoint[] | null>(null)
  /** how far bevel and inset go, in units */
  const [meshAmount, setMeshAmount] = useState(1)
  /** how many faces across a bevel's strip */
  const [meshSegments, setMeshSegments] = useState(1)
  /** how close two vertices must be for merge by distance */
  const [mergeDistance, setMergeDistance] = useState(0.1)
  const meshId = selectedMesh?.id
  useEffect(() => {
    setMeshFaces([])
    setMeshVerts([])
    setMeshEdges([])
    setKnife(null)
  }, [meshId])
  // the knife ends with its mode
  useEffect(() => {
    if (meshMode === 'object' || mode !== 'edit') setKnife(null)
  }, [meshMode, mode])
  /** the edges of the selected mesh that still exist */
  const meshEdgeList = useMemo(() => (selectedMesh ? edgesOf(selectedMesh) : []), [selectedMesh])
  const meshPicked = meshMode === 'face' ? meshFaces.length : meshMode === 'vertex' ? meshVerts.length : meshMode === 'edge' ? meshEdges.length : 0
  /** the vertices the gizmo moves: the picked faces' or the picked vertices */
  const meshKeys = useMemo(() => {
    if (!selectedMesh || meshMode === 'object') return []
    if (meshMode === 'face') return verticesOf(selectedMesh, meshFaces.filter((k) => selectedMesh.faces[k]))
    if (meshMode === 'edge') return edgeVerticesOf(meshEdges).filter((k) => selectedMesh.vertices[k])
    return meshVerts.filter((k) => selectedMesh.vertices[k])
  }, [selectedMesh, meshMode, meshFaces, meshVerts, meshEdges])
  const meshEditing = mode === 'edit' && !!selectedMesh && meshMode !== 'object'

  const pickFace = useCallback((key: string, mods: { shift: boolean; ctrl: boolean }) => {
    setMeshFaces((cur) => (mods.shift || mods.ctrl ? (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]) : [key]))
  }, [])

  /** The mesh as an edge slide began; every step of the slide starts from it. */
  const slideFrom = useRef<Mesh | null>(null)

  /** Mesh edits on the current pick, as the panel's buttons and the keys run them. */
  const meshOps = useMemo(
    () => ({
      extrude: () => {
        if (!selectedMesh || meshMode !== 'face' || !meshFaces.length) return
        const r = extrudeFaces(selectedMesh, meshFaces, 1)
        history.commit('extrude', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshFaces(r.faces)
      },
      remove: () => {
        if (!selectedMesh) return
        if (meshMode === 'face' && meshFaces.length) {
          const next = deleteFaces(selectedMesh, meshFaces)
          history.commit('delete faces', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? next : x)) }))
          setMeshFaces([])
        } else if (meshMode === 'vertex' && meshVerts.length) {
          const next = deleteVertices(selectedMesh, meshVerts)
          history.commit('delete vertices', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? next : x)) }))
          setMeshVerts([])
        } else if (meshMode === 'edge' && meshEdges.length) {
          const next = deleteEdges(selectedMesh, meshEdges)
          history.commit('delete edges', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? next : x)) }))
          setMeshEdges([])
        }
      },
      merge: () => {
        if (!selectedMesh || meshMode !== 'vertex' || meshVerts.length < 2) return
        const r = mergeVertices(selectedMesh, meshVerts)
        history.commit('merge vertices', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshVerts(r.kept ? [r.kept] : [])
      },
      flip: () => {
        if (!selectedMesh || meshMode !== 'face' || !meshFaces.length) return
        const next = flipFaces(selectedMesh, meshFaces)
        history.commit('flip faces', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? next : x)) }))
      },
      selectAll: () => {
        if (!selectedMesh) return
        if (meshMode === 'face') setMeshFaces(Object.keys(selectedMesh.faces))
        if (meshMode === 'vertex') setMeshVerts(Object.keys(selectedMesh.vertices))
        if (meshMode === 'edge') setMeshEdges(edgesOf(selectedMesh))
      },
      loopCut: () => {
        if (!selectedMesh || selectedMesh.locked || meshMode !== 'edge' || meshEdges.length !== 1) return
        const r = loopCut(selectedMesh, meshEdges[0])
        if (!r.edges.length) return
        history.commit('loop cut', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshEdges(r.edges)
      },
      subdivide: () => {
        if (!selectedMesh || selectedMesh.locked) return
        const faces = meshMode === 'face' ? meshFaces.filter((k) => selectedMesh.faces[k]) : []
        if (meshMode === 'face' && !faces.length) return
        const next = subdivide(selectedMesh, faces)
        history.commit('subdivide', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? next : x)) }))
        // the corner quads that keep the old keys stay picked; the new ones join them
        if (faces.length) setMeshFaces(Object.keys(next.faces).filter((k) => faces.includes(k) || !selectedMesh.faces[k]))
      },
      bevel: () => {
        if (!selectedMesh || selectedMesh.locked) return
        const pick = meshMode === 'edge' ? { edges: meshEdges } : meshMode === 'vertex' ? { vertices: meshVerts } : null
        if (!pick || !(pick.edges ?? pick.vertices ?? []).length) return
        const r = bevel(selectedMesh, pick, meshAmount, meshSegments)
        if (r.mesh === selectedMesh) return
        history.commit(meshMode === 'edge' ? 'bevel edges' : 'bevel vertices', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        if (meshMode === 'edge') setMeshEdges(r.edges)
        else setMeshVerts([])
      },
      inset: () => {
        if (!selectedMesh || selectedMesh.locked || meshMode !== 'face' || !meshFaces.length) return
        const r = insetFaces(selectedMesh, meshFaces, meshAmount)
        history.commit('inset', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshFaces(r.faces)
      },
      fill: () => {
        if (!selectedMesh || selectedMesh.locked) return
        const keys = meshMode === 'vertex' ? meshVerts : meshMode === 'edge' ? edgeVerticesOf(meshEdges) : []
        const texture = Object.values(selectedMesh.faces)[0]?.texture ?? model.textures[0]?.id ?? null
        const r = fillFace(selectedMesh, keys, texture)
        if (!r.face) return
        const packed = packMeshFaces(model, r.mesh, [r.face])
        history.commit('fill', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? packed.mesh : x)) }))
        setMeshMode('face')
        setMeshFaces([r.face])
      },
      dissolve: () => {
        if (!selectedMesh || selectedMesh.locked || meshMode !== 'edge' || !meshEdges.length) return
        const r = dissolveEdges(selectedMesh, meshEdges)
        if (!r.faces.length) return
        history.commit('dissolve edges', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshEdges([])
      },
      mergeNear: () => {
        if (!selectedMesh || selectedMesh.locked) return
        const r = mergeByDistance(selectedMesh, mergeDistance, meshMode === 'vertex' ? meshVerts : undefined)
        notify(r.removed ? `Merged ${r.removed} vertex${r.removed === 1 ? '' : 'es'} into ${r.removed === 1 ? 'its neighbour' : 'their neighbours'}.` : `No vertices were within ${mergeDistance} of each other.`, 3000)
        if (!r.removed) return
        history.commit('merge by distance', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshVerts((cur) => cur.filter((k) => r.mesh.vertices[k]))
      },
      separate: () => {
        if (!selectedMesh || selectedMesh.locked || meshMode !== 'face') return
        const taken = new Set((model.meshes ?? []).map((x) => x.name))
        let n = 1
        while (taken.has(`${selectedMesh.name}_${n}`)) n++
        const r = separateFaces(selectedMesh, meshFaces, `${selectedMesh.name}_${n}`)
        if (!r) return notify('Pick some faces, not all of them, to separate.', 3000)
        history.commit('separate', (m) => ({ ...m, meshes: (m.meshes ?? []).flatMap((x) => (x.id === selectedMesh.id ? [r.mesh, r.piece] : [x])) }))
        setSelection([r.piece.id])
      },
      join: () => {
        if (!selectedMesh || selectedMesh.locked) return
        const others = selection.flatMap((id) => (model.meshes ?? []).filter((x) => x.id === id && x.id !== selectedMesh.id && !x.locked))
        if (!others.length) return notify('Pick the other meshes in the outliner too (Shift or Ctrl), then join.', 3500)
        // each point goes from its own mesh's frame to the world, then into the target's
        const into = meshFrame(rig, selectedMesh).inverse()
        const joined = joinMeshes(
          selectedMesh,
          others.map((o) => {
            const f = into.multiply(meshFrame(rig, o))
            return { mesh: o, toTarget: (p: Vec3) => apply(f, p) }
          }),
        )
        const gone = new Set(others.map((o) => o.id))
        history.commit('join meshes', (m) => ({ ...m, meshes: (m.meshes ?? []).flatMap((x) => (gone.has(x.id) ? [] : x.id === joined.id ? [joined] : [x])) }))
        setSelection([selectedMesh.id])
      },
      knife: () => {
        if (!selectedMesh || selectedMesh.locked) return
        if (knife === null) {
          // the knife cuts through edges, so it shows them
          setMeshMode('edge')
          setKnife([])
          return
        }
        const r = knifeCut(selectedMesh, knife)
        setKnife(null)
        if (!r.edges.length) return
        history.commit('knife', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === selectedMesh.id ? r.mesh : x)) }))
        setMeshEdges(r.edges)
      },
      slide: {
        begin: () => {
          // a held arrow key repeats keydown; the slide already under way goes on
          if (slideFrom.current || !selectedMesh || selectedMesh.locked || !meshEdges.length) return
          slideFrom.current = selectedMesh
          history.begin('edge slide')
        },
        set: (amount: number) => {
          const base = slideFrom.current
          if (!base) return
          const next = slideEdges(base, meshEdges, amount)
          history.amend((m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === base.id ? next : x)) }))
        },
        end: () => {
          if (!slideFrom.current) return
          slideFrom.current = null
          history.end()
        },
      },
    }),
    [selectedMesh, meshMode, meshFaces, meshVerts, meshEdges, history, meshAmount, meshSegments, model, knife, mergeDistance, notify, selection, rig, setSelection],
  )

  /* Dragging on the mesh UV sheet: one undo step per drag. */
  const meshUvDrag = useMemo(
    () => ({
      begin: (label: string) => history.begin(label),
      set: (next: Mesh) => history.amend((m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === next.id ? next : x)) })),
      end: () => history.end(),
    }),
    [history],
  )

  /** Lays the picked faces (or all) out flat again, packed into room the rest of the sheet leaves free. */
  const onUnwrapMesh = useCallback(() => {
    if (!selectedMesh || selectedMesh.locked) return
    const keys = meshFaces.filter((k) => selectedMesh.faces[k])
    const r = packMeshFaces(model, selectedMesh, keys.length ? keys : Object.keys(selectedMesh.faces))
    history.commit('unwrap mesh', (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === r.mesh.id ? r.mesh : x)) }))
    if (r.crowded) notify('The sheet had no room for some faces, so they share texels at the corner. Grow the sheet or move them.', 7000)
  }, [selectedMesh, meshFaces, model, history, notify])

  /** Applies a mesh edit to the selected mesh as one undo step. */
  const editMesh = useCallback(
    (label: string, fn: (m: Mesh) => Mesh) => {
      if (!meshId) return
      // coalesced, so dragging a field is one undo step
      history.commit(label, (m) => ({ ...m, meshes: (m.meshes ?? []).map((x) => (x.id === meshId && !x.locked ? fn(x) : x)) }), true)
    },
    [history, meshId],
  )

  /** What Animate mode poses: a selected null, else the selected bone, else the bone holding the selected cube. */
  const poseTarget = useMemo(() => selectedNull?.id ?? animBone, [selectedNull, animBone])

  /** Where the gizmo sits and which way its handles point. */
  const gizmo = useMemo<GizmoSpec | null>(() => {
    const world: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    const frameAxes = (f: DOMMatrix) => [0, 1, 2].map((i) => norm(applyDir(f, world[i]))) as [Vec3, Vec3, Vec3]

    // a null object only moves, in Edit and in Animate
    const asNull = (n: NullObject): GizmoSpec | null => {
      if (tool !== 'move' || n.locked || !n.visible) return null
      const parent = n.parent ? rig.bone.get(n.parent) : undefined
      return { tool: 'move', anchor: nullWorld(rig, n, pose), axes: space === 'local' && parent ? frameAxes(parent) : world }
    }

    if (mode === 'animate') {
      if (!clip || !poseTarget || !['move', 'rotate', 'scale'].includes(tool)) return null
      const n = (model.nulls ?? []).find((x) => x.id === poseTarget)
      if (n) return asNull(n)
      const b = findBone(model.bones, poseTarget)
      const f = rig.bone.get(poseTarget)
      if (!b || !f || !b.visible) return null
      const t = tool as GizmoSpec['tool']
      const rot = add(b.rotation, pose[b.id]?.rotation ?? [0, 0, 0])
      const rings = eulerAxes(parentFrame(rig, b.id).matrix, rot).map((r) => r.axis) as [Vec3, Vec3, Vec3]
      return { tool: t, anchor: apply(f, [0, 0, 0]), axes: t === 'scale' || space === 'local' ? frameAxes(f) : world, rings }
    }

    if (mode !== 'edit' || !selected) return null
    if (selectedNull) return asNull(selectedNull)
    // a pick of faces, vertices or edges moves, turns or scales about its middle
    if (selectedMesh && meshMode !== 'object') {
      if (!selectedMesh.visible || selectedMesh.locked || !meshKeys.length || knife !== null) return null
      const f = meshFrame(rig, selectedMesh)
      const anchor = apply(f, centreOf(selectedMesh, meshKeys))
      const axes = space === 'local' ? frameAxes(f) : world
      if (tool === 'rotate') return { tool: 'rotate', anchor, axes, rings: axes }
      // scaling runs along the mesh's own axes
      if (tool === 'resize') return { tool: 'scale', anchor, axes: frameAxes(f) }
      return { tool: 'move', anchor, axes }
    }
    if (!['move', 'resize', 'rotate', 'pivot'].includes(tool)) return null
    const t = tool as GizmoSpec['tool']
    if (selectedMesh) {
      if (!selectedMesh.visible || selectedMesh.locked || t === 'resize') return null
      const f = meshFrame(rig, selectedMesh)
      const rings = eulerAxes(parentFrame(rig, selectedMesh.id).matrix, selectedMesh.rotation).map((r) => r.axis) as [Vec3, Vec3, Vec3]
      return { tool: t, anchor: apply(f, [0, 0, 0]), axes: space === 'local' ? frameAxes(f) : world, rings }
    }
    const c = model.cubes.find((x) => x.id === selected)
    if (c) {
      if (!c.visible || c.locked) return null
      const f = cubeFrame(rig, c)
      const centre: Vec3 = [(c.from[0] + c.to[0]) / 2, (c.from[1] + c.to[1]) / 2, (c.from[2] + c.to[2]) / 2]
      const anchor = t === 'move' || t === 'resize' ? apply(f, sub(centre, c.origin)) : apply(f, [0, 0, 0])
      const rings = eulerAxes(parentFrame(rig, c.id).matrix, c.rotation).map((r) => r.axis) as [Vec3, Vec3, Vec3]
      return { tool: t, anchor, axes: t === 'resize' || space === 'local' ? frameAxes(f) : world, rings }
    }
    const b = findBone(model.bones, selected)
    if (!b || b.locked || !b.visible || t === 'resize') return null
    const f = rig.bone.get(b.id)
    if (!f) return null
    const rings = eulerAxes(parentFrame(rig, b.id).matrix, b.rotation).map((r) => r.axis) as [Vec3, Vec3, Vec3]
    return { tool: t, anchor: apply(f, [0, 0, 0]), axes: space === 'local' ? frameAxes(f) : world, rings }
  }, [mode, tool, selected, selectedNull, model, rig, pose, space, clip, poseTarget, selectedMesh, meshMode, meshKeys, knife])

  /** The model and rig when a drag began; every move is applied to these, never on top of the last move. */
  const dragFrom = useRef<{ model: Model; rig: ReturnType<typeof buildRig>; pose: Pose; ids: string[] } | null>(null)

  const onGizmo = useCallback(
    (e: GizmoEvent) => {
      if (e.phase === 'start') {
        const label =
          mode === 'animate' ? 'pose' : meshEditing ? `${e.tool === 'rotate' ? 'turn' : e.tool === 'scale' ? 'scale' : 'move'} ${MESH_NOUN[meshMode][1]}` : { move: 'move', resize: 'resize', rotate: 'rotate', pivot: 'move pivot', scale: 'scale' }[e.tool]
        history.begin(label)
        dragFrom.current = { model, rig, pose, ids: topLevel(model, selection) }
      }
      const from = dragFrom.current
      if (!from) return
      const { model: m0, rig: r0, ids } = from
      let next = m0
      const nulls = m0.nulls ?? []
      const toNullParent = (n: NullObject, d: Vec3) => (n.parent && r0.bone.get(n.parent) ? applyDir(r0.bone.get(n.parent)!.inverse(), d) : d)

      if (mode === 'animate' && clip && poseTarget) {
        /* Posing keys the dragged channel at the playhead, on top of what the
           clip already says there, as Blockbench's auto-key does. */
        const raw = samplePose(m0.clips.find((c) => c.id === clip.id) ?? clip, time)[poseTarget]
        const n = nulls.find((x) => x.id === poseTarget)
        const channel: Channel = e.tool === 'rotate' ? 'rotation' : e.tool === 'scale' ? 'scale' : 'position'
        const base: Vec3 = raw?.[channel] ?? (channel === 'scale' ? [1, 1, 1] : [0, 0, 0])
        let value: Vec3 = [...base]
        if (channel === 'position' && e.delta) {
          const d = n ? toNullParent(n, e.delta) : toParentDir(r0, poseTarget, e.delta)
          value = add(base, d).map((v) => Math.round(v * 1e4) / 1e4) as Vec3
        } else if (channel === 'rotation' && e.angle !== undefined) {
          const b = findBone(m0.bones, poseTarget)
          if (b) {
            const axis = 'xyz'.indexOf(e.handle)
            const rot = add(b.rotation, from.pose[poseTarget]?.rotation ?? [0, 0, 0])
            const rate = eulerAxes(parentFrame(r0, poseTarget).matrix, rot)[axis].rate || Math.PI / 180
            const step = e.ctrl ? 0 : e.shift ? 0.5 : 2.5
            let v = base[axis] + (e.angle * Math.PI) / 180 / rate
            if (step) v = Math.round(v / step) * step
            value[axis] = Math.round(v * 1000) / 1000
          }
        } else if (channel === 'scale' && e.amount !== undefined) {
          if (e.handle === 'uniform') value = base.map((v) => Math.max(0.01, v * (1 + e.amount!))) as Vec3
          else {
            const axis = 'xyz'.indexOf(e.handle)
            value[axis] = Math.max(0.01, base[axis] * (1 + e.amount / 8))
          }
          value = value.map((v) => Math.round(v * 1000) / 1000) as Vec3
        }
        // keep the key's easing when there is one already
        const c0 = m0.clips.find((c) => c.id === clip.id)
        const existing = c0?.tracks.find((t) => t.bone === poseTarget && t.channel === channel)?.keys.find((k) => Math.abs(k.time - time) < 1e-4)
        next = setKey(m0, clip.id, poseTarget, channel, time, value, existing?.interp ?? 'linear')
      } else if (meshEditing && selectedMesh) {
        // the drag in world space, taken into the mesh's own frame
        const mesh0 = m0.meshes?.find((x) => x.id === selectedMesh.id)
        if (mesh0) {
          const f0 = meshFrame(r0, mesh0)
          const about = centreOf(mesh0, meshKeys)
          let edited = mesh0
          if (e.delta) edited = moveVertices(mesh0, meshKeys, applyDir(f0.inverse(), e.delta))
          else if (e.tool === 'rotate' && e.angle !== undefined && gizmo?.rings) {
            const step = e.ctrl ? 0 : e.shift ? 1 : 15
            const angle = step ? Math.round(e.angle / step) * step : e.angle
            const axis = norm(applyDir(f0.inverse(), gizmo.rings['xyz'.indexOf(e.handle)]))
            edited = rotateVertices(mesh0, meshKeys, axis, angle, about)
          } else if (e.tool === 'scale' && e.amount !== undefined) {
            const k = Math.max(0.01, 1 + (e.handle === 'uniform' ? e.amount : e.amount / 8))
            const factors: Vec3 = e.handle === 'uniform' ? [k, k, k] : ([0, 1, 2].map((i) => (i === 'xyz'.indexOf(e.handle) ? k : 1)) as Vec3)
            edited = scaleVertices(mesh0, meshKeys, factors, about)
          }
          next = { ...m0, meshes: (m0.meshes ?? []).map((x) => (x.id === mesh0.id ? edited : x)) }
        }
      } else if ((e.tool === 'move' || e.tool === 'pivot') && e.delta) {
        const deltas = new Map(ids.filter((id) => !nulls.some((n) => n.id === id)).map((id) => [id, toParentDir(r0, id, e.delta!)] as const))
        next = e.tool === 'move' ? translateNodes(m0, deltas) : movePivots(m0, deltas)
        // null objects move by position, in their own parent's frame
        const picked = new Set(selection)
        if (e.tool === 'move' && nulls.some((n) => picked.has(n.id))) {
          next = { ...next, nulls: (next.nulls ?? nulls).map((n) => (picked.has(n.id) && !n.locked ? { ...n, position: add(n.position, toNullParent(n, e.delta!)) } : n)) }
        }
      } else if (e.tool === 'resize' && e.amount !== undefined) {
        const axis = 'xyz'.indexOf(e.handle) as 0 | 1 | 2
        const cubes = new Set(ids)
        next = { ...m0, cubes: m0.cubes.map((c) => (cubes.has(c.id) ? followBoxUv(resizeCube(c, axis, e.side ?? 1, e.amount!)) : c)) }
      } else if (e.tool === 'rotate' && e.angle !== undefined) {
        const axis = 'xyz'.indexOf(e.handle)
        // Java block and item models only take 22.5° steps
        const step = e.ctrl ? 0 : kind === 'blocks' ? 22.5 : e.shift ? 0.5 : 2.5
        const rotations = new Map<string, Vec3>()
        for (const id of ids) {
          const node = m0.cubes.find((c) => c.id === id) ?? findBone(m0.bones, id)
          if (!node) continue
          const rate = eulerAxes(parentFrame(r0, id).matrix, node.rotation)[axis].rate || Math.PI / 180
          const r: Vec3 = [...node.rotation]
          let v = r[axis] + (e.angle * Math.PI) / 180 / rate
          if (step) v = Math.round(v / step) * step
          // keep it in -180..180 so fields stay readable
          v = ((((v + 180) % 360) + 360) % 360) - 180
          r[axis] = Math.round(v * 1000) / 1000
          rotations.set(id, r)
        }
        next = setRotations(m0, rotations)
      }

      history.amend(next)
      if (e.phase === 'end') {
        history.end()
        dragFrom.current = null
        // the key a pose wrote is selected, so the Keyframe panel shows it at once
        if (mode === 'animate' && clip && poseTarget && next !== m0) {
          const channel: Channel = e.tool === 'rotate' ? 'rotation' : e.tool === 'scale' ? 'scale' : 'position'
          const c1 = next.clips.find((c) => c.id === clip.id)
          const at = c1?.tracks.find((t) => t.bone === poseTarget && t.channel === channel)?.keys.reduce<Key | null>(
            (best, k) => (!best || Math.abs(k.time - time) < Math.abs(best.time - time) ? k : best),
            null,
          )
          if (at) {
            setSelectedKey(at.id)
          }
        }
      }
    },
    [history, model, rig, pose, selection, kind, mode, clip, poseTarget, time, meshEditing, meshMode, selectedMesh, meshKeys, gizmo],
  )

  /* ---------------- vertex snap ---------------- */

  const vertexData = useMemo(() => {
    if (mode !== 'edit' || tool !== 'vertex') return null
    const picked = new Set<string>()
    for (const id of selection) {
      const b = findBone(model.bones, id)
      if (!b) picked.add(id)
    }
    const points: Vec3[] = []
    const own: boolean[] = []
    for (const c of model.cubes) {
      if (!c.visible) continue
      for (const p of cubeCorners(rig, c)) {
        points.push(p)
        own.push(picked.has(c.id))
      }
    }
    return { points, own }
  }, [mode, tool, model, rig, selection])

  const snapVertex = useCallback(
    (index: number) => {
      if (!vertexData) return
      if (vertexFrom === null) {
        if (!vertexData.own[index]) {
          setSaveNote('Pick a corner of the selected cube first (the yellow ones), then the corner it should meet.')
          window.setTimeout(() => setSaveNote(null), 3500)
          return
        }
        setVertexFrom(index)
        return
      }
      const delta = sub(vertexData.points[index], vertexData.points[vertexFrom])
      setVertexFrom(null)
      const ids = topLevel(model, selection)
      if (!ids.length) return
      history.commit('vertex snap', (m) => translateNodes(m, new Map(ids.map((id) => [id, toParentDir(rig, id, delta)] as const))))
    },
    [vertexData, vertexFrom, model, selection, rig, history],
  )

  /* In Vertex mode every vertex of the selected mesh is a dot; a click
     picks it, Shift or Ctrl adds or drops it. */
  const meshVertexLayer = useMemo<VertexLayer | null>(() => {
    if (!meshEditing || (meshMode !== 'vertex' && meshMode !== 'edge' && knife === null) || !selectedMesh) return null
    const f = meshFrame(rig, selectedMesh)
    const keys = Object.keys(selectedMesh.vertices)
    const points = keys.map((k) => apply(f, selectedMesh.vertices[k]))
    const toggle = (cur: string[], k: string, add: boolean | undefined) => (add ? (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]) : [k])
    const boxed = (cur: string[], inside: string[], add: boolean) => (add ? [...cur.filter((x) => !inside.includes(x)), ...inside] : inside)
    const index = new Map(keys.map((k, i) => [k, i]))
    const edges = meshEdgeList.map((e) => edgeEnds(e).map((v) => index.get(v) ?? 0) as [number, number])
    if (knife !== null) {
      // the knife: each click on an edge adds a point there; Enter cuts
      const at = new Map(meshEdgeList.map((e, i) => [e, i]))
      return {
        points,
        own: keys.map(() => false),
        onPick: () => {},
        hideDots: true,
        edges,
        edgeOwn: meshEdgeList.map(() => false),
        onPickEdge: (i, _mods, t) => setKnife((cur) => [...(cur ?? []), { edge: meshEdgeList[i], t }]),
        marks: knife.flatMap((p) => (at.has(p.edge) ? [{ edge: at.get(p.edge)!, t: p.t }] : [])),
      }
    }
    if (meshMode === 'vertex') {
      const picked = new Set(meshVerts)
      return {
        points,
        own: keys.map((k) => picked.has(k)),
        onPick: (i, mods) => setMeshVerts((cur) => toggle(cur, keys[i], mods?.shift || mods?.ctrl)),
        onBox: (inside, add) => setMeshVerts((cur) => boxed(cur, inside.map((i) => keys[i]), add)),
      }
    }
    /* Edge mode draws the edges as lines over the mesh; a box picks the edges
       with both ends inside it. */
    const picked = new Set(meshEdges)
    return {
      points,
      own: keys.map(() => false),
      onPick: () => {},
      hideDots: true,
      edges,
      edgeOwn: meshEdgeList.map((e) => picked.has(e)),
      onPickEdge: (i, mods) => {
        // Alt picks the whole loop through the edge
        if (mods.alt) {
          const loop = edgeLoop(selectedMesh, meshEdgeList[i])
          setMeshEdges((cur) => (mods.shift || mods.ctrl ? [...cur.filter((e) => !loop.includes(e)), ...loop] : loop))
          return
        }
        setMeshEdges((cur) => toggle(cur, meshEdgeList[i], mods.shift || mods.ctrl))
      },
      onBox: (inside, add) => {
        const set = new Set(inside.map((i) => keys[i]))
        const hit = meshEdgeList.filter((e) => edgeEnds(e).every((v) => set.has(v)))
        setMeshEdges((cur) => boxed(cur, hit, add))
      },
    }
  }, [meshEditing, meshMode, selectedMesh, rig, meshVerts, meshEdges, meshEdgeList, knife])

  const vertices = useMemo<VertexLayer | null>(
    () =>
      meshVertexLayer ??
      (vertexData
        ? {
            points: vertexData.points,
            own: vertexFrom === null ? vertexData.own : vertexData.own.map((_, i) => i === vertexFrom),
            onPick: snapVertex,
          }
        : null),
    [vertexData, vertexFrom, snapVertex, meshVertexLayer],
  )

  /* ---------------- grab ---------------- */

  /* Blender's G: the selection follows the pointer until a click or Enter
     puts it down, and Esc or a right click puts it back. X, Y or Z holds it
     to that world axis and Shift with one to the plane across it; typed
     digits move it exactly that far along the axis. On picked edges a
     second G slides them along their faces instead. The move goes through
     the gizmo's own handler, so it snaps and records one undo step the
     same way a drag does. */
  type Grab = { x0: number; y0: number; axis: 0 | 1 | 2 | null; plane: boolean; typed: string; slide: boolean; from: Model }
  const [grab, setGrab] = useState<Grab | null>(null)
  const grabRef = useRef(grab)
  grabRef.current = grab
  const pointerAt = useRef<[number, number]>([0, 0])
  const grabLast = useRef<GizmoEvent | null>(null)
  useEffect(() => {
    const track = (e: PointerEvent) => {
      pointerAt.current = [e.clientX, e.clientY]
    }
    window.addEventListener('pointermove', track, true)
    return () => window.removeEventListener('pointermove', track, true)
  }, [])

  const startGrab = useCallback(() => {
    if ((mode !== 'edit' && mode !== 'animate') || grabRef.current) return
    // the grab measures the screen with the gizmo, so there must be one to move
    if (!gizmo || knife !== null) {
      notify('Pick something to grab first.', 2500)
      return
    }
    if (tool !== 'move') setTool('move')
    const [x, y] = pointerAt.current
    const start: GizmoEvent = { phase: 'start', tool: 'move', handle: 'free', delta: [0, 0, 0], shift: false, ctrl: false }
    onGizmo(start)
    grabLast.current = start
    setGrab({ x0: x, y0: y, axis: null, plane: false, typed: '', slide: false, from: model })
  }, [mode, gizmo, knife, tool, onGizmo, model, notify])

  const grabTo = useCallback(
    (cx: number, cy: number, shift: boolean, ctrl: boolean) => {
      const g = grabRef.current
      if (!g) return
      if (g.slide) {
        // left and right slide the edges, a full rail every 160 pixels
        meshOps.slide.set(Math.round(Math.max(-1, Math.min(1, (cx - g.x0) / 160)) * 50) / 50)
        return
      }
      const b = viewApi.current?.basis()
      if (!b) return
      const S = b.s
      const d = [cx - g.x0, cy - g.y0]
      const typed = g.typed && g.typed !== '-' && g.typed !== '.' ? Number(g.typed) : NaN
      let w: Vec3 = [0, 0, 0]
      if (g.axis !== null && !g.plane) {
        const s = S[g.axis]
        const l2 = s[0] * s[0] + s[1] * s[1]
        w[g.axis] = Number.isFinite(typed) ? typed : l2 > 1e-9 ? (s[0] * d[0] + s[1] * d[1]) / l2 : 0
      } else if (g.axis !== null) {
        const [i, j] = ([0, 1, 2] as const).filter((k) => k !== g.axis)
        const det = S[i][0] * S[j][1] - S[j][0] * S[i][1]
        if (Math.abs(det) < 1e-9) return
        w[i] = (d[0] * S[j][1] - S[j][0] * d[1]) / det
        w[j] = (S[i][0] * d[1] - d[0] * S[i][1]) / det
      } else {
        // the smallest world move that lands under the pointer: in the view plane
        const a11 = S[0][0] ** 2 + S[1][0] ** 2 + S[2][0] ** 2
        const a12 = S[0][0] * S[0][1] + S[1][0] * S[1][1] + S[2][0] * S[2][1]
        const a22 = S[0][1] ** 2 + S[1][1] ** 2 + S[2][1] ** 2
        const det = a11 * a22 - a12 * a12
        if (Math.abs(det) < 1e-9) return
        const y0 = (a22 * d[0] - a12 * d[1]) / det
        const y1 = (-a12 * d[0] + a11 * d[1]) / det
        w = [0, 1, 2].map((i) => S[i][0] * y0 + S[i][1] * y1) as Vec3
      }
      const step = ctrl || Number.isFinite(typed) ? 0 : shift ? increment / 4 : increment
      if (step) w = w.map((v) => Math.round(v / step) * step) as Vec3
      const ev: GizmoEvent = { phase: 'move', tool: 'move', handle: 'free', delta: w.map((v) => Math.round(v * 1e4) / 1e4) as Vec3, shift, ctrl }
      grabLast.current = ev
      onGizmo(ev)
    },
    [meshOps, increment, onGizmo],
  )

  const endGrab = useCallback(
    (keep: boolean) => {
      const g = grabRef.current
      if (!g) return
      setGrab(null)
      if (keep) {
        if (g.slide) meshOps.slide.end()
        else onGizmo({ ...(grabLast.current ?? { tool: 'move', handle: 'free', delta: [0, 0, 0], shift: false, ctrl: false }), phase: 'end' })
        return
      }
      // put everything back as it was; an undo step with no change is dropped
      dragFrom.current = null
      slideFrom.current = null
      history.amend(g.from)
      history.end()
    },
    [meshOps, onGizmo, history],
  )

  useEffect(() => {
    if (!grab) return
    const move = (e: PointerEvent) => grabTo(e.clientX, e.clientY, e.shiftKey, e.ctrlKey || e.metaKey)
    const press = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      endGrab(e.button !== 2)
    }
    const menu = (e: MouseEvent) => e.preventDefault()
    const key = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const g = grabRef.current
      if (!g) return
      const k = e.key.toLowerCase()
      // the grab takes a key's change at once, before React draws it
      const change = (next: Grab) => {
        grabRef.current = next
        setGrab(next)
        grabTo(pointerAt.current[0], pointerAt.current[1], false, false)
      }
      if (e.key === 'Escape') return endGrab(false)
      if (e.key === 'Enter') return endGrab(true)
      if (k === 'g' && !g.slide && selectedMesh && meshMode === 'edge' && meshEdges.length) {
        // G G: from moving the edges to sliding them
        dragFrom.current = null
        history.amend(g.from)
        history.end()
        meshOps.slide.begin()
        const next = { ...g, x0: pointerAt.current[0], slide: true, axis: null, typed: '' }
        grabRef.current = next
        setGrab(next)
        return
      }
      if (g.slide) return
      if (k === 'x' || k === 'y' || k === 'z') {
        const axis = 'xyz'.indexOf(k) as 0 | 1 | 2
        // the same key again lets go of the axis
        const same = g.axis === axis && g.plane === e.shiftKey
        change({ ...g, axis: same ? null : axis, plane: same ? false : e.shiftKey })
        return
      }
      if (/^[0-9.]$/.test(e.key) || (e.key === '-' && !g.typed)) {
        change({ ...g, typed: g.typed + e.key, axis: g.axis ?? 0, plane: false })
        return
      }
      if (e.key === 'Backspace') {
        change({ ...g, typed: g.typed.slice(0, -1) })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', press, true)
    window.addEventListener('contextmenu', menu, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', press, true)
      window.removeEventListener('contextmenu', menu, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [grab, grabTo, endGrab, selectedMesh, meshMode, meshEdges, history, meshOps])

  const grabHint = grab
    ? grab.slide
      ? 'Slide: move left or right. Click or Enter puts it down, Esc or right click puts it back.'
      : `Grab${grab.axis !== null ? ` ${grab.plane ? 'across' : 'along'} ${'XYZ'[grab.axis]}` : ''}${grab.typed ? `: ${grab.typed}` : ''}. X, Y or Z holds an axis (Shift for the plane across it), digits move exactly that far${selectedMesh && meshMode === 'edge' ? ', G again slides' : ''}. Click or Enter puts it down, Esc or right click puts it back.`
    : null

  /* ---------------- view ---------------- */

  /** Centres the view on the selection, or on the whole model with nothing selected. */
  const focusOn = useCallback(
    (ids: readonly string[]) => {
      const pts: Vec3[] = []
      const cubeIds = new Set<string>()
      for (const id of ids) {
        const b = findBone(model.bones, id)
        if (b) {
          const f = rig.bone.get(b.id)
          if (f) pts.push(apply(f, [0, 0, 0]))
          for (const c of model.cubes) if (rig.cubeOwner.get(c.id) === b.id) cubeIds.add(c.id)
        } else cubeIds.add(id)
      }
      for (const c of model.cubes) if (cubeIds.has(c.id) || !ids.length) pts.push(...cubeCorners(rig, c))
      if (!pts.length) return
      const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])))
      const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])))
      const centre = add(lo as Vec3, sub(hi as Vec3, lo as Vec3).map((v) => v / 2) as Vec3)
      viewApi.current?.focus(centre, Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 2))
    },
    [model, rig],
  )

  const rename = useCallback(
    (id: string, name: string) => history.commit('rename', (m) => renameNode(m, id, name)),
    [history],
  )

  const move = useCallback(
    (id: string, parentId: string | null) => {
      history.commit('reparent', (m) => reparent(m, id, parentId))
      // expand the bone it was dropped into so the moved row stays visible
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
      if (model.cubes.find((c) => c.id === selected)?.locked) return
      history.commit(
        'cube edit',
        (m) => ({ ...m, cubes: m.cubes.map((c) => (c.id === selected ? fn(c) : c)) }),
        true,
      )
    },
    [selected, history, model.cubes],
  )

  const editNull = useCallback(
    (id: string, patch: Partial<Omit<NullObject, 'id'>>) =>
      history.commit('null object', (m) => ({ ...m, nulls: (m.nulls ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)) }), true),
    [history],
  )
  const removeNull = useCallback(
    (id: string) => {
      history.commit('delete null object', (m) => {
        const left = (m.nulls ?? []).filter((n) => n.id !== id)
        return {
          ...m,
          nulls: left.length ? left : undefined,
          // its keyed position and any effect that played at it go with it
          clips: m.clips.map((c) => ({
            ...c,
            tracks: c.tracks.filter((t) => t.bone !== id),
            events: c.events?.map((e) => (e.locator === id ? { ...e, locator: undefined } : e)),
          })),
        }
      })
      setSelection((cur) => cur.filter((x) => x !== id))
    },
    [history],
  )

  /** Tells the user why an edit on a locked node did nothing. */
  const refuseLocked = useCallback((what: string) => {
    setSaveNote(`${what} is locked. Unlock it in the outliner first.`)
    window.setTimeout(() => setSaveNote(null), 3000)
  }, [])

  /* Unsaved-work guards. Reload and tab close can be caught only with
     `beforeunload`. A hash change never unloads the page, so route
     changes, Open and sample loads are guarded below. */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const unsaved = `${fileName} has unsaved changes. Undo can\u2019t bring them back once you leave this model.`

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

  // applies the active tool at one texel, for both the UV sheet and the model
  const applyTool = useCallback(
    (
      textureId: string,
      x: number,
      y: number,
      bounds: UVRect | null,
      phase: 'down' | 'move',
      /**
       * Where a brush or shape may write. The face's rectangle when painting
       * on the model, so a stamp can't spill onto other faces; null on the
       * sheet. `bounds` limits only the bucket fill.
       */
      clip: UVRect | null = null,
      /** texture pixels per UV texel, so the brush covers the same texels on a finer sheet */
      scale = 1,
      /** 1 for the mirrored half of a stroke, which joins its own points */
      lane: 0 | 1 = 0,
    ) => {
      const surface = surfaces.current.get(textureId)
      const size = Math.max(1, Math.round(brush * scale))
      const last = lane ? mirrorTexel : lastTexel
      /* skip while the texture is being decoded again (after an undo, say),
         or the stroke would land on the stale canvas */
      if (!surface || decoding.current.has(textureId)) return

      if (tool === 'pipette') {
        const sampled = pick(surface, x, y)
        if (!sampled) return
        if (sampled[3] === 0) {
          setSaveNote('That texel is transparent, so there\u2019s no colour to pick.')
          window.setTimeout(() => setSaveNote(null), 2500)
          return
        }
        setColour(rgbaToHex(sampled))
        return
      }

      /* Each move restores the snapshot taken on pointerdown before drawing,
         so the shape follows the cursor without leaving a trail. */
      if (tool === 'shape') {
        if (phase === 'down') {
          shapeFrom.current = [x, y]
          shapeUndo.current = surface.ctx.getImageData(0, 0, surface.width, surface.height)
          last.current = [x, y]
          return
        }
        const from = shapeFrom.current
        const snapshot = shapeUndo.current
        if (!from || !snapshot) return
        surface.ctx.putImageData(snapshot, 0, 0)
        drawShape(surface, from, [x, y], hexToRgba(colour), shape, shapeFilled, size, clip)
        last.current = [x, y]
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
      if (phase === 'down' && lane === 0) strokeTouched.current = new Set()
      const stamp = (px: number, py: number) => paintTexels(surface, px, py, rgba, size, clip, opacity, strokeTouched.current)

      // fill the gap since the last move so a fast drag draws a line
      if (phase === 'move' && last.current) strokeBetween(last.current, [x, y], stamp)
      else stamp(x, y)

      last.current = [x, y]
      commitTexture(textureId)
    },
    [tool, colour, brush, shape, shapeFilled, commitTexture, opacity],
  )

  /* A stroke is one undo step. Flush the pending frame first, or it would
     land after the step closed. */
  useEffect(() => {
    const done = () => {
      shapeFrom.current = null
      shapeUndo.current = null
      if (!lastTexel.current && !commitTimer.current) return
      lastTexel.current = null
      mirrorTexel.current = null
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

  /**
   * A point on a face (u, v from its top left, 0..1) as a pixel of the
   * face's texture, with the face's pixel box and the pixels per UV texel.
   * Null for an untextured or zero-area face.
   */
  const faceTexel = useCallback(
    (cube: Cube, faceKey: FaceKey, u: number, v: number) => {
      const f = cube.faces[faceKey]
      const texture = textureById(model, f.texture)
      if (!texture || !texelOfFace(f.uv, u, v)) return null
      // UV units to the texture's own pixels, for a sheet drawn finer or coarser than the UVs
      const [sx, sy] = pixelScale(model, texture)
      const [ax, ay, bx, by] = faceBounds(f.uv)
      const box: UVRect = [Math.round(ax * sx), Math.round(ay * sy), Math.round(bx * sx), Math.round(by * sy)]
      return {
        texture: texture.id,
        x: Math.min(box[2] - 1, Math.floor((ax + u * (bx - ax)) * sx)),
        y: Math.min(box[3] - 1, Math.floor((ay + v * (by - ay)) * sy)),
        box,
        scale: (sx + sy) / 2,
      }
    },
    [model],
  )

  /** Paints where a click lands on a mesh face; u and v arrive in UV units. */
  const paintOnMesh = useCallback(
    (meshIdHit: string, faceKey: string, u: number, v: number, phase: 'down' | 'move') => {
      const mesh = model.meshes?.find((x) => x.id === meshIdHit)
      const f = mesh?.faces[faceKey]
      if (!mesh || !f) return
      if (mesh.locked) {
        if (phase === 'down') refuseLocked(`"${mesh.name}"`)
        return
      }
      const texture = textureById(model, f.texture)
      if (!texture) return
      if (phase === 'down') {
        if (tool !== 'pipette') history.begin('paint')
        setSelected(mesh.id)
      }
      const [sx, sy] = pixelScale(model, texture)
      const uvs = Object.values(f.uv)
      const box: UVRect = [
        Math.floor(Math.min(...uvs.map((p) => p[0])) * sx),
        Math.floor(Math.min(...uvs.map((p) => p[1])) * sy),
        Math.ceil(Math.max(...uvs.map((p) => p[0])) * sx),
        Math.ceil(Math.max(...uvs.map((p) => p[1])) * sy),
      ]
      applyTool(texture.id, Math.floor(u * sx), Math.floor(v * sy), box, phase, keepInside ? box : null, (sx + sy) / 2)
    },
    [model, applyTool, history, tool, refuseLocked, setSelected, keepInside],
  )

  /** With mirror painting on, the same brush stroke on the cube mirrored across X. */
  const paintMirror = useCallback(
    (cube: Cube, faceKey: FaceKey, u: number, v: number, phase: 'down' | 'move') => {
      if (!mirrorPaint || (tool !== 'brush' && tool !== 'eraser')) return
      const m = mirrorPoint(model, cube, faceKey, u, v)
      if (!m || m.cube.locked) return
      const at = faceTexel(m.cube, m.face, m.u, m.v)
      if (!at) return
      applyTool(at.texture, at.x, at.y, at.box, phase, at.box, at.scale, 1)
    },
    [mirrorPaint, tool, model, faceTexel, applyTool],
  )

  /** Paints where a click lands on the model, mapped through that face's UV rectangle. */
  const paintOnModel = useCallback(
    (cubeId: string, faceKey: FaceKey, u: number, v: number, phase: 'down' | 'move') => {
      const target = model.cubes.find((c) => c.id === cubeId)
      if (!target) return
      if (target.locked) {
        if (phase === 'down') refuseLocked(`"${target.name}"`)
        return
      }
      if (phase === 'down') {
        // the pipette changes nothing, so it opens no undo step
        if (tool !== 'pipette') history.begin('paint')
        setSelected(cubeId)
        setFace(faceKey)
      }
      const at = faceTexel(target, faceKey, u, v)
      if (!at) return
      applyTool(at.texture, at.x, at.y, at.box, phase, at.box, at.scale)
      paintMirror(target, faceKey, u, v, phase)
    },
    [applyTool, history, tool, refuseLocked, setSelected, faceTexel, paintMirror],
  )

  /** The selected face's texture, which the UV sheet shows; a face without one shows the texture picked in Textures. */
  const sheetTexture = useMemo(() => {
    const c = model.cubes.find((x) => x.id === selected)
    return textureById(model, c?.faces[face].texture ?? null) ?? model.textures[textureIndex] ?? model.textures[0] ?? null
  }, [model, selected, face, textureIndex])

  /** The texture the large sheet shows: one picked on its bar, or the selected face's. */
  const paintTexture = useMemo(() => textureById(model, paintPick) ?? sheetTexture, [model, paintPick, sheetTexture])
  // picking another cube or face follows that face's texture again
  useEffect(() => setPaintPick(null), [selected, face])

  /* On the sheet a press picks the face under it (and its cube), so the
     panels follow what is being painted. With "keep strokes inside" on, the
     stroke stays in that face. A fill stays inside the island it starts in.
     `u`,`v` are in UV units and become the texture's pixels here. */
  const paintOnSheet = useCallback(
    (u: number, v: number, phase: 'down' | 'move') => {
      const texture = paintTexture
      if (!texture) return
      const [sx, sy] = pixelScale(model, texture)
      let hit: { cube: Cube; key: FaceKey; box: UVRect } | null = null
      // the selected cube's faces win where islands overlap
      const order = [...model.cubes].sort((a, b) => Number(b.id === selected) - Number(a.id === selected))
      for (const c of order) {
        for (const key of FACES) {
          if (c.faces[key].texture !== texture.id) continue
          const [bx1, by1, bx2, by2] = faceBounds(c.faces[key].uv)
          if (u >= bx1 && u < bx2 && v >= by1 && v < by2) {
            hit = { cube: c, key, box: [Math.round(bx1 * sx), Math.round(by1 * sy), Math.round(bx2 * sx), Math.round(by2 * sy)] }
            break
          }
        }
        if (hit) break
      }
      // a mesh face on the sheet is a polygon, so the hit is a point-in-polygon test
      let meshHit: { mesh: Mesh; box: UVRect } | null = null
      if (!hit) {
        for (const m of model.meshes ?? []) {
          for (const f of Object.values(m.faces)) {
            if (f.texture !== texture.id) continue
            const poly = faceOrder(m, f).map((k) => f.uv[k] ?? [0, 0])
            if (!insidePolygon(u, v, poly)) continue
            const xs = poly.map((p) => p[0])
            const ys = poly.map((p) => p[1])
            meshHit = { mesh: m, box: [Math.floor(Math.min(...xs) * sx), Math.floor(Math.min(...ys) * sy), Math.ceil(Math.max(...xs) * sx), Math.ceil(Math.max(...ys) * sy)] }
            break
          }
          if (meshHit) break
        }
      }
      if (phase === 'down' && meshHit) {
        if (meshHit.mesh.locked) {
          refuseLocked(`"${meshHit.mesh.name}"`)
          strokeClip.current = null
          return
        }
        if (tool !== 'pipette') history.begin('paint')
        if (meshHit.mesh.id !== selected) setSelected(meshHit.mesh.id)
        strokeClip.current = keepInside ? meshHit.box : null
        applyTool(texture.id, Math.floor(u * sx), Math.floor(v * sy), meshHit.box, phase, strokeClip.current, (sx + sy) / 2)
        return
      }
      if (phase === 'down') {
        if (hit?.cube.locked) {
          refuseLocked(`"${hit.cube.name}"`)
          strokeClip.current = null
          return
        }
        if (tool !== 'pipette') history.begin('paint')
        if (hit) {
          if (hit.cube.id !== selected) setSelected(hit.cube.id)
          setFace(hit.key)
        }
        strokeClip.current = keepInside && hit ? hit.box : null
      }
      applyTool(texture.id, Math.floor(u * sx), Math.floor(v * sy), hit?.box ?? null, phase, strokeClip.current, (sx + sy) / 2)
      if (hit) {
        const [bx1, by1, bx2, by2] = faceBounds(hit.cube.faces[hit.key].uv)
        paintMirror(hit.cube, hit.key, (u - bx1) / (bx2 - bx1), (v - by1) / (by2 - by1), phase)
      }
    },
    [applyTool, model, paintTexture, history, tool, selected, setSelected, keepInside, refuseLocked, paintMirror],
  )

  /** Shows the texel under the pointer and its colour in the status bar. */
  const hoverSheet = useCallback(
    (at: [number, number] | null) => {
      const texture = paintTexture
      if (!at || !texture) {
        hoverSink.current?.(null)
        return
      }
      const [sx, sy] = pixelScale(model, texture)
      const x = Math.floor(at[0] * sx)
      const y = Math.floor(at[1] * sy)
      const surface = surfaces.current.get(texture.id)
      const rgba = surface ? pick(surface, x, y) : null
      hoverSink.current?.(`Texel ${x}, ${y}${rgba && rgba[3] ? ` \u00b7 ${rgbaToHex(rgba).toUpperCase()}` : ' \u00b7 clear'}`)
    },
    [paintTexture, model],
  )

  /** The colours the painted texture uses most, for the Colour panel. */
  const palette = useMemo(() => {
    if (mode !== 'paint' || !paintTexture) return undefined
    const surface = surfaces.current.get(paintTexture.id)
    return surface ? topColours(surface) : undefined
    // the source changes with every stroke, which is when the palette should
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, paintTexture?.id, paintTexture?.source])

  /** Whether moving a face on the UV sheet carries its pixels along, as Blockbench's option does. */
  const [carryPixels, setCarryPixels] = useState(false)
  const uvStart = useRef<Cube | null>(null)
  const uvLast = useRef<Cube | null>(null)

  /* A UV drag on the sheet is one undo step; each move replaces the cube.
     With carry on, a face that moved (and kept its size) takes its pixels
     with it when the drag ends, in the same undo step. */
  const uvDrag = useMemo(
    () => ({
      begin: () => {
        history.begin('move UV')
        uvStart.current = model.cubes.find((c) => c.id === selected) ?? null
        uvLast.current = null
      },
      set: (c: Cube) => {
        uvLast.current = c
        history.amend((m) => ({ ...m, cubes: m.cubes.map((x) => (x.id === c.id ? c : x)) }))
      },
      end: () => {
        const from = uvStart.current
        const to = uvLast.current
        if (carryPixels && from && to) {
          const moves = new Map<string, Array<{ a: UVRect; b: UVRect }>>()
          for (const k of FACES) {
            const tex = from.faces[k].texture
            const a = faceBounds(from.faces[k].uv)
            const b = faceBounds(to.faces[k].uv)
            const same = a[2] - a[0] === b[2] - b[0] && a[3] - a[1] === b[3] - b[1]
            if (!tex || !same || (a[0] === b[0] && a[1] === b[1]) || a[2] <= a[0] || a[3] <= a[1]) continue
            moves.set(tex, [...(moves.get(tex) ?? []), { a, b }])
          }
          for (const [texId, list] of moves) {
            const surface = surfaces.current.get(texId)
            const tex = model.textures.find((t) => t.id === texId)
            if (!surface || !tex) continue
            const [sx, sy] = pixelScale(model, tex)
            const px = (r: UVRect) => [Math.round(r[0] * sx), Math.round(r[1] * sy), Math.round((r[2] - r[0]) * sx), Math.round((r[3] - r[1]) * sy)] as const
            // lift every face first, then clear and set down, so faces that swap places both survive
            const lifted = list.map(({ a, b }) => ({ img: surface.ctx.getImageData(...px(a)), a, b }))
            for (const { a } of lifted) surface.ctx.clearRect(...px(a))
            for (const { img, b } of lifted) surface.ctx.putImageData(img, px(b)[0], px(b)[1])
            const source = toDataUrl(surface)
            encoded.current.set(texId, source)
            history.amend((m) => ({ ...m, textures: m.textures.map((t) => (t.id === texId ? { ...t, source } : t)) }))
          }
        }
        uvStart.current = null
        uvLast.current = null
        history.end()
      },
    }),
    [history, model, selected, carryPixels],
  )

  const onReunwrap = useCallback(() => {
    const ids = selection.filter((id) => model.cubes.some((c) => c.id === id))
    if (!ids.length) return
    const r = reunwrap(model, ids, rescale)
    if (r.model !== model) history.commit('re-unwrap', r.model)
    const names = (list: string[]) => list.map((id) => model.cubes.find((c) => c.id === id)?.name ?? id).join(', ')
    const grew = r.model.resolution.width !== model.resolution.width
    const note = r.failed.length
      ? `No room on the sheet for ${names(r.failed)}, even at a larger size.`
      : grew
        ? `The sheet was full, so it doubled to ${r.model.resolution.width} \u00d7 ${r.model.resolution.height} (the textures scaled with it) and ${names(r.moved)} went in the new room. Paint it there.`
        : r.moved.length
        ? `Moved ${names(r.moved)} to free room on the sheet. Its old pixels stay where they were, so paint it again there.`
        : 'Unwrapped in place.'
    setSaveNote(note)
    window.setTimeout(() => setSaveNote(null), 5000)
  }, [selection, model, rescale, history])

  /* ---------------- textures ---------------- */

  /** Adds textures to the model. The first texture a model gets also goes on every face that had none. */
  const addTextures = useCallback(
    (made: Texture[], label: string) => {
      if (!made.length) return
      history.commit(label, (m) => {
        const first = m.textures.length === 0
        const next = { ...m, textures: [...m.textures, ...made] }
        if (!first) return next
        return {
          ...next,
          cubes: next.cubes.map((c) =>
            FACES.some((k) => c.faces[k].texture === null)
              ? { ...c, faces: Object.fromEntries(FACES.map((k) => [k, c.faces[k].texture === null ? { ...c.faces[k], texture: made[0].id } : c.faces[k]])) as Cube['faces'] }
              : c,
          ),
        }
      })
      setTextureIndex(model.textures.length + made.length - 1)
    },
    [history, model.textures.length],
  )

  const textureInput = useRef<HTMLInputElement>(null)

  /* A PNG of any size is taken as it is and stretched over the model's UV
     sheet, as Blockbench does: a 128px image on a 64-unit sheet is a
     texture at twice the detail. */
  const importTextures = useCallback(
    (files: FileList | File[]) => {
      const list = [...files].filter((f) => f.type === 'image/png' || /\.png$/i.test(f.name))
      if (!list.length) {
        setSaveNote('Only PNG images can be textures.')
        window.setTimeout(() => setSaveNote(null), 4000)
        return
      }
      void Promise.all(
        list.map(
          (file) =>
            new Promise<{ name: string; source: string; width: number; height: number } | null>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => {
                const source = String(reader.result)
                const img = new Image()
                img.onload = () => resolve({ name: file.name, source, width: img.naturalWidth, height: img.naturalHeight })
                img.onerror = () => resolve(null)
                img.src = source
              }
              reader.onerror = () => resolve(null)
              reader.readAsDataURL(file)
            }),
        ),
      ).then((loaded) => {
        const all = loaded.filter((x): x is NonNullable<typeof x> => !!x)
        /* A PNG named like a texture already on the model fills that texture
           in. A Java model's blank textures get their images this way. */
        const byName = new Map(model.textures.map((t) => [t.name.toLowerCase(), t]))
        const fills = all.filter((x) => byName.has(x.name.toLowerCase()))
        if (fills.length) {
          history.commit('replace texture image', (m) => ({
            ...m,
            textures: m.textures.map((t) => {
              const x = fills.find((f) => f.name.toLowerCase() === t.name.toLowerCase())
              return x ? { ...t, source: x.source, width: x.width, height: x.height } : t
            }),
          }))
        }
        const ok = all.filter((x) => !byName.has(x.name.toLowerCase()))
        let names = model
        const made: Texture[] = ok.map((x) => {
          const t: Texture = {
            id: newId(),
            name: freeTextureName(names, x.name),
            width: x.width,
            height: x.height,
            uvWidth: model.resolution.width,
            uvHeight: model.resolution.height,
            source: x.source,
          }
          names = { ...names, textures: [...names.textures, t] }
          return t
        })
        addTextures(made, made.length > 1 ? 'import textures' : 'import texture')
        const { width, height } = model.resolution
        const odd = ok.filter((x) => x.width * height !== x.height * width)
        const failed = loaded.length - all.length
        const note = failed
          ? `${failed} of the files could not be read as images.`
          : odd.length
            ? `${odd.map((x) => x.name).join(', ')} is not the sheet's shape (${width} \u00d7 ${height}), so it is stretched to fit.`
            : null
        if (note) {
          setSaveNote(note)
          window.setTimeout(() => setSaveNote(null), 6000)
        }
      })
    },
    [model, addTextures, history],
  )

  const newTexture = useCallback(() => {
    const { width, height } = model.resolution
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    addTextures(
      [{ id: newId(), name: freeTextureName(model, 'texture'), width, height, uvWidth: width, uvHeight: height, source: canvas.toDataURL('image/png') }],
      'new texture',
    )
  }, [model, addTextures])

  /* ---------------- animation ---------------- */

  /** onion skin: the poses at the keyframes either side of the playhead */
  const ghosts = useMemo(() => {
    if (mode !== 'animate' || !onion || !clip) return undefined
    const times = [...new Set(clip.tracks.flatMap((t) => t.keys.map((k) => k.time)))].sort((a, b) => a - b)
    const before = [...times].reverse().find((t) => t < time - 1e-4)
    const after = times.find((t) => t > time + 1e-4)
    return [
      ...(before !== undefined ? [{ time: before, side: 'before' as const }] : []),
      ...(after !== undefined ? [{ time: after, side: 'after' as const }] : []),
    ]
  }, [mode, onion, clip, time])

  /** A soft two-note tone, the cue for a sound key. Silent until the page has been interacted with. */
  const beep = useCallback(() => {
    try {
      const ctx = (audio.current ??= new AudioContext())
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      gain.connect(ctx.destination)
      for (const [f, at] of [[880, 0], [1320, 0.06]] as const) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, now + at)
        osc.connect(gain)
        osc.start(now + at)
        osc.stop(now + 0.2)
      }
      // counted on the window so the tests can tell a cue played
      ;(window as unknown as { __vellumCues?: number }).__vellumCues = ((window as unknown as { __vellumCues?: number }).__vellumCues ?? 0) + 1
    } catch {
      /* no audio in this browser; the flash still shows */
    }
  }, [])

  /* While a clip plays, an effect whose time the playhead just passed shows
     for a moment in the viewport, so its timing can be checked by eye. */
  const [flash, setFlash] = useState<string | null>(null)
  const lastTime = useRef(time)
  useEffect(() => {
    const prev = lastTime.current
    lastTime.current = time
    if (!playing || mode !== 'animate' || !clip?.events?.length) return
    const passed = clip.events.filter((e) =>
      time >= prev ? e.time > prev && e.time <= time : e.time > prev || e.time <= time,
    )
    if (!passed.length) return
    const e = passed[passed.length - 1]
    const glyph = e.kind === 'sound' ? '\u266a' : e.kind === 'particle' ? '\u2726' : '{}'
    const at = e.locator ? ` at ${(model.nulls ?? []).find((n) => n.id === e.locator)?.name ?? '?'}` : ''
    setFlash(`${glyph} ${e.effect || e.kind}${at}`)
    if (cues && passed.some((x) => x.kind === 'sound')) beep()
    const id = window.setTimeout(() => setFlash(null), 900)
    return () => window.clearTimeout(id)
  }, [time, playing, mode, clip, model.nulls, cues, beep])

  /** the model when a key drag began; each step moves the keys from there */
  const keyDragFrom = useRef<Model | null>(null)

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
      bone: poseTarget,
      setBone: (id) => {
        if ((model.nulls ?? []).some((n) => n.id === id)) setSelection([id])
        else {
          setPickedBone(id)
          if (selectedNull) setSelection([id])
        }
      },
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
        // keep the playhead on a shortened clip
        if (patch.length !== undefined) setTime((t) => Math.min(t, Math.max(0, patch.length!)))
      },
      closeLoop: () => withClip('close the loop', (m, id) => closeLoop(m, id)),
      addKey: (bone, channel) =>
        withClip('add keyframe', (m, id) => setKey(m, id, bone, channel, time)),
      removeKey: (keyId) => {
        withClip('delete keyframe', (m, id) => deleteKey(m, id, keyId))
        setSelectedKeys((ks) => ks.filter((k) => k !== keyId))
      },
      removeTrack: (bone, channel) => {
        withClip('clear channel', (m, id) => deleteTrack(m, id, bone, channel))
        setSelectedKey(null)
      },
      selectedKey,
      selectKey: setSelectedKey,
      selectedKeys,
      selectKeys: (ids, how) => {
        setSelectedEvent(null)
        setSelectedKeys((cur) =>
          how === 'set'
            ? ids
            : how === 'add'
              ? [...cur.filter((k) => !ids.includes(k)), ...ids]
              : [...cur.filter((k) => !ids.includes(k)), ...ids.filter((k) => !cur.includes(k))],
        )
      },
      moveKeys: (dt, phase) => {
        if (!clip) return
        if (phase === 'start') {
          history.begin(selectedKeys.length > 1 ? 'move keyframes' : 'move keyframe')
          keyDragFrom.current = model
          setPlaying(false)
          return
        }
        if (phase === 'end') {
          history.end()
          keyDragFrom.current = null
          return
        }
        const base = keyDragFrom.current
        if (base) history.amend(moveKeys(base, clip.id, new Set(selectedKeys), dt))
      },
      removeKeys: () => {
        if (!selectedKeys.length) return
        withClip(selectedKeys.length > 1 ? 'delete keyframes' : 'delete keyframe', (m, id) => deleteKeys(m, id, new Set(selectedKeys)))
        setSelectedKeys([])
      },
      copyKeys: () => {
        if (!clip) return
        const got = copyKeys(clip, new Set(selectedKeys))
        setSaveNote(got ? `Copied ${got.length} keyframe${got.length === 1 ? '' : 's'}` : 'Select keyframes to copy first.')
        window.setTimeout(() => setSaveNote(null), 1800)
      },
      pasteKeys: () => {
        const items = readKeyClipboard()
        if (!clip || !items) return
        const next = pasteKeys(model, clip.id, items, time, animBone)
        history.commit('paste keyframes', next.model)
        setSelectedKeys(next.ids)
      },
      setEasing: (interp) => withClip('easing', (m, id) => patchKeys(m, id, new Set(selectedKeys), { interp })),
      burst: {
        begin: (label) => {
          setPlaying(false)
          history.begin(label)
        },
        amend: (fn) => history.amend(fn),
        end: () => history.end(),
      },
      onion,
      setOnion,
      cues,
      setCues,
      nulls: model.nulls ?? [],
      events: clip?.events ?? [],
      selectedEvent,
      selectEvent: (id) => {
        setSelectedEvent(id)
        if (id) setSelectedKeys([])
      },
      addEvent: (kindOf) => {
        if (!clip) return
        const effect = kindOf === 'sound' ? 'minecraft:entity.generic.hurt' : kindOf === 'particle' ? 'minecraft:flame' : ''
        const next = addEvent(model, clip.id, { time, kind: kindOf, effect })
        history.commit(`add ${kindOf} effect`, next.model)
        setSelectedEvent(next.id)
        setSelectedKeys([])
      },
      patchEvent: (eventId, patch, transient) =>
        withClip('effect', (m, id) => updateEvent(m, id, eventId, patch), transient !== false),
      removeEvent: (eventId) => {
        withClip('delete effect', (m, id) => deleteEvent(m, id, eventId))
        setSelectedEvent(null)
      },
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
  }, [model, kind, clip, bones, animBone, poseTarget, selectedNull, selectedKey, selectedKeys, selectedEvent, onion, cues, time, history, setSelectedKey])

  /* ---------------- file + edit actions ---------------- */

  const actions = useMemo<Actions>(
    () => ({
      onOpen: () => guarded('Open another model?', 'Discard and open', () => fileInput.current?.click()),
      onSave: () => {
        const doc = { ...model, kind }
        const stem = vellumFileName(fileName).replace(/\.vellum$/i, '')
        if (saveFormat === 'bbmodel') runSave(`${stem}.bbmodel`, toBbmodel(doc), model)
        else runSave(vellumFileName(fileName), writeVellum(doc), model)
      },
      onSaveAs: (format: SaveFormat) => {
        setSaveFormat(format)
        const doc = { ...model, kind }
        const stem = vellumFileName(fileName).replace(/\.vellum$/i, '')
        if (format === 'bbmodel') runSave(`${stem}.bbmodel`, toBbmodel(doc), model)
        else runSave(`${stem}.vellum`, writeVellum(doc), model)
      },
      onSample: (id: string) => {
        const s = sampleById(id)
        guarded(`Open ${s.label}?`, 'Discard and open', () => loadModel(s.model, s.file, s.kind))
      },
      /* New models are made in the library's dialog, so this navigates there.
         The unsaved-changes route guard still applies. */
      onNew: () =>
        navigate(`/projects/${scenes[0].id}/${kind === 'mobs' ? 'mobs' : 'items'}/new`),
      onUndo: history.undo,
      onRedo: history.redo,
      // a new node goes into the selected bone, or the bone that holds the selected cube
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
      // a null object starts at the pivot of the bone it rides on
      // a mesh primitive, standing on the bone it goes in, its faces packed into free room on the sheet
      onAddMesh: (kind: Primitive) => {
        const selMesh = model.meshes?.find((m) => m.id === selected)
        const parent = bones.some((b) => b.id === selected) ? selected : selMesh ? selMesh.parent : ownerBone(model.bones, selected)
        const at = parent ? findBone(model.bones, parent)?.origin ?? [0, 0, 0] : ([0, 0, 0] as Vec3)
        const placed: UVRect[] = []
        let crowded = false
        const mesh = makeMesh(kind, {
          name: freeName(model, kind),
          parent,
          origin: [...at] as Vec3,
          texture: model.textures[0]?.id ?? null,
          place: (w, h) => {
            const spot = findSpot(model, [w, h], placed)
            if (!spot) crowded = true
            const [x, y] = spot ?? [0, 0]
            placed.push([x, y, x + w, y + h])
            return [x, y]
          },
        })
        history.commit(`add ${kind} mesh`, (m) => ({ ...m, meshes: [...(m.meshes ?? []), mesh] }))
        setSelected(mesh.id)
        if (crowded) notify('The sheet had no room for some of its faces, so they share texels at the corner. Grow the sheet or move them in the UV panel.', 7000)
      },
      onAddNull: () => {
        const parent = bones.some((b) => b.id === selected) ? selected : ownerBone(model.bones, selected)
        const at = parent ? findBone(model.bones, parent)?.origin ?? [0, 8, 0] : ([0, 8, 0] as Vec3)
        const taken = new Set((model.nulls ?? []).map((n) => n.name))
        let i = (model.nulls?.length ?? 0) + 1
        while (taken.has(`null_${i}`)) i++
        const item: NullObject = { id: newId(), name: `null_${i}`, parent, position: [...at] as Vec3, visible: true, locked: false }
        history.commit('add null object', (m) => ({ ...m, nulls: [...(m.nulls ?? []), item] }))
        setSelected(item.id)
      },
      onDuplicate: () => {
        // every selected node, a bone with its whole subtree
        let m = model
        const made: string[] = []
        for (const mesh of model.meshes ?? []) {
          if (!selection.includes(mesh.id)) continue
          const copy = { ...structuredClone(mesh), id: newId(), name: freeName(m, mesh.name) }
          m = { ...m, meshes: [...(m.meshes ?? []), copy] }
          made.push(copy.id)
        }
        for (const id of topLevel(model, selection)) {
          const next = bones.some((b) => b.id === id) ? duplicateBone(m, id) : duplicateCube(m, id)
          if (!next) continue
          m = next.model
          made.push(next.id)
        }
        if (!made.length) return
        history.commit(made.length > 1 ? 'duplicate' : bones.some((b) => b.id === selected) ? 'duplicate bone' : 'duplicate cube', m)
        setSelection(made)
      },
      onDelete: () => {
        const meshIds = new Set((model.meshes ?? []).filter((x) => !x.locked).map((x) => x.id))
        if (selection.some((id) => meshIds.has(id))) {
          history.commit('delete mesh', (m) => {
            const left = (m.meshes ?? []).filter((x) => !(meshIds.has(x.id) && selection.includes(x.id)))
            return { ...m, meshes: left.length ? left : undefined }
          })
          if (selection.every((id) => meshIds.has(id))) {
            setSelection([])
            return
          }
        }
        const nullIds = new Set((model.nulls ?? []).map((n) => n.id))
        if (selection.some((id) => nullIds.has(id))) {
          for (const id of selection) if (nullIds.has(id)) removeNull(id)
          if (selection.every((id) => nullIds.has(id))) return
        }
        if (selection.length > 1) {
          const ids = topLevel(model, selection)
          if (!ids.length) {
            refuseLocked('The selection')
            return
          }
          let m = model
          for (const id of ids) m = bones.some((b) => b.id === id) ? deleteBone(m, id) : deleteCube(m, id)
          history.commit('delete', rehomeNulls(m))
          setSelection([])
          return
        }
        if (!selected) return
        const isBone = bones.some((b) => b.id === selected)
        /* After an undo the selection can name a node the model doesn't
           have. Committing a no-op delete would still clear the redo branch. */
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
        // deleting a bone deletes everything under it
        const next = isBone ? rehomeNulls(deleteBone(model, selected)) : deleteCube(model, selected)
        if (next === model) return
        history.commit(isBone ? 'delete bone' : 'delete cube', next)
        setSelected(next.cubes[0]?.id ?? null)
      },
      onQuad: () => setQuad((q) => !q),
      onGrid: () => setGrid((g) => !g),
      onCubeToMesh: () => {
        const ids = selection.filter((id) => model.cubes.some((c) => c.id === id && !c.locked))
        if (!ids.length) return notify('Pick a cube to convert first.', 2500)
        let next = model
        const made: string[] = []
        for (const id of ids) {
          const cube = next.cubes.find((c) => c.id === id)!
          const mesh = cubeToMesh(cube, ownerBone(next.bones, id))
          next = { ...deleteCube(next, id), meshes: [...(next.meshes ?? []), mesh] }
          made.push(mesh.id)
        }
        history.commit(ids.length === 1 ? 'convert to mesh' : 'convert to meshes', next)
        setSelection(made)
      },
      // from a menu, the grab starts where the pointer is once it's back over the view
      onGrab: () => startGrab(),
      onSelectAll: () => setSelection(model.cubes.filter((c) => c.visible).map((c) => c.id)),
      onCopy: () => {
        const got = copyNodes(model, selection)
        setSaveNote(got ? `Copied ${got.roots.length} ${got.roots.length === 1 ? 'node' : 'nodes'}` : 'Nothing selected to copy.')
        window.setTimeout(() => setSaveNote(null), 1800)
      },
      onCut: () => {
        const ids = topLevel(model, selection)
        if (!copyNodes(model, ids)) return
        let m = model
        for (const id of ids) m = bones.some((b) => b.id === id) ? deleteBone(m, id) : deleteCube(m, id)
        history.commit('cut', rehomeNulls(m))
        setSelection([])
      },
      onPaste: () => {
        const clip = readClipboard()
        if (!clip) {
          setSaveNote('Copy something first (Ctrl C).')
          window.setTimeout(() => setSaveNote(null), 1800)
          return
        }
        const parent = bones.some((b) => b.id === selected) ? selected : ownerBone(model.bones, selected)
        const next = pasteNodes(model, clip, parent)
        history.commit('paste', next.model)
        setSelection(next.ids)
      },
      onGroup: () => {
        const next = groupNodes(model, selection)
        if (!next) return
        history.commit('group', next.model)
        setSelection([next.id])
        setPickedBone(next.id)
      },
      onFlip: (axis, centreLine) => {
        // a block or an item is centred on 8, a mob on 0
        const about = centreLine ? (kind === 'mobs' ? 0 : 8) : undefined
        const next = flipNodes(model, selection, axis, about)
        if (next !== model) history.commit(centreLine ? `mirror ${'XYZ'[axis]}` : `flip ${'XYZ'[axis]}`, next)
      },
      onView: (yaw, pitch) => viewApi.current?.setView(yaw, pitch),
      onOrtho: () => setOrtho((o) => !o),
      onFocus: () => focusOn(selection),
      onFrameAll: () => focusOn([]),
      onHide: () => {
        const ids = new Set(selection)
        if (!ids.size) return
        history.commit('hide', (m) => ({
          ...m,
          cubes: m.cubes.map((c) => (ids.has(c.id) ? { ...c, visible: false } : c)),
          bones: m.bones.map(function show(b): Bone {
            return { ...(ids.has(b.id) ? { ...b, visible: false } : b), children: b.children.map((c) => (c.kind === 'bone' ? { kind: 'bone' as const, bone: show(c.bone) } : c)) }
          }),
        }))
      },
      onShowAll: () =>
        history.commit('show all', (m) => ({
          ...m,
          cubes: m.cubes.map((c) => (c.visible ? c : { ...c, visible: true })),
          bones: m.bones.map(function show(b): Bone {
            return { ...b, visible: true, children: b.children.map((c) => (c.kind === 'bone' ? { kind: 'bone' as const, bone: show(c.bone) } : c)) }
          }),
        })),
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
      onExportGltf: () => {
        const stem = fileName.replace(/\.vellum$/i, '') || 'model'
        void saveBlob(`${stem}.gltf`, new Blob([toGltf(model)], { type: 'model/gltf+json' })).then(notify)
      },
      onExportObj: () => {
        const stem = fileName.replace(/\.vellum$/i, '') || 'model'
        void saveBlob(`${stem}-obj.zip`, new Blob([toObjZip(model) as BlobPart], { type: 'application/zip' })).then(notify)
      },
      onExportJava: () => {
        const out = toJavaJson(model, kind === 'blocks' ? 'block' : 'item')
        void saveFile(out.name, out.text).then((note) =>
          notify(out.issues.length ? `${note} ${out.issues.length} thing${out.issues.length === 1 ? '' : 's'} could not be said exactly in Java JSON; the Validation panel lists them.` : note),
        )
      },
      onNewClip: () => anim.newClip(),
      onDuplicateClip: () => anim.duplicateClip(),
      onDeleteClip: () => anim.removeClip(),
      onAddKey: () => animBone && anim.addKey(animBone, 'rotation'),
      onCloseLoop: () => anim.closeLoop(),
    }),
    [model, fileName, kind, saveFormat, startGrab, textureIndex, loadModel, runSave, selected, selection, bones, history, anim, animBone, guarded, rescale, refuseLocked, setSelected, focusOn, removeNull],
  )

  const [keymap, setKeymap] = useState<Keymap>(readKeymap)
  const chooseKeymap = useCallback(
    (k: Keymap) => {
      setKeymap(k)
      try {
        localStorage.setItem(KEYMAP_STORE, k)
      } catch {
        /* kept for this visit only */
      }
      notify(k === 'blender' ? 'Blender keys: G grab, R rotate, S scale, X delete, A select all, Alt+A none, Shift+D duplicate, Shift+A add cube, I key.' : 'Blockbench keys: V move, S resize, R rotate, P pivot, X vertex snap, K key.', 8000)
    },
    [notify],
  )

  const menus = useMemo(
    () => buildMenus(actions, { undoLabel: history.undoLabel, redoLabel: history.redoLabel, hasClip: !!clip, keymap, onKeymap: chooseKeymap }),
    [actions, history.undoLabel, history.redoLabel, clip, keymap, chooseKeymap],
  )

  // keyboard shortcuts; all but Ctrl+S are ignored while a field has focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      const mod = e.ctrlKey || e.metaKey

      // Ctrl+S also works in a field; letting it through would open the browser's Save Page dialog
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        actions.onSave()
        return
      }
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
        // in Animate mode this duplicates the clip
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

      /* Numpad views, as in Blender and Blockbench. Ctrl looks from the opposite side. */
      const views: Record<string, [number, number, number, number]> = {
        Numpad1: [0, 0, 180, 0],
        Numpad3: [-90, 0, 90, 0],
        Numpad7: [0, -90, 0, 90],
      }
      if (views[e.code]) {
        e.preventDefault()
        const [y, p, y2, p2] = views[e.code]
        if (mod) actions.onView(y2, p2)
        else actions.onView(y, p)
        return
      }
      if (e.code === 'Numpad5') {
        e.preventDefault()
        actions.onOrtho()
        return
      }
      if (e.code === 'NumpadDecimal') {
        e.preventDefault()
        actions.onFocus()
        return
      }

      const editing = mode === 'edit'
      /* A selected mesh: 1, 2 and 3 pick Object, Face or Vertex; in Face and
         Vertex, E extrudes, M merges, Shift+F flips, Del deletes and Ctrl+A
         picks everything. */
      if (editing && selectedMesh && !e.altKey) {
        const k = e.key.toLowerCase()
        const run = (fn: () => void) => {
          e.preventDefault()
          fn()
        }
        // while the knife cuts, Enter makes the cut and Esc drops it
        if (knife !== null && (e.key === 'Enter' || e.key === 'Escape')) return run(e.key === 'Enter' ? meshOps.knife : () => setKnife(null))
        if (!mod && ['1', '2', '3', '4'].includes(k)) return run(() => setMeshMode(MESH_MODES[Number(k) - 1]))
        if (!mod && k === 'k' && knife === null) return run(meshOps.knife)
        if (mod && k === 'j') return run(meshOps.join)
        if (!mod && k === 'p' && meshMode === 'face') return run(meshOps.separate)
        if (meshMode !== 'object') {
          if (mod && k === 'r' && meshMode === 'edge') return run(meshOps.loopCut)
          if (mod && k === 'b' && (meshMode === 'edge' || meshMode === 'vertex')) return run(meshOps.bevel)
          if (!mod && k === 'i' && meshMode === 'face') return run(meshOps.inset)
          // F fills between the picked vertices or edges; with too few picked it still frames the view
          if (!mod && k === 'f' && ((meshMode === 'vertex' && meshVerts.length >= 3) || (meshMode === 'edge' && meshEdges.length >= 2))) return run(meshOps.fill)
          if (mod && k === 'a') return run(meshOps.selectAll)
          if (!mod && k === 'e' && meshMode === 'face') return run(meshOps.extrude)
          if (!mod && k === 'm' && meshMode === 'vertex') return run(meshOps.merge)
          if (!mod && k === 'f' && e.shiftKey && meshMode === 'face') return run(meshOps.flip)
          if (e.key === 'Delete' || e.key === 'Backspace') return run(meshOps.remove)
          if (e.key === 'Escape') return run(() => (meshMode === 'face' ? setMeshFaces([]) : meshMode === 'edge' ? setMeshEdges([]) : setMeshVerts([])))
        }
      }
      // in Animate, Ctrl C and Ctrl V copy and paste keyframes
      if (mod && mode === 'animate') {
        const k = e.key.toLowerCase()
        if (k === 'c') {
          e.preventDefault()
          anim.copyKeys()
          return
        }
        if (k === 'v') {
          e.preventDefault()
          anim.pasteKeys()
          return
        }
        if (k === 'a' && clip) {
          e.preventDefault()
          anim.selectKeys(clip.tracks.flatMap((t) => t.keys.map((x) => x.id)), 'set')
          return
        }
      }
      if (mod && editing) {
        const k = e.key.toLowerCase()
        const run: Record<string, () => void> = {
          a: actions.onSelectAll,
          c: actions.onCopy,
          x: actions.onCut,
          v: actions.onPaste,
          g: actions.onGroup,
        }
        if (run[k]) {
          e.preventDefault()
          run[k]()
          return
        }
      }
      if (mod) return

      if (e.key === 'F2' && selected) {
        e.preventDefault()
        setRenameRequest((r) => ({ id: selected, n: (r?.n ?? 0) + 1 }))
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        actions.onFrameAll()
        return
      }
      if (e.key === 'Escape' && (mode === 'edit' || mode === 'animate')) {
        if (vertexFrom !== null) setVertexFrom(null)
        // keys first, as in Blockbench; a second Esc clears the outliner
        else if (mode === 'animate' && anim.selectedKeys.length) anim.selectKeys([], 'set')
        else setSelection([])
        return
      }

      /* Blender's keys, when chosen: G grab, X delete, A and Alt+A select all
         and none, Shift+D duplicate, Shift+A add, I insert a key. R and S
         already match; the numpad views and H are shared. */
      if (keymap === 'blender' && (mode === 'edit' || mode === 'animate')) {
        const k = e.key.toLowerCase()
        const run = (fn: () => void) => {
          e.preventDefault()
          fn()
        }
        if (k === 'g' && !e.shiftKey && !e.altKey) return run(startGrab)
        if (k === 'x' && !e.shiftKey && !e.altKey)
          return run(() => (mode === 'animate' && anim.selectedKeys.length ? anim.removeKeys() : editing ? actions.onDelete() : undefined))
        if (k === 'a' && e.altKey) return run(() => (mode === 'animate' ? anim.selectKeys([], 'set') : setSelection([])))
        if (k === 'a' && e.shiftKey && editing) return run(actions.onAddCube)
        if (k === 'a' && !e.shiftKey)
          return run(() => (mode === 'animate' && clip ? anim.selectKeys(clip.tracks.flatMap((t) => t.keys.map((x) => x.id)), 'set') : actions.onSelectAll()))
        if (k === 'd' && e.shiftKey) return run(() => (mode === 'animate' ? anim.duplicateClip() : actions.onDuplicate()))
        if (k === 'i' && mode === 'animate') return run(actions.onAddKey)
      }

      /* tool keys, Blockbench's: V move, S resize (scale when posing), R rotate, P pivot, X vertex snap;
         in Paint B brush, E eraser, F fill, C colour picker, U shape */
      const toolKey = toolsets[mode].find((t) => t.key && t.key.toLowerCase() === e.key.toLowerCase() && !e.altKey)
      if (toolKey) {
        e.preventDefault()
        setTool(toolKey.id)
        setVertexFrom(null)
        return
      }
      if ((mode === 'edit' || mode === 'animate') && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 'f') {
          e.preventDefault()
          actions.onFocus()
          return
        }
        if (k === 'b') {
          e.preventDefault()
          viewApi.current?.armBox()
          setSaveNote('Drag a box to select (Shift adds)')
          window.setTimeout(() => setSaveNote(null), 1800)
          return
        }
        if (k === 't') {
          e.preventDefault()
          setSpace((v) => (v === 'global' ? 'local' : 'global'))
          return
        }
      }
      if (editing && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        if (e.altKey) actions.onShowAll()
        else actions.onHide()
        return
      }

      /* Delete acts on what the mode edits: the selected keyframe in
         Animate, the selected node in Edit, nothing in other modes. */
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (mode === 'animate') {
          if (selectedEvent) anim.removeEvent(selectedEvent)
          else if (selectedKeys.length) anim.removeKeys()
          else if (selectedNull) actions.onDelete()
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
      // G shows and hides the grid; Shift+G grabs, Blockbench's keys having no G of their own for it
      if (e.key.toLowerCase() === 'g' && e.shiftKey && !mod && (mode === 'edit' || mode === 'animate')) {
        e.preventDefault()
        startGrab()
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
  }, [history, actions, anim, mode, selectedKey, selectedKeys, selectedEvent, selectedNull, animBone, selected, vertexFrom, clip, notify, keymap, selectedMesh, meshMode, meshOps, knife, meshVerts, meshEdges, startGrab])

  /* .vellum opens as it is. A Blockbench project or a Java model is
     converted on the way in and saves as a .vellum; what did not carry
     over is said in the status bar. */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      if (isVellum(text)) {
        loadModel(readVellum(text), file.name, kind)
      } else if (isBbmodel(text) || /\.bbmodel$/i.test(file.name)) {
        const got = fromBbmodel(text, file.name)
        loadModel(got.model, file.name, got.kind)
        notify(`Opened ${file.name} from Blockbench. It saves as ${vellumFileName(file.name)}.${got.notes.length ? ' ' + got.notes.join(' ') : ''}`, 12000)
      } else if (isJavaModel(text)) {
        const got = fromJavaModel(text, file.name)
        loadModel(got.model, file.name, got.kind)
        notify(`Opened ${file.name} as a Java model.${got.notes.length ? ' ' + got.notes.join(' ') : ''}`, 12000)
      } else {
        throw new Error(`${file.name} is not a model Vellum can open: it takes .vellum, Blockbench .bbmodel and Java block or item JSON.`)
      }
      setOpenError(null)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'That file could not be read as a model.')
    }
    e.target.value = ''
  }

  const onLeft = useCallback((dx: number) => setLeftW((w) => Math.min(460, Math.max(210, w + dx))), [])
  const onRight = useCallback((dx: number) => setRightW((w) => Math.min(460, Math.max(210, w - dx))), [])

  // longest side of the model's bounding box, for fitting it to the viewport
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
      className={`editor-root editor-root--studio${grab ? " is-grabbing" : ""}`}
      data-swap={mode === 'edit' || mode === 'paint' || mode === 'animate' || undefined}
      // the generated config covers the viewport, so its controls step aside
      data-cover={(mode === 'config' && hasConfig(kind)) || (mode === 'paint' && paintView === 'sheet') || undefined}
      style={{ ['--left-w' as string]: `${leftW}px`, ['--right-w' as string]: `${rightW}px` }}
    >
      <input ref={fileInput} type="file" accept=".vellum,.bbmodel,.json,application/json" hidden onChange={onFile} />

      <EditorBar
        title={model.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        subtitle={[kind === 'mobs' ? 'Mob' : kind === 'blocks' ? 'Block' : 'Item', subtype ? subtype[0].toUpperCase() + subtype.slice(1) : null, fileName].filter(Boolean).join(' \u00b7 ')}
        dirty={dirty}
        kind={kind}
        mode={mode}
        onMode={setMode}
        menus={menus}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        undoLabel={history.undoLabel}
        redoLabel={history.redoLabel}
        problems={errors + warnings}
        onProblems={() => {
          setShowProblems((n) => n + 1)
          window.setTimeout(() => document.getElementById('validation')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
        }}
        onSave={actions.onSave}
        saveFormat={saveFormat}
        onSaveAs={actions.onSaveAs}
      />

      {/* the h1 is visually hidden (.vh) and names the page for screen readers */}
      <main className="editor-body">
        <h1 className="visually-hidden">
          {fileName} {'\u2014'} {kind} model, {mode} mode
        </h1>
        <Viewport
          onPaintMesh={mode === 'paint' && paintView === 'model' ? paintOnMesh : undefined}
          meshPick={mode === 'edit' && selectedMesh ? { mesh: selectedMesh.id, faces: new Set(meshMode === 'face' ? meshFaces : []), onFace: meshMode === 'face' ? pickFace : undefined } : null}
          model={model}
          label={kind}
          grid={grid}
          quad={quad}
          extent={extent}
          clip={mode === 'animate' ? clip : mode === 'behaviour' ? bhvClip : null}
          time={mode === 'behaviour' ? bhvClipTime : time}
          selected={selected}
          selection={selection}
          onSelect={selectNode}
          onDeselect={() => {
            setSelected(null)
            setVertexFrom(null)
          }}
          onPaint={mode === 'paint' ? paintOnModel : undefined}
          display={mode === 'display' && kind !== 'mobs' ? displayState[slot] : null}
          gizmo={gizmo}
          onGizmo={onGizmo}
          snapStep={increment}
          ortho={ortho}
          onOrtho={setOrtho}
          viewRef={viewApi}
          onBoxSelect={(ids, addTo) => setSelection((cur) => (addTo ? [...cur.filter((x) => !ids.includes(x)), ...ids] : ids))}
          vertices={vertices}
          hint={grabHint ?? (mode === 'edit' || mode === 'animate' ? TOOL_HINTS[tool] ?? null : null)}
          guide={grab && !grab.slide && !grab.plane ? grab.axis : null}
          ghosts={ghosts}
          showNulls={mode === 'edit' || mode === 'animate'}
          flash={flash}
          view={viewPreset}
          onViewPreset={(v) => {
            setViewPreset(v)
            const at = { Perspective: [-32, -18], Front: [0, 0], Side: [-90, 0], Top: [0, -90] }[v]
            setOrtho(v !== 'Perspective')
            viewApi.current?.setView(at[0], at[1])
          }}
          dock={
            mode === 'edit' || mode === 'animate' ? (
              <ToolDock
                // resize and vertex snap are for cubes, so a selected mesh's dock leaves them out for its modes
                tools={toolsets[mode]
                  .filter((t) => !(mode === 'edit' && selectedMesh && (t.id === 'vertex' || t.id === (meshMode === 'object' ? 'resize' : 'pivot'))))
                  // on a mesh's pick, resize scales it
                  .map((t) => ({ ...t, key: keyFor(keymap, t.id, t.key), ...(mode === 'edit' && selectedMesh && t.id === 'resize' ? { label: 'Scale tool' } : {}) }))}
                tool={tool}
                onTool={(id) => {
                  setTool(id)
                  setVertexFrom(null)
                }}
                extra={
                  mode === 'edit' && selectedMesh ? (
                    <span className="dock__modes" role="group" aria-label="Mesh selection">
                      {MESH_MODES.map((m, i) => (
                        <button key={m} className="dock__tool" aria-pressed={meshMode === m} title={`${m[0].toUpperCase() + m.slice(1)} (${i + 1})`} onClick={() => setMeshMode(m)}>
                          <span>{m[0].toUpperCase() + m.slice(1)}</span>
                          <kbd>{i + 1}</kbd>
                        </button>
                      ))}
                    </span>
                  ) : null
                }
              />
            ) : null
          }
          controls={
            <>
              {mode === 'edit' || mode === 'animate' ? (
                <>
                  <button className="studio-chip" onClick={() => setSpace((v) => (v === 'global' ? 'local' : 'global'))} title="Transform space: Global moves along the world axes, Local along the selection's own (T)">
                    {space === 'global' ? 'Global' : 'Local'}
                  </button>
                  <label className="studio-chip" title="Grid snap. Hold Shift for a quarter of it, Ctrl to move freely.">
                    <Icon name="magnet" size={12} /> Snap
                    <select value={increment} onChange={(e) => setIncrement(Number(e.target.value))} aria-label="Snap increment">
                      {[1, 0.5, 0.25, 0.125, 0.0625].map((n) => (
                        <option key={n} value={n}>
                          {n === 0.0625 ? '1/16' : n === 0.125 ? '1/8' : String(n)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <button className="studio-chip studio-chip--icon" aria-pressed={grid} onClick={() => setGrid((g) => !g)} title="Grid (G)" aria-label="Grid">
                <Icon name="grid" size={13} />
              </button>
              <button className="studio-chip studio-chip--icon" aria-pressed={quad} onClick={() => setQuad((q) => !q)} title="Four views (Ctrl 4)" aria-label="Four views">
                <Icon name="layers" size={13} />
              </button>
            </>
          }
        />

        <div className="editor-rails">
          <div className="editor-column editor-column--left">
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
            ) : mode === 'paint' ? (
              <>
                <Panel title="Painting on" count={cube ? undefined : 'nothing'}>
                  {cube ? (
                    <>
                      <p className="paint-on__name">{cube.name}</p>
                      <div className="paint-on__faces" role="group" aria-label="Face to paint">
                        {FACES.map((k) => (
                          <button key={k} className="chip" aria-pressed={k === face} onClick={() => setFace(k)}>
                            {k}
                          </button>
                        ))}
                      </div>
                      <p className="editor-hint">Click a face on the sheet, or pick a cube in the outliner, to paint it.</p>
                    </>
                  ) : (
                    <p className="editor-hint">Pick a cube in the viewport or the outliner to paint its faces.</p>
                  )}
                </Panel>
                <Panel title="On the model">
                  <div className="paint-preview">
                    <ModelView model={model} scale={Math.max(1, Math.min(10, 120 / extent))} grid={false} orbit zoomable={false} initialYaw={-32} initialPitch={-18} anchorAt="centre" selected={selected} />
                  </div>
                  <p className="editor-hint">Updates as you paint. Drag it to turn it.</p>
                </Panel>
              </>
            ) : mode === 'animate' ? (
              <>
                {selectedEvent ? (
                  <Panel title="Effect" count={anim.events.find((e) => e.id === selectedEvent)?.kind}>
                    <EventPanel anim={anim} />
                  </Panel>
                ) : (
                  <Panel title="Keyframe" count={selectedKeys.length > 1 ? `${selectedKeys.length} selected` : selectedKey ? 'selected' : undefined}>
                    <KeyframePanel anim={anim} />
                  </Panel>
                )}
                {selectedNull ? (
                  <Panel title="Null object" count={selectedNull.name}>
                    <NullPanel item={selectedNull} bones={bones} snap={snap} onChange={(patch) => editNull(selectedNull.id, patch)} onDelete={() => removeNull(selectedNull.id)} />
                  </Panel>
                ) : null}
              </>
            ) : selectedNull ? (
              <Panel title="Null object" count={selectedNull.name}>
                <NullPanel item={selectedNull} bones={bones} snap={snap} onChange={(patch) => editNull(selectedNull.id, patch)} onDelete={() => removeNull(selectedNull.id)} />
              </Panel>
            ) : selectedMesh ? (
              <Panel title="Mesh" count={`${Object.keys(selectedMesh.vertices).length} vertices \u00b7 ${Object.keys(selectedMesh.faces).length} faces`}>
                <MeshPanel
                  mesh={selectedMesh}
                  model={model}
                  bones={bones}
                  snap={snap}
                  mode={meshMode}
                  onMode={setMeshMode}
                  picked={meshPicked}
                  keys={meshKeys}
                  ops={meshOps}
                  onEdit={editMesh}
                  onRename={(name) => rename(selectedMesh.id, name)}
                  onMove={(bone) => move(selectedMesh.id, bone)}
                  onDelete={actions.onDelete}
                  pickedFaces={meshMode === 'face' ? meshFaces : []}
                  amount={meshAmount}
                  onAmount={setMeshAmount}
                  segments={meshSegments}
                  onSegments={setMeshSegments}
                  distance={mergeDistance}
                  onDistance={setMergeDistance}
                  joinable={selection.filter((id) => id !== selectedMesh.id && (model.meshes ?? []).some((x) => x.id === id)).length}
                  knife={knife === null ? null : knife.length}
                  onKnifeCancel={() => setKnife(null)}
                />
              </Panel>
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
                <CubePanel
                  cube={cube}
                  kind={kind}
                  onChange={editCube}
                  snap={snap}
                  model={model}
                  parent={cube ? ownerBone(model.bones, cube.id) : null}
                  bones={bones}
                  onRename={(name) => cube && rename(cube.id, name)}
                  onMove={(bone) => cube && move(cube.id, bone)}
                  onDelete={actions.onDelete}
                  onToMesh={actions.onCubeToMesh}
                />
              </Panel>
            )}

            {/* A separate panel because Validation stays collapsed on a clean
                model, and a mob that just became unhittable passes every other
                check. The count shows the mode so it reads with the panel shut. */}
            {hit && mode !== 'paint' ? (
              <Panel
                title="Where it can be hit"
                count={
                  hit.mode === 'explicit'
                    ? `${hit.regions.length} marked`
                    : hit.mode === 'derived'
                      ? `${hit.regions.length} bones`
                      : 'nothing'
                }
                defaultOpen={hit.mode !== 'derived'}
                /* Opens when the rig turns explicit, which is usually an
                   accident. It can still be closed afterwards. */
                forceOpen={hit.mode === 'explicit'}
              >
                <p className="editor-hint" data-warn={hit.mode !== 'derived' || undefined}>
                  <Icon name={hit.mode === 'derived' ? 'check' : 'warning'} size={11} /> {modeLine(hit)}
                </p>
                {hit.mode === 'explicit' ? (
                  <ul className="editor-issues">
                    <li data-level="warning">
                      <Icon name="warning" size={11} />A bone that draws nothing but holds a hidden cube
                      becomes a marked region. Hiding a cube for any reason can do this.
                    </li>
                    {hit.lost.slice(0, 8).map((l) => (
                      <li key={l.boneId} data-level="warning">
                        <Icon name="warning" size={11} />
                        <strong className="editor-translate__where">{l.boneName}</strong>
                        is drawn but cannot be hit
                      </li>
                    ))}
                  </ul>
                ) : null}
                {hit.unknowns.length ? (
                  <ul className="editor-issues">
                    {hit.unknowns.map((u, n) => (
                      <li key={n} data-level="warning">
                        <Icon name="warning" size={11} />
                        {u}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}

            {mode === 'paint' ? null : selectedMesh ? (
            <Panel title="UV" count={`${model.resolution.width} × ${model.resolution.height}`}>
              <MeshUvPanel
                model={model}
                mesh={selectedMesh}
                picked={meshFaces}
                onPick={(k, mods) => {
                  if (meshMode !== 'face') setMeshMode('face')
                  pickFace(k, mods)
                }}
                onDrag={meshUvDrag}
                onUnwrap={onUnwrapMesh}
                onTurn={() => editMesh('turn UVs', (m) => turnFacesUv(m, meshFaces))}
                onMirror={(axis) => editMesh('mirror UVs', (m) => mirrorFacesUv(m, meshFaces, axis))}
              />
            </Panel>
            ) : (
            <Panel title="UV" count={`${model.resolution.width} × ${model.resolution.height}`}>
              <UVPanel
                model={model}
                cube={cube}
                face={face}
                onFace={setFace}
                onChange={editCube}
                onDrag={uvDrag}
                fallbackTexture={sheetTexture}
                onReunwrap={onReunwrap}
                carry={carryPixels}
                onCarry={setCarryPixels}
              />
            </Panel>
            )}

            <Panel title="History" count={history.pastLabels.length || undefined} defaultOpen={false}>
              <ol className="hist" aria-label="Undo history">
                {/* oldest at the top, as in Blockbench; a click jumps to that point */}
                <li>
                  <button className="hist__row" aria-current={history.pastLabels.length === 0 || undefined} onClick={() => history.jump(-history.pastLabels.length)}>
                    Opened {fileName}
                  </button>
                </li>
                {history.pastLabels.map((label, i) => (
                  <li key={`p${i}`}>
                    <button
                      className="hist__row"
                      aria-current={i === history.pastLabels.length - 1 || undefined}
                      onClick={() => history.jump(i + 1 - history.pastLabels.length)}
                    >
                      {label[0].toUpperCase() + label.slice(1)}
                    </button>
                  </li>
                ))}
                {history.futureLabels.map((label, i) => (
                  <li key={`f${i}`}>
                    <button className="hist__row hist__row--undone" onClick={() => history.jump(i + 1)} title="Undone. Click to redo up to here.">
                      {label[0].toUpperCase() + label.slice(1)}
                    </button>
                  </li>
                ))}
              </ol>
            </Panel>

            <div id="validation" />
            <Panel
              title="Validation"
              count={errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'clean'}
              defaultOpen={errors > 0 || warnings > 0 || !!openError}
              // defaultOpen is read only at mount, and a refused file comes later
              forceOpen={!!openError || showProblems > 0}
              key={`validation${showProblems}`}
            >
              {openError ? (
                <p className="editor-hint editor-hint--warn" style={{ marginBottom: 10 }}>
                  <Icon name="warning" size={11} /> {openError}
                </p>
              ) : null}
              {issues.length ? (
                <ul className="editor-issues">
                  {issues.slice(0, 12).map((i, n) => (
                    <li key={n} data-level={i.level}>
                      <Icon name={i.level === 'error' ? 'warning' : 'info'} size={11} />
                      {i.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="editor-hint">
                  <Icon name="check" size={11} /> No problems. Every cube in bounds.
                </p>
              )}

              {/* whether a resource pack can express the model, separate from the checks above */}
              <div className="editor-translate">
                <div className="editor-translate__head">
                  <Icon name="cube" size={11} />
                  In a resource pack
                  <span className="editor-translate__count mono">
                    {translate.filter((i) => i.level !== 'note').length || 'exact'}
                  </span>
                </div>
                {translate.length ? (
                  <ul className="editor-issues">
                    {translate.slice(0, 10).map((i, n) => (
                      <li key={n} data-level={i.level}>
                        <Icon
                          name={i.level === 'error' ? 'warning' : i.level === 'warning' ? 'warning' : 'info'}
                          size={11}
                        />
                        {i.where ? <strong className="editor-translate__where">{i.where}</strong> : null}
                        {i.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="editor-hint">
                    <Icon name="check" size={11} /> Translates exactly.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          <Splitter onDrag={onLeft} />
          {/* The middle column is normally empty so the viewport shows
              through. Config mode fills it with the generated config. */}
          <div className="editor-rails__gap">
            {mode === 'config' && hasConfig(kind) ? (
              <ConfigOutput id={model.name} kind={kind} config={config} />
            ) : mode === 'paint' && paintView === 'sheet' ? (
              <PaintSheet
                model={model}
                texture={paintTexture}
                onTexture={setPaintPick}
                cube={cube}
                mesh={selectedMesh}
                face={face}
                onPaint={paintOnSheet}
                onHover={hoverSheet}
              />
            ) : null}
          </div>
          <Splitter onDrag={onRight} />

          <div className="editor-column editor-column--right">
            {mode === 'paint' ? (
              <>
                <Panel title="Tools" count={toolsets.paint.find((t) => t.id === tool)?.label}>
                  <PaintTools
                    tool={tool}
                    onTool={setTool}
                    brush={brush}
                    onBrush={setBrush}
                    shape={shape}
                    onShape={setShape}
                    shapeFilled={shapeFilled}
                    onShapeFilled={setShapeFilled}
                    view={paintView}
                    onView={setPaintView}
                    keepInside={keepInside}
                    onKeepInside={setKeepInside}
                    opacity={opacity}
                    onOpacity={setOpacity}
                    mirror={mirrorPaint}
                    onMirror={setMirrorPaint}
                  />
                </Panel>
                <Panel title="Colour">
                  <ColorPanel colour={colour} onColour={setColour} palette={palette} />
                </Panel>
              </>
            ) : null}
            {mode === 'animate' ? (
              <>
                <Panel
                  title="Clips"
                  actions={
                    <span className="outliner-add">
                      <button onClick={anim.newClip} title="Create another animation">+ Clip</button>
                    </span>
                  }
                >
                  <AnimationPanel anim={anim} />
                </Panel>
                {anim.kind === 'mobs' && clip ? (
                  <Panel title="Auto-animate" defaultOpen={false}>
                    <AutoAnimate anim={anim} />
                  </Panel>
                ) : null}
              </>
            ) : null}

            {mode === 'paint' ? null : (
            <Panel
              title="Outliner"
              actions={
                mode === 'edit' ? (
                  <span className="outliner-add">
                    <button onClick={actions.onAddCube} title="Add a cube to the selected bone">+ Cube</button>
                    <button onClick={actions.onAddBone} title="Add a bone">+ Bone</button>
                    <span className="mesh-add">
                      <button aria-expanded={meshMenu} aria-haspopup="menu" onClick={() => setMeshMenu((v) => !v)} title="Add a null object or a free-form mesh">
                        + More
                      </button>
                      {meshMenu ? (
                        <span className="mesh-add__menu" role="menu">
                          <button
                            role="menuitem"
                            title="A point on a bone, for effects and as an IK target"
                            onClick={() => {
                              setMeshMenu(false)
                              actions.onAddNull()
                            }}
                          >
                            Null object
                          </button>
                          <span className="mesh-add__label">Mesh</span>
                          {PRIMITIVES.map((p) => (
                            <button
                              key={p.id}
                              role="menuitem"
                              onClick={() => {
                                setMeshMenu(false)
                                actions.onAddMesh(p.id)
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : null
              }
              count={mode === 'edit' ? undefined : `${model.cubes.length} cubes`}
              grow
            >
              <Outliner
                model={model}
                selection={selection}
                collapsed={collapsed}
                onSelect={selectNode}
                renameRequest={renameRequest}
                onPlace={(id, beside, after) =>
                  history.commit('reorder', (m) => {
                    // a node dropped beside one in another bone moves into that bone first
                    const r = buildRig(m)
                    const parent = r.cubeOwner.get(beside) ?? r.boneParent.get(beside) ?? null
                    const here = r.cubeOwner.get(id) ?? r.boneParent.get(id) ?? null
                    const moved = parent !== here ? reparent(m, id, parent) : m
                    return reorderNode(moved, id, beside, after)
                  })
                }
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
              <NullList nulls={model.nulls ?? []} selection={selection} onSelect={selectNode} />
              {mode === 'edit' ? (
                <p className="outliner-foot">Drag a row onto a bone to move it there. Del removes the selection and F2 renames it.</p>
              ) : null}
            </Panel>
            )}

            <Panel
              title="Textures"
              count={model.textures.length}
              actions={
                <span className="outliner-add">
                  <button onClick={newTexture} title="A new transparent texture the size of the UV sheet">+ New</button>
                  <button onClick={() => textureInput.current?.click()} title="Import PNG images as textures (or drop them on this panel)">Import</button>
                </span>
              }
            >
              <input
                ref={textureInput}
                type="file"
                accept="image/png"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) importTextures(e.target.files)
                  e.target.value = ''
                }}
              />
              <div
                className="texture-list"
                onDragOver={(e) => {
                  if ([...e.dataTransfer.items].some((it) => it.kind === 'file')) e.preventDefault()
                }}
                onDrop={(e) => {
                  if (!e.dataTransfer.files.length) return
                  e.preventDefault()
                  importTextures(e.dataTransfer.files)
                }}
              >
                {model.textures.map((t, i) => {
                  const uses = model.cubes.reduce((n, c) => n + FACES.filter((k) => c.faces[k].texture === t.id).length, 0)
                  const cubeIds = selection.filter((id) => model.cubes.some((c) => c.id === id))
                  return (
                    <div key={t.id} className="texture-item" aria-current={i === textureIndex}>
                      <button
                        className="texture-row"
                        aria-current={i === textureIndex}
                        title={`${t.name}, on ${uses} face${uses === 1 ? '' : 's'}. Click to show it on the UV sheet; File \u25b8 Export texture PNG saves it.`}
                        onClick={() => setTextureIndex(i)}
                      >
                        <span
                          className="texture-thumb"
                          style={{
                            backgroundImage: `url(${t.source})`,
                            backgroundSize: 'cover',
                            imageRendering: 'pixelated',
                          }}
                        />
                        <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>{t.name}</span>
                        <span className="texture-row__meta">
                          {t.width} x {t.height}
                        </span>
                      </button>
                      <span className="texture-item__actions">
                        <button
                          className="editor-tool"
                          aria-label={`Put ${t.name} on the selected cubes`}
                          title={cubeIds.length ? `Put ${t.name} on every face of the selected cubes` : 'Select cubes to put this texture on them'}
                          disabled={!cubeIds.length}
                          onClick={() => history.commit('apply texture', (m) => assignTexture(m, cubeIds, t.id))}
                        >
                          <Icon name="cube" size={13} />
                        </button>
                        <button
                          className="editor-tool"
                          aria-label={`Delete ${t.name}`}
                          title={uses ? `Delete ${t.name}. Its ${uses} faces take ${model.textures.find((x) => x.id !== t.id)?.name ?? 'no texture'} instead.` : `Delete ${t.name}`}
                          onClick={() => {
                            history.commit('delete texture', (m) => removeTexture(m, t.id))
                            setTextureIndex((n) => Math.max(0, Math.min(n, model.textures.length - 2)))
                          }}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </span>
                    </div>
                  )
                })}
                {!model.textures.length ? <p className="editor-hint">No textures yet. Make a new one or drop a PNG here.</p> : null}
              </div>
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

      <div className="editor-status">
        <span>
          {model.cubes.length} cubes {'\u00b7'} {bones.length} bones {'\u00b7'} texture {model.resolution.width} {'\u00d7'} {model.resolution.height}
        </span>
        <span className="editor-status__selection">
          {mode === 'paint' && !saveNote && !openError ? <StatusTexel sink={hoverSink} fallback={cube ? `Painting on ${cube.name} \u00b7 ${face}` : 'Pick a cube to paint'} /> : null}
          {mode === 'paint' && !saveNote && !openError ? null : saveNote ??
            openError ??
            (cube && selection.length === 1
              ? `${cube.name} \u00b7 position ${cube.from.join(', ')} \u00b7 size ${cubeSize(cube).join(' \u00d7 ')}`
              : selection.length > 1
                ? `${selection.length} selected`
                : selectedMesh
                  ? `${selectedMesh.name} \u00b7 mesh, ${Object.keys(selectedMesh.vertices).length} vertices, ${Object.keys(selectedMesh.faces).length} faces${meshMode !== 'object' ? ` \u00b7 ${meshPicked} ${MESH_NOUN[meshMode][meshPicked === 1 ? 0 : 1]} picked` : ''}`
                  : selectedBone
                  ? `${selectedBone.name} \u00b7 pivot ${selectedBone.origin.join(', ')}`
                  : selectedNull
                    ? `${selectedNull.name} \u00b7 at ${selectedNull.position.join(', ')}`
                    : mode === 'animate' && clip
                      ? `${clipLabel(clip.name)} \u00b7 ${time.toFixed(2)} / ${clip.length.toFixed(2)} s`
                      : 'Nothing selected')}
        </span>
        <span className="editor-status__right">
          {dirty ? (
            <>
              <span className="editor-status__dot" aria-hidden="true" /> Changes not saved
            </>
          ) : (
            'Saved'
          )}
        </span>
      </div>
    </div>
  )
}
