// Blue frame parts: the action area and title plate, the divider with its pill, and the S seam.
import { fmt } from '../units.ts'
import { blurDef, bubbleTexture, mixSeed } from './crystal.ts'
import {
  linear,
  mixHex,
  profileAt,
  profileStops,
  rampAt,
  rampStops,
  rgba,
  type Stops,
} from './paint.ts'
import {
  bandPath,
  edgeVerts,
  edgeYat,
  extendEdge,
  lineEdge,
  offsetPolyline,
  openPath,
  polylineEdge,
  polyPath,
  roundedPolyPath,
  roundedRectPath,
  type Edge,
  type Pt,
} from './paths.ts'
import {
  bannerSheet,
  dipStops,
  fade,
  glossPill,
  journeyDef,
  meltVec,
  panel,
  path,
  seamD,
  spanRect,
  spill,
  SPILL,
  windowPath,
  type FrameGeometry,
} from './pieces.ts'
import { BANNER, BLUE, INTERIOR } from './spec.ts'

export function blueParts(defs: string[], body: string[], geo: FrameGeometry): void {
  blueActionArea(defs, body, geo.artTop ?? BLUE.artTop)
  bluePlate(defs, body, geo.seed ?? 0)
  blueBanner(defs, body, geo.seamX ?? BLUE.seam.x)
  // the divider last: everything above artBottom must stay byte-identical
  // between heights (render.test)
  blueDivider(defs, body, geo.artBottom, geo.seed ?? 0)
}

/** the title plate over the action area */
function bluePlate(defs: string[], body: string[], seed: number): void {
  const p = BLUE.plate
  const ramp = BLUE.crystalRamp
  const { x0, x1 } = INTERIOR
  const topY = BANNER.bottom
  const [ax, ay] = p.bow.apex
  const [sx, sy] = p.bow.side
  const K = (ay - sy) / (ax - sx) ** 2
  /** the rim grown `g` outward; a vertical drop stands in for the normal
   *  since the bow is shallow */
  const rim = (g: number): Edge => {
    const [xl, xr] = [p.left - g, p.right + g]
    const drop = (x: number) => ay - K * (x - ax) ** 2 + g
    const pts: Pt[] = [[xl, topY]]
    for (let x = xl; x < xr - 1e-9; x += (xr - xl) / 26) pts.push([x, drop(x)])
    pts.push([xr, drop(xr)], [xr, topY])
    return polylineEdge(pts)
  }
  const closed = (g: number): string => `${openPath(rim(g))} Z`

  const c = p.bubbles
  const tex = bubbleTexture('frame-plate', { ...c, seed: mixSeed(c.seed, seed) }, ramp)
  const ink = rampAt(ramp, p.shadow.level)
  const [gl, gr] = [p.gloss.left, p.gloss.right]
  const grTop = topY + BANNER.stroke / 2 + gr.gap
  const bowY = (x: number) => ay - K * (x - ax) ** 2
  const [glBotL, glBotR] = [bowY(gl.x0) - gl.seat, bowY(gl.xR) - gl.seat]
  const [glDx, glDy] = meltVec(gl.grad)
  const [grDx, grDy] = meltVec(gr.grad)
  defs.push(
    `<clipPath id="frame-plate-clip"><path d="${closed(0)}"/></clipPath>`,
    tex.defs,
    blurDef('frame-plate-rim', c.box, p.shadow.blur),
    journeyDef('frame-plate-strip', p.strip.ramp, [x0, x1], [x0, 0], [x1, 0]),
    linear(
      'frame-plate-shadow',
      [p.left, 0],
      [p.right, 0],
      dipStops(ink, p.shadow.alpha, p.shadow.mid, p.shadow.dip, p.left, p.right),
    ),
    linear(
      'frame-plate-topshadow',
      [0, topY],
      [0, topY + p.stroke / 2 + p.shadow.top],
      fade(ink, p.shadow.alpha, 0),
    ),
    linear('frame-plate-glossl', [gl.x0, glBotL], [gl.x0 + glDx, glBotL - glDy], plateGloss(gl)),
    linear('frame-plate-glossr', [gr.x1, grTop], [gr.x1 - grDx, grTop + grDy], plateGloss(gr)),
  )
  body.push(
    path(closed(p.stroke / 2 + p.strip.h), `fill="url(#frame-plate-strip)"`),
    `<g clip-path="url(#frame-plate-clip)">` +
      tex.body +
      spanRect(topY, BANNER.stroke / 2 + p.shine.h, `fill="${p.shine.ink}"`) +
      spanRect(topY, p.stroke / 2 + p.shadow.top, `fill="url(#frame-plate-topshadow)"`) +
      `<g filter="url(#frame-plate-rim)">` +
      path(
        openPath(rim(0)),
        `fill="none" stroke="url(#frame-plate-shadow)" ` +
          `stroke-width="${fmt(p.stroke + 2 * p.shadow.h)}"`,
      ) +
      `</g>` +
      path(
        roundedPolyPath(
          [
            [gl.x0, gl.cutL],
            [gl.xR, gl.cutR],
            [gl.xR, glBotR],
            [gl.x0, glBotL],
          ],
          [gl.rFar, 0, 0, gl.rHot],
        ),
        `fill="url(#frame-plate-glossl)"`,
      ) +
      path(
        roundedPolyPath(
          [
            [gr.xL, grTop],
            [gr.x1, grTop],
            [gr.x1, gr.cutR],
            [gr.xL, gr.cutL],
          ],
          [0, gr.rHot, gr.rFar, 0],
        ),
        `fill="url(#frame-plate-glossr)"`,
      ) +
      `</g>`,
    path(closed(0), `fill="none" stroke="#000000" stroke-width="${fmt(p.stroke)}"`),
  )
}

const plateGloss = (g: { hot: string; mid: string; alpha: number }): Stops => [
  [0, rgba(g.hot, g.alpha)],
  [0.32, rgba(mixHex(g.hot, g.mid, 0.5), g.alpha * 0.8)],
  [0.65, rgba(g.mid, g.alpha * 0.3)],
  [1, rgba(g.mid, 0)],
]

/** the action area between the banner and the window; any artTop depth renders */
function blueActionArea(defs: string[], body: string[], artTop: number): void {
  const { x0, x1 } = INTERIOR
  const { contour: c, stack: s, trim, strip } = BLUE.action
  const mid = (x0 + x1) / 2
  const endY = artTop - c.endRise
  const tabY = endY + c.tabDrop
  const kinkL: Pt = [mid - c.troughX, endY + c.left.drop]
  const kinkR: Pt = [mid + c.troughX, endY + c.right.drop]

  /** quadratic control point: where the end tangents meet */
  const meet = (p: Pt, sp: number, q: Pt, sq: number): Pt => {
    const x = (q[1] - p[1] + sp * p[0] - sq * q[0]) / (sp - sq)
    return [x, p[1] + sp * (x - p[0])]
  }
  const pts: Pt[] = [[x0, endY]]
  const quad = (P0: Pt, P1: Pt, P2: Pt, n: number): void => {
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      pts.push([
        u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
        u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1],
      ])
    }
  }
  quad([x0, endY], meet([x0, endY], c.left.cornerSlope, kinkL, c.left.troughSlope), kinkL, 24)
  quad(kinkL, [kinkL[0] + c.left.ease, tabY], [mid - c.tabX, tabY], 10)
  pts.push([mid + c.tabX, tabY])
  quad([mid + c.tabX, tabY], [kinkR[0] - c.right.ease, tabY], kinkR, 10)
  quad(kinkR, meet(kinkR, -c.right.troughSlope, [x1, endY], -c.right.cornerSlope), [x1, endY], 24)
  const contour = polylineEdge(pts)
  const at = (dist: number) => extendEdge(offsetPolyline(contour, dist), SPILL)

  // the trim is one constant-width ring around the sheet, drawn as three
  // pieces since one gradient cannot turn a corner; the contour piece overlaps the climbs by `lap`
  const topY = BANNER.bottom
  const [oL, oR] = [x0 - SPILL, x1 + SPILL]
  const [iL, iR] = [x0 + trim.h, x1 - trim.h]
  /** a contour offset cut to the ring's inside span */
  const clip = (e: Edge, xa: number, xb: number): Pt[] => [
    [xa, edgeYat(e, xa)],
    ...edgeVerts(e).filter(([x]) => x > xa && x < xb),
    [xb, edgeYat(e, xb)],
  ]
  const outer = clip(contour, oL, oR)
  const inner = clip(offsetPolyline(contour, -(s.k1 / 2 + trim.h)), iL, iR)
  const lap = 0.25
  const climb = (ox: number, ix: number, oy: number, iy: number): Pt[] => [
    [ox, topY],
    [ox, oy],
    [ix, iy],
    [ix, topY],
  ]
  const ring: Pt[] = [
    [oL, outer[0][1] - lap],
    ...outer,
    [oR, outer[outer.length - 1][1] - lap],
    [iR, inner[inner.length - 1][1] - lap],
    ...inner.slice().reverse(),
    [iL, inner[0][1] - lap],
  ]

  defs.push(
    `<clipPath id="frame-action-clip"><path d="${windowPath(SPILL)}"/></clipPath>`,
    journeyDef('frame-action-strip', strip, [x0, x1], [x0, 0], [x1, 0]),
    // the climbs are keyed in mm above their corner so the pieces agree at any depth
    journeyDef('frame-action-trim', trim.along, [x0, x1], [x0, 0], [x1, 0]),
    journeyDef('frame-action-trim-l', trim.left, [0, endY - topY], [0, endY], [0, topY]),
    journeyDef('frame-action-trim-r', trim.right, [0, endY - topY], [0, endY], [0, topY]),
  )

  body.push(
    `<g clip-path="url(#frame-action-clip)">` +
      path(bandPath(spill(lineEdge(x0, x1, BANNER.bottom)), at(0)), `fill="url(#frame-sheen)"`) +
      path(polyPath(climb(oL, iL, outer[0][1], inner[0][1])), `fill="url(#frame-action-trim-l)"`) +
      path(
        polyPath(climb(oR, iR, outer[outer.length - 1][1], inner[inner.length - 1][1])),
        `fill="url(#frame-action-trim-r)"`,
      ) +
      path(polyPath(ring), `fill="url(#frame-action-trim)"`) +
      // the last keyline ends exactly at the art hole's rim
      path(bandPath(at(-s.k1 / 2), at(s.k1 / 2 + s.stripH / 2)), `fill="#000000"`) +
      path(
        bandPath(at(s.k1 / 2), at(s.k1 / 2 + s.stripH + s.k2 / 2)),
        `fill="url(#frame-action-strip)"`,
      ) +
      path(bandPath(at(s.k1 / 2 + s.stripH), at(s.k1 / 2 + s.stripH + s.k2)), `fill="#000000"`) +
      `</g>`,
  )
}

/** the divider below the window and everything under it. The contour detours
 *  over the pill's grown silhouette; k2, the ribbon and k3 follow the bare bow behind the pill. */
function blueDivider(defs: string[], body: string[], artBottom: number, seed: number): void {
  const { x0, x1 } = INTERIOR
  const d = BLUE.divider
  const s = d.stack
  const p = d.pill
  const ramp = BLUE.crystalRamp

  const B: [Pt, Pt, Pt, Pt] = [
    [x0, artBottom + d.bow.yL],
    [d.bow.c1[0], artBottom + d.bow.c1[1]],
    [d.bow.c2[0], artBottom + d.bow.c2[1]],
    [x1, artBottom + d.bow.yR],
  ]
  const bowPt = (t: number): Pt => {
    const u = 1 - t
    return [
      u * u * u * B[0][0] + 3 * u * u * t * B[1][0] + 3 * u * t * t * B[2][0] + t * t * t * B[3][0],
      u * u * u * B[0][1] + 3 * u * u * t * B[1][1] + 3 * u * t * t * B[2][1] + t * t * t * B[3][1],
    ]
  }
  const bowPts: Pt[] = []
  for (let i = 0; i <= 72; i++) bowPts.push(bowPt(i / 72))
  const bow = polylineEdge(bowPts)

  // grown silhouettes the contours detour around: g0 above the pill, g1 below
  const [px0, px1] = [p.cx - p.w / 2, p.cx + p.w / 2]
  const [pTop, pBot] = [artBottom + p.top, artBottom + p.top + p.h]
  const g0 = p.stroke / 2 + s.stripH + s.k1 / 2
  const g1 = p.stroke / 2 + d.band.h
  /** silhouette y at x, grown by g0 above (side −1) or g1 below (+1); undefined outside its span */
  const silY = (x: number, side: 1 | -1): number | undefined => {
    const rg = p.r + (side < 0 ? g0 : g1)
    if (x <= px0 + p.r - rg || x >= px1 - p.r + rg) return undefined
    const cx = x < px0 + p.r ? px0 + p.r : x > px1 - p.r ? px1 - p.r : x
    return (side < 0 ? pTop + p.r : pBot - p.r) + side * Math.sqrt(rg * rg - (x - cx) ** 2)
  }
  /** the base polyline detoured around the grown silhouette, with kinks at the crossings */
  const detour = (base: Pt[], side: 1 | -1): Edge => {
    const past = (q: Pt) => {
      const sy = silY(q[0], side)
      return sy !== undefined && side * (q[1] - sy) < 0
    }
    const cross = (out: Pt, inn: Pt): Pt => {
      const baseY = (x: number) => out[1] + ((inn[1] - out[1]) * (x - out[0])) / (inn[0] - out[0])
      let [lo, hi] = [out[0], inn[0]]
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2
        const sy = silY(m, side)
        if (sy !== undefined && side * (baseY(m) - sy) < 0) hi = m
        else lo = m
      }
      const x = (lo + hi) / 2
      return [x, silY(x, side) ?? baseY(x)]
    }
    const pts: Pt[] = []
    for (let i = 0; i < base.length; i++) {
      if (!past(base[i])) {
        pts.push(base[i])
        continue
      }
      const kinkL = cross(base[i - 1], base[i])
      let j = i
      while (j < base.length && past(base[j])) j++
      const kinkR = cross(base[j], base[j - 1])
      pts.push(kinkL)
      for (let x = kinkL[0] + 0.15; x < kinkR[0] - 0.075; x += 0.15) pts.push([x, silY(x, side)!])
      pts.push(kinkR)
      i = j - 1
    }
    return polylineEdge(pts)
  }
  const contour = detour(bowPts, -1)
  const at = (dist: number) => extendEdge(offsetPolyline(contour, dist), SPILL)
  const bowAt = (dist: number) => extendEdge(offsetPolyline(bow, dist), SPILL)

  // stack boundary depths off the k1 centerline
  const oStrip = s.k1 / 2 + s.stripH
  const oRibbon = oStrip + s.k2 + s.ribbonH
  const oBand = oRibbon + s.k3 + d.band.h
  const bandBase = offsetPolyline(bow, oBand)
  const bandBottom = detour(edgeVerts(bandBase), 1)
  const lowAt = (dist: number) => extendEdge(offsetPolyline(bandBottom, dist), SPILL)

  const pillPath = roundedRectPath(px0, pTop, p.w, p.h, p.r)
  const rimBox = { x0: px0 - 1, y0: pTop - 1, x1: px1 + 1, y1: pBot + 1 }
  const c = p.bubbles
  // the texture box overshoots the outline; the pill clip trims it
  const glassBox = { x0: px0 - 0.5, y0: pTop - 0.5, x1: px1 + 0.5, y1: pBot + 0.5 }
  const tex = bubbleTexture(
    'frame-pill',
    { box: glassBox, ground: p.ground, ...c, seed: mixSeed(c.seed, seed) },
    ramp,
  )
  const g = p.gloss

  defs.push(
    `<clipPath id="frame-divider-clip"><path d="${windowPath(SPILL)}"/></clipPath>`,
    `<clipPath id="frame-pill-clip"><path d="${pillPath}"/></clipPath>`,
    tex.defs,
    journeyDef('frame-div-strip', d.strip, [x0, x1], [x0, 0], [x1, 0]),
    linear('frame-div-ribbon', [x0, 0], [x1, 0], profileStops(ramp, d.ribbon, x0, x1)),
    journeyDef('frame-div-band', d.band.ramp, [x0, x1], [x0, 0], [x1, 0]),
    blurDef('frame-pill-rim', rimBox, p.settle.blur),
    linear('frame-pill-settle', [0, pBot], [0, pTop], rampStops(p.settle.ramp)),
  )

  body.push(`<g clip-path="url(#frame-divider-clip)">`)
  panel(defs, body, lowAt(-d.band.h / 2), artBottom + BLUE.numBoxDy)
  body.push(
    path(bandPath(at(oStrip), lowAt(0)), `fill="url(#frame-div-band)"`),
    path(bandPath(at(-s.k1 / 2), at(s.k1 / 2 + s.stripH / 2)), `fill="#000000"`),
    path(bandPath(at(s.k1 / 2), at(oStrip + s.k2 / 2)), `fill="url(#frame-div-strip)"`),
    path(bandPath(bowAt(oStrip), bowAt(oStrip + s.k2 + s.ribbonH / 2)), `fill="#000000"`),
    path(
      bandPath(bowAt(oStrip + s.k2), bowAt(oRibbon + s.k3 / 2)),
      `fill="url(#frame-div-ribbon)"`,
    ),
    path(bandPath(bowAt(oRibbon), bowAt(oRibbon + s.k3)), `fill="#000000"`),
    `<g clip-path="url(#frame-pill-clip)">` +
      tex.body +
      `<g filter="url(#frame-pill-rim)">` +
      path(
        pillPath,
        `fill="none" stroke="url(#frame-pill-settle)" ` +
          `stroke-opacity="${fmt(p.settle.alpha)}" ` +
          `stroke-width="${fmt(p.stroke + 2 * p.settle.w)}"`,
      ) +
      `</g>` +
      glossPill(
        defs,
        'frame-pill-gloss',
        { cx: g.cap.cx, top: artBottom + g.cap.top, rx: g.cap.rx, ry: g.cap.ry, k: g.cap.k },
        [
          [0, rgba(g.cap.hot, g.cap.alpha)],
          [0.45, rgba(mixHex(g.cap.hot, g.cap.mid, 0.35), g.cap.alpha * 0.95)],
          [0.7, rgba(g.cap.mid, g.cap.alpha * 0.5)],
          [1, rgba(g.cap.mid, 0)],
        ],
        { grad: g.cap.grad },
      ) +
      glossPill(
        defs,
        'frame-pill-pool',
        { cx: g.pool.cx, top: artBottom + g.pool.top, rx: g.pool.rx, ry: g.pool.ry, k: g.pool.k },
        [
          [0, rgba(g.pool.hot, g.pool.alpha)],
          [0.4, rgba(mixHex(g.pool.hot, g.pool.mid, 0.5), g.pool.alpha * 0.8)],
          [0.75, rgba(g.pool.mid, g.pool.alpha * 0.4)],
          [1, rgba(g.pool.mid, 0)],
        ],
        { grad: g.pool.grad, tilt: 180 },
      ) +
      `</g>`,
    path(pillPath, `fill="none" stroke="#000000" stroke-width="${fmt(p.stroke)}"`),
  )
  body.push(`</g>`)
}

/** the S seam; its river ink is the plate glass at the seam's foot, so the
 *  join is one color wherever the seam lands */
function blueBanner(defs: string[], body: string[], seamX: number): void {
  const s = BLUE.seam
  const tipX = seamX - s.botDx / 2
  const botX = seamX + s.botDx / 2
  const river = rampAt(BLUE.crystalRamp, profileAt(BLUE.plate.bubbles.ground, botX))
  bannerSheet(defs, body, seamX, {
    d: seamD(tipX, botX, [
      [seamX + s.ctrl1Dx, s.ctrlY],
      [seamX + s.ctrl2Dx, s.ctrlY],
    ]),
    centerW: s.riverW,
    centerPaint: river,
    trimDx: s.trimDx,
  })
}
