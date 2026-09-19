import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import { arrowNav, useModal } from '../../lib/a11y'
import type { NewModelKind } from '../../lib/new-model'

const KINDS: Array<{ id: NewModelKind; label: string; icon: 'cube' | 'anim' | 'grid' | 'bucket'; blurb: string; detail: string }> = [
  {
    id: 'items',
    label: 'Item',
    icon: 'cube',
    blurb: 'One cube on a 16 x 16 sheet.',
    detail: 'No rig. Add cubes and resize them as the shape comes together.',
  },
  {
    id: 'mobs',
    label: 'Mob',
    icon: 'anim',
    blurb: 'A six-part rig on a 64 x 64 sheet.',
    detail: 'Head, torso, two arms and two legs, each on its own bone with the pivot on the joint.',
  },
  {
    id: 'blocks',
    label: 'Block',
    icon: 'grid',
    blurb: 'A full 16-unit cube on a 64 x 64 sheet.',
    detail: 'Validated against the block rules: inside -16..32, one rotated axis, fixed angles.',
  },
  {
    id: 'consumables',
    label: 'Consumable',
    icon: 'bucket',
    blurb: 'A rigged flask that arrives with its use clip.',
    detail: 'Tips back, the stopper comes away, the level drops. Validation asks for that clip.',
  },
]

export function NewModelDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (kind: NewModelKind, name: string) => void
}) {
  const [kind, setKind] = useState<NewModelKind>('items')
  const [name, setName] = useState('untitled')
  const first = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const kinds = useRef<HTMLDivElement>(null)

  useModal(panel, onClose)

  useEffect(() => {
    first.current?.select()
  }, [])

  // the id rules a project path can carry
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  const valid = clean.length > 0 && clean.length <= 64

  return (
    <div className="dlg" role="dialog" aria-modal="true" aria-label="New model">
      <div className="dlg__scrim" onClick={onClose} />
      <div className="dlg__panel" ref={panel} style={{ width: 'min(560px, 100%)' }}>
        <header className="dlg__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Vellum</div>
            <h2 className="card__title">New model</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dlg__body">
          {/* a radiogroup is one stop in the tab order, and the arrows
              move within it - three separate tab stops is not what a
              screen reader is told this is */}
          <div
            className="newmodel__kinds"
            role="radiogroup"
            aria-label="Model kind"
            ref={kinds}
            onKeyDown={(e) => arrowNav(kinds.current, e, { orientation: 'both' })}
          >
            {KINDS.map((k) => (
              <button
                key={k.id}
                role="radio"
                aria-checked={kind === k.id}
                tabIndex={kind === k.id ? 0 : -1}
                className="newmodel__kind"
                onFocus={() => setKind(k.id)}
                onClick={() => setKind(k.id)}
              >
                <span className="newmodel__icon">
                  <Icon name={k.icon} size={18} />
                </span>
                <span className="newmodel__label">{k.label}</span>
                <span className="newmodel__blurb">{k.blurb}</span>
                <span className="newmodel__detail">{k.detail}</span>
              </button>
            ))}
          </div>

          <label className="field" style={{ marginTop: 16 }}>
            <span className="field__label">Name</span>
            <input
              ref={first}
              className="field__input"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) onCreate(kind, clean)
              }}
            />
            <span className="field__hint">
              Saves as <code className="mono">{valid ? `${clean}.vellum` : '…'}</code> &middot; lowercase,
              digits and underscores
            </span>
          </label>
        </div>

        <footer className="dlg__foot">
          <span className="cmp__hint mono">Starts from a template you can resize</span>
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={!valid} onClick={() => onCreate(kind, clean)}>
              Create
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
