/* The sound console (#/sounds). A board of pads on the left, each a sound;
   the console in the middle, where the selected sound's layers are mixed on
   channel strips and shaped with knobs; the export on the right. Sounds are
   made from scratch or from the library, or from imported or recorded audio,
   and leave as Ogg Vorbis, the format Minecraft plays. */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Menu } from '../components/Menu'
import type { MenuEntry } from '../components/Menu'
import { useHistory } from '../lib/history'
import { Icon } from '../lib/icons'
import { useTitle } from '../lib/router'
import { decodeSample, loadBoard, loadSamples, saveBoard, saveSamples, SAMPLE_MAX } from '../lib/audio/board'
import type { Board } from '../lib/audio/board'
import { play } from '../lib/audio/player'
import type { Voice } from '../lib/audio/player'
import { GROUPS, blankSound, fromPreset, presets } from '../lib/audio/presets'
import { RATE, WAVES, cloneSound, layer, render, uid } from '../lib/audio/synth'
import type { Layer, Master, Samples, Sound, Wave } from '../lib/audio/synth'
import { ExportPanel } from './sounds/ExportPanel'
import { LayerInspector, MasterInspector } from './sounds/Inspector'
import { Scope } from './sounds/Scope'
import { groupColour, layerColour } from './sounds/colours'
import './Sounds.css'

/** The keys that play the pads, in pad order. */
const KEYS = '1234567890qwertyuiop'

/* Renders are kept per sound object. Edits replace the object, so a stale
   entry is never read; it just falls out with the old object. */
let cache = new WeakMap<Sound, Float32Array>()
function rendered(s: Sound, samples: Samples) {
  let d = cache.get(s)
  if (!d) {
    d = render(s, { samples })
    cache.set(s, d)
  }
  return d
}

const typing = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)

/** A new layer's starting point for each source. */
function freshLayer(w: Wave, n: number, sample?: string): Layer {
  const base: Partial<Layer> = { name: `${WAVES.find((x) => x.id === w)!.label} ${n}`, wave: w, sustain: 0, decay: 0.3, length: 0.4, release: 0.02 }
  if (w === 'noise') return layer({ ...base, pitch: 300, pitchEnd: 200, filter: 'lowpass', cutoff: 3000, cutoffEnd: 800 })
  if (w === 'hiss') return layer({ ...base, filter: 'bandpass', cutoff: 2500, cutoffEnd: 2500, resonance: 1 })
  if (w === 'rumble') return layer({ ...base, filter: 'lowpass', cutoff: 400, cutoffEnd: 200, length: 0.8, decay: 0.6 })
  if (w === 'pluck') return layer({ ...base, pitch: 370, pitchEnd: 370, length: 1, decay: 0.9, bright: 0.6, attack: 0.001 })
  if (w === 'bubbles') return layer({ ...base, pitch: 25, pitchEnd: 25, length: 1, decay: 0.1, sustain: 1, attack: 0.02, release: 0.3, bubble: 900 })
  if (w === 'crackle') return layer({ ...base, pitch: 30, pitchEnd: 30, length: 1.5, decay: 0.1, sustain: 1, attack: 0.05, release: 0.3, filter: 'highpass', cutoff: 1500, cutoffEnd: 1500 })
  if (w === 'sample') return layer({ ...base, sample, sustain: 1, decay: 0.1, attack: 0.002 })
  return layer({ ...base, pitch: 440, pitchEnd: 440 })
}

/* ---------------- the pads ---------------- */

function Pad({
  sound,
  index,
  samples,
  selected,
  hit,
  onPlay,
}: {
  sound: Sound
  index: number
  samples: Samples
  selected: boolean
  hit: boolean
  onPlay: () => void
}) {
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    // draw after paint, so a full board does not hold up the page
    const id = setTimeout(() => {
      const c = cv.current
      if (!c) return
      const d = rendered(sound, samples)
      const w = (c.width = 120)
      const h = (c.height = 30)
      const g = c.getContext('2d')!
      g.clearRect(0, 0, w, h)
      g.fillStyle = 'rgba(255,255,255,0.55)'
      const per = d.length / w
      for (let x = 0; x < w; x++) {
        let m = 0
        for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) m = Math.max(m, Math.abs(d[i]))
        const y = Math.max(0.5, m * (h / 2 - 1))
        g.fillRect(x, h / 2 - y, 1, y * 2)
      }
    }, 0)
    return () => clearTimeout(id)
  }, [sound, samples])
  const key = KEYS[index]
  return (
    <button
      className="pad"
      aria-pressed={selected}
      data-hit={hit || undefined}
      style={{ '--pad': groupColour(sound.group) } as CSSProperties}
      onClick={onPlay}
      aria-label={`${sound.name}${key ? `, key ${key.toUpperCase()}` : ''}. Play and edit`}
      aria-keyshortcuts={key}
    >
      <span className="pad__top">
        <span className="pad__group">{sound.group}</span>
        {key ? <kbd className="pad__key mono">{key.toUpperCase()}</kbd> : null}
      </span>
      <canvas ref={cv} className="pad__wave" aria-hidden="true" />
      <span className="pad__name">{sound.name}</span>
    </button>
  )
}

/* ---------------- a channel strip ---------------- */

function Strip({
  l,
  selected,
  onSelect,
  onLayer,
}: {
  l: Layer
  selected: boolean
  onSelect: () => void
  onLayer: (label: string, patch: Partial<Layer>, coalesce?: boolean) => void
}) {
  return (
    <div className="strip" data-selected={selected || undefined} data-off={l.muted || undefined} style={{ '--strip': layerColour(l) } as CSSProperties}>
      <button className="strip__head" onClick={onSelect} aria-pressed={selected} aria-label={`Edit ${l.name}`}>
        <span className="strip__led" aria-hidden="true" />
        <span className="strip__name">{l.name}</span>
        <span className="strip__wave mono">{WAVES.find((w) => w.id === l.wave)!.label}</span>
      </button>
      <div className="strip__btns">
        <button className="strip__btn" aria-pressed={l.muted} aria-label={`Mute ${l.name}`} title="Mute" onClick={() => onLayer('Mute', { muted: !l.muted }, false)}>
          M
        </button>
        <button className="strip__btn strip__btn--solo" aria-pressed={l.solo} aria-label={`Solo ${l.name}`} title="Solo" onClick={() => onLayer('Solo', { solo: !l.solo }, false)}>
          S
        </button>
      </div>
      <input
        className="strip__fader"
        type="range"
        min={0}
        max={150}
        value={Math.round(l.gain * 100)}
        aria-label={`Level of ${l.name}`}
        aria-valuetext={`${Math.round(l.gain * 100)}%`}
        onChange={(e) => onLayer('Level', { gain: Number(e.target.value) / 100 })}
      />
      <span className="strip__val mono">{Math.round(l.gain * 100)}</span>
    </div>
  )
}

/* ---------------- the page ---------------- */

export function Sounds() {
  useTitle('Sounds')
  const hist = useHistory<Board>(loadBoard())
  const board = hist.present
  const [soundId, setSoundId] = useState(() => board.sounds[0]?.id ?? '')
  const sound = board.sounds.find((s) => s.id === soundId) ?? board.sounds[0]
  const [sel, setSel] = useState<string>(() => sound?.layers[0]?.id ?? 'master')
  const [samples, setSamples] = useState<Samples>(loadSamples)
  const [mode, setMode] = useState<'wave' | 'spectrum'>('wave')
  const [loop, setLoop] = useState(false)
  const [auto, setAuto] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [hits, setHits] = useState<Record<string, number>>({})
  const [status, setStatus] = useState('')
  const [group, setGroup] = useState<string>('All')
  const [recording, setRecording] = useState<{ stop: () => void; at: number } | null>(null)
  const voice = useRef<Voice | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const replay = useRef(false)

  useEffect(() => {
    cache = new WeakMap()
  }, [samples])

  // keep the board; storage is per browser
  useEffect(() => {
    const id = setTimeout(() => {
      if (!saveBoard(board)) setStatus('This browser would not save the board. Export what you need to keep')
    }, 300)
    return () => clearTimeout(id)
  }, [board])

  const say = useCallback((m: string) => setStatus(m), [])

  /* ---------- editing ---------- */

  const editSound = useCallback(
    (label: string, fn: (s: Sound) => Sound, coalesce = true) => {
      if (!sound) return
      const id = sound.id
      replay.current = true
      hist.commit(label, (b) => ({ ...b, sounds: b.sounds.map((s) => (s.id === id ? fn(s) : s)) }), coalesce)
    },
    [hist, sound],
  )
  const onLayer = useCallback(
    (id: string) => (label: string, patch: Partial<Layer>, coalesce = true) =>
      editSound(label, (s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), coalesce),
    [editSound],
  )
  const onMaster = useCallback(
    (label: string, patch: Partial<Master>) => editSound(label, (s) => ({ ...s, master: { ...s.master, ...patch } })),
    [editSound],
  )
  const onSound = useCallback((label: string, patch: Partial<Sound>) => editSound(label, (s) => ({ ...s, ...patch })), [editSound])
  const onBoard = useCallback((label: string, patch: Partial<Board>) => hist.commit(label, (b) => ({ ...b, ...patch }), true), [hist])

  const select = (s: Sound) => {
    setSoundId(s.id)
    setSel((cur) => (cur === 'master' || s.layers.some((l) => l.id === cur) ? cur : (s.layers[0]?.id ?? 'master')))
  }

  const addSound = (s: Sound, label = 'Add a sound') => {
    hist.commit(label, (b) => ({ ...b, sounds: [...b.sounds, s] }))
    setSoundId(s.id)
    setSel(s.layers[0]?.id ?? 'master')
    replay.current = true
  }

  const removeSound = () => {
    if (!sound) return
    const i = board.sounds.findIndex((s) => s.id === sound.id)
    const rest = board.sounds.filter((s) => s.id !== sound.id)
    hist.commit(`Delete ${sound.name}`, (b) => ({ ...b, sounds: b.sounds.filter((s) => s.id !== sound.id) }))
    const next = rest[Math.min(i, rest.length - 1)]
    if (next) select(next)
    setStatus(`Deleted ${sound.name}. Ctrl+Z brings it back.`)
  }

  const addLayer = (w: Wave, sample?: string) => {
    if (!sound) return
    const l = freshLayer(w, sound.layers.length + 1, sample)
    editSound('Add a layer', (s) => ({ ...s, layers: [...s.layers, l] }), false)
    setSel(l.id)
  }

  /* ---------- playing ---------- */

  const deferred = useDeferredValue(sound)
  const data = useMemo(() => (deferred ? rendered(deferred, samples) : new Float32Array(1)), [deferred, samples])

  const stop = useCallback(() => {
    voice.current?.stop()
    voice.current = null
    setPlaying(false)
  }, [])

  const start = useCallback(
    (d: Float32Array, from = 0) => {
      voice.current?.stop()
      const v = play(d, { from, loop })
      voice.current = v
      setPlaying(true)
      void v.ended.then(() => {
        if (voice.current === v) {
          voice.current = null
          setPlaying(false)
        }
      })
    },
    [loop],
  )

  const playhead = useCallback(() => voice.current?.position() ?? null, [])

  // play a moment after an edit settles, as sfxr does
  useEffect(() => {
    if (!replay.current || !auto) return
    const id = setTimeout(() => {
      replay.current = false
      start(data)
    }, 220)
    return () => clearTimeout(id)
  }, [data, auto, start])

  const playVariant = () => {
    if (!sound) return
    const v = sound.master.variation
    const shift = (Math.random() * 2 - 1) * v
    start(render(sound, { seed: Math.floor(Math.random() * 1e9), shift, samples }))
    setStatus(`A variant ${shift >= 0 ? '+' : ''}${shift.toFixed(1)} semitones`)
  }

  const hitPad = (s: Sound) => {
    select(s)
    const v = play(rendered(s, samples))
    const n = Date.now()
    setHits((h) => ({ ...h, [s.id]: n }))
    void v.ended.then(() => setHits((h) => (h[s.id] === n ? { ...h, [s.id]: 0 } : h)))
  }

  /* ---------- the keyboard ---------- */

  const keyRef = useRef({ board, hitPad, data, start, stop, playing, hist })
  keyRef.current = { board, hitPad, data, start, stop, playing, hist }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyRef.current
      if (typing(document.activeElement)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) k.hist.redo()
        else k.hist.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        k.hist.redo()
        return
      }
      if (mod || e.altKey) return
      if (e.key === ' ' && !(document.activeElement instanceof HTMLButtonElement)) {
        e.preventDefault()
        if (k.playing) k.stop()
        else k.start(k.data)
        return
      }
      const i = KEYS.indexOf(e.key.toLowerCase())
      if (i >= 0 && k.board.sounds[i] && !e.repeat) {
        e.preventDefault()
        k.hitPad(k.board.sounds[i])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- audio in ---------- */

  const takeSample = async (name: string, bytes: ArrayBuffer) => {
    try {
      const s = await decodeSample(name, bytes)
      const id = uid('a')
      const next = { ...samples, [id]: s }
      setSamples(next)
      const kept = saveSamples(next)
      const dur = s.data.length / s.rate
      const snd: Sound = {
        ...blankSound(name.replace(/\.[a-z0-9]+$/i, '')),
        layers: [layer({ name: 'Sample', wave: 'sample', sample: id, length: dur, sustain: 1, decay: 0.1, attack: 0.002, release: 0.02 })],
      }
      addSound(snd, 'Import audio')
      setStatus(
        `${name}: ${dur.toFixed(2)} s${dur >= SAMPLE_MAX ? ` (cut to ${SAMPLE_MAX} s)` : ''}` +
          (kept ? '' : '. Too big to keep in this browser; it lasts until the page closes'),
      )
    } catch {
      setStatus(`${name} is not audio this browser can read`)
    }
  }

  const importFile = async (f: File) => takeSample(f.name, await f.arrayBuffer())

  const record = async () => {
    if (recording) {
      recording.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const parts: Blob[] = []
      rec.ondataavailable = (e) => parts.push(e.data)
      const limit = setTimeout(() => rec.state === 'recording' && rec.stop(), SAMPLE_MAX * 1000)
      rec.onstop = async () => {
        clearTimeout(limit)
        stream.getTracks().forEach((t) => t.stop())
        setRecording(null)
        const blob = new Blob(parts, { type: rec.mimeType })
        await takeSample(`Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, await blob.arrayBuffer())
      }
      rec.start()
      setRecording({ stop: () => rec.stop(), at: Date.now() })
      setStatus('Recording. Press Stop when done.')
    } catch {
      setStatus('The microphone is not available on this page')
    }
  }

  /* ---------- menus ---------- */

  const newEntries: MenuEntry[] = [
    { label: 'Blank sound', icon: 'plus', onSelect: () => addSound(blankSound()) },
    { label: 'Import audio file…', icon: 'upload', onSelect: () => fileInput.current?.click() },
    { label: recording ? 'Stop recording' : 'Record from microphone', icon: 'mic', onSelect: record },
  ]
  const soundEntries: MenuEntry[] = sound
    ? [
        { label: 'Duplicate', icon: 'copy', onSelect: () => addSound(cloneSound(sound, { name: `${sound.name} copy`, event: undefined }), 'Duplicate') },
        { label: 'New seed (other noise)', icon: 'shuffle', onSelect: () => onSound('New seed', { seed: Math.floor(Math.random() * 1e9) }) },
        { kind: 'separator' },
        { label: 'Delete sound', icon: 'trash', danger: true, onSelect: removeSound },
      ]
    : []
  const layerEntries: MenuEntry[] = [
    { kind: 'label', label: 'Add a layer' },
    ...WAVES.filter((w) => w.id !== 'sample').map((w) => ({ label: w.label, onSelect: () => addLayer(w.id) })),
    { label: 'Sample…', onSelect: () => addLayer('sample', Object.keys(samples)[0]) },
  ]

  const current = sound?.layers.find((l) => l.id === sel)
  const library = presets.filter((p) => group === 'All' || p.group === group)

  return (
    <main className="page sb">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sound console</div>
          <h1 className="page-title">Sounds</h1>
          <p className="page-sub">
            Make sound effects in the manner of the game&rsquo;s own and export them as Ogg Vorbis, for a resource pack or a
            mob&rsquo;s clips. Keys 1&ndash;0 and Q&ndash;P play the pads, and Space plays the open sound.
          </p>
        </div>
        <div className="sb-head-actions">
          <Menu
            entries={newEntries}
            trigger={({ props }) => (
              <button className="btn btn--primary" {...props}>
                <Icon name="plus" size={14} /> New sound
              </button>
            )}
          />
          {recording ? (
            <button className="btn sb-rec" onClick={() => recording.stop()}>
              <span className="sb-rec__dot" aria-hidden="true" /> Stop recording
            </button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.ogg,.wav,.mp3,.flac,.m4a"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="sb-grid">
        {/* ---------------- board ---------------- */}
        <aside className="sb-board" aria-label="Board">
          <section className="sb-panel">
            <header className="sb-panel__head">
              <h2 className="sb-panel__title">Board</h2>
              <span className="sb-tag mono">{board.sounds.length}</span>
            </header>
            {board.sounds.length ? (
              <div className="pads">
                {board.sounds.map((s, i) => (
                  <Pad key={s.id} sound={s} index={i} samples={samples} selected={s.id === sound?.id} hit={!!hits[s.id]} onPlay={() => hitPad(s)} />
                ))}
              </div>
            ) : (
              <p className="sb-empty">No sounds yet. Start one with New sound, or add one from the library below.</p>
            )}
          </section>
          <section className="sb-panel">
            <header className="sb-panel__head">
              <h2 className="sb-panel__title">Library</h2>
            </header>
            <div className="sb-chips" role="radiogroup" aria-label="Library group">
              {['All', ...GROUPS].map((g) => (
                <button key={g} role="radio" aria-checked={group === g} className="sb-chip" onClick={() => setGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
            <ul className="lib">
              {library.map((p) => (
                <li key={p.name} className="lib__row" style={{ '--pad': groupColour(p.group) } as CSSProperties}>
                  <button
                    className="icon-btn"
                    aria-label={`Hear ${p.name}`}
                    onClick={() => {
                      const s = fromPreset(p)
                      start(render(s, { samples }))
                    }}
                  >
                    <Icon name="play" size={13} />
                  </button>
                  <span className="lib__what" title={p.vanilla?.like ?? p.accent?.adds}>
                    <span className="lib__name">{p.name}</span>
                    <span className="lib__like mono">{p.vanilla ? `like ${p.vanilla.event}` : `on ${p.accent?.on.map((c) => c.event).join(' + ')}`}</span>
                  </span>
                  <span className="lib__group">{p.group}</span>
                  <button className="btn btn--ghost btn--sm" onClick={() => addSound(fromPreset(p), `Add ${p.name}`)} aria-label={`Add ${p.name} to the board`}>
                    <Icon name="plus" size={12} /> Add
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* ---------------- console ---------------- */}
        {sound ? (
          <section className="sb-console" aria-label="Console">
            <div className="sb-panel sb-deck">
              <div className="deck__bar">
                <input
                  className="deck__name"
                  value={sound.name}
                  aria-label="Sound name"
                  onChange={(e) => onSound('Rename', { name: e.target.value })}
                />
                <label className="deck__group">
                  <span className="visually-hidden">Group</span>
                  <select value={sound.group} onChange={(e) => onSound('Group', { group: e.target.value })}>
                    {GROUPS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <div className="deck__transport">
                  <button className="icon-btn" onClick={hist.undo} disabled={!hist.canUndo} aria-label={hist.undoLabel ? `Undo ${hist.undoLabel}` : 'Undo'} title="Undo (Ctrl+Z)">
                    <Icon name="undo" size={15} />
                  </button>
                  <button className="icon-btn" onClick={hist.redo} disabled={!hist.canRedo} aria-label={hist.redoLabel ? `Redo ${hist.redoLabel}` : 'Redo'} title="Redo (Ctrl+Shift+Z)">
                    <Icon name="redo" size={15} />
                  </button>
                  <span className="deck__sep" aria-hidden="true" />
                  <button className="deck__play" onClick={() => (playing ? stop() : start(data))} aria-label={playing ? 'Stop' : 'Play'} title="Play or stop (Space)">
                    <Icon name={playing ? 'stop' : 'play'} size={16} filled />
                  </button>
                  <button className="icon-btn" aria-pressed={loop} onClick={() => setLoop((v) => !v)} aria-label="Loop" title="Loop">
                    <Icon name="repeat" size={15} />
                  </button>
                  <button className="icon-btn" onClick={playVariant} aria-label="Play a random variant" title="Play a random variant">
                    <Icon name="shuffle" size={15} />
                  </button>
                  <Menu
                    entries={soundEntries}
                    trigger={({ props }) => (
                      <button className="icon-btn" {...props} aria-label="Sound actions">
                        <Icon name="dots" size={16} />
                      </button>
                    )}
                  />
                </div>
              </div>

              <div className="deck__view">
                <div className="sb-seg" role="radiogroup" aria-label="Display">
                  <button role="radio" aria-checked={mode === 'wave'} onClick={() => setMode('wave')}>
                    Wave
                  </button>
                  <button role="radio" aria-checked={mode === 'spectrum'} onClick={() => setMode('spectrum')}>
                    Spectrum
                  </button>
                </div>
                <label className="sb-check">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                  Play on change
                </label>
              </div>

              <Scope
                data={data}
                layers={sound.layers}
                selected={sel}
                mode={mode}
                playing={playing}
                playhead={playhead}
                onSeek={(t) => start(data, t)}
                onSelect={setSel}
                onMove={(id, at, length, done) => {
                  const l = sound.layers.find((x) => x.id === id)
                  if (!l || (l.at === at && l.length === length && !done)) return
                  onLayer(id)(l.length !== length ? 'Length' : 'Move', { at, length })
                }}
              />
            </div>

            <div className="sb-panel sb-mixer" aria-label="Mixer">
              <div className="mixer__strips">
                {sound.layers.map((l) => (
                  <Strip key={l.id} l={l} selected={sel === l.id} onSelect={() => setSel(l.id)} onLayer={onLayer(l.id)} />
                ))}
              </div>
              <Menu
                align="end"
                entries={layerEntries}
                trigger={({ props }) => (
                  <button className="strip strip--add" {...props} aria-label="Add a layer">
                    <Icon name="plus" size={18} />
                    <span>Layer</span>
                  </button>
                )}
              />
              <div className="strip strip--master" data-selected={sel === 'master' || undefined}>
                <button className="strip__head" onClick={() => setSel('master')} aria-pressed={sel === 'master'} aria-label="Edit the master bus">
                  <span className="strip__led" aria-hidden="true" />
                  <span className="strip__name">Master</span>
                  <span className="strip__wave mono">echo · verb</span>
                </button>
                <Meter data={data} playing={playing} playhead={playhead} />
                <input
                  className="strip__fader"
                  type="range"
                  min={0}
                  max={150}
                  value={Math.round(sound.master.gain * 100)}
                  aria-label="Master level"
                  onChange={(e) => onMaster('Master gain', { gain: Number(e.target.value) / 100 })}
                />
                <span className="strip__val mono">{Math.round(sound.master.gain * 100)}</span>
              </div>
            </div>

            <div className="sb-panel sb-insp">
              {current ? (
                <>
                  <header className="insp__bar" style={{ '--strip': layerColour(current) } as CSSProperties}>
                    <span className="strip__led" aria-hidden="true" />
                    <input
                      className="insp__name"
                      value={current.name}
                      aria-label="Layer name"
                      onChange={(e) => onLayer(current.id)('Rename the layer', { name: e.target.value })}
                    />
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        const copy = { ...current, id: uid('l'), name: `${current.name} copy`, solo: false }
                        editSound('Duplicate the layer', (s) => {
                          const i = s.layers.findIndex((l) => l.id === current.id)
                          const layers = [...s.layers]
                          layers.splice(i + 1, 0, copy)
                          return { ...s, layers }
                        }, false)
                        setSel(copy.id)
                      }}
                    >
                      <Icon name="copy" size={12} /> Duplicate
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={sound.layers.length <= 1}
                      onClick={() => {
                        const i = sound.layers.findIndex((l) => l.id === current.id)
                        editSound('Delete the layer', (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== current.id) }), false)
                        const rest = sound.layers.filter((l) => l.id !== current.id)
                        setSel(rest[Math.min(i, rest.length - 1)]?.id ?? 'master')
                      }}
                    >
                      <Icon name="trash" size={12} /> Delete
                    </button>
                  </header>
                  <LayerInspector layer={current} samples={samples} onLayer={onLayer(current.id)} onImport={() => fileInput.current?.click()} />
                </>
              ) : (
                <>
                  <header className="insp__bar" style={{ '--strip': 'var(--ink)' } as CSSProperties}>
                    <span className="strip__led" aria-hidden="true" />
                    <span className="insp__title">Master bus</span>
                  </header>
                  <MasterInspector master={sound.master} onMaster={onMaster} />
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="sb-console sb-panel">
            <p className="sb-empty">The board is empty. Make a new sound to open the console.</p>
          </section>
        )}

        {sound ? (
          <ExportPanel board={board} sound={sound} data={data} samples={samples} onSound={onSound} onBoard={onBoard} say={say} />
        ) : null}
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
      {status ? (
        <div className="sb-toast" aria-hidden="true" key={status}>
          {status}
        </div>
      ) : null}
    </main>
  )
}

/** A peak meter: the level under the playhead while playing, the sound's peak when not. */
function Meter({ data, playing, playhead }: { data: Float32Array; playing: boolean; playhead: () => number | null }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    let held = 0
    const peakAll = () => {
      let m = 0
      for (let i = 0; i < data.length; i += 4) m = Math.max(m, Math.abs(data[i]))
      return m
    }
    const set = (v: number) => {
      const db = 20 * Math.log10(Math.max(1e-5, v))
      const p = Math.max(0, Math.min(1, (db + 48) / 48))
      bar.current?.style.setProperty('--level', String(p))
    }
    if (!playing) {
      set(peakAll())
      return
    }
    const tick = () => {
      const t = playhead()
      if (t !== null) {
        const i = Math.floor(t * RATE)
        let m = 0
        for (let j = Math.max(0, i - 1024); j < Math.min(data.length, i + 256); j++) m = Math.max(m, Math.abs(data[j]))
        held = Math.max(m, held * 0.9)
        set(held)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [data, playing, playhead])
  return (
    <div className="meter" ref={bar} aria-hidden="true">
      <span />
    </div>
  )
}
