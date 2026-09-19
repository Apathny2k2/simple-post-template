import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import type { NewModelKind } from '../../lib/new-model'

const KINDS: Array<{ id: NewModelKind; label: string; icon: 'cube' | 'anim'; blurb: string; detail: string }> = [
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

  useEffect(() => {
    first.current?.select()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // the id rules a project path can carry
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  const valid = clean.length > 0 && clean.length <= 64

  return (
    <div className="dlg" role="dialog" aria-modal="true" aria-label="New model">
      <div className="dlg__scrim" onClick={onClose} />
      <div className="dlg__panel" style={{ width: 'min(560px, 100%)' }}>
        <header className="dlg__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Vellum</div>
            <h3 className="card__title">New model</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dlg__body">
          <div className="newmodel__kinds" role="radiogroup" aria-label="Model kind">
            {KINDS.map((k) => (
              <button
                key={k.id}
                role="radio"
                aria-checked={kind === k.id}
                className="newmodel__kind"
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
