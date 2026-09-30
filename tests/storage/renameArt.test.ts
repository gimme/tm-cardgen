import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { useStore } from '../../src/app/store/useStore.ts'
import { openApp, settled } from '../helpers/app.ts'

it('renaming an art file takes the cards naming it along', async () => {
  const { store, art } = await openApp()

  const card = (id: string, sortIndex: number, art: string) =>
    store.putCard({ id, name: id, yamlText: `name: ${id}\n${art}`, sortIndex, updatedAt: 1 })
  await card('open', 0, 'art: { file: dust.png, zoom: 1.2 } # keep me\n')
  await card('other', 1, 'art: "dust.png"\n')
  await card('elsewhere', 2, 'art: sky.png\n')
  const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
  await store.putArt({ name: 'dust.png', blob, mime: 'image/png', size: 1 })

  await useStore.getState().reloadFromStore()
  expect(useStore.getState().currentId).toBe('open')

  await useStore.getState().renameArt('dust.png', 'red dust, v2.png')

  const open = 'name: open\nart: { file: "red dust, v2.png", zoom: 1.2 } # keep me\n'
  const state = useStore.getState()
  expect(state.cards.map((c) => c.yamlText)).toEqual([
    open,
    'name: other\nart: "red dust, v2.png"\n',
    'name: elsewhere\nart: sky.png\n',
  ])
  // the open card's editor text follows
  expect(state.text).toBe(open)
  expect(state.dirtySinceExport).toBe(true)

  expect((await store.listCards()).map((c) => c.yamlText)).toEqual(
    state.cards.map((c) => c.yamlText),
  )
  expect((await store.listArt()).map((a) => a.name)).toEqual(['red dust, v2.png'])
  // and the cache, reading storage back
  await settled()
  expect(art.files()).toEqual(['red dust, v2.png'])

  // a name already taken is refused: both files and every card stay as they were
  await store.putArt({ name: 'sky.png', blob: new Blob(['sky']), mime: 'image/png', size: 3 })
  await useStore.getState().renameArt('red dust, v2.png', 'sky.png')
  expect((await store.listArt()).map((a) => a.name)).toEqual(['red dust, v2.png', 'sky.png'])
  expect(await (await store.getArt('sky.png'))!.blob.text()).toBe('sky')
  expect(useStore.getState().cards.map((c) => c.yamlText)).toEqual(
    state.cards.map((c) => c.yamlText),
  )

  // a file no open card names leaves the editor alone
  await useStore.getState().renameArt('sky.png', 'night.png')
  expect(useStore.getState().text).toBe(open)
  expect(useStore.getState().cards[2].yamlText).toBe('name: elsewhere\nart: night.png\n')
})
