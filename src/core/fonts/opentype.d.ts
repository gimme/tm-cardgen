// Ambient types for opentype.js 2.0, which ships no .d.ts: only the surface
// the core uses.
declare module 'opentype.js' {
  export interface OTBoundingBox {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  export interface OTPathCommand {
    type: 'M' | 'L' | 'Q' | 'C' | 'Z'
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
  }
  export interface OTPath {
    commands: OTPathCommand[]
    getBoundingBox(): OTBoundingBox
  }
  export interface OTGlyph {
    advanceWidth?: number
    /** the code point the glyph maps from, when it maps from one */
    unicode?: number
    getPath(x: number, y: number, fontSize: number): OTPath
  }
  export interface OTFont {
    unitsPerEm: number
    getAdvanceWidth(text: string, fontSize: number, options?: { kerning?: boolean }): number
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: { kerning?: boolean; letterSpacing?: number },
    ): OTPath
    stringToGlyphs(text: string): OTGlyph[]
    getKerningValue(left: OTGlyph, right: OTGlyph): number
  }
  const opentype: {
    parse(buffer: ArrayBuffer): OTFont
  }
  export default opentype
}
