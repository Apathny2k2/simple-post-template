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
   pulled apart and changed. None contains any of Mojang's audio. */

import { layer, master, uid } from './synth'
import type { Layer, Master, Sound, Vanilla } from './synth'

export const GROUPS = ['Player', 'Blocks', 'Notes', 'World', 'Mobs'] as const
export type Group = (typeof GROUPS)[number]

type Preset = { name: string; group: Group; vanilla: Vanilla; layers: Partial<Layer>[]; master?: Partial<Master> }

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
    vanilla: { event: 'block.chest.open', pitch: 0.95, like: 'A low, rough wooden creak, held for half a second as the lid lifts, then cut off.' },
    layers: [
      { name: 'Wood', wave: 'rumble', filter: 'bandpass', cutoff: 180, cutoffEnd: 190, resonance: 2, length: 0.52, attack: 0.005, ...held, release: 0.12, tremoloRate: 23, tremoloDepth: 0.5 },
      { name: 'Rasp', wave: 'rumble', filter: 'bandpass', cutoff: 600, cutoffEnd: 700, resonance: 1, length: 0.52, attack: 0.005, ...held, release: 0.12, tremoloRate: 17, tremoloDepth: 0.6, gain: 0.7 },
      { name: 'Creak', wave: 'crackle', pitch: 900, pitchEnd: 700, filter: 'lowpass', cutoff: 3000, cutoffEnd: 2500, length: 0.52, attack: 0.005, ...held, release: 0.12, gain: 0.45 },
      { name: 'Grain', wave: 'hiss', filter: 'bandpass', cutoff: 2000, cutoffEnd: 2200, resonance: 1.5, length: 0.52, attack: 0.005, ...held, release: 0.12, tremoloRate: 21, tremoloDepth: 0.6, gain: 0.12 },
    ],
    master: { reverbMix: 0.04, reverbSize: 0.2, variation: 1 },
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
    vanilla: { event: 'entity.generic.explode', pitch: 0.7, like: 'A deep, heavy boom that sits under 100 Hz and rumbles on for about three seconds, with scattered cracks of debris above it.' },
    layers: [
      { name: 'Boom', wave: 'rumble', filter: 'lowpass', cutoff: 220, cutoffEnd: 110, length: 3.1, attack: 0.01, decay: 0.9, sustain: 0.25, release: 1.4, drive: 0.6 },
      { name: 'Body', wave: 'noise', pitch: 60, pitchEnd: 45, filter: 'lowpass', cutoff: 900, cutoffEnd: 250, length: 2.6, attack: 0.005, decay: 1.2, sustain: 0.1, release: 0.8, drive: 0.4, gain: 0.35 },
      { name: 'Blast', wave: 'hiss', filter: 'lowpass', cutoff: 6000, cutoffEnd: 1500, length: 0.8, attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.3, gain: 0.25 },
      { name: 'Debris', wave: 'crackle', pitch: 30, pitchEnd: 8, filter: 'bandpass', cutoff: 2500, cutoffEnd: 1800, resonance: 0.4, length: 3, attack: 0.05, decay: 2, sustain: 0, release: 0.5, gain: 0.9 },
    ],
    master: { reverbMix: 0.2, reverbSize: 0.6, variation: 2 },
  },
  {
    name: 'TNT fuse',
    group: 'World',
    vanilla: { event: 'entity.tnt.primed', pitch: 1, like: 'A lit fuse: a very bright, high fizz that flares at once and then dies away over about two and a half seconds.' },
    layers: [
      { name: 'Fizz', wave: 'hiss', filter: 'highpass', cutoff: 5000, cutoffEnd: 4000, length: 2.6, attack: 0.15, decay: 1.6, sustain: 0.2, release: 0.8 },
      { name: 'Sputter', wave: 'crackle', pitch: 200, pitchEnd: 120, filter: 'highpass', cutoff: 4000, cutoffEnd: 4000, length: 2.5, attack: 0.1, decay: 1.4, sustain: 0.15, release: 0.8, gain: 0.6 },
      { name: 'Burn', wave: 'hiss', filter: 'lowpass', cutoff: 2500, cutoffEnd: 2000, length: 2.4, attack: 0.15, decay: 1.2, sustain: 0.15, release: 0.8, tremoloRate: 7, tremoloDepth: 0.3, gain: 0.3 },
    ],
    master: { variation: 1 },
  },
  {
    name: 'Splash',
    group: 'World',
    vanilla: { event: 'entity.player.splash', pitch: 1, like: 'A broad wash of churning water, full from the low end to the top, that keeps going for one to three seconds before it settles.' },
    layers: [
      { name: 'Slap', wave: 'hiss', filter: 'lowpass', cutoff: 4000, cutoffEnd: 1500, length: 0.12, decay: 0.08, gain: 0.4, ...hit },
      { name: 'Wash', wave: 'hiss', filter: 'bandpass', cutoff: 1500, cutoffEnd: 900, resonance: 0.3, length: 1.6, attack: 0.03, decay: 1.3, sustain: 0.2, release: 0.3, tremoloRate: 9, tremoloDepth: 0.4, gain: 0.7 },
      { name: 'Churn', wave: 'crackle', pitch: 90, pitchEnd: 30, filter: 'bandpass', cutoff: 1200, cutoffEnd: 700, resonance: 0.5, length: 1.6, attack: 0.03, decay: 1.2, sustain: 0.1, release: 0.3, gain: 0.5 },
      { name: 'Body', wave: 'noise', pitch: 30, pitchEnd: 20, filter: 'bandpass', cutoff: 250, cutoffEnd: 200, resonance: 1, length: 1.4, attack: 0.05, decay: 1, sustain: 0.2, release: 0.3, gain: 0.2 },
    ],
    master: { reverbMix: 0.12, reverbSize: 0.3, variation: 2 },
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
    name: 'Fire',
    group: 'World',
    vanilla: { event: 'block.fire.ambient', pitch: 0.65, like: 'A low, soft rumble of burning under 150 Hz with sharp little crackles flicking across the top; the game plays it low.' },
    layers: [
      { name: 'Roar', wave: 'rumble', filter: 'lowpass', cutoff: 180, cutoffEnd: 180, length: 2.8, attack: 0.5, ...held, release: 0.3, tremoloRate: 2.3, tremoloDepth: 0.3, gain: 0.5 },
      { name: 'Crackle', wave: 'crackle', pitch: 35, pitchEnd: 35, filter: 'highpass', cutoff: 2500, cutoffEnd: 2500, length: 2.8, attack: 0.3, ...held, release: 0.3, gain: 1.3 },
      { name: 'Hiss', wave: 'hiss', filter: 'highpass', cutoff: 3000, cutoffEnd: 3000, length: 2.8, attack: 0.5, ...held, release: 0.3, gain: 0.04 },
      { name: 'Pops', wave: 'crackle', pitch: 6, pitchEnd: 6, filter: 'bandpass', cutoff: 1200, cutoffEnd: 1200, resonance: 0.5, length: 2.8, attack: 0.3, ...held, release: 0.3, gain: 1 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Thunder',
    group: 'World',
    vanilla: { event: 'entity.lightning_bolt.thunder', pitch: 0.9, like: 'A dark, booming roll with almost nothing above 2 kHz, swelling in waves for seven seconds.' },
    layers: [
      { name: 'Crack', wave: 'noise', pitch: 50, pitchEnd: 40, filter: 'lowpass', cutoff: 1500, cutoffEnd: 600, length: 0.6, attack: 0.03, decay: 0.4, sustain: 0, release: 0.1, drive: 0.4, gain: 0.7 },
      { name: 'Roll', wave: 'rumble', filter: 'lowpass', cutoff: 900, cutoffEnd: 300, length: 7, attack: 0.05, decay: 4, sustain: 0.2, release: 1.5, tremoloRate: 0.9, tremoloDepth: 0.35, drive: 0.3 },
      { name: 'Rumbles', wave: 'noise', pitch: 25, pitchEnd: 15, filter: 'lowpass', cutoff: 600, cutoffEnd: 350, at: 0.3, length: 1.6, attack: 0.25, decay: 1.2, sustain: 0, release: 0.2, repeats: 4, gap: 1.4, repeatDecay: 0.75, gain: 0.7 },
    ],
    master: { reverbMix: 0.35, reverbSize: 0.9, variation: 2 },
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
    vanilla: { event: 'ambient.cave', pitch: 1, like: 'One of 23 different eerie noises, a few seconds each: rumbles, moans, scrapes and far-off tones in a big echo. This one is a low swelling moan with a scrape.' },
    layers: [
      { name: 'Drone', wave: 'saw', pitch: 98, pitchEnd: 92, filter: 'lowpass', cutoff: 500, cutoffEnd: 350, length: 4, attack: 1.2, ...held, release: 1, vibratoRate: 0.15, vibratoDepth: 0.3, gain: 0.45 },
      { name: 'Moan', wave: 'triangle', pitch: 196, pitchEnd: 185, at: 0.8, length: 3, attack: 1.2, ...held, release: 0.8, vibratoRate: 0.3, vibratoDepth: 0.4, gain: 0.25 },
      { name: 'Scrape', wave: 'noise', pitch: 300, pitchEnd: 220, filter: 'bandpass', cutoff: 900, cutoffEnd: 500, resonance: 2, at: 1.8, length: 1.8, attack: 0.5, decay: 1, sustain: 0.3, release: 0.4, gain: 0.4 },
    ],
    master: { reverbMix: 0.6, reverbSize: 1, echoMix: 0.15, echoTime: 0.45, echoFeedback: 0.3, variation: 1 },
  },

  /* ---------------- mobs ---------------- */
  {
    name: 'Zombie',
    group: 'Mobs',
    vanilla: { event: 'entity.zombie.ambient', pitch: 1, like: 'A low, raspy growl of about a second and a half: more throat noise than a sung note, strong from 150 to 500 Hz.' },
    layers: [
      { name: 'Growl', wave: 'noise', pitch: 95, pitchEnd: 80, length: 1.2, attack: 0.04, decay: 0.5, sustain: 0.8, release: 0.4, tremoloRate: 11, tremoloDepth: 0.35, filter: 'vowel', vowel: 3, vowelEnd: 3.6, throat: 0.9, resonance: 1.5, drive: 0.6, gain: 1.2 },
      { name: 'Voice', wave: 'saw', pitch: 88, pitchEnd: 80, glide: -0.2, length: 1.2, attack: 0.05, decay: 0.5, sustain: 0.8, release: 0.4, vibratoRate: 7, vibratoDepth: 0.8, filter: 'vowel', vowel: 2.8, vowelEnd: 3.6, throat: 0.9, resonance: 2, drive: 0.7, gain: 0.6 },
      { name: 'Chest', wave: 'saw', pitch: 115, pitchEnd: 98, vibratoRate: 7, vibratoDepth: 2, filter: 'lowpass', cutoff: 500, cutoffEnd: 400, drive: 0.5, length: 1.25, attack: 0.04, decay: 0.5, sustain: 0.8, release: 0.35, tremoloRate: 11, tremoloDepth: 0.35, gain: 0.6 },
      { name: 'Rasp', wave: 'hiss', length: 1.2, attack: 0.05, decay: 0.5, sustain: 0.8, release: 0.4, tremoloRate: 23, tremoloDepth: 0.5, filter: 'bandpass', cutoff: 3000, cutoffEnd: 2500, resonance: 0.5, gain: 0.55 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Creeper hiss',
    group: 'Mobs',
    vanilla: { event: 'entity.creeper.primed', pitch: 0.5, like: 'The fuse played at half speed: a quick sparkle, then a bright fizz that swells and slowly thins over five seconds.' },
    layers: [
      { name: 'Light', wave: 'crackle', pitch: 120, pitchEnd: 60, filter: 'highpass', cutoff: 1500, cutoffEnd: 1500, length: 0.45, decay: 0.3, gain: 0.5, ...hit },
      { name: 'Fizz', wave: 'hiss', filter: 'bandpass', cutoff: 3000, cutoffEnd: 2500, resonance: 0.5, at: 0.45, length: 4.8, attack: 0.3, decay: 4.2, sustain: 0.1, release: 0.3 },
      { name: 'Sputter', wave: 'crackle', pitch: 80, pitchEnd: 60, filter: 'highpass', cutoff: 1250, cutoffEnd: 1250, at: 0.45, length: 4.8, attack: 0.3, decay: 4.2, sustain: 0.1, release: 0.3, gain: 0.7 },
      { name: 'Burn', wave: 'hiss', filter: 'bandpass', cutoff: 600, cutoffEnd: 500, resonance: 0.7, at: 0.45, length: 4.8, attack: 0.3, decay: 4.2, sustain: 0.1, release: 0.3, tremoloRate: 3.5, tremoloDepth: 0.3, gain: 0.45 },
    ],
    master: { variation: 0.5 },
  },
  {
    name: 'Skeleton',
    group: 'Mobs',
    vanilla: { event: 'entity.skeleton.ambient', pitch: 1, like: 'A short hollow rattle, under half a second: three or four dry clatters centred in the mids.' },
    layers: [
      { name: 'Clatter', wave: 'noise', pitch: 1200, pitchEnd: 1100, filter: 'bandpass', cutoff: 900, cutoffEnd: 800, resonance: 0.9, length: 0.07, attack: 0.003, decay: 0.05, sustain: 0, release: 0.01, repeats: 5, gap: 0.08, jitter: 3, repeatDecay: 0.85 },
      { name: 'Hollow', wave: 'pluck', pitch: 474, pitchEnd: 470, bright: 0.25, filter: 'highpass', cutoff: 350, cutoffEnd: 350, length: 0.09, decay: 0.07, repeats: 5, gap: 0.08, repeatDecay: 0.85, gain: 0.9, ...hit },
      { name: 'Click', wave: 'crackle', pitch: 300, pitchEnd: 300, filter: 'bandpass', cutoff: 2000, cutoffEnd: 1800, resonance: 0.7, length: 0.4, attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.03, gain: 0.18 },
    ],
    master: { reverbMix: 0.06, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Slime',
    group: 'Mobs',
    vanilla: { event: 'entity.slime.squish', pitch: 1, like: 'A wet splat with a heavy low thump, gone in a tenth of a second and leaving a soft squishy tail.' },
    layers: [
      { name: 'Splat', wave: 'hiss', filter: 'lowpass', cutoff: 9000, cutoffEnd: 2500, at: 0.012, length: 0.3, attack: 0.02, decay: 0.2, sustain: 0, release: 0.03, gain: 1.2 },
      { name: 'Thump', wave: 'rumble', filter: 'lowpass', cutoff: 250, cutoffEnd: 120, at: 0.012, length: 0.3, attack: 0.02, decay: 0.15, sustain: 0, release: 0.05, gain: 0.7 },
      { name: 'Squelch', wave: 'noise', pitch: 200, pitchEnd: 120, filter: 'vowel', vowel: 4, vowelEnd: 2, throat: 0.8, resonance: 2.5, gain: 1.8, at: 0.012, length: 0.45, attack: 0.01, decay: 0.12, sustain: 0.08, release: 0.15 },
      { name: 'Smack', wave: 'noise', pitch: 900, pitchEnd: 500, filter: 'bandpass', cutoff: 1100, cutoffEnd: 700, resonance: 0.7, at: 0.012, length: 0.3, attack: 0.01, decay: 0.18, sustain: 0, release: 0.03, gain: 1.8 },
      { name: 'Wet', wave: 'crackle', pitch: 400, pitchEnd: 60, filter: 'bandpass', cutoff: 2000, cutoffEnd: 1200, resonance: 0.8, length: 0.5, decay: 0.3, gain: 0.3, ...hit },
    ],
    master: { variation: 3 },
  },
  {
    name: 'Ghast',
    group: 'Mobs',
    vanilla: { event: 'entity.ghast.ambient', pitch: 1, like: 'A short, high crying moan under a second: a clear tone near 480 Hz that sags, often in two breaths, over a rough noisy bed.' },
    layers: [
      { name: 'Cry', wave: 'triangle', pitch: 485, pitchEnd: 383, glide: -0.2, length: 0.66, attack: 0.06, decay: 0.3, sustain: 0.8, release: 0.1, vibratoRate: 6, vibratoDepth: 0.3, tremoloRate: 3, tremoloDepth: 0.25 },
      { name: 'Overtone', wave: 'sine', pitch: 970, pitchEnd: 766, glide: -0.2, length: 0.66, attack: 0.06, decay: 0.3, sustain: 0.8, release: 0.1, vibratoRate: 6, vibratoDepth: 0.3, tremoloRate: 3, tremoloDepth: 0.25, gain: 0.3 },
      { name: 'Rough', wave: 'noise', pitch: 260, pitchEnd: 200, filter: 'bandpass', cutoff: 500, cutoffEnd: 400, resonance: 0.7, length: 0.66, attack: 0.06, decay: 0.3, sustain: 0.8, release: 0.1, gain: 0.35 },
      { name: 'Air', wave: 'hiss', filter: 'bandpass', cutoff: 3000, cutoffEnd: 2500, resonance: 0.5, length: 0.66, attack: 0.06, decay: 0.3, sustain: 0.8, release: 0.1, gain: 0.12 },
    ],
    master: { reverbMix: 0.12, reverbSize: 0.4, variation: 2 },
  },
  {
    name: 'Ender dragon',
    group: 'Mobs',
    vanilla: { event: 'entity.ender_dragon.growl', pitch: 1, like: 'A deep, dark roar of about two and a half seconds, loudest below 250 Hz, holding and then fading.' },
    layers: [
      { name: 'Roar', wave: 'saw', pitch: 62, pitchEnd: 50, at: 0.12, length: 2.3, attack: 0.08, decay: 1, sustain: 0.8, release: 0.6, vibratoRate: 9, vibratoDepth: 1.5, filter: 'vowel', vowel: 3, vowelEnd: 4, throat: 0.45, resonance: 2, drive: 0.9 },
      { name: 'Sub', wave: 'rumble', filter: 'lowpass', cutoff: 400, cutoffEnd: 250, at: 0.12, length: 2.3, attack: 0.08, decay: 1, sustain: 0.8, release: 0.6, gain: 1.3 },
      { name: 'Rasp', wave: 'noise', pitch: 70, pitchEnd: 55, filter: 'lowpass', cutoff: 5000, cutoffEnd: 2500, at: 0.12, length: 2.3, attack: 0.08, decay: 1, sustain: 0.8, release: 0.6, tremoloRate: 22, tremoloDepth: 0.5, gain: 1 },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.5, variation: 2 },
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
