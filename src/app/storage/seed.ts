// Samples are seeded through the same path as user content, so they are
// ordinary editable cards.
import { SAMPLE_ART_FILES, SAMPLE_CARDS } from '../samples/index.ts'
import { sampleArtUrl } from '../services/assetService.ts'
import {
  nextSortIndex,
  type ProjectStore,
  type StoredArt,
  type StoredCard,
} from './ProjectStore.ts'

function sampleCardId(slug: string): string {
  return `sample-${slug}`
}

/** With `force`, re-inserts samples that already exist. User cards are never touched. */
export async function seedSamples(store: ProjectStore, force = false): Promise<void> {
  const meta = await store.getMeta()
  if (meta.seededAt !== undefined && !force) return

  const cards = await store.listCards()
  const existing = new Map(cards.map((c) => [c.id, c]))
  const updatedAt = Date.now()
  const putCards: StoredCard[] = []
  const putArt: StoredArt[] = []

  let sort = nextSortIndex(cards)
  for (const sample of SAMPLE_CARDS) {
    const id = sampleCardId(sample.slug)
    if (existing.has(id) && !force) continue
    putCards.push({
      id,
      name: sample.name,
      yamlText: sample.text,
      sortIndex: existing.get(id)?.sortIndex ?? sort++,
      updatedAt,
    })
  }

  // fetched first: all of it is then stored in one go
  const artNames = new Set((await store.listArt()).map((a) => a.name))
  for (const file of SAMPLE_ART_FILES) {
    if (artNames.has(file)) continue
    const res = await fetch(sampleArtUrl(file))
    if (!res.ok) continue
    const blob = await res.blob()
    putArt.push({ name: file, blob, mime: blob.type, size: blob.size, updatedAt })
  }

  await store.write({
    putCards,
    putArt,
    meta: meta.seededAt === undefined ? { seededAt: updatedAt } : undefined,
  })
}
