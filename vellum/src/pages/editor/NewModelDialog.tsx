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
]

/* What a subtype is actually for, said once so the picker is not a row
   of words a modeller has to guess the consequences of. */
const SUB_NOTE: Record<Subtype, string> = {
  weapon: 'Swung. Dropped on the ground in the world view.',
  tool: 'Held and used on a block. Dropped on the ground in the world view.',
  consumable: 'Starts as a flask that already carries its use clip — the clip the rules ask for.',
  misc: 'An ordinary item. Hangs in the air in the world view.',
  hostile: 'Comes at the player. The rules ask for an attack clip.',
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
  /** where focus goes when nothing opened this - see useModal */
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

  /* A subtype only means anything inside its kind, so changing the kind
     has to change it too - otherwise a Block could carry "hostile" out
     of the dialog, which is a state the reader would only throw away. */
  const pickKind = (k: ProjectKind) => {
    setKind(k)
    setSubtype(defaultSubtype(k))
  }

  const options = SUBTYPES[kind]

  // the id rules a project path can carry
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  const valid = clean.length > 0 && clean.length <= 64
  const create = () => valid && onCreate(kind, subtype, clean)

  return (
    <div className="dlg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dlg__scrim" onClick={onClose} />
      <div className="dlg__panel" ref={panel} style={{ width: 'min(560px, 100%)' }}>
        <header className="dlg__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Vellum</div>
            <h2 className="card__title">{title}</h2>
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
                onFocus={() => pickKind(k.id)}
                onClick={() => pickKind(k.id)}
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

          {options.length ? (
            <div className="newmodel__sub">
              <span className="field__label" id="newmodel-sub">
                What it is for
              </span>
              <div
                className="newmodel__subrow"
                role="radiogroup"
                aria-labelledby="newmodel-sub"
                ref={subs}
                onKeyDown={(e) => arrowNav(subs.current, e, { orientation: 'horizontal' })}
              >
                {options.map((o) => (
                  <button
                    key={o}
                    role="radio"
                    aria-checked={subtype === o}
                    tabIndex={subtype === o ? 0 : -1}
                    className="chip newmodel__subchip"
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
            <p className="ed-hint newmodel__sub">
              <Icon name="info" size={11} /> A block is one thing, so there is nothing further to say
              about it here.
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

        <footer className="dlg__foot">
          <span className="cmp__hint mono">Starts from a template you can resize</span>
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
