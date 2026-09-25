import { ensureSyntaxTree, getIndentUnit, indentString } from '@codemirror/language'
import {
  type ChangeSpec,
  type EditorState,
  EditorSelection,
  type StateCommand,
} from '@codemirror/state'

type Target = Parameters<StateCommand>[0]

/** `changes` as one input step, the cursor at `cursor` after it */
function apply({ state, dispatch }: Target, changes: ChangeSpec, cursor: number): true {
  dispatch(
    state.update({
      changes,
      selection: EditorSelection.cursor(cursor),
      scrollIntoView: true,
      userEvent: 'input',
    }),
  )
  return true
}

/** `to` backed up over the whitespace before it, no further than `from` */
const trimmed = (state: EditorState, from: number, to: number) =>
  to - /\s*$/.exec(state.sliceDoc(from, to))![0].length

/** Enter after a bare rows key (`body:` or `active:` with nothing past the
 *  colon but a comment) opens its first row, quoted, ahead of any rows it
 *  already has below. */
export const openRows: StateCommand = (target) => {
  const { state } = target
  const { main, ranges } = state.selection
  if (ranges.length > 1 || !main.empty) return false
  const line = state.doc.lineAt(main.head)
  const key = /^(?:body|active):(?=\s|$)/.exec(line.text)
  if (!key || main.head < line.from + key[0].length) return false

  // the parser says what the key holds. Its rows begin on a later line, so
  // the parse has to reach the end; a value that is not a list is left alone
  const tree = ensureSyntaxTree(state, state.doc.length, 50)
  let pair = tree?.resolveInner(line.from, 1) ?? null
  while (pair && pair.name !== 'Pair') pair = pair.parent
  if (!pair || pair.from !== line.from) return false
  const value = pair.lastChild
  let indent: string
  if (value?.name === ':') indent = indentString(state, getIndentUnit(state))
  else if (value?.name === 'BlockSequence')
    indent = state.sliceDoc(state.doc.lineAt(value.from).from, value.from)
  else return false

  const cut = trimmed(state, line.from, line.to)
  const row = `${state.lineBreak}${indent}- ""`
  return apply(target, { from: cut, to: line.to, insert: row }, cut + row.length - 1)
}

/** Enter on a block list item splits it at the cursor into two items, a
 *  quoted one staying quoted on both sides; on an item with nothing in it,
 *  it ends the list instead, clearing the line. */
export const continueList: StateCommand = (target) => {
  const { state } = target
  const { main, ranges } = state.selection
  if (ranges.length > 1 || !main.empty) return false
  const line = state.doc.lineAt(main.head)
  const item = /^(\s*)-(?:\s+|$)/.exec(line.text)
  // in the indent before the dash, Enter opens a line above as usual
  if (!item || main.head < line.from + item[0].length) return false
  const [, indent] = item
  const valueFrom = line.from + item[0].length
  const clear = () => apply(target, { from: line.from, to: line.to }, line.from)
  const nextItem = `${state.lineBreak}${indent}- `

  if (!/\S/.test(line.text.slice(item[0].length))) return clear()

  // the parser says what the item holds. One that runs past this line (a
  // block scalar, a string or flow collection continued below) is left alone
  const tree = ensureSyntaxTree(state, line.to, 50)
  const node = tree?.resolveInner(valueFrom, 1)
  let owner = node ?? null
  while (owner && owner.name !== 'Item') owner = owner.parent
  if (!node || !owner || owner.from < line.from || owner.to > line.to) return false

  const scalar = node.parent?.name === 'Item' && /^(Quoted)?Literal$/.test(node.name)
  if (!scalar) {
    // a map or a flow collection has no text to split: Enter at its end
    // starts the next item, anywhere else it is the usual newline
    if (/\S/.test(state.sliceDoc(main.head, line.to))) return false
    const cut = trimmed(state, valueFrom, main.head)
    return apply(target, { from: cut, to: line.to, insert: nextItem }, cut + nextItem.length)
  }

  const quote = node.name === 'QuotedLiteral' ? state.sliceDoc(node.from, node.from + 1) : ''
  const textFrom = node.from + quote.length
  const textTo = node.to - quote.length
  // a quote left open at the end of the document parses as closed by its last character
  if (textTo < textFrom || state.sliceDoc(textTo, node.to) !== quote) return false
  if (!/\S/.test(state.sliceDoc(textFrom, textTo))) return clear()

  // the cursor on either side of a quote counts as just inside it; whatever
  // follows the value on its line (a comment) stays with the head
  const head = Math.min(Math.max(main.head, textFrom), textTo)
  const cut = trimmed(state, textFrom, head)
  const tail = state.sliceDoc(head, textTo).trim()
  const trailer = state.sliceDoc(node.to, line.to).trimEnd()
  const lead = quote + trailer + nextItem + quote
  return apply(target, { from: cut, to: line.to, insert: lead + tail + quote }, cut + lead.length)
}
