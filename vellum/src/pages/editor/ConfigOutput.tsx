/* ---------------------------------------------------------------
   The file the form is making, while it is being made.

   A form that produces a config you cannot see until you export it is
   a form you have to trust. This is the other half: the YAML, live, in
   the middle of the editor, so a field and its line are on screen at
   the same moment.
   --------------------------------------------------------------- */

import { useMemo, useState } from 'react'
import { Icon } from '../../lib/icons'
import { toYaml } from '../../lib/mythic'
import type { MythicConfig } from '../../lib/mythic'
import { saveFile } from '../../lib/download'
import type { ProjectKind } from '../../lib/model'

/** Comment, key, list marker, then value - enough to read, no parser. */
function line(text: string, i: number) {
  if (/^\s*#/.test(text)) return <span key={i} className="yml__c">{text || ' '}</span>
  const m = /^(\s*)(- )?([A-Za-z0-9_]+)(:)(.*)$/.exec(text)
  if (m) {
    return (
      <span key={i}>
        {m[1]}
        {m[2] ? <span className="yml__d">{m[2]}</span> : null}
        <span className="yml__k">{m[3]}</span>
        <span className="yml__d">{m[4]}</span>
        <span className="yml__v">{m[5]}</span>
      </span>
    )
  }
  const l = /^(\s*)(- )(.*)$/.exec(text)
  if (l) {
    return (
      <span key={i}>
        {l[1]}
        <span className="yml__d">{l[2]}</span>
        <span className="yml__v">{l[3]}</span>
      </span>
    )
  }
  return <span key={i}>{text || ' '}</span>
}

export function ConfigOutput({
  id,
  kind,
  config,
}: {
  id: string
  kind: ProjectKind
  config: MythicConfig
}) {
  const [note, setNote] = useState<string | null>(null)
  const yaml = useMemo(() => toYaml(id, kind, config), [id, kind, config])
  const file = `${kind === 'mobs' ? 'mobs' : 'items'}/${id}.yml`
  const lines = yaml.replace(/\n$/, '').split('\n')

  const say = (m: string) => {
    setNote(m)
    window.setTimeout(() => setNote(null), 3500)
  }

  const copy = () => {
    if (!navigator.clipboard?.writeText) return say('This browser exposes no clipboard to the page.')
    void navigator.clipboard
      .writeText(yaml)
      .then(() => say(`Copied ${lines.length} lines.`))
      .catch(() => say('This browser would not let the page use the clipboard.'))
  }

  return (
    <div className="yml">
      <header className="yml__head">
        <Icon name="file" size={13} />
        <span className="yml__file mono">{file}</span>
        <span className="yml__n mono">{lines.length} lines</span>
        <button className="btn btn--sm" onClick={copy}>
          <Icon name="copy" size={12} /> Copy
        </button>
        <button
          className="btn btn--sm btn--primary"
          onClick={() => {
            void saveFile(`${id}.yml`, yaml).then((m) => say(m || `Saved ${id}.yml.`))
          }}
        >
          <Icon name="download" size={12} /> Save .yml
        </button>
      </header>

      <pre className="yml__body" tabIndex={0} aria-label={`${file}, ${lines.length} lines`}>
        <code>
          {lines.map((t, i) => (
            <span className="yml__line" key={i}>
              <span className="yml__no">{i + 1}</span>
              {line(t, i)}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>

      {note ? <p className="yml__note">{note}</p> : null}
    </div>
  )
}
