/* Playing rendered sounds. One AudioContext for the page, made on the first
   play because browsers only start audio after a click or a key. Pads may
   overlap, like a real sound board; the console's own playback is one voice
   that a new play replaces. */

import { RATE } from './synth'

let ctx: AudioContext | null = null

function audio(): AudioContext {
  ctx ??= new AudioContext({ sampleRate: RATE })
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export type Voice = {
  /** seconds into the sound right now */
  position: () => number
  duration: number
  stop: () => void
  /** resolves when it ends or is stopped */
  ended: Promise<void>
}

export function play(data: Float32Array, { from = 0, loop = false } = {}): Voice {
  const c = audio()
  const buf = c.createBuffer(1, Math.max(1, data.length), RATE)
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0)
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = loop
  src.connect(c.destination)
  const start = c.currentTime
  const offset = Math.max(0, Math.min(from, buf.duration))
  src.start(start, offset)
  let done!: () => void
  const ended = new Promise<void>((r) => (done = r))
  src.onended = () => done()
  return {
    duration: buf.duration,
    position: () => {
      const t = c.currentTime - start + offset
      return loop ? t % buf.duration : Math.min(t, buf.duration)
    },
    stop: () => {
      try {
        src.stop()
      } catch {
        // already stopped
      }
      done()
    },
    ended,
  }
}
