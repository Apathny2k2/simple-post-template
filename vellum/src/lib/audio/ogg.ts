/* Ogg pages around a stream of packets (RFC 3533). One logical stream; a page
   closes when it nears 4 KB or when asked to flush. */

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1
    t[i] = r >>> 0
  }
  return t
})()

/** Ogg's CRC-32: polynomial 0x04c11db7, not reflected, starting from zero. */
export function oggCrc(bytes: Uint8Array): number {
  let c = 0
  for (let i = 0; i < bytes.length; i++) c = ((c << 8) ^ CRC[((c >>> 24) ^ bytes[i]) & 0xff]) >>> 0
  return c >>> 0
}

type Opts = { bos?: boolean; eos?: boolean; flush?: boolean }

export class OggWriter {
  private pages: Uint8Array[] = []
  private segs: number[] = []
  private body: Uint8Array[] = []
  private size = 0
  private granule = -1 // of the last packet finished on the open page
  private seq = 0
  private bos = true
  private continued = false
  private serial = (Math.random() * 0x7fffffff) | 0

  packet(data: Uint8Array, granule: number, opts: Opts = {}) {
    let at = 0
    // lacing: 255s then the remainder; a remainder of 0 closes a 255-multiple
    for (;;) {
      const n = Math.min(255, data.length - at)
      if (this.segs.length === 255) this.page(false)
      this.segs.push(n)
      this.body.push(data.subarray(at, at + n))
      this.size += n
      at += n
      if (n < 255) break
    }
    this.granule = granule
    if (opts.eos) this.page(true)
    else if (opts.flush || this.size >= 4096) this.page(false)
  }

  private page(eos: boolean) {
    if (!this.segs.length && !eos) return
    // a page ending in a 255 segment ends inside a packet, which runs on
    const open = this.segs[this.segs.length - 1] === 255
    const head = new Uint8Array(27 + this.segs.length)
    const dv = new DataView(head.buffer)
    head.set([0x4f, 0x67, 0x67, 0x53]) // OggS
    head[4] = 0
    head[5] = (this.continued ? 1 : 0) | (this.bos ? 2 : 0) | (eos ? 4 : 0)
    // the granule of the last packet finished here; none finished reads -1
    const g = this.segs.some((s) => s < 255) ? this.granule : -1
    dv.setUint32(6, g < 0 ? 0xffffffff : g % 2 ** 32, true)
    dv.setUint32(10, g < 0 ? 0xffffffff : Math.floor(g / 2 ** 32), true)
    dv.setUint32(14, this.serial, true)
    dv.setUint32(18, this.seq++, true)
    head[26] = this.segs.length
    head.set(this.segs, 27)
    const page = new Uint8Array(head.length + this.size)
    page.set(head)
    let o = head.length
    for (const b of this.body) {
      page.set(b, o)
      o += b.length
    }
    new DataView(page.buffer).setUint32(22, oggCrc(page), true)
    this.pages.push(page)
    this.continued = open
    this.bos = false
    this.segs = []
    this.body = []
    this.size = 0
  }

  bytes(): Uint8Array {
    const n = this.pages.reduce((s, p) => s + p.length, 0)
    const out = new Uint8Array(n)
    let o = 0
    for (const p of this.pages) {
      out.set(p, o)
      o += p.length
    }
    return out
  }
}
