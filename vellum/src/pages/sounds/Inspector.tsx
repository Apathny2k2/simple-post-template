/* The knobs for the selected layer, or for the master bus. Every change goes
   through `onLayer` / `onMaster` with a label, so a drag is one undo step. */

import type { ReactNode } from 'react'
import { WAVES, pitched } from '../../lib/audio/synth'
import type { FilterType, Layer, Master, Samples, Wave } from '../../lib/audio/synth'
import { Icon } from '../../lib/icons'
import { Knob } from './Knob'
import { layerColour, waveColour } from './colours'
import { seconds } from './Scope'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** 440 → "440 Hz A4" */
export function hz(f: number) {
  const n = Math.round(12 * Math.log2(f / 440)) + 57
  const name = `${NOTES[((n % 12) + 12) % 12]}${Math.floor(n / 12)}`
  return f >= 10000 ? `${(f / 1000).toFixed(1)}k ${name}` : `${Math.round(f)} Hz ${name}`
}
const khz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${Math.round(f)} Hz`)
const pct = (v: number) => `${Math.round(v * 100)}%`
const st = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} st`
const times = (v: number) => `×${Math.round(v * 100) / 100}`
const VOWEL_NAMES = ['i', 'e', 'a', 'o', 'u']
const vowelName = (v: number) => {
  const a = Math.min(3, Math.floor(v))
  const fr = v - a
  return fr < 0.1 ? VOWEL_NAMES[a] : fr > 0.9 ? VOWEL_NAMES[a + 1] : `${VOWEL_NAMES[a]}→${VOWEL_NAMES[a + 1]}`
}

/* Small drawings of each wave for the source picker. */
const WAVE_PATH: Record<Wave, string> = {
  sine: 'M1 8C3 1 5 1 7 8s4 7 6 0 4-7 6 0',
  triangle: 'M1 8 4 2l6 12 6-12 3 6',
  square: 'M1 8V2h5v12h6V2h6v6',
  saw: 'M1 14 7 2v12l6-12v12l6-12',
  pluck: 'M1 8c1-7 2-7 3 0s2 6 3 0 2-4 3 0 2 3 3 0 2-2 3 0 1 1 3 0',
  noise: 'M1 8h2V3h2v9h2V5h2v8h2V2h2v10h2V6h2v2',
  hiss: 'M1 8l1-4 1 7 1-9 1 8 1-5 1 6 1-8 1 9 1-6 1 4 1-7 1 8 1-3 1 2 1-4 1 5',
  rumble: 'M1 9c2-3 3 3 5 0s2-5 4-2 3 4 5 1 2-3 4-1',
  crackle: 'M1 8h3V2v12V8h5V5v6V8h4V1v14V8h5',
  bubbles: 'M5 11a2 2 0 1 0 0 .1M12 7a3 3 0 1 0 0 .1M16 13a1.5 1.5 0 1 0 0 .1',
  sample: 'M1 8h3l1-5 2 10 2-12 2 14 2-9 2 4h3',
}

function WaveGlyph({ w }: { w: Wave }) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
      <path d={WAVE_PATH[w]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="insp__section" aria-label={title}>
      <header className="insp__head">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </header>
      <div className="insp__knobs">{children}</div>
    </section>
  )
}

/** The envelope as a curve, so attack, decay, sustain and release can be seen. */
function EnvelopeView({ l }: { l: Layer }) {
  const W = 220
  const H = 54
  const len = Math.max(0.001, l.length)
  const pts: string[] = []
  const att = Math.max(0.0005, l.attack)
  const tau = Math.max(0.001, l.decay) / 5
  const rel = Math.min(Math.max(0.001, l.release), len)
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * len
    let v = t < att ? t / att : l.sustain + (1 - l.sustain) * Math.exp(-(t - att) / tau)
    if (t > len - rel) v *= ((len - t) / rel) ** 2
    pts.push(`${(i / 120) * W},${H - 3 - v * (H - 8)}`)
  }
  return (
    <svg className="insp__env" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} />
      <polyline points={pts.join(' ')} />
    </svg>
  )
}

type LayerProps = {
  layer: Layer
  samples: Samples
  onLayer: (label: string, patch: Partial<Layer>) => void
  onImport: () => void
}

export function LayerInspector({ layer: l, samples, onLayer, onImport }: LayerProps) {
  const c = layerColour(l)
  const k = (key: keyof Layer, label: string) => (v: number) => onLayer(label, { [key]: v } as Partial<Layer>)
  const isSample = l.wave === 'sample'
  // crackle and bubbles are counted, not pitched: their pitch knobs set how many a second
  const isCrackle = l.wave === 'crackle' || l.wave === 'bubbles'
  const vowel = l.filter === 'vowel'
  // FM bends the phase of an oscillator; the others have no phase to bend
  const fmable = ['sine', 'triangle', 'square', 'saw'].includes(l.wave)
  const rateOf = (v: number) => `${v < 100 ? v.toFixed(1) : Math.round(v)} /s`
  const tone = pitched(l.wave)
  const sampleIds = Object.keys(samples)

  return (
    <div className="insp">
      <Section title="Source">
        <div className="insp__waves" role="radiogroup" aria-label="Source">
          {WAVES.map((w) => (
            <button
              key={w.id}
              role="radio"
              aria-checked={l.wave === w.id}
              className="insp__wave"
              style={{ color: waveColour(w.id) }}
              onClick={() => onLayer('Change the source', { wave: w.id })}
              title={w.label}
            >
              <WaveGlyph w={w.id} />
              <span>{w.label}</span>
            </button>
          ))}
        </div>
        {isSample ? (
          <div className="insp__sample">
            <label className="sb-field">
              <span className="sb-field__label">Sample</span>
              <select
                value={l.sample ?? ''}
                onChange={(e) => onLayer('Choose a sample', { sample: e.target.value || undefined })}
              >
                <option value="">None</option>
                {sampleIds.map((id) => (
                  <option key={id} value={id}>
                    {samples[id].name} ({seconds(samples[id].data.length / samples[id].rate)})
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn--ghost btn--sm" onClick={onImport}>
              <Icon name="upload" size={13} /> Import audio
            </button>
          </div>
        ) : null}
        <Knob
          label={isSample ? 'Speed' : isCrackle ? 'Clicks' : 'Pitch'}
          value={l.pitch}
          min={isCrackle ? 1 : 20}
          max={isCrackle ? 4000 : 12000}
          log
          color={c}
          disabled={!tone}
          format={isSample ? (v) => times(v / 440) : isCrackle ? rateOf : hz}
          onChange={(v) => onLayer('Pitch', { pitch: v })}
        />
        <Knob
          label={isSample ? 'End speed' : isCrackle ? 'Clicks end' : 'Pitch end'}
          value={l.pitchEnd}
          min={isCrackle ? 1 : 20}
          max={isCrackle ? 4000 : 12000}
          log
          color={c}
          disabled={!tone}
          format={isSample ? (v) => times(v / 440) : isCrackle ? rateOf : hz}
          onChange={k('pitchEnd', 'Pitch end')}
        />
        <Knob label="Glide" value={l.glide} min={-1} max={1} step={0.01} color={c} disabled={!tone} format={(v) => (v === 0 ? 'even' : v > 0 ? `fast ${pct(v)}` : `slow ${pct(-v)}`)} onChange={k('glide', 'Glide')} />
        {l.wave === 'square' ? (
          <Knob label="Width" value={l.duty} min={0.05} max={0.95} step={0.01} color={c} format={pct} onChange={k('duty', 'Pulse width')} />
        ) : null}
        {l.wave === 'pluck' ? (
          <Knob label="Brightness" value={l.bright} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('bright', 'Brightness')} />
        ) : null}
        {l.wave === 'crackle' ? (
          <Knob label="Grain" value={l.grain} min={0.1} max={40} log color={c} format={(v) => (v < 1.5 ? `tick ${times(v)}` : `burst ${times(v)}`)} onChange={k('grain', 'Grain')} />
        ) : null}
        {l.wave === 'bubbles' ? (
          <Knob label="Size" value={l.bubble} min={100} max={6000} log color={c} format={(v) => (v < 400 ? `glug ${hz(v)}` : v > 2000 ? `fizz ${hz(v)}` : hz(v))} onChange={k('bubble', 'Bubble size')} />
        ) : null}
        {fmable ? (
          <Knob label="Rough" value={l.rough} min={0} max={1} step={0.01} color={c} format={(v) => (v === 0 ? 'clean' : pct(v))} onChange={k('rough', 'Roughness')} />
        ) : null}
        <Knob label="Level" value={l.gain} min={0} max={1.5} step={0.01} color={c} format={pct} onChange={k('gain', 'Level')} />
      </Section>

      <Section title="Envelope" aside={<EnvelopeView l={l} />}>
        <Knob label="Start" value={l.at} min={0} max={10} step={0.005} color={c} format={seconds} onChange={k('at', 'Start')} />
        <Knob label="Length" value={l.length} min={0.005} max={12} log color={c} format={seconds} onChange={k('length', 'Length')} />
        <Knob label="Attack" value={Math.max(0.0005, l.attack)} min={0.0005} max={3} log color={c} format={seconds} onChange={k('attack', 'Attack')} />
        <Knob label="Decay" value={Math.max(0.001, l.decay)} min={0.001} max={6} log color={c} format={seconds} onChange={k('decay', 'Decay')} />
        <Knob label="Sustain" value={l.sustain} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('sustain', 'Sustain')} />
        <Knob label="Release" value={Math.max(0.001, l.release)} min={0.001} max={4} log color={c} format={seconds} onChange={k('release', 'Release')} />
      </Section>

      <Section
        title="Filter"
        aside={
          <div className="sb-seg" role="radiogroup" aria-label="Filter">
            {(['off', 'lowpass', 'highpass', 'bandpass', 'vowel'] as FilterType[]).map((f) => (
              <button key={f} role="radio" aria-checked={l.filter === f} onClick={() => onLayer('Filter', { filter: f })}>
                {f === 'off' ? 'Off' : f === 'lowpass' ? 'Low' : f === 'highpass' ? 'High' : f === 'bandpass' ? 'Band' : 'Vowel'}
              </button>
            ))}
          </div>
        }
      >
        {vowel ? (
          <>
            <Knob label="Vowel" value={l.vowel} min={0} max={4} step={0.05} color={c} format={vowelName} onChange={k('vowel', 'Vowel')} />
            <Knob label="Vowel end" value={l.vowelEnd} min={0} max={4} step={0.05} color={c} format={vowelName} onChange={k('vowelEnd', 'Vowel end')} />
            <Knob label="Throat" value={l.throat} min={0.4} max={2.5} log color={c} format={(v) => (v < 0.97 ? `big ${times(v)}` : v > 1.03 ? `small ${times(v)}` : 'a man’s')} onChange={k('throat', 'Throat')} />
          </>
        ) : (
          <>
            <Knob label="Cutoff" value={l.cutoff} min={20} max={20000} log color={c} disabled={l.filter === 'off'} format={khz} onChange={k('cutoff', 'Cutoff')} />
            <Knob label="Cutoff end" value={l.cutoffEnd} min={20} max={20000} log color={c} disabled={l.filter === 'off'} format={khz} onChange={k('cutoffEnd', 'Cutoff end')} />
          </>
        )}
        <Knob label="Resonance" value={l.resonance} min={0.3} max={20} log color={c} disabled={l.filter === 'off'} format={(v) => `Q ${v.toFixed(1)}`} onChange={k('resonance', 'Resonance')} />
        {vowel ? null : (
          <label className="insp__toggle">
            <input type="checkbox" checked={l.steep} disabled={l.filter === 'off'} onChange={(e) => onLayer('Steep filter', { steep: e.target.checked })} />
            <span>Steep</span>
            <span className="insp__toggle-note">{l.steep ? '24 dB/oct' : '12 dB/oct'}</span>
          </label>
        )}
      </Section>

      <Section title="Motion">
        <Knob label="Vibrato" value={l.vibratoRate} min={0} max={40} step={0.1} color={c} disabled={!tone} format={(v) => `${v.toFixed(1)} Hz`} onChange={k('vibratoRate', 'Vibrato rate')} />
        <Knob label="Vib. depth" value={l.vibratoDepth} min={0} max={12} step={0.05} color={c} disabled={!tone} format={(v) => `${v.toFixed(2)} st`} onChange={k('vibratoDepth', 'Vibrato depth')} />
        <Knob label="Tremolo" value={l.tremoloRate} min={0} max={40} step={0.1} color={c} format={(v) => `${v.toFixed(1)} Hz`} onChange={k('tremoloRate', 'Tremolo rate')} />
        <Knob label="Trem. depth" value={l.tremoloDepth} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('tremoloDepth', 'Tremolo depth')} />
        <Knob label="Wobble" value={l.wobbleRate} min={0.2} max={40} log color={c} disabled={!l.wobblePitch && !l.wobbleAmp} format={(v) => `${v.toFixed(1)} Hz`} onChange={k('wobbleRate', 'Wobble rate')} />
        <Knob label="Wob. pitch" value={l.wobblePitch} min={0} max={12} step={0.05} color={c} disabled={!tone} format={(v) => (v === 0 ? 'off' : `±${v.toFixed(2)} st`)} onChange={k('wobblePitch', 'Wobble pitch')} />
        <Knob label="Wob. level" value={l.wobbleAmp} min={0} max={1} step={0.01} color={c} format={(v) => (v === 0 ? 'off' : pct(v))} onChange={k('wobbleAmp', 'Wobble level')} />
        <Knob label="FM ratio" value={l.fmRatio} min={0.25} max={8} log color={c} disabled={!fmable} format={times} onChange={k('fmRatio', 'FM ratio')} />
        <Knob label="FM amount" value={l.fmIndex} min={0} max={10} step={0.05} color={c} disabled={!fmable} format={(v) => v.toFixed(2)} onChange={k('fmIndex', 'FM amount')} />
      </Section>

      <Section title="Grit">
        <Knob label="Drive" value={l.drive} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('drive', 'Drive')} />
        <Knob label="Crush" value={l.crush} min={0} max={1} step={0.01} color={c} format={(v) => (v === 0 ? 'off' : `${Math.round(16 - v * 13)} bit`)} onChange={k('crush', 'Crush')} />
      </Section>

      <Section title="Repeats">
        <Knob label="Hits" value={l.repeats} min={1} max={32} step={1} color={c} format={(v) => String(Math.round(v))} onChange={k('repeats', 'Repeats')} />
        <Knob label="Gap" value={Math.max(0.005, l.gap)} min={0.005} max={2} log color={c} disabled={l.repeats <= 1} format={seconds} onChange={k('gap', 'Repeat gap')} />
        <Knob label="Fade" value={l.repeatDecay} min={0} max={1.2} step={0.01} color={c} disabled={l.repeats <= 1} format={pct} onChange={k('repeatDecay', 'Repeat fade')} />
        <Knob label="Step" value={l.repeatPitch} min={-12} max={12} step={0.5} color={c} disabled={l.repeats <= 1 || !tone} format={st} onChange={k('repeatPitch', 'Repeat step')} />
        <Knob label="Jitter" value={l.jitter} min={0} max={12} step={0.1} color={c} disabled={l.repeats <= 1 || !tone} format={st} onChange={k('jitter', 'Repeat jitter')} />
      </Section>
    </div>
  )
}

type MasterProps = { master: Master; onMaster: (label: string, patch: Partial<Master>) => void }

export function MasterInspector({ master: m, onMaster }: MasterProps) {
  const c = 'var(--ink)'
  const k = (key: keyof Master, label: string) => (v: number) => onMaster(label, { [key]: v } as Partial<Master>)
  return (
    <div className="insp">
      <Section
        title="Level"
        aside={
          <label className="sb-check">
            <input type="checkbox" checked={m.normalize} onChange={(e) => onMaster('Normalize', { normalize: e.target.checked })} />
            Normalize to −1 dB
          </label>
        }
      >
        <Knob label="Gain" value={m.gain} min={0} max={1.5} step={0.01} color={c} format={pct} onChange={k('gain', 'Master gain')} />
        <Knob label="Variation" value={m.variation} min={0} max={12} step={0.1} color={c} format={(v) => `±${v.toFixed(1)} st`} onChange={k('variation', 'Variation')} />
      </Section>
      <Section title="Echo">
        <Knob label="Time" value={Math.max(0.01, m.echoTime)} min={0.01} max={1.5} log color={c} format={seconds} onChange={k('echoTime', 'Echo time')} />
        <Knob label="Feedback" value={m.echoFeedback} min={0} max={0.9} step={0.01} color={c} format={pct} onChange={k('echoFeedback', 'Echo feedback')} />
        <Knob label="Mix" value={m.echoMix} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('echoMix', 'Echo mix')} />
      </Section>
      <Section title="Reverb">
        <Knob label="Size" value={m.reverbSize} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('reverbSize', 'Reverb size')} />
        <Knob label="Mix" value={m.reverbMix} min={0} max={1} step={0.01} color={c} format={pct} onChange={k('reverbMix', 'Reverb mix')} />
      </Section>
      <p className="insp__note">
        Variation is the random pitch between plays, and between the files a sound exports as. The game plays one file at random
        each time, so a few variants keep a sound from wearing out.
      </p>
    </div>
  )
}
