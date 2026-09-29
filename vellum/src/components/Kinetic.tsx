import { Fragment } from 'react'
import type { CSSProperties } from 'react'

/** A title that drops in letter by letter. Key it on the text to replay the drop; `still` skips it. */
export function Kinetic({ text, still = false }: { text: string; still?: boolean }) {
  let i = 0
  return (
    <>
      <span className="vh">{text}</span>
      <span className={still ? 'kinetic kinetic--still' : 'kinetic'} aria-hidden="true">
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
