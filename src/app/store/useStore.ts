import { create } from 'zustand'
import {
  artFileOf,
  checkCard,
  layoutCard,
  withArtFile,
  type CardLayout,
  type Diagnostic,
} from '../../core/index.ts'
import { NEW_CARD_TEMPLATE } from '../samples/index.ts'
import {
  nextSortIndex,
  type ProjectMeta,
  type StoredArt,
  type StoredCard,
} from '../storage/ProjectStore.ts'
import { seedSamples } from '../storage/seed.ts'
import type { Changes } from '../storage/tabSync.ts'
import { copyName, extractName, withName } from './cardName.ts'
import { getServices, layoutContext } from './services.ts'

export interface CardEntry {
  id: string
  name: string
  yamlText: string
  sortIndex: number
}

export interface AppState {
  status: 'loading' | 'ready'
  startupError?: string
  /** in display order: every change keeps them sorted by sortIndex */
  cards: CardEntry[]
  currentId?: string
  /** editor text of the current card (authoritative while editing); the
   *  editor follows it where it changes from outside, by another tab say */
  text: string
  /** the current card's text as storage last had it, read or saved: `text`
   *  is unsaved while it differs */
  savedText: string
  /** the last save failed; the next to land clears it */
  saveFailed: boolean
  /** last successfully laid-out card (never blanks mid-keystroke) */
  layout?: CardLayout
  /** true while the text no longer produces a valid layout */
  stale: boolean
  diagnostics: Diagnostic[]
  /** every card at once, or the current card's list, editor and preview;
   *  the router keeps the address bar in step */
  page: 'gallery' | 'editor'
  artManagerOpen: boolean
  exportDialogOpen: boolean
  /** bumps when art changes, so views depending on the art cache refresh */
  artVersion: number
  /** changes since the last zip export; drives the backup nudge */
  dirtySinceExport: boolean
  /** the cards the last delete took, until it is undone or dismissed */
  deleted?: CardEntry[]

  selectCard(id: string): void
  updateText(text: string): void
  recompute(): void
  flushSave(): Promise<void>

  newCard(): Promise<void>
  duplicateCard(id: string): Promise<void>
  deleteCards(ids: string[]): Promise<void>
  /** the cards the last delete took, back in their places */
  undoDelete(): Promise<void>
  dismissDeleted(): void
  moveCard(id: string, toIndex: number): Promise<void>
  restoreSamples(): Promise<void>
  /** Storage read back into the state and the art cache: what `changes`
   *  names, or everything. The current card keeps text typed here and not yet
   *  saved; with it gone, the last one open or the first opens. One read at a
   *  time, in order: those asked for while one runs wait for it, as one. */
  reloadFromStore(changes?: Changes): Promise<void>
  /** the project was just backed up */
  markExported(): Promise<void>

  /** A file already stored under its name is nothing new when the image is the
   *  same, and replaces it only if `confirmReplace`, given those names, says so. */
  importArt(
    files: { name: string; blob: Blob }[],
    confirmReplace: (names: string[]) => boolean,
  ): Promise<void>
  deleteArt(name: string): Promise<void>
  /** the cards naming the file follow it; a name already taken is refused */
  renameArt(from: string, to: string): Promise<void>

  setPage(page: AppState['page']): void
  setArtManagerOpen(open: boolean): void
  setExportDialogOpen(open: boolean): void
}

/** how the current card's text stands with storage */
export const saveStateOf = (s: AppState): 'saved' | 'saving' | 'error' =>
  s.saveFailed ? 'error' : s.text === s.savedText ? 'saved' : 'saving'

const RECOMPUTE_DELAY = 200
const AUTOSAVE_DELAY = 500
let recomputeTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined

// the last read of storage asked for, and the one waiting to start
let reading: Promise<void> = Promise.resolve()
let waiting: { changes?: Changes; done: Promise<void> } | undefined

const toEntry = ({ id, name, yamlText, sortIndex }: StoredCard): CardEntry => ({
  id,
  name,
  yamlText,
  sortIndex,
})

const sameCard = (a: CardEntry, b: CardEntry) =>
  a.name === b.name && a.yamlText === b.yamlText && a.sortIndex === b.sortIndex

const bySortIndex = (a: CardEntry, b: CardEntry) => a.sortIndex - b.sortIndex

/** two reads' changes as one; everything, as no changes, takes in the other */
const merged = (a?: Changes, b?: Changes): Changes | undefined =>
  a && b
    ? {
        cards: [...(a.cards ?? []), ...(b.cards ?? [])],
        art: [...(a.art ?? []), ...(b.art ?? [])],
        meta: a.meta || b.meta,
      }
    : undefined

async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
  const v = new Uint8Array(y)
  return new Uint8Array(x).every((byte, i) => byte === v[i])
}

export const useStore = create<AppState>((set, get) => {
  const addCard = async (name: string, yamlText: string) => {
    const entry: CardEntry = {
      id: `card-${crypto.randomUUID()}`,
      name,
      yamlText,
      sortIndex: nextSortIndex(get().cards),
    }
    await getServices().store.write({ putCards: [{ ...entry, updatedAt: Date.now() }] })
    withCards([entry])
    get().selectCard(entry.id)
  }

  /** the card, or nothing when there is none */
  const show = (id: string | undefined) => {
    if (id !== undefined) get().selectCard(id)
    else set({ currentId: undefined, text: '', savedText: '', layout: undefined, stale: false })
  }

  /** `cards`, as stored, for the list, the editor's text following the
   *  current card's, which lays out again after the same pause as typing. With
   *  the current card gone, `open` opens where it is among them, or else the
   *  first */
  const setCards = (cards: CardEntry[], open?: string) => {
    const { currentId, text } = get()
    const current = cards.find((c) => c.id === currentId)
    if (current && current.yamlText !== text) {
      set({ cards, text: current.yamlText, savedText: current.yamlText })
      clearTimeout(recomputeTimer)
      recomputeTimer = setTimeout(() => get().recompute(), RECOMPUTE_DELAY)
    } else {
      set({ cards })
    }
    if (!current) show((cards.find((c) => c.id === open) ?? cards[0])?.id)
  }

  /** cards added, or changed, by id */
  const withCards = (changed: CardEntry[]) => {
    if (changed.length === 0) return
    const byId = new Map(get().cards.map((c) => [c.id, c]))
    for (const c of changed) byId.set(c.id, c)
    setCards([...byId.values()].sort(bySortIndex))
  }

  const dropCards = (ids: readonly string[]) => {
    const { cards } = get()
    const remaining = cards.filter((c) => !ids.includes(c.id))
    if (remaining.length !== cards.length) setCards(remaining)
  }

  /** What `changes` names, or everything, from storage into the state. An
   *  image stored anew loads before the cards and one gone goes after them,
   *  so no card here names an image the cache lacks along the way; one that
   *  won't decode is left out, as if missing. */
  const readBack = async (changes: Changes | undefined) => {
    const { store, art } = getServices()
    const cards = new Map<string, StoredCard | undefined>()
    const images = new Map<string, StoredArt | undefined>()
    let meta: ProjectMeta | undefined
    if (changes) {
      const ids = [...new Set(changes.cards)]
      const names = [...new Set(changes.art)]
      const [storedCards, storedArt, storedMeta] = await Promise.all([
        Promise.all(ids.map((id) => store.getCard(id))),
        Promise.all(names.map((name) => store.getArt(name))),
        changes.meta ? store.getMeta() : undefined,
      ])
      ids.forEach((id, i) => cards.set(id, storedCards[i]))
      names.forEach((name, i) => images.set(name, storedArt[i]))
      meta = storedMeta
    } else {
      // those here go, unless they are still stored
      for (const c of get().cards) cards.set(c.id, undefined)
      for (const name of art.files()) images.set(name, undefined)
      const all = await store.readAll()
      for (const c of all.cards) cards.set(c.id, c)
      for (const a of all.art) images.set(a.name, a)
      meta = all.meta
    }

    let artChanged = false
    for (const [name, stored] of images) {
      const cached = art.entry(name)
      if (!stored || (cached && cached.version === stored.updatedAt)) continue
      try {
        await art.setBlob(name, stored.blob, stored.updatedAt)
        artChanged = true
      } catch {
        // one the browser can't decode is as good as missing
        if (cached) {
          art.remove(name)
          artChanged = true
        }
      }
    }

    const { cards: mine, currentId, text, savedText } = get()
    // text typed into the current card and not yet saved stays
    const typing = text === savedText ? undefined : currentId
    const byId = new Map(mine.map((c) => [c.id, c]))
    for (const [id, stored] of cards) {
      const here = byId.get(id)
      if (!stored) {
        byId.delete(id)
        continue
      }
      const entry =
        id === typing && here ? { ...here, sortIndex: stored.sortIndex } : toEntry(stored)
      if (!here || !sameCard(here, entry)) byId.set(id, entry)
    }
    const next = [...byId.values()].sort(bySortIndex)
    if (next.length !== mine.length || next.some((c, i) => c !== mine[i])) {
      setCards(next, changes ? undefined : meta?.lastOpenCardId)
    }
    const dirty = meta?.dirtySinceExport ?? false
    if (meta && dirty !== get().dirtySinceExport) set({ dirtySinceExport: dirty })

    for (const [name, stored] of images) {
      if (stored || !art.entry(name)) continue
      art.remove(name)
      artChanged = true
    }
    if (artChanged) set((s) => ({ artVersion: s.artVersion + 1 }))
  }

  return {
    status: 'loading',
    cards: [],
    text: '',
    savedText: '',
    saveFailed: false,
    stale: false,
    diagnostics: [],
    page: 'editor',
    artManagerOpen: false,
    exportDialogOpen: false,
    artVersion: 0,
    dirtySinceExport: false,

    selectCard(id) {
      const card = get().cards.find((c) => c.id === id)
      if (!card) return
      void get().flushSave()
      set({ currentId: id, text: card.yamlText, savedText: card.yamlText })
      get().recompute()
      void getServices().store.write({ meta: { lastOpenCardId: id } })
    },

    updateText(text) {
      const { currentId, cards } = get()
      if (currentId === undefined) return
      const name = extractName(text)
      set({
        text,
        cards: cards.map((c) =>
          c.id === currentId ? { ...c, yamlText: text, name: name ?? c.name } : c,
        ),
      })
      clearTimeout(recomputeTimer)
      recomputeTimer = setTimeout(() => get().recompute(), RECOMPUTE_DELAY)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => void get().flushSave(), AUTOSAVE_DELAY)
    },

    async flushSave() {
      clearTimeout(saveTimer)
      const { currentId: id, cards, text, savedText } = get()
      if (id === undefined || text === savedText) return
      const card = cards.find((c) => c.id === id)
      if (!card) return
      try {
        await getServices().store.write({
          updateCards: [{ id, name: card.name, yamlText: text, updatedAt: Date.now() }],
          meta: { dirtySinceExport: true },
        })
        // stored for this card, unless another is open by now; typing since
        // stays unsaved
        if (get().currentId === id) set({ savedText: text })
        set({ saveFailed: false, dirtySinceExport: true })
      } catch {
        set({ saveFailed: true })
      }
    },

    recompute() {
      clearTimeout(recomputeTimer)
      const { text } = get()
      const { diagnostics, spec } = checkCard(text)
      if (!spec) {
        set({ stale: true, diagnostics })
        return
      }
      set({ layout: layoutCard(spec, layoutContext()), stale: false, diagnostics })
    },

    newCard: () => addCard('New Card', NEW_CARD_TEMPLATE),

    async duplicateCard(sourceId) {
      const { cards } = get()
      const source = cards.find((c) => c.id === sourceId)
      if (!source) return
      const name = copyName(
        source.name,
        cards.map((c) => c.name),
      )
      await addCard(name, withName(source.yamlText, name))
    },

    async deleteCards(ids) {
      const gone = get().cards.filter((c) => ids.includes(c.id))
      if (gone.length === 0) return
      await getServices().store.write({ deleteCards: gone.map((c) => c.id) })
      set({ deleted: gone })
      dropCards(ids)
    },

    async undoDelete() {
      const { deleted } = get()
      if (!deleted) return
      const updatedAt = Date.now()
      await getServices().store.write({ putCards: deleted.map((c) => ({ ...c, updatedAt })) })
      set({ deleted: undefined })
      withCards(deleted)
    },

    dismissDeleted() {
      set({ deleted: undefined })
    },

    async moveCard(id, toIndex) {
      const cards = [...get().cards]
      const fromIndex = cards.findIndex((c) => c.id === id)
      if (fromIndex === -1) return
      const [moved] = cards.splice(fromIndex, 1)
      cards.splice(Math.max(0, Math.min(toIndex, cards.length)), 0, moved)
      const renumbered = cards.map((c, i) => (c.sortIndex === i ? c : { ...c, sortIndex: i }))
      set({ cards: renumbered })
      // the order alone: the text is as stored, or the editor's to save
      const changed = renumbered.filter((c, i) => c !== cards[i])
      await getServices().store.write({
        updateCards: changed.map((c) => ({ id: c.id, sortIndex: c.sortIndex })),
      })
    },

    async restoreSamples() {
      await seedSamples(getServices().store, true)
      await get().reloadFromStore()
    },

    reloadFromStore(changes) {
      if (waiting) {
        waiting.changes = merged(waiting.changes, changes)
        return waiting.done
      }
      const next: { changes?: Changes; done: Promise<void> } = { changes, done: reading }
      next.done = reading.then(() => {
        waiting = undefined
        return readBack(next.changes)
      })
      waiting = next
      // the read after waits for this one, whether or not it fails
      reading = next.done.catch(() => {})
      return next.done
    },

    async markExported() {
      await getServices().store.write({ meta: { dirtySinceExport: false } })
      set({ dirtySinceExport: false })
    },

    async importArt(files, confirmReplace) {
      const { store } = getServices()
      const fresh: typeof files = []
      const replacing: typeof files = []
      for (const file of files) {
        const stored = await store.getArt(file.name)
        if (!stored) fresh.push(file)
        else if (!(await sameBytes(stored.blob, file.blob))) replacing.push(file)
      }
      const replace = replacing.length > 0 && confirmReplace(replacing.map((f) => f.name))
      const storing = replace ? [...fresh, ...replacing] : fresh
      if (storing.length === 0) return
      const updatedAt = Date.now()
      await store.write({
        putArt: storing.map(({ name, blob }) => ({
          name,
          blob,
          mime: blob.type,
          size: blob.size,
          updatedAt,
        })),
      })
    },

    async deleteArt(name) {
      await getServices().store.write({ deleteArt: [name] })
    },

    async renameArt(from, to) {
      const { store } = getServices()
      const stored = await store.getArt(from)
      // never onto another file: that would replace its image
      if (!stored || (await store.getArt(to))) return
      const renamed = get()
        .cards.filter((c) => artFileOf(c.yamlText) === from)
        .map((c) => ({ ...c, yamlText: withArtFile(c.yamlText, to) }))
      const updatedAt = Date.now()
      await store.write({
        deleteArt: [from],
        putArt: [{ ...stored, name: to }],
        updateCards: renamed.map(({ id, name, yamlText }) => ({ id, name, yamlText, updatedAt })),
        meta: renamed.length > 0 ? { dirtySinceExport: true } : undefined,
      })
      withCards(renamed)
      set((s) => ({ dirtySinceExport: s.dirtySinceExport || renamed.length > 0 }))
    },

    setPage(page) {
      set({ page })
    },

    setArtManagerOpen(open) {
      set({ artManagerOpen: open })
    },

    setExportDialogOpen(open) {
      set({ exportDialogOpen: open })
    },
  }
})
