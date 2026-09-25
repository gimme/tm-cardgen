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
}

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
  deleteCard(id: string): Promise<void>

  listArt(): Promise<StoredArt[]>
  getArt(name: string): Promise<StoredArt | undefined>
  putArt(art: StoredArt): Promise<void>
  deleteArt(name: string): Promise<void>

  getMeta(): Promise<ProjectMeta>
  setMeta(patch: Partial<ProjectMeta>): Promise<void>
}

export const DEFAULT_META: ProjectMeta = { schemaVersion: 1 }

export function nextSortIndex(cards: { sortIndex: number }[]): number {
  return (cards[cards.length - 1]?.sortIndex ?? -1) + 1
}
