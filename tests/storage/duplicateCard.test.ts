import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { useStore } from '../../src/app/store/useStore.ts'
import { openApp, settled } from '../helpers/app.ts'

it('puts a copy right after its card, moving down only the cards in its way', async () => {
  const { store } = await openApp()
  // room after c, as a delete leaves
  for (const [id, sortIndex] of [
    ['a', 0],
    ['b', 1],
    ['c', 2],
    ['d', 5],
  ] as const) {
    await store.write({
      putCards: [{ id, name: id, yamlText: `name: ${id}\n`, sortIndex, updatedAt: 1 }],
    })
  }
  await useStore.getState().reloadFromStore()
  const names = () => useStore.getState().cards.map((c) => c.name)
  const stored = async () => (await store.listCards()).map((c) => [c.name, c.sortIndex])

  await useStore.getState().duplicateCard('a')
  expect(names()).toEqual(['a', 'a (1)', 'b', 'c', 'd'])
  const { cards, currentId } = useStore.getState()
  expect(cards.find((c) => c.id === currentId)?.name).toBe('a (1)')
  expect(await stored()).toEqual([
    ['a', 0],
    ['a (1)', 1],
    ['b', 2],
    ['c', 3],
    ['d', 5],
  ])

  // the last card's last
  await useStore.getState().duplicateCard('d')
  await settled()
  expect(names()).toEqual(['a', 'a (1)', 'b', 'c', 'd', 'd (1)'])
  expect((await stored()).map(([name]) => name)).toEqual(names())
})
