import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { arrowNav, focusables } from '../lib/a11y'
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

/** What a trigger must spread onto its button for the menu to be announced. */
export type TriggerProps = {
  id: string
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  onClick: () => void
}

type Props = {
  entries: MenuEntry[]
  trigger: (props: { open: boolean; toggle: () => void; id: string; props: TriggerProps }) => ReactNode
  align?: 'start' | 'end'
  side?: 'up' | 'down'
  /** notified so a parent card can hold its hover state while the menu is open */
  onOpenChange?: (open: boolean) => void
}

export function Menu({ entries, trigger, align = 'end', side = 'down', onOpenChange }: Props) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  /* how far the popup had to be pulled back to stay on screen - a card
     near the right edge used to open a menu that ran off it, and the
     last few characters of every entry were simply unreachable */
  const [shift, setShift] = useState(0)
  const [flip, setFlip] = useState(false)
  const id = useId()

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) (document.getElementById(id) as HTMLElement | null)?.focus()
  }, [id])

  useLayoutEffect(() => {
    if (!open || !pop.current) {
      setShift(0)
      setFlip(false)
      return
    }
    setShift(0)
    setFlip(false)
    const r = pop.current.getBoundingClientRect()
    const pad = 8
    const over = r.right - (window.innerWidth - pad)
    const under = pad - r.left
    if (over > 0) setShift(-over)
    else if (under > 0) setShift(under)
    // no room below? open upwards instead of off the bottom of the page
    if (side === 'down' && r.bottom > window.innerHeight - pad && r.top > r.height + pad) setFlip(true)
  }, [open, side, entries.length])

  useEffect(() => {
    if (!open) return
    // land on the first entry so the arrows have somewhere to start
    focusables(pop.current)[0]?.focus()
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, close])

  const toggle = () => setOpen((o) => !o)
  const triggerProps: TriggerProps = {
    id,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    onClick: toggle,
  }

  return (
    <div className="menu-wrap" ref={wrap}>
      {trigger({ open, toggle, id, props: triggerProps })}
      {open && (
        <div
          ref={pop}
          className={`menu-pop menu-pop--${align} menu-pop--${flip ? 'up' : side}`}
          style={shift ? { marginLeft: shift } : undefined}
          role="menu"
          aria-labelledby={id}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              close()
              return
            }
            arrowNav(pop.current, e)
          }}
        >
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
                  close()
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
