// Dragging cards about the gallery, to put them in another order. A card
// pressed and moved with the mouse follows it, raised over the rest, which
// make way where it would land, around a dashed hole; dropped, it settles
// into the hole. A card in a selection of more than one brings the rest of
// the selection, stacked under it, and they spread out after it once it is
// dropped. Near the view's top or bottom, or past it, the view scrolls;
// Escape puts every card back.
// The cards move by transforms, set here on their <li>s, which React leaves
// alone, so a drag renders the gallery only as it starts and as it ends.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'
import { dropped, edgeScroll, gapAt, heldSlots, nearestSlot, type Point } from './drag.ts'

// how far the mouse moves with its button down before a press is a drag
const THRESHOLD = 5
// how near the view's top or bottom a drag scrolls it, and how fast at
// most, in px a frame
const EDGE = 60
const MAX_SCROLL = 24

export interface Held {
  /** the cards dragged, in their order */
  ids: readonly string[]
  /** the card under the pointer, which the rest are stacked under */
  leader: string
}

interface Drag extends Held {
  dragged: ReadonlySet<string>
  /** the cards as the drag found them, and their tiles */
  order: readonly string[]
  tiles: HTMLElement[]
  /** each tile's place in the grid, by its offset, and their size */
  slots: Point[]
  size: Point
  /** the grid's width the slots were measured at */
  width: number
  /** the pointer from the leader's top-left corner, and in the window */
  grab: Point
  pointer: Point
  /** where the dragged cards would land, among the rest; -1 until the
   *  first frame */
  gap: number
  /** each tile's shift from its slot */
  shifts: Point[]
  frame: number
  stop: () => void
}

const ORIGIN: Point = { x: 0, y: 0 }

const translate = (p: Point) => (p.x || p.y ? `translate(${p.x}px, ${p.y}px)` : '')

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))

const tilesOf = (grid: HTMLElement) => [
  ...grid.querySelectorAll<HTMLElement>(':scope > li[data-card-id]'),
]

/** each tile's place in the grid: its layout's, which a transform doesn't
 *  move */
function measure(d: Pick<Drag, 'tiles' | 'slots' | 'size'>) {
  d.slots = d.tiles.map((li) => ({ x: li.offsetLeft, y: li.offsetTop }))
  d.size = { x: d.tiles[0].offsetWidth, y: d.tiles[0].offsetHeight }
}

function shift(d: Drag, i: number, to: Point) {
  const by = { x: to.x - d.slots[i].x, y: to.y - d.slots[i].y }
  if (by.x === d.shifts[i].x && by.y === d.shifts[i].y) return
  d.shifts[i] = by
  d.tiles[i].style.transform = translate(by)
}

/** A frame of the drag: the view scrolled at an edge, the dragged cards
 *  under the pointer, and, once the gap under them moves, the rest making
 *  way for it */
function frame(d: Drag, grid: HTMLElement, view: HTMLElement, hole: HTMLElement | null) {
  const box = view.getBoundingClientRect()
  view.scrollTop += edgeScroll(d.pointer.y, box.top, box.bottom, EDGE, MAX_SCROLL)
  let moved = false
  if (grid.clientWidth !== d.width) {
    d.width = grid.clientWidth
    measure(d)
    moved = true
  }
  const g = grid.getBoundingClientRect()
  // kept inside the grid: past it, it would make room to scroll into
  const at = {
    x: clamp(d.pointer.x - g.left - d.grab.x, 0, grid.clientWidth - d.size.x),
    y: clamp(d.pointer.y - g.top - d.grab.y, 0, grid.clientHeight - d.size.y),
  }
  for (const [i, id] of d.order.entries()) if (d.dragged.has(id)) shift(d, i, at)

  // the slot under the leader's middle, as far as the view shows it
  const middle = {
    x: at.x + d.size.x / 2,
    y: clamp(at.y + d.size.y / 2, box.top - g.top, box.bottom - g.top),
  }
  const gap = gapAt(nearestSlot(d.slots, d.size, middle), d.order.length, d.dragged.size)
  if (gap === d.gap && !moved) return
  d.gap = gap
  for (const [i, slot] of heldSlots(d.order, d.dragged, gap).entries()) {
    if (slot !== undefined) shift(d, i, d.slots[slot])
  }
  if (hole) {
    hole.style.width = `${d.size.x}px`
    hole.style.height = `${d.size.y}px`
    hole.style.transform = `translate(${d.slots[gap].x}px, ${d.slots[gap].y}px)`
  }
}

/** Each tile, now in its place in the grid, sent back to where it showed,
 *  at once, and on into its place from there: the leader over the rest, and
 *  the rest of a selection out from under it */
function settle(grid: HTMLElement, from: Map<string, Point>, held: Held) {
  const tiles = tilesOf(grid)
  const back = tiles.map((li) => {
    const was = from.get(li.dataset.cardId!) ?? { x: li.offsetLeft, y: li.offsetTop }
    return { x: was.x - li.offsetLeft, y: was.y - li.offsetTop }
  })
  for (const [i, li] of tiles.entries()) {
    li.style.transition = 'none'
    li.style.transform = translate(back[i])
    const id = li.dataset.cardId!
    if (id !== held.leader && held.ids.includes(id)) li.style.opacity = '0'
  }
  // so the moves from there start there
  void grid.offsetWidth
  for (const li of tiles) {
    li.style.transition = ''
    li.style.transform = ''
    li.style.opacity = ''
  }
  const leader = tiles.find((li) => li.dataset.cardId === held.leader)
  if (leader) {
    leader.style.zIndex = '3'
    const landed = leader.getAnimations().map((a) => a.finished)
    void Promise.allSettled(landed).then(() => (leader.style.zIndex = ''))
  }
}

/** The next click, which a drop makes on the card it started on or another,
 *  ignored rather than taken as opening the card */
function swallowClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }))
}

/** `press`, on a pointerdown on a card, starts a drag of `ids` by `leader`
 *  once the mouse moves far enough; `held` is what is dragged meanwhile.
 *  A drop that moves the cards calls `onDrop` with them and the gap they
 *  land in, among the cards that stay. */
export function useCardDrag(
  gridRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  holeRef: RefObject<HTMLElement | null>,
  order: readonly string[],
  onDrop: (ids: readonly string[], gap: number) => void,
) {
  const [held, setHeld] = useState<Held>()
  const drag = useRef<Drag>(undefined)
  // a press not yet a drag, called to forget it
  const pending = useRef<() => void>(undefined)
  const latest = useRef({ order, onDrop })

  useLayoutEffect(() => {
    latest.current = { order, onDrop }
  })

  useLayoutEffect(() => {
    // the cards changed under the drag, by another tab say: it ends there,
    // the cards where they are now
    const d = drag.current
    if (d && (d.order.length !== order.length || d.order.some((id, i) => id !== order[i]))) {
      drag.current = undefined
      d.stop()
      for (const li of d.tiles) li.style.transform = ''
      setHeld(undefined)
    }
  }, [order])

  useEffect(
    () => () => {
      pending.current?.()
      drag.current?.stop()
    },
    [],
  )

  const end = useCallback(
    (drop: boolean) => {
      const d = drag.current
      if (!d) return
      drag.current = undefined
      d.stop()
      const from = new Map(
        d.order.map((id, i) => [
          id,
          { x: d.slots[i].x + d.shifts[i].x, y: d.slots[i].y + d.shifts[i].y },
        ]),
      )
      const next = drop ? dropped(d.order, d.dragged, d.gap) : d.order
      // the cards in their new order, and so their tiles, before they settle
      flushSync(() => {
        setHeld(undefined)
        if (next.some((id, i) => id !== d.order[i])) latest.current.onDrop(d.ids, d.gap)
      })
      const grid = gridRef.current
      if (grid) settle(grid, from, d)
    },
    [gridRef],
  )

  const begin = useCallback(
    (leader: string, ids: readonly string[], start: Point, pointer: Point) => {
      const grid = gridRef.current
      const view = scrollRef.current
      const { order } = latest.current
      const tiles = grid ? tilesOf(grid) : []
      if (!grid || !view || tiles.length !== order.length) return
      const dragged = new Set(ids)
      const d: Drag = {
        ids,
        leader,
        dragged,
        order,
        tiles,
        slots: [],
        size: ORIGIN,
        width: grid.clientWidth,
        grab: ORIGIN,
        pointer,
        gap: -1,
        shifts: tiles.map(() => ORIGIN),
        frame: 0,
        stop: () => {},
      }
      measure(d)
      const g = grid.getBoundingClientRect()
      const slot = d.slots[order.indexOf(leader)]
      d.grab = { x: start.x - g.left - slot.x, y: start.y - g.top - slot.y }

      const onMove = (e: PointerEvent) => (d.pointer = { x: e.clientX, y: e.clientY })
      const onUp = () => {
        end(true)
        swallowClick()
      }
      const onCancel = () => end(false)
      // before the gallery's own Escape, which would end the selection
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        end(false)
      }
      const tick = () => {
        frame(d, grid, view, holeRef.current)
        d.frame = requestAnimationFrame(tick)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('blur', onCancel)
      document.addEventListener('keydown', onKey, true)
      d.stop = () => {
        cancelAnimationFrame(d.frame)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('blur', onCancel)
        document.removeEventListener('keydown', onKey, true)
      }
      drag.current = d
      // the hole there to place in the first frame
      flushSync(() => setHeld({ ids, leader }))
      tick()
    },
    [gridRef, scrollRef, holeRef, end],
  )

  const press = useCallback(
    (e: ReactPointerEvent, leader: string, ids: readonly string[]) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || drag.current) return
      pending.current?.()
      const start = { x: e.clientX, y: e.clientY }
      const onMove = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - start.x, m.clientY - start.y) < THRESHOLD) return
        forget()
        begin(leader, ids, start, { x: m.clientX, y: m.clientY })
      }
      const forget = () => {
        pending.current = undefined
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', forget)
        window.removeEventListener('pointercancel', forget)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', forget)
      window.addEventListener('pointercancel', forget)
      pending.current = forget
    },
    [begin],
  )

  return { held, press }
}
