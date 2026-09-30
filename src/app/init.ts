// App startup: fonts, the store, then the art and the cards read from it.
import { loadFonts } from './services/assetService.ts'
import { ArtCache } from './services/artCache.ts'
import { IdbProjectStore } from './storage/IdbProjectStore.ts'
import { seedSamples } from './storage/seed.ts'
import { joinTabs, shared, type Changes } from './storage/tabSync.ts'
import { startRouter } from './router.ts'
import { setServices } from './store/services.ts'
import { useStore } from './store/useStore.ts'

export async function initApp(): Promise<void> {
  let leaveTabs = () => {}
  const [fonts, idb] = await Promise.all([
    loadFonts(),
    IdbProjectStore.open(undefined, {
      blocked: () => useStore.setState({ versionClash: 'waiting' }),
      // what's typed is saved before this tab makes way for the newer one
      async outdated() {
        leaveTabs()
        await useStore.getState().flushSave()
        useStore.setState({ versionClash: 'outdated' })
      },
    }),
  ])
  if (useStore.getState().versionClash === 'waiting') useStore.setState({ versionClash: undefined })
  await seedSamples(idb)

  // ask the browser not to evict storage
  void navigator.storage?.persist?.()

  // what a write changes is read back from storage, into this tab and, once
  // it has joined, every other tab of the app: each tab's state follows it
  const readBack = (changes: Changes) => void useStore.getState().reloadFromStore(changes)
  const art = new ArtCache()
  setServices({ fonts, art, store: shared(idb, readBack) })
  art.subscribe(() => useStore.getState().recompute())

  // joined before the first read, which the other tabs' writes then wait
  // behind, so that none landing after it goes unread
  leaveTabs = joinTabs(readBack)
  await useStore.getState().reloadFromStore()
  // read again on coming back into view or out of the back-forward cache, for
  // any write this tab missed while the browser froze it
  const catchUp = () => {
    if (useStore.getState().versionClash !== 'outdated') void useStore.getState().reloadFromStore()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') catchUp()
  })
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) catchUp()
  })
  startRouter()
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
