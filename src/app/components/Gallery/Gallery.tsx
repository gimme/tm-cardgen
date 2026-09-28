// The gallery page: every card at once, as the preview draws it. A card
// renders once it scrolls near the view, and links to its editor page.
// Ctrl/Cmd-click, Shift-click or a card's Select starts a selection; while
// there is one, a click adds or takes out a card instead of opening it.
import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react'
import type { AssetRef } from '../../../core/index.ts'
import { makePreviewResolver } from '../../services/assetService.ts'
import { linkTo, openCard } from '../../router.ts'
import { cardSlugs } from '../../store/cardName.ts'
import { getServices, layoutContext } from '../../store/services.ts'
import { useStore, type CardEntry } from '../../store/useStore.ts'
import { CARD_CORNER, CardSvg } from '../PreviewPane/CardSvg.tsx'
import { extended, NO_SELECTION, toggled, without } from './selection.ts'
import { cachedTile } from './tile.ts'

// how far past the view a card starts to render, so a scroll finds it drawn
const RENDER_MARGIN = '600px'

const cardCount = (n: number) => `${n} card${n === 1 ? '' : 's'}`

export function Gallery() {
  const cards = useStore((s) => s.cards)
  const newCard = useStore((s) => s.newCard)
  const duplicateCard = useStore((s) => s.duplicateCard)
  const deleteCards = useStore((s) => s.deleteCards)
  const [sel, setSel] = useState(NO_SELECTION)
  // a card to scroll into view once it is there: a new copy, say
  const [reveal, setReveal] = useState<string>()
  const slugs = useMemo(() => cardSlugs(cards.map((c) => c.name)), [cards])
  const order = useMemo(() => cards.map((c) => c.id), [cards])
  const selected = order.filter((id) => sel.ids.has(id))
  const selecting = selected.length > 0
  const scrollRef = useRef<HTMLDivElement>(null)
  const resolveAsset = useMemo(() => {
    const { art } = getServices()
    return makePreviewResolver((file) => art.url(file))
  }, [])

  const tileOf = (id: string) =>
    scrollRef.current?.querySelector(`[data-card-id="${CSS.escape(id)}"]`)

  // opens on the card last open in the editor
  useEffect(() => {
    const { currentId } = useStore.getState()
    if (currentId !== undefined) tileOf(currentId)?.scrollIntoView({ block: 'center' })
  }, [])

  useEffect(() => {
    if (reveal !== undefined) tileOf(reveal)?.scrollIntoView({ block: 'nearest' })
  }, [reveal, cards])

  // Escape ends the selection, unless it is closing a dialog over the gallery
  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      const { artManagerOpen, exportDialogOpen } = useStore.getState()
      if (e.key === 'Escape' && !artManagerOpen && !exportDialogOpen) setSel(NO_SELECTION)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting])

  const remove = (ids: string[]) => {
    setSel((s) => without(s, ids))
    void deleteCards(ids)
  }

  const duplicate = async (id: string) => {
    await duplicateCard(id)
    setReveal(useStore.getState().currentId)
  }

  const create = async () => {
    await newCard()
    const { currentId } = useStore.getState()
    if (currentId !== undefined) openCard(currentId)
  }

  return (
    <main className="gallery">
      <header className="gallery-bar">
        {selecting ? (
          <>
            <button type="button" aria-label="Clear selection" onClick={() => setSel(NO_SELECTION)}>
              ✕
            </button>
            <span>{selected.length} selected</span>
            <span className="gallery-hint">click cards to add or take out</span>
            <span className="gallery-bar-spacer" />
            <button type="button" className="danger" onClick={() => remove(selected)}>
              Delete
            </button>
          </>
        ) : (
          <>
            <span className="gallery-hint">{cardCount(cards.length)}</span>
            <span className="gallery-bar-spacer" />
            <button type="button" onClick={() => void create()}>
              + New card
            </button>
          </>
        )}
      </header>
      <div className="gallery-scroll" ref={scrollRef}>
        {cards.length === 0 ? (
          <div className="gallery-empty">No cards yet</div>
        ) : (
          <ul className="gallery-grid">
            {cards.map((card, i) => (
              <li key={card.id} data-card-id={card.id}>
                <GalleryTile
                  card={card}
                  slug={slugs[i]}
                  selected={sel.ids.has(card.id)}
                  onPick={(e) => {
                    if (e.shiftKey) setSel((s) => extended(s, order, card.id))
                    else if (e.ctrlKey || e.metaKey || selecting) setSel((s) => toggled(s, card.id))
                    else return false
                    return true
                  }}
                  scrollRef={scrollRef}
                  resolveAsset={resolveAsset}
                />
                <TileMenu
                  selected={sel.ids.has(card.id)}
                  onSelect={() => setSel((s) => toggled(s, card.id))}
                  onDuplicate={() => void duplicate(card.id)}
                  onDelete={() => remove([card.id])}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

interface GalleryTileProps {
  card: CardEntry
  slug: string
  selected: boolean
  /** a click that selects rather than opens: true when it took the click */
  onPick: (e: MouseEvent) => boolean
  scrollRef: RefObject<HTMLElement | null>
  resolveAsset: (ref: AssetRef) => string
}

function GalleryTile({ card, slug, selected, onPick, scrollRef, resolveAsset }: GalleryTileProps) {
  const artVersion = useStore((s) => s.artVersion)
  const ref = useRef<HTMLAnchorElement>(null)
  const near = useNear(ref, scrollRef)
  const tile = near ? cachedTile(card.id, card.yamlText, artVersion, layoutContext()) : undefined
  const warnings = tile?.layout?.warnings ?? []
  const link = linkTo({ page: 'editor', slug })

  return (
    <a
      ref={ref}
      href={link.href}
      // a click leaves the focus where it was: on the card, the next key
      // pressed (Shift for a range, say) would show its keyboard focus ring
      onMouseDown={(e) => {
        if (e.button === 0) e.preventDefault()
      }}
      onClick={(e) => {
        if (onPick(e)) e.preventDefault()
        else link.onClick(e)
      }}
      className={`gallery-tile ${selected ? 'selected' : ''}`}
      style={{ borderRadius: CARD_CORNER }}
      aria-label={card.name}
    >
      {tile?.layout && <CardSvg layout={tile.layout} resolveAsset={resolveAsset} />}
      {tile?.error !== undefined && (
        <div className="gallery-broken">
          <span className="gallery-broken-name">{card.name}</span>
          <span className="gallery-broken-error">{tile.error}</span>
        </div>
      )}
      {warnings.length > 0 && (
        <span className="gallery-warn" title={warnings.map((w) => w.message).join('\n')}>
          !
        </span>
      )}
    </a>
  )
}

interface TileMenuProps {
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** a card's ⋮ menu, closed by a click outside it or Escape */
function TileMenu({ selected, onSelect, onDuplicate, onDelete }: TileMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    // on the document, so it runs before the gallery's Escape on the window
    // and stops it: this Escape closes the menu only
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className={`tile-menu ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="tile-menu-button"
        aria-label="Card actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋮
      </button>
      {open && (
        <div className="tile-menu-items" role="menu">
          <button type="button" role="menuitem" onClick={pick(onSelect)}>
            {selected ? 'Deselect' : 'Select'}
          </button>
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>
            Duplicate
          </button>
          <button type="button" role="menuitem" className="danger" onClick={pick(onDelete)}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

/** true from when the element first comes within RENDER_MARGIN of the
 *  scroller's view; a card once drawn stays drawn */
function useNear(ref: RefObject<Element | null>, rootRef: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true)
      },
      { root: rootRef.current, rootMargin: RENDER_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootRef, near])
  return near
}
