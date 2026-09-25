import { artFileOf } from '../../../core/index.ts'
import type { CardEntry } from '../../store/useStore.ts'

/** The names of the cards referencing each art file. */
export function artUsers(cards: CardEntry[]): Map<string, string[]> {
  const users = new Map<string, string[]>()
  for (const card of cards) {
    const file = artFileOf(card.yamlText)
    if (file) users.set(file, [...(users.get(file) ?? []), card.name])
  }
  return users
}

/** Referenced art files the project doesn't have, sorted. */
export function missingArt(users: Map<string, string[]>, present: string[]): string[] {
  const have = new Set(present)
  return [...users.keys()].filter((file) => !have.has(file)).sort()
}

/** The image files among a pick or drop, ready for the store. */
export function imageEntries(list: FileList | File[]): { name: string; blob: Blob }[] {
  return [...list]
    .filter((f) => f.type.startsWith('image/'))
    .map((f) => ({ name: f.name, blob: f }))
}
