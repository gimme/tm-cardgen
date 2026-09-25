import { parseRichText, type RichTextError } from './richtext.ts'
import type { Requirement } from './types.ts'

/** Parse a `requirement:` string: optional leading `max`, then row items. */
export function parseRequirement(src: string): {
  req: Requirement
  errors: RichTextError[]
  warnings: RichTextError[]
} {
  const maxMatch = /^\s*max\s+/.exec(src)
  const rest = maxMatch ? src.slice(maxMatch[0].length) : src
  const offset = maxMatch ? maxMatch[0].length : 0
  const { items, errors, warnings } = parseRichText(rest, {
    stacks: true,
    rules: false,
    lines: false,
  })
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
