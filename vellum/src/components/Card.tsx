import type { ReactNode } from 'react'
import './Card.css'

type CardProps = {
  title?: ReactNode
  note?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  variant?: 'solid' | 'dashed' | 'flush' | 'muted'
  interactive?: boolean
  dividedHead?: boolean
  tightBody?: boolean
  className?: string
  style?: React.CSSProperties
}

/** The reusable section card. Every page composes out of this one shape. */
export function Card({
  title,
  note,
  eyebrow,
  actions,
  footer,
  children,
  variant = 'solid',
  interactive,
  dividedHead,
  tightBody,
  className = '',
  style,
}: CardProps) {
  const variantClass = variant === 'solid' ? '' : ` card--${variant}`
  return (
    <section
      className={`card${variantClass}${interactive ? ' card--interactive' : ''} ${className}`}
      style={style}
    >
      {(title || actions || eyebrow) && (
        <header className={`card__head${dividedHead ? ' card__head--bordered' : ''}`}>
          <div className="card__heading">
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            {title ? <h2 className="card__title">{title}</h2> : null}
            {note ? <div className="card__note">{note}</div> : null}
          </div>
          {actions ? <div className="card__actions">{actions}</div> : null}
        </header>
      )}
      {children ? (
        <div className={`card__body${tightBody ? ' card__body--tight' : ''}`}>{children}</div>
      ) : null}
      {footer ? <footer className="card__foot">{footer}</footer> : null}
    </section>
  )
}
