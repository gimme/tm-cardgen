// App startup: fonts, the store, the art cache, then the cards.
import { loadFonts } from './services/assetService.ts'
import { ArtCache } from './services/artCache.ts'
import { IdbProjectStore } from './storage/IdbProjectStore.ts'
import { seedSamples } from './storage/seed.ts'
import { setServices } from './store/services.ts'
import { useStore } from './store/useStore.ts'

export async function initApp(): Promise<void> {
  const [fonts, store] = await Promise.all([loadFonts(), IdbProjectStore.open()])
  await seedSamples(store)

  // ask the browser not to evict storage
  void navigator.storage?.persist?.()

  const art = new ArtCache()
  for (const stored of await store.listArt()) {
    await art.setBlob(stored.name, stored.blob)
  }

  setServices({ fonts, art, store })
  art.subscribe(() => useStore.getState().recompute())

  await useStore.getState().reloadFromStore()
  useStore.setState({ status: 'ready' })

  // a file dropped outside the art panel would otherwise open in the tab
  const swallowFileDrop = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  }
  window.addEventListener('dragover', swallowFileDrop)
  window.addEventListener('drop', swallowFileDrop)

  // autosave flush on tab switch / close
  const flush = () => void useStore.getState().flushSave()
  window.addEventListener('blur', flush)
  document.addEventListener('visibilitychange', flush)

  // Ctrl/Cmd-S flushes the autosave instead of opening the browser's save dialog
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's') return
    e.preventDefault()
    const state = useStore.getState()
    if (state.currentId === undefined) return
    state.recompute()
    void state.flushSave()
  })
}
