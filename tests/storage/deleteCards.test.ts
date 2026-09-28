import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { ArtCache } from '../../src/app/services/artCache.ts'
import { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'
import { setServices } from '../../src/app/store/services.ts'
import { useStore } from '../../src/app/store/useStore.ts'
import { testFonts } from '../helpers/fonts.ts'

it('deleting cards can be undone, back in their places', async () => {
  const store = await IdbProjectStore.open('test-db-' + Math.random())
  setServices({ fonts: testFonts(), art: new ArtCache(), store })
  for (const [i, id] of ['a', 'b', 'c', 'd'].entries()) {
    await store.putCard({ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 })
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
