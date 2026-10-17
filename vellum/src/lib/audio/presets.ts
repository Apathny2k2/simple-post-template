/* Starting points, each made to sound like one of the game's own sounds as
   a player hears it in play: at the pitch the game plays it at, which is
   not always the file's own (an item pickup is played up to twice as high,
   an explosion at about 0.7). `vanilla` names that sound, so the console
   can give the /playsound that plays it for comparison.

   Each was tuned against the game's own files, played at that pitch:
   their spectrograms, their loudness over time and their balance across
   octave bands. The note blocks are a few harmonics with a dull pluck
   under them, the impacts are brown noise rung through band-passes, the
   metal is its measured partials, and the voices are noise or a buzz
   through the vowel filter. Every one is ordinary layers that can be
   pulled apart and changed. None contains any of Mojang's audio.

   The recorded sounds (booms, roars, voices, the chest's creak) are not
   imitated: synthesis can't give them their texture. Those presets are
   accents instead, laid on top of the game's own sound, which the Studio
   plays by name. `accent` names those sounds with a cue's pitch and
   volume, and each accent's master gain sits it a few dB under them. */

import { layer, master, uid } from './synth'
import type { Accent, Layer, Master, Sound, Vanilla } from './synth'

export const GROUPS = ['Player', 'Blocks', 'Notes', 'World', 'Mobs'] as const
export type Group = (typeof GROUPS)[number]

/** a preset either sounds like one of the game's sounds, or is an accent laid on top of some */
type Preset = { name: string; group: Group; layers: Partial<Layer>[]; master?: Partial<Master> } & ({ vanilla: Vanilla; accent?: never } | { accent: Accent; vanilla?: never })

const hit = { attack: 0.002, sustain: 0, release: 0.01 }
/** a held sound: no decay, the release does the work */
const held = { decay: 0.1, sustain: 1 }

const PRESETS: Preset[] = [
  /* ---------------- player ---------------- */
  {
    name: 'Orb pickup',
    group: 'Player',
    vanilla: { event: 'entity.experience_orb.pickup', pitch: 0.9, like: 'A bright glassy “ting”: a clear high tone with a shimmering pair of overtones above it, ringing about half a second.' },
    layers: [
      { name: 'Tone', wave: 'sine', pitch: 2277, pitchEnd: 2277, length: 0.65, decay: 0.55, ...hit },
      { name: 'Shimmer', wave: 'sine', pitch: 5465, pitchEnd: 5465, length: 0.65, decay: 0.55, gain: 0.75, ...hit },
      { name: 'Beat', wave: 'sine', pitch: 5543, pitchEnd: 5543, length: 0.45, decay: 0.35, gain: 0.65, ...hit },
      { name: 'Glass', wave: 'sine', pitch: 7713, pitchEnd: 7713, length: 0.4, decay: 0.3, gain: 0.25, ...hit },
      { name: 'Sparkle', wave: 'sine', pitch: 9950, pitchEnd: 9950, length: 0.12, decay: 0.08, gain: 0.4, ...hit },
      { name: 'Air', wave: 'sine', pitch: 12400, pitchEnd: 12400, length: 0.1, decay: 0.07, gain: 0.12, ...hit },
    ],
    master: { variation: 5 },
  },
  {
    name: 'Level up',
    group: 'Player',
    vanilla: { event: 'entity.player.levelup', pitch: 1, like: 'High bell chimes struck one after another, with a brighter, beating strike a third of a second in that rings out for over a second.' },
    layers: [
      { name: 'First', wave: 'sine', pitch: 2121, pitchEnd: 2121, length: 0.7, decay: 0.65, gain: 0.8, ...hit },
      { name: 'First top', wave: 'sine', pitch: 7192, pitchEnd: 7192, length: 0.3, decay: 0.25, gain: 0.3, ...hit },
      { name: 'Second', wave: 'sine', pitch: 2530, pitchEnd: 2530, at: 0.09, length: 0.7, decay: 0.65, gain: 0.55, ...hit },
      { name: 'Second top', wave: 'sine', pitch: 6158, pitchEnd: 6158, at: 0.09, length: 0.35, decay: 0.3, gain: 0.4, ...hit },
      { name: 'Strike', wave: 'sine', pitch: 5103, pitchEnd: 5103, at: 0.29, length: 1.0, decay: 0.85, gain: 0.9, ...hit },
      { name: 'Strike beat', wave: 'sine', pitch: 5168, pitchEnd: 5168, at: 0.29, length: 0.6, decay: 0.5, gain: 0.35, ...hit },
      { name: 'Strike low', wave: 'sine', pitch: 2799, pitchEnd: 2799, at: 0.29, length: 0.9, decay: 0.8, gain: 0.4, ...hit },
      { name: 'Tail', wave: 'sine', pitch: 6718, pitchEnd: 6718, at: 0.6, length: 0.8, attack: 0.01, decay: 0.75, sustain: 0, release: 0.05, gain: 0.25 },
      { name: 'Tail beat', wave: 'sine', pitch: 6072, pitchEnd: 6072, at: 0.55, length: 0.85, attack: 0.01, decay: 0.8, sustain: 0, release: 0.05, gain: 0.2 },
      { name: 'Air', wave: 'sine', pitch: 11025, pitchEnd: 11025, at: 0.09, length: 0.3, decay: 0.25, gain: 0.15, ...hit },
      { name: 'Edge', wave: 'hiss', filter: 'highpass', cutoff: 7000, cutoffEnd: 7000, length: 0.03, decay: 0.02, gain: 0.2, repeats: 2, gap: 0.29, ...hit },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.4, variation: 0 },
  },
  {
    name: 'Click',
    group: 'Player',
    vanilla: { event: 'ui.button.click', pitch: 1, like: 'A short, dry plastic click with a hollow tone near 1.3 kHz, gone in a twentieth of a second.' },
    layers: [
      { name: 'Body', wave: 'hiss', filter: 'bandpass', cutoff: 1300, cutoffEnd: 1300, resonance: 5, at: 0.075, length: 0.06, decay: 0.04, ...hit },
      { name: 'Snap', wave: 'hiss', filter: 'bandpass', cutoff: 2600, cutoffEnd: 2600, resonance: 0.8, at: 0.075, length: 0.04, decay: 0.025, gain: 1, ...hit },
      { name: 'Tone', wave: 'sine', pitch: 1292, pitchEnd: 1280, at: 0.075, length: 0.06, decay: 0.04, gain: 0.35, ...hit },
      { name: 'Press', wave: 'hiss', filter: 'bandpass', cutoff: 1300, cutoffEnd: 1300, resonance: 1, length: 0.03, decay: 0.02, gain: 0.25, ...hit },
      { name: 'Knock', wave: 'sine', pitch: 270, pitchEnd: 80, at: 0.075, length: 0.08, decay: 0.05, gain: 0.07, ...hit },
    ],
    master: { variation: 0.5 },
  },
  {
    name: 'Item pickup',
    group: 'Player',
    vanilla: { event: 'entity.item.pickup', pitch: 2, like: 'A tiny, very short “pop” around 2 kHz with a little knock under it, high because the game doubles its pitch.' },
    layers: [
      { name: 'Pop', wave: 'sine', pitch: 2300, pitchEnd: 1950, length: 0.03, attack: 0.001, decay: 0.022, sustain: 0, release: 0.005 },
      { name: 'Knock', wave: 'noise', pitch: 500, pitchEnd: 300, filter: 'lowpass', cutoff: 1600, cutoffEnd: 1000, length: 0.025, decay: 0.015, gain: 0.9, ...hit },
      { name: 'Thump', wave: 'sine', pitch: 90, pitchEnd: 60, length: 0.03, decay: 0.02, gain: 0.6, ...hit },
      { name: 'Tick', wave: 'hiss', length: 0.012, decay: 0.008, gain: 0.5, ...hit },
      { name: 'Lip', wave: 'hiss', filter: 'bandpass', cutoff: 2100, cutoffEnd: 2100, resonance: 1.5, length: 0.02, decay: 0.012, gain: 0.3, ...hit },
    ],
    master: { variation: 4 },
  },
  {
    name: 'Hurt',
    group: 'Player',
    vanilla: { event: 'entity.player.hurt', pitch: 1, like: 'A short, bright punch: a low thump with a crack of noise on top, over in a tenth of a second. No voice.' },
    layers: [
      { name: 'Thump', wave: 'sine', pitch: 130, pitchEnd: 50, glide: 0.4, length: 0.09, decay: 0.06, gain: 0.5, ...hit },
      { name: 'Crack', wave: 'hiss', filter: 'bandpass', cutoff: 5000, cutoffEnd: 4000, resonance: 0.5, length: 0.08, decay: 0.045, gain: 1, ...hit },
      { name: 'Body', wave: 'noise', pitch: 300, pitchEnd: 200, filter: 'lowpass', cutoff: 2500, cutoffEnd: 1000, length: 0.07, decay: 0.04, gain: 0.8, ...hit },
    ],
    master: { variation: 1.5 },
  },
  {
    name: 'Bow shot',
    group: 'Player',
    vanilla: { event: 'entity.arrow.shoot', pitch: 1.1, like: 'A dull, quick “thwup”: the string’s low thump under a short band of air near 1 kHz, about a tenth of a second.' },
    layers: [
      { name: 'Air', wave: 'hiss', filter: 'bandpass', cutoff: 950, cutoffEnd: 800, resonance: 1.6, at: 0.03, length: 0.16, attack: 0.02, decay: 0.1, sustain: 0, release: 0.03, gain: 3 },
      { name: 'String', wave: 'sine', pitch: 160, pitchEnd: 145, at: 0.03, length: 0.14, attack: 0.004, decay: 0.1, sustain: 0, release: 0.02, gain: 0.9 },
      { name: 'Twang', wave: 'pluck', pitch: 154, pitchEnd: 150, bright: 0.2, at: 0.03, length: 0.14, attack: 0.001, decay: 0.1, sustain: 0, release: 0.02, gain: 0.3 },
      { name: 'Thud', wave: 'sine', pitch: 75, pitchEnd: 60, at: 0.03, length: 0.1, decay: 0.07, gain: 0.35, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Eat',
    group: 'Player',
    vanilla: { event: 'entity.generic.eat', pitch: 1, like: 'One crunchy chomp: a dense crunch around 1.6–1.9 kHz for about a sixth of a second, then a softer low chew. The game repeats it while eating.' },
    layers: [
      { name: 'Crunch', wave: 'crackle', pitch: 1500, pitchEnd: 900, filter: 'bandpass', cutoff: 1750, cutoffEnd: 1600, resonance: 1.8, length: 0.22, attack: 0.04, decay: 0.4, sustain: 0, release: 0.04 },
      { name: 'Bite', wave: 'hiss', filter: 'bandpass', cutoff: 3300, cutoffEnd: 3000, resonance: 1.2, length: 0.2, attack: 0.04, decay: 0.35, sustain: 0, release: 0.04, gain: 0.1 },
      { name: 'Chew', wave: 'noise', pitch: 400, pitchEnd: 250, filter: 'bandpass', cutoff: 220, cutoffEnd: 180, resonance: 0.7, at: 0.16, length: 0.15, attack: 0.02, decay: 0.13, sustain: 0, release: 0.04, gain: 0.3 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Grass step',
    group: 'Player',
    vanilla: { event: 'block.grass.step', pitch: 1, like: 'A crisp, very bright rustle of crushed blades, almost all above 4 kHz, for about a fifth of a second before it fades.' },
    layers: [
      { name: 'Rustle', wave: 'crackle', pitch: 2500, pitchEnd: 1500, filter: 'highpass', cutoff: 3500, cutoffEnd: 3500, length: 0.4, attack: 0.07, decay: 0.15, sustain: 0.55, release: 0.18 },
      { name: 'Blades', wave: 'hiss', filter: 'highpass', cutoff: 5000, cutoffEnd: 5000, length: 0.35, attack: 0.07, decay: 0.12, sustain: 0.35, release: 0.15, gain: 0.35 },
      { name: 'Crush', wave: 'hiss', filter: 'bandpass', cutoff: 2200, cutoffEnd: 1800, resonance: 0.6, length: 0.3, attack: 0.06, decay: 0.12, sustain: 0.3, release: 0.1, gain: 0.45 },
    ],
    master: { variation: 2 },
  },

  /* ---------------- blocks ---------------- */
  {
    name: 'Wood break',
    group: 'Blocks',
    vanilla: { event: 'block.wood.break', pitch: 0.8, like: 'A dull, low wooden thud with a short dry crunch; nearly all of it below 500 Hz.' },
    layers: [
      { name: 'Thud', wave: 'rumble', filter: 'lowpass', cutoff: 420, cutoffEnd: 250, length: 0.25, decay: 0.1, gain: 0.15, ...hit },
      { name: 'Body', wave: 'rumble', filter: 'bandpass', cutoff: 170, cutoffEnd: 150, resonance: 1.5, length: 0.25, decay: 0.12, gain: 1, ...hit },
      { name: 'Knock', wave: 'rumble', filter: 'bandpass', cutoff: 480, cutoffEnd: 440, resonance: 3, length: 0.12, decay: 0.06, gain: 0.8, ...hit },
      { name: 'Crunch', wave: 'crackle', pitch: 400, pitchEnd: 80, filter: 'lowpass', cutoff: 500, cutoffEnd: 350, length: 0.35, attack: 0.002, decay: 0.3, sustain: 0, release: 0.05, gain: 0.3 },
    ],
    master: { reverbMix: 0.05, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Chest open',
    group: 'Blocks',
    accent: { on: [{ event: 'block.chest.open', pitch: 1, volume: 1 }], after: 0.02, adds: 'An iron latch: a bright click and a short metal ring, a quarter of a second, for a locked or iron-bound chest.' },
    layers: [
      { name: 'Click', wave: 'noise', pitch: 3000, pitchEnd: 2500, filter: 'highpass', cutoff: 2500, cutoffEnd: 2500, length: 0.015, decay: 0.008, drive: 0.4, ...hit },
      { name: 'Ring', wave: 'sine', pitch: 1870, pitchEnd: 1860, length: 0.28, decay: 0.22, gain: 0.35, ...hit },
      { name: 'Ring 2', wave: 'sine', pitch: 3120, pitchEnd: 3110, length: 0.2, decay: 0.14, gain: 0.2, ...hit },
      { name: 'Ring 3', wave: 'sine', pitch: 4630, pitchEnd: 4620, length: 0.12, decay: 0.08, gain: 0.12, ...hit },
      { name: 'Bolt', wave: 'noise', pitch: 900, pitchEnd: 700, filter: 'bandpass', cutoff: 1200, cutoffEnd: 900, resonance: 1, at: 0.06, length: 0.03, decay: 0.02, gain: 0.4, ...hit },
    ],
    master: { reverbMix: 0.06, reverbSize: 0.2, variation: 1 },
  },
  {
    name: 'Stone break',
    group: 'Blocks',
    vanilla: { event: 'block.stone.break', pitch: 0.8, like: 'A short, dark, dull crunch of rock, gone in a fifth of a second.' },
    layers: [
      { name: 'Thud', wave: 'rumble', filter: 'lowpass', cutoff: 500, cutoffEnd: 300, length: 0.18, decay: 0.08, gain: 0.15, ...hit },
      { name: 'Rock', wave: 'rumble', filter: 'bandpass', cutoff: 200, cutoffEnd: 180, resonance: 1.2, length: 0.18, decay: 0.08, gain: 1, ...hit },
      { name: 'Crunch', wave: 'crackle', pitch: 1500, pitchEnd: 400, filter: 'lowpass', cutoff: 800, cutoffEnd: 500, length: 0.2, attack: 0.002, decay: 0.1, sustain: 0, release: 0.03, gain: 0.35 },
      { name: 'Grit', wave: 'rumble', filter: 'bandpass', cutoff: 700, cutoffEnd: 500, resonance: 1, length: 0.08, decay: 0.04, gain: 0.3, ...hit },
      { name: 'Crumble', wave: 'crackle', pitch: 200, pitchEnd: 60, filter: 'lowpass', cutoff: 900, cutoffEnd: 600, at: 0.06, length: 0.35, attack: 0.01, decay: 0.3, sustain: 0, release: 0.05, gain: 0.25 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Glass break',
    group: 'Blocks',
    vanilla: { event: 'block.glass.break', pitch: 0.8, like: 'A bright broadband crash, then a hissing shimmer of shards that hangs for half a second.' },
    layers: [
      { name: 'Crash', wave: 'hiss', filter: 'bandpass', cutoff: 3500, cutoffEnd: 2500, resonance: 0.8, length: 0.1, decay: 0.05, ...hit },
      { name: 'Shimmer', wave: 'hiss', filter: 'bandpass', cutoff: 4500, cutoffEnd: 4000, resonance: 1, length: 0.75, attack: 0.002, decay: 0.1, sustain: 0.015, release: 0.2, gain: 0.7 },
      { name: 'Low', wave: 'hiss', filter: 'lowpass', cutoff: 900, cutoffEnd: 700, length: 0.7, attack: 0.002, decay: 0.08, sustain: 0.015, release: 0.2, gain: 0.9 },
      { name: 'Shards', wave: 'sine', pitch: 3800, pitchEnd: 3760, fmRatio: 2.76, fmIndex: 1.2, length: 0.15, decay: 0.12, repeats: 12, gap: 0.045, jitter: 9, repeatDecay: 0.9, gain: 0.035, ...hit },
      { name: 'Tinkles', wave: 'sine', pitch: 7400, pitchEnd: 7400, at: 0.02, length: 0.1, decay: 0.08, repeats: 10, gap: 0.06, jitter: 7, repeatDecay: 0.9, gain: 0.03, ...hit },
      { name: 'Sprinkle', wave: 'crackle', pitch: 300, pitchEnd: 80, filter: 'bandpass', cutoff: 5000, cutoffEnd: 4000, resonance: 0.7, length: 0.7, attack: 0.005, decay: 0.5, sustain: 0, release: 0.1, gain: 0.2 },
    ],
    master: { reverbMix: 0.08, reverbSize: 0.3, variation: 2 },
  },
  {
    name: 'Lever',
    group: 'Blocks',
    vanilla: { event: 'block.lever.click', pitch: 0.6, like: 'Two clicks a sixth of a second apart, a soft one then a louder snap, played low at 0.6.' },
    layers: [
      { name: 'Lift', wave: 'hiss', filter: 'bandpass', cutoff: 1300, cutoffEnd: 1300, resonance: 2, length: 0.08, decay: 0.06, gain: 0.1, ...hit },
      { name: 'Snap', wave: 'hiss', filter: 'bandpass', cutoff: 1300, cutoffEnd: 1100, resonance: 3, at: 0.115, length: 0.12, decay: 0.09, ...hit },
      { name: 'Seat', wave: 'hiss', filter: 'bandpass', cutoff: 620, cutoffEnd: 600, resonance: 3, at: 0.115, length: 0.1, decay: 0.06, gain: 0.45, ...hit },
      { name: 'Tick', wave: 'rumble', filter: 'bandpass', cutoff: 3200, cutoffEnd: 3000, resonance: 2, at: 0.115, length: 0.1, decay: 0.06, gain: 0.8, ...hit },
    ],
    master: { variation: 0.5 },
  },
  {
    name: 'Anvil land',
    group: 'Blocks',
    vanilla: { event: 'block.anvil.land', pitch: 0.95, like: 'A bright, crashing metal clang full of high partials that dies away in about two thirds of a second.' },
    layers: [
      { name: 'Strike', wave: 'hiss', filter: 'highpass', cutoff: 800, cutoffEnd: 800, length: 0.1, decay: 0.05, ...hit },
      { name: 'Body', wave: 'sine', pitch: 300, pitchEnd: 298, length: 0.7, decay: 0.5, gain: 0.12, ...hit },
      { name: 'Mode 0', wave: 'sine', pitch: 598, pitchEnd: 598, length: 0.75, attack: 0.002, decay: 0.75, sustain: 0, release: 0.15, gain: 0.18 },
      { name: 'Mode 1', wave: 'sine', pitch: 1180, pitchEnd: 1180, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.4 },
      { name: 'Mode 2', wave: 'sine', pitch: 1730, pitchEnd: 1730, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.4 },
      { name: 'Mode 3', wave: 'sine', pitch: 2370, pitchEnd: 2370, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.45 },
      { name: 'Mode 4', wave: 'sine', pitch: 3120, pitchEnd: 3120, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.45 },
      { name: 'Mode 5', wave: 'sine', pitch: 3950, pitchEnd: 3950, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.4 },
      { name: 'Mode 6', wave: 'sine', pitch: 4820, pitchEnd: 4820, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.35 },
      { name: 'Mode 7', wave: 'sine', pitch: 6150, pitchEnd: 6150, length: 0.8, attack: 0.002, decay: 0.75, sustain: 0, release: 0.2, gain: 0.25 },
      { name: 'Clatter', wave: 'hiss', filter: 'bandpass', cutoff: 2500, cutoffEnd: 2200, resonance: 0.6, length: 0.8, attack: 0.002, decay: 0.7, sustain: 0, release: 0.15, gain: 0.3 },
      { name: 'Weight', wave: 'rumble', filter: 'bandpass', cutoff: 150, cutoffEnd: 130, resonance: 1, length: 0.6, decay: 0.35, gain: 0.5, ...hit },
    ],
    master: { reverbMix: 0.06, reverbSize: 0.3, variation: 1 },
  },

  /* ---------------- notes ---------------- */
  /* A note block plays its instrument at 0.5 to 2, the 25 clicks; 1 is the
     middle click, an F#. Each is pitched here to its middle note. */
  {
    name: 'Harp',
    group: 'Notes',
    vanilla: { event: 'block.note_block.harp', pitch: 1, like: 'A soft plucked harp at F#4: nearly a pure tone with faint overtones, cut off at under half a second.' },
    layers: [
      { name: 'Tone', wave: 'sine', pitch: 370, pitchEnd: 370, length: 0.47, attack: 0.002, decay: 0.75, sustain: 0, release: 0.06 },
      { name: 'String', wave: 'pluck', pitch: 370, pitchEnd: 370, bright: 0.1, length: 0.47, attack: 0.001, decay: 0.5, sustain: 0, release: 0.06, filter: 'highpass', cutoff: 250, cutoffEnd: 250, gain: 0.25 },
      { name: 'Second', wave: 'sine', pitch: 740, pitchEnd: 740, length: 0.47, attack: 0.002, decay: 0.45, sustain: 0, release: 0.06, gain: 0.14 },
      { name: 'Third', wave: 'sine', pitch: 1110, pitchEnd: 1110, length: 0.4, decay: 0.35, gain: 0.07, ...hit },
      { name: 'Fourth', wave: 'sine', pitch: 1480, pitchEnd: 1480, length: 0.35, decay: 0.3, gain: 0.07, ...hit },
      { name: 'Touch', wave: 'hiss', filter: 'bandpass', cutoff: 700, cutoffEnd: 400, resonance: 0.6, length: 0.06, decay: 0.05, gain: 0.08, ...hit },
    ],
    master: { variation: 0 },
  },
  {
    name: 'Bell',
    group: 'Notes',
    vanilla: { event: 'block.note_block.bell', pitch: 1, like: 'A glockenspiel ping at F#6 with a high metallic shimmer, cut off at about 0.4 s.' },
    layers: [
      { name: 'Bar', wave: 'sine', pitch: 1480, pitchEnd: 1480, length: 0.42, attack: 0.002, decay: 0.75, sustain: 0, release: 0.09 },
      { name: 'Mode 2', wave: 'sine', pitch: 4085, pitchEnd: 4085, length: 0.3, decay: 0.3, gain: 0.1, ...hit },
      { name: 'Mode 3', wave: 'sine', pitch: 7990, pitchEnd: 7990, length: 0.35, decay: 0.4, gain: 0.19, ...hit },
      { name: 'Mallet', wave: 'hiss', filter: 'highpass', cutoff: 5000, cutoffEnd: 5000, length: 0.01, decay: 0.006, gain: 0.08, ...hit },
    ],
    master: { variation: 0 },
  },
  {
    name: 'Bass',
    group: 'Notes',
    vanilla: { event: 'block.note_block.bass', pitch: 1, like: 'A dark, round bass pluck at F#2, almost all fundamental, gone in a third of a second.' },
    layers: [
      { name: 'Body', wave: 'sine', pitch: 92.5, pitchEnd: 92.5, length: 0.36, attack: 0.002, decay: 0.55, sustain: 0, release: 0.05 },
      { name: 'Octave', wave: 'sine', pitch: 185, pitchEnd: 185, length: 0.36, attack: 0.002, decay: 0.4, sustain: 0, release: 0.05, gain: 0.45 },
      { name: 'Third', wave: 'sine', pitch: 277.5, pitchEnd: 277.5, length: 0.36, attack: 0.002, decay: 0.3, sustain: 0, release: 0.05, gain: 0.2 },
      { name: 'Fourth', wave: 'sine', pitch: 370, pitchEnd: 370, length: 0.3, decay: 0.25, gain: 0.1, ...hit },
      { name: 'Fifth', wave: 'sine', pitch: 462.5, pitchEnd: 462.5, length: 0.25, decay: 0.2, gain: 0.05, ...hit },
      { name: 'Upper', wave: 'sine', pitch: 740, pitchEnd: 740, length: 0.2, decay: 0.15, gain: 0.03, ...hit },
      { name: 'String', wave: 'pluck', pitch: 92.5, pitchEnd: 92.5, bright: 0.1, length: 0.36, attack: 0.001, decay: 0.3, sustain: 0, release: 0.05, filter: 'lowpass', cutoff: 500, cutoffEnd: 300, gain: 0.3 },
    ],
    master: { variation: 0 },
  },
  {
    name: 'Pling',
    group: 'Notes',
    vanilla: { event: 'block.note_block.pling', pitch: 1, like: 'A round electric-piano note at F#4 with a little bell on top, held briefly, then gone in half a second.' },
    layers: [
      { name: 'Tone', wave: 'sine', pitch: 370, pitchEnd: 370, length: 0.56, attack: 0.002, decay: 1.6, sustain: 0, release: 0.22 },
      { name: 'Second', wave: 'sine', pitch: 740, pitchEnd: 740, length: 0.5, attack: 0.002, decay: 0.9, sustain: 0, release: 0.15, gain: 0.45 },
      { name: 'Third', wave: 'sine', pitch: 1110, pitchEnd: 1110, length: 0.4, decay: 0.5, gain: 0.15, ...hit },
      { name: 'Fourth', wave: 'sine', pitch: 1480, pitchEnd: 1480, length: 0.35, decay: 0.35, gain: 0.08, ...hit },
      { name: 'Reed', wave: 'saw', pitch: 370, pitchEnd: 370, filter: 'lowpass', cutoff: 4000, cutoffEnd: 900, length: 0.4, decay: 0.35, gain: 0.07, ...hit },
      { name: 'Touch', wave: 'hiss', filter: 'bandpass', cutoff: 600, cutoffEnd: 300, resonance: 0.6, length: 0.08, decay: 0.07, gain: 0.08, ...hit },
      { name: 'Tine', wave: 'sine', pitch: 2220, pitchEnd: 2220, length: 0.3, decay: 0.25, gain: 0.22, ...hit },
      { name: 'Shine', wave: 'sine', pitch: 3330, pitchEnd: 3330, length: 0.15, decay: 0.12, gain: 0.03, ...hit },
    ],
    master: { variation: 0 },
  },

  /* ---------------- world ---------------- */
  {
    name: 'Explosion',
    group: 'World',
    accent: { on: [{ event: 'entity.generic.explode', pitch: 0.7, volume: 1 }], after: 0.02, adds: 'Debris after the boom: a dry crack, then stones and grit pattering down for about a second.' },
    layers: [
      { name: 'Crack', wave: 'noise', pitch: 2500, pitchEnd: 1200, filter: 'bandpass', cutoff: 2600, cutoffEnd: 1400, resonance: 0.6, length: 0.06, decay: 0.04, drive: 0.5, ...hit },
      { name: 'Grit', wave: 'crackle', pitch: 40, pitchEnd: 6, grain: 3, filter: 'bandpass', cutoff: 2200, cutoffEnd: 1500, resonance: 0.5, at: 0.05, length: 1.2, attack: 0.01, decay: 0.9, sustain: 0, release: 0.2, wobbleRate: 5, wobbleAmp: 0.6 },
      { name: 'Stones', wave: 'noise', pitch: 1400, pitchEnd: 1300, filter: 'bandpass', cutoff: 1500, cutoffEnd: 1300, resonance: 1.4, at: 0.15, length: 0.04, decay: 0.03, repeats: 7, gap: 0.13, jitter: 4, repeatDecay: 0.75, gain: 0.6, ...hit },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.5, variation: 2 },
  },
  {
    name: 'Ground slam',
    group: 'World',
    accent: {
      on: [
        { event: 'entity.generic.explode', pitch: 0.6, volume: 1.5 },
        { event: 'block.anvil.land', pitch: 0.5, volume: 0.8 },
      ],
      after: 0.02,
      adds: 'Weight: a low thump under 120 Hz, over in 0.15 s, that the recorded boom and clang lack.',
    },
    layers: [
      { name: 'Thump', wave: 'sine', pitch: 120, pitchEnd: 40, glide: 0.7, length: 0.16, decay: 0.12, drive: 0.4, ...hit },
      { name: 'Body', wave: 'rumble', filter: 'lowpass', cutoff: 140, cutoffEnd: 90, steep: true, length: 0.15, decay: 0.1, gain: 0.7, ...hit },
      { name: 'Knock', wave: 'noise', pitch: 400, pitchEnd: 200, filter: 'lowpass', cutoff: 900, cutoffEnd: 400, length: 0.03, decay: 0.02, gain: 0.3, ...hit },
    ],
    master: { variation: 1 },
  },
  {
    name: 'Lightning strike',
    group: 'World',
    accent: { on: [{ event: 'entity.lightning_bolt.thunder', pitch: 0.9, volume: 2 }], after: 0, adds: 'An electric crackle at the strike, a tenth of a second, which the rolling thunder has no edge for.' },
    layers: [
      { name: 'Zap', wave: 'square', pitch: 2400, pitchEnd: 300, glide: 0.6, rough: 0.8, crush: 0.4, filter: 'highpass', cutoff: 600, cutoffEnd: 600, length: 0.1, decay: 0.08, gain: 0.5, ...hit },
      { name: 'Sparks', wave: 'crackle', pitch: 500, pitchEnd: 200, grain: 0.5, filter: 'highpass', cutoff: 3000, cutoffEnd: 3000, length: 0.12, decay: 0.1, gain: 1, ...hit },
      { name: 'Snap', wave: 'noise', pitch: 4000, pitchEnd: 2000, filter: 'highpass', cutoff: 1500, cutoffEnd: 1500, length: 0.02, decay: 0.012, drive: 0.6, ...hit },
    ],
    master: { gain: 0.72, reverbMix: 0.1, reverbSize: 0.4, variation: 2 },
  },
  {
    name: 'TNT fuse',
    group: 'World',
    accent: { on: [{ event: 'entity.tnt.primed', pitch: 1, volume: 1 }], after: 0, adds: 'Sparks spitting off the fuse: sharp, thin, uneven ticks for the first two seconds.' },
    layers: [
      { name: 'Sparks', wave: 'crackle', pitch: 45, pitchEnd: 20, grain: 0.4, filter: 'highpass', cutoff: 4000, cutoffEnd: 4000, length: 2, attack: 0.05, decay: 1.6, sustain: 0, release: 0.3, wobbleRate: 6, wobbleAmp: 0.8 },
      { name: 'Spits', wave: 'noise', pitch: 3000, pitchEnd: 3000, filter: 'bandpass', cutoff: 5000, cutoffEnd: 4000, resonance: 0.8, at: 0.1, length: 0.03, decay: 0.02, repeats: 6, gap: 0.3, jitter: 3, repeatDecay: 0.8, gain: 0.4, ...hit },
    ],
    master: { variation: 1 },
  },
  {
    name: 'Splash',
    group: 'World',
    accent: { on: [{ event: 'entity.player.splash', pitch: 1, volume: 1 }], after: 0.15, adds: 'A trail of bubbles rising after the splash, thinning out over a second.' },
    layers: [
      { name: 'Bubbles', wave: 'bubbles', pitch: 30, pitchEnd: 6, bubble: 1100, length: 1.1, attack: 0.02, decay: 0.9, sustain: 0, release: 0.2, gain: 0.9 },
      { name: 'Glugs', wave: 'bubbles', pitch: 8, pitchEnd: 3, bubble: 350, length: 0.9, attack: 0.02, decay: 0.7, sustain: 0, release: 0.2, gain: 0.6 },
    ],
    master: { reverbMix: 0.1, reverbSize: 0.3, variation: 2 },
  },
  {
    name: 'Fire',
    group: 'World',
    accent: { on: [{ event: 'block.fire.ambient', pitch: 0.65, volume: 1 }], after: 0, adds: 'Embers: a soft high sizzle and a few sudden, sharp pops spread over a second and a half.' },
    layers: [
      { name: 'Pops', wave: 'crackle', pitch: 5, pitchEnd: 4, grain: 0.3, filter: 'highpass', cutoff: 1500, cutoffEnd: 1500, length: 1.6, attack: 0.05, ...held, release: 0.3, gain: 1.2 },
      { name: 'Sizzle', wave: 'hiss', filter: 'highpass', cutoff: 5000, cutoffEnd: 5000, steep: true, length: 1.6, attack: 0.2, ...held, release: 0.4, wobbleRate: 3, wobbleAmp: 0.7, gain: 0.12 },
    ],
    master: { gain: 0.45, variation: 2 },
  },
  {
    name: 'Lava pop',
    group: 'World',
    vanilla: { event: 'block.lava.pop', pitch: 1, like: 'A thick, low “blup” of a bubble bursting in lava, around a tenth of a second.' },
    layers: [
      { name: 'Bubble', wave: 'noise', pitch: 30, pitchEnd: 40, filter: 'bandpass', cutoff: 320, cutoffEnd: 480, resonance: 1.2, length: 0.13, decay: 0.08, drive: 0.3, ...hit },
      { name: 'Glop', wave: 'rumble', filter: 'lowpass', cutoff: 300, cutoffEnd: 200, length: 0.12, decay: 0.07, gain: 0.5, ...hit },
      { name: 'Spit', wave: 'crackle', pitch: 200, pitchEnd: 200, filter: 'highpass', cutoff: 2000, cutoffEnd: 2000, at: 0.02, length: 0.1, decay: 0.06, gain: 0.15, ...hit },
    ],
    master: { variation: 3 },
  },
  {
    name: 'Portal',
    group: 'World',
    vanilla: { event: 'block.portal.ambient', pitch: 1, like: 'A low hum near 87 Hz that swells and fades in slow waves for about five seconds, under a thin airy hiss.' },
    layers: [
      { name: 'Hum', wave: 'saw', pitch: 87, pitchEnd: 89, filter: 'lowpass', cutoff: 140, cutoffEnd: 140, resonance: 0.5, length: 4.9, attack: 0.8, ...held, release: 0.5, tremoloRate: 0.5, tremoloDepth: 0.9, vibratoRate: 0.3, vibratoDepth: 0.3 },
      { name: 'Air', wave: 'hiss', filter: 'bandpass', cutoff: 700, cutoffEnd: 1100, resonance: 0.5, length: 4.9, attack: 1.2, ...held, release: 0.6, tremoloRate: 0.5, tremoloDepth: 0.7, gain: 0.3 },
      { name: 'Swirl', wave: 'hiss', filter: 'bandpass', cutoff: 2500, cutoffEnd: 1500, resonance: 2, length: 4.9, attack: 1.5, ...held, release: 0.6, tremoloRate: 1.3, tremoloDepth: 0.7, gain: 0.06 },
    ],
    master: { reverbMix: 0.25, reverbSize: 0.5, variation: 2 },
  },
  {
    name: 'Teleport',
    group: 'World',
    vanilla: { event: 'entity.enderman.teleport', pitch: 1, like: 'A “vwoomp”: a chirp that drops in an instant onto a low hum near 90 Hz under a burst of noise, gone in half a second.' },
    layers: [
      { name: 'Drop', wave: 'saw', pitch: 900, pitchEnd: 90, glide: 0.9, filter: 'lowpass', cutoff: 800, cutoffEnd: 200, length: 0.45, attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.1, gain: 0.6 },
      { name: 'Hum', wave: 'sine', pitch: 92, pitchEnd: 82, at: 0.03, length: 0.45, attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.08, gain: 0.8 },
      { name: 'Rush', wave: 'hiss', filter: 'bandpass', cutoff: 5000, cutoffEnd: 2500, resonance: 0.5, length: 0.5, attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.1, gain: 0.35 },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.4, variation: 2 },
  },
  {
    name: 'Cave',
    group: 'World',
    accent: { on: [{ event: 'ambient.cave', pitch: 1, volume: 1 }], after: 0.3, adds: 'A low hum that hangs on after the cave noise for three seconds, two tones beating slowly, which makes it uneasier.' },
    layers: [
      { name: 'Hum', wave: 'sine', pitch: 55, pitchEnd: 52, length: 3.2, attack: 0.8, ...held, release: 1.2, wobbleRate: 0.7, wobblePitch: 0.3, wobbleAmp: 0.4, gain: 0.8 },
      { name: 'Beat', wave: 'triangle', pitch: 110.6, pitchEnd: 104.6, length: 3.2, attack: 1, ...held, release: 1.2, wobbleRate: 0.5, wobbleAmp: 0.5, gain: 0.25 },
    ],
    master: { gain: 0.04, reverbMix: 0.35, reverbSize: 0.7, variation: 1 },
  },

  /* ---------------- mobs ---------------- */
  {
    name: 'Zombie',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.zombie.ambient', pitch: 1, volume: 1 }], after: 0.05, adds: 'A wet, rotten gurgle in the throat under the groan, half a second.' },
    layers: [
      { name: 'Gurgle', wave: 'bubbles', pitch: 28, pitchEnd: 18, bubble: 260, length: 0.55, attack: 0.03, decay: 0.4, sustain: 0.3, release: 0.1, gain: 1 },
      { name: 'Throat', wave: 'saw', pitch: 70, pitchEnd: 60, rough: 0.7, filter: 'vowel', vowel: 3.5, vowelEnd: 4, throat: 0.8, resonance: 1.5, length: 0.55, attack: 0.03, decay: 0.4, sustain: 0.3, release: 0.1, wobbleRate: 12, wobbleAmp: 0.7, gain: 0.4 },
    ],
    master: { gain: 0.43, variation: 2 },
  },
  {
    name: 'Charged creeper',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.creeper.primed', pitch: 0.5, volume: 1 }], after: 0.1, adds: 'Electricity under the fuse: a buzz that rises and crackles for a second and a half, for a charged creeper.' },
    layers: [
      { name: 'Buzz', wave: 'saw', pitch: 60, pitchEnd: 140, glide: -0.3, rough: 0.4, filter: 'bandpass', cutoff: 900, cutoffEnd: 1800, resonance: 1.2, length: 1.5, attack: 0.3, ...held, release: 0.2, tremoloRate: 30, tremoloDepth: 0.4, gain: 0.5 },
      { name: 'Arcs', wave: 'crackle', pitch: 15, pitchEnd: 40, grain: 0.5, filter: 'highpass', cutoff: 3000, cutoffEnd: 3000, length: 1.5, attack: 0.3, ...held, release: 0.2, wobbleRate: 8, wobbleAmp: 0.7, gain: 0.9 },
    ],
    master: { gain: 0.35, variation: 1 },
  },
  {
    name: 'Skeleton',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.skeleton.ambient', pitch: 1, volume: 1 }], after: 0.03, adds: 'A dry bone rattle, a third of a second: hard little clicks of bone on bone.' },
    layers: [
      { name: 'Bones', wave: 'noise', pitch: 2200, pitchEnd: 1800, filter: 'bandpass', cutoff: 2000, cutoffEnd: 1700, resonance: 1.2, length: 0.025, decay: 0.015, repeats: 6, gap: 0.05, jitter: 4, repeatDecay: 0.8, ...hit },
      { name: 'Knock', wave: 'noise', pitch: 800, pitchEnd: 700, filter: 'bandpass', cutoff: 800, cutoffEnd: 700, resonance: 1.5, at: 0.02, length: 0.03, decay: 0.02, repeats: 3, gap: 0.09, jitter: 3, repeatDecay: 0.7, gain: 0.5, ...hit },
    ],
    master: { gain: 0.18, reverbMix: 0.05, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Slime',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.slime.squish', pitch: 1, volume: 1 }], after: 0.03, adds: 'A wet glop as it lands: a clutch of fat bubbles bursting, a third of a second.' },
    layers: [
      { name: 'Glop', wave: 'bubbles', pitch: 50, pitchEnd: 15, bubble: 450, length: 0.35, attack: 0.005, decay: 0.25, sustain: 0, release: 0.08, gain: 1 },
      { name: 'Smack', wave: 'noise', pitch: 300, pitchEnd: 150, filter: 'lowpass', cutoff: 700, cutoffEnd: 300, length: 0.05, decay: 0.035, gain: 0.4, ...hit },
    ],
    master: { gain: 0.64, variation: 3 },
  },
  {
    name: 'Ghast',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.ghast.ambient', pitch: 1, volume: 1 }], after: 0.1, adds: 'A quiet, airy echo of the cry that drifts on for a second, so it sounds far off and hollow.' },
    layers: [
      { name: 'Breath', wave: 'hiss', filter: 'bandpass', cutoff: 1400, cutoffEnd: 900, resonance: 2, length: 1.2, attack: 0.15, decay: 0.8, sustain: 0.2, release: 0.3, wobbleRate: 2, wobbleAmp: 0.6, gain: 0.6 },
      { name: 'Whine', wave: 'sine', pitch: 960, pitchEnd: 760, length: 1.1, attack: 0.2, decay: 0.7, sustain: 0.2, release: 0.3, wobbleRate: 3, wobblePitch: 0.5, gain: 0.15 },
    ],
    master: { gain: 0.15, reverbMix: 0.4, reverbSize: 0.7, echoMix: 0.2, echoTime: 0.3, echoFeedback: 0.25, variation: 2 },
  },
  {
    name: 'Fireball shot',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.blaze.shoot', pitch: 0.8, volume: 1 }], after: 0.02, adds: 'A sizzle as it leaves: high filtered noise that fades within 0.3 s.' },
    layers: [
      { name: 'Sizzle', wave: 'hiss', filter: 'highpass', cutoff: 4500, cutoffEnd: 3000, steep: true, length: 0.3, attack: 0.005, decay: 0.25, sustain: 0, release: 0.05, wobbleRate: 30, wobbleAmp: 0.5 },
      { name: 'Spit', wave: 'crackle', pitch: 150, pitchEnd: 60, grain: 0.5, filter: 'highpass', cutoff: 3000, cutoffEnd: 3000, length: 0.25, decay: 0.2, gain: 0.6, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Ender dragon',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.ender_dragon.growl', pitch: 1, volume: 2 }], after: 0.05, adds: 'Size: a sub-bass rumble with a torn, distorted edge under the growl, two seconds.' },
    layers: [
      { name: 'Sub', wave: 'sine', pitch: 45, pitchEnd: 38, rough: 0.3, length: 2, attack: 0.1, decay: 1, sustain: 0.5, release: 0.6, wobbleRate: 4, wobbleAmp: 0.4, drive: 0.5 },
      { name: 'Tear', wave: 'saw', pitch: 55, pitchEnd: 45, rough: 0.8, filter: 'lowpass', cutoff: 600, cutoffEnd: 300, length: 2, attack: 0.1, decay: 1, sustain: 0.5, release: 0.6, wobbleRate: 9, wobbleAmp: 0.6, drive: 0.9, gain: 0.4 },
    ],
    master: { gain: 0.6, reverbMix: 0.15, reverbSize: 0.6, variation: 2 },
  },
  {
    name: 'Boss roar',
    group: 'Mobs',
    accent: { on: [{ event: 'entity.ravager.roar', pitch: 0.7, volume: 2 }], after: 0.3, adds: 'A long, quiet tail that rises out of the roar: a distorted hum climbing for two and a half seconds.' },
    layers: [
      { name: 'Hum', wave: 'saw', pitch: 70, pitchEnd: 110, glide: -0.4, rough: 0.3, filter: 'lowpass', cutoff: 500, cutoffEnd: 1200, length: 2.5, attack: 0.6, decay: 1.2, sustain: 0.4, release: 0.7, wobbleRate: 5, wobbleAmp: 0.3, drive: 0.7, gain: 0.6 },
      { name: 'Air', wave: 'hiss', filter: 'bandpass', cutoff: 800, cutoffEnd: 2000, resonance: 0.8, length: 2.5, attack: 0.8, decay: 1, sustain: 0.3, release: 0.7, wobbleRate: 2, wobbleAmp: 0.5, gain: 0.2 },
    ],
    master: { gain: 0.4, reverbMix: 0.3, reverbSize: 0.8, variation: 1 },
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
    vanilla: p.vanilla,
    accent: p.accent,
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
