// The any-player halo: a red-to-yellow ring behind an icon, in a fixed
// shape per icon family (the registry's `halo` in icons.ts).
import type { HaloShape } from '../icons.ts'
import { fmt } from '../units.ts'
import { MC } from './megacredit.ts'
import { linear, oklab, rampStops } from './paint.ts'
import { ovalPath, polyPath, roundedRectPath, type Pt } from './paths.ts'

export const HALO = {
  /** ring width in mm; scaled down for icons shorter than `fullFrom` */
  width: 0.5,
  fullFrom: 6.7,
  /** the share of the ring the layout counts as the icon's box */
  counted: 0.75,
  /** full-size mm from the shape's center at which the sweep reaches red */
  streak: 2.5,
  /** the card icon's corner radius as a share of its width */
  cardCorner: 0.05,
  paint: oklab([
    [0, '#e42426'],
    [0.5, '#ffea00'],
    [1, '#e42426'],
  ]),
}
const STOPS = rampStops(HALO.paint)

/** the hexagon stands at the left of its box; every other shape fills it */
export function haloCenter(shape: HaloShape, w: number, h: number): Pt {
  return [shape === 'hexagon' ? (h * Math.sqrt(3)) / 4 : w / 2, h / 2]
}

/** half-width at the shape's narrowest piece */
export function haloSpan(shape: HaloShape, w: number, h: number): number {
  switch (shape) {
    case 'hexagon':
      return (h * Math.sqrt(3)) / 4
    case 'bust':
      return BUST.headRx * w
    case 'thermometer':
      return w / 4
    default:
      return w / 2
  }
}

/** head proportions as shares of the box: half-width, widest y, chin y */
const BUST = { headRx: 0.329, wide: 0.225, chin: 0.61 }

/** the straight-sided shapes' corners, centered on the origin */
function corners(shape: HaloShape, w: number, h: number): Pt[] | undefined {
  const hw = w / 2
  const hh = h / 2
  switch (shape) {
    case 'box':
      return [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ]
    case 'octagon': {
      // the coin's 45° corner cut, scaled with it
      const c = (h * MC.cut) / MC.size
      return [
        [c - hw, -hh],
        [hw - c, -hh],
        [hw, c - hh],
        [hw, hh - c],
        [hw - c, hh],
        [c - hw, hh],
        [-hw, hh - c],
        [-hw, c - hh],
      ]
    }
    case 'hexagon': {
      const r = (h * Math.sqrt(3)) / 4
      return [
        [0, -hh],
        [r, -hh / 2],
        [r, hh / 2],
        [0, hh],
        [-r, hh / 2],
        [-r, -hh / 2],
      ]
    }
    case 'triangle':
      return [
        [0, -hh],
        [hw, hh],
        [-hw, hh],
      ]
    default:
      return undefined
  }
}

/** the outline the ring strokes, centered on the origin */
export function haloPath(shape: HaloShape, w: number, h: number): string {
  const hw = w / 2
  const hh = h / 2
  switch (shape) {
    case 'circle':
      return ovalPath(0, 0, hw, hh)
    case 'card':
      return roundedRectPath(-hw, -hh, w, h, HALO.cardCorner * w)
    case 'bust': {
      const rx = BUST.headRx * w
      const wide = BUST.wide * h - hh
      const chin = BUST.chin * h - hh
      const [k, k1, k2] = [0.5523, 0.34, 0.5]
      const ky = wide - k * (wide + hh)
      const cy = wide + k1 * (chin - wide)
      const at = (x: number, y: number) => `${fmt(x)} ${fmt(y)}`
      const head =
        `M ${at(-rx, wide)} C ${at(-rx, ky)} ${at(-k * rx, -hh)} ${at(0, -hh)} ` +
        `C ${at(k * rx, -hh)} ${at(rx, ky)} ${at(rx, wide)} ` +
        `C ${at(rx, cy)} ${at(k2 * rx, chin)} ${at(0, chin)} ` +
        `C ${at(-k2 * rx, chin)} ${at(-rx, cy)} ${at(-rx, wide)} Z`
      const top = 0.63 * h - hh
      const r = [0.165 * w, 0.165 * w, 0.06 * w, 0.06 * w] as const
      return `${head} ${roundedRectPath(-hw, top, w, hh - top, 0, [...r])}`
    }
    case 'thermometer': {
      const s = w / 4
      const bulbY = hh - hw
      const stem =
        `M ${fmt(-s)} ${fmt(bulbY)} L ${fmt(-s)} ${fmt(s - hh)} ` +
        `A ${fmt(s)} ${fmt(s)} 0 0 1 ${fmt(s)} ${fmt(s - hh)} L ${fmt(s)} ${fmt(bulbY)} Z`
      return `${stem} ${ovalPath(0, bulbY, hw, hw)}`
    }
    default:
      return polyPath(corners(shape, w, h)!)
  }
}

/** the ring at box (x, y, w, h), drawn at full size and scaled by `scale`;
 *  `id` must be unique per ring */
export function haloMarkup(
  shape: HaloShape,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  id: string,
): string {
  const [cx, cy] = haloCenter(shape, w, h)
  const at =
    `translate(${fmt(x + cx)} ${fmt(y + cy)})` + (scale === 1 ? '' : ` scale(${fmt(scale)})`)
  const [fw, fh] = [w / scale, h / scale]
  const span = Math.min(HALO.streak, haloSpan(shape, fw, fh))
  return (
    `<g transform="${at}"><defs>${linear(id, [-span, 0], [span, 0], STOPS)}</defs>` +
    `<path d="${haloPath(shape, fw, fh)}" ` +
    `fill="url(#${id})" stroke="url(#${id})" stroke-width="${fmt(2 * HALO.width)}"/></g>`
  )
}
