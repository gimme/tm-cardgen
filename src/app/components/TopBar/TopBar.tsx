import { useStore } from '../../store/useStore.ts'

export function TopBar() {
  const setArtManagerOpen = useStore((s) => s.setArtManagerOpen)
  const setExportDialogOpen = useStore((s) => s.setExportDialogOpen)
  const restoreSamples = useStore((s) => s.restoreSamples)
  const dirty = useStore((s) => s.dirtySinceExport)

  return (
    <header className="top-bar">
      <h1>tm-cardgen</h1>
      <span className="top-subtitle">Terraforming Mars custom card generator</span>
      <span className="top-spacer" />
      <button
        type="button"
        onClick={() => setExportDialogOpen(true)}
        title={dirty ? 'Changes since your last zip export — consider backing up' : undefined}
      >
        Export / Import{dirty && <span className="dirty-dot" />}
      </button>
      <button type="button" onClick={() => setArtManagerOpen(true)}>
        Art
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm('Re-insert the bundled sample cards? Your own cards are not touched.'))
            void restoreSamples()
        }}
      >
        Restore samples
      </button>
      <a href="https://github.com/gimme/tm-cardgen" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </header>
  )
}
