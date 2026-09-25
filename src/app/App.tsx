import { useStore } from './store/useStore.ts'
import { TopBar } from './components/TopBar/TopBar.tsx'
import { CardList } from './components/CardList/CardList.tsx'
import { EditorPane } from './components/EditorPane/EditorPane.tsx'
import { PreviewPane } from './components/PreviewPane/PreviewPane.tsx'
import { ArtManager } from './components/ArtManager/ArtManager.tsx'
import { ExportDialog } from './components/ExportDialog/ExportDialog.tsx'

export default function App() {
  const status = useStore((s) => s.status)
  const startupError = useStore((s) => s.startupError)
  const artManagerOpen = useStore((s) => s.artManagerOpen)
  const exportDialogOpen = useStore((s) => s.exportDialogOpen)

  if (startupError) return <div className="app-loading">Failed to start: {startupError}</div>
  if (status !== 'ready') return <div className="app-loading">Loading fonts &amp; assets…</div>

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-panes">
        <CardList />
        <EditorPane />
        <PreviewPane />
      </div>
      {artManagerOpen && <ArtManager />}
      {exportDialogOpen && <ExportDialog />}
    </div>
  )
}
