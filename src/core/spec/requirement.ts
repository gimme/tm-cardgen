import { parseRichText, type RichTextError, type RichTextOptions } from './richtext.ts'
import type { Requirement } from './types.ts'

/** the requirement is one line, boxes allowed, no rules text */
export const REQUIREMENT_SYNTAX: RichTextOptions = { stacks: true, rules: false, lines: false }

/** Parse a `requirement:` string: optional leading `max`, then rich text. */
export function parseRequirement(src: string): {
  req: Requirement
  errors: RichTextError[]
  warnings: RichTextError[]
} {
  const maxMatch = /^\s*max\s+/.exec(src)
  const rest = maxMatch ? src.slice(maxMatch[0].length) : src
  const offset = maxMatch ? maxMatch[0].length : 0
  const { items, errors, warnings } = parseRichText(rest, REQUIREMENT_SYNTAX)
  const rebase = (n: number) => n + offset
  for (const item of items) {
    item.start = rebase(item.start)
    item.end = rebase(item.end)
  }
  for (const e of [...errors, ...warnings]) {
    e.start = rebase(e.start)
    e.end = rebase(e.end)
  }
  return { req: { max: !!maxMatch, items }, errors, warnings }
}
