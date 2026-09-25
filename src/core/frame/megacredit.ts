// The megacredit gem: the cost gem at MC_AT and the inline {mc} icon.
// Geometry is local mm from the gem's top-left corner. The color ramps are
// keyed in card mm with the gem at MC_AT; the gradient builders shift them
// local. Where the detail line runs flush against the bevel band the two
// ramps hold the same color.
import { fmt } from '../units.ts'
import { linear, oklab, radial, rampStops, type Ramp } from './paint.ts'
import { polyPath, roundedPolyPath, type Pt } from './paths.ts'

/** the gem's top-left corner on the card, in card mm */
export const MC_AT = { x: 1.95, y: 1.87 }

export const MC = {
  /** outer bounds (square) and the 45° corner cut leg */
  size: 9.55,
  cut: 1.4,
  /** border octagon and bevel band widths, outside in; the bands touch */
  black: '#000000',
  blackW: 0.29,
  bevelW: 0.26,
  /** the detail line: stroke width `w`, inset to `dip` along each side
   *  between stubs at center ± `tab` (corners rounded `rTab`); the stroke
   *  bites `overlap` into the bevel band */
  line: { w: 0.19, dip: 1.63, tab: 1.94, rTab: 0.65, overlap: 0.03 },
  /** background radial: center and radius in card mm */
  bg: {
    cx: 6.2,
    cy: 5.8,
    r: 7.0,
    ramp: oklab([
      [0, '#ffee00'],
      [0.26, '#ffeb00'],
      [0.42, '#ffe000'],
      [0.64, '#fcbf01'],
      [0.71, '#f9ad05'],
      [0.77, '#f59912'],
      [0.83, '#f49416'],
      [1, '#f49416'],
    ]),
  },
  /** bevel band: stops in card mm y */
  bevel: oklab([
    [2.14, '#fdf8e3'],
    [2.4, '#f8f6ad'],
    [2.8, '#fbf005'],
    [4.2, '#fdef04'],
    [6.0, '#fbed12'],
    [8.0, '#f5e626'],
    [8.7, '#eddd27'],
    [9.2, '#dfae33'],
    [9.5, '#c07934'],
    [9.85, '#93302a'],
    [10.1, '#8e2724'],
    [11.19, '#8e2724'],
  ]),
  /** detail line: stops in card mm y. Non-monotonic on purpose: the sinks
   *  break the one loop into separate-looking pieces. */
  detail: oklab([
    [2.42, '#fef194'],
    [2.8, '#fbee10'],
    [3.12, '#fbee10'],
    [3.34, '#fffdf2'],
    [3.5, '#fbf4b1'],
    [4.05, '#f8e824'],
    [4.45, '#f0ce2d'],
    [4.58, '#c65327'],
    [4.75, '#c02c34'],
    [5.45, '#c53f2b'],
    [6.5, '#dc8a28'],
    [7.3, '#fcd207'],
    [7.65, '#fbee03'],
    [8.05, '#fcef0a'],
    [8.68, '#f9e795'],
    [8.82, '#cd8850'],
    [8.95, '#ab5a2c'],
    [9.3, '#8e2725'],
    [10.9, '#8c2924'],
  ]),
}

/** the octagon's cut leg at inset `d`: shrinking it by d(2−√2) keeps the
 *  diagonal edge inset exactly `d`, like the straight ones */
const cutAt = (d: number) => MC.cut - d * (2 - Math.SQRT2)

/** the gem octagon inset `d` from the outer bounds, as a path */
function octagon(d: number): string {
  const [a, b] = [d, MC.size - d]
  const c = cutAt(d)
  return polyPath([
    [a + c, a],
    [b - c, a],
    [b, a + c],
    [b, b - c],
    [b - c, b],
    [a + c, b],
    [a, b - c],
    [a, a + c],
  ])
}

/** the detail loop, clockwise from the top-left diagonal */
function detailPath(): string {
  const { w, dip, tab, rTab, overlap } = MC.line
  // the stroke's outer edge sits `overlap` into the bevel band
  const rail = MC.blackW + MC.bevelW - overlap + w / 2
  const mid = MC.size / 2
  const [lo, hi] = [rail, MC.size - rail]
  const [dlo, dhi] = [dip, MC.size - dip]
  const c = cutAt(rail)
  const verts: Pt[] = []
  const radii: number[] = []
  const v = (p: Pt, rr: number) => {
    verts.push(p)
    radii.push(rr)
  }
  // top
  v([lo + c, lo], 0)
  v([mid - tab, lo], 0)
  v([mid - tab, dlo], rTab)
  v([mid + tab, dlo], rTab)
  v([mid + tab, lo], 0)
  v([hi - c, lo], 0)
  // right
  v([hi, lo + c], 0)
  v([hi, mid - tab], 0)
  v([dhi, mid - tab], rTab)
  v([dhi, mid + tab], rTab)
  v([hi, mid + tab], 0)
  v([hi, hi - c], 0)
  // bottom
  v([hi - c, hi], 0)
  v([mid + tab, hi], 0)
  v([mid + tab, dhi], rTab)
  v([mid - tab, dhi], rTab)
  v([mid - tab, hi], 0)
  v([lo + c, hi], 0)
  // left
  v([lo, hi - c], 0)
  v([lo, mid + tab], 0)
  v([dlo, mid + tab], rTab)
  v([dlo, mid - tab], rTab)
  v([lo, mid - tab], 0)
  v([lo, lo + c], 0)
  return roundedPolyPath(verts, radii)
}

/** a ramp keyed in card mm y as a vertical gradient over its span, shifted local */
const vertical = (id: string, r: Ramp) => {
  const [y0, y1] = [r.knots[0][0], r.knots[r.knots.length - 1][0]]
  return linear(id, [0, y0 - MC_AT.y], [0, y1 - MC_AT.y], rampStops(r))
}

/** gradient defs `<prefix>-bg`, `-bevel`, `-line`: emit once per prefix per document */
export function mcDefs(prefix = 'mc'): string {
  return (
    radial(
      `${prefix}-bg`,
      [MC.bg.cx - MC_AT.x, MC.bg.cy - MC_AT.y],
      MC.bg.r,
      rampStops(MC.bg.ramp),
    ) +
    vertical(`${prefix}-bevel`, MC.bevel) +
    vertical(`${prefix}-line`, MC.detail)
  )
}

/** the gem in local mm, painted by the gradients from mcDefs with the same
 *  prefix; callers position it with a translate/scale wrapper */
export function mcBody(prefix = 'mc'): string {
  const path = (d: string, attrs: string) => `<path d="${d}" ${attrs}/>`
  return (
    path(octagon(0), `fill="${MC.black}"`) +
    path(octagon(MC.blackW), `fill="url(#${prefix}-bevel)"`) +
    path(octagon(MC.blackW + MC.bevelW), `fill="url(#${prefix}-bg)"`) +
    path(detailPath(), `fill="none" stroke="url(#${prefix}-line)" stroke-width="${fmt(MC.line.w)}"`)
  )
}
