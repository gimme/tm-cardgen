// The frame renderer: spec.ts geometry and paint to an SVG <g> string. The
// skeleton draws base, ring, outline and gem; the families draw the rest.
import type { FrameColor } from '../layout/frames.ts'
import { CARD_H, CARD_W, fmt } from '../units.ts'
import { blueParts } from './blue.ts'
import { greenParts } from './green.ts'
import { MC_AT, mcBody, mcDefs } from './megacredit.ts'
import { linear, rampStops, type Ramp } from './paint.ts'
import { roundedRectPath } from './paths.ts'
import { path, sheenDef, windowPath, type FamilyParts, type FrameGeometry } from './pieces.ts'
import { redParts } from './red.ts'
import { FAMILY, INTERIOR, RING } from './spec.ts'

export type { FrameGeometry } from './pieces.ts'

/** one frame as a `<g>` with its own `<defs>`. HTML resolves `url(#…)`
 *  document-wide, so mounting two frames in one page needs a unique
 *  `instance` on at least one. */
export function renderFrameMarkup(
  color: FrameColor,
  geo: FrameGeometry,
  instance?: string,
): string {
  const defs: string[] = []
  const body: string[] = []
  defs.push(sheenDef())
  cardBase(body)
  ringPlate(defs, body, FAMILY[color].ring)
  PARTS[color](defs, body, geo)
  interiorOutline(body)
  costGem(defs, body)
  const markup = `<g><defs>${defs.join('')}</defs>${body.join('')}</g>`
  if (instance === undefined) return markup
  const p = `frame-${instance}-`
  return markup.replaceAll('id="frame-', `id="${p}`).replaceAll('(#frame-', `(#${p}`)
}

const PARTS: Record<FrameColor, FamilyParts> = {
  green: greenParts,
  red: redParts,
  blue: blueParts,
}

/** white base with the window punched out, so the art region stays transparent */
function cardBase(body: string[]): void {
  const outer = roundedRectPath(0, 0, CARD_W, CARD_H, 0)
  body.push(path(`${outer} ${windowPath()}`, `fill="#ffffff" fill-rule="evenodd"`))
}

/** four mitered pieces of one cyclic ramp, overlapping past center against
 *  antialiasing cracks */
function ringPlate(defs: string[], body: string[], ring: Ramp): void {
  const { x0, y0, x1, y1, r } = RING
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const lap = 0.3
  const plate = roundedRectPath(x0, y0, x1 - x0, y1 - y0, r)
  const [w, h] = [x1 - x0, y1 - y0]
  const P = 2 * (w + h)
  const [tr, br, bl] = [w / P, (w + h) / P, (2 * w + h) / P]
  defs.push(
    `<clipPath id="frame-ring-clip"><path clip-rule="evenodd" d="${plate} ${windowPath()}"/></clipPath>`,
    linear('frame-ring-top', [x0, 0], [x1, 0], rampStops(ring, 0, tr)),
    linear('frame-ring-right', [0, y0], [0, y1], rampStops(ring, tr, br)),
    linear('frame-ring-bottom', [x1, 0], [x0, 0], rampStops(ring, br, bl)),
    linear('frame-ring-left', [0, y1], [0, y0], rampStops(ring, bl, 1)),
  )
  const tri = (a: string, b: string, apex: string, fill: string) =>
    `<polygon points="${a} ${b} ${apex}" fill="url(#${fill})"/>`
  const p = (x: number, y: number) => `${fmt(x)},${fmt(y)}`
  body.push(
    `<g clip-path="url(#frame-ring-clip)">` +
      tri(p(x0, y0), p(x1, y0), p(cx, cy + lap), 'frame-ring-top') +
      tri(p(x0, y1), p(x1, y1), p(cx, cy - lap), 'frame-ring-bottom') +
      tri(p(x0, y0), p(x0, y1), p(cx + lap, cy), 'frame-ring-left') +
      tri(p(x1, y0), p(x1, y1), p(cx - lap, cy), 'frame-ring-right') +
      `</g>`,
  )
}

/** drawn after the interior pieces to cover their SPILL overshoot */
function interiorOutline(body: string[]): void {
  const { x0, x1, top, bottom, r, stroke: s } = INTERIOR
  const outer = roundedRectPath(x0 - s, top - s, x1 - x0 + 2 * s, bottom - top + 2 * s, r + s)
  body.push(path(`${outer} ${windowPath()}`, `fill="#000000" fill-rule="evenodd"`))
}

function costGem(defs: string[], body: string[]): void {
  defs.push(mcDefs('frame-gem'))
  body.push(`<g transform="translate(${fmt(MC_AT.x)} ${fmt(MC_AT.y)})">${mcBody('frame-gem')}</g>`)
}
