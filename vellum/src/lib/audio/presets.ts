/* Starting points, each made to sound like one of the game's own sounds as
   a player hears it in play: at the pitch the game plays it at, which is
   not always the file's own (an item pickup is played up to twice as high,
   an explosion at about 0.7). `vanilla` names that sound, so the console
   can give the /playsound that plays it for comparison.

   The game's sounds are recordings: plucked strings, voices, wood, stone,
   water and metal. So these are built from what makes those, not from
   bare tones: a plucked string (Karplus-Strong) for the note blocks and the
   bow, a vowel filter on a buzzing source for every voice, crackle for
   fire, grit and creaks, and noise rung through narrow filters for wood
   and stone. Every one is ordinary layers that can be pulled apart and
   changed. None is a copy of a Mojang sound. */

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
    vanilla: { event: 'entity.experience_orb.pickup', pitch: 0.9, like: 'A small glassy “tink” that rings for a moment; each orb a different pitch.' },
    layers: [
      { name: 'Tine', wave: 'sine', pitch: 1660, pitchEnd: 1660, fmRatio: 3.5, fmIndex: 0.5, length: 0.55, decay: 0.38, ...hit },
      { name: 'Beat', wave: 'sine', pitch: 1666, pitchEnd: 1666, length: 0.45, decay: 0.3, gain: 0.45, ...hit },
      { name: 'Glass', wave: 'sine', pitch: 4580, pitchEnd: 4580, length: 0.2, decay: 0.12, gain: 0.3, ...hit },
      { name: 'Touch', wave: 'hiss', filter: 'highpass', cutoff: 6000, cutoffEnd: 6000, length: 0.01, decay: 0.006, gain: 0.35, ...hit },
    ],
    master: { reverbMix: 0.12, reverbSize: 0.3, variation: 5 },
  },
  {
    name: 'Level up',
    group: 'Player',
    vanilla: { event: 'entity.player.levelup', pitch: 1, like: 'A quick run of chimes up into a bright shimmering tone that hangs and fades.' },
    layers: [
      { name: 'G', wave: 'sine', pitch: 784, pitchEnd: 784, fmRatio: 3, fmIndex: 0.8, length: 0.4, decay: 0.3, gain: 0.55, ...hit },
      { name: 'B', wave: 'sine', pitch: 988, pitchEnd: 988, fmRatio: 3, fmIndex: 0.8, at: 0.06, length: 0.4, decay: 0.3, gain: 0.55, ...hit },
      { name: 'D', wave: 'sine', pitch: 1175, pitchEnd: 1175, fmRatio: 3, fmIndex: 0.8, at: 0.12, length: 0.4, decay: 0.3, gain: 0.55, ...hit },
      { name: 'Shine', wave: 'sine', pitch: 1568, pitchEnd: 1568, fmRatio: 2, fmIndex: 0.6, at: 0.18, length: 1.2, attack: 0.01, decay: 0.9, sustain: 0.15, release: 0.4, tremoloRate: 11, tremoloDepth: 0.35 },
      { name: 'Air', wave: 'sine', pitch: 3136, pitchEnd: 3136, at: 0.18, length: 0.9, attack: 0.02, decay: 0.6, sustain: 0.1, release: 0.3, tremoloRate: 13, tremoloDepth: 0.5, gain: 0.3 },
    ],
    master: { reverbMix: 0.35, reverbSize: 0.55, variation: 0 },
  },
  {
    name: 'Click',
    group: 'Player',
    vanilla: { event: 'ui.button.click', pitch: 1, like: 'A short dry plastic “tik” with a hint of a hollow tone.' },
    layers: [
      { name: 'Body', wave: 'hiss', filter: 'bandpass', cutoff: 1300, cutoffEnd: 1300, resonance: 7, length: 0.06, decay: 0.035, ...hit },
      { name: 'Snap', wave: 'hiss', filter: 'bandpass', cutoff: 3400, cutoffEnd: 3400, resonance: 6, length: 0.03, decay: 0.012, gain: 0.7, ...hit },
      { name: 'Tone', wave: 'sine', pitch: 1300, pitchEnd: 1250, length: 0.05, decay: 0.03, gain: 0.25, ...hit },
    ],
    master: { variation: 0.5 },
  },
  {
    name: 'Item pickup',
    group: 'Player',
    vanilla: { event: 'entity.item.pickup', pitch: 2, like: 'A tiny bubbly “plip” that bends up, high because the game doubles its pitch.' },
    layers: [
      { name: 'Bubble', wave: 'sine', pitch: 620, pitchEnd: 1650, glide: 0.5, length: 0.07, attack: 0.001, decay: 0.05, sustain: 0, release: 0.01, drive: 0.15 },
      { name: 'Lip', wave: 'hiss', filter: 'bandpass', cutoff: 2600, cutoffEnd: 2600, resonance: 2, length: 0.012, decay: 0.006, gain: 0.25, ...hit },
    ],
    master: { variation: 4 },
  },
  {
    name: 'Hurt',
    group: 'Player',
    vanilla: { event: 'entity.player.hurt', pitch: 1, like: 'A short grunt from the chest, the “oof”, falling as it ends.' },
    layers: [
      { name: 'Voice', wave: 'saw', pitch: 168, pitchEnd: 118, glide: 0.3, length: 0.26, attack: 0.012, decay: 0.16, sustain: 0.25, release: 0.06, filter: 'vowel', vowel: 2.8, vowelEnd: 3.8, throat: 1, resonance: 2.5, drive: 0.25 },
      { name: 'Breath', wave: 'hiss', length: 0.22, attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.05, filter: 'vowel', vowel: 2.8, vowelEnd: 3.8, resonance: 2, gain: 0.2 },
    ],
    master: { variation: 1.5 },
  },
  {
    name: 'Bow shot',
    group: 'Player',
    vanilla: { event: 'entity.arrow.shoot', pitch: 1.1, like: 'A “fwip” of air with the bowstring’s low twang under it.' },
    layers: [
      { name: 'Air', wave: 'hiss', filter: 'bandpass', cutoff: 900, cutoffEnd: 3000, resonance: 1.3, length: 0.3, attack: 0.015, decay: 0.2, sustain: 0, release: 0.05 },
      { name: 'String', wave: 'pluck', pitch: 118, pitchEnd: 100, bright: 0.45, length: 0.4, attack: 0.001, decay: 0.3, sustain: 0, release: 0.05, gain: 0.9 },
      { name: 'Release', wave: 'crackle', pitch: 600, pitchEnd: 600, filter: 'highpass', cutoff: 2500, cutoffEnd: 2500, length: 0.03, decay: 0.02, gain: 0.5, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Eat',
    group: 'Player',
    vanilla: { event: 'entity.generic.eat', pitch: 1, like: 'One wet, crunchy chomp. The game plays it over and over while eating.' },
    layers: [
      { name: 'Crunch', wave: 'crackle', pitch: 900, pitchEnd: 500, filter: 'bandpass', cutoff: 2500, cutoffEnd: 2000, resonance: 0.8, length: 0.18, attack: 0.004, decay: 0.14, sustain: 0, release: 0.03 },
      { name: 'Wet', wave: 'hiss', filter: 'lowpass', cutoff: 1400, cutoffEnd: 700, length: 0.13, attack: 0.004, decay: 0.1, sustain: 0, release: 0.02, gain: 0.45 },
      { name: 'Jaw', wave: 'sine', pitch: 150, pitchEnd: 90, glide: 0.4, length: 0.07, decay: 0.05, gain: 0.35, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Grass step',
    group: 'Player',
    vanilla: { event: 'block.grass.step', pitch: 1, like: 'A soft crunchy rustle of a foot on grass, about a fifth of a second.' },
    layers: [
      { name: 'Rustle', wave: 'crackle', pitch: 1600, pitchEnd: 900, filter: 'bandpass', cutoff: 3500, cutoffEnd: 3000, resonance: 0.8, length: 0.2, attack: 0.012, decay: 0.15, sustain: 0, release: 0.03 },
      { name: 'Blades', wave: 'hiss', filter: 'bandpass', cutoff: 4200, cutoffEnd: 3500, resonance: 0.7, length: 0.15, attack: 0.01, decay: 0.1, sustain: 0, release: 0.02, gain: 0.3 },
      { name: 'Foot', wave: 'rumble', filter: 'lowpass', cutoff: 260, cutoffEnd: 200, length: 0.08, attack: 0.005, decay: 0.05, gain: 0.5, sustain: 0, release: 0.02 },
    ],
    master: { variation: 2 },
  },

  /* ---------------- blocks ---------------- */
  {
    name: 'Wood break',
    group: 'Blocks',
    vanilla: { event: 'block.wood.break', pitch: 0.8, like: 'A hollow wooden “tok” that cracks and splinters.' },
    layers: [
      { name: 'Body', wave: 'hiss', filter: 'bandpass', cutoff: 300, cutoffEnd: 290, resonance: 5, length: 0.3, decay: 0.24, ...hit },
      { name: 'Board', wave: 'hiss', filter: 'bandpass', cutoff: 720, cutoffEnd: 700, resonance: 6, length: 0.2, decay: 0.15, gain: 0.8, ...hit },
      { name: 'Grain', wave: 'hiss', filter: 'bandpass', cutoff: 1450, cutoffEnd: 1400, resonance: 7, length: 0.12, decay: 0.08, gain: 0.5, ...hit },
      { name: 'Splinter', wave: 'crackle', pitch: 700, pitchEnd: 150, filter: 'bandpass', cutoff: 2400, cutoffEnd: 2000, resonance: 1.5, length: 0.22, attack: 0.01, decay: 0.16, sustain: 0, release: 0.03, gain: 0.12 },
    ],
    master: { reverbMix: 0.08, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Chest open',
    group: 'Blocks',
    vanilla: { event: 'block.chest.open', pitch: 0.95, like: 'An old hinge creaking up for half a second as the lid lifts.' },
    layers: [
      { name: 'Hinge', wave: 'square', duty: 0.08, pitch: 170, pitchEnd: 255, glide: -0.2, length: 0.48, attack: 0.04, ...held, release: 0.08, vibratoRate: 23, vibratoDepth: 0.9, filter: 'bandpass', cutoff: 1100, cutoffEnd: 1250, resonance: 5, drive: 0.35, gain: 0.8 },
      { name: 'Grind', wave: 'crackle', pitch: 260, pitchEnd: 340, filter: 'bandpass', cutoff: 2300, cutoffEnd: 2300, resonance: 5, length: 0.46, attack: 0.04, ...held, release: 0.08, gain: 0.5 },
      { name: 'Lid', wave: 'hiss', filter: 'bandpass', cutoff: 240, cutoffEnd: 230, resonance: 6, length: 0.12, decay: 0.08, gain: 0.45, ...hit },
    ],
    master: { reverbMix: 0.1, reverbSize: 0.25, variation: 1 },
  },
  {
    name: 'Stone break',
    group: 'Blocks',
    vanilla: { event: 'block.stone.break', pitch: 0.8, like: 'A gritty crunch of rock breaking, dry and quick.' },
    layers: [
      { name: 'Crunch', wave: 'crackle', pitch: 2600, pitchEnd: 900, filter: 'bandpass', cutoff: 1700, cutoffEnd: 1300, resonance: 0.9, length: 0.3, attack: 0.002, decay: 0.22, sustain: 0, release: 0.03 },
      { name: 'Rock', wave: 'hiss', filter: 'bandpass', cutoff: 480, cutoffEnd: 420, resonance: 3, length: 0.16, decay: 0.1, gain: 0.7, ...hit },
      { name: 'Grit', wave: 'noise', pitch: 600, pitchEnd: 450, filter: 'lowpass', cutoff: 3000, cutoffEnd: 1500, length: 0.2, decay: 0.12, gain: 0.35, ...hit },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Glass break',
    group: 'Blocks',
    vanilla: { event: 'block.glass.break', pitch: 0.8, like: 'A sharp crack, then a spray of tinkling shards that scatter and settle.' },
    layers: [
      { name: 'Crack', wave: 'hiss', filter: 'highpass', cutoff: 2000, cutoffEnd: 2000, length: 0.05, decay: 0.03, ...hit },
      { name: 'Shards', wave: 'sine', pitch: 3800, pitchEnd: 3760, fmRatio: 2.76, fmIndex: 1.2, length: 0.18, decay: 0.14, repeats: 14, gap: 0.035, jitter: 9, repeatDecay: 0.88, gain: 0.45, ...hit },
      { name: 'Tinkles', wave: 'sine', pitch: 6200, pitchEnd: 6200, at: 0.02, length: 0.12, decay: 0.09, repeats: 10, gap: 0.05, jitter: 7, repeatDecay: 0.86, gain: 0.3, ...hit },
      { name: 'Sprinkle', wave: 'crackle', pitch: 400, pitchEnd: 60, filter: 'highpass', cutoff: 4000, cutoffEnd: 4000, length: 0.7, attack: 0.005, decay: 0.5, sustain: 0, release: 0.1, gain: 0.5 },
    ],
    master: { reverbMix: 0.15, reverbSize: 0.3, variation: 2 },
  },
  {
    name: 'Lever',
    group: 'Blocks',
    vanilla: { event: 'block.lever.click', pitch: 0.6, like: 'The button click played lower and heavier: the game plays it at 0.6.' },
    layers: [
      { name: 'Body', wave: 'hiss', filter: 'bandpass', cutoff: 780, cutoffEnd: 780, resonance: 7, length: 0.09, decay: 0.055, ...hit },
      { name: 'Snap', wave: 'hiss', filter: 'bandpass', cutoff: 2040, cutoffEnd: 2040, resonance: 6, length: 0.045, decay: 0.02, gain: 0.7, ...hit },
      { name: 'Tone', wave: 'sine', pitch: 780, pitchEnd: 750, length: 0.08, decay: 0.05, gain: 0.25, ...hit },
    ],
    master: { variation: 0.5 },
  },
  {
    name: 'Anvil land',
    group: 'Blocks',
    vanilla: { event: 'block.anvil.land', pitch: 0.95, like: 'A heavy metal clang that rings and beats for over a second.' },
    layers: [
      { name: 'Ring', wave: 'sine', pitch: 440, pitchEnd: 440, length: 1.6, decay: 1.4, ...hit },
      { name: 'Beat', wave: 'sine', pitch: 446, pitchEnd: 446, length: 1.4, decay: 1.2, gain: 0.5, ...hit },
      { name: 'Mode 2', wave: 'sine', pitch: 1093, pitchEnd: 1093, length: 1.1, decay: 1, gain: 0.7, ...hit },
      { name: 'Mode 3', wave: 'sine', pitch: 1830, pitchEnd: 1830, length: 0.8, decay: 0.7, gain: 0.5, ...hit },
      { name: 'Mode 4', wave: 'sine', pitch: 2710, pitchEnd: 2710, length: 0.6, decay: 0.5, gain: 0.4, ...hit },
      { name: 'Strike', wave: 'hiss', filter: 'bandpass', cutoff: 2500, cutoffEnd: 2500, resonance: 0.7, length: 0.04, decay: 0.025, gain: 0.8, ...hit },
      { name: 'Weight', wave: 'rumble', filter: 'lowpass', cutoff: 220, cutoffEnd: 150, length: 0.14, decay: 0.09, gain: 0.8, ...hit },
    ],
    master: { reverbMix: 0.2, reverbSize: 0.4, variation: 1 },
  },

  /* ---------------- notes ---------------- */
  /* A note block plays its instrument at 0.5 to 2, the 25 clicks; 1 is the
     middle click, an F#. Each is pitched here to its middle note. */
  {
    name: 'Harp',
    group: 'Notes',
    vanilla: { event: 'block.note_block.harp', pitch: 1, like: 'A plucked harp string at F#4, bright at first and gone in about a second.' },
    layers: [
      { name: 'String', wave: 'pluck', pitch: 370, pitchEnd: 370, bright: 0.75, length: 1.4, attack: 0.001, decay: 1.2, sustain: 0, release: 0.1 },
      { name: 'Wood', wave: 'sine', pitch: 370, pitchEnd: 370, length: 0.5, decay: 0.35, gain: 0.3, ...hit },
    ],
    master: { reverbMix: 0.1, reverbSize: 0.3, variation: 0 },
  },
  {
    name: 'Bell',
    group: 'Notes',
    vanilla: { event: 'block.note_block.bell', pitch: 1, like: 'A glockenspiel bar at F#6: a clear metal ping with a long, pure ring.' },
    layers: [
      { name: 'Bar', wave: 'sine', pitch: 1480, pitchEnd: 1480, length: 2, decay: 1.6, ...hit },
      { name: 'Mode 2', wave: 'sine', pitch: 4085, pitchEnd: 4085, length: 0.7, decay: 0.5, gain: 0.4, ...hit },
      { name: 'Mode 3', wave: 'sine', pitch: 7990, pitchEnd: 7990, length: 0.3, decay: 0.2, gain: 0.2, ...hit },
      { name: 'Mallet', wave: 'hiss', filter: 'highpass', cutoff: 5000, cutoffEnd: 5000, length: 0.012, decay: 0.006, gain: 0.3, ...hit },
    ],
    master: { reverbMix: 0.12, reverbSize: 0.35, variation: 0 },
  },
  {
    name: 'Bass',
    group: 'Notes',
    vanilla: { event: 'block.note_block.bass', pitch: 1, like: 'A plucked upright bass at F#2, round and woody, under a second.' },
    layers: [
      { name: 'String', wave: 'pluck', pitch: 92.5, pitchEnd: 92.5, bright: 0.35, length: 0.9, attack: 0.001, decay: 0.7, sustain: 0, release: 0.08 },
      { name: 'Body', wave: 'sine', pitch: 92.5, pitchEnd: 92.5, length: 0.6, decay: 0.45, gain: 0.5, ...hit },
      { name: 'Thump', wave: 'hiss', filter: 'lowpass', cutoff: 450, cutoffEnd: 450, length: 0.03, decay: 0.02, gain: 0.4, ...hit },
    ],
    master: { variation: 0 },
  },
  {
    name: 'Pling',
    group: 'Notes',
    vanilla: { event: 'block.note_block.pling', pitch: 1, like: 'An electric piano at F#4: a soft round note with a bell-like tine on top.' },
    layers: [
      { name: 'Tone', wave: 'sine', pitch: 370, pitchEnd: 370, length: 2, decay: 1.5, tremoloRate: 5, tremoloDepth: 0.12, ...hit },
      { name: 'Bark', wave: 'sine', pitch: 370, pitchEnd: 370, fmRatio: 1, fmIndex: 1.4, length: 0.9, decay: 0.6, gain: 0.55, ...hit },
      { name: 'Tine', wave: 'sine', pitch: 5180, pitchEnd: 5180, length: 0.12, decay: 0.07, gain: 0.15, ...hit },
    ],
    master: { reverbMix: 0.1, reverbSize: 0.3, variation: 0 },
  },

  /* ---------------- world ---------------- */
  {
    name: 'Explosion',
    group: 'World',
    vanilla: { event: 'entity.generic.explode', pitch: 0.7, like: 'A loud crunchy blast that breaks into rumbling, crackling debris over a few seconds.' },
    layers: [
      { name: 'Blast', wave: 'hiss', filter: 'lowpass', cutoff: 6000, cutoffEnd: 500, length: 0.5, attack: 0.002, decay: 0.35, sustain: 0, release: 0.05, drive: 0.6 },
      { name: 'Body', wave: 'noise', pitch: 90, pitchEnd: 55, filter: 'lowpass', cutoff: 2200, cutoffEnd: 350, length: 2.6, attack: 0.003, decay: 1.8, sustain: 0, release: 0.3, drive: 0.5 },
      { name: 'Debris', wave: 'crackle', pitch: 600, pitchEnd: 40, filter: 'bandpass', cutoff: 1200, cutoffEnd: 900, resonance: 0.7, length: 2.5, attack: 0.01, decay: 1.6, sustain: 0, release: 0.3, gain: 0.7 },
      { name: 'Rumble', wave: 'rumble', filter: 'lowpass', cutoff: 300, cutoffEnd: 120, length: 3, attack: 0.01, decay: 2.2, sustain: 0, release: 0.4, gain: 0.8 },
    ],
    master: { reverbMix: 0.3, reverbSize: 0.6, variation: 2 },
  },
  {
    name: 'TNT fuse',
    group: 'World',
    vanilla: { event: 'entity.tnt.primed', pitch: 1, like: 'A lit fuse: a bright fizzing hiss that sputters for a second and a half.' },
    layers: [
      { name: 'Fizz', wave: 'hiss', filter: 'bandpass', cutoff: 5000, cutoffEnd: 5500, resonance: 0.5, length: 1.7, attack: 0.05, ...held, release: 0.2 },
      { name: 'Sputter', wave: 'crackle', pitch: 160, pitchEnd: 190, filter: 'highpass', cutoff: 2500, cutoffEnd: 2500, length: 1.7, attack: 0.05, ...held, release: 0.2, gain: 0.8 },
      { name: 'Burn', wave: 'hiss', filter: 'bandpass', cutoff: 1500, cutoffEnd: 1500, resonance: 0.8, length: 1.7, attack: 0.1, ...held, release: 0.2, tremoloRate: 7, tremoloDepth: 0.3, gain: 0.3 },
    ],
    master: { variation: 1 },
  },
  {
    name: 'Splash',
    group: 'World',
    vanilla: { event: 'entity.player.splash', pitch: 1, like: 'A slap of water, a washing spray and bubbles, under a second.' },
    layers: [
      { name: 'Slap', wave: 'hiss', filter: 'lowpass', cutoff: 9000, cutoffEnd: 2500, length: 0.12, decay: 0.08, ...hit },
      { name: 'Wash', wave: 'hiss', filter: 'lowpass', cutoff: 4000, cutoffEnd: 700, length: 0.8, attack: 0.01, decay: 0.6, sustain: 0, release: 0.1, gain: 0.7 },
      { name: 'Bubbles', wave: 'sine', pitch: 500, pitchEnd: 1300, glide: 0.7, at: 0.05, length: 0.04, decay: 0.03, repeats: 12, gap: 0.045, jitter: 7, repeatDecay: 0.85, gain: 0.35, ...hit },
      { name: 'Plunge', wave: 'sine', pitch: 180, pitchEnd: 90, glide: 0.4, length: 0.15, decay: 0.1, gain: 0.5, ...hit },
    ],
    master: { reverbMix: 0.12, reverbSize: 0.3, variation: 2 },
  },
  {
    name: 'Lava pop',
    group: 'World',
    vanilla: { event: 'block.lava.pop', pitch: 1, like: 'A thick, low “blup” of a bubble bursting in lava.' },
    layers: [
      { name: 'Bubble', wave: 'sine', pitch: 160, pitchEnd: 420, glide: 0.7, length: 0.1, decay: 0.07, drive: 0.4, ...hit },
      { name: 'Glop', wave: 'noise', pitch: 120, pitchEnd: 100, filter: 'lowpass', cutoff: 900, cutoffEnd: 600, length: 0.08, decay: 0.05, gain: 0.5, ...hit },
      { name: 'Spit', wave: 'crackle', pitch: 300, pitchEnd: 300, filter: 'highpass', cutoff: 3000, cutoffEnd: 3000, at: 0.03, length: 0.08, decay: 0.05, gain: 0.3, ...hit },
    ],
    master: { variation: 3 },
  },
  {
    name: 'Fire',
    group: 'World',
    vanilla: { event: 'block.fire.ambient', pitch: 0.65, like: 'A soft, breathy roar with crackles and pops; the game plays it low.' },
    layers: [
      { name: 'Roar', wave: 'hiss', filter: 'lowpass', cutoff: 700, cutoffEnd: 650, length: 2.5, attack: 0.3, ...held, release: 0.5, tremoloRate: 3.3, tremoloDepth: 0.35, gain: 0.7 },
      { name: 'Breath', wave: 'hiss', filter: 'bandpass', cutoff: 1600, cutoffEnd: 1500, resonance: 1, length: 2.5, attack: 0.3, ...held, release: 0.5, tremoloRate: 5.7, tremoloDepth: 0.5, gain: 0.25 },
      { name: 'Crackle', wave: 'crackle', pitch: 22, pitchEnd: 22, filter: 'bandpass', cutoff: 2500, cutoffEnd: 2500, resonance: 0.7, length: 2.5, attack: 0.05, ...held, release: 0.3 },
      { name: 'Pops', wave: 'crackle', pitch: 6, pitchEnd: 6, filter: 'lowpass', cutoff: 900, cutoffEnd: 900, length: 2.5, attack: 0.05, ...held, release: 0.3, gain: 0.8 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Thunder',
    group: 'World',
    vanilla: { event: 'entity.lightning_bolt.thunder', pitch: 0.9, like: 'A ripping crack, then rumbles that roll on for five seconds or more.' },
    layers: [
      { name: 'Crack', wave: 'hiss', filter: 'lowpass', cutoff: 8000, cutoffEnd: 1500, length: 0.4, decay: 0.3, drive: 0.5, ...hit },
      { name: 'Roll', wave: 'noise', pitch: 60, pitchEnd: 30, filter: 'lowpass', cutoff: 1500, cutoffEnd: 150, length: 4.5, attack: 0.02, decay: 3.2, sustain: 0, release: 0.5, drive: 0.5 },
      { name: 'Rumbles', wave: 'rumble', filter: 'lowpass', cutoff: 400, cutoffEnd: 300, at: 0.3, length: 1.2, attack: 0.15, decay: 0.9, sustain: 0, release: 0.2, repeats: 3, gap: 1.1, repeatDecay: 0.7, gain: 0.9 },
      { name: 'Crackle', wave: 'crackle', pitch: 200, pitchEnd: 10, filter: 'lowpass', cutoff: 2500, cutoffEnd: 1200, length: 3, decay: 1.5, sustain: 0, release: 0.3, gain: 0.5, attack: 0.005 },
    ],
    master: { reverbMix: 0.5, reverbSize: 0.9, variation: 2 },
  },
  {
    name: 'Portal',
    group: 'World',
    vanilla: { event: 'block.portal.ambient', pitch: 1, like: 'An airy, swirling “wub” that throbs and sweeps for a few seconds.' },
    layers: [
      { name: 'Swirl', wave: 'hiss', filter: 'bandpass', cutoff: 500, cutoffEnd: 1400, resonance: 4, length: 3.5, attack: 0.5, ...held, release: 0.8, tremoloRate: 2.2, tremoloDepth: 0.55 },
      { name: 'Counter', wave: 'hiss', filter: 'bandpass', cutoff: 1400, cutoffEnd: 600, resonance: 6, length: 3.5, attack: 0.5, ...held, release: 0.8, tremoloRate: 3.1, tremoloDepth: 0.6, gain: 0.7 },
      { name: 'Low', wave: 'noise', pitch: 80, pitchEnd: 80, filter: 'lowpass', cutoff: 500, cutoffEnd: 500, length: 3.5, attack: 0.6, ...held, release: 0.8, vibratoRate: 0.7, vibratoDepth: 2, gain: 0.4 },
    ],
    master: { reverbMix: 0.3, reverbSize: 0.5, variation: 2 },
  },
  {
    name: 'Teleport',
    group: 'World',
    vanilla: { event: 'entity.enderman.teleport', pitch: 1, like: 'A “vwoomp”: a swept, phasing whoosh that drops away.' },
    layers: [
      { name: 'Sweep', wave: 'noise', pitch: 1200, pitchEnd: 250, glide: 0.4, filter: 'bandpass', cutoff: 2500, cutoffEnd: 500, resonance: 3, length: 0.7, attack: 0.01, decay: 0.55, sustain: 0.2, release: 0.1 },
      { name: 'Phase', wave: 'noise', pitch: 1250, pitchEnd: 262, glide: 0.4, filter: 'bandpass', cutoff: 2500, cutoffEnd: 500, resonance: 3, length: 0.7, attack: 0.01, decay: 0.55, sustain: 0.2, release: 0.1, gain: 0.7 },
      { name: 'Tail', wave: 'hiss', filter: 'bandpass', cutoff: 900, cutoffEnd: 900, resonance: 5, at: 0.1, length: 0.8, attack: 0.1, decay: 0.6, sustain: 0, release: 0.1, gain: 0.4 },
    ],
    master: { reverbMix: 0.3, reverbSize: 0.45, echoMix: 0.12, echoTime: 0.09, echoFeedback: 0.3, variation: 2 },
  },
  {
    name: 'Cave',
    group: 'World',
    vanilla: { event: 'ambient.cave', pitch: 1, like: 'Something far off in the dark: a low uneasy drone and a distant scrape, in a big echo.' },
    layers: [
      { name: 'Drone', wave: 'sine', pitch: 98, pitchEnd: 96, fmRatio: 1.5, fmIndex: 0.4, length: 5, attack: 1.5, ...held, release: 2, vibratoRate: 0.15, vibratoDepth: 0.3, gain: 0.5 },
      { name: 'Unease', wave: 'triangle', pitch: 104, pitchEnd: 103, at: 1, length: 4, attack: 1.5, ...held, release: 1.5, gain: 0.25 },
      { name: 'Scrape', wave: 'noise', pitch: 300, pitchEnd: 220, filter: 'bandpass', cutoff: 700, cutoffEnd: 400, resonance: 4, at: 2, length: 1.5, attack: 0.4, decay: 1, sustain: 0, release: 0.3, gain: 0.35 },
    ],
    master: { reverbMix: 0.65, reverbSize: 1, echoMix: 0.25, echoTime: 0.5, echoFeedback: 0.5, variation: 1 },
  },

  /* ---------------- mobs ---------------- */
  {
    name: 'Zombie',
    group: 'Mobs',
    vanilla: { event: 'entity.zombie.ambient', pitch: 1, like: 'A low, rough “uuurgh” from the throat that sinks as it goes.' },
    layers: [
      { name: 'Voice', wave: 'saw', pitch: 105, pitchEnd: 78, glide: -0.2, length: 1.3, attack: 0.08, decay: 0.5, sustain: 0.7, release: 0.3, vibratoRate: 6, vibratoDepth: 0.5, tremoloRate: 14, tremoloDepth: 0.3, filter: 'vowel', vowel: 2.5, vowelEnd: 3.8, throat: 0.9, resonance: 3, drive: 0.5 },
      { name: 'Fry', wave: 'saw', pitch: 52, pitchEnd: 39, glide: -0.2, length: 1.3, attack: 0.08, decay: 0.5, sustain: 0.7, release: 0.3, filter: 'vowel', vowel: 2.5, vowelEnd: 3.8, throat: 0.9, resonance: 3, drive: 0.4, gain: 0.5 },
      { name: 'Breath', wave: 'hiss', length: 1.3, attack: 0.1, decay: 0.5, sustain: 0.5, release: 0.3, filter: 'vowel', vowel: 3, vowelEnd: 3.8, throat: 0.9, resonance: 2, gain: 0.2 },
    ],
    master: { variation: 2 },
  },
  {
    name: 'Creeper hiss',
    group: 'Mobs',
    vanilla: { event: 'entity.creeper.primed', pitch: 0.5, like: 'The TNT fuse at half speed: a lower, longer fizz before it blows.' },
    layers: [
      { name: 'Fizz', wave: 'hiss', filter: 'bandpass', cutoff: 2500, cutoffEnd: 2750, resonance: 0.5, length: 3.2, attack: 0.1, ...held, release: 0.3 },
      { name: 'Sputter', wave: 'crackle', pitch: 80, pitchEnd: 95, filter: 'highpass', cutoff: 1250, cutoffEnd: 1250, length: 3.2, attack: 0.1, ...held, release: 0.3, gain: 0.8 },
      { name: 'Burn', wave: 'hiss', filter: 'bandpass', cutoff: 750, cutoffEnd: 750, resonance: 0.8, length: 3.2, attack: 0.2, ...held, release: 0.3, tremoloRate: 3.5, tremoloDepth: 0.3, gain: 0.3 },
    ],
    master: { variation: 0.5 },
  },
  {
    name: 'Skeleton',
    group: 'Mobs',
    vanilla: { event: 'entity.skeleton.ambient', pitch: 1, like: 'A dry rattle of hollow bones clacking together.' },
    layers: [
      { name: 'Clack', wave: 'pluck', pitch: 900, pitchEnd: 880, bright: 0.3, length: 0.04, decay: 0.03, repeats: 12, gap: 0.045, jitter: 5, repeatDecay: 0.93, ...hit },
      { name: 'Clatter', wave: 'pluck', pitch: 1400, pitchEnd: 1380, bright: 0.3, at: 0.02, length: 0.03, decay: 0.02, repeats: 10, gap: 0.05, jitter: 6, repeatDecay: 0.9, gain: 0.6, ...hit },
      { name: 'Hollow', wave: 'hiss', filter: 'bandpass', cutoff: 620, cutoffEnd: 620, resonance: 5, length: 0.03, decay: 0.02, repeats: 8, gap: 0.07, repeatDecay: 0.9, gain: 0.4, ...hit },
    ],
    master: { reverbMix: 0.08, reverbSize: 0.2, variation: 2 },
  },
  {
    name: 'Slime',
    group: 'Mobs',
    vanilla: { event: 'entity.slime.squish', pitch: 1, like: 'A wet, gloopy squelch as it lands.' },
    layers: [
      { name: 'Squelch', wave: 'noise', pitch: 200, pitchEnd: 160, filter: 'vowel', vowel: 4, vowelEnd: 2, throat: 0.8, resonance: 2.5, gain: 1.4, length: 0.3, attack: 0.01, decay: 0.22, sustain: 0, release: 0.04 },
      { name: 'Body', wave: 'sine', pitch: 150, pitchEnd: 70, glide: 0.3, length: 0.2, decay: 0.15, gain: 0.35, ...hit },
      { name: 'Wet', wave: 'crackle', pitch: 900, pitchEnd: 400, filter: 'lowpass', cutoff: 1500, cutoffEnd: 1500, length: 0.2, decay: 0.15, gain: 0.4, ...hit },
    ],
    master: { variation: 3 },
  },
  {
    name: 'Ghast',
    group: 'Mobs',
    vanilla: { event: 'entity.ghast.ambient', pitch: 1, like: 'A high, eerie crying moan with a wobble, heard from far off.' },
    layers: [
      { name: 'Cry', wave: 'saw', pitch: 620, pitchEnd: 470, glide: -0.2, length: 2.4, attack: 0.25, decay: 1, sustain: 0.6, release: 0.6, vibratoRate: 5.5, vibratoDepth: 0.9, filter: 'vowel', vowel: 4, vowelEnd: 2, throat: 1.6, resonance: 3 },
      { name: 'Breath', wave: 'hiss', length: 2.4, attack: 0.25, decay: 1, sustain: 0.6, release: 0.6, filter: 'vowel', vowel: 4, vowelEnd: 2, throat: 1.6, resonance: 2, gain: 0.25 },
      { name: 'Edge', wave: 'sine', pitch: 1240, pitchEnd: 940, glide: -0.2, length: 2.4, attack: 0.25, decay: 1, sustain: 0.6, release: 0.6, vibratoRate: 5.5, vibratoDepth: 0.9, gain: 0.15 },
    ],
    master: { reverbMix: 0.5, reverbSize: 0.8, variation: 2 },
  },
  {
    name: 'Ender dragon',
    group: 'Mobs',
    vanilla: { event: 'entity.ender_dragon.growl', pitch: 1, like: 'A huge, deep, distorted roar that rolls through the End.' },
    layers: [
      { name: 'Roar', wave: 'saw', pitch: 62, pitchEnd: 48, length: 2.6, attack: 0.15, decay: 1, sustain: 0.7, release: 0.6, vibratoRate: 9, vibratoDepth: 1.5, filter: 'vowel', vowel: 2, vowelEnd: 3.5, throat: 0.6, resonance: 2, drive: 0.8 },
      { name: 'Sub', wave: 'saw', pitch: 31, pitchEnd: 24, length: 2.6, attack: 0.15, decay: 1, sustain: 0.7, release: 0.6, filter: 'vowel', vowel: 2, vowelEnd: 3.5, throat: 0.6, resonance: 2, drive: 0.6, gain: 0.5 },
      { name: 'Rasp', wave: 'noise', pitch: 70, pitchEnd: 55, filter: 'lowpass', cutoff: 1500, cutoffEnd: 1000, length: 2.6, attack: 0.15, decay: 1, sustain: 0.7, release: 0.6, tremoloRate: 22, tremoloDepth: 0.5, gain: 0.6 },
    ],
    master: { reverbMix: 0.45, reverbSize: 0.9, variation: 2 },
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
