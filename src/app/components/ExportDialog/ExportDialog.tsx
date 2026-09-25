import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore.ts'
import { downloadBlob } from '../../export/exportCommon.ts'
import {
  exportCardPng,
  exportCardsPngZip,
  pngFileName,
  type ExportDpi,
} from '../../export/exportPng.ts'
import { exportPdfSheet, type PageSize, type Spacing } from '../../export/exportPdf.ts'
import { exportProjectZip } from '../../export/exportZip.ts'
import {
  applyImport,
  previewImport,
  type ImportMode,
  type ImportPreview,
} from '../../export/importZip.ts'

type Format = 'zip' | 'png' | 'pdf'

export function ExportDialog() {
  const cards = useStore((s) => s.cards)
  const close = () => useStore.getState().setExportDialogOpen(false)

  const [format, setFormat] = useState<Format>('zip')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cards.map((c) => c.id)))
  const [dpi, setDpi] = useState<ExportDpi>(300)
  const [page, setPage] = useState<PageSize>('a4')
  const [spacing, setSpacing] = useState<Spacing>('gap')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [error, setError] = useState<string>()
  const [importPreview, setImportPreview] = useState<ImportPreview>()
  const importInput = useRef<HTMLInputElement>(null)

  const chosen = cards.filter((c) => selected.has(c.id))

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const run = async () => {
    setError(undefined)
    setBusy(true)
    // a bar is only worth showing for a job that counts several cards
    const onProgress = (done: number) => {
      if (chosen.length > 1) setProgress({ done, total: chosen.length })
    }
    try {
      if (format === 'zip') {
        downloadBlob(await exportProjectZip(cards), 'tm-cardgen-project.zip')
        await useStore.getState().markExported()
      } else if (format === 'png') {
        if (chosen.length === 1) {
          const [card] = chosen
          downloadBlob(await exportCardPng(card.yamlText, card.name, dpi), pngFileName(card.name))
        } else {
          onProgress(0)
          downloadBlob(await exportCardsPngZip(chosen, dpi, onProgress), 'cards-png.zip')
        }
      } else {
        onProgress(0)
        const blob = await exportPdfSheet(chosen, { dpi, page, spacing, onProgress })
        downloadBlob(blob, `print-sheet-${page}.pdf`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setProgress(undefined)
    }
  }

  const pickImport = async (file: File) => {
    setError(undefined)
    try {
      setImportPreview(await previewImport(file))
    } catch (err) {
      setError(`could not read zip: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const doImport = async (mode: ImportMode) => {
    if (!importPreview) return
    setBusy(true)
    try {
      await applyImport(importPreview, mode)
      await useStore.getState().reloadFromStore()
      setImportPreview(undefined)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="slideover-backdrop" onClick={close}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Export / Import</h2>
          <span className="top-spacer" />
          <button type="button" onClick={close}>
            ✕
          </button>
        </header>

        {importPreview ? (
          <div className="import-preview">
            <p>
              <strong>
                {importPreview.cards.length} cards, {importPreview.art.length} art files
              </strong>
            </p>
            {importPreview.problems.map((p) => (
              <p key={p} className="status-warn">
                ⚠ {p}
              </p>
            ))}
            {importPreview.cards.some((c) => !c.valid) && (
              <p className="status-warn">
                ⚠ some cards have validation errors (they import anyway):{' '}
                {importPreview.cards
                  .filter((c) => !c.valid)
                  .map((c) => `${c.slug} (${c.error ?? 'invalid'})`)
                  .join(', ')}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" disabled={busy} onClick={() => void doImport('merge')}>
                Merge into project
              </button>
              <button
                type="button"
                disabled={busy}
                className="danger"
                onClick={() => {
                  if (confirm('Replace deletes ALL current cards and art. Continue?'))
                    void doImport('replace')
                }}
              >
                Replace project
              </button>
              <button type="button" onClick={() => setImportPreview(undefined)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="export-row">
              <span className="export-label">Format</span>
              {(['zip', 'png', 'pdf'] as const).map((f) => (
                <label key={f}>
                  <input
                    type="radio"
                    name="format"
                    checked={format === f}
                    onChange={() => setFormat(f)}
                  />
                  {f === 'zip' ? 'Project zip' : f === 'png' ? 'PNG' : 'PDF print sheet'}
                </label>
              ))}
            </div>

            {format !== 'zip' && (
              <>
                <div className="export-row">
                  <span className="export-label">DPI</span>
                  <label>
                    <input
                      type="radio"
                      name="dpi"
                      checked={dpi === 300}
                      onChange={() => setDpi(300)}
                    />
                    Standard (300)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="dpi"
                      checked={dpi === 600}
                      onChange={() => setDpi(600)}
                    />
                    Ultra (600)
                  </label>
                </div>
                {format === 'pdf' && (
                  <>
                    <div className="export-row">
                      <span className="export-label">Page</span>
                      <label>
                        <input
                          type="radio"
                          name="page"
                          checked={page === 'a4'}
                          onChange={() => setPage('a4')}
                        />
                        A4
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="page"
                          checked={page === 'letter'}
                          onChange={() => setPage('letter')}
                        />
                        Letter
                      </label>
                    </div>
                    <div className="export-row">
                      <span className="export-label">Spacing</span>
                      <label>
                        <input
                          type="radio"
                          name="spacing"
                          checked={spacing === 'gap'}
                          onChange={() => setSpacing('gap')}
                        />
                        2mm gap
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="spacing"
                          checked={spacing === 'flush'}
                          onChange={() => setSpacing('flush')}
                        />
                        Flush (shared cuts)
                      </label>
                    </div>
                  </>
                )}
                <div className="export-cards">
                  <div className="export-row">
                    <span className="export-label">Cards ({chosen.length})</span>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(cards.map((c) => c.id)))}
                    >
                      All
                    </button>
                    <button type="button" onClick={() => setSelected(new Set())}>
                      None
                    </button>
                  </div>
                  <ul>
                    {cards.map((card) => (
                      <li key={card.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selected.has(card.id)}
                            onChange={() => toggle(card.id)}
                          />
                          {card.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            {format === 'zip' && (
              <p className="art-hint">
                A backup of the whole project: one YAML file per card, plus all art. Import it here
                to get the cards back.
              </p>
            )}

            {error && <p className="status-error">{error}</p>}
            {progress && (
              <div className="export-progress">
                <div
                  className="export-progress-fill"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
                <span>
                  {progress.done}/{progress.total}
                </span>
              </div>
            )}

            <div className="dialog-actions">
              <button
                type="button"
                disabled={busy || (format !== 'zip' && chosen.length === 0)}
                onClick={() => void run()}
              >
                Export
              </button>
              <span className="top-spacer" />
              <button type="button" disabled={busy} onClick={() => importInput.current?.click()}>
                Import zip…
              </button>
              <input
                ref={importInput}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void pickImport(file)
                  e.target.value = ''
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
