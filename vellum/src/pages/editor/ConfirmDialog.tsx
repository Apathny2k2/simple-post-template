import { useEffect, useRef } from 'react'
import { Icon } from '../../lib/icons'
import { useModal } from '../../lib/a11y'

/** In-page confirm dialog, because a sandboxed frame can block `window.confirm`. */
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
  const panel = useRef<HTMLDivElement>(null)

  useModal(panel, onCancel)

  useEffect(() => {
    // focus Keep editing, the safe choice
    cancel.current?.focus()
  }, [])

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog__scrim" onClick={onCancel} />
      <div className="dialog__panel" ref={panel} style={{ width: 'min(460px, 100%)' }}>
        <header className="dialog__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Unsaved changes</div>
            <h2 className="card__title">{title}</h2>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dialog__body">
          <p className="editor-hint editor-hint--warn" style={{ marginTop: 0 }}>
            <Icon name="warning" size={13} /> {body}
          </p>
        </div>

        <footer className="dialog__foot">
          <span className="composer__hint mono">Ctrl S saves first</span>
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
