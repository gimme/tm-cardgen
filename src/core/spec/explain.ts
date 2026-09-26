// What a piece of a row means, for the editor's hover: the cheat sheet's
// words on the form under the pointer, or the icon named there. Scans the
// text the way richtext.ts tokenizes it, but never fails: a broken row
// still explains what it can.
import { ICONS } from '../icons.ts'
import { REQUIREMENT_SYNTAX } from './requirement.ts'
import { inscribed, isOperator, matchParen, SPACER, type RichTextOptions } from './richtext.ts'
import { ROW_SYNTAX } from './syntax.ts'
import { VP_SYNTAX } from './vp.ts'

export interface Explanation {
  /** offsets within the row */
  from: number
  to: number
  /** the cheat sheet's words, `code` in backticks */
  doc: string
  /** the icon named here, with the number written on it */
  icon?: { name: string; inscription?: string }
}

export interface ExplainOptions extends RichTextOptions {
  /** what words outside braces are in this field; rows print them bold */
  bare?: string
}

/** the fields written in the row language, and how each reads */
export const ROW_FIELDS: Record<'body' | 'active' | 'requirement' | 'vp', ExplainOptions> = {
  body: {},
  active: {},
  requirement: {
    ...REQUIREMENT_SYNTAX,
    bare: 'Text in the requirement bar; a leading `max` makes the requirement an upper limit',
  },
  vp: { ...VP_SYNTAX, bare: "The disc's numeral, printed large" },
}

/** The explanation for the pointer on the character at `at` in `row`,
 *  when it is on anything. */
export function explainAt(
  row: string,
  at: number,
  opts: ExplainOptions = {},
): Explanation | undefined {
  if (at < 0 || at >= row.length) return undefined
  const stacks = opts.stacks ?? true
  const rules = opts.rules ?? true
  const ctx = contextAt(row, at, rules)
  if (ctx.kind === 'rules') return { from: ctx.open, to: ctx.close + 1, doc: ROW_SYNTAX.rules.doc }
  if (ctx.kind === 'braces') {
    const inner = ctx.close ?? row.length
    if (at === ctx.open || at === ctx.close) {
      const words = row
        .slice(ctx.open + 1, inner)
        .split(/\s+/)
        .filter(Boolean)
      const doc = words.length > 1 ? ROW_SYNTAX.group.doc : ROW_SYNTAX.icon.doc
      return { from: ctx.open, to: Math.min(inner + 1, row.length), doc }
    }
    const word = wordAt(row, at, ctx.open + 1, inner, '')
    return word && { from: word.from, to: word.to, ...explainWord(word.text) }
  }
  const ch = row[at]
  if (stacks && (ch === '[' || ch === ']')) return { from: at, to: at + 1, doc: ROW_SYNTAX.box.doc }
  if (stacks && (ch === '<' || ch === '>'))
    return { from: at, to: at + 1, doc: ROW_SYNTAX.stack.doc }
  const gap = gapAround(row, at)
  if (gap) return { ...gap, doc: ROW_SYNTAX.gap.doc }
  if (ch === '|') return { from: at, to: at + 1, doc: ROW_SYNTAX.line.doc }
  if (/\s/.test(ch)) return undefined
  const word = wordAt(row, at, 0, row.length, `{}|${stacks ? '[]<>' : ''}${rules ? '()' : ''}`)
  return word && { from: word.from, to: word.to, doc: opts.bare ?? ROW_SYNTAX.words.doc }
}

type Context =
  | { kind: 'braces'; open: number; close?: number }
  | { kind: 'rules'; open: number; close: number }
  | { kind: 'top' }

/** The braces or rules text `at` sits in, scanning as the tokenizer does:
 *  braces run to the next `}`, rules text to its matching `)`, and an
 *  unclosed one to the end of the row. */
function contextAt(row: string, at: number, rules: boolean): Context {
  let i = 0
  while (i <= at) {
    const ch = row[i]
    if (ch === '{') {
      const close = row.indexOf('}', i)
      const end = close === -1 ? row.length : close
      if (at <= end) return { kind: 'braces', open: i, close: close === -1 ? undefined : close }
      i = end + 1
    } else if (ch === '(' && rules) {
      const close = matchParen(row, i)
      if (close === -1) return { kind: 'top' }
      if (at <= close) return { kind: 'rules', open: i, close }
      i = close + 1
    } else i++
  }
  return { kind: 'top' }
}

/** the run of non-space characters around `at` within [lo, hi), stopping
 *  at any of `stops` */
function wordAt(
  row: string,
  at: number,
  lo: number,
  hi: number,
  stops: string,
): { from: number; to: number; text: string } | undefined {
  const boundary = (ch: string) => /\s/.test(ch) || stops.includes(ch)
  if (boundary(row[at])) return undefined
  let from = at
  while (from > lo && !boundary(row[from - 1])) from--
  let to = at + 1
  while (to < hi && !boundary(row[to])) to++
  return { from, to, text: row.slice(from, to) }
}

/** a gapped break, |3mm|, with `at` anywhere in it */
function gapAround(row: string, at: number): { from: number; to: number } | undefined {
  const re = /\|\s*[+-]?(?:\d+\.?\d*|\.\d+)mm\s*\|/g
  for (let m = re.exec(row); m; m = re.exec(row)) {
    if (m.index <= at && at < m.index + m[0].length)
      return { from: m.index, to: m.index + m[0].length }
  }
  return undefined
}

/** what one word inside braces is */
function explainWord(word: string): Pick<Explanation, 'doc' | 'icon'> {
  if (word === 'red') return { doc: ROW_SYNTAX.red.doc }
  if (isOperator(word)) return { doc: ROW_SYNTAX.operator.doc }
  if (SPACER.test(word)) return { doc: ROW_SYNTAX.spacer.doc }
  const coin = inscribed(word)
  if (coin) {
    return { doc: ROW_SYNTAX.coin.doc, icon: { name: coin.name, inscription: coin.count } }
  }
  const def = Object.hasOwn(ICONS, word) ? ICONS[word] : undefined
  if (!def) return { doc: ROW_SYNTAX.big.doc }
  if (def.note) return { doc: ROW_SYNTAX.note.doc }
  if (word === '->') return { doc: ROW_SYNTAX.arrow.doc, icon: { name: word } }
  return { doc: def.inscribed ? ROW_SYNTAX.coin.doc : `\`${word}\``, icon: { name: word } }
}
