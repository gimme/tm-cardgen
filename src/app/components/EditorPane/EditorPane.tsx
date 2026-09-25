import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { makeEditorState } from '../../editor/cmSetup.ts'
import { useStore } from '../../store/useStore.ts'

export function EditorPane() {
  const currentId = useStore((s) => s.currentId)
  const textEpoch = useStore((s) => s.textEpoch)
  const diagnostics = useStore((s) => s.diagnostics)
  const saveState = useStore((s) => s.saveState)
  const stale = useStore((s) => s.stale)
  const hostRef = useRef<HTMLDivElement>(null)

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
      <footer className="editor-status">
        <span className={saveState === 'error' ? 'status-error' : ''}>
          {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save failed'}
        </span>
        <span className="status-spacer" />
        {stale && <span className="status-stale">preview stale</span>}
        <span className={errors > 0 ? 'status-error' : ''}>
          {errors} error{errors === 1 ? '' : 's'}
        </span>
        <span className={warnings > 0 ? 'status-warn' : ''}>
          {warnings} warning{warnings === 1 ? '' : 's'}
        </span>
      </footer>
    </section>
  )
}
