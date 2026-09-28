// After a delete, a way back: the cards return to their places on Undo, until
// the toast times out or the next delete replaces it.
import { useEffect } from 'react'
import { useStore } from '../../store/useStore.ts'

const SHOWN_FOR = 8000

export function UndoToast() {
  const deleted = useStore((s) => s.deleted)
  const undoDelete = useStore((s) => s.undoDelete)
  const dismissDeleted = useStore((s) => s.dismissDeleted)

  useEffect(() => {
    if (!deleted) return
    const timer = setTimeout(dismissDeleted, SHOWN_FOR)
    return () => clearTimeout(timer)
  }, [deleted, dismissDeleted])

  if (!deleted) return null
  const what = deleted.length === 1 ? `"${deleted[0].name}"` : `${deleted.length} cards`
  return (
    <div className="toast" role="status">
      <span>Deleted {what}</span>
      <button type="button" className="toast-action" onClick={() => void undoDelete()}>
        Undo
      </button>
      <button type="button" aria-label="Dismiss" onClick={dismissDeleted}>
        ✕
      </button>
    </div>
  )
}
