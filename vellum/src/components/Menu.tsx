import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../lib/icons'
import type { IconName } from '../lib/icons'
import './Menu.css'

export type MenuEntry =
  | { kind: 'separator' }
  | { kind: 'label'; label: string }
  | {
      kind?: 'item'
      label: string
      icon?: IconName
      shortcut?: string
      danger?: boolean
      onSelect?: () => void
    }

type Props = {
  entries: MenuEntry[]
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  align?: 'start' | 'end'
  side?: 'up' | 'down'
  /** notified so a parent card can hold its hover state while the menu is open */
  onOpenChange?: (open: boolean) => void
}

export function Menu({ entries, trigger, align = 'end', side = 'down', onOpenChange }: Props) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-wrap" ref={wrap}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div className={`menu-pop menu-pop--${align} menu-pop--${side}`} role="menu" aria-labelledby={id}>
          {entries.map((entry, i) => {
            if (entry.kind === 'separator') return <div className="menu-sep" key={i} />
            if (entry.kind === 'label')
              return (
                <div className="menu-label" key={i}>
                  {entry.label}
                </div>
              )
            return (
              <button
                key={i}
                role="menuitem"
                className={`menu-item${entry.danger ? ' menu-item--danger' : ''}`}
                onClick={() => {
                  entry.onSelect?.()
                  setOpen(false)
                }}
              >
                {entry.icon ? <Icon name={entry.icon} size={14} /> : null}
                {entry.label}
                {entry.shortcut ? <span className="menu-item__key">{entry.shortcut}</span> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
