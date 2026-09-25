import opentype, { type OTFont, type OTPath } from 'opentype.js'
import type { FontId, InkBounds, TextMeasurer } from '../layout/measure.ts'
import { fmt as f } from '../units.ts'

/** opentype's toPathData turns ~1e-7 coordinates into NaNs via string
 *  rounding, so paths are serialized here. */
function pathToData(p: OTPath): string {
  let d = ''
  for (const c of p.commands) {
    if (c.type === 'M') d += `M${f(c.x!)} ${f(c.y!)}`
    else if (c.type === 'L') d += `L${f(c.x!)} ${f(c.y!)}`
    else if (c.type === 'Q') d += `Q${f(c.x1!)} ${f(c.y1!)} ${f(c.x!)} ${f(c.y!)}`
    else if (c.type === 'C')
      d += `C${f(c.x1!)} ${f(c.y1!)} ${f(c.x2!)} ${f(c.y2!)} ${f(c.x!)} ${f(c.y!)}`
    else d += 'Z'
  }
  return d
}

export const FONT_FILES: Record<FontId, string> = {
  proto: 'fonts/Prototype.ttf',
  serif: 'fonts/texgyrepagella-regular-webfont.ttf',
  serifItalic: 'fonts/texgyrepagella-italic-webfont.ttf',
  serifBold: 'fonts/texgyrepagella-bold-webfont.ttf',
  serifBoldItalic: 'fonts/texgyrepagella-bolditalic-webfont.ttf',
  sansBold: 'fonts/OpenSans-SemiBold.ttf',
}

/** CSS font-family names for the preview's @font-face declarations */
export const FONT_FAMILIES: Record<FontId, { family: string; style: string; weight: number }> = {
  proto: { family: 'Prototype', style: 'normal', weight: 400 },
  serif: { family: 'TeX Gyre Pagella', style: 'normal', weight: 400 },
  serifItalic: { family: 'TeX Gyre Pagella', style: 'italic', weight: 400 },
  serifBold: { family: 'TeX Gyre Pagella', style: 'normal', weight: 700 },
  serifBoldItalic: { family: 'TeX Gyre Pagella', style: 'italic', weight: 700 },
  sansBold: { family: 'Open Sans', style: 'normal', weight: 600 },
}

export class FontService implements TextMeasurer {
  private fonts: Record<FontId, OTFont>
  private caps: Record<FontId, number>

  constructor(buffers: Record<FontId, ArrayBuffer>) {
    this.fonts = Object.fromEntries(
      (Object.keys(buffers) as FontId[]).map((id) => [id, opentype.parse(buffers[id])]),
    ) as Record<FontId, OTFont>
    this.caps = Object.fromEntries(
      (Object.keys(this.fonts) as FontId[]).map((id) => {
        const box = this.fonts[id].getPath('H', 0, 0, 1).getBoundingBox()
        return [id, -box.y1]
      }),
    ) as Record<FontId, number>
  }

  width(text: string, font: FontId, size: number): number {
    return this.fonts[font].getAdvanceWidth(text, size, { kerning: true })
  }

  inkBounds(text: string, font: FontId, size: number): InkBounds {
    const b = this.fonts[font].getPath(text, 0, 0, size, { kerning: true }).getBoundingBox()
    return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 }
  }

  capHeight(font: FontId, size: number): number {
    return this.caps[font] * size
  }

  /** Path data for text with its baseline start at (x, y); the spacings are
   *  the browser's properties in mm. Spaced text is outlined glyph by glyph:
   *  opentype's own letterSpacing option yields NaN points at some sizes. */
  pathData(
    text: string,
    font: FontId,
    size: number,
    x: number,
    y: number,
    letterSpacing = 0,
    wordSpacing = 0,
  ): string {
    const f = this.fonts[font]
    if (!letterSpacing && !wordSpacing)
      return pathToData(f.getPath(text, x, y, size, { kerning: true }))
    const scale = size / f.unitsPerEm
    const glyphs = f.stringToGlyphs(text)
    let cx = x
    const parts: string[] = []
    glyphs.forEach((g, i) => {
      parts.push(pathToData(g.getPath(cx, y, size)))
      cx += (g.advanceWidth ?? 0) * scale
      if (g.unicode === 32) cx += wordSpacing
      if (i + 1 < glyphs.length) {
        cx += f.getKerningValue(g, glyphs[i + 1]) * scale + letterSpacing
      }
    })
    return parts.join('')
  }
}
