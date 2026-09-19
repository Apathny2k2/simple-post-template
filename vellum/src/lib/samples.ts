/* The models the editor opens with. These are real .bbmodel files - the same
   bytes Blockbench would write, with their textures embedded as data URIs -
   imported as JSON and parsed at load. */

import { parseBBModel } from './bbmodel'
import type { Model } from './bbmodel'
import alienSword from '../models/alien_sword.bbmodel.json'
import voidling from '../models/voidling.bbmodel.json'
import resonatorBlock from '../models/resonator_block.bbmodel.json'

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
  file: string,
  label: string,
  kind: Sample['kind'],
  blurb: string,
  raw: unknown,
): Sample => ({ id, file, label, kind, blurb, model: parseBBModel(raw as object) })

export const samples: Sample[] = [
  of(
    'alien_sword',
    'alien_sword.bbmodel',
    'Alien Sword',
    'items',
    'Generic Model. Swept blade built from stacked per-element rotations.',
    alienSword,
  ),
  of(
    'voidling',
    'voidling.bbmodel',
    'Voidling',
    'mobs',
    'Generic Model, rigged to 16 bones and carrying three animations.',
    voidling,
  ),
  of(
    'resonator_block',
    'resonator_block.bbmodel',
    'Resonator Block',
    'blocks',
    'Java Block format: inside the 16-unit volume, single-axis rotation only.',
    resonatorBlock,
  ),
]

export const sampleById = (id: string) => samples.find((s) => s.id === id) ?? samples[0]
