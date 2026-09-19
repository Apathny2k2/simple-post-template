/* ---------------------------------------------------------------
   Texture pixels.

   Painting touches the texture and nothing else: the geometry is
   byte-identical before and after a painting session. What every tool
   ultimately needs is a texel coordinate, and there are two ways to get
   one - straight off the 2D texture panel, or by back-projecting a
   click on the 3D model through that face's UV rectangle. The second is
   what makes per-face UV bearable: you click the creature's arm, not a
   rectangle in an atlas.
   --------------------------------------------------------------- */

import type { Texture, UVRect } from './model'

export type PixelSurface = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}

export type RGBA = [number, number, number, number]

/** Decode a texture's data URI into a canvas we can read and write pixels on. */
export function loadSurface(tex: Texture): Promise<PixelSurface> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, tex.width)
    canvas.height = Math.max(1, tex.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      reject(new Error('This browser gave us no 2D context, so painting is unavailable.'))
      return
    }
    ctx.imageSmoothingEnabled = false

    if (!tex.source) {
      resolve({ canvas, ctx, width: canvas.width, height: canvas.height })
      return
    }
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      resolve({ canvas, ctx, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => reject(new Error(`Could not decode ${tex.name}.`))
    img.src = tex.source
  })
}

export const toDataUrl = (s: PixelSurface) => s.canvas.toDataURL('image/png')

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
    alpha,
  ]
}

export function rgbaToHex([r, g, b]: RGBA) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/* ---------------- texel maths ---------------- */

/**
 * Back-project a point on a face into a texel.
 *
 * `u`/`v` are the hit position within the face, 0..1 from its top-left.
 * A face whose UV rectangle has zero area cannot be painted, which is
 * the same rule Blockbench applies - there is no texel under the click.
 */
export function texelOfFace(uv: UVRect, u: number, v: number): [number, number] | null {
  const [x1, y1, x2, y2] = uv
  if (x1 === x2 || y1 === y2) return null
  /* The rectangle is normalised here even though a reversed one mirrors
     the face, because the mirror has already been applied: the renderer
     re-adds the flip as a CSS scale() on the plane, and `offsetX` is
     reported in the element's own post-transform space. Following the
     signed width as well flipped it twice, so clicking a pixel changed
     the one opposite it. */
  const [ax, ay, bx, by] = faceBounds(uv)
  return [Math.floor(ax + u * (bx - ax)), Math.floor(ay + v * (by - ay))]
}

/** The texel rectangle a face occupies, normalised so min < max. */
export function faceBounds(uv: UVRect): UVRect {
  const [x1, y1, x2, y2] = uv
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]
}

/* ---------------- tools ---------------- */

const inBounds = (x: number, y: number, s: PixelSurface) =>
  x >= 0 && y >= 0 && x < s.width && y < s.height

/**
 * Brush and eraser are the same operation; the eraser just writes alpha 0.
 *
 * `bounds` clips the stamp to one UV island. Without it a size-8 brush
 * on a packed sheet wrote most of its 64 texels into other faces - a
 * single click repainting three unrelated cubes - which is the same
 * reason the bucket has always been bounded.
 */
export function paint(
  s: PixelSurface,
  x: number,
  y: number,
  colour: RGBA,
  size: number,
  bounds?: UVRect | null,
) {
  const half = Math.floor((size - 1) / 2)
  const image = s.ctx.createImageData(1, 1)
  const clip = bounds ? faceBounds(bounds) : null
  for (let dy = -half; dy <= size - 1 - half; dy++) {
    for (let dx = -half; dx <= size - 1 - half; dx++) {
      const px = x + dx
      const py = y + dy
      if (!inBounds(px, py, s)) continue
      if (clip && (px < clip[0] || py < clip[1] || px >= clip[2] || py >= clip[3])) continue
      image.data[0] = colour[0]
      image.data[1] = colour[1]
      image.data[2] = colour[2]
      image.data[3] = colour[3]
      s.ctx.putImageData(image, px, py)
    }
  }
}

export function pick(s: PixelSurface, x: number, y: number): RGBA | null {
  if (!inBounds(x, y, s)) return null
  const d = s.ctx.getImageData(x, y, 1, 1).data
  return [d[0], d[1], d[2], d[3]]
}

/**
 * Flood fill from a texel, bounded by the face's own UV rectangle so a
 * fill cannot bleed across the whole atlas. This is the practical reason
 * non-overlapping UV islands matter.
 */
export function bucket(
  s: PixelSurface,
  x: number,
  y: number,
  colour: RGBA,
  bounds: UVRect,
  tolerance = 8,
) {
  const [bx1, by1, bx2, by2] = bounds.map((v) => Math.round(v)) as UVRect
  const x1 = Math.max(0, bx1)
  const y1 = Math.max(0, by1)
  const x2 = Math.min(s.width, bx2)
  const y2 = Math.min(s.height, by2)
  if (x < x1 || y < y1 || x >= x2 || y >= y2) return

  const w = x2 - x1
  const h = y2 - y1
  const image = s.ctx.getImageData(x1, y1, w, h)
  const data = image.data
  const at = (px: number, py: number) => ((py - y1) * w + (px - x1)) * 4

  const start = at(x, y)
  const target: RGBA = [data[start], data[start + 1], data[start + 2], data[start + 3]]
  const same = (i: number) =>
    Math.abs(data[i] - target[0]) <= tolerance &&
    Math.abs(data[i + 1] - target[1]) <= tolerance &&
    Math.abs(data[i + 2] - target[2]) <= tolerance &&
    Math.abs(data[i + 3] - target[3]) <= tolerance

  // already this colour: filling would loop forever for no visible change
  if (
    target[0] === colour[0] &&
    target[1] === colour[1] &&
    target[2] === colour[2] &&
    target[3] === colour[3]
  ) {
    return
  }

  const stack: Array<[number, number]> = [[x, y]]
  while (stack.length) {
    const [px, py] = stack.pop()!
    if (px < x1 || py < y1 || px >= x2 || py >= y2) continue
    const i = at(px, py)
    if (!same(i)) continue
    data[i] = colour[0]
    data[i + 1] = colour[1]
    data[i + 2] = colour[2]
    data[i + 3] = colour[3]
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }

  s.ctx.putImageData(image, x1, y1)
}

/* ---------------- shapes ----------------
   A rectangle or an ellipse between two texels, outlined or filled.
   The tool used to be the brush wearing a different icon. */

export type ShapeKind = 'rect' | 'ellipse'

export function drawShape(
  s: PixelSurface,
  from: [number, number],
  to: [number, number],
  colour: RGBA,
  kind: ShapeKind,
  filled: boolean,
  size = 1,
  bounds?: UVRect | null,
) {
  const x1 = Math.min(from[0], to[0])
  const y1 = Math.min(from[1], to[1])
  const x2 = Math.max(from[0], to[0])
  const y2 = Math.max(from[1], to[1])
  const stamp = (x: number, y: number) => paint(s, x, y, colour, size, bounds)

  if (kind === 'rect') {
    if (filled) {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) stamp(x, y)
      return
    }
    for (let x = x1; x <= x2; x++) {
      stamp(x, y1)
      stamp(x, y2)
    }
    for (let y = y1; y <= y2; y++) {
      stamp(x1, y)
      stamp(x2, y)
    }
    return
  }

  /* Midpoint ellipse by inclusion test rather than by the incremental
     algorithm: at texture resolutions the cost is nothing and it keeps
     the filled and outlined cases in one place. */
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const rx = Math.max(0.5, (x2 - x1) / 2)
  const ry = Math.max(0.5, (y2 - y1) / 2)
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (!inside(x, y)) continue
      // an outline is a texel that is in the ellipse with a neighbour that is not
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) {
        stamp(x, y)
      }
    }
  }
}

/** Bresenham, so a fast drag paints a line rather than dotting. */
export function strokeBetween(
  from: [number, number],
  to: [number, number],
  apply: (x: number, y: number) => void,
) {
  let [x0, y0] = from
  const [x1, y1] = to
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  // guards a pathological drag from spinning
  for (let guard = 0; guard < 4096; guard++) {
    apply(x0, y0)
    if (x0 === x1 && y0 === y1) return
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }
}
