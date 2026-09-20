/* ---------------------------------------------------------------
   Exporting the shelf as a resource pack.

   A pack is a collection, not a model - one item in a pack of its own
   is not how anybody ships - so this hangs off the shelf rather than
   off the editor. It says what is going in, what is not and why, and
   it says it before the download rather than after.
   --------------------------------------------------------------- */

import { useMemo, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import { useModal } from '../../lib/a11y'
import { buildPack, folderOf, isNamespace, packBytes, packZip, safeId } from '../../lib/pack'
import type { PackItem } from '../../lib/pack'
import { saveBlob } from '../../lib/download'

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
  const [packFormat, setPackFormat] = useState(15)
  const [description, setDescription] = useState(`${suggestedName} — built in Vellum`)
  const [note, setNote] = useState<string | null>(null)

  const nsOk = isNamespace(namespace)

  const report = useMemo(
    () => (nsOk ? buildPack(items, { namespace, packFormat, description }) : null),
    [items, namespace, packFormat, description, nsOk],
  )

  const problems = useMemo(() => {
    if (!report) return []
    return report.issues
      .map((r) => ({ id: r.id, list: r.issues.filter((i) => i.level !== 'note') }))
      .filter((r) => r.list.length)
  }, [report])

  const models = report?.files.filter((f) => f.path.endsWith('.json') && f.path !== 'pack.mcmeta').length ?? 0

  const download = () => {
    if (!report) return
    const bytes = packZip(report)
    void saveBlob(`${safeId(suggestedName)}.zip`, new Blob([bytes as BlobPart], { type: 'application/zip' })).then(
      (m) => setNote(m || `Saved ${safeId(suggestedName)}.zip`),
    )
  }

  return (
    <div className="dlg" role="dialog" aria-modal="true" aria-label="Export a resource pack">
      <div className="dlg__scrim" onClick={onClose} />
      <div className="dlg__panel" ref={panel} style={{ width: 'min(620px, 100%)' }}>
        <header className="dlg__head">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Vellum</div>
            <h2 className="card__title">Export a resource pack</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dlg__body">
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
              {/* One integer per Minecraft version, and the wrong one
                  fails with no message worth reading. It is not guessed. */}
              <span className="field__hint">
                Your server&rsquo;s Minecraft version decides this. Get it wrong and the pack will
                not load, with nothing said about why.
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

          <div className="pk">
            <div className="pk__head">
              <Icon name="folder" size={12} />
              <span className="pk__title">
                {models} model{models === 1 ? '' : 's'}
                {report ? ` · ${KB(packBytes(report))}` : ''}
              </span>
            </div>

            {report ? (
              <ul className="pk__tree">
                {report.files.map((f) => (
                  <li key={f.path} data-kind={f.kind}>
                    <span className="pk__path mono">{f.path}</span>
                    <span className="pk__size mono">{KB(f.bytes.length)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {report?.skipped.length ? (
              <div className="pk__out">
                <div className="pk__outhead">Left out</div>
                {report.skipped.map((s) => (
                  <p key={s.id} className="pk__outrow">
                    <strong>{s.id}</strong> — {s.why}
                  </p>
                ))}
              </div>
            ) : null}

            {problems.length ? (
              <div className="pk__out pk__out--warn">
                <div className="pk__outhead">Changed on the way in</div>
                {problems.map((r) => (
                  <p key={r.id} className="pk__outrow">
                    <strong>{r.id}</strong> — {r.list[0].where ? `${r.list[0].where}: ` : ''}
                    {r.list[0].message}
                    {r.list.length > 1 ? ` (+${r.list.length - 1} more)` : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {note ? <p className="ed-hint ed-hint--warn">{note}</p> : null}
        </div>

        <footer className="dlg__foot">
          <span className="cmp__hint mono">
            {items.filter((i) => !folderOf(i.kind)).length
              ? 'Mobs stay in the .vellum — the plugin renders those'
              : 'Drop the zip in resourcepacks/'}
          </span>
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={!nsOk || !models} onClick={download}>
              <Icon name="download" size={13} /> Download .zip
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
