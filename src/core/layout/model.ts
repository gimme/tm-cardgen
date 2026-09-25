// The flat tree of mm-positioned primitives layoutCard produces.
import type { HaloShape } from '../icons.ts'
import type { Rect } from '../units.ts'
import type { FontId } from './measure.ts'
import type { FrameColor, FrameRegions } from './frames.ts'

/** Logical asset reference; renderers resolve to URLs or data URIs. */
export type AssetRef =
  | { type: 'asset'; path: string } // under public/assets/
  | { type: 'art'; file: string } // user art by file name

export interface ImageNode {
  kind: 'image'
  asset: AssetRef
  x: number
  y: number
  w: number
  h: number
  /** clip rect (mm); used for art inside its window */
  clip?: Rect
}

/** an icon drawn as vector markup (frame/megacredit.ts, frame/operators.ts) */
export interface VectorNode {
  kind: 'vector'
  icon: 'mc' | 'slash' | 'colon' | 'asterisk'
  x: number
  y: number
  w: number
  h: number
}

/** the any-player halo (frame/halo.ts): the icon's box, the ring drawn
 *  outside it at `scale` */
export interface HaloNode {
  kind: 'halo'
  shape: HaloShape
  x: number
  y: number
  w: number
  h: number
  scale: number
}

/** outline bands outward from the fill, each `width` mm; `inset` is how
 *  much of the innermost lies inside the glyph edge */
export interface TextOutline {
  readonly inset: number
  readonly bands: readonly { color: string; width: number }[]
}

export interface TextNode {
  kind: 'text'
  font: FontId
  /** font size in mm */
  size: number
  /** anchor point; y is the baseline */
  x: number
  y: number
  text: string
  fill: string
  anchor: 'start' | 'middle' | 'end'
  outline?: TextOutline
  /** extra mm between letters (title tracking); use anchor 'start' with a
   *  precomputed x so preview <text> and outlined export agree */
  letterSpacing?: number
  /** extra mm on every space (directive text), negative to tighten */
  wordSpacing?: number
  /** rotation in degrees around (x, y) */
  rotate?: number
}

export interface RectNode {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  /** css color, or the special fills 'production-pattern' / 'checkerboard' */
  fill: string
  gradient?: 'prod-outer' | 'prod-inner'
  /** tile-grid origin of a pattern fill, so the texture does not drift with the box */
  patternOrigin?: { x: number; y: number }
}

/** the drawn backdrop (frame/backdrop.ts) in the art window, grown by the art overshoot */
export interface BackdropNode {
  kind: 'backdrop'
  x: number
  y: number
  w: number
  h: number
}

/** the requirement box (frame/reqbox.ts); `max` swaps the gold paint for red */
export interface ReqBoxNode {
  kind: 'reqbox'
  /** outer width in mm, white margin included */
  w: number
  max: boolean
}

/** the vector card frame (frame/render.ts) */
export interface FrameNode {
  kind: 'frame'
  color: FrameColor
  /** y of the art window's bottom edge (card mm) */
  artBottom: number
  /** y of the art window's top edge, blue only; green and red fix theirs */
  artTop?: number
  /** banner seam x, placed per card around the requirement bar and tags */
  seamX?: number
  /** crystal texture seed: spec.seed, or derived from the card name */
  seed?: number
}

export type LayoutNode =
  ImageNode | VectorNode | HaloNode | TextNode | RectNode | BackdropNode | ReqBoxNode | FrameNode

export interface LayoutWarning {
  message: string
}

export interface CardLayout {
  nodes: LayoutNode[]
  warnings: LayoutWarning[]
  frame: { color: FrameColor; regions: FrameRegions }
}
