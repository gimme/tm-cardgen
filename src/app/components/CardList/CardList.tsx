import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import type { CardType } from '../../../core/index.ts'
import { useStore } from '../../store/useStore.ts'
import { MenuButton } from '../Menu/Menu.tsx'
import { gapIsNoop, indexForGap } from './reorder.ts'

const TYPE_COLORS: Record<CardType, string> = {
  automated: '#4caf50',
  event: '#e53935',
  active: '#2196f3',
}

/** The card's color as the validator derives it, read off the raw text to
 *  avoid a parse. */
function cardType(yamlText: string): CardType {
  if (/^active:/m.test(yamlText)) return 'active'
  if (/^tags:.*\bevent\b/m.test(yamlText)) return 'event'
  return 'automated'
}

/** The gap a drag lands in: 0 above the first row, `count` below the last;
 *  the pointer's half of the hovered row picks above or below it. */
function gapAt(e: DragEvent<HTMLUListElement>, count: number): number {
  const row = (e.target as Element).closest('li')
  if (!row || !e.currentTarget.contains(row)) return count
  const index = Number(row.dataset.index)
  const { top, height } = row.getBoundingClientRect()
  return e.clientY < top + height / 2 ? index : index + 1
}

/** Row `index` focused, the list scrolled just enough to show it. */
function focusRow(list: HTMLUListElement, index: number) {
  const option = list.children[index]?.querySelector<HTMLElement>('[role="option"]')
  if (!option) return
  // focusing alone would scroll the row to the middle of the list
  option.focus({ preventScroll: true })
  option.scrollIntoView({ block: 'nearest' })
}

export function CardList() {
  const cards = useStore((s) => s.cards)
  const currentId = useStore((s) => s.currentId)
  const selectCard = useStore((s) => s.selectCard)
  const newCard = useStore((s) => s.newCard)
  const duplicateCard = useStore((s) => s.duplicateCard)
  const deleteCards = useStore((s) => s.deleteCards)
  const moveCards = useStore((s) => s.moveCards)
  const [query, setQuery] = useState('')
  const [dragId, setDragId] = useState<string>()
  const [dropGap, setDropGap] = useState<number>()
  // every card listed runs past the pane: only then is there a search box
  const [long, setLong] = useState(false)
  // a card added here, whose row takes the focus once it is listed
  const [added, setAdded] = useState<string>()
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => {
    if (!query.trim()) return cards
    const q = query.toLowerCase()
    return cards.filter((c) => c.name.toLowerCase().includes(q))
  }, [cards, query])

  const filtering = query.trim() !== ''
  const dragIndex = dragId === undefined ? -1 : cards.findIndex((c) => c.id === dragId)
  const dragging = dragIndex !== -1 && !filtering
  // the list's one stop in the tab order, with its ⋮: the open card, or the
  // first card while the search hides that one
  const tabStop = visible.some((c) => c.id === currentId) ? currentId : visible[0]?.id

  // Measured with every card listed, as cards come and go and the pane
  // changes size. Once shown, the box stays until the list would fit without
  // it with a pixel or two to spare: at the edge, rounding would have it come
  // and go.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || filtering) return
    const measure = () => {
      // hidden, on the gallery page: left as it was
      if (list.clientHeight === 0) return
      const box = searchRef.current
      setLong(list.scrollHeight > list.clientHeight + (box ? box.offsetHeight - 2 : 0))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [cards.length, filtering])

  useEffect(() => {
    if (added === undefined) return
    const index = visible.findIndex((c) => c.id === added)
    if (index !== -1 && listRef.current) focusRow(listRef.current, index)
    setAdded(undefined)
  }, [added, visible])

  /** the card `adding` adds and opens, its row focused once it is listed */
  const add = async (adding: Promise<void>) => {
    await adding
    setAdded(useStore.getState().currentId)
  }

  /** Row `index`'s card deleted, the focus going on to the row that takes its
   *  place: the one after it, or else the one before. That one opens in place
   *  of the open card. */
  const remove = (index: number) => {
    const { id } = visible[index]
    const next = index + 1 < visible.length ? index + 1 : index - 1
    if (next >= 0) {
      // opened first, so the store doesn't open the first card in its place
      if (id === currentId) selectCard(visible[next].id)
      if (listRef.current) focusRow(listRef.current, next)
    }
    void deleteCards([id])
  }

  // the arrow keys, Home and End open the card above, below, first or last,
  // and Delete deletes the card; the keys of a row's ⋮ and its menu are theirs
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const option = e.target as Element
    if (option.getAttribute('role') !== 'option') return
    const list = e.currentTarget
    const index = Number(option.closest('li')?.dataset.index)
    const open = (to: number) => {
      focusRow(list, to)
      if (visible[to].id !== currentId) selectCard(visible[to].id)
    }
    switch (e.key) {
      case 'ArrowUp':
        open(Math.max(index - 1, 0))
        break
      case 'ArrowDown':
        open(Math.min(index + 1, visible.length - 1))
        break
      case 'Home':
        open(0)
        break
      case 'End':
        open(visible.length - 1)
        break
      // Backspace too, which a Mac's delete key sends. A card a press: held
      // down, the key doesn't go on to delete the cards after it
      case 'Delete':
      case 'Backspace':
        if (!e.repeat) remove(index)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const endDrag = () => {
    setDragId(undefined)
    setDropGap(undefined)
  }

  const hover = (e: DragEvent<HTMLUListElement>) => {
    if (!dragging) return
    e.preventDefault()
    const gap = gapAt(e, visible.length)
    setDropGap(gapIsNoop(dragIndex, gap) ? undefined : gap)
  }

  return (
    <section className="card-list">
      <header className="card-list-header">
        <h2>Cards</h2>
        <button
          type="button"
          className="card-new"
          aria-label="New card"
          title="New card"
          onClick={() => void add(newCard())}
        >
          {/* drawn rather than a +, which each font seats off the middle */}
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path
              d="M6 1.5v9M1.5 6h9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      {/* and while it holds a search, so that it can be cleared */}
      {(long || query !== '') && (
        <div className="card-search" ref={searchRef}>
          <input
            placeholder="Search cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Cards"
        onKeyDown={onKeyDown}
        onDragEnter={hover}
        onDragOver={hover}
        onDragLeave={(e) => {
          // relatedTarget is unreliable for drag events, so go by the pointer
          const { left, top, right, bottom } = e.currentTarget.getBoundingClientRect()
          const inside =
            e.clientX >= left && e.clientX < right && e.clientY >= top && e.clientY < bottom
          if (!inside) setDropGap(undefined)
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragId !== undefined && dragging && dropGap !== undefined) {
            void moveCards([dragId], indexForGap(dragIndex, dropGap))
          }
          endDrag()
        }}
      >
        {visible.map((card, index) => (
          <li
            key={card.id}
            role="none"
            data-index={index}
            className={
              dropGap === index
                ? 'drop-before'
                : dropGap === index + 1 && index === visible.length - 1
                  ? 'drop-after'
                  : ''
            }
          >
            <button
              type="button"
              role="option"
              aria-selected={card.id === currentId}
              tabIndex={card.id === tabStop ? 0 : -1}
              draggable={!filtering}
              className={card.id === currentId ? 'active' : ''}
              onClick={(e) => {
                // as Chrome does on a click, and Safari and Firefox on a Mac
                // don't, so that the arrow keys go on from here
                e.currentTarget.focus({ preventScroll: true })
                selectCard(card.id)
              }}
              onDragStart={(e) => {
                setDragId(card.id)
                e.dataTransfer.effectAllowed = 'move'
                // Firefox only starts a drag that carries some data
                e.dataTransfer.setData('application/x-card-id', card.id)
              }}
              onDragEnd={endDrag}
            >
              <span
                className="type-swatch"
                style={{ background: TYPE_COLORS[cardType(card.yamlText)] }}
              />
              <span className="card-name">{card.name}</span>
            </button>
            <MenuButton
              items={[
                { label: 'Duplicate', act: () => void add(duplicateCard(card.id)) },
                { label: 'Delete', danger: true, act: () => remove(index) },
              ]}
              label={`Actions for ${card.name}`}
              className="card-menu"
              tabIndex={card.id === tabStop ? 0 : -1}
              bounds={listRef}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
