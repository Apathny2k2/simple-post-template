import { useEffect, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { categories, subjectOf } from '../lib/support'
import type { TicketDraft } from '../lib/support'
import './TicketForm.css'

/** A chip that is on or off, for the choices under the ticket form. */
export function ToggleChip({
  on,
  onToggle,
  icon,
  tone,
  title,
  children,
}: {
  on: boolean
  onToggle: () => void
  icon?: IconName
  /** `warn` lights up amber, for things that are in the way */
  tone?: 'warn'
  title?: string
  children: ReactNode
}) {
  return (
    <button type="button" className="tf__chip" data-tone={tone} aria-pressed={on} title={title} onClick={onToggle}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </button>
  )
}

/**
 * The form that opens a ticket: one text box, whose first line becomes
 * the subject, then what it is about and whether it is in the way.
 * Support's new ticket and Report A Bug both use it.
 */
export function TicketForm({
  draft,
  onDraft,
  onSend,
  failed = false,
  placeholder = 'What went wrong?\nThe first line becomes the subject.',
  label = 'What went wrong',
  toggles,
  autoFocus = false,
  className = '',
}: {
  draft: TicketDraft
  onDraft: (d: TicketDraft) => void
  onSend: () => void
  failed?: boolean
  placeholder?: string
  label?: string
  /** more toggle chips, after "Blocking my work" */
  toggles?: ReactNode
  autoFocus?: boolean
  className?: string
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const ready = subjectOf(draft.text).length >= 3

  useEffect(() => {
    if (autoFocus) box.current?.focus()
  }, [autoFocus])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (ready) onSend()
  }

  return (
    <form className={`tf ${className}`} onSubmit={submit}>
      <textarea
        ref={box}
        className="tf__text"
        value={draft.text}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onDraft({ ...draft, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
        }}
      />

      <div className="tf__chips" role="group" aria-label="What it is about">
        {categories.map((c) => (
          <ToggleChip
            key={c.id}
            on={draft.category === c.id}
            onToggle={() => onDraft({ ...draft, category: draft.category === c.id ? null : c.id })}
          >
            {c.short}
          </ToggleChip>
        ))}
      </div>

      {failed ? (
        <p className="tf__error" role="alert">
          That did not go through. Your text is still here, so send it again.
        </p>
      ) : null}

      <div className="tf__foot">
        <ToggleChip
          on={draft.blocking}
          onToggle={() => onDraft({ ...draft, blocking: !draft.blocking })}
          icon="warning"
          tone="warn"
        >
          Blocking my work
        </ToggleChip>
        {toggles}
        <button type="submit" className="btn btn--primary tf__send" disabled={!ready} title="Send (Ctrl+Enter)">
          Send <Icon name="arrowRight" size={13} />
        </button>
      </div>
    </form>
  )
}
