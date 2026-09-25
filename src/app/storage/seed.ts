// Samples are seeded through the same path as user content, so they are
// ordinary editable cards.
import { SAMPLE_ART_FILES, SAMPLE_CARDS } from '../samples/index.ts'
import { sampleArtUrl } from '../services/assetService.ts'
import { nextSortIndex, type ProjectStore } from './ProjectStore.ts'

function sampleCardId(slug: string): string {
  return `sample-${slug}`
}

/** With `force`, re-inserts samples that already exist. User cards are never touched. */
export async function seedSamples(store: ProjectStore, force = false): Promise<void> {
  const meta = await store.getMeta()
  if (meta.seededAt !== undefined && !force) return

  const cards = await store.listCards()
  const existing = new Set(cards.map((c) => c.id))
  let sort = nextSortIndex(cards)
  for (const sample of SAMPLE_CARDS) {
    const id = sampleCardId(sample.slug)
    if (existing.has(id) && !force) continue
    await store.putCard({
      id,
      name: sample.name,
      yamlText: sample.text,
      sortIndex: existing.has(id) ? ((await store.getCard(id))?.sortIndex ?? sort++) : sort++,
      updatedAt: Date.now(),
    })
  }

  const artNames = new Set((await store.listArt()).map((a) => a.name))
  for (const file of SAMPLE_ART_FILES) {
    if (artNames.has(file)) continue
    const res = await fetch(sampleArtUrl(file))
    if (!res.ok) continue
    const blob = await res.blob()
    await store.putArt({ name: file, blob, mime: blob.type, size: blob.size })
  }

  if (meta.seededAt === undefined) await store.setMeta({ seededAt: Date.now() })
}
