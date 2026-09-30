import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'

describe('IdbProjectStore', () => {
  it('round-trips cards, art and meta', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())

    await store.putCard({ id: 'a', name: 'A', yamlText: 'name: A', sortIndex: 1, updatedAt: 1 })
    await store.putCard({ id: 'b', name: 'B', yamlText: 'name: B', sortIndex: 0, updatedAt: 2 })
    const cards = await store.listCards()
    expect(cards.map((c) => c.id)).toEqual(['b', 'a'])
    expect((await store.getCard('a'))?.yamlText).toBe('name: A')

    await store.deleteCard('a')
    expect(await store.getCard('a')).toBeUndefined()

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    await store.putArt({ name: 'x.png', blob, mime: 'image/png', size: 3 })
    const art = await store.getArt('x.png')
    expect(art?.size).toBe(3)
    expect(await art!.blob.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer)

    expect((await store.getMeta()).schemaVersion).toBe(1)
    await store.setMeta({ lastOpenCardId: 'b' })
    const meta = await store.getMeta()
    expect(meta.schemaVersion).toBe(1)
    expect(meta.lastOpenCardId).toBe('b')
  })

  it('updates the fields given, leaving out a card not there', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())
    await store.putCard({ id: 'a', name: 'A', yamlText: 'name: A', sortIndex: 0, updatedAt: 5 })
    await store.putCard({ id: 'b', name: 'B', yamlText: 'name: B', sortIndex: 1, updatedAt: 5 })

    await store.updateCards([
      { id: 'a', yamlText: 'name: A2', updatedAt: 6 },
      { id: 'b', sortIndex: 0 },
      { id: 'gone', yamlText: 'name: X' },
    ])
    expect(await store.getCard('a')).toEqual({
      id: 'a',
      name: 'A',
      yamlText: 'name: A2',
      sortIndex: 0,
      updatedAt: 6,
    })
    expect(await store.getCard('b')).toMatchObject({ yamlText: 'name: B', sortIndex: 0 })
    expect(await store.getCard('gone')).toBeUndefined()
  })

  it('reads everything at once', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())
    await store.putCard({ id: 'a', name: 'A', yamlText: 'name: A', sortIndex: 1, updatedAt: 1 })
    await store.putCard({ id: 'b', name: 'B', yamlText: 'name: B', sortIndex: 0, updatedAt: 1 })
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    await store.putArt({ name: 'x.png', blob, mime: 'image/png', size: 1 })
    await store.setMeta({ dirtySinceExport: true })

    const all = await store.readAll()
    expect(all.cards.map((c) => c.id)).toEqual(['b', 'a'])
    expect(all.art.map((a) => a.name)).toEqual(['x.png'])
    expect(all.meta).toMatchObject({ schemaVersion: 1, dirtySinceExport: true })
  })
})
