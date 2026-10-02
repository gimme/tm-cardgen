import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { useStore } from '../../src/app/store/useStore.ts'
import { openApp, settled } from '../helpers/app.ts'

it('moves cards together, in the order they show, to a place among the rest', async () => {
  const { store } = await openApp()
  for (const [i, id] of ['a', 'b', 'c', 'd', 'e'].entries()) {
    await store.write({
      putCards: [{ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 }],
    })
  }
  await useStore.getState().reloadFromStore()
  const ids = () => useStore.getState().cards.map((c) => c.id)

  // given out of order, they keep the order they had
  const moving = useStore.getState().moveCards(['d', 'a'], 1)
  expect(ids()).toEqual(['b', 'a', 'd', 'c', 'e'])
  await moving
  await settled()
  expect(ids()).toEqual(['b', 'a', 'd', 'c', 'e'])
  expect((await store.listCards()).map((c) => c.id)).toEqual(['b', 'a', 'd', 'c', 'e'])

  // past the end, after the last
  await useStore.getState().moveCards(['b', 'c'], 9)
  expect(ids()).toEqual(['a', 'd', 'e', 'b', 'c'])
  expect((await store.listCards()).map((c) => c.id)).toEqual(['a', 'd', 'e', 'b', 'c'])
})
