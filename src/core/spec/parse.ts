import { parseDocument, type Document } from 'yaml'
import type { Diagnostic } from './types.ts'

export interface ParseResult {
  doc: Document
  syntaxErrors: Diagnostic[]
}

/** Parse the card YAML. The Document keeps node ranges for validation. */
export function parseCardYaml(source: string): ParseResult {
  const doc = parseDocument(source, { keepSourceTokens: true })
  const syntaxErrors: Diagnostic[] = doc.errors.map((e) => ({
    severity: 'error',
    message: e.message.split('\n')[0],
    from: e.pos[0],
    to: Math.max(e.pos[1], e.pos[0] + 1),
  }))
  return { doc, syntaxErrors }
}
