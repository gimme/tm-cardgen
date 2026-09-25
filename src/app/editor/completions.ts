import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete'
import {
  ART_FIELDS,
  gluedWords,
  ICON_NAMES,
  KNOWN_TAGS,
  TOP_LEVEL_FIELDS,
  yamlFileName,
} from '../../core/index.ts'

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

  // icon names inside { }, after any text or icon: {3 pla… {OR STEAL red m…
  const icon = /\{[^}]*?([+-]?[a-zA-Z0-9.-]*)$/.exec(before)
  if (icon) {
    // a lone sign is an operator, {+ …, or a coin or spacer in the making
    if (/^[+-]$/.test(icon[1])) return null
    // a number glued to the front completes only to a coin or a spacer
    const glued = /^([+-]?[\d.]+|X)([a-z]*)$/.exec(icon[1])
    const names = glued ? gluedWords(glued[1]) : ICON_NAMES
    const word = glued ? glued[2] : icon[1]
    return {
      from: context.pos - word.length,
      options: names.map((name) => ({ label: name, type: 'constant' })),
      validFor: /^[a-zA-Z0-9-]*$/,
    }
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
