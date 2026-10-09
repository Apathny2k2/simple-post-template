import { useState } from 'react'
import type { Vec3 } from '../../lib/model'
import { Icon } from '../../lib/icons'

/* The eight display slots of a Java item model. .vellum stores no display
   transforms, so this panel edits a preview. */
export const DISPLAY_SLOTS = [
  { id: 'thirdperson_righthand', label: 'Third person, right hand' },
  { id: 'thirdperson_lefthand', label: 'Third person, left hand' },
  { id: 'firstperson_righthand', label: 'First person, right hand' },
  { id: 'firstperson_lefthand', label: 'First person, left hand' },
  { id: 'head', label: 'Head' },
  { id: 'gui', label: 'Inventory (GUI)' },
  { id: 'ground', label: 'Dropped' },
  { id: 'fixed', label: 'Item frame' },
] as const

export type SlotId = (typeof DISPLAY_SLOTS)[number]['id']

export type SlotTransform = { rotation: Vec3; translation: Vec3; scale: Vec3 }

export type DisplayState = Record<SlotId, SlotTransform>

const rest: SlotTransform = { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [1, 1, 1] }

/** Starting transforms, taken from vanilla item and block models. */
export const DEFAULT_DISPLAY: DisplayState = {
  thirdperson_righthand: { rotation: [0, -90, 55], translation: [0, 4, 0.5], scale: [0.85, 0.85, 0.85] },
  thirdperson_lefthand: { rotation: [0, 90, -55], translation: [0, 4, 0.5], scale: [0.85, 0.85, 0.85] },
  firstperson_righthand: { rotation: [0, -90, 25], translation: [1.13, 3.2, 1.13], scale: [0.68, 0.68, 0.68] },
  firstperson_lefthand: { rotation: [0, 90, -25], translation: [1.13, 3.2, 1.13], scale: [0.68, 0.68, 0.68] },
  head: { rotation: [0, 180, 0], translation: [0, 13, 7], scale: [1, 1, 1] },
  gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] },
  ground: { rotation: [0, 0, 0], translation: [0, 3, 0], scale: [0.25, 0.25, 0.25] },
  fixed: { ...rest },
}

/** One slot as display JSON, leaving out parts equal to the identity transform. */
function slotJson(t: SlotTransform) {
  const out: Record<string, number[]> = {}
  const same = (a: Vec3, b: Vec3) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6)
  if (!same(t.rotation, [0, 0, 0])) out.rotation = t.rotation
  if (!same(t.translation, [0, 0, 0])) out.translation = t.translation
  if (!same(t.scale, [1, 1, 1])) out.scale = t.scale
  return out
}

export function DisplayPanel({
  slot,
  onSlot,
  transform,
  onTransform,
  onReset,
  onWorld,
  all,
  children,
}: {
  slot: SlotId
  onSlot: (s: SlotId) => void
  transform: SlotTransform
  onTransform: (t: SlotTransform) => void
  onReset: () => void
  /** opens WorldScene: the model at real size beside a two-block figure */
  onWorld: () => void
  /** every slot's transform, for Copy all */
  all: DisplayState
  /** renders Editor's NumRow for these rows */
  children: (rows: {
    label: string
    value: Vec3
    onChange: (v: Vec3) => void
    step?: number
  }[]) => React.ReactNode
}) {
  const [note, setNote] = useState<string | null>(null)

  const copy = (only: SlotId | null) => {
    const display: Record<string, Record<string, number[]>> = {}
    for (const s of DISPLAY_SLOTS) {
      if (only && s.id !== only) continue
      const json = slotJson(all[s.id])
      if (Object.keys(json).length) display[s.id] = json
    }
    const text = JSON.stringify({ display }, null, 2)
    const done = (msg: string) => {
      setNote(msg)
      window.setTimeout(() => setNote(null), 4000)
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(text)
        .then(() => done(only ? `Copied ${only}.` : `Copied ${Object.keys(display).length} slots.`))
        .catch(() => done('This browser would not let the page use the clipboard.'))
    } else {
      done('Copying isn’t available in this browser.')
    }
  }

  return (
    <>
      <label className="field" style={{ marginBottom: 10 }}>
        <span className="field__label">Slot</span>
        <select
          className="editor-select"
          style={{ width: '100%', height: 'auto', padding: '6px 10px' }}
          value={slot}
          onChange={(e) => onSlot(e.target.value as SlotId)}
        >
          {DISPLAY_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="num-field-grid">
        {children([
          {
            label: 'Rotation',
            value: transform.rotation,
            step: 7.5,
            onChange: (rotation) => onTransform({ ...transform, rotation }),
          },
          {
            label: 'Translate',
            value: transform.translation,
            onChange: (translation) => onTransform({ ...transform, translation }),
          },
          {
            label: 'Scale',
            value: transform.scale,
            step: 0.05,
            onChange: (scale) => onTransform({ ...transform, scale }),
          },
        ])}
      </div>

      <button className="btn btn--primary" style={{ width: '100%', marginTop: 12 }} onClick={onWorld}>
        <Icon name="scene" size={14} /> View in the real world
      </button>

      <div className="chip-row">
        <button className="chip" onClick={onReset}>
          <Icon name="refresh" size={11} /> Reset slot
        </button>
        <button className="chip" onClick={() => copy(slot)} title="This slot, as Minecraft expects it">
          <Icon name="copy" size={11} /> Copy slot
        </button>
        <button className="chip" onClick={() => copy(null)} title="Every slot with a transform set">
          <Icon name="copy" size={11} /> Copy all
        </button>
      </div>

      {note ? <p className="editor-hint editor-hint--warn">{note}</p> : null}

      <p className="editor-hint" style={{ marginTop: 10 }}>
        <Icon name="info" size={11} />
        These are a preview. Display transforms live in the resource pack, so they aren't saved in
        the .vellum. Copy them into your pack's item JSON.
      </p>
    </>
  )
}
