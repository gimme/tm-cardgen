import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { EditorView, hoverTooltip } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { explainAt, ROW_FIELDS, type Explanation } from '../../core/index.ts'
import { iconSvg } from './iconMarkup.ts'

/** The explanation for the pointer at `pos`, when it is on a row string:
 *  a body or active row, the requirement or the VP disc. `from` and `to`
 *  are document offsets. `side` says which neighbour the pointer is on
 *  when `pos` is a boundary, as hoverTooltip reports it. */
export function rowHelpAt(state: EditorState, pos: number, side: -1 | 1): Explanation | undefined {
  // the character under the pointer
  const at = side < 0 ? pos - 1 : pos
  if (at < 0) return undefined
  const node = syntaxTree(state).resolveInner(at, 1)
  if (node.name !== 'Literal' && node.name !== 'QuotedLiteral') return undefined
  const field = rowFieldOf(state, node)
  if (field === undefined) return undefined
  // the row as written: a quoted scalar's text between its quotes
  const quoted = node.name === 'QuotedLiteral'
  const from = node.from + (quoted ? 1 : 0)
  const to = node.to - (quoted ? 1 : 0)
  if (at < from || at >= to) return undefined
  const help = explainAt(state.sliceDoc(from, to), at - from, ROW_FIELDS[field])
  return help && { ...help, from: help.from + from, to: help.to + from }
}

type RowField = keyof typeof ROW_FIELDS

/** The row field the scalar is the value of: directly, or as an item of
 *  its list. Only at the top level. */
function rowFieldOf(state: EditorState, scalar: SyntaxNode): RowField | undefined {
  let holder = scalar.parent
  if (holder?.name === 'Item') {
    const seq = holder.parent
    if (seq?.name !== 'BlockSequence' && seq?.name !== 'FlowSequence') return undefined
    holder = seq.parent
  }
  if (holder?.name !== 'Pair' || holder.parent?.parent?.name !== 'Document') return undefined
  const key = holder.getChild('Key')
  const name = key ? state.sliceDoc(key.from, key.to).replace(/^(['"])(.*)\1$/, '$2') : ''
  const listed = holder.parent?.name === 'BlockMapping' || holder.parent?.name === 'FlowMapping'
  return listed && Object.hasOwn(ROW_FIELDS, name) ? (name as RowField) : undefined
}

function helpDom(help: Explanation): HTMLElement {
  const dom = document.createElement('div')
  dom.className = 'cm-row-help'
  if (help.icon) dom.append(iconSvg(help.icon.name, 'row-help-', help.icon.inscription))
  const text = document.createElement('span')
  help.doc.split('`').forEach((part, i) => {
    if (i % 2 === 0) {
      text.append(part)
      return
    }
    const code = document.createElement('code')
    code.textContent = part
    text.append(code)
  })
  dom.append(text)
  return dom
}

/** Hovering a row's syntax explains it in the cheat sheet's words; an icon
 *  name shows the icon. */
export const rowHelp = [
  hoverTooltip((view, pos, side) => {
    const help = rowHelpAt(view.state, pos, side)
    if (!help) return null
    return { pos: help.from, end: help.to, create: () => ({ dom: helpDom(help) }) }
  }),
  EditorView.baseTheme({
    '.cm-row-help': {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      maxWidth: '40em',
    },
    '.cm-row-help svg': { display: 'block', flexShrink: '0' },
    '.cm-row-help code': { fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" },
  }),
]
