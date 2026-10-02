import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'
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
    await store.write({
      putCards: [{ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 }],
    })
  }
  await useStore.getState().reloadFromStore()
}

const card = (id: string) => useStore.getState().cards.find((c) => c.id === id)
const ids = () => useStore.getState().cards.map((c) => c.id)
const reload = (changes?: Changes) => useStore.getState().reloadFromStore(changes)
const png = (text: string) => new Blob([text], { type: 'image/png' })
const heic = (text: string) => new Blob([text], { type: 'image/heic' })
const saveState = () => saveStateOf(useStore.getState())

beforeEach(() => useStore.setState(fresh, true))

/** this tab joined, and another listening: what it hears, and a wait for more */
function listen() {
  const leave = joinTabs(() => {})
  const other = new BroadcastChannel('tm-cardgen')
  const heard: Changes[] = []
  let hear = () => {}
  other.onmessage = (e: MessageEvent<Changes>) => {
    heard.push(e.data)
    hear()
  }
  return {
    heard,
    more: () => new Promise<void>((resolve) => (hear = resolve)),
    close() {
      other.close()
      leave()
    },
  }
}

it('a write, once it has landed, is announced to the other tabs, once', async () => {
  await open('a')
  // behind the write of which card is open, so that it isn't heard below
  await store.getMeta()
  const { heard, more, close } = listen()
  try {
    // typing is not a write
    useStore.getState().updateText('name: a\ncost: 3\n')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(heard).toEqual([])

    await useStore.getState().flushSave()
    while (heard.length === 0) await more()
    await new Promise((resolve) => setTimeout(resolve, 20))
    // the card and the meta it marks as changed since the last export, in
    // one go, and no image for the others to read
    expect(heard).toEqual([{ art: false }])
    expect((await store.getCard('a'))?.yamlText).toBe('name: a\ncost: 3\n')
  } finally {
    close()
  }
})

it('an operation on several records lands, and is announced, as one', async () => {
  await open('a', 'b')
  await store.write({
    updateCards: [{ id: 'b', yamlText: 'name: b\nart: x.png\n' }],
    putArt: [{ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 }],
  })
  await reload()
  const { heard, more, close } = listen()
  try {
    const art = () => heard.filter((changes) => changes.art)
    await useStore.getState().renameArt('x.png', 'y.png')
    while (art().length === 0) await more()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(art()).toEqual([{ art: true }])
  } finally {
    close()
  }
})

it("another tab's writes are read back: edits, new cards, moves and deletes", async () => {
  await open('a', 'b', 'c')
  await store.write({ updateCards: [{ id: 'a', name: 'A', yamlText: 'name: A\n' }] })
  await store.write({
    putCards: [{ id: 'd', name: 'd', yamlText: 'name: d\n', sortIndex: 3, updatedAt: 1 }],
  })
  await store.write({ updateCards: [{ id: 'c', sortIndex: -1 }] })
  await store.write({ deleteCards: ['b'] })
  await reload({ art: false })
  expect(ids()).toEqual(['c', 'a', 'd'])
  // the open card's text with them, for the editor to follow
  expect(card('a')?.name).toBe('A')
  expect(useStore.getState().text).toBe('name: A\n')

  // the open card deleted, the first opens
  await store.write({ deleteCards: ['a'] })
  await reload({ art: false })
  expect(useStore.getState().currentId).toBe('c')
  expect(useStore.getState().text).toBe('name: c\n')
})

it('the open card keeps text typed here and not yet saved, until its own save', async () => {
  await open('a')
  useStore.getState().updateText('name: a\n# here\n')
  await store.write({ updateCards: [{ id: 'a', yamlText: 'name: a\n# there\n' }] })
  await reload({ art: false })
  expect(useStore.getState().text).toBe('name: a\n# here\n')

  await useStore.getState().flushSave()
  expect((await store.getCard('a'))?.yamlText).toBe('name: a\n# here\n')
})

it('text kept here is told from what storage has since, so typing undone back saves', async () => {
  await open('a')
  useStore.getState().updateText('name: a\n# here\n')
  await store.write({ updateCards: [{ id: 'a', yamlText: 'name: a\n# there\n' }] })
  await reload({ art: false })
  // typed into what storage has, it is saved
  useStore.getState().updateText('name: a\n# there\n')
  expect(saveState()).toBe('saved')

  // the typing undone, back to the text before it
  useStore.getState().updateText('name: a\n')
  expect(saveState()).toBe('saving')
  await useStore.getState().flushSave()
  expect((await store.getCard('a'))?.yamlText).toBe('name: a\n')
})

it('the card opening after one with unsaved text is deleted takes outside edits', async () => {
  await open('a', 'b')
  useStore.getState().updateText('name: a\n# here\n')
  // deleted in another tab, and here, before the autosave
  await store.write({ deleteCards: ['a'] })
  await reload({ art: false })
  expect(useStore.getState().currentId).toBe('b')
  expect(saveState()).toBe('saved')

  await store.write({ updateCards: [{ id: 'b', yamlText: 'name: b\ncost: 9\n' }] })
  await reload({ art: false })
  expect(useStore.getState().text).toBe('name: b\ncost: 9\n')

  useStore.getState().updateText('name: b\ncost: 9\n# here\n')
  await useStore.getState().deleteCards(['b'])
  expect(saveState()).toBe('saved')
})

it('reading everything back drops what is no longer stored and takes in what is new', async () => {
  await open('a', 'b')
  await store.write({ deleteCards: ['b'] })
  await store.write({
    putCards: [{ id: 'c', name: 'c', yamlText: 'name: c\n', sortIndex: 2, updatedAt: 1 }],
  })
  await store.write({ meta: { dirtySinceExport: true } })
  await reload()
  expect(ids()).toEqual(['a', 'c'])
  expect(useStore.getState().dirtySinceExport).toBe(true)
})

it('reads asked for while one runs wait for it, as one', async () => {
  await open('a', 'b')
  const first = reload({ art: false })
  // the first under way
  await new Promise((resolve) => setTimeout(resolve, 0))
  await store.write({ updateCards: [{ id: 'b', yamlText: 'name: b\ncost: 2\n' }] })
  await store.write({
    putCards: [{ id: 'c', name: 'c', yamlText: 'name: c\n', sortIndex: 2, updatedAt: 1 }],
    putArt: [{ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 }],
  })
  const second = reload({ art: false })
  // one with the images, which the one waiting then takes in too
  const third = reload()
  expect(third).toBe(second)
  expect(second).not.toBe(first)

  await third
  expect(card('b')?.yamlText).toBe('name: b\ncost: 2\n')
  expect(ids()).toEqual(['a', 'b', 'c'])
  expect(art.files()).toEqual(['x.png'])
})

it('images are read back by version: one stored anew or since changed loads, one gone goes', async () => {
  await open('a')
  await store.write({
    putArt: [{ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 }],
  })
  const version = useStore.getState().artVersion
  // a read after a write that changed no image doesn't look at them
  await reload({ art: false })
  expect(art.loaded).toEqual([])

  await reload({ art: true })
  expect(art.loaded).toEqual(['x.png'])
  expect(useStore.getState().artVersion).toBe(version + 1)

  // the same version is left be
  await reload({ art: true })
  await reload()
  expect(art.loaded).toEqual(['x.png'])
  expect(useStore.getState().artVersion).toBe(version + 1)

  await store.write({
    putArt: [{ name: 'x.png', blob: png('y'), mime: 'image/png', size: 1, updatedAt: 2 }],
  })
  await reload()
  expect(art.loaded).toEqual(['x.png', 'x.png'])

  await store.write({ deleteArt: ['x.png'] })
  await reload({ art: true })
  expect(art.files()).toEqual([])
})

it('images swapping names by renames are read back swapped, even in one read', async () => {
  await open('a')
  // stored in one go, so of one version
  await store.write({
    putArt: [
      { name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 },
      { name: 'y.png', blob: png('yy'), mime: 'image/png', size: 2, updatedAt: 1 },
    ],
  })
  await reload()
  // reads held up behind one decoding, so the renames' reads run as one
  let decoded = () => {}
  art.hold = new Promise((resolve) => (decoded = resolve))
  await store.write({
    putArt: [{ name: 'z.png', blob: png('z'), mime: 'image/png', size: 1, updatedAt: 1 }],
  })
  const reading = reload({ art: true })
  await vi.waitFor(() => expect(art.loaded).toContain('z.png'))

  const { renameArt } = useStore.getState()
  await renameArt('x.png', 'swap.png')
  await renameArt('y.png', 'x.png')
  await renameArt('swap.png', 'y.png')
  decoded()
  await reading
  await settled()
  expect(art.entry('x.png')?.bytes).toBe(2)
  expect(art.entry('y.png')?.bytes).toBe(1)
})

it("an image that won't decode is left out, as if missing, and the rest is read", async () => {
  await open('a')
  await store.write({
    putArt: [{ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 }],
  })
  await reload()
  expect(art.files()).toEqual(['x.png'])

  // a HEIC under the old name, and one of its own
  await store.write({
    putArt: [
      { name: 'x.png', blob: heic('y'), mime: 'image/heic', size: 1, updatedAt: 2 },
      { name: 'z.heic', blob: heic('z'), mime: 'image/heic', size: 1, updatedAt: 2 },
    ],
  })
  await store.write({ updateCards: [{ id: 'a', yamlText: 'name: a\ncost: 4\n' }] })
  await reload()
  expect(art.files()).toEqual([])
  expect(useStore.getState().text).toBe('name: a\ncost: 4\n')
})

it('a save landing while a read decodes images is never taken back by that read', async () => {
  await open('a')
  await store.write({
    putArt: [{ name: 'x.png', blob: png('x'), mime: 'image/png', size: 1, updatedAt: 1 }],
  })
  let decoded = () => {}
  art.hold = new Promise((resolve) => (decoded = resolve))
  // everything read, as on coming back into view, the image decoding
  const reading = reload()
  await vi.waitFor(() => expect(art.loaded).toEqual(['x.png']))

  useStore.getState().updateText('name: a\n# here\n')
  await useStore.getState().flushSave()
  const texts: string[] = []
  const unfollow = useStore.subscribe((s, prev) => {
    if (s.text !== prev.text) texts.push(s.text)
  })
  try {
    decoded()
    await reading
    await settled()
    expect(texts).toEqual([])
    expect(useStore.getState().text).toBe('name: a\n# here\n')
  } finally {
    unfollow()
  }
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
  await store.write({ updateCards: [{ id: 'b', yamlText: 'name: b\ncost: 5\n' }] })
  await useStore.getState().moveCards(['b'], 0)
  expect(ids()).toEqual(['b', 'a'])
  expect(await store.getCard('b')).toMatchObject({ yamlText: 'name: b\ncost: 5\n', sortIndex: 0 })
  // and the move's own read back takes that text in
  await settled()
  expect(card('b')?.yamlText).toBe('name: b\ncost: 5\n')
})

it("a move shows at once, and a read of storage already under way doesn't put it back", async () => {
  await open('a', 'b')
  await settled()
  const reading = reload({ art: false })
  // its read of the cards asked for, ahead of the move's write
  await Promise.resolve()
  await Promise.resolve()
  const orders = new Set<string>()
  const unfollow = useStore.subscribe((s) => orders.add(s.cards.map((c) => c.id).join()))
  try {
    const moved = useStore.getState().moveCards(['b'], 0)
    expect(ids()).toEqual(['b', 'a'])

    await moved
    await reading
    await settled()
    expect([...orders]).toEqual(['b,a'])
    expect((await store.listCards()).map((c) => c.id)).toEqual(['b', 'a'])
  } finally {
    unfollow()
  }
})
