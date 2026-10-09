/* Whether a texture has pixels that are partly see-through. A face drawn
   as triangles overlaps them by half a pixel to hide the seam, and only a
   partly see-through pixel shows where it is drawn twice; a clear one stays
   clear and a solid one stays solid. Each image is read once, in the
   background, and whoever asked is told when the answer is in. */

import { useSyncExternalStore } from 'react'

const known = new Map<string, boolean>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function read(source: string) {
  if (pending.has(source) || typeof Image === 'undefined') return
  pending.add(source)
  const img = new Image()
  img.onload = () => {
    let partial = false
    try {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const x = c.getContext('2d')
      if (x && c.width && c.height) {
        x.drawImage(img, 0, 0)
        const data = x.getImageData(0, 0, c.width, c.height).data
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0 && data[i] !== 255) {
            partial = true
            break
          }
        }
      }
    } catch {
      // an image the page may not read counts as partly see-through, the careful answer
      partial = true
    }
    known.set(source, partial)
    pending.delete(source)
    version++
    listeners.forEach((f) => f())
  }
  img.onerror = () => pending.delete(source)
  img.src = source
}

/** True or false once the image has been read; undefined until then (and it starts reading). */
export function partlyClear(source: string | undefined): boolean | undefined {
  if (!source) return false
  const got = known.get(source)
  if (got === undefined) read(source)
  return got
}

/** Re-renders the caller when any answer comes in. */
export function useAlphaAnswers(): number {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => version,
    () => version,
  )
}
