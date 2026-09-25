// Export plumbing: card text to a standalone SVG string, images inlined as
// data URIs and text outlined to paths, so it rasterizes identically anywhere.
import {
  checkCard,
  layoutCard,
  renderSvgString,
  type AssetRef,
  type CardLayout,
} from '../../core/index.ts'
import { assetDataUri, blobToDataUri } from '../services/assetService.ts'
import { getServices, layoutContext } from '../store/services.ts'

/** Parse + validate + layout, or throw with a readable message. */
export function layoutFromText(yamlText: string, cardName: string): CardLayout {
  const { diagnostics, spec } = checkCard(yamlText)
  if (!spec) {
    const first = diagnostics.find((d) => d.severity === 'error')
    throw new Error(`${cardName}: ${first?.message ?? 'invalid card'}`)
  }
  return layoutCard(spec, layoutContext())
}

export async function exportSvg(layout: CardLayout): Promise<string> {
  // pre-resolve every asset ref async, then render with a sync lookup
  const refs = new Map<string, AssetRef>()
  const keyOf = (ref: AssetRef) => (ref.type === 'asset' ? `asset:${ref.path}` : `art:${ref.file}`)
  for (const node of layout.nodes) {
    if (node.kind === 'image') refs.set(keyOf(node.asset), node.asset)
    if (node.kind === 'rect' && node.fill === 'production-pattern')
      refs.set('asset:production.png', { type: 'asset', path: 'production.png' })
  }
  const resolved = new Map<string, string>()
  await Promise.all(
    [...refs.entries()].map(async ([key, ref]) => {
      if (ref.type === 'asset') {
        resolved.set(key, await assetDataUri(ref.path))
      } else {
        const stored = await getServices().store.getArt(ref.file)
        resolved.set(key, stored ? await blobToDataUri(stored.blob) : '')
      }
    }),
  )
  const { fonts } = getServices()
  return renderSvgString(layout, {
    resolveAsset: (ref) => resolved.get(keyOf(ref)) ?? '',
    outline: fonts,
  })
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'card'
}

/** a Blob over bytes (the DOM's BlobPart type rejects a Uint8Array<ArrayBufferLike>) */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
