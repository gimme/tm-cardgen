import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  DEFAULT_META,
  type Batch,
  type ProjectMeta,
  type ProjectStore,
  type StoredArt,
  type StoredCard,
} from './ProjectStore.ts'

interface CardgenDB extends DBSchema {
  cards: { key: string; value: StoredCard }
  art: { key: string; value: StoredArt }
  meta: { key: string; value: ProjectMeta }
}

export class IdbProjectStore implements ProjectStore {
  private db: IDBPDatabase<CardgenDB>

  private constructor(db: IDBPDatabase<CardgenDB>) {
    this.db = db
  }

  /** `outdated` runs when another tab asks for a newer version of the
   *  database. That tab's upgrade is held up for as long as this connection is
   *  open, so the connection closes as soon as `outdated` is done. */
  static async open(
    name = 'tm-cardgen',
    outdated?: () => Promise<void> | void,
  ): Promise<IdbProjectStore> {
    const db = await openDB<CardgenDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('cards', { keyPath: 'id' })
        db.createObjectStore('art', { keyPath: 'name' })
        db.createObjectStore('meta')
      },
      blocking: () => {
        void Promise.resolve(outdated?.()).finally(() => db.close())
      },
    })
    return new IdbProjectStore(db)
  }

  async listCards(): Promise<StoredCard[]> {
    const cards = await this.db.getAll('cards')
    return cards.sort((a, b) => a.sortIndex - b.sortIndex)
  }

  getCard(id: string): Promise<StoredCard | undefined> {
    return this.db.get('cards', id)
  }

  listArt(): Promise<StoredArt[]> {
    return this.db.getAll('art')
  }

  getArt(name: string): Promise<StoredArt | undefined> {
    return this.db.get('art', name)
  }

  async getMeta(): Promise<ProjectMeta> {
    return (await this.db.get('meta', 'meta')) ?? { ...DEFAULT_META }
  }

  async write(batch: Batch): Promise<void> {
    const tx = this.db.transaction(['cards', 'art', 'meta'], 'readwrite')
    const cards = tx.objectStore('cards')
    const art = tx.objectStore('art')
    const meta = tx.objectStore('meta')
    const writes = async () => {
      for (const id of batch.deleteCards ?? []) await cards.delete(id)
      for (const name of batch.deleteArt ?? []) await art.delete(name)
      for (const card of batch.putCards ?? []) await cards.put(card)
      for (const stored of batch.putArt ?? []) await art.put(stored)
      for (const patch of batch.updateCards ?? []) {
        const stored = await cards.get(patch.id)
        if (stored) await cards.put({ ...stored, ...patch })
      }
      if (batch.meta) {
        const current = (await meta.get('meta')) ?? DEFAULT_META
        await meta.put({ ...current, ...batch.meta }, 'meta')
      }
    }
    await Promise.all([
      writes().catch((err: unknown) => {
        // one that throws takes back those before it
        try {
          tx.abort()
        } catch {
          // a failed request has aborted it already
        }
        throw err
      }),
      tx.done,
    ])
  }
}
