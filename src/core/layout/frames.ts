// Content positions in card mm, and the per-family regions derived from
// the frame spec. The dev overlay (?calibrate) draws them.
import { FAMILY, INTERIOR, NUM_BOX } from '../frame/spec.ts'
import type { Rect } from '../units.ts'

export type FrameColor = 'green' | 'red' | 'blue'

export interface FrameRegions {
  artWindow: Rect
  bodyTop: number
  /** body interior, bodyTop down to the flavor baseline, for fit checks and overlays */
  bodyBox: Rect
  fanY: number
  fanColor: string
  numCenter: { x: number; y: number }
  /** blue only */
  actionTop?: number
}

/** Title plate metrics per frame color. `cy` is the vertical center of the
 *  title's cap box; the shrink widths are drawn widths (see titleSize). */
export interface TitleStyle {
  cy: number
  shrinkAt: number
  shrinkUntil: number
  maxWidth: number
}

export const TITLE_SIZE = 3.7 // mm em for a name that needs no shrink
export const TITLE_TRACKING = 0.36 // extra mm between letters (never scales)
export const TITLE_SHRINK_TO = 3.4 // mm em the easing bottoms out at

export const TITLE_STYLES: Record<FrameColor, TitleStyle> = {
  green: { cy: 12.62, shrinkAt: 49.4, shrinkUntil: 50.4, maxWidth: 53.8 },
  red: { cy: 13.0, shrinkAt: 49.4, shrinkUntil: 50.4, maxWidth: 53.8 },
  blue: { cy: 12.57, shrinkAt: 46.5, shrinkUntil: 47.5, maxWidth: 49.9 },
}

/** card number: mm em, extra mm between letters, widest run the box holds, ink */
export const NUM_TYPE = { size: 1.4, tracking: 0.18, room: 3.1, ink: '#505050' }

export const COMMON = {
  /** card center axis */
  cx: 31.5,
  /** cost numeral: cap box center and mm em */
  cost: { cx: 6.73, cy: 6.57, size: 5.3 },
  /** tag slots: left edge per slot, slot 0 is rightmost */
  tagSlots: { xs: [50.6, 41.46, 32.32, 23.18], y: 2.07, size: 9.0 },
  /** requirement box contents; the box (REQ_BOX) hugs them, never under minW */
  reqBar: {
    minW: 7.5,
    /** box width = content + hug: 2.1 left of the content, 1.4 right */
    hug: 3.5,
    iconH: 5.7,
    textSize: 2.9,
    gap: 0.6,
    /** a production box in the plaque is the body box at this scale */
    prodScale: 3.7 / 6.7,
    prodPad: 0.8,
  },
  /** VP circle block (the PNG includes a transparent margin, see vpMargin) */
  vpRect: { x: 41.8, y: 64.6, w: 18.7, h: 18.7 } as Rect,
  /** the visible disc is vpRect inset by this much */
  vpMargin: 1.3,
  /** gap kept between the visible disc and anything set beside it */
  vpClear: 0.7,
  /** the disc's contents: bare text is the numeral in the outline; nothing
   *  shrinks */
  vp: {
    /** the numeral standing alone, mm em */
    flatSize: 12.5,
    /** the numeral beside other items */
    textSize: 7.0,
    /** text in braces */
    countSize: 4.2,
    iconH: 5.4,
    gap: 0.5,
    outline: {
      inset: 0.175,
      bands: [
        { color: '#fff000', width: 0.175 },
        { color: '#f78c00', width: 0.2 },
      ],
    },
  },
  /** axis for flavor lines beside the VP disc */
  vpShiftX: 23.3,
  /** the flow: rows center on cx in this width; rules text size/leading */
  flow: { w: 50.3 },
  rules: { size: 2.3, lineSpace: 0.5 },
  /** flavor: bottom baseline and wrap widths (plain / beside VP) */
  flavor: { bottom: 83.5, w: 53.7, vpW: 35.2, oneLineMax: 57.0, size: 2.4, lineH: 2.8 },
} as const

/** the brown production box; patternTile is the mm period of production.png */
export const PROD_BOX = {
  border: 0.25,
  pad: 1.9, // box padding around contents (incl. the two 0.25 borders)
  itemGap: 0.7, // between icons in a line
  lineGap: 1.1, // between lines
  patternTile: 12.83,
} as const

/** per-family offsets below the art window bottom */
const DY = {
  green: { bodyTop: 3.54, fan: 0.9, fanColor: '#24770d' },
  red: { bodyTop: 4.9, fan: 2.83, fanColor: '#c36a17' },
  blue: { bodyTop: 4.5, fan: 1.8, fanColor: '#0c5e84' },
} as const

/** blue's action area: rows from `top`, the divider `pad` under the last row */
export const ACTION = { top: 17.1, pad: 1.9, minArtTop: FAMILY.blue.artTop } as const

/** minimum art window height; the body and blue's action area stop there */
export const ART_MIN_H = 10.5

/** body height bounds, bodyTop down to the flavor baseline */
export const FRAME_BODY = { min: 10, max: { green: 52, red: 52, blue: 40.5 } as const }

/** a VP card's smallest body: the small preset, which keeps the disc on the panel */
export function vpFloorBody(color: FrameColor): number {
  const small = FAMILY[color].artBottom.small!
  return COMMON.flavor.bottom - small - DY[color].bodyTop
}

/** the artBottom that leaves `bodyH` mm of body on this family */
function artBottomForBody(color: FrameColor, bodyH: number): number {
  return COMMON.flavor.bottom - bodyH - DY[color].bodyTop
}

/** `artTop` overrides blue's window top (the action divider) */
export function frameRegions(color: FrameColor, bodyH: number, artTop?: number): FrameRegions {
  const fam = FAMILY[color]
  const dy = DY[color]
  const top = color === 'blue' && artTop !== undefined ? artTop : fam.artTop
  const artBottom = artBottomForBody(color, bodyH)
  const bodyTop = artBottom + dy.bodyTop
  const regions: FrameRegions = {
    artWindow: {
      x: INTERIOR.x0,
      y: top,
      w: INTERIOR.x1 - INTERIOR.x0,
      h: artBottom - top,
    },
    bodyTop,
    bodyBox: {
      x: COMMON.cx - COMMON.flavor.w / 2,
      y: bodyTop,
      w: COMMON.flavor.w,
      h: COMMON.flavor.bottom - bodyTop,
    },
    fanY: artBottom + dy.fan,
    fanColor: dy.fanColor,
    numCenter: { x: NUM_BOX.cx, y: artBottom + fam.numBoxDy },
  }
  if (color === 'blue') regions.actionTop = ACTION.top
  return regions
}
