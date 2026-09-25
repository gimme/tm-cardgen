// The frame as data: geometry in card mm and paint per family. GREEN, RED
// and BLUE carry what differs; the rest is shared.
import type { FrameColor } from '../layout/frames.ts'
import { bands, profile, ramp, type Ramp } from './paint.ts'
import type { BumpEdge, BumpShape } from './paths.ts'
import { CARD_H, CARD_W } from '../units.ts'

const BLEED = { x: 2.495, y: 2.88 }
/** offset of the whole frame on the card */
const SHIFT = { x: 0.105, y: -0.36 }
const RING_BAND = 0.6
const KEYLINE = 0.12
const RING_R = 4.5
const INSET = RING_BAND + KEYLINE

/** border ring outer bounds and corner rounding */
export const RING = {
  x0: BLEED.x + SHIFT.x,
  y0: BLEED.y + SHIFT.y,
  x1: CARD_W - BLEED.x + SHIFT.x,
  y1: CARD_H - BLEED.y + SHIFT.y,
  r: RING_R,
}

/** the window inside the outline; `stroke` is the black keyline hugging it */
export const INTERIOR = {
  x0: RING.x0 + INSET,
  x1: RING.x1 - INSET,
  top: RING.y0 + INSET,
  bottom: RING.y1 - INSET,
  r: RING_R - INSET,
  stroke: KEYLINE,
}

export const BANNER = {
  /** border line centers and thickness */
  top: 3.325,
  bottom: 10.045,
  stroke: 0.25,
  underShadow: { h: 0.16, ink: '#1c0b06', alpha: 0.7 },
  /** tip y, and the black flank width either side of the colored center */
  seam: { tipY: 3.24, flankW: 0.21 },
  /** opaque brushed metal `h` wide; band positions in mm right of the seam
   *  center, so the pattern slides with placeSeam */
  trim: {
    h: 0.51,
    base: '#737373',
    dark: '#3a3a3a',
    bright: '#f0f0f0',
    bands: bands(`-28.6 10.6 0.8, -21.9 8.0 -0.36, -16.1 6.0 0.59, -11.3 4.2 -0.72,
      -7.5 15.2 0.79, -5.0 3.8 -0.73, -1.4 4.9 0.87, 1.3 2.5 -0.3, 4.5 5.2 0.6,
      8.5 4.4 -0.85, 10.1 11.0 0.9, 18.3 4.7 -0.41, 24.6 10.2 0.84, 27.6 5.0 -0.73,
      30.8 7.4 0.81`),
  },
}

/** one lighting field for all the card's metal; band distances in mm from
 *  `origin` along `angle` */
export const SHEEN = {
  angle: 49,
  origin: [INTERIOR.x0, BANNER.top] as [number, number],
  base: '#c3c3c3',
  dark: '#8a8a8a',
  bright: '#f3f3f3',
  bands: bands(`8 20 -0.5, 24 20 0.7, 40 20 -0.5, 56 20 0.7, 72 20 -0.5, 88 20 0.7`),
}

export const METAL = {
  /** the window rims' silver, across the window width */
  rim: ramp(`0 #f1f1f1, 0.075 #d4d4d4, 0.15 #e4e4e4, 0.5 #d8d8d8, 0.85 #e4e4e4,
    0.925 #d4d4d4, 1 #f1f1f1`),
  /** strip between divider band and body panel; band positions in card mm */
  panelStrip: {
    base: '#858585',
    dark: '#4d4d4d',
    bright: '#e6e6e6',
    bands: bands(`4.8 4.05 -0.74, 9.75 9.4 0.85, 13.7 6.35 0.89, 16.65 12.1 -0.73,
      27.55 14.25 0.66, 34.8 22.75 -0.76, 52.0 18.8 0.99, 55.25 8.9 -1.27`),
  },
  /** number-box bevel: one cyclic loop, 0..1 clockwise from bottom-left */
  numBoxBevel: ramp(`0 #606060, 0.05 #4e4e4e, 0.17 #434343, 0.46 #3d3d3d, 0.5 #464646,
    0.585 #565656, 0.67 #8e8e8e, 0.75 #bababa, 0.83 #dcdcdc, 0.91 #f6f6f6, 1 #ffffff`),
}

export const NUM_BOX = { cx: 57.45, w: 3.8, h: 1.95, bevel: 0.28 }

/** Green: bump-curved window edges, bowed seam, arced divider, lime glass. */
export const GREEN = {
  /** window top = the raised center's roof level */
  artTop: 15.44,
  artBottom: { small: 61.69, medium: 53.23, large: 44.76 },
  numBoxDy: 4.9,
  /** both window edges are one shape at two levels (paths.ts bumpEdge) */
  bump: {
    mid: (INTERIOR.x0 + INTERIOR.x1) / 2,
    shoulderHalf: 8.1,
    roofHalf: 7.05,
    drop: 2.06,
    shoulderDrop: 0.43,
    cornerSlope: 0.168,
    shoulderSlope: 0.035,
  } as BumpShape,
  /** black/silver/black sandwich on both window edges */
  rim: { black: 0.2, silver: 0.18, bottomBlack: 0.14 },
  /** a quadratic bowing `bow` right of `x` at `apexY`; the green sliver
   *  at its center */
  seam: { x: 28.65, bow: 1.5, apexY: 7.02, botDx: 0.1, sliverW: 0.25 },
  /** offsets below artBottom */
  divider: { bandBottomSide: 2.27, bandBottomCenter: 1.76, bandStroke: 0.38, stripH: 0.57 },
  /** crystal glass bands (crystal.ts); levels read through crystalRamp.
   *  Divider dy fields are relative to its top edge. */
  crystal: {
    tag: {
      box: { x0: 3.0, y0: 10.0, x1: 60.3, y1: 17.7 },
      seed: 7,
      ground: profile(`3.0 0.08, 5.5 0.15, 8 0.21, 11 0.29, 15 0.35, 18 0.52, 21 0.63,
        24 0.66, 28 0.66, 31 0.68, 34 0.7, 37 0.66, 40 0.62, 43 0.57, 46 0.49, 49 0.4,
        52 0.31, 55 0.23, 57.5 0.14, 60.3 0.06`),
      shine: {
        h: 0.5,
        profile: profile(`3.0 0.08, 6 0.2, 9 0.5, 12 0.68, 16 0.74, 22 0.82, 28 0.89,
          32 0.9, 38 0.82, 43 0.73, 47 0.6, 50 0.45, 53 0.28, 56 0.16, 58 0.1, 60.3 0.06`),
      },
      /** the shadow clears across the raised window center (`clear` span) */
      shadow: { h: 0.42, level: 0.03, alpha: 0.7, clear: [23, 25.5, 37.5, 40] as const },
      shards: { count: 56, sMin: 0.6, sMax: 3.2, blur: 0.09 },
      bokeh: { count: 24, rMin: 0.5, rMax: 1.7, blur: 0.5 },
      sparks: { count: 26, rMin: 0.12, rMax: 0.3 },
      glows: [
        { x: 30, y: 11.8, rx: 8.0, ry: 1.6, level: 0.8, alpha: 0.4 },
        { x: 31.3, y: 13.9, rx: 3.8, ry: 1.15, level: 0.95, alpha: 0.95 },
        { x: 35.9, y: 13.3, rx: 1.7, ry: 0.9, level: 0.82, alpha: 0.55 },
      ],
      glints: { seed: 5, count: 9, x0: 6, x1: 59, sMin: 0.22, sMax: 0.5, level: 0.82 },
    },
    divider: {
      seed: 13,
      ground: profile(`3.0 0.1, 5 0.14, 7 0.19, 9.5 0.25, 12 0.31, 14.5 0.37, 17 0.47,
        19.5 0.58, 22 0.67, 25 0.72, 28 0.78, 31 0.86, 33 0.88, 35 0.82, 38 0.75,
        41 0.74, 43.5 0.66, 45.5 0.59, 47.5 0.49, 49.5 0.4, 51.5 0.33, 53.5 0.27,
        55.5 0.21, 57.5 0.15, 60.3 0.08`),
      shine: {
        h: 0.34,
        profile: profile(`3.0 0.32, 6 0.45, 9 0.6, 12 0.68, 18 0.76, 25 0.84, 31 0.9,
          36 0.85, 42 0.76, 46 0.68, 50 0.58, 54 0.44, 57 0.3, 60.3 0.12`),
      },
      shadow: { h: 0.36, level: 0.05, alpha: 0.8 },
      shards: { count: 26, sMin: 0.5, sMax: 1.6, blur: 0.12 },
      bokeh: { count: 12, rMin: 0.35, rMax: 1.0, blur: 0.4 },
      glints: { seed: 9, count: 7, x0: 8, x1: 56, sMin: 0.2, sMax: 0.42, level: 0.82 },
      endGlow: { x: 59.2, dy: 0.45, rx: 0.9, ry: 0.5, level: 0.88, alpha: 0.75 },
      bubbles: { x: 22.8, dy: 2.1, rx: 2.1, ry: 0.7, count: 16, alpha: 0.55 },
    },
  },
  /** gloss accents: a crisp shape dissolved by one linear melt (`grad` is
   *  degrees off vertical and fade length in mm). Divider positions are
   *  relative to the band's edges. */
  gloss: {
    tagLeft: {
      x: 3.9,
      y: 11.82,
      w: 1.72,
      h: 3.3,
      taper: 0.79,
      sweep: 0.18,
      rHot: 0.5,
      rFar: 0.55,
      alpha: 0.92,
      grad: { angle: 50, len: 2.3 },
    },
    tagRightTop: {
      xL: 55.7,
      x1: 59.42,
      top: 10.75,
      cutL: 11.79,
      cutR: 12.45,
      rHot: 0.5,
      rFar: 0.4,
      hot: 1,
      alpha: 0.45,
      grad: { angle: 50, len: 3.2 },
    },
    tagRightBot: {
      xL: 57.25,
      x1: 59.4,
      cutL: 14.75,
      cutR: 14.25,
      gap: 0.44,
      rHot: 0.5,
      rFar: 0.7,
      hot: 0.95,
      alpha: 0.5,
      grad: { angle: 43, len: 1.9 },
    },
    divLeft: {
      cx: 6.4,
      dy: 0.2,
      rx: 2.1,
      ry: 0.8,
      k: 0.84,
      alpha: 0.88,
      grad: { angle: 18, len: 1.7 },
    },
    divRight: {
      cx: 57.95,
      dy: -0.3,
      rx: 2.9,
      ry: 1.3,
      alpha: 0.95,
      blur: 0.09,
      bounds: { x0: 55.0, x1: 58.6, rise: 1.6, drop: 0.15, r: 0.4 },
    },
    divTopCap: { cx: 26.6, dy: 0.06, rx: 2.35, ry: 0.35, k: 0.74 },
  },
  ring: ramp(`0 #faeb15, 0.0269 #ffea00, 0.0328 #bace1b, 0.0414 #a7c723, 0.0517 #8fbd2e,
    0.0724 #4aae3c, 0.0869 #5bb238, 0.1034 #87bc36, 0.1303 #a7c726, 0.153 #d8db00,
    0.182 #8cbc2c, 0.2068 #3aa640, 0.2332 #47ae40, 0.2567 #5fb538, 0.3036 #8dbf34,
    0.3534 #b4cc20, 0.4032 #d6d604, 0.4296 #d4d504, 0.4531 #95b731, 0.4765 #489f35,
    0.5 #3f9c39, 0.5248 #53a038, 0.5517 #9ebc26, 0.5765 #ddda07, 0.6034 #d1d609,
    0.6282 #c0d013, 0.6551 #afcb20, 0.6799 #9bc427, 0.7068 #84bb30, 0.742 #62b436,
    0.7801 #4caf3a, 0.8153 #a4c62b, 0.8534 #d7db03, 0.8886 #95c031, 0.9267 #4fb13a,
    0.9619 #b2ca1d, 1 #faeb15`),
  /** hue table every `crystal` level reads through */
  crystalRamp: ramp(`0 #00351b, 0.15 #016130, 0.3 #009c44, 0.42 #28a83e, 0.55 #57b13a,
    0.66 #85be33, 0.76 #a8c729, 0.86 #c6d40e, 0.93 #d4da06, 1 #e6ea41`),
  glossBright: '#eaf24b',
  glossGold: '#d2c714',
  seamFill: '#d9e900',
}

/** the window's bottom edge for a given artBottom */
export function greenBottomEdge(artBottom: number): BumpEdge {
  const dy = artBottom - 53.23
  return { ...GREEN.bump, centerY: 51.19 + dy }
}

/** Red (event): straight window edges, slash seam, center-tab divider,
 *  fire glass. */
export const RED = {
  artTop: 16.06,
  artBottom: { small: 61.69 - 3.89, medium: 53.23 - 3.89, large: 44.76 - 3.89 },
  numBoxDy: 4.6,
  /** black outline on the window's top edge */
  windowStroke: 0.21,
  bandTop: 10.12,
  /** laid along both edges of the title band; knots in card mm */
  bandTrimRamp: ramp(`3.3 #c3253a, 5.7 #93243a, 7.1 #8f1d4c, 10.2 #81222e, 10.3 #93422d,
    10.5 #e7b915, 10.6 #ffd804, 10.8 #ffd10d, 11.1 #ed8e29, 11.2 #f3a124, 12.9 #c32139,
    13.9 #9b1932, 14.7 #941733, 15.0 #902333, 16.2 #debb6f, 16.9 #ffe266, 18.5 #e9a64f,
    19.7 #ce323f, 20.0 #c5163b, 20.8 #a80936, 22.3 #76092a, 25.3 #b60a36, 28.8 #6c0729,
    30.6 #bf0834, 32.9 #dc4234, 34.2 #ed7d35, 35.3 #d7703b, 37.0 #9d2732, 37.9 #830d2b,
    41.2 #670a2c, 42.5 #630c2b, 45.2 #b3123f, 46.0 #cd1e42, 48.1 #e7b23e, 48.6 #e4ac3f,
    49.5 #f3da3c, 51.0 #fcff3f, 51.4 #ffff56, 52.5 #f8f057, 52.6 #f6ee73, 53.1 #edd879,
    54.0 #d7a84f, 54.9 #bc3d3c, 55.3 #b5213a, 59.9 #a42537`),
  bandTopStrip: { h: 0.75, alpha: 0.8 },
  bandBottomTrim: { h: 0.63, alpha: 0.8 },
  /** a straight slash leaning `lean` right over its drop; `trimDx` anchors
   *  the trim pattern relative to the seam center */
  seam: {
    x: 29.41,
    lean: 6.41,
    stripeW: 0.47,
    trimDx: -4.7,
    stripe: ramp(`0 #f21717, 0.05 #f13814, 0.14 #e97028, 0.25 #fcba2a, 0.37 #f7a618,
      0.5 #ef8a1e, 0.62 #dd5c26, 0.75 #ba2a36, 0.83 #75242a, 1 #742329`),
  },
  /** offsets below artBottom; `bandBottom` is the side level the tab
   *  drops from */
  divider: {
    outline: 0.24,
    bandBottom: 1.81,
    ribbonH: 0.47,
    trimH: 0.46,
    stroke: 0.3,
    stripH: 0.4,
    tab: { from: 24.43, to: 38.87, ramp: 0.46, depth: 1.74 },
    /** the trim along the contour is trimRamp slid `trimDx` right */
    trimDx: 0.8,
    trimAlpha: 0.8,
    trimRamp: ramp(`3.3 #ffba1e, 4.6 #ea8131, 5.6 #d53936, 6.7 #ba2331, 8.3 #92222e,
      9.5 #b26d36, 10.5 #e4bb43, 11.4 #fad148, 12.3 #efb946, 13.3 #e08444, 14.4 #dc9174,
      15.1 #cf6058, 16.0 #bf0a3b, 17.5 #9c172f, 19.0 #771f29, 20.4 #8e1a2d, 22.1 #b50f54,
      23.3 #bf0837, 25.6 #96034e, 27.0 #800046, 28.1 #6b032c, 29.5 #990033, 30.9 #c70435,
      33.0 #d12335, 35.4 #e96b35, 37.0 #ce3b37, 39.5 #9b1e2e, 41.5 #811830, 44.0 #702529,
      47.2 #662827, 47.7 #673f24, 49.2 #a7a62e, 50.7 #e7e23b, 51.2 #faf937, 51.7 #fdf344,
      52.5 #edca32, 53.6 #d25c36, 54.5 #bc042d, 56.0 #781128, 57.2 #5b1821, 57.9 #7a1f26,
      59.0 #672325, 59.9 #672323`),
    /** knots in card mm */
    strip: ramp(`3.3 #b3b3b3, 9.8 #606060, 12.0 #b2b2b2, 13.9 #ececec, 21.4 #858585,
      30.5 #5d5d5d, 33.1 #767676, 38.1 #cacaca, 39.6 #d3d3d3, 42.7 #8f8f8f, 48.7 #5d5d5d,
      50.3 #9a9a9a, 51.9 #cecece, 56.4 #d9d9d9, 57.1 #c6c6c6, 59.5 #717171, 59.9 #5f5f5f`),
    /** cream pool at the tab's right end; `cx` absolute, `dy` off the tab
     *  floor */
    gloss: {
      cx: 36.72,
      dy: -0.6,
      rx: 1.9,
      ry: 0.7,
      k: 0.68,
      flatTop: 0.15,
      flatBot: 0.5,
      topRun: 0.8,
      tilt: 0.24,
      hot: '#ffffff',
      ink: '#fff5e0',
      alpha: 1,
      grad: { angle: 30, len: 2.1 },
    },
  },
  /** levels read through fireRamp */
  crystal: {
    tag: {
      box: { x0: 3.0, y0: 10.0, x1: 60.3, y1: 15.9 },
      seed: 21,
      ground: profile(`3.0 0.18, 6 0.25, 10 0.33, 14 0.42, 18 0.52, 22 0.62, 26 0.68,
        30 0.7, 34 0.67, 38 0.62, 43 0.55, 47 0.48, 51 0.4, 55 0.3, 58 0.22, 60.3 0.16`),
      shards: { count: 8, sMin: 1.5, sMax: 3.0, blur: 0.18 },
      bokeh: { count: 30, rMin: 0.6, rMax: 2.2, blur: 0.5, cores: 2, lMax: 0.9 },
      facets: { count: 8, sMin: 2.2, sMax: 4.0, blur: 0.1 },
      glows: [{ x: 30, y: 13.5, rx: 5, ry: 1.5, level: 0.85, alpha: 0.6 }],
    },
    divider: {
      seed: 27,
      ground: profile(`3.0 0.11, 5 0.12, 6.5 0.24, 8 0.36, 9.5 0.47, 11 0.57, 12.5 0.78,
        14 0.78, 15.5 0.75, 17 0.55, 18.5 0.42, 20 0.36, 21.5 0.5, 23 0.58, 24.5 0.77,
        26 0.8, 29 0.82, 32 0.83, 34 0.85, 37 0.83, 38.5 0.77, 39.5 0.63, 41 0.47,
        42.5 0.43, 44 0.34, 48.5 0.34, 50 0.41, 51.5 0.57, 53 0.92, 54.5 0.9, 56 0.57,
        57.5 0.44, 59 0.34, 60.3 0.27`),
      shards: { count: 5, sMin: 1.2, sMax: 2.2, blur: 0.16 },
      bokeh: { count: 20, rMin: 0.5, rMax: 1.6, blur: 0.4, cores: 1, lMax: 0.9 },
      facets: { count: 5, sMin: 1.8, sMax: 3.0, blur: 0.1 },
    },
  },
  fireRamp: ramp(`0 #871425, 0.25 #c8252f, 0.34 #e42024, 0.45 #e65026, 0.62 #f28a1d,
    0.8 #fca512, 0.9 #ffc41c, 1 #ffe9bc`),
  ring: ramp(`0 #faeb15, 0.0269 #ffea00, 0.0517 #e57c1f, 0.0786 #e82326, 0.1034 #e9641e,
    0.1303 #f49f0f, 0.1654 #ea6a1c, 0.2068 #df2121, 0.2332 #e12422, 0.2567 #e64320,
    0.2801 #eb6129, 0.3036 #e8812d, 0.3299 #ec622a, 0.3534 #e83622, 0.3769 #e3572c,
    0.4032 #e0ab19, 0.4267 #e1d00d, 0.4502 #e29a1a, 0.4765 #e55120, 0.5 #e75026,
    0.5248 #e65822, 0.5517 #dfa517, 0.5765 #e0d80a, 0.6034 #e39a18, 0.6282 #e53b23,
    0.6551 #e8452b, 0.6799 #ef7325, 0.7068 #ee6a28, 0.742 #e84224, 0.7801 #ec5121,
    0.8153 #fec600, 0.8534 #fdc700, 0.8886 #f37416, 0.9267 #e3332e, 0.9619 #dea71f,
    1 #faeb15`),
  gloss: {
    tagLeft: {
      x: 3.66,
      y: 11.58,
      w: 1.44,
      h: 3.18,
      rimH: 2.28,
      tip: 0.32,
      tipR: 0.16,
      rHot: 0.2,
      rFar: 0.55,
      hot: '#ffffff',
      mid: '#f2ac92',
      tail: '#dd7b52',
      alpha: 0.8,
      grad: { angle: 75, len: 1.4 },
    },
    tagRight: {
      x0: 54.4,
      x1: 59.6,
      topY: 13.2,
      rTop: 0.3,
      rBot: 0.45,
      bow: 0.45,
      hot: '#ffffff',
      sat: '#ffb6ae',
      mid: '#efa48f',
      alpha: 0.8,
      grad: { angle: 30, len: 2.3 },
    },
  },
}

/** Blue (action): action area above the window, inset title plate, S seam,
 *  bowed divider with the number pill. */
export const BLUE = {
  /** window top at the sides; FrameGeometry.artTop overrides it */
  artTop: 28.0,
  artBottom: { small: 65.5, medium: 61.3, large: 57.4, empty: 71.9 },
  numBoxDy: 1.45,
  /** the action area, from the banner's bottom line to the divider at the
   *  art top */
  action: {
    /** the divider contour: a sag from each window side (`endRise` above
     *  artTop) to a trough kink at mid±troughX, the tab rising to its flat
     *  top at mid±tabX, `tabDrop` below the ends */
    contour: {
      endRise: 0.57,
      troughX: 9.55,
      tabX: 7.3,
      tabDrop: 2.41,
      left: { drop: 3.67, cornerSlope: 0.416, troughSlope: 0.081, ease: 1.0 },
      right: { drop: 3.92, cornerSlope: 0.487, troughSlope: 0.063, ease: 1.1 },
    },
    /** stack widths along the contour: keyline, silver strip, keyline */
    stack: { k1: 0.16, stripH: 0.25, k2: 0.2 },
    /** `along` in card mm; `left` and `right` in mm above each bottom
     *  corner, so any action depth reads the same pattern */
    trim: {
      h: 0.45,
      along: ramp(`3.3 #707070, 6.3 #5e5e5e, 9.6 #828282, 12.4 #969696, 16 #b4b4b4,
        18.6 #9b9b9b, 21 #878787, 22.1 #787878, 23.5 #7d7d7d, 26 #707070, 28.1 #646464,
        31.3 #a0a0a0, 33.5 #bbbbbb, 38.3 #c0c0c0, 39.4 #afafaf, 40.5 #8c8c8c,
        41.5 #636363, 43.9 #838383, 47 #a8a8a8, 50.9 #c8c8c8, 53.9 #b4b4b4,
        56.9 #969696, 59.9 #7c7c7c`),
      left: ramp(`0 #707070, 4 #7d7d7d, 8 #8c8c8c, 12 #ababab, 17 #c6c6c6, 20.5 #929292,
        21.7 #7d7d7d`),
      right: ramp(`0 #7c7c7c, 2.3 #9a9a9a, 4.5 #b8b8b8, 6.3 #c8c8c8, 8.7 #bdbdbd,
        11 #a2a2a2, 13 #858585, 14.6 #6c6c6c, 16.5 #999999, 19 #bebebe`),
    },
    /** card mm */
    strip: ramp(`3.3 #ebebeb, 10 #e7e7e7, 20 #c3c3c3, 31.5 #c8c8c8, 45 #e2e2e2,
      50 #dcdcdc, 55 #c3c3c3, 57.5 #9e9e9e, 59.9 #8f8f8f`),
  },
  /** hue table the plate, divider ribbon and number pill read through */
  crystalRamp: ramp(`0 #21275c, 0.08 #223779, 0.2 #2a4e92, 0.32 #2e72bb, 0.45 #2f84cc,
    0.58 #3797d9, 0.7 #42aae6, 0.8 #87abd5, 0.9 #a4accf, 1 #cdd5eb`),
  /** the divider under the window: one cubic bow with the number pill on
   *  its middle; y anchors are drops from artBottom */
  divider: {
    /** controls c1/c2: x absolute, y relative to artBottom */
    bow: { yL: -3.84, yR: -3.94, c1: [14.95, 1.34] as const, c2: [49.8, 2.17] as const },
    stack: { k1: 0.16, stripH: 0.45, k2: 0.16, ribbonH: 0.58, k3: 0.18 },
    strip: ramp(`3.3 #a9a9a9, 8 #b3b3b3, 11.5 #c9c9c9, 14 #bcbcbc, 17 #aaaaaa,
      19.5 #949494, 22 #888888, 25 #7a7a7a, 28 #707070, 31 #6c6c6c, 34 #787878,
      36.5 #8c8c8c, 38.5 #9e9e9e, 41 #adadad, 43 #b8b8b8, 45.8 #d0d0d0, 48.5 #c2c2c2,
      51 #b8b8b8, 53.5 #b5b5b5, 55.5 #aaaaaa, 57.5 #9a9a9a, 58.8 #888888, 59.9 #7c7c7c`),
    /** levels through crystalRamp along the run */
    ribbon: profile(`3.3 0.13, 4.5 0.17, 6 0.23, 8 0.28, 10 0.33, 12 0.38, 15 0.45,
      17 0.49, 18.5 0.53, 20 0.59, 21.5 0.62, 22.4 0.63, 40.6 0.39, 42 0.38, 44 0.39,
      46 0.35, 48 0.28, 50 0.17, 51.5 0.11, 53 0.11, 54.5 0.16, 56 0.23, 57.5 0.31,
      58.5 0.34, 59.9 0.25`),
    /** brushed band under k3, wrapping the pill */
    band: {
      h: 0.45,
      ramp: ramp(`3.3 #a2a2a2, 6.3 #989898, 7.7 #888888, 9.7 #6a6a6a, 11.9 #b0b0b0,
        14.2 #ececec, 16.4 #cccccc, 19.5 #aeaeae, 21.5 #929292, 24.5 #7e7e7e,
        27.5 #6e6e6e, 30.5 #666666, 33.0 #787878, 35.5 #9a9a9a, 37.5 #b2b2b2,
        40.3 #c8c8c8, 42.5 #a2a2a2, 45.0 #868686, 47.0 #707070, 49.0 #646464,
        50.6 #aaaaaa, 52.3 #d4d4d4, 56.4 #d8d8d8, 57.6 #b8b8b8, 58.6 #a4a4a4,
        59.9 #6e6e6e`),
    },
    /** the number pill; y's relative to artBottom, x's absolute */
    pill: {
      cx: 31.4,
      w: 17.8,
      top: -1.0,
      h: 4.25,
      r: 1.9,
      stroke: 0.16,
      settle: {
        w: 0.5,
        ramp: ramp(`0 #131945, 0.35 #2c5cad, 0.7 #48a3e4, 1 #8dadff`),
        alpha: 0.9,
        blur: 0.05,
      },
      ground: profile(`22.5 0.3, 24 0.37, 26 0.47, 28 0.57, 30 0.64, 31.6 0.62,
        33.5 0.57, 35.5 0.52, 37 0.47, 38.5 0.4, 40.3 0.31`),
      bubbles: { seed: 3, count: 4, rMin: 0.7, rMax: 2.1, alpha: 0.42 },
      gloss: {
        cap: {
          cx: 25.1,
          top: -0.3,
          rx: 1.3,
          ry: 0.36,
          k: 0.85,
          hot: '#bcd6f2',
          mid: '#8fb9e6',
          alpha: 0.95,
          grad: { angle: 62, len: 2.5 },
        },
        pool: {
          cx: 37.8,
          top: 1.82,
          rx: 1.3,
          ry: 0.42,
          k: 0.85,
          hot: '#8ccffb',
          mid: '#62b9f4',
          alpha: 0.55,
          grad: { angle: 78, len: 2.7 },
        },
      },
    },
  },
  /** the title plate; fixed geometry, nothing moves with artTop or
   *  artBottom */
  plate: {
    left: 4.44,
    right: 58.38,
    /** parabola through `apex`, curvature pinned by the `side` anchor */
    bow: { apex: [32.45, 15.24] as const, side: [9.2, 14.73] as const },
    stroke: 0.14,
    strip: {
      h: 0.5,
      ramp: ramp(`3.3 #d6d6d6, 4.6 #cccccc, 5.2 #c0c0c0, 8 #acacac, 11 #9e9e9e,
        14 #7c7c7c, 18.5 #747474, 21.5 #858585, 24.5 #a3a3a3, 27.5 #b0b0b0,
        30.5 #cfcfcf, 34 #e2e2e2, 38 #dcdcdc, 42.5 #cdcdcd, 46 #bfbfbf, 50 #b2b2b2,
        53.5 #c2c2c2, 57 #c8c8c8, 58.6 #d0d0d0, 59.9 #d2d2d2`),
    },
    /** rim shadow: full at sides and corners, thinning to `mid` between the
     *  `dip` x's; `top` is the sliver under the banner line */
    shadow: {
      h: 0.55,
      top: 0.2,
      level: 0.1,
      alpha: 0.85,
      mid: 0.6,
      blur: 0.05,
      dip: [15.5, 23.5, 42, 49.5] as const,
    },
    /** the glass (crystal.ts bubbleTexture) */
    bubbles: {
      box: { x0: 4.2, y0: 9.9, x1: 58.6, y1: 15.6 },
      seed: 34,
      ground: profile(`4.4 0.18, 6 0.28, 9 0.36, 12 0.42, 16 0.5, 20 0.58, 24 0.62,
        28 0.65, 32 0.63, 36 0.58, 40 0.55, 44 0.5, 48 0.47, 52 0.42, 55 0.34,
        57 0.26, 58.4 0.18`),
      count: 10,
      rMin: 1.3,
      rMax: 10.5,
      alpha: 0.6,
    },
    gloss: {
      left: {
        x0: 5.05,
        xR: 9.4,
        cutL: 12.08,
        cutR: 13.15,
        seat: 0.62,
        rHot: 0.3,
        rFar: 0.5,
        hot: '#b9c0ee',
        mid: '#9bb0e2',
        alpha: 0.9,
        grad: { angle: 50, len: 3.0 },
      },
      right: {
        xL: 52.8,
        x1: 57.88,
        gap: 0.22,
        cutL: 11.0,
        cutR: 12.55,
        rHot: 0.5,
        rFar: 0.75,
        hot: '#c6cdf0',
        mid: '#9bb0e2',
        alpha: 0.93,
        grad: { angle: 44, len: 3.9 },
      },
    },
    shine: { h: 0.45, ink: '#0783ff' },
  },
  ring: ramp(`0 #22165c, 0.036 #1b3d7c, 0.077 #217cba, 0.105 #2a679f, 0.126 #12417e,
    0.143 #1e1156, 0.153 #1e1156, 0.183 #1a4585, 0.2068 #2e73a9, 0.2345 #2e7ec0,
    0.269 #1c3a78, 0.28 #251858, 0.29 #251858, 0.307 #1c3f7d, 0.352 #3e88d3,
    0.417 #1f1252, 0.427 #1f1252, 0.444 #17417f, 0.481 #3c85c7, 0.5 #3e88c9,
    0.517 #3487ca, 0.545 #28609f, 0.573 #211050, 0.583 #211050, 0.607 #1c4886,
    0.647 #2e82c5, 0.676 #2465a8, 0.694 #193a7a, 0.7068 #2a2569, 0.713 #241463,
    0.723 #241463, 0.756 #2b6cad, 0.781 #3583c4, 0.82 #1a548e, 0.846 #1c1252,
    0.856 #1c1252, 0.888 #2660a6, 0.919 #3987c7, 0.949 #2467a2, 0.963 #1d3f80,
    0.985 #201356, 0.995 #201356, 1 #22165c`),
  /** one cubic S: tip botDx/2 left of `x`, foot botDx/2 right, controls at
   *  ctrlY offset ctrl1Dx/ctrl2Dx. The river has no ink of its own; render
   *  reads crystalRamp at the plate's ground level under the foot. */
  seam: {
    x: 30.15,
    botDx: 0.73,
    ctrl1Dx: -1.73,
    ctrl2Dx: 0.95,
    ctrlY: 6.46,
    riverW: 0.3,
    trimDx: -0.95,
  },
}

/** blue's `empty` is its bare-body variant */
export type FramePreset = 'small' | 'medium' | 'large' | 'empty'

/** what layout and the seam machinery read of a family */
export interface FamilySpec {
  /** y of the art window's top edge */
  artTop: number
  /** artBottom per preset; everything below the window is continuous in
   *  artBottom */
  artBottom: Partial<Record<FramePreset, number>>
  /** number-box center below artBottom */
  numBoxDy: number
  /** one cyclic ramp around the perimeter, 0 at top-left, clockwise */
  ring: Ramp
  /** the banner seam's center anchor */
  seam: { x: number }
}

export const FAMILY: Record<FrameColor, FamilySpec> = { green: GREEN, red: RED, blue: BLUE }

/** the decorated seam's painted extent either side of its anchor */
function seamSpan(color: FrameColor): { half: number; left: number; right: number } {
  if (color === 'green') {
    const s = GREEN.seam
    const half = s.sliverW / 2 + BANNER.seam.flankW + BANNER.trim.h
    return { half, left: 0, right: s.bow }
  }
  if (color === 'red') {
    const { lean, stripeW } = RED.seam
    const drop = BANNER.bottom + BANNER.stroke / 2 - BANNER.seam.tipY
    const half =
      lean / 2 +
      ((stripeW / 2 + BANNER.seam.flankW + BANNER.trim.h) * Math.hypot(lean, drop)) / drop
    return { half, left: 0, right: 0 }
  }
  const s = BLUE.seam
  const half = s.riverW / 2 + BANNER.seam.flankW + BANNER.trim.h
  // the S's own x-extremes, sampled
  let left = 0
  let right = 0
  for (let i = 0; i <= 64; i++) {
    const t = i / 64
    const u = 1 - t
    const dx = (t * t * t - u * u * u) * (s.botDx / 2) + 3 * u * t * (u * s.ctrl1Dx + t * s.ctrl2Dx)
    left = Math.min(left, dx)
    right = Math.max(right, dx)
  }
  return { half, left: -left, right }
}

/** the seam's x on a card: the family's anchor, pushed right of a
 *  requirement bar (which always wins) or left of a 4th tag; edges in card mm */
export function placeSeam(color: FrameColor, reqRight?: number, tagsLeft?: number): number {
  const margin = 0.4
  const span = seamSpan(color)
  let x = FAMILY[color].seam.x
  if (tagsLeft !== undefined) x = Math.min(x, tagsLeft - margin - span.right - span.half)
  if (reqRight !== undefined) x = Math.max(x, reqRight + margin + span.left + span.half)
  return x
}
