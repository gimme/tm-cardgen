import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  DEFAULT_META,
  type CardPatch,
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

  static async open(name = 'tm-cardgen'): Promise<IdbProjectStore> {
    const db = await openDB<CardgenDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('cards', { keyPath: 'id' })
        db.createObjectStore('art', { keyPath: 'name' })
        db.createObjectStore('meta')
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

  async putCard(card: StoredCard): Promise<void> {
    await this.db.put('cards', card)
  }

  async updateCards(patches: CardPatch[]): Promise<void> {
    const tx = this.db.transaction('cards', 'readwrite')
    for (const patch of patches) {
      const stored = await tx.store.get(patch.id)
      if (stored) await tx.store.put({ ...stored, ...patch })
    }
    await tx.done
  }

  async deleteCard(id: string): Promise<void> {
    await this.db.delete('cards', id)
  }

  listArt(): Promise<StoredArt[]> {
    return this.db.getAll('art')
  }

  getArt(name: string): Promise<StoredArt | undefined> {
    return this.db.get('art', name)
  }

  async putArt(art: StoredArt): Promise<void> {
    await this.db.put('art', art)
  }

  async deleteArt(name: string): Promise<void> {
    await this.db.delete('art', name)
  }

  async getMeta(): Promise<ProjectMeta> {
    return (await this.db.get('meta', 'meta')) ?? { ...DEFAULT_META }
  }

  async setMeta(patch: Partial<ProjectMeta>): Promise<void> {
    const current = await this.getMeta()
    await this.db.put('meta', { ...current, ...patch }, 'meta')
  }

  async readAll() {
    const tx = this.db.transaction(['cards', 'art', 'meta'])
    const [cards, art, meta] = await Promise.all([
      tx.objectStore('cards').getAll(),
      tx.objectStore('art').getAll(),
      tx.objectStore('meta').get('meta'),
    ])
    return {
      cards: cards.sort((a, b) => a.sortIndex - b.sortIndex),
      art,
      meta: meta ?? { ...DEFAULT_META },
    }
  }
}
