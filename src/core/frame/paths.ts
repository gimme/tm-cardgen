// Geometry builders for the frame. An Edge is a left-to-right boundary; the
// area between two edges is a closed path (top edge forward, bottom back).
import { fmt } from '../units.ts'

export type Pt = readonly [number, number]

/** one path segment: 0 (line), 1 (quadratic) or 2 (cubic) control points */
interface Seg {
  ctrl: Pt[]
  to: Pt
}

export interface Edge {
  start: Pt
  segs: Seg[]
}

/** the art-window edge shape: a side ease from each corner to a shoulder
 *  kink, then a 45° step up to the flat center; symmetric about `mid` */
export interface BumpShape {
  /** the mirror axis (the window's center x) */
  mid: number
  /** half-widths: shoulder kinks at mid±shoulderHalf, roof at mid±roofHalf */
  shoulderHalf: number
  roofHalf: number
  /** levels above the roof: window corner / shoulder kink */
  drop: number
  shoulderDrop: number
  /** side-ease end slopes (|dy/dx|): at the window corner / at the shoulder */
  cornerSlope: number
  shoulderSlope: number
}

/** the shape at a level: centerY anchors the roof */
export interface BumpEdge extends BumpShape {
  centerY: number
}

export const bumpSideY = (e: BumpEdge): number => e.centerY + e.drop

/** an edge of straight segments through the points */
export function polylineEdge(pts: Pt[]): Edge {
  return { start: pts[0], segs: pts.slice(1).map((to) => ({ ctrl: [], to })) }
}

/** the edge's vertices: its start and every segment's end */
export function edgeVerts(edge: Edge): Pt[] {
  return [edge.start, ...edge.segs.map((s) => s.to)]
}

export function lineEdge(x0: number, x1: number, y: number): Edge {
  return { start: [x0, y], segs: [{ ctrl: [], to: [x1, y] }] }
}

/** shallow symmetric arc: quadratic through (mid, centerY) */
export function arcEdge(x0: number, x1: number, sideY: number, centerY: number): Edge {
  const ctrlY = 2 * centerY - sideY
  return {
    start: [x0, sideY],
    segs: [{ ctrl: [[(x0 + x1) / 2, ctrlY]], to: [x1, sideY] }],
  }
}

export function bumpEdge(e: BumpEdge, x0: number, x1: number): Edge {
  /** cubic with prescribed end slopes (Hermite in Bezier form) */
  const ease = (from: Pt, sFrom: number, to: Pt, sTo: number): Seg => {
    const w = (to[0] - from[0]) / 3
    return {
      ctrl: [
        [from[0] + w, from[1] + sFrom * w],
        [to[0] - w, to[1] - sTo * w],
      ],
      to,
    }
  }
  const sideY = bumpSideY(e)
  const shoulderY = e.centerY + e.shoulderDrop
  const shL: Pt = [e.mid - e.shoulderHalf, shoulderY]
  const shR: Pt = [e.mid + e.shoulderHalf, shoulderY]
  return {
    start: [x0, sideY],
    segs: [
      ease([x0, sideY], -e.cornerSlope, shL, -e.shoulderSlope),
      // control point one step-height inside the kink: 45° off it, tangent onto the roof
      { ctrl: [[shL[0] + e.shoulderDrop, e.centerY]], to: [e.mid - e.roofHalf, e.centerY] },
      { ctrl: [], to: [e.mid + e.roofHalf, e.centerY] },
      { ctrl: [[shR[0] - e.shoulderDrop, e.centerY]], to: shR },
      ease(shR, e.shoulderSlope, [x1, sideY], e.cornerSlope),
    ],
  }
}

export function shiftEdge(edge: Edge, dy: number): Edge {
  const s = ([x, y]: Pt): Pt => [x, y + dy]
  return {
    start: s(edge.start),
    segs: edge.segs.map(({ ctrl, to }) => ({ ctrl: ctrl.map(s), to: s(to) })),
  }
}

/** parallel offset with mitered corners, so a band between two offsets
 *  keeps its width; line segments only */
export function offsetPolyline(edge: Edge, dist: number): Edge {
  const verts = edgeVerts(edge)
  const lines = verts.slice(1).map((to, i) => {
    const d: Pt = [to[0] - verts[i][0], to[1] - verts[i][1]]
    const len = Math.hypot(d[0], d[1])
    const n: Pt = [(-d[1] / len) * dist, (d[0] / len) * dist]
    return { p: [verts[i][0] + n[0], verts[i][1] + n[1]] as Pt, d, n }
  })
  const meet = (a: (typeof lines)[number], b: (typeof lines)[number]): Pt => {
    const det = a.d[0] * b.d[1] - a.d[1] * b.d[0]
    if (Math.abs(det) < 1e-9) return b.p // collinear neighbors: no corner
    const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / det
    return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t]
  }
  const last = lines[lines.length - 1]
  const [ex, ey] = verts[verts.length - 1]
  const outVerts: Pt[] = [
    lines[0].p,
    ...lines.slice(1).map((ln, i) => meet(lines[i], ln)),
    [ex + last.n[0], ey + last.n[1]],
  ]
  return polylineEdge(outVerts)
}

function edgeEnd(edge: Edge): Pt {
  return edge.segs[edge.segs.length - 1].to
}

/** y at x; x is monotone along an edge, so bisection converges. Clamps
 *  outside the span. */
export function edgeYat(edge: Edge, x: number): number {
  let from = edge.start
  for (const seg of edge.segs) {
    if (x <= seg.to[0]) {
      const P: Pt[] = [from, ...seg.ctrl, seg.to]
      const at = (t: number): Pt => {
        let pts = P
        while (pts.length > 1) {
          const prev = pts
          pts = prev
            .slice(1)
            .map((p, i): Pt => [
              prev[i][0] + (p[0] - prev[i][0]) * t,
              prev[i][1] + (p[1] - prev[i][1]) * t,
            ])
        }
        return pts[0]
      }
      let [lo, hi] = [0, 1]
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (at(mid)[0] < x) lo = mid
        else hi = mid
      }
      return at((lo + hi) / 2)[1]
    }
    from = seg.to
  }
  return from[1]
}

/** flat tails of `dx` at both ends, for SPILL overshoot (pieces.ts) */
export function extendEdge(edge: Edge, dx: number): Edge {
  const [ex, ey] = edgeEnd(edge)
  const [sx, sy] = edge.start
  return {
    start: [sx - dx, sy],
    segs: [{ ctrl: [], to: edge.start }, ...edge.segs, { ctrl: [], to: [ex + dx, ey] }],
  }
}

const pts = (...ps: Pt[]) => ps.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' ')

function segCmd({ ctrl, to }: Seg): string {
  if (ctrl.length === 0) return `L ${pts(to)}`
  if (ctrl.length === 1) return `Q ${pts(ctrl[0], to)}`
  return `C ${pts(ctrl[0], ctrl[1], to)}`
}

function forward(edge: Edge): string {
  return edge.segs.map(segCmd).join(' ')
}

/** the same segments traversed right→left (control points reversed) */
function backward(edge: Edge): string {
  const cmds: string[] = []
  for (let i = edge.segs.length - 1; i >= 0; i--) {
    const from = i === 0 ? edge.start : edge.segs[i - 1].to
    const ctrl = [...edge.segs[i].ctrl].reverse()
    cmds.push(segCmd({ ctrl, to: from }))
  }
  return cmds.join(' ')
}

/** closed region between two edges spanning the same x range */
export function bandPath(top: Edge, bottom: Edge): string {
  return `M ${pts(top.start)} ${forward(top)} L ${pts(edgeEnd(bottom))} ${backward(bottom)} Z`
}

/** open subpath (M + segments) */
export function openPath(edge: Edge): string {
  return `M ${pts(edge.start)} ${forward(edge)}`
}

/** `k` is the handle length as a fraction of each radius; 0.5523 is a true
 *  ellipse, larger tends toward a stadium */
export function ovalPath(cx: number, cy: number, rx: number, ry: number, k = 0.5523): string {
  const [kx, ky] = [rx * k, ry * k]
  return (
    `M ${fmt(cx - rx)} ${fmt(cy)} ` +
    `C ${fmt(cx - rx)} ${fmt(cy - ky)} ${fmt(cx - kx)} ${fmt(cy - ry)} ${fmt(cx)} ${fmt(cy - ry)} ` +
    `C ${fmt(cx + kx)} ${fmt(cy - ry)} ${fmt(cx + rx)} ${fmt(cy - ky)} ${fmt(cx + rx)} ${fmt(cy)} ` +
    `C ${fmt(cx + rx)} ${fmt(cy + ky)} ${fmt(cx + kx)} ${fmt(cy + ry)} ${fmt(cx)} ${fmt(cy + ry)} ` +
    `C ${fmt(cx - kx)} ${fmt(cy + ry)} ${fmt(cx - rx)} ${fmt(cy + ky)} ${fmt(cx - rx)} ${fmt(cy)} Z`
  )
}

/** closed polygon through the given vertices, all corners sharp */
export function polyPath(verts: Pt[]): string {
  return `M ${verts.map((p) => pts(p)).join(' L ')} Z`
}

/** corners bridged by a quadratic through the vertex, `radii[i]` short of
 *  it; 0 keeps a corner sharp */
export function roundedPolyPath(verts: Pt[], radii: number[]): string {
  const n = verts.length
  const cmds: string[] = []
  for (let i = 0; i < n; i++) {
    const v = verts[i]
    const r = radii[i]
    const at = (q: Pt): Pt => {
      const len = Math.hypot(q[0] - v[0], q[1] - v[1])
      return [v[0] + ((q[0] - v[0]) / len) * r, v[1] + ((q[1] - v[1]) / len) * r]
    }
    cmds.push(`${i === 0 ? 'M' : 'L'} ${pts(at(verts[(i + n - 1) % n]))}`)
    if (r > 0) cmds.push(`Q ${pts(v, at(verts[(i + 1) % n]))}`)
  }
  return cmds.join(' ') + ' Z'
}

export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  /** per-corner radii override: [tl, tr, br, bl] */
  radii?: [number, number, number, number],
): string {
  const [tl, tr, br, bl] = radii ?? [r, r, r, r]
  const a = (rr: number, dx: number, dy: number) =>
    `a ${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(dx)} ${fmt(dy)}`
  return (
    `M ${fmt(x + tl)} ${fmt(y)} h ${fmt(w - tl - tr)} ${a(tr, tr, tr)} ` +
    `v ${fmt(h - tr - br)} ${a(br, -br, br)} h ${fmt(-(w - br - bl))} ${a(bl, -bl, -bl)} ` +
    `v ${fmt(-(h - bl - tl))} ${a(tl, tl, -tl)} Z`
  )
}
