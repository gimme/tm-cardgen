import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { EditorView, hoverTooltip } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { explainAt, RICH_TEXT_FIELDS, type Explanation } from '../../core/index.ts'
import { iconSvg } from './iconMarkup.ts'

/** The explanation for the pointer at `pos`, when it is on rich text:
 *  a body or active row, the requirement or the VP disc, written plain,
 *  quoted or as a block. `from` and `to` are document offsets. `side`
 *  says which neighbour the pointer is on when `pos` is a boundary, as
 *  hoverTooltip reports it. */
export function richTextHelpAt(
  state: EditorState,
  pos: number,
  side: -1 | 1,
): Explanation | undefined {
  // the character under the pointer
  const at = side < 0 ? pos - 1 : pos
  if (at < 0) return undefined
  const node = syntaxTree(state).resolveInner(at, 1)
  // a block scalar's lines are a node of their own under its header
  const block = node.name === 'BlockLiteralContent'
  const scalar = block ? node.parent : node
  if (!scalar || !(block || scalar.name === 'Literal' || scalar.name === 'QuotedLiteral'))
    return undefined
  const field = richTextFieldOf(state, scalar)
  if (field === undefined) return undefined
  // the text as written: a quoted scalar's text between its quotes, a
  // block's lines with their indentation, which is whitespace to the explainer
  const quoted = scalar.name === 'QuotedLiteral'
  const from = block ? node.from : scalar.from + (quoted ? 1 : 0)
  const to = block ? node.to : scalar.to - (quoted ? 1 : 0)
  if (at < from || at >= to) return undefined
  const help = explainAt(state.sliceDoc(from, to), at - from, RICH_TEXT_FIELDS[field])
  return help && { ...help, from: help.from + from, to: help.to + from }
}

type RichTextField = keyof typeof RICH_TEXT_FIELDS

/** The rich text field the scalar is the value of: directly, or as an item
 *  of its list. Only at the top level. */
function richTextFieldOf(state: EditorState, scalar: SyntaxNode): RichTextField | undefined {
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
  return listed && Object.hasOwn(RICH_TEXT_FIELDS, name) ? (name as RichTextField) : undefined
}

function helpDom(help: Explanation): HTMLElement {
  const dom = document.createElement('div')
  if (help.icon) {
    dom.className = 'cm-richtext-icon'
    dom.append(iconSvg(help.icon.name, 'richtext-help-', help.icon.inscription))
  } else {
    dom.className = 'cm-richtext-help'
    dom.textContent = help.doc ?? ''
  }
  return dom
}

/** Hovering an icon's name in rich text shows the icon; `red`, `*` and a
 *  spacer say what they do. */
export const richTextHelp = [
  hoverTooltip((view, pos, side) => {
    const help = richTextHelpAt(view.state, pos, side)
    if (!help) return null
    return { pos: help.from, end: help.to, create: () => ({ dom: helpDom(help) }) }
  }),
  EditorView.baseTheme({
    '.cm-richtext-icon': { padding: '4px' },
    '.cm-richtext-icon svg': { display: 'block' },
    '.cm-richtext-help': { padding: '3px 8px', maxWidth: '40em' },
  }),
]
