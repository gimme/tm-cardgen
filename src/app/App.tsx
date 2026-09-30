import { useStore } from './store/useStore.ts'
import { TopBar } from './components/TopBar/TopBar.tsx'
import { CardList } from './components/CardList/CardList.tsx'
import { EditorPane } from './components/EditorPane/EditorPane.tsx'
import { PreviewPane } from './components/PreviewPane/PreviewPane.tsx'
import { Gallery } from './components/Gallery/Gallery.tsx'
import { ArtManager } from './components/ArtManager/ArtManager.tsx'
import { ExportDialog } from './components/ExportDialog/ExportDialog.tsx'
import { UndoToast } from './components/UndoToast/UndoToast.tsx'

export default function App() {
  const status = useStore((s) => s.status)
  const startupError = useStore((s) => s.startupError)
  const artManagerOpen = useStore((s) => s.artManagerOpen)
  const exportDialogOpen = useStore((s) => s.exportDialogOpen)
  const page = useStore((s) => s.page)
  const versionClash = useStore((s) => s.versionClash)

  // ahead of a failure to start, which reads on the closed store would cause
  if (versionClash === 'outdated') {
    return (
      <div className="app-loading">
        <p>
          A newer version of tm-cardgen is open in another tab.{' '}
          <button type="button" onClick={() => location.reload()}>
            Reload
          </button>{' '}
          to keep working here.
        </p>
      </div>
    )
  }
  if (startupError) return <div className="app-loading">Failed to start: {startupError}</div>
  if (versionClash === 'waiting') {
    return (
      <div className="app-loading">
        Waiting for other tabs of tm-cardgen to close: they run an older version.
      </div>
    )
  }
  if (status !== 'ready') return <div className="app-loading">Loading fonts &amp; assets…</div>

  return (
    <div className="app-shell">
      <TopBar />
      {/* hidden rather than unmounted on the gallery page, so the editor and
          preview keep their state */}
      <div className="app-panes" hidden={page !== 'editor'}>
        <CardList />
        <EditorPane />
        <PreviewPane />
      </div>
      {page === 'gallery' && <Gallery />}
      {artManagerOpen && <ArtManager />}
      {exportDialogOpen && <ExportDialog />}
      <UndoToast />
    </div>
  )
}
