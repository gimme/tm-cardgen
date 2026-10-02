// Where the gallery's cards go while some are dragged, and once they are
// dropped. The dragged cards come out of the order; the rest close up, with
// a gap among them where the dragged ones would land. Slots are the places
// in the grid, by index, as the cards fill them before the drag.

export interface Point {
  x: number
  y: number
}

/** the slot whose middle is nearest `p`; `slots` are the slots' top-left
 *  corners, each `size` big */
export function nearestSlot(slots: readonly Point[], size: Point, p: Point): number {
  let nearest = 0
  let best = Infinity
  for (const [i, slot] of slots.entries()) {
    const d = Math.hypot(slot.x + size.x / 2 - p.x, slot.y + size.y / 2 - p.y)
    if (d < best) {
      best = d
      nearest = i
    }
  }
  return nearest
}

/** the gap a drag over `slot` opens: the dragged cards land where the card
 *  in that slot was, or at the end, past the last of the rest */
export function gapAt(slot: number, count: number, dragged: number): number {
  return Math.min(slot, count - dragged)
}

/** each card's slot while the dragged ones are held over `gap`, by its index
 *  in `order`: the rest close up, those from the gap on one slot later, to
 *  leave the gap open. The dragged cards have none */
export function heldSlots(
  order: readonly string[],
  dragged: ReadonlySet<string>,
  gap: number,
): (number | undefined)[] {
  let rest = 0
  return order.map((id) => {
    if (dragged.has(id)) return undefined
    const slot = rest < gap ? rest : rest + 1
    rest++
    return slot
  })
}

/** the order with the dragged cards dropped into `gap`, in the order they
 *  had */
export function dropped(
  order: readonly string[],
  dragged: ReadonlySet<string>,
  gap: number,
): string[] {
  const rest = order.filter((id) => !dragged.has(id))
  rest.splice(gap, 0, ...order.filter((id) => dragged.has(id)))
  return rest
}

/** how far to scroll the view this frame for a pointer at `y`, in px: up
 *  (negative) within `edge` of its top or past it, down likewise, faster the
 *  nearer the pointer is to the edge, up to `max` at it */
export function edgeScroll(y: number, top: number, bottom: number, edge: number, max: number) {
  const up = (top + edge - y) / edge
  const down = (y - (bottom - edge)) / edge
  if (up > 0) return -Math.round(max * Math.min(1, up))
  if (down > 0) return Math.round(max * Math.min(1, down))
  return 0
}
