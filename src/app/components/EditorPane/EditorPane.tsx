import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { makeEditorState } from '../../editor/cmSetup.ts'
import { useStore } from '../../store/useStore.ts'
import { SyntaxSheet } from './SyntaxSheet.tsx'

export function EditorPane() {
  const currentId = useStore((s) => s.currentId)
  const textEpoch = useStore((s) => s.textEpoch)
  const diagnostics = useStore((s) => s.diagnostics)
  const saveState = useStore((s) => s.saveState)
  const stale = useStore((s) => s.stale)
  const hostRef = useRef<HTMLDivElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

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
      <div ref={hostRef} className="editor-host" />
      {sheetOpen && <SyntaxSheet />}
      <footer className="editor-status">
        <button
          type="button"
          className={sheetOpen ? 'active' : ''}
          onClick={() => setSheetOpen((open) => !open)}
          title="The row syntax, and every icon by name"
        >
          Syntax
        </button>
        <span className="status-spacer" />
        {stale && <span className="status-stale">preview stale</span>}
        <span className={errors > 0 ? 'status-error' : ''}>
          {errors} error{errors === 1 ? '' : 's'}
        </span>
        <span className={warnings > 0 ? 'status-warn' : ''}>
          {warnings} warning{warnings === 1 ? '' : 's'}
        </span>
        <SaveState state={saveState} />
      </footer>
    </section>
  )
}

/** Like Google Docs: at rest a small check, the state spelt out only while
 *  it is worth reading. */
function SaveState({ state }: { state: 'saved' | 'saving' | 'error' }) {
  if (state === 'saving') return <span className="status-save">Saving…</span>
  if (state === 'error') return <span className="status-save status-error">Save failed</span>
  return (
    <span
      className="status-save status-saved"
      role="img"
      aria-label="Saved"
      title="Saved — in this browser only. Export a zip to keep a copy."
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
