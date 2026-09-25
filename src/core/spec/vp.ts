import { parseRichText, type RichTextError } from './richtext.ts'
import type { VpSpec } from './types.ts'

export interface VpParseResult {
  /** absent when anything is an error */
  vp?: VpSpec
  errors: RichTextError[]
  warnings: RichTextError[]
}

export const VP_USAGE = 'vp is an integer or a row set in the disc, like "1 {/ 2 microbe}"'

/** Parse the `vp:` field: an integer, or a row string. Bare text is the
 *  disc's numeral; a row with none gets a hint. */
export function parseVp(value: unknown): VpParseResult {
  const src =
    typeof value === 'number' && Number.isInteger(value)
      ? String(value)
      : typeof value === 'string'
        ? value
        : undefined
  if (src === undefined) return { errors: [{ message: VP_USAGE, start: 0, end: 0 }], warnings: [] }
  const { items, errors, warnings } = parseRichText(src, {
    stacks: false,
    rules: false,
    lines: false,
  })
  if (errors.length > 0) return { errors, warnings }
  if (items.length === 0)
    return { errors: [{ message: VP_USAGE, start: 0, end: src.length }], warnings }
  if (!items.some((it) => it.kind === 'text' && !it.big))
    warnings.push({
      message: "the disc's numeral stands outside the braces: '1 {/ 2 microbe}'",
      start: 0,
      end: src.length,
    })
  return { vp: items, errors, warnings }
}
