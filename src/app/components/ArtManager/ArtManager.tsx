import { useRef, useState, type DragEvent } from 'react'
import { getServices } from '../../store/services.ts'
import { useStore } from '../../store/useStore.ts'
import { artUsers, imageEntries, missingArt } from './artRefs.ts'

const BIG_FILE_BYTES = 5 * 1024 * 1024

const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes('Files')

export function ArtManager() {
  const cards = useStore((s) => s.cards)
  // subscribing re-renders this panel whenever art changes
  useStore((s) => s.artVersion)
  const importArt = useStore((s) => s.importArt)
  const deleteArt = useStore((s) => s.deleteArt)
  const renameArt = useStore((s) => s.renameArt)
  const close = () => useStore.getState().setArtManagerOpen(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const { art } = getServices()
  const files = art.files()
  const users = artUsers(cards)
  const missing = missingArt(users, files)

  const importFileList = (list: FileList) =>
    void importArt(imageEntries(list), (names) =>
      confirm(
        names.length === 1
          ? `${names[0]} already exists. Replace it with the new image?`
          : `${names.join(', ')} already exist. Replace them with the new images?`,
      ),
    )

  /** "used by 2 cards", naming them on hover */
  const usedBy = (name: string) => {
    const names = users.get(name) ?? []
    return {
      text: `used by ${names.length} card${names.length === 1 ? '' : 's'}`,
      title: names.length > 0 ? names.join('\n') : undefined,
    }
  }

  return (
    <div className="slideover-backdrop" onClick={close}>
      <aside
        className={`art-manager ${dragOver ? 'drag-over' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={(e) => {
          if (isFileDrag(e)) setDragOver(true)
        }}
        onDragOver={(e) => {
          if (!isFileDrag(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(e) => {
          // relatedTarget is unreliable for drag events, so go by the pointer
          const { left, top, right, bottom } = e.currentTarget.getBoundingClientRect()
          const inside =
            e.clientX >= left && e.clientX < right && e.clientY >= top && e.clientY < bottom
          if (!inside) setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          importFileList(e.dataTransfer.files)
        }}
      >
        <header>
          <h2>Art</h2>
          <span className="top-spacer" />
          <button type="button" onClick={close}>
            ✕
          </button>
        </header>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) importFileList(e.target.files)
            e.target.value = ''
          }}
        />
        <button type="button" className="art-add" onClick={() => fileInput.current?.click()}>
          Add images…
          <span className="art-hint">or drop them here</span>
        </button>

        {missing.length > 0 && (
          <section className="art-missing">
            <h3>Referenced but missing</h3>
            {missing.map((name) => {
              const { text, title } = usedBy(name)
              return (
                <div key={name} className="art-missing-row" title={title}>
                  <span className="art-name">{name}</span>
                  <span className="art-hint">{text}</span>
                </div>
              )
            })}
          </section>
        )}

        <ul className="art-grid">
          {files.map((name) => {
            const entry = art.entry(name)
            const { text, title } = usedBy(name)
            const used = users.get(name)?.length ?? 0
            return (
              <li key={name}>
                <img src={entry?.url} alt={name} />
                <div className="art-meta">
                  <span className="art-name" title={name}>
                    {name}
                  </span>
                  <span className="art-hint" title={title}>
                    {entry ? `${entry.w}×${entry.h} · ${formatBytes(entry.bytes)} · ` : ''}
                    {text}
                    {entry && entry.bytes > BIG_FILE_BYTES ? ' · ⚠ large file' : ''}
                  </span>
                </div>
                <div className="art-actions">
                  <button
                    type="button"
                    onClick={() => {
                      const to = prompt(`Rename ${name} to:`, name)?.trim()
                      if (!to || to === name) return
                      if (files.includes(to)) alert(`${to} already exists.`)
                      else void renameArt(name, to)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete ${name}?${used > 0 ? ` Used by ${used} card(s).` : ''}`))
                        void deleteArt(name)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {files.length === 0 && <p className="art-hint art-empty">No art yet — drop some images.</p>}
      </aside>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n > 1024) return `${Math.round(n / 1024)} kB`
  return `${n} B`
}
