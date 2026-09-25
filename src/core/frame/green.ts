// Green frame parts: the glass bands above and below the window and the bowed seam.
import { fmt } from '../units.ts'
import { blurDef, contourGlints, crystalTexture, mixSeed, type CrystalSpec } from './crystal.ts'
import { linear, mixHex, profileStops, radial, rampAt, rampStops, rgba } from './paint.ts'
import {
  arcEdge,
  bandPath,
  bumpEdge,
  bumpSideY,
  edgeYat,
  lineEdge,
  openPath,
  roundedPolyPath,
  roundedRectPath,
  shiftEdge,
  type BumpEdge,
  type Edge,
} from './paths.ts'
import {
  bannerSheet,
  dipStops,
  ellipse,
  fade,
  glossPill,
  journeyDef,
  lineShadow,
  meltVec,
  panel,
  path,
  seamD,
  spanRect,
  spill,
  SPILL,
  type FrameGeometry,
} from './pieces.ts'
import { BANNER, GREEN, greenBottomEdge, INTERIOR, METAL } from './spec.ts'

const RIM = GREEN.rim
const RIM_TOTAL = RIM.black * 2 + RIM.silver

export function greenParts(defs: string[], body: string[], geo: FrameGeometry): void {
  const { artBottom, seed = 0 } = geo
  const botSpec = greenBottomEdge(artBottom)
  const topE = bumpEdge({ ...GREEN.bump, centerY: GREEN.artTop }, INTERIOR.x0, INTERIOR.x1)
  const botE = bumpEdge(botSpec, INTERIOR.x0, INTERIOR.x1)
  defs.push(linear('frame-rim', [INTERIOR.x0, 0], [INTERIOR.x1, 0], rampStops(METAL.rim)))
  greenTagBand(defs, body, topE, seed)
  rimSandwich(body, shiftEdge(topE, -RIM_TOTAL))
  greenDivider(defs, body, botSpec, botE, artBottom, seed)
  greenBanner(defs, body, geo.seamX ?? GREEN.seam.x)
}

/** the glass band between the banner and the window */
function greenTagBand(defs: string[], body: string[], topE: Edge, seed: number): void {
  const { x0, x1 } = INTERIOR
  const c = GREEN.crystal.tag
  // the fill overshoots on every side; the layers over it trim it
  const fill = bandPath(
    spill(lineEdge(x0, x1, BANNER.bottom)),
    spill(topE, -RIM_TOTAL + RIM.black / 2),
  )
  const tex = crystalTexture(
    'frame-tagband',
    { ...c, seed: mixSeed(c.seed, seed) },
    GREEN.crystalRamp,
  )
  const [gl, grt, grb] = [GREEN.gloss.tagLeft, GREEN.gloss.tagRightTop, GREEN.gloss.tagRightBot]
  const rim = shiftEdge(topE, -RIM_TOTAL)
  const [botL, botR] = [edgeYat(rim, grb.xL) - grb.gap, edgeYat(rim, grb.x1) - grb.gap]
  const [glDx, glDy] = meltVec(gl.grad)
  const [rtDx, rtDy] = meltVec(grt.grad)
  const [rbDx, rbDy] = meltVec(grb.grad)
  const sc = rampAt(GREEN.crystalRamp, c.shadow.level)
  defs.push(
    `<clipPath id="frame-tagband-clip"><path d="${fill}"/></clipPath>`,
    tex.defs,
    linear(
      'frame-tagband-shine',
      [x0, 0],
      [x1, 0],
      profileStops(GREEN.crystalRamp, c.shine.profile, x0, x1),
    ),
    linear(
      'frame-tagband-shadow',
      [x0, 0],
      [x1, 0],
      dipStops(sc, c.shadow.alpha, 0, c.shadow.clear, x0, x1),
    ),
    linear(
      'frame-gloss-tagl',
      [gl.x, gl.y],
      [gl.x + glDx, gl.y + glDy],
      [
        [0, rgba(mixHex(GREEN.glossGold, GREEN.glossBright, 0.3), gl.alpha)],
        [0.35, rgba(mixHex(GREEN.glossGold, GREEN.glossBright, 0.7), gl.alpha * 0.52)],
        [0.7, rgba(GREEN.glossBright, gl.alpha * 0.26)],
        [1, rgba(GREEN.glossBright, 0)],
      ],
    ),
    linear(
      'frame-gloss-tagrt',
      [grt.x1, grt.top],
      [grt.x1 - rtDx, grt.top + rtDy],
      [
        [0, rgba(mixHex(GREEN.glossGold, GREEN.glossBright, 0.5), grt.hot)],
        [0.1, rgba(mixHex(GREEN.glossGold, GREEN.glossBright, 0.75), grt.hot * 0.84)],
        [0.24, rgba(GREEN.glossBright, grt.alpha)],
        [1, rgba(GREEN.glossBright, 0)],
      ],
    ),
    linear(
      'frame-gloss-tagrb',
      [grb.x1, botR],
      [grb.x1 - rbDx, botR - rbDy],
      [
        [0, rgba(mixHex(GREEN.glossGold, GREEN.glossBright, 0.4), grb.hot)],
        [0.3, rgba(GREEN.glossBright, grb.alpha)],
        [0.6, rgba(GREEN.glossBright, grb.alpha * 0.36)],
        [1, rgba(GREEN.glossBright, 0)],
      ],
    ),
  )
  body.push(
    `<g clip-path="url(#frame-tagband-clip)">` +
      tex.body +
      spanRect(BANNER.bottom, BANNER.stroke / 2 + c.shine.h, `fill="url(#frame-tagband-shine)"`) +
      lineShadow(defs) +
      `<g filter="url(#frame-tagband-haze)">` +
      path(
        bandPath(spill(topE, -RIM_TOTAL - c.shadow.h), spill(topE, -RIM_TOTAL + RIM.black / 2)),
        `fill="url(#frame-tagband-shadow)"`,
      ) +
      contourGlints(rim, { ...c.glints, seed: mixSeed(c.glints.seed, seed) }, GREEN.crystalRamp) +
      `</g>` +
      path(streakPath(gl), `fill="url(#frame-gloss-tagl)"`) +
      path(
        roundedPolyPath(
          [
            [grt.xL, grt.top],
            [grt.x1, grt.top],
            [grt.x1, grt.cutR],
            [grt.xL, grt.cutL],
          ],
          [0, grt.rHot, grt.rFar, 0],
        ),
        `fill="url(#frame-gloss-tagrt)"`,
      ) +
      path(
        roundedPolyPath(
          [
            [grb.xL, grb.cutL],
            [grb.x1, grb.cutR],
            [grb.x1, botR],
            [grb.xL, botL],
          ],
          [0, grb.rFar, grb.rHot, 0],
        ),
        `fill="url(#frame-gloss-tagrb)"`,
      ) +
      `</g>`,
  )
}

/** the tagLeft gloss outline */
function streakPath(g: {
  x: number
  y: number
  w: number
  h: number
  taper: number
  sweep: number
  rHot: number
  rFar: number
}): string {
  const [xr, yb] = [g.x + g.w, g.y + g.h]
  // the far corner's arc lands on the sloped cut, rFar down the edge
  const d = Math.hypot(g.taper, g.h)
  const [fx, fy] = [xr - (g.taper / d) * g.rFar, g.y + (g.h / d) * g.rFar]
  const yt = g.y + g.rHot
  return (
    `M ${fmt(g.x + g.rHot)} ${fmt(g.y)} L ${fmt(xr - g.rFar)} ${fmt(g.y)} ` +
    `Q ${fmt(xr)} ${fmt(g.y)} ${fmt(fx)} ${fmt(fy)} ` +
    `L ${fmt(xr - g.taper)} ${fmt(yb)} L ${fmt(g.x + g.sweep)} ${fmt(yb)} ` +
    `Q ${fmt(g.x)} ${fmt(yt + 0.55 * (yb - yt))} ${fmt(g.x)} ${fmt(yt)} ` +
    `Q ${fmt(g.x)} ${fmt(g.y)} ${fmt(g.x + g.rHot)} ${fmt(g.y)} Z`
  )
}

/** black/silver/black ribbons along a window edge; the silver runs through
 *  to both strokes' centerlines. `lowerBlack` narrows the lower stroke. */
function rimSandwich(body: string[], edge: Edge, lowerBlack = RIM.black): void {
  const at = (dy: number) => spill(edge, dy)
  const stroke = (dy: number, w: number) =>
    path(openPath(at(dy)), `fill="none" stroke="#000000" stroke-width="${fmt(w)}"`)
  body.push(
    path(bandPath(at(RIM.black / 2), at(RIM_TOTAL - lowerBlack / 2)), `fill="url(#frame-rim)"`),
    stroke(RIM.black / 2, RIM.black),
    stroke(RIM_TOTAL - lowerBlack / 2, lowerBlack),
  )
}

/** everything from the window bottom down to the body panel */
function greenDivider(
  defs: string[],
  body: string[],
  botSpec: BumpEdge,
  botE: Edge,
  artBottom: number,
  seed: number,
): void {
  const { x0, x1 } = INTERIOR
  const div = GREEN.divider
  const bandTop = shiftEdge(botE, RIM_TOTAL)
  const bandBottom = arcEdge(
    x0,
    x1,
    artBottom + div.bandBottomSide,
    artBottom + div.bandBottomCenter,
  )
  // the fill overshoots under the rim stroke and under its own outline
  const fillTop = spill(bandTop, -RIM.bottomBlack / 2)
  const fillBottom = spill(bandBottom, div.bandStroke / 2)
  const sideTop = bumpSideY(botSpec) + RIM_TOTAL
  const centerTop = botSpec.centerY + RIM_TOTAL

  const c = GREEN.crystal.divider
  const box = {
    x0: x0 - 0.4,
    y0: centerTop - 0.3,
    x1: x1 + 0.4,
    y1: artBottom + div.bandBottomSide + 0.3,
  }
  const spec: CrystalSpec = {
    box,
    seed: mixSeed(c.seed, seed),
    ground: c.ground,
    shards: c.shards,
    bokeh: c.bokeh,
    glows: [{ ...c.endGlow, y: sideTop + c.endGlow.dy }],
    bubbles: { ...c.bubbles, y: centerTop + c.bubbles.dy },
  }
  const tex = crystalTexture('frame-divband', spec, GREEN.crystalRamp)
  const [gl, gr, gc] = [GREEN.gloss.divLeft, GREEN.gloss.divRight, GREEN.gloss.divTopCap]
  const sideBottom = artBottom + div.bandBottomSide
  defs.push(
    `<clipPath id="frame-divider-clip"><path d="${bandPath(fillTop, fillBottom)}"/></clipPath>`,
    tex.defs,
    linear(
      'frame-divband-shine',
      [x0, 0],
      [x1, 0],
      profileStops(GREEN.crystalRamp, c.shine.profile, x0, x1),
    ),
    blurDef('frame-divband-gloss', box, gr.blur),
    radial(
      'frame-gloss-divr',
      [gr.cx, sideBottom + gr.dy],
      [gr.rx, gr.ry],
      [
        [0, rgba(GREEN.glossGold, gr.alpha)],
        [0.4, rgba(GREEN.glossBright, gr.alpha * 0.65)],
        [1, rgba(GREEN.glossBright, 0)],
      ],
    ),
    `<clipPath id="frame-gloss-divr-clip"><path d="${roundedRectPath(
      gr.bounds.x0,
      sideBottom - gr.bounds.rise,
      gr.bounds.x1 - gr.bounds.x0,
      gr.bounds.rise + gr.bounds.drop,
      gr.bounds.r,
    )}"/></clipPath>`,
  )
  body.push(
    `<g clip-path="url(#frame-divider-clip)">` +
      tex.body +
      path(bandPath(fillTop, spill(bandTop, c.shine.h)), `fill="url(#frame-divband-shine)"`) +
      `<g filter="url(#frame-divband-haze)">` +
      path(
        bandPath(spill(bandBottom, -c.shadow.h), fillBottom),
        `fill="${rampAt(GREEN.crystalRamp, c.shadow.level)}" opacity="${fmt(c.shadow.alpha)}"`,
      ) +
      contourGlints(
        bandBottom,
        { ...c.glints, seed: mixSeed(c.glints.seed, seed) },
        GREEN.crystalRamp,
      ) +
      `</g>` +
      `<g filter="url(#frame-divband-gloss)">` +
      `<g clip-path="url(#frame-gloss-divr-clip)">` +
      ellipse(gr.cx, sideBottom + gr.dy, gr.rx, gr.ry, `fill="url(#frame-gloss-divr)"`) +
      `</g>` +
      `</g>` +
      // the left cap is warm parchment: white reads minty over the green
      glossPill(
        defs,
        'frame-gloss-divl',
        { ...gl, top: edgeYat(bandTop, gl.cx) + gl.dy },
        [
          [0, rgba('#e4d6be', gl.alpha)],
          [0.12, rgba('#e4d6be', gl.alpha)],
          [0.35, rgba('#e4d6be', gl.alpha * 0.68)],
          [0.7, rgba('#e4d6be', gl.alpha * 0.38)],
          [1, rgba('#e4d6be', 0)],
        ],
        {
          tilt:
            (Math.atan((edgeYat(bandTop, gl.cx + 1) - edgeYat(bandTop, gl.cx - 1)) / 2) * 180) /
            Math.PI,
          grad: gl.grad,
        },
      ) +
      glossPill(
        defs,
        'frame-gloss-divc',
        { ...gc, top: centerTop + gc.dy },
        fade('#ffffff', 0.92, 0),
      ) +
      `</g>`,
  )
  rimSandwich(body, botE, RIM.bottomBlack)

  // each layer overshoots into the next, which covers the excess
  const strokeBot = shiftEdge(bandBottom, div.bandStroke)
  const stripBot = shiftEdge(strokeBot, div.stripH)
  defs.push(journeyDef('frame-panel-strip', METAL.panelStrip, [x0, x1], [x0, 0], [x1, 0]))
  body.push(
    path(bandPath(spill(bandBottom), spill(strokeBot, div.stripH / 2)), `fill="#000000"`),
    path(bandPath(spill(strokeBot), spill(stripBot, SPILL)), `fill="url(#frame-panel-strip)"`),
  )
  panel(defs, body, stripBot, artBottom + GREEN.numBoxDy)
}

function greenBanner(defs: string[], body: string[], seamX: number): void {
  const s = GREEN.seam
  const seamTop = BANNER.seam.tipY
  const seamBot = BANNER.bottom + BANNER.stroke / 2
  const tipX = seamX - s.botDx / 2
  const botX = seamX + s.botDx / 2
  const apexX = seamX + s.bow
  // control point derived so the curve passes through the apex
  const ctrlX = 2 * apexX - (tipX + botX) / 2
  const ctrlY = 2 * s.apexY - (seamTop + seamBot) / 2
  bannerSheet(defs, body, seamX, {
    d: seamD(tipX, botX, [[ctrlX, ctrlY]]),
    centerW: s.sliverW,
    centerPaint: GREEN.seamFill,
  })
}
