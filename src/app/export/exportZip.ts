// Zip round-trip: the project's backup format, and some cards' to import
// into another project.
//   project.json          formatVersion, card order
//   cards/<slug>.yaml     one human-editable file per card (source verbatim)
//   art/<filename>        art blobs
import { strToU8, zipSync, type Zippable } from 'fflate'
import { artFileOf } from '../../core/index.ts'
import { getServices } from '../store/services.ts'
import { cardSlugs } from '../store/cardName.ts'
import { bytesToBlob } from './exportCommon.ts'
import type { StoredArt } from '../storage/ProjectStore.ts'
import type { CardEntry } from '../store/useStore.ts'

export interface ProjectManifest {
  formatVersion: 1
  /** slugs of cards/<slug>.yaml in display order; the import ignores unknown
   *  ones and appends files it doesn't list, so hand edits are safe */
  order: string[]
}

/** A backup of the whole project: every card, and every image stored, used
 *  or not. */
export async function exportProjectZip(cards: CardEntry[]): Promise<Blob> {
  return zipOf(cards, await getServices().store.listArt())
}

/** The cards, and the images they name that are stored. */
export async function exportCardsZip(cards: CardEntry[]): Promise<Blob> {
  const { store } = getServices()
  const names = new Set(cards.flatMap((c) => artFileOf(c.yamlText) ?? []))
  const named = await Promise.all([...names].map((name) => store.getArt(name)))
  const art = named.filter((image) => image !== undefined)
  return zipOf(cards, art)
}

async function zipOf(cards: CardEntry[], art: StoredArt[]): Promise<Blob> {
  const files: Zippable = {}
  const order = cardSlugs(cards.map((c) => c.name))
  cards.forEach((card, i) => {
    files[`cards/${order[i]}.yaml`] = strToU8(card.yamlText)
  })

  for (const image of art) {
    files[`art/${image.name}`] = new Uint8Array(await image.blob.arrayBuffer())
  }

  const manifest: ProjectManifest = { formatVersion: 1, order }
  files['project.json'] = strToU8(JSON.stringify(manifest, null, 2))

  return bytesToBlob(zipSync(files, { level: 6 }), 'application/zip')
}
