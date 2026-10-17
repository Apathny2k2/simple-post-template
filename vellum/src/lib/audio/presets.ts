/* Starting points in the manner of the game's own sounds: short, mono, made
   to be played with a little random pitch. Each one is ordinary layers, so
   anything here can be pulled apart in the console and changed. They are
   built from scratch; none is a copy of a Mojang sound. */

import { layer, master, uid } from './synth'
import type { Layer, Master, Sound } from './synth'

export const GROUPS = ['Player', 'Blocks', 'Notes', 'World', 'Mobs'] as const
export type Group = (typeof GROUPS)[number]

type Preset = { name: string; group: Group; layers: Partial<Layer>[]; master?: Partial<Master> }

const hit = { attack: 0.002, sustain: 0, release: 0.01 }

const PRESETS: Preset[] = [
  /* ---------------- player ---------------- */
  {
    name: 'Orb chime',
    group: 'Player',
    layers: [
      { name: 'Tone', wave: 'sine', pitch: 1568, pitchEnd: 1610, length: 0.22, decay: 0.16, ...hit },
      { name: 'Sparkle', wave: 'sine', pitch: 3136, pitchEnd: 3220, length: 0.1, decay: 0.06, gain: 0.3, ...hit },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.3, variation: 4 },
  },
  {
    name: 'Level up',
    group: 'Player',
    layers: [
      { name: 'C', wave: 'triangle', pitch: 523, pitchEnd: 523, length: 0.12, decay: 0.1, sustain: 0.3, gain: 0.7 },
      { name: 'E', wave: 'triangle', pitch: 659, pitchEnd: 659, at: 0.09, length: 0.12, decay: 0.1, sustain: 0.3, gain: 0.7 },
      { name: 'G', wave: 'triangle', pitch: 784, pitchEnd: 784, at: 0.18, length: 0.12, decay: 0.1, sustain: 0.3, gain: 0.7 },
      { name: 'High C', wave: 'triangle', pitch: 1047, pitchEnd: 1047, at: 0.27, length: 0.7, decay: 0.6, sustain: 0.2, release: 0.3, vibratoRate: 6, vibratoDepth: 0.15 },
      { name: 'Shine', wave: 'square', duty: 0.25, pitch: 1047, pitchEnd: 1047, at: 0.27, length: 0.5, decay: 0.3, sustain: 0, gain: 0.18, filter: 'lowpass', cutoff: 3000, cutoffEnd: 1200 },
    ],
    master: { reverbMix: 0.3, reverbSize: 0.5, variation: 0 },
  },
  {
    name: 'Click',
    group: 'Player',
    layers: [
      { name: 'Tick', wave: 'square', pitch: 1800, pitchEnd: 900, length: 0.03, decay: 0.02, ...hit },
      { name: 'Snap', wave: 'hiss', filter: 'bandpass', cutoff: 3200, cutoffEnd: 3200, resonance: 2, length: 0.025, decay: 0.015, gain: 0.6, ...hit },
    ],
    master: { variation: 1 },
  },
  {
    name: 'Pickup pop',
    group: 'Player',
    layers: [
      { name: 'Pop', wave: 'sine', pitch: 380, pitchEnd: 1100, glide: 0.6, length: 0.09, decay: 0.07, drive: 0.2, ...hit },
      { name: 'Air', wave: 'hiss', filter: 'highpass', cutoff: 4000, cutoffEnd: 4000, length: 0.03, decay: 0.02, gain: 0.15, ...hit },
    ],
    master: { variation: 3 },
  },
  {
    name: 'Hit',
    group: 'Player',
    layers: [
      { name: 'Thud', wave: 'noise', pitch: 90, pitchEnd: 70, filter: 'lowpass', cutoff: 1800, cutoffEnd: 400, length: 0.16, decay: 0.1, drive: 0.5, ...hit },
      { name: 'Body', wave: 'square', duty: 0.4, pitch: 160, pitchEnd: 70, glide: 0.4, length: 0.12, decay: 0.08, gain: 0.5, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Bow shot',
    group: 'Player',
    layers: [
      { name: 'Whoosh', wave: 'hiss', filter: 'bandpass', cutoff: 1200, cutoffEnd: 3500, resonance: 1.5, length: 0.26, attack: 0.01, decay: 0.2, sustain: 0, gain: 0.8 },
      { name: 'String', wave: 'triangle', pitch: 210, pitchEnd: 170, length: 0.2, decay: 0.15, vibratoRate: 30, vibratoDepth: 0.4, gain: 0.6, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Eat',
    group: 'Player',
    layers: [
      { name: 'Crunch', wave: 'noise', pitch: 300, pitchEnd: 260, filter: 'bandpass', cutoff: 1800, cutoffEnd: 1500, resonance: 1.2, length: 0.07, decay: 0.05, repeats: 4, gap: 0.12, repeatDecay: 0.85, jitter: 3, ...hit },
      { name: 'Grit', wave: 'hiss', filter: 'highpass', cutoff: 4000, cutoffEnd: 4000, length: 0.03, decay: 0.02, gain: 0.3, repeats: 4, gap: 0.12, repeatDecay: 0.85, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Footstep',
    group: 'Player',
    layers: [
      { name: 'Scuff', wave: 'noise', pitch: 260, pitchEnd: 200, filter: 'lowpass', cutoff: 2200, cutoffEnd: 900, length: 0.09, attack: 0.004, decay: 0.07, sustain: 0, repeats: 2, gap: 0.03, jitter: 3, repeatDecay: 0.6 },
      { name: 'Leaves', wave: 'hiss', filter: 'highpass', cutoff: 3000, cutoffEnd: 3000, length: 0.05, decay: 0.04, gain: 0.25, ...hit },
    ],
    master: { variation: 3 },
  },

  /* ---------------- blocks ---------------- */
  {
    name: 'Wood knock',
    group: 'Blocks',
    layers: [
      { name: 'Knock', wave: 'triangle', pitch: 190, pitchEnd: 130, glide: 0.5, length: 0.09, decay: 0.07, repeats: 2, gap: 0.085, repeatDecay: 0.7, jitter: 1, ...hit },
      { name: 'Grain', wave: 'noise', pitch: 150, pitchEnd: 150, filter: 'bandpass', cutoff: 700, cutoffEnd: 700, resonance: 2, length: 0.05, decay: 0.04, gain: 0.6, repeats: 2, gap: 0.085, ...hit },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Chest creak',
    group: 'Blocks',
    layers: [
      { name: 'Hinge', wave: 'saw', pitch: 180, pitchEnd: 240, glide: -0.3, length: 0.45, attack: 0.05, decay: 0.4, sustain: 0.6, release: 0.1, vibratoRate: 18, vibratoDepth: 0.6, filter: 'bandpass', cutoff: 900, cutoffEnd: 1100, resonance: 3, drive: 0.3, gain: 0.55 },
      { name: 'Lid', wave: 'triangle', pitch: 120, pitchEnd: 80, at: 0.42, length: 0.12, decay: 0.09, ...hit },
    ],
    master: { reverbMix: 0.12, reverbSize: 0.25, variation: 1 },
  },
  {
    name: 'Stone break',
    group: 'Blocks',
    layers: [
      { name: 'Crack', wave: 'noise', pitch: 200, pitchEnd: 160, filter: 'lowpass', cutoff: 3000, cutoffEnd: 600, length: 0.22, decay: 0.15, repeats: 3, gap: 0.03, jitter: 4, repeatDecay: 0.6, crush: 0.25, ...hit },
      { name: 'Weight', wave: 'rumble', filter: 'lowpass', cutoff: 300, cutoffEnd: 200, length: 0.2, decay: 0.15, gain: 0.8, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Glass shatter',
    group: 'Blocks',
    layers: [
      { name: 'Shards', wave: 'sine', pitch: 3200, pitchEnd: 3100, fmRatio: 2.7, fmIndex: 1.5, length: 0.25, decay: 0.2, repeats: 9, gap: 0.025, jitter: 7, repeatDecay: 0.85, gain: 0.5, ...hit },
      { name: 'Spray', wave: 'hiss', filter: 'highpass', cutoff: 3500, cutoffEnd: 5000, length: 0.3, decay: 0.25, gain: 0.5, ...hit },
    ],
    master: { reverbMix: 0.2, reverbSize: 0.35, variation: 2 },
  },
  {
    name: 'Lever',
    group: 'Blocks',
    layers: [
      { name: 'Down', wave: 'square', pitch: 2200, pitchEnd: 1400, length: 0.015, decay: 0.01, ...hit },
      { name: 'Catch', wave: 'noise', pitch: 500, pitchEnd: 500, filter: 'bandpass', cutoff: 2500, cutoffEnd: 2500, resonance: 2, length: 0.03, decay: 0.02, gain: 0.7, ...hit },
      { name: 'Seat', wave: 'square', pitch: 1500, pitchEnd: 900, at: 0.05, length: 0.015, decay: 0.01, gain: 0.6, ...hit },
    ],
    master: { reverbMix: 0.1, reverbSize: 0.2, variation: 1 },
  },
  {
    name: 'Anvil land',
    group: 'Blocks',
    layers: [
      { name: 'Ring', wave: 'sine', pitch: 523, pitchEnd: 520, fmRatio: 1.41, fmIndex: 4, length: 1.2, decay: 1, ...hit },
      { name: 'Overtone', wave: 'sine', pitch: 1240, pitchEnd: 1236, fmRatio: 2.3, fmIndex: 2, length: 0.9, decay: 0.7, gain: 0.5, ...hit },
      { name: 'Impact', wave: 'noise', pitch: 70, pitchEnd: 60, filter: 'lowpass', cutoff: 600, cutoffEnd: 300, length: 0.12, decay: 0.08, ...hit },
    ],
    master: { reverbMix: 0.25, reverbSize: 0.4, variation: 1 },
  },

  /* ---------------- notes ---------------- */
  {
    name: 'Harp',
    group: 'Notes',
    layers: [
      { name: 'Pluck', wave: 'triangle', pitch: 440, pitchEnd: 440, length: 0.9, decay: 0.8, filter: 'lowpass', cutoff: 3500, cutoffEnd: 1200, ...hit },
      { name: 'Octave', wave: 'sine', pitch: 880, pitchEnd: 880, length: 0.4, decay: 0.3, gain: 0.3, ...hit },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.3, variation: 0 },
  },
  {
    name: 'Bell',
    group: 'Notes',
    layers: [
      { name: 'Strike', wave: 'sine', pitch: 880, pitchEnd: 880, fmRatio: 3.5, fmIndex: 2.5, length: 1.4, decay: 1.3, ...hit },
      { name: 'Hum', wave: 'sine', pitch: 1760, pitchEnd: 1760, length: 0.8, decay: 0.6, gain: 0.25, ...hit },
    ],
    master: { reverbMix: 0.2, reverbSize: 0.4, variation: 0 },
  },
  {
    name: 'Bass',
    group: 'Notes',
    layers: [
      { name: 'Body', wave: 'sine', pitch: 110, pitchEnd: 110, length: 0.5, decay: 0.4, sustain: 0.1, release: 0.05, attack: 0.003 },
      { name: 'Edge', wave: 'triangle', pitch: 110, pitchEnd: 110, length: 0.4, decay: 0.3, drive: 0.3, filter: 'lowpass', cutoff: 600, cutoffEnd: 300, gain: 0.4, ...hit },
    ],
    master: { variation: 0 },
  },
  {
    name: 'Pling',
    group: 'Notes',
    layers: [
      { name: 'Square', wave: 'square', duty: 0.3, pitch: 880, pitchEnd: 880, length: 0.6, decay: 0.5, filter: 'lowpass', cutoff: 4000, cutoffEnd: 1500, gain: 0.6, ...hit },
      { name: 'Glint', wave: 'sine', pitch: 1760, pitchEnd: 1760, length: 0.2, decay: 0.15, gain: 0.3, ...hit },
    ],
    master: { echoMix: 0.2, echoTime: 0.16, echoFeedback: 0.3, variation: 0 },
  },

  /* ---------------- world ---------------- */
  {
    name: 'Explosion',
    group: 'World',
    layers: [
      { name: 'Boom', wave: 'rumble', filter: 'lowpass', cutoff: 800, cutoffEnd: 120, length: 1.8, attack: 0.005, decay: 1.4, sustain: 0, release: 0.3, drive: 0.4, gain: 1 },
      { name: 'Debris', wave: 'noise', pitch: 70, pitchEnd: 45, filter: 'lowpass', cutoff: 5000, cutoffEnd: 300, length: 1.2, decay: 0.9, crush: 0.15, gain: 0.9, ...hit },
      { name: 'Crack', wave: 'hiss', filter: 'lowpass', cutoff: 9000, cutoffEnd: 1500, length: 0.4, decay: 0.3, gain: 0.5, ...hit },
    ],
    master: { reverbMix: 0.35, reverbSize: 0.7, variation: 2 },
  },
  {
    name: 'Fuse',
    group: 'World',
    layers: [
      { name: 'Hiss', wave: 'hiss', filter: 'highpass', cutoff: 2500, cutoffEnd: 3000, length: 1.5, attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.2, tremoloRate: 22, tremoloDepth: 0.3, gain: 0.6 },
      { name: 'Sputter', wave: 'noise', pitch: 900, pitchEnd: 1100, filter: 'bandpass', cutoff: 6000, cutoffEnd: 6000, resonance: 0.8, length: 1.5, attack: 0.05, sustain: 0.8, release: 0.2, tremoloRate: 13, tremoloDepth: 0.6, gain: 0.3 },
    ],
    master: { variation: 0 },
  },
  {
    name: 'Splash',
    group: 'World',
    layers: [
      { name: 'Wash', wave: 'hiss', filter: 'lowpass', cutoff: 7000, cutoffEnd: 900, length: 0.7, attack: 0.01, decay: 0.6, sustain: 0, gain: 0.8 },
      { name: 'Bubbles', wave: 'sine', pitch: 600, pitchEnd: 1400, glide: 0.5, at: 0.1, length: 0.05, decay: 0.04, repeats: 6, gap: 0.06, jitter: 5, repeatDecay: 0.8, gain: 0.4, ...hit },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.3, variation: 2 },
  },
  {
    name: 'Lava pop',
    group: 'World',
    layers: [
      { name: 'Pop', wave: 'sine', pitch: 140, pitchEnd: 520, glide: 0.7, length: 0.08, decay: 0.06, drive: 0.3, ...hit },
      { name: 'Spit', wave: 'noise', pitch: 400, pitchEnd: 400, filter: 'lowpass', cutoff: 1500, cutoffEnd: 1500, at: 0.02, length: 0.05, decay: 0.04, gain: 0.4, ...hit },
    ],
    master: { variation: 4 },
  },
  {
    name: 'Fire',
    group: 'World',
    layers: [
      { name: 'Crackle', wave: 'noise', pitch: 1200, pitchEnd: 1200, filter: 'bandpass', cutoff: 3000, cutoffEnd: 3000, resonance: 1, length: 0.012, decay: 0.01, repeats: 14, gap: 0.07, jitter: 8, repeatDecay: 0.95, gain: 0.7, ...hit },
      { name: 'Roar', wave: 'rumble', filter: 'lowpass', cutoff: 400, cutoffEnd: 400, length: 1, attack: 0.1, sustain: 0.7, release: 0.3, gain: 0.4 },
    ],
    master: { variation: 1 },
  },
  {
    name: 'Thunder',
    group: 'World',
    layers: [
      { name: 'Roll', wave: 'rumble', filter: 'lowpass', cutoff: 1500, cutoffEnd: 90, length: 3.2, attack: 0.02, decay: 2.6, sustain: 0, release: 0.4, drive: 0.5, gain: 1 },
      { name: 'Cracks', wave: 'noise', pitch: 40, pitchEnd: 30, filter: 'lowpass', cutoff: 3000, cutoffEnd: 200, length: 0.5, decay: 0.4, repeats: 3, gap: 0.25, jitter: 5, crush: 0.2, gain: 0.8, ...hit },
    ],
    master: { reverbMix: 0.5, reverbSize: 0.9, variation: 2 },
  },
  {
    name: 'Portal hum',
    group: 'World',
    layers: [
      { name: 'Drone', wave: 'sine', pitch: 70, pitchEnd: 70, fmRatio: 1.5, fmIndex: 1.2, length: 3, attack: 0.6, sustain: 0.9, release: 0.8, tremoloRate: 3.5, tremoloDepth: 0.4 },
      { name: 'Buzz', wave: 'saw', pitch: 140, pitchEnd: 140, filter: 'lowpass', cutoff: 600, cutoffEnd: 600, length: 3, attack: 0.6, sustain: 0.9, release: 0.8, vibratoRate: 0.4, vibratoDepth: 0.3, gain: 0.25 },
      { name: 'Air', wave: 'hiss', filter: 'bandpass', cutoff: 2000, cutoffEnd: 2000, resonance: 3, length: 3, attack: 0.6, sustain: 0.9, release: 0.8, tremoloRate: 6, tremoloDepth: 0.5, gain: 0.15 },
    ],
    master: { reverbMix: 0.4, reverbSize: 0.6, variation: 0 },
  },
  {
    name: 'Teleport',
    group: 'World',
    layers: [
      { name: 'Fall', wave: 'sine', pitch: 1400, pitchEnd: 180, glide: 0.4, fmRatio: 0.5, fmIndex: 3, length: 0.55, decay: 0.5, sustain: 0.2, vibratoRate: 9, vibratoDepth: 1.5 },
      { name: 'Rush', wave: 'hiss', filter: 'bandpass', cutoff: 4000, cutoffEnd: 600, resonance: 2, length: 0.5, attack: 0.02, decay: 0.4, sustain: 0.2, gain: 0.5 },
      { name: 'Return', wave: 'sine', pitch: 200, pitchEnd: 900, glide: -0.5, at: 0.35, length: 0.3, attack: 0.1, decay: 0.2, sustain: 0.3, gain: 0.4 },
    ],
    master: { reverbMix: 0.35, reverbSize: 0.5, echoMix: 0.15, echoTime: 0.12, echoFeedback: 0.3, variation: 2 },
  },
  {
    name: 'Cave',
    group: 'World',
    layers: [
      { name: 'Deep', wave: 'rumble', filter: 'lowpass', cutoff: 250, cutoffEnd: 250, length: 4, attack: 1, sustain: 0.8, release: 1.5, gain: 0.7 },
      { name: 'Tone', wave: 'sine', pitch: 196, pitchEnd: 185, at: 1, length: 2.5, attack: 0.8, sustain: 0.6, release: 1.2, vibratoRate: 0.2, vibratoDepth: 0.3, fmRatio: 1.01, fmIndex: 0.6, gain: 0.35 },
      { name: 'Under', wave: 'triangle', pitch: 98, pitchEnd: 98, at: 0.4, length: 3, attack: 1, sustain: 0.7, release: 1, gain: 0.3 },
    ],
    master: { reverbMix: 0.6, reverbSize: 1, echoMix: 0.25, echoTime: 0.45, echoFeedback: 0.5, variation: 1 },
  },

  /* ---------------- mobs ---------------- */
  {
    name: 'Groan',
    group: 'Mobs',
    layers: [
      { name: 'Throat', wave: 'saw', pitch: 92, pitchEnd: 74, glide: -0.2, length: 1.1, attack: 0.12, decay: 0.6, sustain: 0.6, release: 0.3, vibratoRate: 5.5, vibratoDepth: 0.7, filter: 'bandpass', cutoff: 650, cutoffEnd: 480, resonance: 2.5, drive: 0.5 },
      { name: 'Formant', wave: 'saw', pitch: 138, pitchEnd: 111, glide: -0.2, length: 1.1, attack: 0.12, decay: 0.6, sustain: 0.6, release: 0.3, vibratoRate: 5.5, vibratoDepth: 0.7, filter: 'bandpass', cutoff: 1100, cutoffEnd: 900, resonance: 4, gain: 0.35 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Hiss',
    group: 'Mobs',
    layers: [
      { name: 'Breath', wave: 'hiss', filter: 'bandpass', cutoff: 3500, cutoffEnd: 3000, resonance: 2, length: 0.4, attack: 0.03, sustain: 0.7, release: 0.1, tremoloRate: 30, tremoloDepth: 0.8 },
      { name: 'Rasp', wave: 'noise', pitch: 400, pitchEnd: 380, filter: 'bandpass', cutoff: 1200, cutoffEnd: 1200, length: 0.4, attack: 0.03, sustain: 0.7, release: 0.1, gain: 0.3 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Rattle',
    group: 'Mobs',
    layers: [
      { name: 'Bones', wave: 'noise', pitch: 700, pitchEnd: 700, filter: 'bandpass', cutoff: 2400, cutoffEnd: 2400, resonance: 4, length: 0.025, decay: 0.02, repeats: 7, gap: 0.045, jitter: 6, repeatDecay: 0.9, ...hit },
      { name: 'Knock', wave: 'triangle', pitch: 900, pitchEnd: 700, length: 0.02, decay: 0.015, repeats: 7, gap: 0.045, jitter: 8, repeatDecay: 0.9, gain: 0.4, ...hit },
    ],
    master: { reverbMix: 0.1, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Squish',
    group: 'Mobs',
    layers: [
      { name: 'Body', wave: 'sine', pitch: 220, pitchEnd: 90, glide: 0.3, fmRatio: 0.5, fmIndex: 2, length: 0.18, decay: 0.15, drive: 0.2, filter: 'lowpass', cutoff: 900, cutoffEnd: 600, ...hit },
      { name: 'Wet', wave: 'noise', pitch: 180, pitchEnd: 120, filter: 'lowpass', cutoff: 700, cutoffEnd: 500, length: 0.12, decay: 0.1, gain: 0.3, ...hit },
    ],
    master: { variation: 3 },
  },
  {
    name: 'Wail',
    group: 'Mobs',
    layers: [
      { name: 'Cry', wave: 'sine', pitch: 700, pitchEnd: 520, glide: -0.3, fmRatio: 1.5, fmIndex: 0.8, length: 1.2, attack: 0.15, decay: 0.8, sustain: 0.5, release: 0.3, vibratoRate: 6, vibratoDepth: 0.8 },
      { name: 'Breath', wave: 'hiss', filter: 'bandpass', cutoff: 1400, cutoffEnd: 1000, resonance: 3, length: 1.2, attack: 0.15, sustain: 0.5, release: 0.3, gain: 0.25 },
    ],
    master: { reverbMix: 0.45, reverbSize: 0.8, variation: 2 },
  },
  {
    name: 'Roar',
    group: 'Mobs',
    layers: [
      { name: 'Growl', wave: 'saw', pitch: 70, pitchEnd: 55, length: 1.6, attack: 0.1, decay: 0.8, sustain: 0.8, release: 0.4, vibratoRate: 7, vibratoDepth: 1.2, filter: 'bandpass', cutoff: 400, cutoffEnd: 250, resonance: 1.5, drive: 0.8 },
      { name: 'Chest', wave: 'rumble', filter: 'lowpass', cutoff: 300, cutoffEnd: 300, length: 1.6, attack: 0.1, sustain: 0.8, release: 0.4, gain: 0.6 },
      { name: 'Rasp', wave: 'noise', pitch: 60, pitchEnd: 50, filter: 'lowpass', cutoff: 1500, cutoffEnd: 1000, length: 1.6, attack: 0.1, sustain: 0.8, release: 0.4, tremoloRate: 18, tremoloDepth: 0.5, gain: 0.5 },
    ],
    master: { reverbMix: 0.3, reverbSize: 0.8, variation: 2 },
  },
]

let seed = 1

/** A preset as a sound of its own, ready to edit. */
export function fromPreset(p: Preset): Sound {
  return {
    id: uid('s'),
    name: p.name,
    group: p.group,
    seed: seed++ * 7919,
    layers: p.layers.map((l) => layer(l)),
    master: master(p.master),
  }
}

export const presets = PRESETS

export function blankSound(name = 'New sound'): Sound {
  return {
    id: uid('s'),
    name,
    group: 'Player',
    seed: Math.floor(Math.random() * 1e9),
    layers: [layer({ name: 'Tone', wave: 'sine', pitch: 660, pitchEnd: 440, glide: 0.3, length: 0.3, decay: 0.25, sustain: 0 })],
    master: master(),
  }
}
