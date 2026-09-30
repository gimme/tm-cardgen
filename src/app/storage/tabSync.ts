// The app's tabs kept in step through storage. Once a write to it has landed,
// what it changed is read back from storage into the tab that wrote it and
// announced to the others, which read it back too: storage stays the one
// truth, and no message carries what a tab should show.
import type { Batch, ProjectStore } from './ProjectStore.ts'

/** what writes changed: cards by id, images by name, and the meta */
export interface Changes {
  cards?: string[]
  art?: string[]
  meta?: boolean
}

const CHANNEL = 'tm-cardgen'

let channel: BroadcastChannel | undefined

/** this tab hearing of the other tabs' writes, each read back by `readBack`;
 *  returns the way out */
export function joinTabs(readBack: (changes: Changes) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const joined = new BroadcastChannel(CHANNEL)
  joined.onmessage = (e: MessageEvent<Changes>) => readBack(e.data)
  channel = joined
  return () => {
    joined.close()
    if (channel === joined) channel = undefined
  }
}

/** what `batch` changes */
function changesOf(batch: Batch): Changes {
  const cards = [
    ...(batch.deleteCards ?? []),
    ...(batch.putCards ?? []).map((c) => c.id),
    ...(batch.updateCards ?? []).map((p) => p.id),
  ]
  const art = [...(batch.deleteArt ?? []), ...(batch.putArt ?? []).map((a) => a.name)]
  const changes: Changes = {}
  if (cards.length > 0) changes.cards = cards
  if (art.length > 0) changes.art = art
  if (batch.meta) changes.meta = true
  return changes
}

/** `store` with what each write changed, once it has landed, read back into
 *  this tab by `readBack` and announced to the others (from joinTabs on) */
export function shared(store: ProjectStore, readBack: (changes: Changes) => void): ProjectStore {
  return {
    listCards: () => store.listCards(),
    getCard: (id) => store.getCard(id),
    listArt: () => store.listArt(),
    getArt: (name) => store.getArt(name),
    getMeta: () => store.getMeta(),

    async write(batch) {
      await store.write(batch)
      const changes = changesOf(batch)
      readBack(changes)
      channel?.postMessage(changes)
    },
  }
}
