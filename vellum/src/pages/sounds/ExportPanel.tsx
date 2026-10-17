/* Getting a sound out: as Ogg Vorbis files for one event, or the whole board
   as a resource pack with its sounds.json, subtitles and pack.mcmeta. */

import { useEffect, useMemo, useState } from 'react'
import { buildSoundPack, eventOf, filesOf, oggOf, problems, renderVariants, soundsJson, zipOf } from '../../lib/audio/board'
import type { Board } from '../../lib/audio/board'
import type { Samples, Sound } from '../../lib/audio/synth'
import { RATE } from '../../lib/audio/synth'
import { saveBlob } from '../../lib/download'
import { Icon } from '../../lib/icons'
import { seconds } from './Scope'

type Props = {
  board: Board
  sound: Sound
  data: Float32Array
  samples: Samples
  onSound: (label: string, patch: Partial<Sound>) => void
  onBoard: (label: string, patch: Partial<Board>) => void
  say: (msg: string) => void
}

const kb = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)

async function copy(text: string, say: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text)
    say('Copied')
  } catch {
    say('This page cannot reach the clipboard. Select the text and copy it instead')
  }
}

/** Lets the page paint "Encoding…" before the work blocks it. */
const breathe = () => new Promise((r) => setTimeout(r, 30))

export function ExportPanel({ board, sound, data, samples, onSound, onBoard, say }: Props) {
  const event = eventOf(sound)
  const files = filesOf(sound)
  const issues = problems(board)
  const variants = Math.max(1, sound.variants ?? 1)
  const [busy, setBusy] = useState<string | null>(null)
  const [size, setSize] = useState<number | null>(null)

  // what one file of this sound comes to at this quality
  useEffect(() => {
    setSize(null)
    const id = setTimeout(() => setSize(oggOf(data, sound, board.quality).length), 250)
    return () => clearTimeout(id)
  }, [data, sound, board.quality])

  const dur = data.length / RATE
  const json = useMemo(() => JSON.stringify(soundsJson(board), null, 2), [board])
  const entry = useMemo(() => JSON.stringify({ [event]: soundsJson(board)[event] }, null, 2), [board, event])
  const command = `/playsound ${board.namespace}:${event} master @s`
  const v = sound.vanilla
  // /playsound's pitch comes after the position and the volume
  const vanillaCommand = v ? `/playsound minecraft:${v.event} master @s ~ ~ ~ 1 ${v.pitch}` : ''
  const a = sound.accent
  const accentCommands = a ? [...a.on.map((c) => `/playsound minecraft:${c.event} master @s ~ ~ ~ ${c.volume} ${c.pitch}`), command] : []

  const exportSound = async () => {
    setBusy('sound')
    await breathe()
    try {
      const datas = renderVariants(sound, samples)
      const oggs = datas.map((d) => oggOf(d, sound, board.quality))
      const base = (f: string) => f.slice(f.lastIndexOf('/') + 1)
      if (oggs.length === 1) say(await saveBlob(`${base(files[0])}.ogg`, new Blob([oggs[0] as Uint8Array<ArrayBuffer>], { type: 'audio/ogg' })))
      else {
        const zip = zipOf(oggs.map((bytes, i) => ({ path: `${base(files[i])}.ogg`, bytes })))
        say(await saveBlob(`${event}.zip`, new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })))
      }
    } finally {
      setBusy(null)
    }
  }

  const exportPack = async () => {
    setBusy('pack')
    await breathe()
    try {
      const pack = buildSoundPack(board, samples)
      const zip = zipOf(pack)
      say(await saveBlob(`${board.namespace}_sounds.zip`, new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })))
    } finally {
      setBusy(null)
    }
  }

  const blocked = issues.size > 0
  const soundIssue = issues.get(sound.id)

  return (
    <aside className="sb-export" aria-label="Export">
      <section className="sb-panel">
        <header className="sb-panel__head">
          <h2 className="sb-panel__title">Export this sound</h2>
          <span className="sb-tag mono">OGG Vorbis</span>
        </header>
        <label className="sb-field">
          <span className="sb-field__label">Sound event</span>
          <input
            className="mono"
            value={sound.event ?? ''}
            placeholder={eventOf({ ...sound, event: undefined })}
            spellCheck={false}
            onChange={(e) => onSound('Rename the event', { event: e.target.value.toLowerCase() || undefined })}
            aria-invalid={!!soundIssue || undefined}
          />
          <span className="sb-field__hint" data-bad={!!soundIssue || undefined}>
            {soundIssue ?? 'What /playsound and sounds.json call it. Dots make folders.'}
          </span>
        </label>

        <div className="sb-row">
          <div className="sb-field">
            <span className="sb-field__label" id="sb-variants">Variants</span>
            <div className="sb-stepper" role="group" aria-labelledby="sb-variants">
              <button className="icon-btn" aria-label="Fewer variants" disabled={variants <= 1} onClick={() => onSound('Variants', { variants: variants - 1 })}>
                <Icon name="minus" size={14} />
              </button>
              <span className="mono" aria-live="polite">{variants}</span>
              <button className="icon-btn" aria-label="More variants" disabled={variants >= 8} onClick={() => onSound('Variants', { variants: variants + 1 })}>
                <Icon name="plus" size={14} />
              </button>
            </div>
          </div>
          <label className="sb-field sb-field--grow">
            <span className="sb-field__label">
              Quality <span className="mono">{Math.round(board.quality * 10)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={Math.round(board.quality * 10)}
              onChange={(e) => onBoard('Quality', { quality: Number(e.target.value) / 10 })}
            />
          </label>
        </div>

        <ul className="sb-files mono" aria-label="Files">
          {files.map((f) => (
            <li key={f}>
              sounds/{f}.ogg
            </li>
          ))}
        </ul>
        <p className="sb-meta mono" aria-live="polite">
          mono · 44.1 kHz · {seconds(dur)} · {size === null ? 'measuring…' : `${kb(size)} · ${Math.round((size * 8) / Math.max(0.05, dur) / 1000)} kbps`}
          {variants > 1 ? ` · ±${sound.master.variation.toFixed(1)} st across ${variants}` : ''}
        </p>
        <button className="btn btn--primary btn--block" onClick={exportSound} disabled={!!busy || !!soundIssue}>
          <Icon name="download" size={14} />
          {busy === 'sound' ? 'Encoding…' : variants > 1 ? `Download ${variants} .ogg files (zip)` : 'Download .ogg'}
        </button>

        <div className="sb-code">
          <div className="sb-code__head">
            <span className="eyebrow">In game</span>
            <button className="btn btn--ghost btn--sm" onClick={() => copy(command, say)}>
              <Icon name="copy" size={12} /> Copy
            </button>
          </div>
          <code className="mono">{command}</code>
        </div>

        {v ? (
          <div className="sb-code sb-compare">
            <div className="sb-code__head">
              <span className="eyebrow">Compare with the game</span>
              <button className="btn btn--ghost btn--sm" onClick={() => copy(vanillaCommand, say)}>
                <Icon name="copy" size={12} /> Copy
              </button>
            </div>
            <p className="sb-compare__like">{v.like}</p>
            <code className="mono">{vanillaCommand}</code>
            {v.pitch !== 1 ? (
              <p className="sb-compare__note">
                The game plays this one at pitch {v.pitch}, so the command does too. The preset is made to sound like that.
              </p>
            ) : null}
          </div>
        ) : null}

        {a ? (
          <div className="sb-code sb-compare sb-accent">
            <div className="sb-code__head">
              <span className="eyebrow">Lay it on the game’s sound</span>
              <button className="btn btn--ghost btn--sm" onClick={() => copy(accentCommands.join('\n'), say)}>
                <Icon name="copy" size={12} /> Copy
              </button>
            </div>
            <p className="sb-compare__like">{a.adds}</p>
            <ul className="sb-accent__cues">
              {a.on.map((c) => (
                <li key={c.event}>
                  <span className="mono">{c.event}</span> pitch {c.pitch}, volume {c.volume}
                </li>
              ))}
              <li>
                this sound{a.after > 0 ? `, ${a.after} s later` : ', at the same time'}
              </li>
            </ul>
            <code className="mono">{accentCommands.join('\n')}</code>
            <p className="sb-compare__note">
              In the Studio, give the clip a Game sound cue for each of the game’s sounds and a cue for this one. To hear them together in game, run these lines from one function: typed into chat they play one after another.
              {a.on.some((c) => c.volume > 1) ? ' A volume above 1 is not louder: the game lets it be heard further away, about 16 blocks for each 1.' : ''}
            </p>
          </div>
        ) : null}
      </section>

      <section className="sb-panel">
        <header className="sb-panel__head">
          <h2 className="sb-panel__title">Resource pack</h2>
          <span className="sb-tag mono">{board.sounds.length} sounds</span>
        </header>
        <div className="sb-row">
          <label className="sb-field sb-field--grow">
            <span className="sb-field__label">Namespace</span>
            <input
              className="mono"
              value={board.namespace}
              spellCheck={false}
              onChange={(e) => onBoard('Namespace', { namespace: e.target.value.toLowerCase() })}
              aria-invalid={issues.has('') || undefined}
            />
          </label>
          <label className="sb-field sb-field--num">
            <span className="sb-field__label">pack_format</span>
            <input
              className="mono"
              type="number"
              min={1}
              value={board.packFormat}
              onChange={(e) => onBoard('Pack format', { packFormat: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
            />
          </label>
        </div>
        {issues.get('') ? <p className="sb-field__hint" data-bad>{issues.get('')}</p> : null}
        <label className="sb-field">
          <span className="sb-field__label">Description</span>
          <input value={board.description} onChange={(e) => onBoard('Description', { description: e.target.value })} />
        </label>
        <button className="btn btn--block" onClick={exportPack} disabled={!!busy || blocked}>
          <Icon name="download" size={14} />
          {busy === 'pack' ? `Encoding ${board.sounds.length} sounds…` : 'Download resource pack (.zip)'}
        </button>
        {blocked ? <p className="sb-field__hint" data-bad>Fix the names marked in red first.</p> : null}

        <div className="sb-code">
          <div className="sb-code__head">
            <span className="eyebrow">sounds.json</span>
            <button className="btn btn--ghost btn--sm" onClick={() => copy(json, say)}>
              <Icon name="copy" size={12} /> Copy all
            </button>
          </div>
          <pre className="mono" tabIndex={0} aria-label="This sound's entry in sounds.json">{entry}</pre>
        </div>
      </section>
    </aside>
  )
}
