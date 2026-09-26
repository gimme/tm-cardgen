import { parseDocument, type Document } from 'yaml'
import type { Diagnostic } from './types.ts'

export interface ParseResult {
  doc: Document
  syntaxErrors: Diagnostic[]
}

/** Parse the card YAML. The Document keeps node ranges for validation. */
export function parseCardYaml(source: string): ParseResult {
  // the editor underlines the range, so the library's line/column suffix and snippet only add noise
  const doc = parseDocument(source, { keepSourceTokens: true, prettyErrors: false })
  const syntaxErrors: Diagnostic[] = doc.errors.map((e) => ({
    severity: 'error',
    message: e.message,
    from: e.pos[0],
    to: Math.max(e.pos[1], e.pos[0] + 1),
  }))
  return { doc, syntaxErrors }
}
