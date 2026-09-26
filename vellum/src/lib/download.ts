/* ---------------------------------------------------------------
   Handing the viewer a file.

   In a browser this is an anchor click and the file is exactly what it
   says it is. Inside the Artifact viewer the page cannot download
   directly - it offers the file through the host, which allowlists
   extensions, and `.vellum` is not among them. The bytes are identical
   either way; only the name the viewer is offered differs, and the
   caller says so rather than letting the save fail silently.
   --------------------------------------------------------------- */

type DownloadsApi = { save: (req: { filename: string; data: string | Blob }) => Promise<unknown> }

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> }
  }
}

async function host(): Promise<DownloadsApi | null> {
  try {
    return ((await window.claude?.use?.('downloads')) as DownloadsApi | null) ?? null
  } catch {
    return null
  }
}

function viaAnchor(name: string, blob: Blob): string {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return `Saved ${name}`
}

export async function saveBlob(name: string, blob: Blob): Promise<string> {
  const api = await host()
  if (!api) return viaAnchor(name, blob)
  try {
    await api.save({ filename: name, data: blob })
    return `Saved ${name}`
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'failed'
    return code === 'declined' ? 'Save cancelled' : `Could not save (${code})`
  }
}

export async function saveFile(name: string, text: string): Promise<string> {
  const api = await host()
  if (!api) return viaAnchor(name, new Blob([text], { type: 'application/json' }))

  // the viewer's allowlist has no .vellum in it; the bytes are the same
  const filename = name.endsWith('.vellum') ? `${name}.json` : name
  try {
    await api.save({ filename, data: text })
    return filename === name
      ? `Saved ${filename}`
      : `Saved as ${filename} \u2014 this viewer does not allow a .vellum extension`
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'failed'
    return code === 'declined' ? 'Save cancelled' : `Could not save (${code})`
  }
}

/**
 * A PNG out of the editor. The viewport itself cannot be captured - it
 * is composed from CSS 3D transforms, not a canvas, so there are no
 * pixels to read - but the texture is a real image and is the thing
 * anyone actually wants out of a paint session.
 */
export async function saveDataUrl(name: string, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return 'That texture has no image data to export.'
  const [head, body] = dataUrl.split(',')
  const bytes = head.includes('base64')
    ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body))
  return saveBlob(name, new Blob([bytes], { type: 'image/png' }))
}
