/* Colours for the console: a layer takes its source's, a pad its group's. */

import type { Layer, Wave } from '../../lib/audio/synth'

const WAVE: Record<Wave, string> = {
  sine: 'var(--blue-bright)',
  triangle: 'var(--teal)',
  square: 'var(--violet)',
  saw: 'var(--amber)',
  pluck: '#e7b56a',
  noise: 'var(--green)',
  hiss: '#c9d3e3',
  rumble: 'var(--red)',
  crackle: '#ff9f6b',
  bubbles: '#6ac3e7',
  sample: '#f08bd1',
}

export const layerColour = (l: Layer) => WAVE[l.wave]
export const waveColour = (w: Wave) => WAVE[w]

const GROUP: Record<string, string> = {
  Player: 'var(--blue-bright)',
  Blocks: 'var(--amber)',
  Notes: 'var(--violet)',
  World: 'var(--teal)',
  Mobs: 'var(--red)',
}

export const groupColour = (g: string) => GROUP[g] ?? 'var(--green)'
