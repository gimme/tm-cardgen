import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { IdbProjectStore } from '../../src/app/storage/IdbProjectStore.ts'
import type { StoredCard } from '../../src/app/storage/ProjectStore.ts'

describe('IdbProjectStore', () => {
  it('round-trips cards, art and meta', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())

    await store.write({
      putCards: [{ id: 'a', name: 'A', yamlText: 'name: A', sortIndex: 1, updatedAt: 1 }],
    })
    await store.write({
      putCards: [{ id: 'b', name: 'B', yamlText: 'name: B', sortIndex: 0, updatedAt: 2 }],
    })
    const cards = await store.listCards()
    expect(cards.map((c) => c.id)).toEqual(['b', 'a'])
    expect((await store.getCard('a'))?.yamlText).toBe('name: A')

    await store.write({ deleteCards: ['a'] })
    expect(await store.getCard('a')).toBeUndefined()

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    await store.write({ putArt: [{ name: 'x.png', blob, mime: 'image/png', size: 3 }] })
    const art = await store.getArt('x.png')
    expect(art?.size).toBe(3)
    expect(await art!.blob.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer)

    expect((await store.getMeta()).schemaVersion).toBe(1)
    await store.write({ meta: { lastOpenCardId: 'b' } })
    const meta = await store.getMeta()
    expect(meta.schemaVersion).toBe(1)
    expect(meta.lastOpenCardId).toBe('b')
  })

  it('writes a batch in order: deletes, puts, card patches, then the meta', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())
    const card = (id: string, sortIndex: number) => ({
      id,
      name: id.toUpperCase(),
      yamlText: `name: ${id}`,
      sortIndex,
      updatedAt: 5,
    })
    const png = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    await store.write({
      putCards: [card('a', 0), card('b', 1)],
      putArt: [{ name: 'x.png', blob: png([1]), mime: 'image/png', size: 1 }],
    })

    await store.write({
      // x.png deleted and put back: the new one stays
      deleteArt: ['x.png'],
      putArt: [{ name: 'x.png', blob: png([2, 2]), mime: 'image/png', size: 2 }],
      deleteCards: ['b'],
      putCards: [card('c', 2)],
      updateCards: [
        { id: 'a', yamlText: 'name: a2', updatedAt: 6 },
        { id: 'c', sortIndex: 1 },
        // gone, so left out
        { id: 'b', yamlText: 'name: b2' },
      ],
      meta: { dirtySinceExport: true },
    })
    expect(await store.getCard('a')).toEqual({
      ...card('a', 0),
      yamlText: 'name: a2',
      updatedAt: 6,
    })
    expect(await store.getCard('b')).toBeUndefined()
    expect(await store.getCard('c')).toMatchObject({ yamlText: 'name: c', sortIndex: 1 })
    expect((await store.getArt('x.png'))?.size).toBe(2)
    expect(await store.getMeta()).toMatchObject({ schemaVersion: 1, dirtySinceExport: true })
  })

  it('a batch that fails lands none of it', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())
    const a = { id: 'a', name: 'A', yamlText: 'name: A', sortIndex: 0, updatedAt: 1 }
    await store.write({ putCards: [a] })

    const keyless = { name: 'B' } as StoredCard
    await expect(
      store.write({ deleteCards: ['a'], putCards: [keyless], meta: { dirtySinceExport: true } }),
    ).rejects.toThrow()
    expect(await store.getCard('a')).toEqual(a)
    expect((await store.getMeta()).dirtySinceExport).toBeUndefined()
  })

  it('reads everything at once', async () => {
    const store = await IdbProjectStore.open('test-db-' + Math.random())
    await store.write({
      putCards: [{ id: 'a', name: 'A', yamlText: 'name: A', sortIndex: 1, updatedAt: 1 }],
    })
    await store.write({
      putCards: [{ id: 'b', name: 'B', yamlText: 'name: B', sortIndex: 0, updatedAt: 1 }],
    })
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    await store.write({ putArt: [{ name: 'x.png', blob, mime: 'image/png', size: 1 }] })
    await store.write({ meta: { dirtySinceExport: true } })

    const all = await store.readAll()
    expect(all.cards.map((c) => c.id)).toEqual(['b', 'a'])
    expect(all.art.map((a) => a.name)).toEqual(['x.png'])
    expect(all.meta).toMatchObject({ schemaVersion: 1, dirtySinceExport: true })
  })

  it('makes way for a newer version opened in another tab, once the app is done', async () => {
    const name = 'test-db-' + Math.random()
    let asked = () => {}
    const outdated = new Promise<void>((resolve) => (asked = resolve))
    let done = () => {}
    await IdbProjectStore.open(name, {
      outdated() {
        asked()
        return new Promise<void>((resolve) => (done = resolve))
      },
    })

    let upgraded = false
    const newer = openDB(name, 2).then((db) => {
      upgraded = true
      return db
    })
    await outdated
    // held up until the app is done
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(upgraded).toBe(false)

    done()
    const db = await newer
    expect(db.version).toBe(2)
    db.close()
  })
})
