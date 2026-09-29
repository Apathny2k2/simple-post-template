/* Live YAML preview of the config form, shown in the editor's middle column. */

import { useMemo, useState } from 'react'
import { Icon } from '../../lib/icons'
import { configPath, toYaml } from '../../lib/config'
import type { Config } from '../../lib/config'
import { saveFile } from '../../lib/download'
import type { ProjectKind } from '../../lib/model'

/** Highlights one YAML line (comment, key, list marker, value) with regexes. */
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
  config: Config
}) {
  const [note, setNote] = useState<string | null>(null)
  const yaml = useMemo(() => toYaml(id, kind, config), [id, kind, config])
  /* The loader reads one directory per id and a fixed file inside it, so a
     flat `mobs/<id>.yml` would never be read. */
  const file = configPath(kind, id)
  const lines = yaml.replace(/\n$/, '').split('\n')

  const say = (m: string) => {
    setNote(m)
    window.setTimeout(() => setNote(null), 3500)
  }

  const copy = () => {
    if (!navigator.clipboard?.writeText) return say('Copying isn’t available in this browser.')
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
            void saveFile(kind === 'mobs' ? 'mob.yml' : 'item.yml', yaml).then((m) => say(m || `Saved ${file}.`))
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
