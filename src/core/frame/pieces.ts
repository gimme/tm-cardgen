// Parts shared by every family: the SPILL discipline, paint helpers, the
// window path, the body panel, gloss pills and the title banner.
import { fmt } from '../units.ts'
import {
  linear,
  rampStops,
  rgba,
  toneStops,
  type Ramp,
  type Stops,
  type ToneField,
} from './paint.ts'
import {
  extendEdge,
  openPath,
  ovalPath,
  roundedRectPath,
  shiftEdge,
  type Edge,
  type Pt,
} from './paths.ts'
import { BANNER, INTERIOR, METAL, NUM_BOX, SHEEN } from './spec.ts'

/** named variants are preset values of `artBottom`; anything in between
 *  renders the same way */
export interface FrameGeometry {
  /** y of the art window's bottom edge (card mm) */
  artBottom: number
  /** blue only: the window top, grows the action area */
  artTop?: number
  /** seam anchor x; placeSeam (spec.ts) places it per card */
  seamX?: number
  /** crystal scatter salt; 0 or omitted is the authored pattern */
  seed?: number
}

/** what a family draws between the ring and the outline */
export type FamilyParts = (defs: string[], body: string[], geo: FrameGeometry) => void

/** Antialiasing leaks background between shapes that merely abut, so no
 *  two pieces abut: under a black line the layers run to its centerline;
 *  elsewhere the earlier piece overshoots by SPILL and a later opaque piece
 *  covers it. Every piece at the window edge spills under the keyline. */
export const SPILL = 0.08

export const path = (d: string, attrs: string) => `<path d="${d}" ${attrs}/>`
export const rect = (x: number, y: number, w: number, h: number, attrs: string) =>
  `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs}/>`
export const ellipse = (cx: number, cy: number, rx: number, ry: number, attrs: string) =>
  `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" ${attrs}/>`

/** the edge shifted by `dy`, spilling past the window sides under the keyline */
export const spill = (edge: Edge, dy = 0) => extendEdge(shiftEdge(edge, dy), SPILL)

/** full-window-width rect, spilling past the window sides under the keyline */
export const spanRect = (y: number, h: number, attrs: string) =>
  rect(INTERIOR.x0 - SPILL, y, INTERIOR.x1 - INTERIOR.x0 + 2 * SPILL, h, attrs)

/** two-stop gradient of one color fading between alphas */
export const fade = (hex: string, a0: number, a1: number): Stops => [
  [0, rgba(hex, a0)],
  [1, rgba(hex, a1)],
]

/** a gloss melt's run as a vector: `angle` degrees off vertical, `len` mm */
export const meltVec = (g: { angle: number; len: number }): [number, number] => [
  g.len * Math.sin((g.angle * Math.PI) / 180),
  g.len * Math.cos((g.angle * Math.PI) / 180),
]

/** stops at `alpha` dipping to `mid` between the four dip x's */
export function dipStops(
  ink: string,
  alpha: number,
  mid: number,
  [a, b, c, d]: readonly [number, number, number, number],
  x0: number,
  x1: number,
): Stops {
  const off = (x: number) => (x - x0) / (x1 - x0)
  return [
    [0, rgba(ink, alpha)],
    [off(a), rgba(ink, alpha)],
    [off(b), rgba(ink, mid)],
    [off(c), rgba(ink, mid)],
    [off(d), rgba(ink, alpha)],
    [1, rgba(ink, alpha)],
  ]
}

export function sheenDef(): string {
  const rad = (SHEEN.angle * Math.PI) / 180
  const [ux, uy] = [Math.cos(rad), Math.sin(rad)]
  const [ox, oy] = SHEEN.origin
  const len = (INTERIOR.x1 - ox) * ux + (INTERIOR.bottom - oy) * uy
  return linear('frame-sheen', [ox, oy], [ox + ux * len, oy + uy * len], toneStops(SHEEN, 0, len))
}

/** paint compiled over domain [a, b], laid from p0 to p1 in card mm */
export function journeyDef(
  id: string,
  paint: Ramp | ToneField,
  [a, b]: [number, number],
  p0: [number, number],
  p1: [number, number],
): string {
  return linear(id, p0, p1, 'bands' in paint ? toneStops(paint, a, b) : rampStops(paint, a, b))
}

/** the window path; `grow` offsets it outward so SPILL overshoot stays
 *  under the keyline */
export function windowPath(grow = 0): string {
  return roundedRectPath(
    INTERIOR.x0 - grow,
    INTERIOR.top - grow,
    INTERIOR.x1 - INTERIOR.x0 + 2 * grow,
    INTERIOR.bottom - INTERIOR.top + 2 * grow,
    INTERIOR.r + grow,
  )
}

/** body panel with the number box; sides and bottom overshoot by SPILL
 *  under the keyline */
export function panel(defs: string[], body: string[], top: Edge, numCy: number): void {
  const { x0, x1, bottom, r } = INTERIOR
  const [px0, px1, pb, pr] = [x0 - SPILL, x1 + SPILL, bottom + SPILL, r + SPILL]
  const d =
    `${openPath(extendEdge(top, SPILL))} ` +
    `L ${fmt(px1)} ${fmt(pb - pr)} a ${fmt(pr)} ${fmt(pr)} 0 0 1 ${fmt(-pr)} ${fmt(pr)} ` +
    `L ${fmt(px0 + pr)} ${fmt(pb)} a ${fmt(pr)} ${fmt(pr)} 0 0 1 ${fmt(-pr)} ${fmt(-pr)} Z`
  body.push(path(d, `fill="url(#frame-sheen)"`))

  const { cx, w, h, bevel } = NUM_BOX
  const [bx, by] = [cx - w / 2, numCy - h / 2]
  const [bx1, by1] = [bx + w, by + h]
  // the bevel loop's corner params, clockwise from the bottom-left miter
  const P = 2 * (w + h)
  const [tl, tr, br] = [h / P, (h + w) / P, (2 * h + w) / P]
  const loop = METAL.numBoxBevel
  defs.push(
    linear('frame-numbox-left', [0, by1], [0, by], rampStops(loop, 0, tl)),
    linear('frame-numbox-top', [bx, 0], [bx1, 0], rampStops(loop, tl, tr)),
    linear('frame-numbox-right', [0, by], [0, by1], rampStops(loop, tr, br)),
    linear('frame-numbox-bottom', [bx1, 0], [bx, 0], rampStops(loop, br, 1)),
  )
  // each face reaches past the bevel so no ground shows at the corner seams
  const D = bevel + 0.2
  const quad = (pts: [number, number][], fill: string) =>
    `<polygon points="${pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}" fill="url(#${fill})"/>`
  body.push(
    rect(bx, by1 - D, w, D, `fill="url(#frame-numbox-bottom)"`),
    quad(
      [
        [bx, by1],
        [bx, by],
        [bx + D, by],
        [bx + D, by1 - D],
      ],
      'frame-numbox-left',
    ),
    quad(
      [
        [bx, by],
        [bx1, by],
        [bx1, by + D],
        [bx + D, by + D],
      ],
      'frame-numbox-top',
    ),
    quad(
      [
        [bx1, by],
        [bx1, by1],
        [bx1 - D, by1 - D],
        [bx1 - D, by + D],
      ],
      'frame-numbox-right',
    ),
    rect(bx + bevel, by + bevel, w - 2 * bevel, h - 2 * bevel, `fill="url(#frame-sheen)"`),
  )
}

export function lineShadow(defs: string[]): string {
  const s = BANNER.underShadow
  const top = BANNER.bottom + BANNER.stroke / 2
  defs.push(linear('frame-line-shadow', [0, top], [0, top + s.h], fade(s.ink, s.alpha, 0)))
  return spanRect(top, s.h, `fill="url(#frame-line-shadow)"`)
}

/** an oval dissolved by one linear gradient: top to bottom by default, or
 *  from a top corner `angle` degrees off vertical for `len` mm (the sign
 *  picks the corner). `tilt` rotates both. */
export function glossPill(
  defs: string[],
  id: string,
  p: { cx: number; top: number; rx: number; ry: number; k: number },
  stops: Stops,
  opts: { tilt?: number; grad?: { angle: number; len: number } } = {},
): string {
  if (opts.grad) {
    const [dx, dy] = meltVec(opts.grad)
    const [x0, y0] = [p.cx - Math.sign(opts.grad.angle) * p.rx, p.top]
    defs.push(linear(id, [x0, y0], [x0 + dx, y0 + dy], stops))
  } else {
    defs.push(linear(id, [0, p.top], [0, p.top + 2 * p.ry], stops))
  }
  const pill = path(ovalPath(p.cx, p.top + p.ry, p.rx, p.ry, p.k), `fill="url(#${id})"`)
  if (!opts.tilt) return pill
  return `<g transform="rotate(${fmt(opts.tilt)} ${fmt(p.cx)} ${fmt(p.top + p.ry)})">${pill}</g>`
}

// ---- banner -------------------------------------------------------------

/** the family's seam; the centerline and the trim pattern both follow
 *  seamX */
export interface BannerSeam {
  /** centerline path; must overshoot the seam's vertical span so the tilted
   *  butt caps land outside the clips (seamD does this) */
  d: string
  /** the colored center: its stroke width and paint */
  centerW: number
  centerPaint: string
  /** how far right of seamX the trim pattern anchors */
  trimDx?: number
}

/** a seam centerline with tangent extensions past both ends */
export function seamD(tipX: number, botX: number, ctrl: Pt[]): string {
  const top = BANNER.seam.tipY
  const bot = BANNER.bottom + BANNER.stroke / 2
  const ext = 1.0
  const [cx0, cy0] = ctrl[0]
  const [cx1, cy1] = ctrl[ctrl.length - 1]
  const extTop = (ext / (cy0 - top)) * (cx0 - tipX)
  const extBot = (ext / (bot - cy1)) * (botX - cx1)
  const mid =
    ctrl.length === 1
      ? `Q ${fmt(cx0)} ${fmt(cy0)}`
      : `C ${fmt(cx0)} ${fmt(cy0)} ${fmt(cx1)} ${fmt(cy1)}`
  return (
    `M ${fmt(tipX - extTop)} ${fmt(top - ext)} ` +
    `L ${fmt(tipX)} ${fmt(top)} ${mid} ${fmt(botX)} ${fmt(bot)} ` +
    `L ${fmt(botX + extBot)} ${fmt(bot + ext)}`
  )
}

export function bannerSheet(defs: string[], body: string[], seamX: number, seam: BannerSeam): void {
  const { top, bottom, stroke, trim } = BANNER
  const { tipY, flankW } = BANNER.seam
  const { x0, x1 } = INTERIOR
  const metalTop = top + stroke / 2
  const metalBot = bottom - stroke / 2
  const seamBot = bottom + stroke / 2

  defs.push(
    `<clipPath id="frame-seam-clip">` +
      `<rect x="${fmt(x0)}" y="${fmt(tipY)}" width="${fmt(x1 - x0)}" height="${fmt(seamBot - tipY)}"/>` +
      `</clipPath>`,
    `<clipPath id="frame-trim-clip">` +
      `<rect x="${fmt(x0)}" y="${fmt(top)}" width="${fmt(x1 - x0)}" height="${fmt(bottom - top)}"/>` +
      `</clipPath>`,
    `<clipPath id="frame-window-clip"><path d="${windowPath(SPILL)}"/></clipPath>`,
    journeyDef(
      'frame-banner-trim',
      trim,
      [x0 - seamX - (seam.trimDx ?? 0), x1 - seamX - (seam.trimDx ?? 0)],
      [x0, 0],
      [x1, 0],
    ),
  )

  const trimFill = `fill="url(#frame-banner-trim)"`
  body.push(`<g clip-path="url(#frame-window-clip)">`)
  body.push(
    spanRect(top, bottom - top, `fill="url(#frame-sheen)"`),
    spanRect(top, metalTop - top + trim.h, trimFill),
    spanRect(metalBot - trim.h, trim.h + bottom - metalBot, trimFill),
    // same gradient as the horizontal runs, so the crossings vanish
    `<g clip-path="url(#frame-trim-clip)">` +
      path(
        seam.d,
        `fill="none" stroke="url(#frame-banner-trim)" ` +
          `stroke-width="${fmt(seam.centerW + 2 * (flankW + trim.h))}"`,
      ) +
      `</g>`,
    spanRect(top - stroke / 2 - SPILL, stroke + SPILL, `fill="#000000"`),
    spanRect(bottom - stroke / 2, stroke, `fill="#000000"`),
    `<g clip-path="url(#frame-seam-clip)">` +
      path(
        seam.d,
        `fill="none" stroke="#000000" stroke-width="${fmt(seam.centerW + 2 * flankW)}"`,
      ) +
      path(seam.d, `fill="none" stroke="${seam.centerPaint}" stroke-width="${fmt(seam.centerW)}"`) +
      `</g>`,
  )
  body.push(`</g>`)
}
