/* Saving a file: an anchor click in a browser, or the host's `downloads`
   API inside the Artifact viewer, where the page cannot download itself. */

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

  // the viewer's extension allowlist has no .vellum; the bytes are unchanged
  const filename = name.endsWith('.vellum') ? `${name}.json` : name
  try {
    await api.save({ filename, data: text })
    return filename === name
      ? `Saved ${filename}`
      : `Saved as ${filename}, because this viewer blocks the .vellum extension`
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'failed'
    return code === 'declined' ? 'Save cancelled' : `Could not save (${code})`
  }
}

/** Save a PNG data URL. Textures export this way; the viewport is CSS 3D and has no pixels to read. */
export async function saveDataUrl(name: string, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return 'That texture has no image data to export.'
  const [head, body] = dataUrl.split(',')
  const bytes = head.includes('base64')
    ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body))
  return saveBlob(name, new Blob([bytes], { type: 'image/png' }))
}
