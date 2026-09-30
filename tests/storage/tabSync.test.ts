import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import type { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'
import { joinTabs, type Changes } from '../../src/app/storage/tabSync.ts'
import { saveStateOf, useStore } from '../../src/app/store/useStore.ts'
import { openApp, settled, type TestArtCache } from '../helpers/app.ts'

const fresh = useStore.getState()
let store: IdbProjectStore
let art: TestArtCache

/** the app on a store holding a card for each id, `name: <id>`, on the first */
async function open(...ids: string[]) {
  ;({ store, art } = await openApp())
  for (const [i, id] of ids.entries()) {
    await store.putCard({ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 })
  }
  await useStore.getState().reloadFromStore()
}

const card = (id: string) => useStore.getState().cards.find((c) => c.id === id)
const ids = () => useStore.getState().cards.map((c) => c.id)
const reload = (changes?: Changes) => useStore.getState().reloadFromStore(changes)
const png = (text: string) => new Blob([text], { type: 'image/png' })
const saveState = () => saveStateOf(useStore.getState())

beforeEach(() => useStore.setState(fresh, true))

it('a write, once it has landed, is announced to the other tabs by what it changed', async () => {
  await open('a')
  const leave = joinTabs(() => {})
  const other = new BroadcastChannel('tm-cardgen')
  const heard: Changes[] = []
  let hear = () => {}
  other.onmessage = (e: MessageEvent<Changes>) => {
    heard.push(e.data)
    hear()
  }
  try {
    const cards = () => heard.filter((changes) => changes.cards)
    // typing is not a write
    useStore.getState().updateText('name: a\ncost: 3\n')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(cards()).toEqual([])

    await useStore.getState().flushSave()
    while (cards().length === 0) await new Promise<void>((resolve) => (hear = resolve))
    expect(cards()).toEqual([{ cards: ['a'] }])
    expect((await store.getCard('a'))?.yamlText).toBe('name: a\ncost: 3\n')
  } finally {
    other.close()
    leave()
  }
})

it("another tab's writes are read back: edits, new cards, moves and deletes", async () => {
  await open('a', 'b', 'c')
  await store.updateCards([{ id: 'a', name: 'A', yamlText: 'name: A\n' }])
  await store.putCard({ id: 'd', name: 'd', yamlText: 'name: d\n', sortIndex: 3, updatedAt: 1 })
  await store.updateCards([{ id: 'c', sortIndex: -1 }])
  await store.deleteCard('b')
  await reload({ cards: ['a', 'd', 'c', 'b'] })
  expect(ids()).toEqual(['c', 'a', 'd'])
  // the open card's text with them, for the editor to follow
  expect(card('a')?.name).toBe('A')
  expect(useStore.getState().text).toBe('name: A\n')

  // the open card deleted, the first opens
  await store.deleteCard('a')
  await reload({ cards: ['a'] })
  expect(useStore.getState().currentId).toBe('c')
  expect(useStore.getState().text).toBe('name: c\n')
})

it('the open card keeps text typed here and not yet saved, until its own save', async () => {
  await open('a')
  useStore.getState().updateText('name: a\n# here\n')
  await store.updateCards([{ id: 'a', yamlText: 'name: a\n# there\n' }])
  await reload({ cards: ['a'] })
  expect(useStore.getState().text).toBe('name: a\n# here\n')

  await useStore.getState().flushSave()
  expect((await store.getCard('a'))?.yamlText).toBe('name: a\n# here\n')
})

it('the card opening after one with unsaved text is deleted takes outside edits', async () => {
  await open('a', 'b')
  useStore.getState().updateText('name: a\n# here\n')
  // deleted in another tab, and here, before the autosave
  await store.deleteCard('a')
  await reload({ cards: ['a'] })
  expect(useStore.getState().currentId).toBe('b')
  expect(saveState()).toBe('saved')

  await store.updateCards([{ id: 'b', yamlText: 'name: b\ncost: 9\n' }])
  await reload({ cards: ['b'] })
  expect(useStore.getState().text).toBe('name: b\ncost: 9\n')

  useStore.getState().updateText('name: b\ncost: 9\n# here\n')
  await useStore.getState().deleteCards(['b'])
  expect(saveState()).toBe('saved')
})

it('reading everything back drops what is no longer stored and takes in what is new', async () => {
  await open('a', 'b')
  await store.deleteCard('b')
  await store.putCard({ id: 'c', name: 'c', yamlText: 'name: c\n', sortIndex: 2, updatedAt: 1 })
  await store.setMeta({ dirtySinceExport: true })
  await reload()
  expect(ids()).toEqual(['a', 'c'])
  expect(useStore.getState().dirtySinceExport).toBe(true)
})

it('reads asked for while one runs wait for it, as one', async () => {
  await open('a', 'b')
  const first = reload({ cards: ['a'] })
  // the first under way
  await new Promise((resolve) => setTimeout(resolve, 0))
  await store.updateCards([{ id: 'b', yamlText: 'name: b\ncost: 2\n' }])
  await store.putCard({ id: 'c', name: 'c', yamlText: 'name: c\n', sortIndex: 2, updatedAt: 1 })
  const second = reload({ cards: ['b'] })
  // everything, taking in the one waiting
  const third = reload()
  expect(third).toBe(second)
  expect(second).not.toBe(first)

  await third
  expect(card('b')?.yamlText).toBe('name: b\ncost: 2\n')
  expect(ids()).toEqual(['a', 'b', 'c'])
})

it('images are read back by version: one stored anew or since changed loads, one gone goes', async () => {
  await open('a')
  await store.putArt({ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 })
  const version = useStore.getState().artVersion
  await reload({ art: ['x.png'] })
  expect(art.loaded).toEqual(['x.png'])
  expect(useStore.getState().artVersion).toBe(version + 1)

  // the same version, asked for or with everything, is left be
  await reload({ art: ['x.png'] })
  await reload()
  expect(art.loaded).toEqual(['x.png'])
  expect(useStore.getState().artVersion).toBe(version + 1)

  await store.putArt({ name: 'x.png', blob: png('y'), mime: 'image/png', size: 1, updatedAt: 2 })
  await reload()
  expect(art.loaded).toEqual(['x.png', 'x.png'])

  await store.deleteArt('x.png')
  await reload({ art: ['x.png'] })
  expect(art.files()).toEqual([])
})

it("an image that won't decode is left out, as if missing, and the rest is read", async () => {
  await open('a')
  await store.putArt({ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 })
  await reload()
  expect(art.files()).toEqual(['x.png'])

  art.broken.add('x.png')
  await store.putArt({ name: 'x.png', blob: png('y'), mime: 'image/png', size: 1, updatedAt: 2 })
  await store.putArt({ name: 'z.heic', blob: png('z'), mime: 'image/heic', size: 1, updatedAt: 2 })
  art.broken.add('z.heic')
  await store.updateCards([{ id: 'a', yamlText: 'name: a\ncost: 4\n' }])
  await reload()
  expect(art.files()).toEqual([])
  expect(useStore.getState().text).toBe('name: a\ncost: 4\n')
})

it('typing while a save is stored leaves the newer text to save', async () => {
  await open('a')
  useStore.getState().updateText('name: a\n# one\n')
  const saving = useStore.getState().flushSave()
  useStore.getState().updateText('name: a\n# two\n')
  await saving
  expect(saveState()).toBe('saving')

  await useStore.getState().flushSave()
  expect(saveState()).toBe('saved')
  await settled()
  expect((await store.getCard('a'))?.yamlText).toBe('name: a\n# two\n')
  expect(useStore.getState().text).toBe('name: a\n# two\n')
})

it('a move stores the order alone, so it never takes back text another tab stored', async () => {
  await open('a', 'b')
  await store.updateCards([{ id: 'b', yamlText: 'name: b\ncost: 5\n' }])
  await useStore.getState().moveCard('b', 0)
  expect(ids()).toEqual(['b', 'a'])
  expect(await store.getCard('b')).toMatchObject({ yamlText: 'name: b\ncost: 5\n', sortIndex: 0 })
  // and the move's own read back takes that text in
  await settled()
  expect(card('b')?.yamlText).toBe('name: b\ncost: 5\n')
})
