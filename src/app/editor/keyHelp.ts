import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { EditorView, hoverTooltip } from '@codemirror/view'
import { ART_FIELDS, TOP_LEVEL_FIELDS } from '../../core/index.ts'

export interface KeyHelp {
  from: number
  to: number
  doc: string
}

/** The one-line help for the key at `pos`, when it is a known one: a top-level
 *  key, or one of art's inside its map. `side` says which neighbour the
 *  pointer is on when `pos` is a boundary, as hoverTooltip reports it. */
export function keyHelpAt(state: EditorState, pos: number, side: -1 | 1): KeyHelp | undefined {
  const inner = syntaxTree(state).resolveInner(pos, side)
  // the pointer lands on the Key's Literal or QuotedLiteral
  const key = inner.name === 'Key' ? inner : inner.parent
  if (key?.name !== 'Key') return undefined
  // Pair > BlockMapping | FlowMapping > whatever holds the mapping
  const holder = key.parent?.parent?.parent
  let fields: Record<string, { doc: string }>
  if (holder?.name === 'Document') fields = TOP_LEVEL_FIELDS
  else if (
    holder?.name === 'Pair' &&
    holder.parent?.parent?.name === 'Document' &&
    keyName(state, holder.getChild('Key')) === 'art'
  ) {
    fields = ART_FIELDS
  } else return undefined
  const name = keyName(state, key)
  const field = Object.hasOwn(fields, name) ? fields[name] : undefined
  return field && { from: key.from, to: key.to, doc: field.doc }
}

/** The key as written, without its quotes. */
function keyName(state: EditorState, key: { from: number; to: number } | null): string {
  return key ? state.sliceDoc(key.from, key.to).replace(/^(['"])(.*)\1$/, '$2') : ''
}

/** Hovering a known key shows its one-line help. */
export const keyHelp = [
  hoverTooltip((view, pos, side) => {
    const help = keyHelpAt(view.state, pos, side)
    if (!help) return null
    return {
      pos: help.from,
      end: help.to,
      create: () => {
        const dom = document.createElement('div')
        dom.className = 'cm-key-help'
        dom.textContent = help.doc
        return { dom }
      },
    }
  }),
  EditorView.baseTheme({
    '.cm-key-help': { padding: '3px 8px', maxWidth: '40em' },
  }),
]
