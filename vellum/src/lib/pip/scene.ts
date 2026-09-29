/* What Pip's scenes share: the frame, the moods a scene plays out, and
   the sky and ground they are drawn against. A scene draws into its own
   pixel buffer one frame at a time; components/Pip.tsx puts that on a
   canvas. */

import { hash2, stamp } from './pixels'
import type { Pixels } from './pixels'
import { CLOUD } from './art'

export const HEIGHT = 40
export const GROUND = 31

export type Mood = 'idle' | 'working' | 'done' | 'failed'
export type Failure = 'lava' | 'wall'

export interface PipScene {
  readonly w: number
  readonly px: Pixels
  /** true once an outcome has played through */
  readonly finished: boolean
  resize(width: number): void
  setMood(mood: Mood, failure?: Failure): void
  /** skips to a frame that sums the mood up, for a still picture */
  settle(): void
  /** the colour everything is drawn in */
  setInk(c: number): void
  step(dt: number): void
  render(): void
}

/** Two faint clouds drifting left. */
export function drawClouds(p: Pixels, time: number) {
  const span = p.w + 40
  for (const [x0, y, speed] of [
    [p.w * 0.2, 1, 2.2],
    [p.w * 0.62, 4, 1.4],
  ]) {
    const x = ((((x0 - time * speed) % span) + span) % span) - 20
    stamp(p, CLOUD, Math.round(x), y, { a: 0.28 })
  }
}

/** One column of ground at screen x: the line, the odd pebble on it and
    specks under it. `wx` is the world x, so the specks move with it. */
export function drawGroundColumn(p: Pixels, x: number, wx: number) {
  p.dot(x, GROUND)
  if (hash2(wx, 5) < 0.035) p.dot(x, GROUND - 1)
  const h = hash2(wx, 9)
  if (h < 0.1) p.dot(x, GROUND + 2 + Math.floor(hash2(wx, 10) * 7), 0.8)
  if (h > 0.97) p.rect(x, GROUND + 3 + Math.floor(hash2(wx, 11) * 4), 2, 1, 0.8)
}
