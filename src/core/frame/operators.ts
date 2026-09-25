// The colon, the slash and the asterisk, drawn as shapes. The plus, minus
// and equals are font glyphs (layout.ts).
import { fmt } from '../units.ts'

export const COLON = {
  /** dot diameter and top-to-bottom span, per mm of the operator em */
  dot: 0.8 / 5.3,
  span: 3.2 / 5.3,
}

export function colonMarkup(x: number, y: number, w: number, h: number): string {
  const r = w / 2
  const cx = fmt(x + r)
  const dot = (cy: number) => `<circle cx="${cx}" cy="${fmt(cy)}" r="${fmt(r)}" fill="#000"/>`
  return dot(y + r) + dot(y + h - r)
}

export const SLASH = {
  /** height, mm: one size in the body, the requirement box and the VP disc */
  h: 5.3,
  /** stroke width across, per unit of height */
  stroke: 0.13,
  /** lean off vertical, degrees */
  angle: 24,
}
const lean = (SLASH.angle * Math.PI) / 180

/** the bar's box width at height `h` */
export const slashWidth = (h: number): number => {
  const s = h * SLASH.stroke
  const run = (h - s * Math.sin(lean)) / Math.cos(lean)
  return run * Math.sin(lean) + s * Math.cos(lean)
}

/** a rectangle leaning right, ends square to its run, corners on the box's
 *  four sides */
export function slashPath(x: number, y: number, w: number, h: number): string {
  const s = h * SLASH.stroke
  const dx = s * Math.cos(lean)
  const dy = s * Math.sin(lean)
  return `M${fmt(x)} ${fmt(y + h - dy)}L${fmt(x + dx)} ${fmt(y + h)}L${fmt(x + w)} ${fmt(y + dy)}L${fmt(x + w - dx)} ${fmt(y)}Z`
}

// The printed asterisk is a thin six-armed star: a pair of arms lies
// horizontal, and each arm widens from the hub to a square-cut tip.
export const ASTERISK = {
  /** arm length from the center, mm */
  r: 0.9,
  /** an arm's full width at the tip and at the hub, per unit of arm length */
  tip: 0.3,
  hub: 0.16,
}
const SIN60 = Math.sqrt(3) / 2

/** the asterisk's box at arm length `r`: two arms wide, the slanted arms'
 *  outer tip corners high */
export function asteriskBox(r = ASTERISK.r): { w: number; h: number } {
  return { w: 2 * r, h: 2 * r * (SIN60 + ASTERISK.tip / 4) }
}

/** six wedges 60° apart, each from a hub-wide base through the center to
 *  its tip; all wound the same way, so their overlap at the hub fills */
export function asteriskPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2
  const [cx, cy] = [x + w / 2, y + h / 2]
  const a = (ASTERISK.hub * r) / 2
  const b = (ASTERISK.tip * r) / 2
  let d = ''
  for (let k = 0; k < 6; k++) {
    const t = (k * Math.PI) / 3
    const [ux, uy] = [Math.cos(t), Math.sin(t)]
    const [nx, ny] = [-uy, ux]
    const pt = (along: number, across: number) =>
      `${fmt(cx + ux * along + nx * across)} ${fmt(cy + uy * along + ny * across)}`
    d += `M${pt(0, a)}L${pt(r, b)}L${pt(r, -b)}L${pt(0, -a)}Z`
  }
  return d
}
