// The requirement box in the title banner's left corner: gold for a
// minimum, red for a maximum, the bare glyph column when there is none.
import { fmt } from '../units.ts'
import { stops } from './paint.ts'
import { polyPath, type Pt } from './paths.ts'

export const REQ_BOX = {
  /** left, top and height are fixed; the width is per card */
  x: 12.4,
  top: 3.98,
  h: 5.46,
  /** outside in: white margin, black border, gradient fill */
  margin: 0.34,
  border: 0.21,
  white: '#ffffff',
  /** outer width of the box with no requirement */
  emptyW: 1.86,
  /** glyph column bbox in card mm, the same at every width */
  glyph: {
    x: 13.08,
    y: 5.12,
    w: 0.55,
    h: 3.05,
    grid: [27, 149],
    /** y spans on the grid: upper bar, the Z's two blocks, lower bar */
    slabs: [
      [0, 18],
      [30, 47],
      [102, 119],
      [133, 149],
    ],
    /** the Z's diagonals: grid px left per px down */
    slope: 0.64,
  },
} as const

/** offsets as fractions of the inner width */
const MIN_STOPS = [
  [0, '#f3a30e'],
  [0.5, '#feee23'],
  [1, '#f3a30e'],
] as const

const MAX_STOPS = [
  [0, '#ff0000'],
  [0.06, '#ff0000'],
  [0.425, '#ffa517'],
  [0.575, '#ffa517'],
  [0.94, '#ff0000'],
  [1, '#ff0000'],
] as const

function glyphPath(): string {
  const G = REQ_BOX.glyph
  const [gw, gh] = G.grid
  const at = (ux: number, uy: number): Pt => [G.x + (ux * G.w) / gw, G.y + (uy * G.h) / gh]
  const slab = ([y0, y1]: readonly [number, number]) =>
    polyPath([at(0, y0), at(gw, y0), at(gw, y1), at(0, y1)])
  const dw = gw / 2
  const b1 = G.slabs[1][1] // top block's bottom edge
  const b2 = G.slabs[2][0] // bottom block's top edge
  const diag1 = polyPath([
    at(gw - dw, b1),
    at(gw, b1),
    at(0, b1 + gw / G.slope),
    at(0, b1 + (gw - dw) / G.slope),
  ])
  const diag2 = polyPath([
    at(0, b2),
    at(gw, b2 - gw / G.slope),
    at(gw, b2 - dw / G.slope),
    at(dw, b2),
  ])
  return `${G.slabs.map(slab).join(' ')} ${diag1} ${diag2}`
}

export function reqBoxMarkup(w: number, max: boolean, idPrefix = ''): string {
  const B = REQ_BOX
  const id = `${idPrefix}req-bg`
  const rect = (d: number, fill: string) =>
    `<rect x="${fmt(B.x + d)}" y="${fmt(B.top + d)}" width="${fmt(w - 2 * d)}" ` +
    `height="${fmt(B.h - 2 * d)}" fill="${fill}"/>`
  return (
    `<g><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">` +
    `${stops(max ? MAX_STOPS : MIN_STOPS)}</linearGradient></defs>` +
    rect(0, B.white) +
    rect(B.margin, '#000000') +
    rect(B.margin + B.border, `url(#${id})`) +
    `<path d="${glyphPath()}" fill="#000000"/></g>`
  )
}
