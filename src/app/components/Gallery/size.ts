// How wide the gallery draws a card: the size slider's stops, and the width
// last picked on it, kept across visits.
// Each stop is the last one times the same ratio, so every step looks as big
// as the next and the initial width, the middle stop, sits mid-slider. A
// picked width is kept in pixels and comes back as the nearest stop, so it
// survives a change to the stops; the initial width isn't kept at all, so a
// change to it reaches everyone who hasn't picked another.

const MIN = 140
const MAX = 500
const STEPS = 18

/** the width at a stop, from 0 at the smallest to `steps` at the largest */
export function widthAt(stop: number): number {
  return Math.round(MIN * (MAX / MIN) ** (stop / STEPS))
}

/** the stop nearest a width, off the ends of the slider too */
export function stopOf(width: number): number {
  const stop = Math.round((STEPS * Math.log(width / MIN)) / Math.log(MAX / MIN))
  return Math.min(STEPS, Math.max(0, stop))
}

export const CARD_WIDTH = { min: MIN, max: MAX, steps: STEPS, initial: widthAt(STEPS / 2) }

const KEY = 'tm-cardgen.galleryCardWidth'

/** a stored width as the nearest stop on the slider; the initial width when
 *  there is none, or it isn't a width */
export function widthFrom(stored: string | null): number {
  const n = stored === null ? NaN : Number.parseFloat(stored)
  if (!Number.isFinite(n) || n <= 0) return CARD_WIDTH.initial
  return widthAt(stopOf(n))
}

export function storedWidth(): number {
  try {
    return widthFrom(localStorage.getItem(KEY))
  } catch {
    return CARD_WIDTH.initial
  }
}

/** keeps a picked width for the next visit; the initial width by keeping
 *  none, so the gallery opens at whatever the initial width is by then */
export function storeWidth(width: number) {
  try {
    if (width === CARD_WIDTH.initial) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(width))
  } catch {
    // private mode: the gallery opens at the initial width next time
  }
}
