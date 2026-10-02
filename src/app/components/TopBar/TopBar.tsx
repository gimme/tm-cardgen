import { linkTo } from '../../router.ts'
import { useStore } from '../../store/useStore.ts'
import { MenuButton, type Action } from '../Menu/Menu.tsx'

const REPO = 'https://github.com/gimme/tm-cardgen'

export function TopBar() {
  const setArtManagerOpen = useStore((s) => s.setArtManagerOpen)
  const setExportDialogOpen = useStore((s) => s.setExportDialogOpen)
  const dirty = useStore((s) => s.dirtySinceExport)
  const page = useStore((s) => s.page)

  // the row's, for the ⋮ menu that takes its place where it doesn't fit
  const actions: Action[] = [
    { label: 'Export / Import', act: () => setExportDialogOpen(true) },
    { label: 'Art', act: () => setArtManagerOpen(true) },
    { label: 'GitHub', act: () => window.open(REPO, '_blank', 'noreferrer') },
  ]

  return (
    <header className="top-bar">
      <div className="top-bar-start">
        <h1>
          <a {...linkTo({ page: 'editor' })}>tm-cardgen</a>
        </h1>
        <span className="top-subtitle">Terraforming Mars custom card generator</span>
      </div>
      {/* both pages always, in one place, so the way back is where the way there was */}
      <nav className="top-nav">
        <a {...linkTo({ page: 'editor' })} aria-current={page === 'editor' ? 'page' : undefined}>
          Editor
        </a>
        <a {...linkTo({ page: 'gallery' })} aria-current={page === 'gallery' ? 'page' : undefined}>
          Gallery
        </a>
      </nav>
      <div className="top-bar-end">
        <div className="top-actions">
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
          <a className="top-github" href={REPO} target="_blank" rel="noreferrer" title="GitHub">
            {/* GitHub's mark, the mark-github octicon (MIT) */}
            <svg viewBox="0 0 16 16" width="16" height="16" aria-label="GitHub" role="img">
              <path
                fill="currentColor"
                d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
              />
            </svg>
          </a>
        </div>
        <MenuButton items={actions} label="More" className="top-menu" />
      </div>
    </header>
  )
}
