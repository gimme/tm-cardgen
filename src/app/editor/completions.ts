import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete'
import {
  ART_FIELDS,
  gluedWords,
  ICON_NAMES,
  ICONS,
  KNOWN_TAGS,
  OPERATORS,
  TOP_LEVEL_FIELDS,
  yamlFileName,
} from '../../core/index.ts'

/** A word in braces has the type `word`: the list gives those an icon
 *  column (completionIcons.ts), and an icon name carries the icon to draw
 *  there, with the number written on it. */
export interface IconCompletion extends Completion {
  icon: { name: string; inscription?: string }
}

export const hasIcon = (c: Completion): c is IconCompletion => 'icon' in c

const iconWord = (name: string, inscription?: string): IconCompletion => ({
  label: name,
  type: 'word',
  icon: inscription === undefined ? { name } : { name, inscription },
})

/** after the icons come the modifier, then the symbols */
const MODIFIER = { boost: -1 }
const SYMBOL = { boost: -2 }

/** everything a word in braces can be: the icons, then `red` and the operators */
const BRACE_WORDS: Completion[] = [
  ...ICON_NAMES.map((name): Completion => {
    // a footnote mark is a glyph like the operators, not an icon to draw
    const word = ICONS[name].note ? { label: name, type: 'word' } : iconWord(name)
    return /^[a-z]/.test(name) ? word : { ...word, ...SYMBOL }
  }),
  { label: 'red', type: 'word', ...MODIFIER },
  ...OPERATORS.map((op): Completion => ({ label: op, type: 'word', ...SYMBOL })),
]

export function cardCompletions(
  context: CompletionContext,
  artFiles: string[],
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const before = context.state.sliceDoc(line.from, context.pos)
  const top = topLevelKeyAt(context, line.from)

  // art: its file names as the whole value or the map's file, its own keys inside
  // its { } or indented under it; its braces hold no icons
  if (top?.key === 'art' && /^(art:|\s)/.test(before)) {
    const written = context.state
      .sliceDoc(top.from + 'art:'.length, context.pos)
      .replace(/\[[^\]]*\]/g, '')
    // art:{ is a plain scalar, and an open [ is the offset being written
    if (!/^\s/.test(written) || written.includes('[')) return null
    const file = /(?:^[ \t]+|[,{\n]\s*file:[ \t]+)(['"]?)([^'",{}\n]*)$/.exec(written)
    if (file) {
      return {
        from: context.pos - file[2].length,
        options: artFiles.map((name) => ({
          label: name,
          apply: yamlFileName(name, file[1]),
          type: 'constant',
        })),
        validFor: /^[^'",{}]*$/,
      }
    }
    const word = /[,{\n]\s*([a-zA-Z]*)$/.exec(written)
    if (!word) return null
    const options: Completion[] = Object.entries(ART_FIELDS).map(([key, meta]) => ({
      label: key,
      apply: `${key}: `,
      type: 'property',
      info: meta.doc,
    }))
    return { from: context.pos - word[1].length, options, validFor: /^[a-zA-Z]*$/ }
  }

  // a word inside { }, after any text or icon: {3 pla… {OR STEAL red m…
  const icon = /\{[^}]*?([+-]?[a-zA-Z0-9.-]*)$/.exec(before)
  if (icon) {
    // a lone sign is an operator, {+ …, or a coin or spacer in the making
    if (/^[+-]$/.test(icon[1])) return null
    // a word starts after the brace or a space, not right after {-> or {city :
    if (icon[1] === '' && !/[\s{]$/.test(before)) return null
    // a number glued to the front completes only to a coin or a spacer; the
    // coin is drawn with the number on it
    const glued = /^([+-]?[\d.]+|X)([a-z]*)$/.exec(icon[1])
    if (glued) {
      return {
        from: context.pos - glued[2].length,
        options: gluedWords(glued[1]).map((name): Completion =>
          ICON_NAMES.includes(name) ? iconWord(name, glued[1]) : { label: name, type: 'word' },
        ),
        validFor: /^[a-zA-Z0-9-]*$/,
      }
    }
    return { from: context.pos - icon[1].length, options: BRACE_WORDS, validFor: /^[a-zA-Z0-9-]*$/ }
  }

  // tag names inside tags: [ … ] or after `- ` under tags:
  if (
    /tags:\s+\[[^\]]*$/.test(before) ||
    (top?.key === 'tags' && /^\s*-\s+[a-zA-Z]*$/.test(before))
  ) {
    const word = /([a-zA-Z-]*)$/.exec(before)!
    return {
      from: context.pos - word[1].length,
      options: KNOWN_TAGS.map((t) => ({ label: t, type: 'constant' })),
      validFor: /^[a-zA-Z-]*$/,
    }
  }

  // top-level keys at column 0
  const topKey = /^([a-zA-Z]*)$/.exec(before)
  if (topKey) {
    const options: Completion[] = Object.entries(TOP_LEVEL_FIELDS).map(([key, meta]) => ({
      label: key,
      apply: `${key}: `,
      type: 'property',
      info: meta.doc,
    }))
    return { from: line.from, options, validFor: /^[a-zA-Z]*$/ }
  }

  return null
}

/** The top-level key whose value the line at `lineFrom` sits in, and where that key's line starts. */
function topLevelKeyAt(
  context: CompletionContext,
  lineFrom: number,
): { key: string; from: number } | undefined {
  const doc = context.state.doc
  for (let lineNo = doc.lineAt(lineFrom).number; lineNo >= 1; lineNo--) {
    const line = doc.line(lineNo)
    const m = /^([a-zA-Z]+):/.exec(line.text)
    if (m) return { key: m[1], from: line.from }
  }
  return undefined
}
