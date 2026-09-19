/* The models the editor opens with.

   These ship as `.vellum` - the native format. Their `.bbmodel` sources
   live under docs/blockbench/source and are kept only as the import
   record: opening a .bbmodel and saving is the migration, and once
   migrated a model is a .vellum forever. */

import { readVellum } from './vellum'
import type { Model } from './bbmodel'
import alienSword from '../models/alien_sword.vellum.json'
import voidling from '../models/voidling.vellum.json'
import resonatorBlock from '../models/resonator_block.vellum.json'

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
  raw: unknown,
): Sample => ({ id, file: `${id}.vellum`, label, kind, blurb, model: readVellum(raw as object) })

export const samples: Sample[] = [
  of(
    'alien_sword',
    'Alien Sword',
    'items',
    'A swept blade built from stacked per-element rotations. 22 cubes, no rig.',
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
    'Imported from the Java block format: inside the 16-unit volume, one rotated axis.',
    resonatorBlock,
  ),
]

export const sampleById = (id: string) => samples.find((s) => s.id === id) ?? samples[0]
