// How wide the gallery draws a card: the size slider's range, and the width
// last picked on it, kept across visits.

export const CARD_WIDTH = { min: 140, max: 500, step: 10, initial: 250 }

const KEY = 'tm-cardgen.galleryCardWidth'

/** a stored width as a stop on the slider; the initial width when there is
 *  none, or it isn't a number */
export function widthFrom(stored: string | null): number {
  const { min, max, step, initial } = CARD_WIDTH
  const n = stored === null ? NaN : Number.parseFloat(stored)
  if (!Number.isFinite(n)) return initial
  return Math.min(max, Math.max(min, min + Math.round((n - min) / step) * step))
}

export function storedWidth(): number {
  try {
    return widthFrom(localStorage.getItem(KEY))
  } catch {
    return CARD_WIDTH.initial
  }
}

export function storeWidth(width: number) {
  try {
    localStorage.setItem(KEY, String(width))
  } catch {
    // private mode: the gallery opens at the initial width next time
  }
}
