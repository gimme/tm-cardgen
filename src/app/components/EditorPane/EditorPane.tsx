import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { makeEditorState } from '../../editor/cmSetup.ts'
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
  const textEpoch = useStore((s) => s.textEpoch)
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
    return () => view.destroy()
  }, [currentId, textEpoch])

  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  return (
    <section className="editor-pane">
      <div className="editor-body">
        <div ref={hostRef} className="editor-host" />
        {hint && <SheetHint />}
      </div>
      {sheetOpen && <SyntaxSheet />}
      <footer className="editor-status">
        <button
          type="button"
          className={sheetOpen ? 'active' : ''}
          onClick={toggleSheet}
          title="The row syntax, and every icon by name"
        >
          Syntax &amp; icons
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

/** A first-run nudge towards the cheat sheet, floating over the editor's
 *  corner with a hand-drawn arrow at the button; gone once it is opened. */
function SheetHint() {
  return (
    <div className="sheet-hint" aria-hidden="true">
      <svg viewBox="0 0 40 56" width="40" height="56">
        <path
          d="M37 4 C20 2 28 20 16 28 C6 35 7 43 9 51 M2 44 C4 48 7 50 9 51 C11 49 14 45 15 42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>how a row is written, and every icon by name</span>
    </div>
  )
}
