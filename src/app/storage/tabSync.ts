// The app's tabs kept in step through storage. Once a write to it has landed,
// what it changed is read back from storage into the tab that wrote it and
// announced to the others, which read it back too: storage stays the one
// truth, and no message carries what a tab should show.
import type { ProjectStore } from './ProjectStore.ts'

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

/** `store` with what each write changed, once it has landed, read back into
 *  this tab by `readBack` and announced to the others (from joinTabs on) */
export function shared(store: ProjectStore, readBack: (changes: Changes) => void): ProjectStore {
  const landed = (changes: Changes) => {
    readBack(changes)
    channel?.postMessage(changes)
  }
  return {
    listCards: () => store.listCards(),
    getCard: (id) => store.getCard(id),
    async putCard(card) {
      await store.putCard(card)
      landed({ cards: [card.id] })
    },
    async updateCards(patches) {
      await store.updateCards(patches)
      landed({ cards: patches.map((p) => p.id) })
    },
    async deleteCard(id) {
      await store.deleteCard(id)
      landed({ cards: [id] })
    },

    listArt: () => store.listArt(),
    getArt: (name) => store.getArt(name),
    async putArt(art) {
      await store.putArt(art)
      landed({ art: [art.name] })
    },
    async deleteArt(name) {
      await store.deleteArt(name)
      landed({ art: [name] })
    },

    getMeta: () => store.getMeta(),
    async setMeta(patch) {
      await store.setMeta(patch)
      landed({ meta: true })
    },

    readAll: () => store.readAll(),
  }
}
