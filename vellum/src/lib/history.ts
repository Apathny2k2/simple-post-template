/* ---------------------------------------------------------------
   Undo and redo.

   Every edit in this editor already produces a brand-new Model rather
   than mutating one, so history is just a list of the models we passed
   through - no diffing, no command objects, no inverse operations to
   keep in sync with the forward ones.

   The only interesting case is a burst: a brush stroke writes the
   texture dozens of times a second, and undoing one of those writes
   would be useless. `begin` / `amend` / `end` brackets a burst so the
   whole stroke is one step. Everything else goes through `commit`.

   Every updater here is pure - it derives its result from the state it
   is handed and touches nothing outside - because React is free to run
   an updater twice and keep only one result.
   --------------------------------------------------------------- */

import { useCallback, useMemo, useState } from 'react'

/** Deep enough to cover a working session, shallow enough to stay cheap. */
const LIMIT = 80

type Entry<T> = { label: string; value: T }

type State<T> = {
  past: Entry<T>[]
  present: T
  future: Entry<T>[]
  /** what the last commit was called, and when - see `coalesce` */
  lastLabel: string | null
  lastAt: number
  /**
   * Bumped by undo and redo only. A caller that keeps state alongside
   * the value - which cube was selected, say - watches this to know it
   * has travelled rather than edited, without having to diff anything.
   */
  travel: number
}

/** Same-label commits closer together than this fold into one step. */
const COALESCE_MS = 600

export type History<T> = {
  present: T
  canUndo: boolean
  canRedo: boolean
  /** what Ctrl+Z would undo, for the menu label */
  undoLabel: string | null
  redoLabel: string | null
  /** increments on undo and redo, never on an edit */
  travel: number
  /**
   * Record one edit as one undo step. `coalesce` folds a run of
   * same-label edits together, which is what makes dragging a number
   * field one undo rather than forty.
   */
  commit: (label: string, next: T | ((current: T) => T), coalesce?: boolean) => void
  /** open a burst; the step is named here */
  begin: (label: string) => void
  /** move the present without recording - only meaningful inside a burst */
  amend: (next: T | ((current: T) => T)) => void
  /** close a burst, discarding it if nothing actually changed */
  end: () => void
  undo: () => void
  redo: () => void
  /** a new file: the old history belonged to a different model */
  reset: (next: T) => void
}

const resolve = <T,>(next: T | ((current: T) => T), current: T): T =>
  typeof next === 'function' ? (next as (c: T) => T)(current) : next

const trim = <T,>(past: Entry<T>[]) => (past.length > LIMIT ? past.slice(past.length - LIMIT) : past)

export function useHistory<T>(initial: T): History<T> {
  const [state, setState] = useState<State<T>>({
    past: [],
    present: initial,
    future: [],
    lastLabel: null,
    lastAt: 0,
    travel: 0,
  })

  const commit = useCallback((label: string, next: T | ((current: T) => T), coalesce = false) => {
    // read the clock out here: an updater React may run twice must be pure
    const now = Date.now()
    setState((s) => {
      const value = resolve(next, s.present)
      if (value === s.present) return s
      const fold =
        coalesce && s.past.length > 0 && s.lastLabel === label && now - s.lastAt < COALESCE_MS
      return {
        past: fold ? s.past : trim([...s.past, { label, value: s.present }]),
        present: value,
        future: [],
        lastLabel: label,
        lastAt: now,
        travel: s.travel,
      }
    })
  }, [])

  const begin = useCallback((label: string) => {
    setState((s) => {
      // re-opening a burst that is already open must not push a second entry
      const last = s.past[s.past.length - 1]
      if (last && last.value === s.present && last.label === label) return s
      return {
        ...s,
        past: trim([...s.past, { label, value: s.present }]),
        future: [],
        lastLabel: null,
      }
    })
  }, [])

  const amend = useCallback((next: T | ((current: T) => T)) => {
    setState((s) => {
      const value = resolve(next, s.present)
      return value === s.present ? s : { ...s, present: value }
    })
  }, [])

  const end = useCallback(() => {
    setState((s) => {
      const last = s.past[s.past.length - 1]
      // a stroke that painted nothing is not worth an undo step
      return last && last.value === s.present ? { ...s, past: s.past.slice(0, -1) } : s
    })
  }, [])

  const undo = useCallback(() => {
    setState((s) => {
      if (!s.past.length) return s
      const last = s.past[s.past.length - 1]
      return {
        past: s.past.slice(0, -1),
        present: last.value,
        future: [{ label: last.label, value: s.present }, ...s.future],
        lastLabel: null,
        lastAt: 0,
        travel: s.travel + 1,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((s) => {
      if (!s.future.length) return s
      const [next, ...rest] = s.future
      return {
        past: trim([...s.past, { label: next.label, value: s.present }]),
        present: next.value,
        future: rest,
        lastLabel: null,
        lastAt: 0,
        travel: s.travel + 1,
      }
    })
  }, [])

  const reset = useCallback(
    (next: T) => setState({ past: [], present: next, future: [], lastLabel: null, lastAt: 0, travel: 0 }),
    [],
  )

  return useMemo(
    () => ({
      present: state.present,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undoLabel: state.past[state.past.length - 1]?.label ?? null,
      redoLabel: state.future[0]?.label ?? null,
      travel: state.travel,
      commit,
      begin,
      amend,
      end,
      undo,
      redo,
      reset,
    }),
    [state, commit, begin, amend, end, undo, redo, reset],
  )
}
