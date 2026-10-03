// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.ts'
import { openApp } from '../../../../tests/helpers/app.ts'
import { CardList } from './CardList.tsx'

// renders and effects flush within act(), and React warns of an update outside one
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
// jsdom lays nothing out, so there is nothing to scroll
Element.prototype.scrollIntoView = () => {}

let root: Root

beforeEach(async () => {
  const { store } = await openApp()
  for (const [i, id] of ['ant', 'bee', 'cat', 'dog'].entries()) {
    await store.write({
      putCards: [{ id, name: id, yamlText: `name: ${id}\n`, sortIndex: i, updatedAt: 1 }],
    })
  }
  await useStore.getState().reloadFromStore()
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(() => root.render(createElement(CardList)))
})

afterEach(() => {
  act(() => root.unmount())
  document.body.replaceChildren()
})

const rows = () => [...document.querySelectorAll<HTMLButtonElement>('.card-list li button')]
const row = (name: string) => rows().find((b) => b.textContent === name)!

const click = (name: string) => act(() => row(name).click())

/** `key` pressed where the focus is */
const press = (key: string, init?: KeyboardEventInit) =>
  act(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    )
  })

/** `text` typed into the search box */
const search = (text: string) =>
  act(() => {
    const input = document.querySelector<HTMLInputElement>('.card-search')!
    // set as typing sets it, past React's own record of the value, so onChange hears it
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

/** the open card, and the one whose row has the focus */
const where = () => ({
  open: useStore.getState().currentId,
  focus: document.activeElement?.textContent,
})

/** once the delete has landed, leaving the cards `ids` */
const landed = (ids: string[]) =>
  act(() => vi.waitFor(() => expect(useStore.getState().cards.map((c) => c.id)).toEqual(ids)))

it('opens the card above or below on an arrow key, and the first or last on Home or End', async () => {
  await click('bee')
  await press('ArrowDown')
  expect(where()).toEqual({ open: 'cat', focus: 'cat' })
  await press('ArrowUp')
  await press('ArrowUp')
  expect(where()).toEqual({ open: 'ant', focus: 'ant' })
  // no further than the first, or the last
  await press('ArrowUp')
  expect(where()).toEqual({ open: 'ant', focus: 'ant' })
  await press('End')
  expect(where()).toEqual({ open: 'dog', focus: 'dog' })
  await press('ArrowDown')
  expect(where()).toEqual({ open: 'dog', focus: 'dog' })
  await press('Home')
  expect(where()).toEqual({ open: 'ant', focus: 'ant' })
  // with a modifier, the key is left alone
  await press('ArrowDown', { shiftKey: true })
  expect(where()).toEqual({ open: 'ant', focus: 'ant' })
})

it('keeps one row in the tab order: the open card, or the first listed while the search hides it', async () => {
  const tabStops = () => rows().filter((b) => b.tabIndex === 0)
  await click('bee')
  expect(tabStops().map((b) => b.textContent)).toEqual(['bee'])
  await search('a')
  expect(tabStops().map((b) => b.textContent)).toEqual(['ant'])
})

it('deletes the card on Delete, the one after it opening in its place, or before it for the last', async () => {
  await click('bee')
  await press('Delete')
  // at once, before the delete lands
  expect(where()).toEqual({ open: 'cat', focus: 'cat' })
  await landed(['ant', 'cat', 'dog'])
  expect(useStore.getState().deleted?.map((c) => c.id)).toEqual(['bee'])

  await press('End')
  // a Mac's delete key
  await press('Backspace')
  expect(where()).toEqual({ open: 'cat', focus: 'cat' })
  await landed(['ant', 'cat'])
})

it('deletes one card on a held Delete', async () => {
  await click('ant')
  await press('Delete')
  await press('Delete', { repeat: true })
  // a repeat acted on would have gone on to open cat
  expect(where()).toEqual({ open: 'bee', focus: 'bee' })
  await landed(['bee', 'cat', 'dog'])
})

it('opens the next card listed in place of one deleted while searching', async () => {
  await click('ant')
  await search('a')
  // the focus back on the list from the search box
  await act(() => rows()[0].focus())
  await press('Delete')
  expect(where()).toEqual({ open: 'cat', focus: 'cat' })
  await landed(['bee', 'cat', 'dog'])
})
