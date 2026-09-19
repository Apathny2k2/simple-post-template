/* ---------------------------------------------------------------
   The config form.

   Every control here is generated from `SCHEMA` in lib/mythic.ts -
   nothing below knows what a boss bar is. That is the point: a field
   added to the schema appears here, validates, and lands in the YAML
   without three places having to agree about how it is spelled.
   --------------------------------------------------------------- */

import { useState } from 'react'
import { Icon } from '../../lib/icons'
import { SCHEMA, setFields } from '../../lib/mythic'
import type { Column, Field, MythicConfig, Row, Section } from '../../lib/mythic'
import type { ProjectKind } from '../../lib/model'

function Suggest({ id, options }: { id: string; options: readonly string[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  )
}

function Rows({
  field,
  value,
  onChange,
}: {
  field: Field
  value: Row[]
  onChange: (next: Row[]) => void
}) {
  const columns = field.columns ?? []
  const blank = (): Row => Object.fromEntries(columns.map((c) => [c.key, ''])) as Row
  const patch = (i: number, key: string, v: string) =>
    onChange(value.map((r, n) => (n === i ? { ...r, [key]: v } : r)))

  return (
    <div className="cfg-rows">
      {value.map((row, i) => (
        <div className="cfg-row" key={i} data-cols={columns.length}>
          {columns.map((c: Column) => (
            <input
              key={c.key}
              className="field__input cfg-row__cell"
              style={{ flexGrow: c.width ?? 1, flexBasis: 0, minWidth: 0 }}
              value={row[c.key] ?? ''}
              placeholder={c.label}
              aria-label={`${field.label} ${i + 1} ${c.label}`}
              list={c.suggest ? `cfg-${field.key}-${c.key}` : undefined}
              onChange={(e) => patch(i, c.key, e.target.value)}
            />
          ))}
          <button
            className="ed-tool cfg-x"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
            title={`Remove ${field.label.toLowerCase()} ${i + 1}`}
            aria-label={`Remove ${field.label.toLowerCase()} ${i + 1}`}
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      ))}
      {columns.filter((c) => c.suggest).map((c) => (
        <Suggest key={c.key} id={`cfg-${field.key}-${c.key}`} options={c.suggest as readonly string[]} />
      ))}
      <button className="chip cfg-add" onClick={() => onChange([...value, blank()])}>
        <Icon name="plus" size={10} /> Add {field.label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  )
}

function Lines({
  field,
  value,
  onChange,
}: {
  field: Field
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="cfg-rows">
      {value.map((line, i) => (
        <div className="cfg-row" key={i}>
          <input
            className="field__input cfg-row__cell"
            style={{ flex: 1, minWidth: 0 }}
            value={line}
            aria-label={`${field.label} ${i + 1}`}
            list={field.options ? `cfg-${field.key}` : undefined}
            onChange={(e) => onChange(value.map((l, n) => (n === i ? e.target.value : l)))}
          />
          <button
            className="ed-tool cfg-x"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
            title={`Remove line ${i + 1}`}
            aria-label={`Remove ${field.label.toLowerCase()} ${i + 1}`}
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      ))}
      {field.options ? <Suggest id={`cfg-${field.key}`} options={field.options} /> : null}
      <button className="chip cfg-add" onClick={() => onChange([...value, ''])}>
        <Icon name="plus" size={10} /> Add line
      </button>
    </div>
  )
}

function Control({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (v: never) => void
}) {
  const set = onChange as (v: unknown) => void

  switch (field.kind) {
    case 'bool':
      return (
        <button
          className="cfg-switch"
          role="switch"
          aria-checked={!!value}
          aria-label={field.label}
          onClick={() => set(!value)}
        >
          <span className="cfg-switch__dot" />
        </button>
      )
    case 'number':
      return (
        <input
          className="field__input cfg-num mono"
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={Number(value ?? 0)}
          aria-label={field.label}
          onChange={(e) => set(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      )
    case 'select':
      return (
        <select
          className="ed-select cfg-wide"
          value={String(value ?? '')}
          aria-label={field.label}
          onChange={(e) => set(e.target.value)}
        >
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case 'list':
      return <Lines field={field} value={(value as string[]) ?? []} onChange={set} />
    case 'rows':
      return <Rows field={field} value={(value as Row[]) ?? []} onChange={set} />
    default:
      return (
        <>
          <input
            className="field__input cfg-wide"
            value={String(value ?? '')}
            placeholder={field.placeholder}
            aria-label={field.label}
            list={field.options ? `cfg-${field.key}` : undefined}
            onChange={(e) => set(e.target.value)}
          />
          {field.options ? <Suggest id={`cfg-${field.key}`} options={field.options} /> : null}
        </>
      )
  }
}

/** A field whose control sits beside its label, rather than under it. */
const INLINE = new Set<Field['kind']>(['bool', 'number'])

export function ConfigPanel({
  kind,
  config,
  onChange,
}: {
  kind: ProjectKind
  config: MythicConfig
  onChange: (next: MythicConfig) => void
}) {
  const sections: Section[] = SCHEMA[kind] ?? []
  const [open, setOpen] = useState<string>(sections[0]?.id ?? '')
  const set = (key: string, v: unknown) => onChange({ ...config, [key]: v as never })
  const touched = setFields(kind, config)

  return (
    <>
      <p className="ed-hint cfg-lead">
        <Icon name="info" size={11} />
        What this is, rather than what it looks like. Written as MythicMobs YAML, keyed by the
        model&rsquo;s own name so the two cannot drift apart.
      </p>

      {sections.map((sec) => {
        const isOpen = open === sec.id
        const n = sec.fields.filter((f) => touched.includes(f)).length
        return (
          <section className="cfg-sec" key={sec.id} data-open={isOpen || undefined}>
            <button
              className="cfg-sec__head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? '' : sec.id)}
            >
              <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={12} />
              <span className="cfg-sec__title">{sec.title}</span>
              {n ? <span className="cfg-sec__n mono">{n}</span> : null}
            </button>

            {isOpen ? (
              <div className="cfg-sec__body">
                <p className="cfg-sec__blurb">{sec.blurb}</p>
                {sec.fields.map((f) => (
                  <div className="cfg-field" key={f.key} data-inline={INLINE.has(f.kind) || undefined}>
                    <span className="cfg-field__label">{f.label}</span>
                    <Control field={f} value={config[f.key]} onChange={(v) => set(f.key, v)} />
                    {f.help ? <span className="cfg-field__help">{f.help}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )
      })}
    </>
  )
}
