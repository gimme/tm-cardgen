// Tokenizer for the row language of body and active rows, the requirement
// and the VP disc; syntax.ts lists its forms. Modifiers mark one neighbour
// and never reach past their braces. Lowercase words are reserved for icon
// names, `red` and the mm unit. There are no escapes: brackets are
// structure wherever they stand.
import { ICON_NAMES, ICONS, suggest } from '../icons.ts'

/** Source offset of the braces the item was written in; the layout sets
 *  items sharing one tight. */
export interface Grouped {
  group?: number
}

export interface TextRun extends Grouped {
  kind: 'text'
  text: string
  /** written in braces: printed at the count size, not the directive size */
  big: boolean
  /** offset of the run within the source string */
  start: number
  end: number
}

export interface IconToken extends Grouped {
  kind: 'icon'
  name: string
  /** the any-player halo */
  red: boolean
  /** a number or X drawn on the icon, written attached: 25mc */
  inscription?: string
  /** offsets of the name within the source string */
  start: number
  end: number
}

/** {3mm}: `w` replaces the row gap between its neighbours; negative overlaps them. */
export interface SpacerItem extends Grouped {
  kind: 'spacer'
  w: number
  start: number
  end: number
}

/** A word of exactly one of these, in braces, is an operator. */
const OPERATORS = ['+', '-', '=', ':', '/'] as const
export type Operator = (typeof OPERATORS)[number]
const isOperator = (w: string): w is Operator => (OPERATORS as readonly string[]).includes(w)

export interface OperatorItem extends Grouped {
  kind: 'op'
  op: Operator
  start: number
  end: number
}

/** A line break; `gap` replaces the line gap with that many mm. */
export interface BreakItem {
  kind: 'break'
  gap?: number
  start: number
  end: number
}

/** A production box or a bare column: items with breaks between the lines,
 *  each line a row. */
export interface Stack {
  kind: 'stack'
  /** painted as the production box */
  box: boolean
  items: RichTextItem[]
  start: number
  end: number
}

/** Rules text, verbatim with its outer parentheses; the layout wraps it. */
export interface RulesText {
  kind: 'rules'
  text: string
  start: number
  end: number
}

export type RichTextItem =
  TextRun | IconToken | OperatorItem | SpacerItem | BreakItem | Stack | RulesText

export interface RichTextError {
  message: string
  start: number
  end: number
}

export interface RichTextResult {
  items: RichTextItem[]
  errors: RichTextError[]
  /** same shape, but the item stays: hints the writer may ignore */
  warnings: RichTextError[]
}

export interface RichTextOptions {
  /** allow [production boxes] and <stacks> (rows, requirement) */
  stacks?: boolean
  /** allow (rules text) blocks (rows only) */
  rules?: boolean
  /** allow a bare | to break the row into lines (rows only) */
  lines?: boolean
}

/** a gapped break: `|3mm|`, spaces allowed inside */
const GAPPED_BREAK = /^\|\s*([+-]?(?:\d+\.?\d*|\.\d+))mm\s*\|/
/** the same without its closing pipe, `|3mm`: reported with a hint */
const HALF_BREAK = /^\|\s*([+-]?(?:\d+\.?\d*|\.\d+))mm(?=\s|$)/

/** Tokenize a row. Never throws; errors carry offsets, items are best effort. */
export function parseRichText(src: string, opts: RichTextOptions = {}): RichTextResult {
  const stacks = opts.stacks ?? true
  const rules = opts.rules ?? true
  const lines = opts.lines ?? true
  const errors: RichTextError[] = []
  const warnings: RichTextError[] = []
  const err: Report = (message, start, end) => errors.push({ message, start, end })
  const warn: Report = (message, start, end) => warnings.push({ message, start, end })

  let i = 0

  /** The items up to the bracket closing `closer`, or to the end of the row
   *  when there is none, with `i` left after it. `[` and `<` recurse. */
  function sequence(closer?: ']' | '>'): { items: RichTextItem[]; closed: boolean } {
    const items: RichTextItem[] = []
    let text = ''
    let textStart = 0
    const flushText = () => {
      const run = text.trimEnd()
      text = ''
      if (run.length === 0) return
      const start = textStart
      const end = start + run.length
      // a lone symbol standing between tokens was meant as one; in prose it stays
      if (SPACER.test(run))
        warn(
          `'${run}' prints as text — a spacer is written '{${run}}', a gap between lines '|${run}|'`,
          start,
          end,
        )
      else if (isOperator(run))
        warn(`'${run}' prints as text — an operator is written '{${run}}'`, start, end)
      items.push({ kind: 'text', text: run, big: false, start, end })
    }
    const literal = (ch: string, at: number) => {
      if (text === '') {
        if (/\s/.test(ch)) return
        textStart = at
      }
      text += ch
    }
    let lineStart = 0
    let rulesAt: number | undefined
    const endLine = () => {
      const line = items.slice(lineStart)
      if (line.length > 0 && line.every((it) => it.kind === 'spacer'))
        warn(
          "a line of only spacers prints nothing — a gap between lines is written '|3mm|'",
          line[0].start,
          line[line.length - 1].end,
        )
    }
    const startLine = () => {
      lineStart = items.length
      rulesAt = undefined
    }

    while (i < src.length) {
      const ch = src[i]
      if (ch === '{') {
        flushText()
        const close = src.indexOf('}', i)
        if (close === -1) {
          err('unclosed { token', i, src.length)
          i = src.length
          break
        }
        const group = { start: i, end: close + 1 }
        items.push(...parseBraces(src.slice(i + 1, close), i + 1, group, err, warn))
        i = close + 1
        continue
      }
      if (ch === '}') {
        err("stray '}' (no open token)", i, i + 1)
        i++
        continue
      }
      if (stacks && (ch === '[' || ch === '<')) {
        flushText()
        const box = ch === '['
        const what = box ? 'production box' : 'stack'
        const start = i
        i++
        const inner = sequence(box ? ']' : '>')
        if (!inner.closed) {
          err(`unclosed '${ch}' ${what}`, start, src.length)
          // recover: keep the orphaned items in the row
          items.push(...inner.items)
        } else if (!inner.items.some((it) => it.kind !== 'break')) {
          err(`empty ${what}`, start, i)
        } else {
          items.push({ kind: 'stack', box, items: inner.items, start, end: i })
        }
        continue
      }
      if (stacks && (ch === ']' || ch === '>')) {
        flushText()
        i++
        if (ch === closer) {
          endLine()
          return { items, closed: true }
        }
        err(`stray '${ch}' (no open ${ch === ']' ? 'production box' : 'stack'})`, i - 1, i)
        continue
      }
      if (ch === '|') {
        flushText()
        const rest = src.slice(i)
        const gapped = GAPPED_BREAK.exec(rest)
        const half = gapped ? null : HALF_BREAK.exec(rest)
        const match = gapped ?? half
        const end = match ? i + match[0].length : i + 1
        if (closer === undefined && !lines) {
          err("'|' breaks a line, and this field is one line", i, end)
        } else if (half) {
          err(`a break with its own gap is written '|${half[1]}mm|'`, i, end)
        } else {
          endLine()
          const brk: BreakItem = { kind: 'break', start: i, end }
          if (gapped) brk.gap = parseFloat(gapped[1])
          items.push(brk)
          startLine()
        }
        i = end
        continue
      }
      if (ch === '(' && rules) {
        flushText()
        const close = matchParen(src, i)
        if (close === -1) {
          err('unclosed ( rules text', i, src.length)
          i = src.length
          break
        }
        const inner = src.slice(i + 1, close)
        const bad = /[{}[\]]/.exec(inner)
        if (bad) {
          err(
            'rules text is plain text — put icons and boxes outside the parentheses',
            i + 1 + bad.index,
            i + 2 + bad.index,
          )
        } else if (rulesAt !== undefined) {
          err('one (rules text) block per line', i, close + 1)
        } else {
          items.push({ kind: 'rules', text: `(${inner})`, start: i, end: close + 1 })
          rulesAt = i
        }
        i = close + 1
        continue
      }
      if (ch === ')' && rules) {
        err("stray ')' (no open rules text)", i, i + 1)
        i++
        continue
      }
      literal(ch, i)
      i++
    }
    flushText()
    endLine()
    return { items, closed: closer === undefined }
  }

  const { items } = sequence()
  return { items, errors, warnings }
}

/** index of the ')' matching the '(' at `open`, or -1 */
function matchParen(src: string, open: number): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return i
  }
  return -1
}

type Report = (message: string, start: number, end: number) => void

/** a spacer word: a signed decimal with the mm unit attached, `-1.5mm` */
const SPACER = /^([+-]?(?:\d+\.?\d*|\.\d+))mm$/
/** an inscribed icon with its count attached, `25mc` `Xmc` `-2mc` */
const INSCRIBED = /^([+-]?\d+|X)([a-z][a-z-]*)$/
const inscribed = (w: string): { count: string; name: string } | undefined => {
  const m = INSCRIBED.exec(w)
  return m && ICONS[m[2]]?.inscribed ? { count: m[1], name: m[2] } : undefined
}

/** What a number glued to the front can complete to; for the editor. */
export function gluedWords(n: string): string[] {
  const words = ICON_NAMES.filter((name) => inscribed(n + name))
  if (SPACER.test(n + 'mm')) words.push('mm')
  return words
}

/** Items for the words inside one {...} group. A lowercase word that is not
 *  an icon, spacer, operator or `red` is an error and empties the group; so
 *  is a modifier with nothing to mark. */
function parseBraces(
  inner: string,
  innerStart: number,
  group: { start: number; end: number },
  err: Report,
  warn: Report,
): RichTextItem[] {
  type Part = { word: string; start: number; end: number }
  const parts: Part[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(inner)))
    parts.push({ word: m[0], start: innerStart + m.index, end: innerStart + m.index + m[0].length })
  if (parts.length === 0) {
    err('empty token', group.start, group.end)
    return []
  }

  const isIcon = (w: string) => Object.hasOwn(ICONS, w)
  /** the icon a word names, its count stripped */
  const iconOf = (w: string): string | undefined =>
    inscribed(w)?.name ?? (isIcon(w) ? w : undefined)
  const known = (w: string) =>
    !/[a-z]/.test(w) || isIcon(w) || !!inscribed(w) || SPACER.test(w) || w === 'red'
  for (const [i, p] of parts.entries()) {
    if (known(p.word)) continue
    const before = parts[i - 1]
    // a spacer split in two gets its own hint
    const why =
      p.word === 'mm' && before && SPACER.test(before.word + 'mm')
        ? `a spacer is one word: '${before.word}mm'`
        : hintFor(p.word)
    err(`unknown icon '${p.word}' — ${why}`, p.start, p.end)
    return []
  }

  // each modifier marks one neighbour: red the icon after it, a note the
  // icon or text before it
  for (const [i, p] of parts.entries()) {
    if (p.word === 'red') {
      const next = parts[i + 1]
      const icon = next && iconOf(next.word)
      if (icon === undefined) {
        err("'red' needs an icon right after it", p.start, p.end)
        return []
      }
      if (!ICONS[icon].halo) {
        err(`'${next.word}' takes no halo`, p.start, next.end)
        return []
      }
    } else if (ICONS[p.word]?.note) {
      const before = parts[i - 1]
      const hosted =
        before !== undefined &&
        before.word !== 'red' &&
        !SPACER.test(before.word) &&
        !isOperator(before.word) &&
        !ICONS[before.word]?.note
      if (!hosted) {
        err(`'${p.word}' needs an icon or text right before it`, p.start, p.end)
        return []
      }
    }
  }

  const items: RichTextItem[] = []
  let text: Part[] = []
  const flushText = () => {
    if (text.length === 0) return
    items.push({
      kind: 'text',
      text: text.map((p) => p.word).join(' '),
      big: true,
      group: group.start,
      start: text[0].start,
      end: text[text.length - 1].end,
    })
    text = []
  }
  for (const [i, p] of parts.entries()) {
    if (p.word === 'red') continue
    const spacer = SPACER.exec(p.word)
    if (spacer) {
      flushText()
      items.push({
        kind: 'spacer',
        w: parseFloat(spacer[1]),
        group: group.start,
        start: p.start,
        end: p.end,
      })
      continue
    }
    if (isOperator(p.word)) {
      flushText()
      items.push({ kind: 'op', op: p.word, group: group.start, start: p.start, end: p.end })
      continue
    }
    const coin = inscribed(p.word)
    if (coin || isIcon(p.word)) {
      flushText()
      const icon: IconToken = {
        kind: 'icon',
        name: coin ? coin.name : p.word,
        red: parts[i - 1]?.word === 'red',
        group: group.start,
        start: p.start,
        end: p.end,
      }
      if (coin) icon.inscription = coin.count
      else if (ICONS[p.word].inscribed)
        warn(`${p.word} needs its number attached: '3${p.word}'`, p.start, p.end)
      items.push(icon)
      continue
    }
    text.push(p)
  }
  flushText()
  return items
}

/** the names spelt as words, the ones a misspelling can be near */
const ICON_WORDS = ICON_NAMES.filter((name) => /^[a-z]/.test(name))

/** a spelling hint when the word is shaped like a name, else the CAPS rule */
function hintFor(word: string): string {
  const hint = /^[a-z0-9-]+$/.test(word) ? suggest(word, ['red', ...ICON_WORDS]) : undefined
  return hint ? `did you mean '${hint}'?` : 'text in braces is written in CAPS'
}
