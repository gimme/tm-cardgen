// The app's tabs kept in step through storage. Once a write to it has landed,
// storage is read back into the tab that wrote it, and the other tabs are told
// to read it back too: storage stays the one truth, and no message carries
// what a tab should show.
import type { ProjectStore } from './ProjectStore.ts'

/** What a write changed, as far as a read back needs to know. Every read takes
 *  in all the cards and the meta, which is cheap; the images it takes in only
 *  when a write changed one, since listing them is the slow part. */
export interface Changes {
  art: boolean
}

const CHANNEL = 'tm-cardgen'

let channel: BroadcastChannel | undefined

/** this tab hearing of the other tabs' writes, each read back by `readBack`;
 *  returns the way to stop hearing them */
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

/** `store` with each write, once it has landed, read back into this tab by
 *  `readBack` and announced to the others (from joinTabs on) */
export function shared(store: ProjectStore, readBack: (changes: Changes) => void): ProjectStore {
  return {
    listCards: () => store.listCards(),
    getCard: (id) => store.getCard(id),
    listArt: () => store.listArt(),
    getArt: (name) => store.getArt(name),
    getMeta: () => store.getMeta(),

    async write(batch) {
      await store.write(batch)
      const changes: Changes = {
        art: (batch.deleteArt?.length ?? 0) + (batch.putArt?.length ?? 0) > 0,
      }
      readBack(changes)
      channel?.postMessage(changes)
    },
  }
}
