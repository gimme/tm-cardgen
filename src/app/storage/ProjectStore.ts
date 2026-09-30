// Storage interface; the app only talks to this, so another backend can slot in.

export interface StoredCard {
  id: string
  name: string
  yamlText: string
  sortIndex: number
  updatedAt: number
}

export interface StoredArt {
  /** filename, the key card specs reference */
  name: string
  blob: Blob
  mime: string
  size: number
  /** when this image was stored, telling it from another stored under the
   *  same name before or since; missing on images stored before it was kept */
  updatedAt?: number
}

/** some of a stored card's fields, by its id */
export type CardPatch = Pick<StoredCard, 'id'> & Partial<Omit<StoredCard, 'id'>>

export interface ProjectMeta {
  schemaVersion: number
  lastOpenCardId?: string
  seededAt?: number
  /** set when there are changes since the last zip export */
  dirtySinceExport?: boolean
}

export interface ProjectStore {
  /** in display order (ascending sortIndex) */
  listCards(): Promise<StoredCard[]>
  getCard(id: string): Promise<StoredCard | undefined>
  putCard(card: StoredCard): Promise<void>
  /** the fields given changed on each card, in one go; a card no longer
   *  there is left out */
  updateCards(patches: CardPatch[]): Promise<void>
  deleteCard(id: string): Promise<void>

  listArt(): Promise<StoredArt[]>
  getArt(name: string): Promise<StoredArt | undefined>
  putArt(art: StoredArt): Promise<void>
  deleteArt(name: string): Promise<void>

  getMeta(): Promise<ProjectMeta>
  setMeta(patch: Partial<ProjectMeta>): Promise<void>

  /** every card and image and the meta, read in one go, so that no write
   *  lands between the parts */
  readAll(): Promise<{ cards: StoredCard[]; art: StoredArt[]; meta: ProjectMeta }>
}

export const DEFAULT_META: ProjectMeta = { schemaVersion: 1 }

export function nextSortIndex(cards: { sortIndex: number }[]): number {
  return (cards[cards.length - 1]?.sortIndex ?? -1) + 1
}
