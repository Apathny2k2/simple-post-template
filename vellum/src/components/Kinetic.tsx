import { Fragment } from 'react'
import type { CSSProperties } from 'react'

/**
 * A title dropped in a letter at a time; hovering a letter nudges it
 * and its neighbours. Screen readers get the plain text. Give it a key
 * of the text so a new title plays in again.
 */
export function Kinetic({ text }: { text: string }) {
  let i = 0
  return (
    <>
      <span className="vh">{text}</span>
      <span className="kinetic" aria-hidden="true">
        {text.split(' ').map((word, w) => (
          <Fragment key={w}>
            {w > 0 ? ' ' : null}
            <span className="kinetic__word">
              {[...word].map((ch) => (
                <span key={i} className="kinetic__ch" style={{ '--i': i++ } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  )
}
