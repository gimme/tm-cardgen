// Zip round-trip: the project's backup format.
//   project.json          formatVersion, card order
//   cards/<slug>.yaml     one human-editable file per card (source verbatim)
//   art/<filename>        art blobs
import { strToU8, zipSync, type Zippable } from 'fflate'
import { getServices } from '../store/services.ts'
import { bytesToBlob, slugify } from './exportCommon.ts'
import type { CardEntry } from '../store/useStore.ts'

export interface ProjectManifest {
  formatVersion: 1
  /** slugs of cards/<slug>.yaml in display order; the import ignores unknown
   *  ones and appends files it doesn't list, so hand edits are safe */
  order: string[]
}

export async function exportProjectZip(cards: CardEntry[]): Promise<Blob> {
  const { store } = getServices()
  const files: Zippable = {}
  const order: string[] = []
  const usedSlugs = new Set<string>()
  for (const card of cards) {
    let slug = slugify(card.name)
    let n = 2
    while (usedSlugs.has(slug)) slug = `${slugify(card.name)}-${n++}`
    usedSlugs.add(slug)
    order.push(slug)
    files[`cards/${slug}.yaml`] = strToU8(card.yamlText)
  }

  for (const art of await store.listArt()) {
    files[`art/${art.name}`] = new Uint8Array(await art.blob.arrayBuffer())
  }

  const manifest: ProjectManifest = { formatVersion: 1, order }
  files['project.json'] = strToU8(JSON.stringify(manifest, null, 2))

  return bytesToBlob(zipSync(files, { level: 6 }), 'application/zip')
}
