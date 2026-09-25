import { useMemo, useState, type DragEvent } from 'react'
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

export function CardList() {
  const cards = useStore((s) => s.cards)
  const currentId = useStore((s) => s.currentId)
  const selectCard = useStore((s) => s.selectCard)
  const newCard = useStore((s) => s.newCard)
  const duplicateCard = useStore((s) => s.duplicateCard)
  const deleteCard = useStore((s) => s.deleteCard)
  const moveCard = useStore((s) => s.moveCard)
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
        <button
          type="button"
          disabled={!currentId}
          onClick={() => {
            const card = cards.find((c) => c.id === currentId)
            if (card && confirm(`Delete "${card.name}"?`)) void deleteCard(card.id)
          }}
        >
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
            void moveCard(dragId, indexForGap(dragIndex, dropGap))
          }
          endDrag()
        }}
      >
        {visible.map((card, index) => (
          <li
            key={card.id}
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
              draggable={!filtering}
              className={card.id === currentId ? 'active' : ''}
              onClick={() => selectCard(card.id)}
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
