// Bundled asset access: URLs, fonts shared by measurement and display, data
// URIs for export.
import { FONT_FAMILIES, FONT_FILES, FontService } from '../../core/index.ts'
import type { AssetRef, FontId } from '../../core/index.ts'

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`
}

export function sampleArtUrl(file: string): string {
  return `${import.meta.env.BASE_URL}samples/art/${file}`
}

/** Fetches the faces once, for both CSS rendering and the measuring FontService. */
export async function loadFonts(): Promise<FontService> {
  const ids = Object.keys(FONT_FILES) as FontId[]
  const buffers = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(assetUrl(FONT_FILES[id]))
      if (!res.ok) throw new Error(`failed to load font ${FONT_FILES[id]}: ${res.status}`)
      return res.arrayBuffer()
    }),
  )
  const record = Object.fromEntries(ids.map((id, i) => [id, buffers[i]])) as Record<
    FontId,
    ArrayBuffer
  >
  await Promise.all(
    ids.map((id) => {
      const fam = FONT_FAMILIES[id]
      const face = new FontFace(fam.family, record[id], {
        style: fam.style,
        weight: String(fam.weight),
      })
      document.fonts.add(face)
      return face.load()
    }),
  )
  return new FontService(record)
}

const dataUriCache = new Map<string, Promise<string>>()

/** Lazy base64 data URI for a bundled asset (export path). */
export function assetDataUri(path: string): Promise<string> {
  let cached = dataUriCache.get(path)
  if (!cached) {
    cached = fetch(assetUrl(path))
      .then((r) => {
        if (!r.ok) throw new Error(`failed to load asset ${path}: ${r.status}`)
        return r.blob()
      })
      .then(blobToDataUri)
    dataUriCache.set(path, cached)
  }
  return cached
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Preview resolution: bundled assets by URL, user art by object URL. */
export function makePreviewResolver(artUrl: (file: string) => string | undefined) {
  return (ref: AssetRef): string => {
    if (ref.type === 'asset') return assetUrl(ref.path)
    return artUrl(ref.file) ?? ''
  }
}
