// Red frame parts: the fire-glass band, the stepped divider and the slashed seam.
import { fmt } from '../units.ts'
import { crystalTexture, mixSeed } from './crystal.ts'
import { linear, mixHex, rampStops, rgba } from './paint.ts'
import {
  bandPath,
  extendEdge,
  lineEdge,
  offsetPolyline,
  polylineEdge,
  roundedRectPath,
} from './paths.ts'
import {
  bannerSheet,
  journeyDef,
  lineShadow,
  meltVec,
  panel,
  path,
  spanRect,
  spill,
  SPILL,
  type FrameGeometry,
} from './pieces.ts'
import { BANNER, INTERIOR, RED } from './spec.ts'

export function redParts(defs: string[], body: string[], geo: FrameGeometry): void {
  const { artBottom, seed = 0 } = geo
  redTagBand(defs, body, seed)
  redDivider(defs, body, artBottom, seed)
  redBanner(defs, body, geo.seamX ?? RED.seam.x)
}

/** the glass band between the banner and the window */
function redTagBand(defs: string[], body: string[], seed: number): void {
  const { x0, x1 } = INTERIOR
  const c = RED.crystal.tag
  const [top, bottom] = [RED.bandTop, RED.artTop]
  const strip = RED.bandTopStrip
  const trim = RED.bandBottomTrim
  const [gl, gr] = [RED.gloss.tagLeft, RED.gloss.tagRight]
  const trimTop = bottom - RED.windowStroke - trim.h
  const fillTop = BANNER.bottom
  const tex = crystalTexture('frame-tagband', { ...c, seed: mixSeed(c.seed, seed) }, RED.fireRamp)
  const [glDx, glDy] = meltVec(gl.grad)
  const [grDx, grDy] = meltVec(gr.grad)
  defs.push(
    `<clipPath id="frame-tagband-clip"><path d="${roundedRectPath(x0 - SPILL, fillTop, x1 - x0 + 2 * SPILL, bottom - fillTop, 0)}"/></clipPath>`,
    tex.defs,
    journeyDef('frame-red-bandtrim', RED.bandTrimRamp, [x0, x1], [x0, 0], [x1, 0]),
    linear(
      'frame-gloss-tagl',
      [gl.x, gl.y],
      [gl.x + glDx, gl.y + glDy],
      [
        [0, rgba(gl.hot, gl.alpha)],
        [0.1, rgba(mixHex(gl.hot, gl.mid, 0.25), gl.alpha * 0.96)],
        [0.35, rgba(mixHex(gl.hot, gl.mid, 0.65), gl.alpha * 0.88)],
        [0.6, rgba(mixHex(gl.mid, gl.tail, 0.35), gl.alpha * 0.62)],
        [1, rgba(gl.tail, 0)],
      ],
    ),
    linear(
      'frame-gloss-tagr',
      [gr.x1, trimTop],
      [gr.x1 - grDx, trimTop - grDy],
      [
        [0, rgba(gr.hot, gr.alpha)],
        [0.1, rgba(mixHex(gr.hot, gr.sat, 0.45), gr.alpha * 0.97)],
        [0.2, rgba(mixHex(gr.sat, gr.hot, 0.15), gr.alpha * 0.95)],
        [0.5, rgba(gr.mid, gr.alpha * 0.74)],
        [0.8, rgba(gr.mid, gr.alpha * 0.4)],
        [1, rgba(gr.mid, 0)],
      ],
    ),
  )
  body.push(
    `<g clip-path="url(#frame-tagband-clip)">` +
      tex.body +
      spanRect(top, strip.h, `fill="url(#frame-red-bandtrim)" fill-opacity="${fmt(strip.alpha)}"`) +
      lineShadow(defs) +
      path(redWedgePath(gr, trimTop), `fill="url(#frame-gloss-tagr)"`) +
      spanRect(
        trimTop,
        trim.h + RED.windowStroke / 2,
        `fill="url(#frame-red-bandtrim)" fill-opacity="${fmt(trim.alpha)}"`,
      ) +
      path(redStreakPath(gl), `fill="url(#frame-gloss-tagl)"`) +
      `</g>`,
    spanRect(bottom - RED.windowStroke, RED.windowStroke, `fill="#000000"`),
  )
}

/** the tagLeft gloss outline */
function redStreakPath(g: {
  x: number
  y: number
  w: number
  h: number
  rimH: number
  tip: number
  tipR: number
  rHot: number
  rFar: number
}): string {
  const [xr, yb] = [g.x + g.w, g.y + g.h]
  const [tx, ty] = [g.x + g.tip, yb - g.tipR]
  const d = Math.hypot(tx + g.tipR - xr, ty - g.y)
  const [fx, fy] = [xr + ((tx + g.tipR - xr) / d) * g.rFar, g.y + ((ty - g.y) / d) * g.rFar]
  const rimEnd = g.y + g.rimH
  const hookY = rimEnd + 0.68 * (ty - rimEnd)
  return (
    `M ${fmt(g.x + g.rHot)} ${fmt(g.y)} L ${fmt(xr - g.rFar)} ${fmt(g.y)} ` +
    `Q ${fmt(xr)} ${fmt(g.y)} ${fmt(fx)} ${fmt(fy)} ` +
    `L ${fmt(tx + g.tipR)} ${fmt(ty)} ` +
    `Q ${fmt(tx + g.tipR)} ${fmt(yb)} ${fmt(tx)} ${fmt(yb)} ` +
    `Q ${fmt(tx - g.tipR)} ${fmt(yb)} ${fmt(tx - g.tipR)} ${fmt(ty)} ` +
    `Q ${fmt(g.x)} ${fmt(hookY)} ${fmt(g.x)} ${fmt(rimEnd)} ` +
    `L ${fmt(g.x)} ${fmt(g.y + g.rHot)} ` +
    `Q ${fmt(g.x)} ${fmt(g.y)} ${fmt(g.x + g.rHot)} ${fmt(g.y)} Z`
  )
}

/** the tagRight gloss outline: a wedge with a bowed hypotenuse and rounded apex */
function redWedgePath(
  g: { x0: number; x1: number; topY: number; rTop: number; rBot: number; bow: number },
  yBot: number,
): string {
  const d = Math.hypot(g.x1 - g.x0, g.topY - yBot)
  const [ux, uy] = [(g.x1 - g.x0) / d, (g.topY - yBot) / d]
  const [hx, hy] = [g.x1 - ux * g.rTop, g.topY - uy * g.rTop]
  const [cx, cy] = [(g.x0 + hx) / 2 + uy * g.bow, (yBot + hy) / 2 - ux * g.bow]
  return (
    `M ${fmt(g.x0)} ${fmt(yBot)} ` +
    `Q ${fmt(cx)} ${fmt(cy)} ${fmt(hx)} ${fmt(hy)} ` +
    `Q ${fmt(g.x1)} ${fmt(g.topY)} ${fmt(g.x1)} ${fmt(g.topY + g.rTop)} ` +
    `L ${fmt(g.x1)} ${fmt(yBot - g.rBot)} ` +
    `Q ${fmt(g.x1)} ${fmt(yBot)} ${fmt(g.x1 - g.rBot)} ${fmt(yBot)} Z`
  )
}

/** the divider below the window and the panel under it. The stack uses
 *  offsetPolyline: a vertical shift would thin the lines on the steep steps. */
function redDivider(defs: string[], body: string[], artBottom: number, seed: number): void {
  const { x0, x1 } = INTERIOR
  const d = RED.divider
  const t = d.tab
  const ys = artBottom + d.bandBottom
  const contour = polylineEdge([
    [x0, ys],
    [t.from, ys],
    [t.from + t.ramp, ys + t.depth],
    [t.to - t.ramp, ys + t.depth],
    [t.to, ys],
    [x1, ys],
  ])
  const at = (dist: number) => extendEdge(offsetPolyline(contour, dist), SPILL)
  // the fill runs under the whole translucent trim: glass must back every sliver of it
  const fillTop = spill(lineEdge(x0, x1, artBottom + d.outline / 2))
  const fillBottom = at(d.trimH + d.stroke / 2)

  const c = RED.crystal.divider
  const box = {
    x0: x0 - 0.4,
    y0: artBottom - 0.3,
    x1: x1 + 0.4,
    y1: ys + t.depth + d.trimH + d.stroke / 2 + 0.3,
  }
  const tex = crystalTexture(
    'frame-divband',
    { box, ...c, seed: mixSeed(c.seed, seed) },
    RED.fireRamp,
  )
  const g = d.gloss
  const gcy = ys + t.depth + g.dy
  // the melt anchors at the full pill's corner, not the flattened flank
  const [gax, gay] = [g.cx + g.rx, gcy + g.ry]
  const [meltDx, meltDy] = meltVec(g.grad)
  defs.push(
    `<clipPath id="frame-divider-clip"><path d="${bandPath(fillTop, fillBottom)}"/></clipPath>`,
    tex.defs,
    journeyDef('frame-div-ribbon', d.trimRamp, [x0, x1], [x0, 0], [x1, 0]),
    journeyDef('frame-div-trim', d.trimRamp, [x0, x1], [x0 + d.trimDx, 0], [x1 + d.trimDx, 0]),
    journeyDef('frame-red-strip', d.strip, [x0, x1], [x0, 0], [x1, 0]),
    linear(
      'frame-gloss-tab',
      [gax, gay],
      [gax - meltDx, gay - meltDy],
      [
        [0, rgba(g.hot, g.alpha)],
        [0.1, rgba(g.hot, g.alpha)],
        [0.29, rgba(mixHex(g.hot, g.ink, 0.2), g.alpha * 0.94)],
        [0.47, rgba(g.ink, g.alpha * 0.76)],
        [0.62, rgba(g.ink, g.alpha * 0.58)],
        [0.76, rgba(g.ink, g.alpha * 0.42)],
        [0.9, rgba(g.ink, g.alpha * 0.16)],
        [1, rgba(g.ink, 0)],
      ],
    ),
  )
  // each layer overshoots to the next one's centerline
  const lap = (from: number, to: number) => bandPath(at(from), at(to))
  body.push(
    `<g clip-path="url(#frame-divider-clip)">` +
      tex.body +
      spanRect(
        artBottom + d.outline / 2,
        d.outline / 2 + d.ribbonH,
        `fill="url(#frame-div-ribbon)" fill-opacity="${fmt(d.trimAlpha)}"`,
      ) +
      `</g>`,
    spanRect(artBottom, d.outline, `fill="#000000"`),
    path(
      lap(0, d.trimH + d.stroke / 2),
      `fill="url(#frame-div-trim)" fill-opacity="${fmt(d.trimAlpha)}"`,
    ),
    path(lap(d.trimH, d.trimH + d.stroke + d.stripH / 2), `fill="#000000"`),
    path(
      lap(d.trimH + d.stroke, d.trimH + d.stroke + d.stripH + SPILL),
      `fill="url(#frame-red-strip)"`,
    ),
    path(
      redPoolPath(g, gcy, t.ramp / t.depth),
      `fill="url(#frame-gloss-tab)" clip-path="url(#frame-divider-clip)"`,
    ),
  )
  const stackH = d.trimH + d.stroke + d.stripH
  panel(defs, body, offsetPolyline(contour, stackH), artBottom + RED.numBoxDy)
}

/** the tab pool outline: a pill with its right flank flattened at the step's slant */
function redPoolPath(
  g: {
    cx: number
    rx: number
    ry: number
    k: number
    flatTop: number
    flatBot: number
    topRun: number
    tilt: number
  },
  cy: number,
  slant: number,
): string {
  const { cx, rx, ry, k } = g
  const [kx, ky] = [rx * k, ry * k]
  const [p1x, p1y] = [cx + rx + g.flatTop * slant, cy - g.flatTop]
  const [p2x, p2y] = [cx + rx - g.flatBot * slant, cy + g.flatBot]
  const hB = ((ry - g.flatBot) * k) / Math.hypot(1, slant)
  const [qlx, qly] = [cx - g.topRun, cy - ry + 2 * g.topRun * g.tilt]
  const [qrx, qry] = [cx + g.topRun, cy - ry]
  const hQl = ((rx - g.topRun) * k) / Math.hypot(1, g.tilt)
  // the shoulder control: where the top line meets the flank line
  const vt = (rx - g.topRun + ry * slant) / (1 - g.tilt * slant)
  const [vx, vy] = [qrx + vt, qry - vt * g.tilt]
  return (
    `M ${fmt(cx - rx)} ${fmt(cy)} ` +
    `C ${fmt(cx - rx)} ${fmt(cy - ky)} ${fmt(qlx - hQl)} ${fmt(qly + hQl * g.tilt)} ${fmt(qlx)} ${fmt(qly)} ` +
    `L ${fmt(qrx)} ${fmt(qry)} ` +
    `Q ${fmt(vx)} ${fmt(vy)} ${fmt(p1x)} ${fmt(p1y)} ` +
    `L ${fmt(p2x)} ${fmt(p2y)} ` +
    `C ${fmt(p2x - slant * hB)} ${fmt(p2y + hB)} ${fmt(cx + kx)} ${fmt(cy + ry)} ${fmt(cx)} ${fmt(cy + ry)} ` +
    `C ${fmt(cx - kx)} ${fmt(cy + ry)} ${fmt(cx - rx)} ${fmt(cy + ky)} ${fmt(cx - rx)} ${fmt(cy)} Z`
  )
}

function redBanner(defs: string[], body: string[], seamX: number): void {
  const s = RED.seam
  const seamTop = BANNER.seam.tipY
  const seamBot = BANNER.bottom + BANNER.stroke / 2
  const tipX = seamX - s.lean / 2
  const botX = seamX + s.lean / 2
  const ext = 1.0
  const extX = (ext / (seamBot - seamTop)) * s.lean
  defs.push(linear('frame-seam-stripe', [tipX, seamTop], [botX, seamBot], rampStops(s.stripe)))
  bannerSheet(defs, body, seamX, {
    d: `M ${fmt(tipX - extX)} ${fmt(seamTop - ext)} L ${fmt(botX + extX)} ${fmt(seamBot + ext)}`,
    centerW: s.stripeW,
    centerPaint: 'url(#frame-seam-stripe)',
    trimDx: s.trimDx,
  })
}
