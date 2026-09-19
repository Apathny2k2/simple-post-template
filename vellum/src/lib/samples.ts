/* The models the editor opens with.

   These ship as `.vellum`, the native format, and are parsed by the same
   reader an opened file goes through - there is no second path into the
   editor. */

import { readVellum } from './vellum'
import type { Model, ProjectKind } from './model'
import alienSword from '../models/alien_sword.vellum?raw'
import voidling from '../models/voidling.vellum?raw'
import resonatorBlock from '../models/resonator_block.vellum?raw'
import runicBlade from '../models/runic_blade.vellum?raw'
import emberfang from '../models/emberfang.vellum?raw'
import tideFlask from '../models/tide_flask.vellum?raw'
import honeyedLoaf from '../models/honeyed_loaf.vellum?raw'

export type Sample = {
  id: string
  file: string
  label: string
  kind: ProjectKind
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
    'Swept chitin prongs around a crystal blade. Four bones, and a core that pulses on the idle.',
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
  of(
    'runic_blade',
    'Runic Blade',
    'items',
    'Four bones and two clips: it breathes on the shelf and swings when told to.',
    runicBlade,
  ),
  of(
    'emberfang',
    'Emberfang',
    'items',
    'A serrated blade whose teeth pulse on the idle and bite on the swing.',
    emberfang,
  ),
  of(
    'tide_flask',
    'Tide Flask',
    'consumables',
    'Tips back, the stopper comes away, the level drops. Two clips: idle and drink.',
    tideFlask,
  ),
  of(
    'honeyed_loaf',
    'Honeyed Loaf',
    'consumables',
    'Eaten in three stepped bites, with the glaze going first.',
    honeyedLoaf,
  ),
]

export const sampleById = (id: string) => samples.find((s) => s.id === id) ?? samples[0]
