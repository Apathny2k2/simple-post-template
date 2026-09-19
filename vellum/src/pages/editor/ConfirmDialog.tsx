import { useEffect, useRef } from 'react'
import { Icon } from '../../lib/icons'

/**
 * Asked before something irreversible. Deliberately not `window.confirm`:
 * a sandboxed frame can refuse to show one, and a guard that silently
 * does not appear is worse than no guard at all.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // focus the safe choice, not the destructive one
    cancel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="dlg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dlg__scrim" onClick={onCancel} />
      <div className="dlg__panel" style={{ width: 'min(460px, 100%)' }}>
        <header className="dlg__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Unsaved changes</div>
            <h3 className="card__title">{title}</h3>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dlg__body">
          <p className="ed-hint ed-hint--warn" style={{ marginTop: 0 }}>
            <Icon name="warning" size={13} /> {body}
          </p>
        </div>

        <footer className="dlg__foot">
          <span className="cmp__hint mono">Ctrl S saves first</span>
          <div className="row-actions">
            <button className="btn btn--ghost" ref={cancel} onClick={onCancel}>
              Keep editing
            </button>
            <button className="btn btn--primary" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
