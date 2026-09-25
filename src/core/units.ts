// All geometry in the core engine is in millimeters, origin at the top-left
// cut corner of the card.
export const CARD_W = 63
export const CARD_H = 88
/** corner radius of the cut line */
export const CARD_R = 3

/** mm at a resolution: pixels at `dpi`, or points at 72 */
export const mmToPx = (mm: number, dpi: number): number => (mm / 25.4) * dpi

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** mm value → SVG attribute string: 3 decimals, no trailing noise, no -0 */
export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}
