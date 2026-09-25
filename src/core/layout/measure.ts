// Text measurement interface; FontService implements it. Sizes are mm.
export type FontId =
  | 'proto'
  | 'serif'
  | 'serifItalic'
  | 'serifBold'
  | 'serifBoldItalic'
  /** directive text */
  | 'sansBold'

/** the ink of a run of text set with its baseline start at (0, 0): x
 *  across, y down, so a cap's top is at -capHeight */
export interface InkBounds {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface TextMeasurer {
  /** advance width of `text` at font size `size` mm (kerning applied) */
  width(text: string, font: FontId, size: number): number
  /** the ink bounds of `text` at `size` mm (for boxing a glyph like an icon) */
  inkBounds(text: string, font: FontId, size: number): InkBounds
  /** cap height in mm at `size` (for vertical centering) */
  capHeight(font: FontId, size: number): number
}

/** the advance with letter-spacing on every gap and word-spacing on every
 *  space, as the browser draws it */
export function spacedWidth(
  m: TextMeasurer,
  text: string,
  font: FontId,
  size: number,
  letterSpacing = 0,
  wordSpacing = 0,
): number {
  return (
    m.width(text, font, size) +
    letterSpacing * Math.max(0, text.length - 1) +
    wordSpacing * (text.match(/ /g)?.length ?? 0)
  )
}
