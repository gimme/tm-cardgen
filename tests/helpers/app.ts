// The app's services on a fresh store, wired as startup wires them: what a
// write changes is read back into the state. Another tab's writes are those
// made on the store returned, followed by reloadFromStore of what they changed.
import { ArtCache } from '../../src/app/services/artCache.ts'
import { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'
import { shared } from '../../src/app/storage/tabSync.ts'
import { setServices } from '../../src/app/store/services.ts'
import { useStore } from '../../src/app/store/useStore.ts'
import { testFonts } from './fonts.ts'

/** an art cache taking any blob for a 1 × 1 image, since decoding needs a
 *  DOM, except under a name in `broken`, and noting each file it loads */
export class TestArtCache extends ArtCache {
  loaded: string[] = []
  broken = new Set<string>()

  override setBlob(file: string, blob: Blob, version?: number): Promise<void> {
    if (this.broken.has(file)) return Promise.reject(new Error('could not decode image'))
    this.loaded.push(file)
    return super.setBlob(file, blob, version)
  }

  protected override decode() {
    return Promise.resolve({ w: 1, h: 1 })
  }
}

export async function openApp(): Promise<{ store: IdbProjectStore; art: TestArtCache }> {
  const store = await IdbProjectStore.open('test-db-' + Math.random())
  const art = new TestArtCache()
  setServices({
    fonts: testFonts(),
    art,
    store: shared(store, (changes) => void useStore.getState().reloadFromStore(changes)),
  })
  return { store, art }
}

/** once every read of storage asked for so far is in */
export const settled = () => useStore.getState().reloadFromStore({})
