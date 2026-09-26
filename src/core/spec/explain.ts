// What a piece of a row means, for the editor's hover: an icon shows
// itself, and the modifiers, the brackets, the breaks and the requirement's
// max say what they do in a few words. Braces, operators, numbers, rules
// text and plain words are silent, since they show what they are. Scans
// the row as richtext.ts tokenizes it, but never fails: a broken row still
// explains what it can.
import { ICONS } from '../icons.ts'
import { REQUIREMENT_SYNTAX } from './requirement.ts'
import {
  GAPPED_BREAK,
  HALF_BREAK,
  inscribed,
  matchParen,
  SPACER,
  type RichTextOptions,
} from './richtext.ts'
import { ROW_SYNTAX } from './syntax.ts'
import { VP_SYNTAX } from './vp.ts'

export interface Explanation {
  /** offsets within the row */
  from: number
  to: number
  /** the icon named here, with the number written on it; or */
  icon?: { name: string; inscription?: string }
  /** what the piece does, in a few words */
  doc?: string
}

export interface ExplainOptions extends RichTextOptions {
  /** a leading `max` is a keyword (the requirement) */
  max?: boolean
}

/** the fields written in the row language, and how each reads */
export const ROW_FIELDS: Record<'body' | 'active' | 'requirement' | 'vp', ExplainOptions> = {
  body: {},
  active: {},
  requirement: { ...REQUIREMENT_SYNTAX, max: true },
  vp: VP_SYNTAX,
}

/** The explanation for the pointer on the character at `at` in `row`,
 *  when it is on a piece that has one. */
export function explainAt(
  row: string,
  at: number,
  opts: ExplainOptions = {},
): Explanation | undefined {
  if (at < 0 || at >= row.length) return undefined
  const max = opts.max ? /^(\s*)max(?=\s)/.exec(row) : null
  if (max && at >= max[1].length && at < max[0].length) {
    return { from: max[1].length, to: max[0].length, doc: 'Makes the requirement an upper limit' }
  }
  const spot = spotAt(row, at, opts)
  if (!spot) return undefined
  switch (spot.kind) {
    case 'braces': {
      const word = wordAt(row, at, spot.from, spot.to)
      if (!word) return undefined
      const meaning = explainWord(word.text)
      return meaning && { from: word.from, to: word.to, ...meaning }
    }
    case 'bracket':
      return { from: at, to: at + 1, doc: spot.box ? ROW_SYNTAX.box.doc : ROW_SYNTAX.stack.doc }
    case 'break':
      return { from: spot.from, to: spot.to, doc: breakDoc(spot.gap) }
  }
}

type Spot =
  /** inside braces: the span between them */
  | { kind: 'braces'; from: number; to: number }
  /** on a production box's or a stack's bracket */
  | { kind: 'bracket'; box: boolean }
  /** on or in a break: | or |3mm| with its own gap */
  | { kind: 'break'; from: number; to: number; gap?: number }

/** What the tokenizer makes of the character at `at`, as far as the hover
 *  cares: braces run to the next `}`, or to the end of the row when there
 *  is none; rules text is skipped whole (braces in it are an error); a
 *  break counts only where one is allowed. Nothing for anything else. */
function spotAt(row: string, at: number, opts: RichTextOptions): Spot | undefined {
  const stacks = opts.stacks ?? true
  const rules = opts.rules ?? true
  const lines = opts.lines ?? true
  // how many boxes and stacks are open at `i`
  let depth = 0
  let i = 0
  while (i <= at) {
    const ch = row[i]
    if (ch === '{') {
      const close = row.indexOf('}', i)
      const end = close === -1 ? row.length : close
      if (at <= end)
        return at > i && at < end ? { kind: 'braces', from: i + 1, to: end } : undefined
      i = end + 1
    } else if (ch === '(' && rules) {
      const close = matchParen(row, i)
      if (close === -1 || at <= close) return undefined
      i = close + 1
    } else if (ch === '|') {
      const rest = row.slice(i)
      const gapped = GAPPED_BREAK.exec(rest)
      const half = gapped ? null : HALF_BREAK.exec(rest)
      const match = gapped ?? half
      const end = match ? i + match[0].length : i + 1
      if (at < end) {
        // a half-written gap, or a break where the field is one line, is
        // an error the linter explains
        if (half || (!lines && depth === 0)) return undefined
        const brk: Spot = { kind: 'break', from: i, to: end }
        if (gapped) brk.gap = parseFloat(gapped[1])
        return brk
      }
      i = end
    } else if (stacks && (ch === '[' || ch === '<')) {
      if (at === i) return { kind: 'bracket', box: ch === '[' }
      depth++
      i++
    } else if (stacks && (ch === ']' || ch === '>')) {
      if (at === i) return { kind: 'bracket', box: ch === ']' }
      depth = Math.max(0, depth - 1)
      i++
    } else i++
  }
  return undefined
}

/** the run of non-space characters around `at` within [lo, hi) */
function wordAt(
  row: string,
  at: number,
  lo: number,
  hi: number,
): { from: number; to: number; text: string } | undefined {
  const space = (ch: string) => /\s/.test(ch)
  if (space(row[at])) return undefined
  let from = at
  while (from > lo && !space(row[from - 1])) from--
  let to = at + 1
  while (to < hi && !space(row[to])) to++
  return { from, to, text: row.slice(from, to) }
}

/** what one word in braces is, when hovering it says anything */
function explainWord(word: string): Pick<Explanation, 'doc' | 'icon'> | undefined {
  if (word === 'red') return { doc: 'Draws the any-player ring around the icon after it' }
  const spacer = SPACER.exec(word)
  if (spacer) return { doc: spacerDoc(parseFloat(spacer[1])) }
  const coin = inscribed(word)
  if (coin) return { icon: { name: coin.name, inscription: coin.count } }
  if (!Object.hasOwn(ICONS, word)) return undefined
  if (ICONS[word].note)
    return { doc: 'Attaches the see-rules asterisk to the icon or text before it' }
  return { icon: { name: word } }
}

/** what a {3mm} spacer does to its neighbours */
function spacerDoc(mm: number): string {
  return mm < 0
    ? `A spacer: its neighbours overlap by ${-mm} mm`
    : `A spacer: ${mm} mm between its neighbours`
}

/** what a break does: a bare |, or |3mm| with its own gap */
function breakDoc(gap?: number): string {
  if (gap === undefined) return 'A line break'
  return gap < 0
    ? `A line break: the lines overlap by ${-gap} mm`
    : `A line break: ${gap} mm between the lines`
}
