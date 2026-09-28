// The gallery's selection: which cards, and the card a Shift-click ranges from.

export interface Selection {
  ids: ReadonlySet<string>
  /** the card last picked on its own */
  anchor?: string
}

export const NO_SELECTION: Selection = { ids: new Set() }

/** `id` in or out; it becomes the anchor either way */
export function toggled(sel: Selection, id: string): Selection {
  const ids = new Set(sel.ids)
  if (!ids.delete(id)) ids.add(id)
  return { ids, anchor: id }
}

/** every card from the anchor to `id` added, the anchor kept; without an
 *  anchor, `id` added and made the anchor */
export function extended(sel: Selection, order: readonly string[], id: string): Selection {
  const from = sel.anchor === undefined ? -1 : order.indexOf(sel.anchor)
  const to = order.indexOf(id)
  if (to === -1) return sel
  if (from === -1) return { ids: new Set([...sel.ids, id]), anchor: id }
  const range = order.slice(Math.min(from, to), Math.max(from, to) + 1)
  return { ids: new Set([...sel.ids, ...range]), anchor: sel.anchor }
}

/** the selection with `gone` taken out */
export function without(sel: Selection, gone: readonly string[]): Selection {
  const ids = new Set([...sel.ids].filter((id) => !gone.includes(id)))
  const anchor = sel.anchor !== undefined && gone.includes(sel.anchor) ? undefined : sel.anchor
  return { ids, anchor }
}
