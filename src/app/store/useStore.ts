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
import { newCardId, nextSortIndex, type StoredCard } from '../storage/ProjectStore.ts'
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
  /** the cards the export dialog was opened for, a selection in the gallery;
   *  every card when none */
  exportIds?: readonly string[]
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
  /** a copy of the card, right after it, which opens */
  duplicateCard(id: string): Promise<void>
  deleteCards(ids: string[]): Promise<void>
  /** the cards the last delete took, back in their places, after a card
   *  that has come to one since */
  undoDelete(): Promise<void>
  dismissDeleted(): void
  /** the cards, in the order they show, together at `toIndex` among the
   *  cards left once they are taken out */
  moveCards(ids: readonly string[], toIndex: number): Promise<void>
  restoreSamples(): Promise<void>
  /** Storage read back into the state: the cards and the meta, and the images
   *  into the art cache unless `changes` says none changed. The current card
   *  keeps text typed here and not yet saved; with it gone, the last one open
   *  or the first opens. One read at a time, in order: those asked for while
   *  one runs wait for it, as one. */
  reloadFromStore(changes?: Changes): Promise<void>
  /** the project was just backed up */
  markExported(): Promise<void>

  /** A file already stored under its name is nothing new when the image is the
   *  same, and replaces it only if `confirmReplace`, given those names, says so.
   *  One the browser can't decode is refused: returns their names. */
  importArt(
    files: { name: string; blob: Blob }[],
    confirmReplace: (names: string[]) => boolean,
  ): Promise<string[]>
  deleteArt(name: string): Promise<void>
  /** the cards naming the file follow it; a name already taken is refused */
  renameArt(from: string, to: string): Promise<void>

  setPage(page: AppState['page']): void
  setArtManagerOpen(open: boolean): void
  /** open for the cards `ids` names, or else for every card */
  setExportDialogOpen(open: boolean, ids?: readonly string[]): void
}

/** how the current card's text stands with storage */
export const saveStateOf = (s: AppState): 'saved' | 'saving' | 'error' =>
  s.saveFailed ? 'error' : s.text === s.savedText ? 'saved' : 'saving'

const RECOMPUTE_DELAY = 200
const AUTOSAVE_DELAY = 500
let recomputeTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined

// positions cards were moved to here, by card id, until their write lands
const moving = new Map<string, number>()

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

/** The cards that have to move down for each, in the order given, to come
 *  past the one before it, at their new places: as few as can be, by as
 *  little. */
const makeWay = (cards: readonly CardEntry[]): CardEntry[] => {
  const moved: CardEntry[] = []
  let last = -Infinity
  for (const card of cards) {
    last = Math.max(card.sortIndex, last + 1)
    if (last !== card.sortIndex) moved.push({ ...card, sortIndex: last })
  }
  return moved
}

/** two reads asked for, as one: with the images if either takes them in, and
 *  one given no changes does */
const merged = (a?: Changes, b?: Changes): Changes | undefined =>
  a && b ? { art: a.art || b.art } : undefined

async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
  const v = new Uint8Array(y)
  return new Uint8Array(x).every((byte, i) => byte === v[i])
}

export const useStore = create<AppState>((set, get) => {
  /** A card added at `at` among the cards, at the end unless given, and
   *  opened: one past the card before it, the cards after it moving down
   *  where they are in its way. */
  const addCard = async (name: string, yamlText: string, at = get().cards.length) => {
    const { cards } = get()
    const entry: CardEntry = {
      id: newCardId(),
      name,
      yamlText,
      sortIndex: nextSortIndex(cards.slice(0, at)),
    }
    const moved = makeWay(cards.toSpliced(at, 0, entry))
    await getServices().store.write({
      putCards: [{ ...entry, updatedAt: Date.now() }],
      // the order alone: the text is as stored, or the editor's to save
      updateCards: moved.map(({ id, sortIndex }) => ({ id, sortIndex })),
    })
    withCards([entry, ...moved])
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

  /** Storage's images into the art cache. One stored since the cache last saw
   *  it, new or replaced, is decoded; the rest are left alone, told by their
   *  version. One the browser can't decode is left out, as if it were missing,
   *  rather than failing the whole read. Returns whether the cache changed,
   *  and the names it holds that storage no longer does: those are for the
   *  caller to drop, after the cards. */
  const loadImages = async (): Promise<{ changed: boolean; gone: string[] }> => {
    const { store, art } = getServices()
    const stored = await store.listArt()
    let changed = false
    for (const image of stored) {
      const cached = art.entry(image.name)
      if (cached && cached.version === image.updatedAt) continue
      try {
        await art.setBlob(image.name, image.blob, image.updatedAt)
        changed = true
      } catch {
        if (cached) {
          art.remove(image.name)
          changed = true
        }
      }
    }
    const names = new Set(stored.map((image) => image.name))
    return { changed, gone: art.files().filter((name) => !names.has(name)) }
  }

  /** Storage's cards and meta into the state, applied in the same step the
   *  read returns. */
  const loadCards = async () => {
    const { store } = getServices()
    const [stored, meta] = await Promise.all([store.listCards(), store.getMeta()])
    const { cards: mine, currentId, text, savedText } = get()
    // Text typed into the open card and not yet saved wins over what storage
    // has for it: its own save is still to come. Taking storage's text here
    // would throw the typing away.
    const typing = text === savedText ? undefined : currentId
    const here = new Map(mine.map((c) => [c.id, c]))
    const next = stored
      .map((card) => {
        const held = here.get(card.id)
        // likewise a card moved here whose new place isn't stored yet: taking
        // storage's would put it back where it was dragged from
        const sortIndex = moving.get(card.id) ?? card.sortIndex
        const entry = { ...(card.id === typing && held ? held : toEntry(card)), sortIndex }
        // a card that hasn't changed stays the same object, so that views of
        // it don't draw again
        return held && sameCard(held, entry) ? held : entry
      })
      .sort(bySortIndex)
    if (next.length !== mine.length || next.some((c, i) => c !== mine[i])) {
      setCards(next, meta.lastOpenCardId)
    }
    // The typing kept is unsaved against what storage has now, which another
    // tab may have changed. Measured against the older text, typing that
    // happens to match it would count as saved and never be stored.
    const kept = typing === undefined ? undefined : stored.find((c) => c.id === typing)
    if (kept && kept.yamlText !== savedText) set({ savedText: kept.yamlText })
    const dirty = meta.dirtySinceExport ?? false
    if (dirty !== get().dirtySinceExport) set({ dirtySinceExport: dirty })
  }

  /** Storage into the state and the art cache, in an order that keeps what is
   *  on screen whole:
   *  - New images load before the cards, and images gone are dropped after
   *    them, so that no card shown names an image the cache lacks.
   *  - The cards are read only once the images have loaded, which can take a
   *    while. Read before, they could be older than a save made here in the
   *    meantime, and applying them would take that save back. */
  const readBack = async (changes: Changes | undefined) => {
    const images = !changes || changes.art ? await loadImages() : undefined
    await loadCards()
    if (!images) return
    for (const name of images.gone) getServices().art.remove(name)
    if (images.changed || images.gone.length > 0) set((s) => ({ artVersion: s.artVersion + 1 }))
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
      const at = cards.findIndex((c) => c.id === sourceId)
      if (at === -1) return
      const source = cards[at]
      const name = copyName(
        source.name,
        cards.map((c) => c.name),
      )
      await addCard(name, withName(source.yamlText, name), at + 1)
    },

    async deleteCards(ids) {
      const gone = get().cards.filter((c) => ids.includes(c.id))
      if (gone.length === 0) return
      await getServices().store.write({ deleteCards: gone.map((c) => c.id) })
      set({ deleted: gone })
      dropCards(ids)
    },

    async undoDelete() {
      const { deleted, cards } = get()
      if (!deleted) return
      // A card added since moves the cards after it down, maybe into one of
      // their places: each goes after a card in its place, stored so, or
      // storage would order the two its own way.
      const moved = makeWay([...cards, ...deleted].sort(bySortIndex))
      const updatedAt = Date.now()
      await getServices().store.write({
        putCards: deleted.map((c) => ({ ...c, updatedAt })),
        // the order alone, after the puts: the text is as stored, or the
        // editor's to save
        updateCards: moved.map(({ id, sortIndex }) => ({ id, sortIndex })),
      })
      set({ deleted: undefined })
      withCards([...deleted, ...moved])
    },

    dismissDeleted() {
      set({ deleted: undefined })
    },

    async moveCards(ids, toIndex) {
      const all = get().cards
      const moved = all.filter((c) => ids.includes(c.id))
      if (moved.length === 0) return
      const cards = all.filter((c) => !ids.includes(c.id))
      cards.splice(Math.max(0, Math.min(toIndex, cards.length)), 0, ...moved)
      const renumbered = cards.map((c, i) => (c.sortIndex === i ? c : { ...c, sortIndex: i }))
      // the order alone: the text is as stored, or the editor's to save
      const moves = renumbered
        .filter((c, i) => c !== cards[i])
        .map((c) => ({ id: c.id, sortIndex: c.sortIndex }))
      // shown at once, and held against reads of storage until it is stored
      for (const m of moves) moving.set(m.id, m.sortIndex)
      set({ cards: renumbered })
      try {
        await getServices().store.write({ updateCards: moves })
      } finally {
        // unless a later move has taken the card elsewhere since
        for (const m of moves) if (moving.get(m.id) === m.sortIndex) moving.delete(m.id)
      }
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
      const { store, art } = getServices()
      const fresh: typeof files = []
      const replacing: typeof files = []
      const refused: string[] = []
      for (const file of files) {
        if (!(await art.decodes(file.blob))) {
          refused.push(file.name)
          continue
        }
        const stored = await store.getArt(file.name)
        if (!stored) fresh.push(file)
        else if (!(await sameBytes(stored.blob, file.blob))) replacing.push(file)
      }
      const replace = replacing.length > 0 && confirmReplace(replacing.map((f) => f.name))
      const storing = replace ? [...fresh, ...replacing] : fresh
      if (storing.length === 0) return refused
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
      return refused
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
        // a version of its own under the new name, which may have held
        // another image of the same version
        putArt: [{ ...stored, name: to, updatedAt }],
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

    setExportDialogOpen(open, ids) {
      set({ exportDialogOpen: open, exportIds: open ? ids : undefined })
    },
  }
})
