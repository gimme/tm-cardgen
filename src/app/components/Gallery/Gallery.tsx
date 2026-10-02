// The gallery page: every card at once, as the preview draws it, at the
// width picked on the bar's slider. A card renders once it scrolls near the
// view, and links to its editor page.
// Ctrl/Cmd-click, Shift-click or a card's check starts a selection; while
// there is one, a click adds or takes out a card instead of opening it.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type { AssetRef } from '../../../core/index.ts'
import { makePreviewResolver } from '../../services/assetService.ts'
import { linkTo, openCard } from '../../router.ts'
import { cardSlugs } from '../../store/cardName.ts'
import { getServices, layoutContext } from '../../store/services.ts'
import { useStore, type CardEntry } from '../../store/useStore.ts'
import { CARD_CORNER, CardSvg } from '../PreviewPane/CardSvg.tsx'
import { extended, NO_SELECTION, toggled, without } from './selection.ts'
import { CARD_WIDTH, stopOf, storedWidth, storeWidth, widthAt } from './size.ts'
import { cachedTile } from './tile.ts'

// how far past the view a card starts to render, so a scroll finds it drawn
const RENDER_MARGIN = '600px'

const cardCount = (n: number) => `${n} card${n === 1 ? '' : 's'}`

interface Point {
  x: number
  y: number
}

// from the width a card is laid out at, the slider's widest, to its tile's:
// the width picked on the slider, or the view's where that is narrower
const CardScale = createContext(1)

export function Gallery() {
  const cards = useStore((s) => s.cards)
  const newCard = useStore((s) => s.newCard)
  const duplicateCard = useStore((s) => s.duplicateCard)
  const deleteCards = useStore((s) => s.deleteCards)
  const [sel, setSel] = useState(NO_SELECTION)
  const [cardWidth, setCardWidth] = useState(storedWidth)
  // a card to scroll into view once it is there: a new copy, say
  const [reveal, setReveal] = useState<string>()
  const slugs = useMemo(() => cardSlugs(cards.map((c) => c.name)), [cards])
  const order = useMemo(() => cards.map((c) => c.id), [cards])
  const selected = useMemo(() => order.filter((id) => sel.ids.has(id)), [order, sel])
  const selecting = selected.length > 0
  // the card whose menu is open: at the pointer that right-clicked it, or
  // under its ⋮ button
  const [menu, setMenu] = useState<{ id: string; at?: Point }>()
  const closeMenu = useCallback(() => setMenu(undefined), [])
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridWidth = useContentWidth(scrollRef)
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

  // once: the next change to the cards, a move say, leaves the view be
  useEffect(() => {
    const tile = reveal === undefined ? undefined : tileOf(reveal)
    if (!tile) return
    tile.scrollIntoView({ block: 'nearest' })
    setReveal(undefined)
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

  const remove = useCallback(
    (ids: string[]) => {
      setSel((s) => without(s, ids))
      void deleteCards(ids)
    },
    [deleteCards],
  )

  const duplicate = useCallback(
    async (id: string) => {
      await duplicateCard(id)
      setReveal(useStore.getState().currentId)
    },
    [duplicateCard],
  )

  const create = async () => {
    await newCard()
    const { currentId } = useStore.getState()
    if (currentId !== undefined) openCard(currentId)
  }

  // built again only as the cards, the selection or the open menu change, so
  // a drag on the size slider, which renders the gallery many times a second,
  // leaves the tiles be
  const tiles = useMemo(
    () =>
      cards.map((card, i) => {
        // a card in a selection of more than one: its menu is the selection's
        const group = selected.length > 1 && sel.ids.has(card.id) ? selected : undefined
        return (
          <li
            key={card.id}
            data-card-id={card.id}
            // shown as under the pointer while its menu is open
            className={menu?.id === card.id ? 'menu-open' : undefined}
            onContextMenu={(e) => {
              // with Shift, the browser's own menu: a new tab, say
              if (e.shiftKey) return
              e.preventDefault()
              setMenu({ id: card.id, at: { x: e.clientX, y: e.clientY } })
            }}
          >
            <TileCheck
              name={card.name}
              selected={sel.ids.has(card.id)}
              onPick={(e) =>
                setSel((s) => (e.shiftKey ? extended(s, order, card.id) : toggled(s, card.id)))
              }
            />
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
              open={menu?.id === card.id}
              at={menu?.id === card.id ? menu.at : undefined}
              bounds={scrollRef}
              count={group?.length ?? 1}
              onToggle={() =>
                setMenu((m) =>
                  m?.id === card.id && m.at === undefined ? undefined : { id: card.id },
                )
              }
              onClose={closeMenu}
              onDuplicate={() => void duplicate(card.id)}
              onDelete={() => remove(group ?? [card.id])}
            />
          </li>
        )
      }),
    [
      cards,
      slugs,
      sel,
      selected,
      order,
      selecting,
      menu,
      resolveAsset,
      remove,
      duplicate,
      closeMenu,
    ],
  )

  return (
    <main className="gallery">
      <header className="gallery-bar">
        <div className="gallery-bar-side">
          {selecting ? (
            <>
              <button
                type="button"
                aria-label="Clear selection"
                onClick={() => setSel(NO_SELECTION)}
              >
                ✕
              </button>
              <span>{selected.length} selected</span>
              <span className="gallery-hint">click cards to add or take out</span>
            </>
          ) : (
            <span className="gallery-hint">{cardCount(cards.length)}</span>
          )}
        </div>
        <SizeSlider
          width={cardWidth}
          onChange={(width) => {
            setCardWidth(width)
            storeWidth(width)
          }}
        />
        <div className="gallery-bar-side end">
          {selecting ? (
            <button type="button" className="danger" onClick={() => remove(selected)}>
              Delete
            </button>
          ) : (
            <button type="button" onClick={() => void create()}>
              + New card
            </button>
          )}
        </div>
      </header>
      <div className="gallery-scroll" ref={scrollRef}>
        {cards.length === 0 ? (
          <div className="gallery-empty">No cards yet</div>
        ) : (
          <CardScale value={Math.min(cardWidth, gridWidth) / CARD_WIDTH.max}>
            <ul
              className={`gallery-grid ${selecting ? 'selecting' : ''}`}
              style={{ '--card-w': `${cardWidth}px` } as CSSProperties}
            >
              {tiles}
            </ul>
          </CardScale>
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
      {tile?.layout && (
        <ScaledCard>
          <CardSvg layout={tile.layout} resolveAsset={resolveAsset} />
        </ScaledCard>
      )}
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

/** a card laid out at the slider's widest and scaled down to its tile, so a
 *  new width changes nothing inside the card */
function ScaledCard({ children }: { children: ReactNode }) {
  const scale = useContext(CardScale)
  return (
    <div className="gallery-card">
      <div
        className="gallery-scaled"
        style={{ width: CARD_WIDTH.max, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

interface SizeSliderProps {
  width: number
  onChange: (width: number) => void
}

/** the card width, between a small card and a large one, a stop at a time;
 *  the initial width is notched on the track, and a double-click goes back
 *  to it */
function SizeSlider({ width, onChange }: SizeSliderProps) {
  const { steps, initial } = CARD_WIDTH
  const along = (w: number) => stopOf(w) / steps
  return (
    <label className="gallery-size" title="Card size">
      <span className="gallery-size-card small" />
      <input
        type="range"
        min={0}
        max={steps}
        value={stopOf(width)}
        onChange={(e) => onChange(widthAt(Number(e.target.value)))}
        onDoubleClick={() => onChange(initial)}
        style={{ '--fill': along(width), '--home': along(initial) } as CSSProperties}
        aria-label="Card size"
        aria-valuetext={`${width} pixels`}
      />
      <span className="gallery-size-card large" />
    </label>
  )
}

interface TileCheckProps {
  name: string
  selected: boolean
  /** a click on the check: a Shift-click ranges, as on the card */
  onPick: (e: MouseEvent) => void
}

/** a card's round check, which takes it in or out of the selection */
function TileCheck({ name, selected, onPick }: TileCheckProps) {
  return (
    <button
      type="button"
      className={`tile-check ${selected ? 'selected' : ''}`}
      aria-label={`Select ${name}`}
      aria-pressed={selected}
      // as on the card, a click leaves the focus where it was, so a Shift
      // for the next check's range doesn't ring this one
      onMouseDown={(e) => {
        if (e.button === 0) e.preventDefault()
      }}
      onClick={onPick}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M3 8.5l3.2 3L13 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

interface TileMenuProps {
  open: boolean
  /** the pointer that right-clicked the card, in the view; without it, the
   *  menu hangs under the ⋮ button */
  at?: Point
  /** the view a menu at the pointer turns back from, where it would run out */
  bounds: RefObject<HTMLElement | null>
  /** how many cards it acts on: more than one for a card in a selection */
  count: number
  onToggle: () => void
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** a card's menu, from its ⋮ button or a right-click, closed by a click
 *  outside it or Escape. For a card in a selection of more than one, it
 *  acts on the whole selection, which it can't duplicate */
function TileMenu(props: TileMenuProps) {
  const { open, at, bounds, count, onToggle, onClose, onDuplicate, onDelete } = props
  const ref = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)
  // where a menu at the pointer sits, from this menu's corner
  const [place, setPlace] = useState<Point>()

  // from the pointer down and right, or up or left where it would run out of
  // the view; measured before it paints, so it doesn't jump
  useLayoutEffect(() => {
    const corner = ref.current?.getBoundingClientRect()
    const items = itemsRef.current?.getBoundingClientRect()
    const view = bounds.current
    if (!at || !corner || !items || !view) {
      setPlace(undefined)
      return
    }
    const { left, top } = view.getBoundingClientRect()
    const x = at.x + items.width > left + view.clientWidth ? at.x - items.width : at.x
    const y = at.y + items.height > top + view.clientHeight ? at.y - items.height : at.y
    setPlace({ x: x - corner.left, y: y - corner.top })
  }, [at, bounds])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    // on the document, so it runs before the gallery's Escape on the window
    // and stops it: this Escape closes the menu only
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const pick = (action: () => void) => () => {
    onClose()
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
        onClick={onToggle}
      >
        {/* drawn rather than a ⋮, which each font seats off the middle */}
        <svg viewBox="0 0 4 16" width="4" height="16" aria-hidden="true">
          <circle cx="2" cy="3" r="1.5" fill="currentColor" />
          <circle cx="2" cy="8" r="1.5" fill="currentColor" />
          <circle cx="2" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          className="tile-menu-items"
          role="menu"
          ref={itemsRef}
          style={place && { left: place.x, top: place.y, right: 'auto' }}
          // a right-click on the menu leaves it where it is
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {count === 1 && (
            <button type="button" role="menuitem" onClick={pick(onDuplicate)}>
              Duplicate
            </button>
          )}
          <button type="button" role="menuitem" className="danger" onClick={pick(onDelete)}>
            {count === 1 ? 'Delete' : `Delete ${cardCount(count)}`}
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

/** the element's width inside its padding and scrollbar, kept up to date as
 *  it changes; Infinity until it is first measured */
function useContentWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(Infinity)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}
