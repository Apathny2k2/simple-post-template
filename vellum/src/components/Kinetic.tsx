import { Fragment } from 'react'

/** A title set a letter at a time, so each letter leans as the pointer passes over it. */
export function Kinetic({ text }: { text: string }) {
  let i = 0
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span className="kinetic" aria-hidden="true">
        {text.split(' ').map((word, w) => (
          <Fragment key={w}>
            {w > 0 ? ' ' : null}
            <span className="kinetic__word">
              {[...word].map((ch) => (
                <span key={i++} className="kinetic__letter">
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
