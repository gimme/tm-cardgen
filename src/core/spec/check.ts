import { parseCardYaml } from './parse.ts'
import type { CardSpec, Diagnostic } from './types.ts'
import { validateCard } from './validate.ts'

export interface CheckedCard {
  /** set only when the card is valid */
  spec?: CardSpec
  diagnostics: Diagnostic[]
}

export function checkCard(text: string): CheckedCard {
  const { doc, syntaxErrors } = parseCardYaml(text)
  if (syntaxErrors.length > 0) return { diagnostics: syntaxErrors }
  return validateCard(doc, text)
}
