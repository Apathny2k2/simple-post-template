/* ---------------------------------------------------------------
   A ZIP writer, in about a hundred lines and with no dependency.

   Everything a resource pack contains is either already compressed
   (PNG) or small enough that compressing it saves less than the code
   to do it costs. So every entry is STORED - method 0, bytes written
   through unchanged. The format is otherwise the real one: local
   headers, a central directory and an end record, so what comes out
   opens in any unzipper and in Minecraft.

   Deliberately not here: deflate, zip64, encryption, directory
   entries. A pack that needed any of them would be a pack with
   something wrong with it.
   --------------------------------------------------------------- */

export type ZipEntry = { path: string; bytes: Uint8Array }

/* ---------------- CRC-32 ---------------- */

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* ---------------- DOS date and time ---------------- */

/** ZIP keeps the clock MS-DOS kept: two seconds of resolution, from 1980. */
function dosStamp(at: Date): { time: number; date: number } {
  const year = Math.max(1980, at.getFullYear())
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  }
}

/* ---------------- writing ---------------- */

class Buf {
  private parts: Uint8Array[] = []
  length = 0

  push(b: Uint8Array) {
    this.parts.push(b)
    this.length += b.length
  }

  u16(v: number) {
    const b = new Uint8Array(2)
    new DataView(b.buffer).setUint16(0, v & 0xffff, true)
    this.push(b)
  }

  u32(v: number) {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, v >>> 0, true)
    this.push(b)
  }

  join(): Uint8Array {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const part of this.parts) {
      out.set(part, at)
      at += part.length
    }
    return out
  }
}

const utf8 = (s: string) => new TextEncoder().encode(s)

/**
 * The entries as one archive. Paths use forward slashes and no leading
 * slash, which is what every unzipper and Minecraft expect.
 */
export function makeZip(entries: ZipEntry[], at: Date = new Date()): Uint8Array {
  const { time, date } = dosStamp(at)
  const body = new Buf()
  const dir = new Buf()

  for (const entry of entries) {
    const name = utf8(entry.path.replace(/^\/+/, '').replace(/\\/g, '/'))
    const crc = crc32(entry.bytes)
    const offset = body.length

    // local file header
    body.u32(0x04034b50)
    body.u16(20) // version needed
    body.u16(0x0800) // names are UTF-8
    body.u16(0) // stored
    body.u16(time)
    body.u16(date)
    body.u32(crc)
    body.u32(entry.bytes.length)
    body.u32(entry.bytes.length)
    body.u16(name.length)
    body.u16(0)
    body.push(name)
    body.push(entry.bytes)

    // central directory header
    dir.u32(0x02014b50)
    dir.u16(20) // made by
    dir.u16(20) // needed
    dir.u16(0x0800)
    dir.u16(0)
    dir.u16(time)
    dir.u16(date)
    dir.u32(crc)
    dir.u32(entry.bytes.length)
    dir.u32(entry.bytes.length)
    dir.u16(name.length)
    dir.u16(0) // extra
    dir.u16(0) // comment
    dir.u16(0) // disk
    dir.u16(0) // internal attrs
    dir.u32(0) // external attrs
    dir.u32(offset)
    dir.push(name)
  }

  const out = new Buf()
  out.push(body.join())
  const dirAt = out.length
  out.push(dir.join())

  // end of central directory
  out.u32(0x06054b50)
  out.u16(0)
  out.u16(0)
  out.u16(entries.length)
  out.u16(entries.length)
  out.u32(dir.length)
  out.u32(dirAt)
  out.u16(0)

  return out.join()
}

/** The bytes behind a `data:` URI, which is how a texture is carried. */
export function dataUriBytes(uri: string): Uint8Array | null {
  const comma = uri.indexOf(',')
  if (!uri.startsWith('data:') || comma === -1) return null
  const meta = uri.slice(5, comma)
  const payload = uri.slice(comma + 1)
  if (!/;base64$/i.test(meta)) return utf8(decodeURIComponent(payload))
  const binary = atob(payload)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}
