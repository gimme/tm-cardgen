// Zip round-trip: the project's backup format.
//   project.json          formatVersion, card order
//   cards/<slug>.yaml     one human-editable file per card (source verbatim)
//   art/<filename>        art blobs
import { strToU8, zipSync, type Zippable } from 'fflate'
import { getServices } from '../store/services.ts'
import { cardSlugs } from '../store/cardName.ts'
import { bytesToBlob } from './exportCommon.ts'
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
  const order = cardSlugs(cards.map((c) => c.name))
  cards.forEach((card, i) => {
    files[`cards/${order[i]}.yaml`] = strToU8(card.yamlText)
  })

  for (const art of await store.listArt()) {
    files[`art/${art.name}`] = new Uint8Array(await art.blob.arrayBuffer())
  }

  const manifest: ProjectManifest = { formatVersion: 1, order }
  files['project.json'] = strToU8(JSON.stringify(manifest, null, 2))

  return bytesToBlob(zipSync(files, { level: 6 }), 'application/zip')
}
