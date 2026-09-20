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
import { buildConfigs, buildPack, folderOf, isNamespace, packBytes, packZip, safeId } from '../../lib/pack'
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
  /* 84 is what the plugin's own generator reads out of 26.1.2's
     version.json - a measured number, not a guessed one. It is still a
     field rather than a constant because the plugin flagged that 26.2
     may declare higher, and a stale constant here would be a confident
     lie rather than an open question. */
  const [packFormat, setPackFormat] = useState(84)
  const [description, setDescription] = useState(`${suggestedName} — built in Vellum`)
  const [note, setNote] = useState<string | null>(null)

  const nsOk = isNamespace(namespace)

  const report = useMemo(
    () => (nsOk ? buildPack(items, { namespace, packFormat, description }) : null),
    [items, namespace, packFormat, description, nsOk],
  )

  /* Warnings only. An error is not a change on the way in - the model
     was refused - and it says so under "Left out" with the reason on it. */
  const problems = useMemo(() => {
    if (!report) return []
    const refused = new Set(report.skipped.map((s) => s.id))
    return report.issues
      .filter((r) => !refused.has(r.id))
      .map((r) => ({ id: r.id, list: r.issues.filter((i) => i.level === 'warning') }))
      .filter((r) => r.list.length)
  }, [report])

  const models = report?.files.filter((f) => f.path.endsWith('.json') && f.path !== 'pack.mcmeta').length ?? 0

  /* The configs are a SEPARATE archive on purpose: they go in the
     plugin's folder, not in resourcepacks/, and burying them inside
     the pack would invite dropping the whole thing in the wrong place. */
  const configs = useMemo(() => buildConfigs(items), [items])

  const stem = safeId(suggestedName)

  const save = (name: string, bytes: Uint8Array) =>
    void saveBlob(name, new Blob([bytes as BlobPart], { type: 'application/zip' })).then((m) =>
      setNote(m || `Saved ${name}`),
    )

  const download = () => {
    if (!report) return
    save(`${stem}.zip`, packZip(report))
  }

  const downloadConfigs = () => save(`${stem}-mythicmobs.zip`, packZip(configs))

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
                84 is Minecraft 26.1.2. Your server&rsquo;s version decides it, and a newer one
                declares higher — get it wrong and the pack will not load, with nothing said
                about why.
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

            {configs.files.length ? (
              <div className="pk__out">
                <div className="pk__outhead">
                  Also ready — {configs.files.length} MythicMobs config
                  {configs.files.length === 1 ? '' : 's'}
                </div>
                <p className="pk__outrow">
                  <span className="mono">{configs.files.map((f) => f.path).join(', ')}</span> — these
                  belong in the plugin&rsquo;s folder, not in the pack, so they download separately.
                </p>
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

          <p className="ed-hint">
            This is the pack for a server with <strong>no Vellum plugin</strong>. With the plugin
            linked, it builds and serves its own pack from the same models — two pipelines that
            can disagree would be worse than one.
          </p>

          <p className="ed-hint">
            Every model ships with Minecraft&rsquo;s default display transforms, because
            <code className="mono"> .vellum</code> does not carry them — without a display block
            and without a <code className="mono">parent</code>, a 16-unit item renders as a speck
            in the hand and the inventory.
          </p>

          {note ? <p className="ed-hint ed-hint--warn">{note}</p> : null}
        </div>

        <footer className="dlg__foot">
          <span className="cmp__hint mono">
            {items.filter((i) => !folderOf(i.kind)).length
              ? 'A mob’s geometry stays in the .vellum — its config is in the second zip'
              : 'Drop the zip in resourcepacks/'}
          </span>
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            {configs.files.length ? (
              <button className="btn" onClick={downloadConfigs}>
                <Icon name="download" size={13} /> Configs .zip
              </button>
            ) : null}
            <button className="btn btn--primary" disabled={!nsOk || !models} onClick={download}>
              <Icon name="download" size={13} /> Download .zip
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
