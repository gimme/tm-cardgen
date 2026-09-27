// The completion list comes up by itself where nothing is written yet, so
// that a writer who does not know what to type sees what there is.
import {
  closeCompletion,
  completionStatus,
  selectedCompletionIndex,
  startCompletion,
} from '@codemirror/autocomplete'
import { type EditorState, Prec, StateField } from '@codemirror/state'
import { type Command, EditorView, keymap } from '@codemirror/view'

/** Whether the cursor sits at the end of a line with nothing written on it
 *  yet: an empty line, an indent, or a bare list item. That is where a key
 *  goes, or a tag under tags:, and the completions can say which. */
export function atBlankLine(state: EditorState): boolean {
  const { main, ranges } = state.selection
  if (ranges.length > 1 || !main.empty) return false
  const line = state.doc.lineAt(main.head)
  return main.head === line.to && /^\s*(-\s*)?$/.test(line.text)
}

/** Opens the completion list when an edit leaves the cursor on a blank
 *  line: Enter at the end of a field, mostly. Moving there does not count;
 *  an open list takes the arrow keys for itself, which would trip anyone
 *  stepping through the card. Typing there has opened it already. */
const openOnBlankLine = EditorView.updateListener.of((update) => {
  if (!update.docChanged || !atBlankLine(update.state)) return
  if (completionStatus(update.state) !== null) return
  startCompletion(update.view)
})

/** Whether the list's selection has been moved since it opened: the writer
 *  has taken hold of it. */
const listTaken = StateField.define<boolean>({
  create: () => false,
  update(taken, tr) {
    const selected = selectedCompletionIndex(tr.state)
    if (selected === null) return false
    const before = selectedCompletionIndex(tr.startState)
    return taken || (before !== null && before !== selected)
  },
})

/** Enter on a blank line makes a new line, list or no list: the list came up
 *  there on its own, and taking Enter for it would turn a second Enter into a
 *  key. Once the selection has been moved, Enter picks as usual, as Tab does
 *  at any time. Closes the list and lets the key through. */
export const enterOnBlankLine: Command = (view) => {
  const { state } = view
  if (selectedCompletionIndex(state) !== null && atBlankLine(state) && !state.field(listTaken)) {
    closeCompletion(view)
  }
  return false
}

/** Goes ahead of basicSetup in the extensions, so that Enter reaches
 *  enterOnBlankLine before the completion keymap. */
export const blankLineCompletion = [
  openOnBlankLine,
  listTaken,
  Prec.highest(keymap.of([{ key: 'Enter', run: enterOnBlankLine }])),
]
