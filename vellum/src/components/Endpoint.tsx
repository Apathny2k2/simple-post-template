import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Card } from './Card'
import { Icon } from '../lib/icons'
import type { EndpointSpec, HttpMethod, Param } from '../lib/endpoint'
import './Endpoint.css'

/** `POST /dash/server` as a compact, colour-coded chip. */
export function EndpointBadge({
  method,
  path,
  base,
  title,
}: {
  method: HttpMethod
  path: string
  base: string
  title?: string
}) {
  return (
    <code className="ep" title={title ?? `${method} ${base}${path}`}>
      <span className={`ep__m ep__m--${method.toLowerCase()}`}>{method}</span>
      <span className="ep__p">{path}</span>
    </code>
  )
}

function Params({ rows, markRequired }: { rows: Param[]; markRequired?: boolean }) {
  return (
    <dl className="api__params">
      {rows.map((p) => (
        <div key={p.name}>
          <dt className="mono">
            {p.name}
            {markRequired && p.required ? <span className="api__req">*</span> : null}
          </dt>
          <dd>
            <span className="api__type mono">{p.type}</span> {p.note}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * One API surface, rendered from its own catalogue. Both the support and
 * dashboard references are this component with a different list, so an
 * endpoint cannot be documented one way on one page and another way on
 * the next - and the docs cannot drift from the client, because the
 * client is built from the same objects.
 */
export function ApiReference<G extends string>({
  title,
  note,
  base,
  endpoints,
  initialOpen,
  eyebrow = 'Reference',
  className,
  actions,
  children,
}: {
  title: string
  note: ReactNode
  base: string
  endpoints: EndpointSpec<G>[]
  /** `METHOD /path` of the row to expand on first render */
  initialOpen?: string
  eyebrow?: ReactNode
  className?: string
  actions?: ReactNode
  /** appended below the groups, for anything the catalogue does not model */
  children?: ReactNode
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<G, EndpointSpec<G>[]>()
    for (const e of endpoints) {
      const list = byGroup.get(e.group) ?? []
      list.push(e)
      byGroup.set(e.group, list)
    }
    return [...byGroup.entries()]
  }, [endpoints])

  const [open, setOpen] = useState<string | null>(initialOpen ?? null)

  return (
    <Card className={className} eyebrow={eyebrow} title={title} note={note} actions={actions} dividedHead>
      {groups.map(([group, list]) => (
        <section className="api__group" key={group}>
          <h4 className="api__gname">{group}</h4>
          <div className="api__rows">
            {list.map((e) => {
              const key = `${e.method} ${e.path}`
              const isOpen = open === key
              return (
                <div className="api__row" key={key} data-open={isOpen || undefined}>
                  <button className="api__line" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}>
                    <span className={`ep__m ep__m--${e.method.toLowerCase()}`}>{e.method}</span>
                    <code className="api__path">{e.path}</code>
                    <span className="api__summary">{e.summary}</span>
                    {e.usedBy ? <span className="api__used">{e.usedBy}</span> : null}
                    <Icon name="chevronDown" size={12} className="api__chev" />
                  </button>

                  {isOpen ? (
                    <div className="api__detail">
                      <div className="api__url mono">
                        {e.method} {base}
                        {e.path}
                      </div>
                      {e.params?.length ? (
                        <>
                          <div className="api__label">Query</div>
                          <Params rows={e.params} />
                        </>
                      ) : null}
                      {e.body?.length ? (
                        <>
                          <div className="api__label">Body</div>
                          <Params rows={e.body} markRequired />
                        </>
                      ) : null}
                      <div className="api__label">Returns</div>
                      <code className="api__returns mono">{e.returns}</code>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {children}
    </Card>
  )
}
