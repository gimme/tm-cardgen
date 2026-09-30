import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { makeEditorState, replaceText } from '../../editor/cmSetup.ts'
import { useStore } from '../../store/useStore.ts'
import { SyntaxSheet } from './SyntaxSheet.tsx'

/** set once the cheat sheet has been opened; the first-run hint goes then */
const SHEET_SEEN_KEY = 'tm-cardgen.sheetSeen'

function sheetSeen(): boolean {
  try {
    return localStorage.getItem(SHEET_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

function rememberSheetSeen() {
  try {
    localStorage.setItem(SHEET_SEEN_KEY, '1')
  } catch {
    // private mode: the hint shows again next time, no harm
  }
}

export function EditorPane() {
  const currentId = useStore((s) => s.currentId)
  const diagnostics = useStore((s) => s.diagnostics)
  const saveState = useStore((s) => s.saveState)
  const hostRef = useRef<HTMLDivElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hint, setHint] = useState(() => !sheetSeen())

  const toggleSheet = () => {
    setSheetOpen((open) => !open)
    if (hint) {
      rememberSheetSeen()
      setHint(false)
    }
  }

  useEffect(() => {
    if (!hostRef.current || currentId === undefined) return
    const view = new EditorView({
      state: makeEditorState(useStore.getState().text, (text) =>
        useStore.getState().updateText(text),
      ),
      parent: hostRef.current,
    })
    // the card's text changed from outside the editor, by another tab or an
    // art file's new name, goes into it as an edit
    const unfollow = useStore.subscribe((s, prev) => {
      if (s.currentId === currentId && s.text !== prev.text) replaceText(view, s.text)
    })
    return () => {
      unfollow()
      view.destroy()
    }
  }, [currentId])

  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  return (
    <section className="editor-pane">
      <div className="editor-body">
        <div ref={hostRef} className="editor-host" />
      </div>
      {sheetOpen && <SyntaxSheet />}
      <footer className="editor-status">
        <button type="button" className={sheetOpen ? 'active' : ''} onClick={toggleSheet}>
          Syntax &amp; icons
          {hint && <SheetHint />}
        </button>
        <span className="status-spacer" />
        {errors > 0 && (
          <span className="status-error">
            {errors} error{errors === 1 ? '' : 's'}
          </span>
        )}
        {warnings > 0 && (
          <span className="status-warn">
            {warnings} warning{warnings === 1 ? '' : 's'}
          </span>
        )}
        <SaveState state={saveState} />
      </footer>
    </section>
  )
}

/** A small check that dims while a save is pending and settles once it has
 *  landed: the same glyph in the same slot, so the counts beside it never
 *  move while typing. Only a failure is spelt out. */
function SaveState({ state }: { state: 'saved' | 'saving' | 'error' }) {
  if (state === 'error') return <span className="status-save status-error">Save failed</span>
  const saving = state === 'saving'
  return (
    <span
      className={saving ? 'status-save status-saving' : 'status-save'}
      role="img"
      aria-label={saving ? 'Saving' : 'Saved'}
      title={saving ? 'Saving…' : 'Saved — in this browser only. Export a zip to keep a copy.'}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path
          d="M2.5 6.5 L5 9 L9.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** A first-run nudge towards the cheat sheet: a handwritten note over the
 *  editor's corner, with an arrow from under it down to the button. It lives
 *  inside the button so the arrow lands on the button's center whatever the
 *  system font makes of the label; gone once the sheet is opened. */
function SheetHint() {
  return (
    <span className="sheet-hint" aria-hidden="true">
      <span className="sheet-hint-text">
        see how card text is written
        <br />
        and what icons you can use
      </span>
      {/* the tail starts under the note's center at x=98 and the head ends at x=20 */}
      <svg viewBox="0 0 125 80" width="125" height="80">
        <path
          d="M98 10 C80 5 88 28 69 40 C48 54 28 55 20 68 M18 55 C19.5 60 19.5 64 20 68 C23 66 27.5 64 32 63"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
