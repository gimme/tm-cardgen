// The app's two pages, each at its own address under the base path: the
// gallery at the root and a card's editor at card/<slug>. The store says which
// page shows; this keeps the address bar and the history in step with it.
import type { MouseEvent } from 'react'
import { cardSlugs } from './store/cardName.ts'
import { useStore, type AppState } from './store/useStore.ts'

export type Route = { page: 'gallery' } | { page: 'editor'; slug: string }

const BASE = import.meta.env.BASE_URL
const TITLE = 'tm-cardgen'

/** the route at `pathname`, or nothing for an address that is neither page */
export function routeOf(pathname: string, base = BASE): Route | undefined {
  if (!pathname.startsWith(base)) return undefined
  const rest = pathname.slice(base.length).replace(/\/$/, '')
  if (rest === '' || rest === 'index.html') return { page: 'gallery' }
  const slug = /^card\/([a-z0-9-]+)$/.exec(rest)?.[1]
  return slug ? { page: 'editor', slug } : undefined
}

export function pathOf(route: Route, base = BASE): string {
  return route.page === 'gallery' ? base : `${base}card/${route.slug}`
}

/** the route the store shows, and the card's name on the editor page */
function shown(s: AppState): { route: Route; name?: string } {
  const i = s.cards.findIndex((c) => c.id === s.currentId)
  if (s.page !== 'editor' || i === -1) return { route: { page: 'gallery' } }
  const slug = cardSlugs(s.cards.map((c) => c.name))[i]
  return { route: { page: 'editor', slug }, name: s.cards[i].name }
}

/** the store onto `route`; a card that is not there shows the gallery */
function show(route: Route | undefined) {
  const { cards, selectCard, setPage } = useStore.getState()
  if (route?.page === 'editor') {
    const i = cardSlugs(cards.map((c) => c.name)).indexOf(route.slug)
    if (i !== -1) {
      selectCard(cards[i].id)
      setPage('editor')
      return
    }
  }
  setPage('gallery')
}

/** the address bar onto what the store shows, in the same history entry: a
 *  renamed card, or another one picked from the editor's list */
function sync() {
  const { route, name } = shown(useStore.getState())
  const path = pathOf(route)
  if (path !== location.pathname) history.replaceState(null, '', path + location.search)
  const title = name ? `${name} · ${TITLE}` : TITLE
  if (document.title !== title) document.title = title
}

/** `route` shown, as a new history entry */
export function navigate(route: Route) {
  history.pushState(null, '', pathOf(route) + location.search)
  show(route)
}

/** href and click handler for a link to `route`: a plain click navigates in
 *  place, and a modified one is the browser's (a new tab, say) */
export function linkTo(route: Route) {
  return {
    href: pathOf(route),
    onClick: (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      navigate(route)
    },
  }
}

/** the page at the current address, then the address following the app */
export function startRouter() {
  show(routeOf(location.pathname))
  sync()
  useStore.subscribe(sync)
  window.addEventListener('popstate', () => show(routeOf(location.pathname)))
}
