// The app's two pages, each at its own address under the base path: a card's
// editor at card/<slug>, and the gallery at gallery. The root is the editor on
// the card last open. The store says which page shows; this keeps the address
// bar and the history in step with it.
import type { MouseEvent } from 'react'
import { cardSlugs } from './store/cardName.ts'
import { useStore, type AppState } from './store/useStore.ts'

/** an editor without a slug is the root: whichever card is open */
export type Route = { page: 'gallery' } | { page: 'editor'; slug?: string }

const BASE = import.meta.env.BASE_URL
const TITLE = 'tm-cardgen'

/** the route at `pathname`, or nothing for an address that is neither page */
export function routeOf(pathname: string, base = BASE): Route | undefined {
  if (!pathname.startsWith(base)) return undefined
  const rest = pathname.slice(base.length).replace(/\/$/, '')
  if (rest === '' || rest === 'index.html') return { page: 'editor' }
  if (rest === 'gallery') return { page: 'gallery' }
  const slug = /^card\/([a-z0-9-]+)$/.exec(rest)?.[1]
  return slug ? { page: 'editor', slug } : undefined
}

export function pathOf(route: Route, base = BASE): string {
  if (route.page === 'gallery') return `${base}gallery`
  return route.slug === undefined ? base : `${base}card/${route.slug}`
}

/** the route the store shows, and the card's name on the editor page */
function shown(s: AppState): { route: Route; name?: string } {
  if (s.page === 'gallery') return { route: { page: 'gallery' } }
  const i = s.cards.findIndex((c) => c.id === s.currentId)
  if (i === -1) return { route: { page: 'editor' } }
  const slug = cardSlugs(s.cards.map((c) => c.name))[i]
  return { route: { page: 'editor', slug }, name: s.cards[i].name }
}

/** the store onto `route`; any other address, or a card that is not there,
 *  shows the editor on the card already open */
function show(route: Route | undefined) {
  const { cards, selectCard, setPage } = useStore.getState()
  if (route?.page === 'gallery') {
    setPage('gallery')
    return
  }
  if (route?.slug !== undefined) {
    const i = cardSlugs(cards.map((c) => c.name)).indexOf(route.slug)
    if (i !== -1) selectCard(cards[i].id)
  }
  setPage('editor')
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

/** the address `route` ends up at: the root's is its card's */
function landing(route: Route): string {
  if (route.page === 'gallery' || route.slug !== undefined) return pathOf(route)
  return pathOf(shown({ ...useStore.getState(), page: 'editor' }).route)
}

/** `route` shown, as a new history entry unless it is the page already shown,
 *  as a browser treats a link to its own address */
export function navigate(route: Route) {
  const path = landing(route)
  if (path !== location.pathname) history.pushState(null, '', path + location.search)
  show(route)
}

/** the card's editor page, as a new history entry */
export function openCard(id: string) {
  const { cards } = useStore.getState()
  const i = cards.findIndex((c) => c.id === id)
  if (i !== -1) navigate({ page: 'editor', slug: cardSlugs(cards.map((c) => c.name))[i] })
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
