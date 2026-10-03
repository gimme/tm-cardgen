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
// nor sizes anything: here the pane has `room` under its header, for the
// search box, 40px tall, and the rows, 30px each, in the list under it
let room: number
const BOX = 40
Object.defineProperties(HTMLUListElement.prototype, {
  clientHeight: { configurable: true, get: () => room - (searchBox() ? BOX : 0) },
  scrollHeight: {
    configurable: true,
    get(this: HTMLUListElement) {
      return Math.max(this.children.length * 30, this.clientHeight)
    },
  },
})
Object.defineProperty(HTMLDivElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLDivElement) {
    return this.classList.contains('card-search') ? BOX : 0
  },
})
// nor watches sizes: resize() stands for the pane's changing
const watchers = new Set<() => void>()
vi.stubGlobal(
  'ResizeObserver',
  class {
    readonly callback: () => void
    constructor(callback: () => void) {
      this.callback = callback
    }
    observe() {
      watchers.add(this.callback)
    }
    unobserve() {}
    disconnect() {
      watchers.delete(this.callback)
    }
  },
)

let root: Root

beforeEach(async () => {
  // room for three rows, not four: the search box shows
  room = 100
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

const rows = () => [...document.querySelectorAll<HTMLButtonElement>('.card-list [role="option"]')]
const row = (name: string) => rows().find((b) => b.textContent === name)!
/** the ⋮ on `name`'s row */
const menuButton = (name: string) =>
  row(name).parentElement!.querySelector<HTMLButtonElement>('.card-menu > button')!
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
    (b) => b.textContent === label,
  )!
const searchBox = () => document.querySelector('.card-search')

const click = (name: string) => act(() => row(name).click())

/** `label` picked from the menu on `name`'s row */
const pick = async (name: string, label: string) => {
  await act(() => menuButton(name).click())
  await act(() => menuItem(label).click())
}

/** the pane resized, leaving `height` under its header */
const resize = (height: number) =>
  act(() => {
    room = height
    for (const watcher of watchers) watcher()
  })

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
    const input = document.querySelector<HTMLInputElement>('.card-search input')!
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

/** once the card added has landed and opened, as `name`. React renders as the
 *  act() ends, and the list's focus moves with it */
const opened = (name: string) =>
  act(() =>
    vi.waitFor(() => {
      const { cards, currentId } = useStore.getState()
      expect(cards.find((c) => c.id === currentId)?.name).toBe(name)
    }),
  )

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

it('keeps one row and its ⋮ in the tab order: the open card, or the first listed while the search hides it', async () => {
  const tabStops = () =>
    [...document.querySelectorAll<HTMLElement>('.card-list li [tabindex="0"]')].map(
      (b) => b.getAttribute('aria-label') ?? b.textContent,
    )
  await click('bee')
  expect(tabStops()).toEqual(['bee', 'Actions for bee'])
  await search('a')
  expect(tabStops()).toEqual(['ant', 'Actions for ant'])
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

it('shows the search box once the list runs past the pane, and while it holds a search', async () => {
  expect(searchBox()).not.toBeNull()
  await resize(150)
  expect(searchBox()).toBeNull()
  // a fifth card fits, a sixth doesn't
  await act(() => useStore.getState().newCard())
  expect(searchBox()).toBeNull()
  await act(() => useStore.getState().newCard())
  expect(searchBox()).not.toBeNull()

  await search('a')
  await resize(400)
  expect(searchBox()).not.toBeNull()
  await search('')
  expect(searchBox()).toBeNull()
})

it('adds a card from the header, which opens and takes the focus', async () => {
  await click('ant')
  await act(() => document.querySelector<HTMLButtonElement>('.card-new')!.click())
  await opened('New Card')
  expect(rows().map((b) => b.textContent)).toEqual(['ant', 'bee', 'cat', 'dog', 'New Card'])
  expect(where().focus).toBe('New Card')
})

it("duplicates a row's card from its menu, the copy opening and taking the focus", async () => {
  await click('ant')
  await pick('cat', 'Duplicate')
  await opened('cat (1)')
  expect(where().focus).toBe('cat (1)')
})

it("deletes a row's card from its menu, the open card staying open", async () => {
  await click('ant')
  await pick('cat', 'Delete')
  // the focus on the row in its place
  expect(where()).toEqual({ open: 'ant', focus: 'dog' })
  await landed(['ant', 'bee', 'dog'])
})

it('deletes the open card from its menu as on Delete, the one after it opening in its place', async () => {
  await click('bee')
  await pick('bee', 'Delete')
  expect(where()).toEqual({ open: 'cat', focus: 'cat' })
  await landed(['ant', 'cat', 'dog'])
})

it("leaves the keys pressed on a row's ⋮ and its menu to them", async () => {
  await click('bee')
  await act(() => menuButton('bee').focus())
  await press('ArrowDown')
  await press('Delete')
  await act(() => menuButton('bee').click())
  await act(() => menuItem('Duplicate').focus())
  await press('ArrowUp')
  await press('Backspace')
  expect(where()).toEqual({ open: 'bee', focus: 'Duplicate' })
  // Escape closes the menu only, its ⋮ taking the focus back
  await press('Escape')
  expect(document.querySelector('[role="menu"]')).toBeNull()
  expect(document.activeElement).toBe(menuButton('bee'))
  expect(useStore.getState().cards.map((c) => c.id)).toEqual(['ant', 'bee', 'cat', 'dog'])
})
