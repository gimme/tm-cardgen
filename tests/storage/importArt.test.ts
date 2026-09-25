import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { ArtCache } from '../../src/app/services/artCache.ts'
import { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'
import { setServices } from '../../src/app/store/services.ts'
import { useStore } from '../../src/app/store/useStore.ts'
import { testFonts } from '../helpers/fonts.ts'

/** decoding needs a DOM; what reaches the cache is all these tests look at */
class RecordingCache extends ArtCache {
  set: string[] = []
  override setBlob(file: string): Promise<void> {
    this.set.push(file)
    return Promise.resolve()
  }
}

const png = (text: string) => new Blob([text], { type: 'image/png' })

it('a same-name upload replaces a stored image only on a yes, and the same image never asks', async () => {
  const store = await IdbProjectStore.open('test-db-' + Math.random())
  const art = new RecordingCache()
  setServices({ fonts: testFonts(), art, store })
  const asked: string[][] = []
  const answer = (yes: boolean) => (names: string[]) => {
    asked.push(names)
    return yes
  }
  const stored = async (name: string) => (await store.getArt(name))?.blob.text()
  const { importArt } = useStore.getState()

  // nothing stored yet: no question
  await importArt([{ name: 'dust.png', blob: png('dust') }], answer(false))
  expect(asked).toEqual([])
  expect(await stored('dust.png')).toBe('dust')

  // the same image again is nothing new; a no keeps the old image but lets the rest in
  art.set = []
  await importArt(
    [
      { name: 'dust.png', blob: png('dust') },
      { name: 'sky.png', blob: png('sky') },
    ],
    answer(false),
  )
  expect(asked).toEqual([])
  expect(art.set).toEqual(['sky.png'])

  await importArt(
    [
      { name: 'dust.png', blob: png('rust') },
      { name: 'moon.png', blob: png('moon') },
    ],
    answer(false),
  )
  expect(asked).toEqual([['dust.png']])
  expect(await stored('dust.png')).toBe('dust')
  expect(await stored('moon.png')).toBe('moon')

  // a yes replaces it
  await importArt([{ name: 'dust.png', blob: png('rust') }], answer(true))
  expect(await stored('dust.png')).toBe('rust')
})
