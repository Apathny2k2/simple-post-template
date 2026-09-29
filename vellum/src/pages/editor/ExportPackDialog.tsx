/* Exports a library shelf as a resource pack, and lists what goes in and
   what is left out before the download. */

import { useMemo, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import { useModal } from '../../lib/a11y'
import { buildConfigs, buildPack, folderOf, isNamespace, packBytes, packZip, safeId } from '../../lib/pack'
import type { PackItem } from '../../lib/pack'
import { saveBlob } from '../../lib/download'
import { Pip } from '../../components/Pip'
import type { PipFailure, PipMood } from '../../components/Pip'

const KB = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

export function ExportPackDialog({
  items,
  suggestedName,
  onClose,
  focusOnClose,
}: {
  items: PackItem[]
  suggestedName: string
  onClose: () => void
  focusOnClose?: React.RefObject<HTMLElement | null>
}) {
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, onClose, focusOnClose)

  const [namespace, setNamespace] = useState(() => safeId(suggestedName))
  /* 84 is the pack format in Minecraft 26.1.2's version.json. It is an
     editable field because newer versions may declare a higher one. */
  const [packFormat, setPackFormat] = useState(84)
  const [description, setDescription] = useState(`${suggestedName} — built in Vellum`)
  const [note, setNote] = useState<string | null>(null)

  const nsOk = isNamespace(namespace)

  const report = useMemo(
    () => (nsOk ? buildPack(items, { namespace, packFormat, description }) : null),
    [items, namespace, packFormat, description, nsOk],
  )

  /* warnings for models that made it in; refused models are listed under
     "Left out" with the reason */
  const problems = useMemo(() => {
    if (!report) return []
    const refused = new Set(report.skipped.map((s) => s.id))
    return report.issues
      .filter((r) => !refused.has(r.id))
      .map((r) => ({ id: r.id, list: r.issues.filter((i) => i.level === 'warning') }))
      .filter((r) => r.list.length)
  }, [report])

  const models = report?.files.filter((f) => f.path.endsWith('.json') && f.path !== 'pack.mcmeta').length ?? 0

  /* Configs are a separate zip because they go in the plugin's folder,
     while the pack goes in resourcepacks/. */
  const configs = useMemo(() => buildConfigs(items), [items])

  const stem = safeId(suggestedName)

  /* Pip animates while the zip is built and saved, and the result is shown
     when his ending finishes. A cancelled save ends at a wall, a failed one in lava. */
  const [run, setRun] = useState<{ mood: PipMood; failure: PipFailure; said: string | null } | null>(null)

  const save = (name: string, build: () => Uint8Array) => {
    if (run) return
    setNote(null)
    setRun({ mood: 'working', failure: 'lava', said: null })
    // let Pip draw before the synchronous build blocks the main thread
    window.setTimeout(() => {
      let bytes: Uint8Array
      try {
        bytes = build()
      } catch (e) {
        setRun({ mood: 'failed', failure: 'lava', said: `Could not build the pack: ${(e as Error).message}` })
        return
      }
      void saveBlob(name, new Blob([bytes as BlobPart], { type: 'application/zip' })).then((m) => {
        const said = m || `Saved ${name}`
        const cancelled = /cancel/i.test(said)
        const broke = /could not/i.test(said)
        setRun({ mood: cancelled || broke ? 'failed' : 'done', failure: cancelled ? 'wall' : 'lava', said })
      })
    }, 60)
  }

  const landed = () => {
    setNote(run?.said ?? null)
    setRun(null)
  }

  const download = () => {
    if (report) save(`${stem}.zip`, () => packZip(report))
  }

  const downloadConfigs = () => save(`${stem}-configs.zip`, () => packZip(configs))

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label="Export a resource pack">
      <div className="dialog__scrim" onClick={onClose} />
      <div className="dialog__panel" ref={panel} style={{ width: 'min(620px, 100%)' }}>
        <header className="dialog__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Vellum</div>
            <h2 className="card__title">Export a resource pack</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dialog__body">
          <div className="field-grid">
            <label className="field">
              <span className="field__label">Namespace</span>
              <input
                className="field__input"
                value={namespace}
                aria-label="Namespace"
                onChange={(e) => setNamespace(e.target.value)}
              />
              <span className="field__hint">
                {nsOk ? (
                  <>
                    Models land at <code className="mono">assets/{namespace}/models/…</code>
                  </>
                ) : (
                  'Lowercase, digits, underscore, dot and dash only.'
                )}
              </span>
            </label>

            <label className="field">
              <span className="field__label">Pack format</span>
              <input
                className="field__input mono"
                type="number"
                min={1}
                value={packFormat}
                aria-label="Pack format"
                onChange={(e) => setPackFormat(Math.max(1, Number(e.target.value) || 1))}
              />
              <span className="field__hint">
                84 is Minecraft 26.1.2. Newer versions use higher numbers. It must match your
                server. If it&rsquo;s wrong, the pack won&rsquo;t load and Minecraft won&rsquo;t say why.
              </span>
            </label>

            <label className="field field--wide">
              <span className="field__label">Description</span>
              <input
                className="field__input"
                value={description}
                aria-label="Description"
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="field__hint">Shown under the pack name in the in-game list.</span>
            </label>
          </div>

          <div className="export">
            <div className="export__head">
              <Icon name="folder" size={12} />
              <span className="export__title">
                {models} model{models === 1 ? '' : 's'}
                {report ? ` · ${KB(packBytes(report))}` : ''}
              </span>
            </div>

            {report ? (
              <ul className="export__tree">
                {report.files.map((f) => (
                  <li key={f.path} data-kind={f.kind}>
                    <span className="export__path mono">{f.path}</span>
                    <span className="export__size mono">{KB(f.bytes.length)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {report?.skipped.length ? (
              <div className="export__output">
                <div className="export__output-head">Left out</div>
                {report.skipped.map((s) => (
                  <p key={s.id} className="export__output-row">
                    <strong>{s.id}</strong> — {s.why}
                  </p>
                ))}
              </div>
            ) : null}

            {/* list configs held back because their root key isn't confirmed */}
            {configs.skipped.some((s) => /root collection key/.test(s.why)) ? (
              <div className="export__output export__output--warn">
                <div className="export__output-head">Configs held back</div>
                {configs.skipped
                  .filter((s) => /root collection key/.test(s.why))
                  .map((s) => (
                    <p key={s.id} className="export__output-row">
                      <strong>{s.id}</strong> — its root key isn&rsquo;t confirmed yet. A wrong key
                      is an error that blocks the server&rsquo;s whole content reload, so this file
                      stays out of the zip. You can see it in the Config tab.
                    </p>
                  ))}
              </div>
            ) : null}

            {configs.files.length ? (
              <div className="export__output">
                <div className="export__output-head">
                  Also ready: {configs.files.length} config
                  {configs.files.length === 1 ? '' : 's'}
                </div>
                <p className="export__output-row">
                  <span className="mono">{configs.files.map((f) => f.path).join(', ')}</span>. These
                  say what each model <em>is</em> in game. The Vellum plugin reads them and Minecraft
                  ignores them, so they download separately from the pack.
                </p>
              </div>
            ) : null}

            {problems.length ? (
              <div className="export__output export__output--warn">
                <div className="export__output-head">Changed on the way in</div>
                {problems.map((r) => (
                  <p key={r.id} className="export__output-row">
                    <strong>{r.id}</strong> — {r.list[0].where ? `${r.list[0].where}: ` : ''}
                    {r.list[0].message}
                    {r.list.length > 1 ? ` (+${r.list.length - 1} more)` : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <p className="editor-hint">
            This pack is for servers with <strong>no Vellum plugin</strong>. With the plugin
            linked, use the pack it builds and serves from the same models. Don&rsquo;t use both.
          </p>

          <p className="editor-hint">
            Every model ships with Minecraft&rsquo;s default display transforms, because
            <code className="mono"> .vellum</code> doesn&rsquo;t store them. With no display block
            and no <code className="mono">parent</code>, a 16-unit item would look tiny in the
            hand and the inventory.
          </p>

          {note ? <p className="editor-hint editor-hint--warn">{note}</p> : null}
        </div>

        {run ? (
          <div className="export-run">
            <Pip mood={run.mood} failure={run.failure} onFinish={landed} label="Building the pack" />
          </div>
        ) : null}

        <footer className="dialog__foot">
          <span className="composer__hint mono">
            {items.filter((i) => !folderOf(i.kind)).length
              ? 'A mob’s geometry stays in the .vellum and its stats go in the configs zip'
              : 'Drop the zip in resourcepacks/'}
          </span>
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            {configs.files.length ? (
              <button className="btn" onClick={downloadConfigs} disabled={!!run}>
                <Icon name="download" size={13} /> Configs .zip
              </button>
            ) : null}
            <button className="btn btn--primary" disabled={!nsOk || !models || !!run} onClick={download}>
              <Icon name="download" size={13} /> Download .zip
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
