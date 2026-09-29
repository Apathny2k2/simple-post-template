import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import { arrowNav, useModal } from '../../lib/a11y'
import { SUBTYPES, defaultSubtype, subtypeLabel } from '../../lib/model'
import type { ProjectKind, Subtype } from '../../lib/model'

const KINDS: Array<{
  id: ProjectKind
  label: string
  icon: 'cube' | 'anim' | 'grid'
  blurb: string
  detail: string
}> = [
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
    blurb: 'A 6-part rig on a 64 x 64 sheet.',
    detail: 'Head, torso, 2 arms and 2 legs, each on its own bone with the pivot on the joint.',
  },
  {
    id: 'blocks',
    label: 'Block',
    icon: 'grid',
    blurb: 'A full 16-unit cube on a 64 x 64 sheet.',
    detail: 'Checked against the block rules: inside -16..32, 1 rotated axis, fixed angles.',
  },
]

/* what each subtype does, shown under the subtype picker */
const SUB_NOTE: Record<Subtype, string> = {
  weapon: 'Swung. Dropped on the ground in the world view.',
  tool: 'Held and used on a block. Dropped on the ground in the world view.',
  consumable: 'Starts as a flask with a use clip. Consumables need one.',
  misc: 'An ordinary item. Hangs in the air in the world view.',
  hostile: 'Comes at the player. Give it an attack clip.',
  neutral: 'Fights back when hit.',
  docile: 'Never attacks.',
}

export function NewModelDialog({
  onClose,
  onCreate,
  title = 'New model',
  focusOnClose,
}: {
  onClose: () => void
  onCreate: (kind: ProjectKind, subtype: Subtype | undefined, name: string) => void
  title?: string
  /** where focus goes on close if no element opened the dialog (see useModal) */
  focusOnClose?: React.RefObject<HTMLElement | null>
}) {
  const [kind, setKind] = useState<ProjectKind>('items')
  const [subtype, setSubtype] = useState<Subtype | undefined>(() => defaultSubtype('items'))
  const [name, setName] = useState('untitled')
  const first = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const kinds = useRef<HTMLDivElement>(null)
  const subs = useRef<HTMLDivElement>(null)

  useModal(panel, onClose, focusOnClose)

  useEffect(() => {
    first.current?.select()
  }, [])

  // subtypes belong to a kind, so changing the kind resets the subtype
  const pickKind = (k: ProjectKind) => {
    setKind(k)
    setSubtype(defaultSubtype(k))
  }

  const options = SUBTYPES[kind]

  // a project id: lowercase letters, digits and underscores
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  const valid = clean.length > 0 && clean.length <= 64
  const create = () => valid && onCreate(kind, subtype, clean)

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog__scrim" onClick={onClose} />
      <div className="dialog__panel" ref={panel} style={{ width: 'min(560px, 100%)' }}>
        <header className="dialog__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Vellum</div>
            <h2 className="card__title">{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dialog__body">
          {/* radiogroup: one tab stop, and the arrow keys move within it */}
          <div
            className="new-model__kinds"
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
                className="new-model__kind"
                onFocus={() => pickKind(k.id)}
                onClick={() => pickKind(k.id)}
              >
                <span className="new-model__icon">
                  <Icon name={k.icon} size={18} />
                </span>
                <span className="new-model__label">{k.label}</span>
                <span className="new-model__blurb">{k.blurb}</span>
                <span className="new-model__detail">{k.detail}</span>
              </button>
            ))}
          </div>

          {options.length ? (
            <div className="new-model__sub">
              <span className="field__label" id="new-model-sub">
                What it is for
              </span>
              <div
                className="new-model__subrow"
                role="radiogroup"
                aria-labelledby="new-model-sub"
                ref={subs}
                onKeyDown={(e) => arrowNav(subs.current, e, { orientation: 'horizontal' })}
              >
                {options.map((o) => (
                  <button
                    key={o}
                    role="radio"
                    aria-checked={subtype === o}
                    tabIndex={subtype === o ? 0 : -1}
                    className="chip new-model__subchip"
                    onFocus={() => setSubtype(o)}
                    onClick={() => setSubtype(o)}
                  >
                    {subtypeLabel(o)}
                  </button>
                ))}
              </div>
              <span className="field__hint">{subtype ? SUB_NOTE[subtype] : null}</span>
            </div>
          ) : (
            <p className="editor-hint new-model__sub">
              <Icon name="info" size={11} /> Blocks have no subtypes.
            </p>
          )}

          <label className="field" style={{ marginTop: 16 }}>
            <span className="field__label">Name</span>
            <input
              ref={first}
              className="field__input"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create()
              }}
            />
            <span className="field__hint">
              Saves as <code className="mono">{valid ? `${clean}.vellum` : '…'}</code> &middot; lowercase,
              digits and underscores
            </span>
          </label>
        </div>

        <footer className="dialog__foot">
          <span className="composer__hint mono">Starts from a template you can resize</span>
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={!valid} onClick={create}>
              Create
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
