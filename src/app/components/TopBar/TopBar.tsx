import { linkTo } from '../../router.ts'
import { useStore } from '../../store/useStore.ts'

export function TopBar() {
  const setArtManagerOpen = useStore((s) => s.setArtManagerOpen)
  const setExportDialogOpen = useStore((s) => s.setExportDialogOpen)
  const restoreSamples = useStore((s) => s.restoreSamples)
  const dirty = useStore((s) => s.dirtySinceExport)
  const page = useStore((s) => s.page)

  return (
    <header className="top-bar">
      <h1>
        <a {...linkTo({ page: 'editor' })}>tm-cardgen</a>
      </h1>
      <span className="top-subtitle">Terraforming Mars custom card generator</span>
      <span className="top-spacer" />
      {/* both pages always, in one place, so the way back is where the way there was */}
      <nav className="top-nav">
        <a {...linkTo({ page: 'editor' })} aria-current={page === 'editor' ? 'page' : undefined}>
          Editor
        </a>
        <a {...linkTo({ page: 'gallery' })} aria-current={page === 'gallery' ? 'page' : undefined}>
          Gallery
        </a>
      </nav>
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
