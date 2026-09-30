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

/** Writes landing together, in one transaction, or none of them: the deletes
 *  first, so that a batch can put back what it deletes, then the puts, the
 *  card patches and the meta. */
export interface Batch {
  deleteCards?: string[]
  deleteArt?: string[]
  /** each stored whole, new or in place of the one with its id */
  putCards?: StoredCard[]
  /** each stored whole, new or in place of the one with its name */
  putArt?: StoredArt[]
  /** the fields given changed on each card; one no longer there is left out */
  updateCards?: CardPatch[]
  meta?: Partial<ProjectMeta>
}

export interface ProjectStore {
  /** in display order (ascending sortIndex) */
  listCards(): Promise<StoredCard[]>
  getCard(id: string): Promise<StoredCard | undefined>
  listArt(): Promise<StoredArt[]>
  getArt(name: string): Promise<StoredArt | undefined>
  getMeta(): Promise<ProjectMeta>

  /** every write, so that none is seen half done */
  write(batch: Batch): Promise<void>
}

export const DEFAULT_META: ProjectMeta = { schemaVersion: 1 }

export function nextSortIndex(cards: { sortIndex: number }[]): number {
  return (cards[cards.length - 1]?.sortIndex ?? -1) + 1
}
