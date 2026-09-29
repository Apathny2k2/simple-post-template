import { useEffect, useRef } from 'react'
import { hash2 } from '../lib/pip/pixels'

/**
 * A server's icon, until a server sends its own: an 8x8 block face in
 * the server's colour, drawn a texel at a time like the game's own
 * textures, with a lighter cap across the top. The id seeds the grain,
 * so a server keeps the same face everywhere it appears.
 */
export function ServerIcon({ id, hue, size = 48 }: { id: string; hue: number; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
    for (let x = 0; x < 8; x++) {
      // the cap hangs two or three texels down, unevenly
      const cap = 2 + (hash2(x + seed, 3) > 0.55 ? 1 : 0)
      for (let y = 0; y < 8; y++) {
        const n = hash2(x + seed, y * 13 + seed)
        const top = y < cap
        const light = top ? 58 + n * 14 : 30 + n * 16
        const sat = top ? 62 : 38 + n * 18
        ctx.fillStyle = `hsl(${top ? hue : hue + 18} ${sat}% ${light}%)`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [id, hue])

  return <canvas ref={canvas} className="srv-icon" width={8} height={8} style={{ width: size, height: size }} aria-hidden="true" />
}
