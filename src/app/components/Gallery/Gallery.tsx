// The gallery page: every card at once, as the preview draws it. A card
// renders once it scrolls near the view, and links to its editor page.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { AssetRef } from '../../../core/index.ts'
import { makePreviewResolver } from '../../services/assetService.ts'
import { linkTo } from '../../router.ts'
import { cardSlugs } from '../../store/cardName.ts'
import { getServices, layoutContext } from '../../store/services.ts'
import { useStore, type CardEntry } from '../../store/useStore.ts'
import { CARD_CORNER, CardSvg } from '../PreviewPane/CardSvg.tsx'
import { cachedTile } from './tile.ts'

// how far past the view a card starts to render, so a scroll finds it drawn
const RENDER_MARGIN = '600px'

export function Gallery() {
  const cards = useStore((s) => s.cards)
  const currentId = useStore((s) => s.currentId)
  const slugs = useMemo(() => cardSlugs(cards.map((c) => c.name)), [cards])
  const scrollRef = useRef<HTMLElement>(null)
  const resolveAsset = useMemo(() => {
    const { art } = getServices()
    return makePreviewResolver((file) => art.url(file))
  }, [])

  // opens on the card the editor has open
  useEffect(() => {
    scrollRef.current?.querySelector('.gallery-tile.current')?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <main className="gallery" ref={scrollRef}>
      {cards.length === 0 ? (
        <div className="gallery-empty">No cards yet</div>
      ) : (
        <ul className="gallery-grid">
          {cards.map((card, i) => (
            <li key={card.id}>
              <GalleryTile
                card={card}
                slug={slugs[i]}
                current={card.id === currentId}
                scrollRef={scrollRef}
                resolveAsset={resolveAsset}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

interface GalleryTileProps {
  card: CardEntry
  slug: string
  current: boolean
  scrollRef: RefObject<HTMLElement | null>
  resolveAsset: (ref: AssetRef) => string
}

function GalleryTile({ card, slug, current, scrollRef, resolveAsset }: GalleryTileProps) {
  const artVersion = useStore((s) => s.artVersion)
  const ref = useRef<HTMLAnchorElement>(null)
  const near = useNear(ref, scrollRef)
  const tile = near ? cachedTile(card.id, card.yamlText, artVersion, layoutContext()) : undefined
  const warnings = tile?.layout?.warnings ?? []

  return (
    <a
      ref={ref}
      {...linkTo({ page: 'editor', slug })}
      className={`gallery-tile ${current ? 'current' : ''}`}
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
