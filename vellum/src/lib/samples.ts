/* The models the editor opens with.

   These ship as `.vellum`, the native format, and are parsed by the same
   reader an opened file goes through - there is no second path into the
   editor. */

import { readVellum } from './vellum'
import type { Model } from './model'
import alienSword from '../models/alien_sword.vellum?raw'
import voidling from '../models/voidling.vellum?raw'
import resonatorBlock from '../models/resonator_block.vellum?raw'

export type Sample = {
  id: string
  file: string
  label: string
  kind: 'items' | 'mobs' | 'blocks'
  blurb: string
  model: Model
}

const of = (
  id: string,
  label: string,
  kind: Sample['kind'],
  blurb: string,
  raw: string,
): Sample => ({ id, file: `${id}.vellum`, label, kind, blurb, model: readVellum(raw) })

export const samples: Sample[] = [
  of(
    'alien_sword',
    'Alien Sword',
    'items',
    'A swept blade built from stacked per-cube rotations. 22 cubes, no rig.',
    alienSword,
  ),
  of(
    'voidling',
    'Voidling',
    'mobs',
    'Rigged to 16 bones and carrying three clips: idle, walk and strike.',
    voidling,
  ),
  of(
    'resonator_block',
    'Resonator Block',
    'blocks',
    'A block-format model: inside the 16-unit volume, one rotated axis.',
    resonatorBlock,
  ),
]

export const sampleById = (id: string) => samples.find((s) => s.id === id) ?? samples[0]
