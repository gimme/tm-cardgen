import { strFromU8, unzipSync } from 'fflate'
import { checkCard } from '../../core/index.ts'
import { getServices } from '../store/services.ts'
import { nextSortIndex } from '../storage/ProjectStore.ts'
import { bytesToBlob } from './exportCommon.ts'
import type { ProjectManifest } from './exportZip.ts'

export interface ImportPreview {
  cards: { slug: string; name: string; yamlText: string; valid: boolean; error?: string }[]
  art: { name: string; bytes: Uint8Array }[]
  problems: string[]
}

/** Unpack + validate a project zip without touching storage. */
export async function previewImport(file: File | Blob): Promise<ImportPreview> {
  const raw = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const preview: ImportPreview = { cards: [], art: [], problems: [] }

  let order: string[] = []
  if (raw['project.json']) {
    try {
      const manifest = JSON.parse(strFromU8(raw['project.json'])) as Partial<ProjectManifest>
      if (Array.isArray(manifest.order))
        order = manifest.order.filter((s): s is string => typeof s === 'string')
    } catch {
      preview.problems.push('project.json is not valid JSON — importing files as-is')
    }
  }

  const cardEntries = Object.entries(raw).filter(
    ([path]) => path.startsWith('cards/') && path.endsWith('.yaml'),
  )
  // manifest order first, stragglers after
  const orderIndex = new Map(order.map((slug, i) => [`cards/${slug}.yaml`, i]))
  cardEntries.sort(
    ([a], [b]) => (orderIndex.get(a) ?? 1e9) - (orderIndex.get(b) ?? 1e9) || a.localeCompare(b),
  )

  for (const [path, bytes] of cardEntries) {
    const slug = path.slice('cards/'.length).replace(/\.yaml$/, '')
    const yamlText = strFromU8(bytes)
    const { diagnostics, spec } = checkCard(yamlText)
    preview.cards.push({
      slug,
      name: spec?.name ?? slug,
      yamlText,
      valid: spec !== undefined,
      error: spec ? undefined : diagnostics.find((d) => d.severity === 'error')?.message,
    })
  }

  for (const [path, bytes] of Object.entries(raw)) {
    if (path.startsWith('art/') && !path.endsWith('/')) {
      preview.art.push({ name: path.slice('art/'.length), bytes })
    }
  }

  if (preview.cards.length === 0 && preview.art.length === 0) {
    preview.problems.push('zip contains no cards/*.yaml or art/* entries')
  }
  return preview
}

export type ImportMode = 'merge' | 'replace'

/** Apply a previewed import. `merge` adds everything as new cards (same-name
 *  art overwrites); `replace` clears the project first. */
export async function applyImport(preview: ImportPreview, mode: ImportMode): Promise<void> {
  const { store, art } = getServices()

  if (mode === 'replace') {
    for (const card of await store.listCards()) await store.deleteCard(card.id)
    for (const stored of await store.listArt()) {
      await store.deleteArt(stored.name)
      art.remove(stored.name)
    }
  }

  let sort = nextSortIndex(await store.listCards())
  for (const card of preview.cards) {
    await store.putCard({
      id: `card-${crypto.randomUUID()}`,
      name: card.name,
      yamlText: card.yamlText,
      sortIndex: sort++,
      updatedAt: Date.now(),
    })
  }

  for (const entry of preview.art) {
    const blob = bytesToBlob(entry.bytes, mimeOf(entry.name))
    await store.putArt({ name: entry.name, blob, mime: blob.type, size: blob.size })
    await art.setBlob(entry.name, blob)
  }
}

function mimeOf(name: string): string {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  if (/\.webp$/i.test(name)) return 'image/webp'
  if (/\.gif$/i.test(name)) return 'image/gif'
  return 'image/png'
}
