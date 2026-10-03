import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { CardType } from '../../../core/index.ts'
import { useStore } from '../../store/useStore.ts'
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
  const button = list.children[index]?.querySelector('button')
  if (!button) return
  // focusing alone would scroll the row to the middle of the list
  button.focus({ preventScroll: true })
  button.scrollIntoView({ block: 'nearest' })
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

  const visible = useMemo(() => {
    if (!query.trim()) return cards
    const q = query.toLowerCase()
    return cards.filter((c) => c.name.toLowerCase().includes(q))
  }, [cards, query])

  const filtering = query.trim() !== ''
  const dragIndex = dragId === undefined ? -1 : cards.findIndex((c) => c.id === dragId)
  const dragging = dragIndex !== -1 && !filtering
  // the list's one stop in the tab order: the open card, or the first card
  // while the search hides that one
  const tabStop = visible.some((c) => c.id === currentId) ? currentId : visible[0]?.id

  /** The card deleted, the one after it in the list opening in its place, or
   *  else the one before. Returns that one's row. */
  const remove = (id: string): number | undefined => {
    const index = visible.findIndex((c) => c.id === id)
    const next = index + 1 < visible.length ? index + 1 : index - 1
    const opens = index !== -1 && next >= 0
    // opened first, so the store doesn't open the first card in its place
    if (opens) selectCard(visible[next].id)
    void deleteCards([id])
    return opens ? next : undefined
  }

  // the arrow keys, Home and End open the card above, below, first or last,
  // and Delete deletes the card
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const row = (e.target as Element).closest('li')
    if (!row) return
    const list = e.currentTarget
    const index = Number(row.dataset.index)
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
      case 'Backspace': {
        if (e.repeat) break
        const next = remove(visible[index].id)
        if (next !== undefined) focusRow(list, next)
        break
      }
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
      <div className="card-list-actions">
        <button type="button" onClick={() => void newCard()}>
          + New
        </button>
        <button
          type="button"
          disabled={!currentId}
          onClick={() => currentId && void duplicateCard(currentId)}
        >
          Duplicate
        </button>
        <button type="button" disabled={!currentId} onClick={() => currentId && remove(currentId)}>
          Delete
        </button>
      </div>
      <input
        className="card-search"
        placeholder="Search cards…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul
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
          </li>
        ))}
      </ul>
    </section>
  )
}
