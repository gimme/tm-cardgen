import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { exportCardsZip, exportProjectZip } from '../../src/app/export/exportZip.ts'
import { previewImport } from '../../src/app/export/importZip.ts'
import type { CardEntry } from '../../src/app/store/useStore.ts'
import { openApp } from '../helpers/app.ts'

const card = (name: string, sortIndex: number, art?: string): CardEntry => ({
  id: name,
  name,
  yamlText: `name: ${name}\n${art === undefined ? '' : `art: ${art}\n`}`,
  sortIndex,
})

it('a zip of some cards takes the art they name, and a backup all of it', async () => {
  const { store } = await openApp()
  const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
  await store.write({
    putArt: ['dust.png', 'sky.png', 'unused.png'].map((name) => ({
      name,
      blob,
      mime: 'image/png',
      size: 1,
    })),
  })
  const cards = [
    card('Alpha', 0, 'dust.png'),
    card('Beta', 1, 'sky.png'),
    card('Gamma', 2, 'dust.png'),
    card('Delta', 3, 'gone.png'),
    card('Epsilon', 4),
  ]

  const some = await previewImport(await exportCardsZip(cards.filter((c) => c.name !== 'Beta')))
  expect(some.cards.map((c) => c.name)).toEqual(['Alpha', 'Gamma', 'Delta', 'Epsilon'])
  // an image two cards name goes in once, and one no longer stored not at all
  expect(some.art.map((a) => a.name)).toEqual(['dust.png'])

  const backup = await previewImport(await exportProjectZip(cards))
  expect(backup.cards.map((c) => c.name)).toEqual(cards.map((c) => c.name))
  expect(backup.art.map((a) => a.name).sort()).toEqual(['dust.png', 'sky.png', 'unused.png'])
})
