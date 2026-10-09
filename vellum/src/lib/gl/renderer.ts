/* The WebGL2 renderer. Every viewport in the app shares one context, on a
   canvas that is never shown: a view draws into it at its own size and
   copies the picture onto its own 2D canvas straight after. Browsers cap
   live WebGL contexts at around sixteen, and the Projects shelf alone can
   hold more previews than that.

   Faces draw in two passes: opaque texels first, writing depth, then the
   partly clear ones over them without writing depth, so a translucent
   texel never hides what is behind it. Texels that are fully clear draw
   nothing, as in the game. Edges draw after the opaque pass, with the
   faces pushed back a little so an edge on a face isn't lost in it. */

import type { Texture } from '../model'
import type { Camera } from './camera'
import type { BuiltScene, TriBatch } from './scene'

export type Rgba = [number, number, number, number]
/** v scale, the frame's v offset, the next frame's, and the mix toward it */
export type Frame = [number, number, number, number]

const TRI_VS = `#version 300 es
uniform mat4 u_clip;
in vec3 a_pos;
in vec2 a_uv;
in vec4 a_col;
out vec2 v_uv;
out vec4 v_col;
void main() {
  v_uv = a_uv;
  v_col = a_col;
  gl_Position = u_clip * vec4(a_pos, 1.0);
}`

const TRI_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform bool u_useTex;
// 0: opaque texels only; 1: partly clear texels only; 2: everything
uniform int u_pass;
// an animated texture shows one frame of its strip: v scale, the frame's v offset,
// the next frame's, and how far to mix toward it
uniform vec4 u_frame;
in vec2 v_uv;
in vec4 v_col;
out vec4 outColor;
void main() {
  vec4 c = v_col;
  if (u_useTex) {
    vec2 a = vec2(v_uv.x, v_uv.y * u_frame.x + u_frame.y);
    vec4 t = texture(u_tex, a);
    if (u_frame.w > 0.0) t = mix(t, texture(u_tex, vec2(v_uv.x, v_uv.y * u_frame.x + u_frame.z)), u_frame.w);
    c *= t;
  }
  if (c.a < 0.004) discard;
  if (u_pass == 0 && c.a < 0.999) discard;
  if (u_pass == 1 && c.a >= 0.999) discard;
  outColor = vec4(min(c.rgb, 1.0) * c.a, c.a);
}`

const LINE_VS = `#version 300 es
uniform mat4 u_clip;
in vec3 a_pos;
in vec4 a_col;
out vec4 v_col;
void main() {
  v_col = a_col;
  gl_Position = u_clip * vec4(a_pos, 1.0);
}`

const LINE_FS = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 outColor;
void main() {
  outColor = vec4(v_col.rgb * v_col.a, v_col.a);
}`

type Program = { prog: WebGLProgram; loc: Record<string, WebGLUniformLocation | null>; attr: Record<string, number> }
type Gl = {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  tri: Program
  line: Program
  buffer: WebGLBuffer
  vao: { tri: WebGLVertexArrayObject; line: WebGLVertexArrayObject }
}

let shared: Gl | null | undefined
/** Textures by image source; a texture being repainted keeps showing its last image until the new one is decoded. */
const bySource = new Map<string, { tex: WebGLTexture | null; image: HTMLImageElement; ready: boolean; used: number }>()
const lastReady = new Map<string, string>()
const listeners = new Set<() => void>()
let clock = 0

function compile(gl: WebGL2RenderingContext, vs: string, fs: string, uniforms: string[], attrs: string[]): Program {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, make(gl.VERTEX_SHADER, vs))
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'program')
  return {
    prog,
    loc: Object.fromEntries(uniforms.map((u) => [u, gl.getUniformLocation(prog, u)])),
    attr: Object.fromEntries(attrs.map((a) => [a, gl.getAttribLocation(prog, a)])),
  }
}

function init(): Gl | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true, depth: true })
  if (!gl) return null
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    shared = undefined
    bySource.clear()
    lastReady.clear()
  })
  const tri = compile(gl, TRI_VS, TRI_FS, ['u_clip', 'u_tex', 'u_useTex', 'u_pass', 'u_frame'], ['a_pos', 'a_uv', 'a_col'])
  const line = compile(gl, LINE_VS, LINE_FS, ['u_clip'], ['a_pos', 'a_col'])
  const buffer = gl.createBuffer()!
  const triVao = gl.createVertexArray()!
  gl.bindVertexArray(triVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  const stride = 9 * 4
  gl.enableVertexAttribArray(tri.attr.a_pos)
  gl.vertexAttribPointer(tri.attr.a_pos, 3, gl.FLOAT, false, stride, 0)
  gl.enableVertexAttribArray(tri.attr.a_uv)
  gl.vertexAttribPointer(tri.attr.a_uv, 2, gl.FLOAT, false, stride, 12)
  gl.enableVertexAttribArray(tri.attr.a_col)
  gl.vertexAttribPointer(tri.attr.a_col, 4, gl.FLOAT, false, stride, 20)
  const lineVao = gl.createVertexArray()!
  gl.bindVertexArray(lineVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(line.attr.a_pos)
  gl.vertexAttribPointer(line.attr.a_pos, 3, gl.FLOAT, false, 7 * 4, 0)
  gl.enableVertexAttribArray(line.attr.a_col)
  gl.vertexAttribPointer(line.attr.a_col, 4, gl.FLOAT, false, 7 * 4, 12)
  gl.bindVertexArray(null)
  return { gl, canvas, tri, line, buffer, vao: { tri: triVao, line: lineVao } }
}

function context(): Gl | null {
  if (shared === undefined) {
    try {
      shared = init()
    } catch {
      shared = null
    }
  }
  return shared
}

/** Whether this browser can draw the viewport. */
export function glAvailable(): boolean {
  return !!context()
}

/** Calls `fn` whenever a texture finishes decoding, so views showing it can draw again. */
export function onTextureReady(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** At most this many images are kept on the GPU; painting makes a new one per stroke. */
const KEEP = 48

function glTexture(g: Gl, t: Texture): WebGLTexture | null {
  const { gl } = g
  const src = t.source
  let entry = bySource.get(src)
  if (!entry) {
    const image = new Image()
    entry = { tex: null, image, ready: false, used: ++clock }
    const e = entry
    bySource.set(src, e)
    image.onload = () => {
      if (shared !== g) return
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      e.tex = tex
      e.ready = true
      lastReady.set(t.id, src)
      evict(g)
      listeners.forEach((fn) => fn())
    }
    image.src = src
  }
  entry.used = ++clock
  if (entry.ready) return entry.tex
  // still decoding: the image this texture showed last
  const last = lastReady.get(t.id)
  const old = last ? bySource.get(last) : undefined
  if (old?.ready) {
    old.used = clock
    return old.tex
  }
  return null
}

function evict(g: Gl) {
  if (bySource.size <= KEEP) return
  const live = new Set(lastReady.values())
  const order = [...bySource.entries()].filter(([src, e]) => e.ready && !live.has(src)).sort((a, b) => a[1].used - b[1].used)
  for (const [src, e] of order.slice(0, bySource.size - KEEP)) {
    g.gl.deleteTexture(e.tex)
    bySource.delete(src)
  }
}

export type Grid = { size: number; cell: number; at: [number, number, number]; line: Rgba; border: Rgba }

export type DrawInput = {
  camera: Camera
  scene: BuiltScene
  /** onion-skin poses, drawn faintly over the model */
  ghosts?: BuiltScene[]
  /** other models drawn with this one in world space, outside its placement (Display mode's player) */
  companions?: BuiltScene[]
  grid?: Grid | null
  /** which frame of each animated texture to show, by texture id (see `textureFrames`) */
  frames?: ReadonlyMap<string, Frame>
}

/**
 * Draws a scene and copies it onto `target`, whose backing size is the
 * view's size in device pixels. Returns false when there is no WebGL2.
 */
export function drawView(target: HTMLCanvasElement, input: DrawInput): boolean {
  const g = context()
  const out = target.getContext('2d')
  if (!g || !out) return false
  const { gl, canvas } = g
  const w = target.width
  const h = target.height
  if (w < 1 || h < 1) return true
  if (canvas.width < w || canvas.height < h) {
    canvas.width = Math.max(canvas.width, w)
    canvas.height = Math.max(canvas.height, h)
  }
  // drawn at the bottom left of the shared canvas, where WebGL's origin is
  gl.viewport(0, 0, w, h)
  gl.enable(gl.SCISSOR_TEST)
  gl.scissor(0, 0, w, h)
  gl.clearColor(0, 0, 0, 0)
  gl.clearDepth(1)
  gl.depthMask(true)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)

  const { camera, scene } = input
  if (input.grid) lines(g, gridLines(input.grid), camera.stageClip, false, true)

  // faces: opaque texels, then partly clear ones
  gl.enable(gl.POLYGON_OFFSET_FILL)
  gl.polygonOffset(1, 1)
  const plain = scene.batches.filter((b) => !b.overlay)
  const others = input.companions ?? []
  tris(g, plain, camera.clip, 0, true, input.frames)
  for (const c of others) tris(g, c.batches, camera.stageClip, 0, true)
  gl.disable(gl.POLYGON_OFFSET_FILL)
  lines(g, scene.lines, camera.clip, true, false)
  for (const c of others) lines(g, c.lines, camera.stageClip, true, false)
  tris(g, plain, camera.clip, 1, false, input.frames)
  for (const c of others) tris(g, c.batches, camera.stageClip, 1, false)
  // picked-face tints, then onion skins
  gl.enable(gl.POLYGON_OFFSET_FILL)
  gl.polygonOffset(-1, -1)
  tris(g, scene.batches.filter((b) => b.overlay), camera.clip, 2, false, input.frames)
  gl.disable(gl.POLYGON_OFFSET_FILL)
  for (const ghost of input.ghosts ?? []) tris(g, ghost.batches, camera.clip, 2, false, input.frames)
  if (scene.topLines.length) {
    gl.disable(gl.DEPTH_TEST)
    lines(g, scene.topLines, camera.clip, false, false)
    gl.enable(gl.DEPTH_TEST)
  }
  gl.disable(gl.SCISSOR_TEST)

  out.clearRect(0, 0, w, h)
  out.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h)
  return true
}

function tris(g: Gl, batches: TriBatch[], clip: Float32Array, pass: 0 | 1 | 2, writeDepth: boolean, frames?: ReadonlyMap<string, Frame>) {
  const { gl, tri } = g
  if (!batches.length) return
  gl.useProgram(tri.prog)
  gl.bindVertexArray(g.vao.tri)
  gl.uniformMatrix4fv(tri.loc.u_clip, false, clip)
  gl.uniform1i(tri.loc.u_pass, pass)
  gl.uniform1i(tri.loc.u_tex, 0)
  gl.activeTexture(gl.TEXTURE0)
  gl.depthMask(writeDepth)
  gl.bindBuffer(gl.ARRAY_BUFFER, g.buffer)
  for (const b of batches) {
    if (!b.data.length) continue
    const tex = b.texture ? glTexture(g, b.texture) : null
    // a textured batch whose image isn't decoded yet waits for it
    if (b.texture && !tex) continue
    gl.uniform1i(tri.loc.u_useTex, tex ? 1 : 0)
    const f = (b.texture && frames?.get(b.texture.id)) ?? [1, 0, 0, 0]
    gl.uniform4f(tri.loc.u_frame, f[0], f[1], f[2], f[3])
    if (tex) gl.bindTexture(gl.TEXTURE_2D, tex)
    if (b.doubleSided) gl.disable(gl.CULL_FACE)
    else {
      gl.enable(gl.CULL_FACE)
      gl.cullFace(gl.BACK)
      gl.frontFace(gl.CW)
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.data), gl.STREAM_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, b.data.length / 9)
  }
  gl.disable(gl.CULL_FACE)
  gl.depthMask(true)
}

function lines(g: Gl, data: number[], clip: Float32Array, depthTest: boolean, under: boolean) {
  const { gl, line } = g
  if (!data.length) return
  gl.useProgram(line.prog)
  gl.bindVertexArray(g.vao.line)
  gl.uniformMatrix4fv(line.loc.u_clip, false, clip)
  gl.depthMask(false)
  if (!depthTest && !under) gl.disable(gl.DEPTH_TEST)
  gl.bindBuffer(gl.ARRAY_BUFFER, g.buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STREAM_DRAW)
  gl.drawArrays(gl.LINES, 0, data.length / 7)
  gl.enable(gl.DEPTH_TEST)
  gl.depthMask(true)
}

/** A square grid on the floor plane, centred on `at`. */
function gridLines(grid: Grid): number[] {
  const out: number[] = []
  const half = grid.size / 2
  const [cx, y, cz] = grid.at
  const push = (a: [number, number, number], b: [number, number, number], c: Rgba) => out.push(...a, ...c, ...b, ...c)
  const n = Math.floor(half / grid.cell)
  for (let i = -n; i <= n; i++) {
    const d = i * grid.cell
    push([cx + d, y, cz - half], [cx + d, y, cz + half], grid.line)
    push([cx - half, y, cz + d], [cx + half, y, cz + d], grid.line)
  }
  const corners: Array<[number, number, number]> = [
    [cx - half, y, cz - half],
    [cx + half, y, cz - half],
    [cx + half, y, cz + half],
    [cx - half, y, cz + half],
  ]
  corners.forEach((p, i) => push(p, corners[(i + 1) % 4], grid.border))
  return out
}
