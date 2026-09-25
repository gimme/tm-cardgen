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
import { nextSortIndex, type StoredCard } from '../storage/ProjectStore.ts'
import { seedSamples } from '../storage/seed.ts'
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
  /** editor text of the current card (authoritative while editing) */
  text: string
  /** bumps when `text` is replaced from outside the editor, so the editor rebuilds */
  textEpoch: number
  /** last successfully laid-out card (never blanks mid-keystroke) */
  layout?: CardLayout
  /** true while the text no longer produces a valid layout */
  stale: boolean
  diagnostics: Diagnostic[]
  saveState: 'saved' | 'saving' | 'error'
  artManagerOpen: boolean
  exportDialogOpen: boolean
  /** bumps when art changes, so views depending on the art cache refresh */
  artVersion: number
  /** changes since the last zip export; drives the backup nudge */
  dirtySinceExport: boolean

  selectCard(id: string): void
  updateText(text: string): void
  recompute(): void
  flushSave(): Promise<void>

  newCard(): Promise<void>
  duplicateCard(id: string): Promise<void>
  deleteCard(id: string): Promise<void>
  moveCard(id: string, toIndex: number): Promise<void>
  restoreSamples(): Promise<void>
  /** cards and the dirty flag from the store; keeps the current card, else
   *  opens the last one open or the first */
  reloadFromStore(): Promise<void>
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

  setArtManagerOpen(open: boolean): void
  setExportDialogOpen(open: boolean): void
}

const RECOMPUTE_DELAY = 200
const AUTOSAVE_DELAY = 500
let recomputeTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined

const toEntry = ({ id, name, yamlText, sortIndex }: StoredCard): CardEntry => ({
  id,
  name,
  yamlText,
  sortIndex,
})

async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
  const v = new Uint8Array(y)
  return new Uint8Array(x).every((byte, i) => byte === v[i])
}

export const useStore = create<AppState>((set, get) => {
  const addCard = async (name: string, yamlText: string) => {
    const { cards } = get()
    const entry: CardEntry = {
      id: `card-${crypto.randomUUID()}`,
      name,
      yamlText,
      sortIndex: nextSortIndex(cards),
    }
    await getServices().store.putCard({ ...entry, updatedAt: Date.now() })
    set({ cards: [...cards, entry] })
    get().selectCard(entry.id)
  }

  /** the card, or nothing when there is none */
  const show = (id: string | undefined) => {
    if (id !== undefined) get().selectCard(id)
    else set({ currentId: undefined, text: '', layout: undefined, stale: false })
  }

  return {
    status: 'loading',
    cards: [],
    text: '',
    textEpoch: 0,
    stale: false,
    diagnostics: [],
    saveState: 'saved',
    artManagerOpen: false,
    exportDialogOpen: false,
    artVersion: 0,
    dirtySinceExport: false,

    selectCard(id) {
      const card = get().cards.find((c) => c.id === id)
      if (!card) return
      void get().flushSave()
      set({ currentId: id, text: card.yamlText })
      get().recompute()
      void getServices().store.setMeta({ lastOpenCardId: id })
    },

    updateText(text) {
      const { currentId, cards } = get()
      if (currentId === undefined) return
      const name = extractName(text)
      set({
        text,
        saveState: 'saving',
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
      const { currentId, cards, saveState } = get()
      if (currentId === undefined || saveState === 'saved') return
      const card = cards.find((c) => c.id === currentId)
      if (!card) return
      try {
        await getServices().store.putCard({ ...card, updatedAt: Date.now() })
        await getServices().store.setMeta({ dirtySinceExport: true })
        set({ saveState: 'saved', dirtySinceExport: true })
      } catch {
        set({ saveState: 'error' })
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

    async deleteCard(id) {
      const { cards, currentId } = get()
      await getServices().store.deleteCard(id)
      const remaining = cards.filter((c) => c.id !== id)
      set({ cards: remaining })
      if (currentId === id) show(remaining[0]?.id)
    },

    async moveCard(id, toIndex) {
      const cards = [...get().cards]
      const fromIndex = cards.findIndex((c) => c.id === id)
      if (fromIndex === -1) return
      const [moved] = cards.splice(fromIndex, 1)
      cards.splice(Math.max(0, Math.min(toIndex, cards.length)), 0, moved)
      const renumbered = cards.map((c, i) => ({ ...c, sortIndex: i }))
      set({ cards: renumbered })
      const { store } = getServices()
      for (const c of renumbered) await store.putCard({ ...c, updatedAt: Date.now() })
    },

    async restoreSamples() {
      await seedSamples(getServices().store, true)
      await get().reloadFromStore()
    },

    async reloadFromStore() {
      const { store } = getServices()
      const [stored, meta] = await Promise.all([store.listCards(), store.getMeta()])
      const cards = stored.map(toEntry)
      set((s) => ({
        cards,
        dirtySinceExport: meta.dirtySinceExport ?? false,
        artVersion: s.artVersion + 1,
      }))
      const { currentId } = get()
      if (currentId !== undefined && cards.some((c) => c.id === currentId)) {
        get().recompute()
        return
      }
      const lastOpen = cards.find((c) => c.id === meta.lastOpenCardId)
      show((lastOpen ?? cards[0])?.id)
    },

    async markExported() {
      await getServices().store.setMeta({ dirtySinceExport: false })
      set({ dirtySinceExport: false })
    },

    async importArt(files, confirmReplace) {
      const { store, art } = getServices()
      const fresh: typeof files = []
      const replacing: typeof files = []
      for (const file of files) {
        const stored = await store.getArt(file.name)
        if (!stored) fresh.push(file)
        else if (!(await sameBytes(stored.blob, file.blob))) replacing.push(file)
      }
      const replace = replacing.length > 0 && confirmReplace(replacing.map((f) => f.name))
      for (const { name, blob } of replace ? [...fresh, ...replacing] : fresh) {
        await store.putArt({ name, blob, mime: blob.type, size: blob.size })
        await art.setBlob(name, blob)
      }
      set((s) => ({ artVersion: s.artVersion + 1 }))
    },

    async deleteArt(name) {
      const { store, art } = getServices()
      await store.deleteArt(name)
      art.remove(name)
      set((s) => ({ artVersion: s.artVersion + 1 }))
    },

    async renameArt(from, to) {
      const { store, art } = getServices()
      const stored = await store.getArt(from)
      // never onto another file: that would replace its image
      if (!stored || (await store.getArt(to))) return
      await store.putArt({ ...stored, name: to })
      await store.deleteArt(from)
      const renamed = get()
        .cards.filter((c) => artFileOf(c.yamlText) === from)
        .map((c) => ({ ...c, yamlText: withArtFile(c.yamlText, to) }))
      for (const c of renamed) await store.putCard({ ...c, updatedAt: Date.now() })
      if (renamed.length > 0) await store.setMeta({ dirtySinceExport: true })
      const current = renamed.find((c) => c.id === get().currentId)
      set((s) => ({
        cards: s.cards.map((c) => renamed.find((r) => r.id === c.id) ?? c),
        text: current?.yamlText ?? s.text,
        textEpoch: s.textEpoch + (current ? 1 : 0),
        dirtySinceExport: s.dirtySinceExport || renamed.length > 0,
        artVersion: s.artVersion + 1,
      }))
      // notifies, and the current card lays out again under the new name
      art.rename(from, to)
    },

    setArtManagerOpen(open) {
      set({ artManagerOpen: open })
    },

    setExportDialogOpen(open) {
      set({ exportDialogOpen: open })
    },
  }
})
