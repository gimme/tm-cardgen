import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { useStore } from '../../src/app/store/useStore.ts'
import { openApp, settled } from '../helpers/app.ts'

const png = (text: string) => new Blob([text], { type: 'image/png' })

it('a same-name upload replaces a stored image only on a yes, and the same image never asks', async () => {
  const { store, art } = await openApp()
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
  await settled()
  art.loaded = []
  await importArt(
    [
      { name: 'dust.png', blob: png('dust') },
      { name: 'sky.png', blob: png('sky') },
    ],
    answer(false),
  )
  expect(asked).toEqual([])
  await settled()
  expect(art.loaded).toEqual(['sky.png'])

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
