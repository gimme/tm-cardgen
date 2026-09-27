// The completion list comes up by itself where nothing is written yet, so
// that a writer who does not know what to type sees what there is.
import { completionStatus, startCompletion } from '@codemirror/autocomplete'
import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

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
 *  an open list takes Enter and the arrow keys for itself, which would trip
 *  anyone stepping through the card. Typing there has opened it already. */
export const blankLineCompletion = EditorView.updateListener.of((update) => {
  if (!update.docChanged || !atBlankLine(update.state)) return
  if (completionStatus(update.state) !== null) return
  startCompletion(update.view)
})
