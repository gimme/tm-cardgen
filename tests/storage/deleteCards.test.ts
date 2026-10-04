import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { ArtCache } from '../../src/app/services/artCache.ts'
import { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'
import { setServices } from '../../src/app/store/services.ts'
import { useStore } from '../../src/app/store/useStore.ts'
import { openApp, settled } from '../helpers/app.ts'
import { testFonts } from '../helpers/fonts.ts'

it('deleting cards can be undone, back in their places', async () => {
  const store = await IdbProjectStore.open('test-db-' + Math.random())
  setServices({ fonts: testFonts(), art: new ArtCache(), store })
  for (const [i, id] of ['a', 'b', 'c', 'd'].entries()) {
    await store.write({
      putCards: [{ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 }],
    })
  }
  await useStore.getState().reloadFromStore()
  expect(useStore.getState().currentId).toBe('a')

  await useStore.getState().deleteCards(['a', 'c'])
  let state = useStore.getState()
  expect(state.cards.map((c) => c.id)).toEqual(['b', 'd'])
  expect((await store.listCards()).map((c) => c.id)).toEqual(['b', 'd'])
  expect(state.deleted?.map((c) => c.id)).toEqual(['a', 'c'])
  // the open card went, so the next one opens
  expect(state.currentId).toBe('b')

  await state.undoDelete()
  state = useStore.getState()
  expect(state.cards.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  expect((await store.listCards()).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  expect(state.deleted).toBeUndefined()
})

it('a card put back comes after one that a copy has moved into its place since, in storage too', async () => {
  const { store } = await openApp()
  for (const [i, id] of ['d', 'c', 'b', 'a'].entries()) {
    await store.write({
      putCards: [{ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 }],
    })
  }
  await useStore.getState().reloadFromStore()
  await useStore.getState().deleteCards(['b'])
  // c moves down into b's place to make way for the copy
  await useStore.getState().duplicateCard('d')

  await useStore.getState().undoDelete()
  await settled()
  const order = ['d', 'd (1)', 'c', 'b', 'a']
  expect(useStore.getState().cards.map((c) => c.name)).toEqual(order)
  expect((await store.listCards()).map((c) => c.name)).toEqual(order)
})
