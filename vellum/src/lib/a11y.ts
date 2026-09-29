import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Everything inside `root` a Tab could land on, in tab order. */
export function focusables(root: HTMLElement | null | undefined): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  )
}

/** Keeps Tab inside `panel`, closes on Escape, and gives focus back to the opener on close. */
export function useModal(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
  /** where focus goes on close when nothing opened the dialog, as with one opened by a route */
  fallback?: RefObject<HTMLElement | null>,
) {
  const close = useRef(onClose)
  close.current = onClose
  const back = useRef(fallback)
  back.current = fallback

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const hadOpener = !!opener && opener !== document.body

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables(panel.current)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!active || !panel.current?.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (hadOpener && opener && document.contains(opener)) opener.focus()
      else back.current?.current?.focus()
    }
  }, [panel])
}

/** Arrow, Home and End keys for a menu, radiogroup or toolbar. Call from onKeyDown; returns true if it handled the key. */
export function arrowNav(
  container: HTMLElement | null,
  e: React.KeyboardEvent,
  opts: {
    orientation?: 'vertical' | 'horizontal' | 'both'
    wrap?: boolean
    /** override when the members carry a roving tabindex of -1 */
    select?: string
  } = {},
) {
  const { orientation = 'vertical', wrap = true, select } = opts
  const keys =
    orientation === 'horizontal'
      ? { next: ['ArrowRight'], prev: ['ArrowLeft'] }
      : orientation === 'vertical'
        ? { next: ['ArrowDown'], prev: ['ArrowUp'] }
        : { next: ['ArrowDown', 'ArrowRight'], prev: ['ArrowUp', 'ArrowLeft'] }

  const isNext = keys.next.includes(e.key)
  const isPrev = keys.prev.includes(e.key)
  if (!isNext && !isPrev && e.key !== 'Home' && e.key !== 'End') return false

  const items = select
    ? Array.from(container?.querySelectorAll<HTMLElement>(select) ?? [])
    : focusables(container)
  if (!items.length) return false
  const at = items.indexOf(document.activeElement as HTMLElement)

  let to: number
  if (e.key === 'Home') to = 0
  else if (e.key === 'End') to = items.length - 1
  else {
    const step = isNext ? 1 : -1
    to = at < 0 ? (isNext ? 0 : items.length - 1) : at + step
    if (to < 0) to = wrap ? items.length - 1 : 0
    if (to >= items.length) to = wrap ? 0 : items.length - 1
  }

  e.preventDefault()
  items[to]?.focus()
  return true
}
