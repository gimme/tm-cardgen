import { useEffect, useMemo, useState } from 'react'
import { CARD_W, mmToPx } from '../../../core/index.ts'
import { useStore } from '../../store/useStore.ts'
import { getServices } from '../../store/services.ts'
import { makePreviewResolver } from '../../services/assetService.ts'
import { downloadBlob } from '../../export/exportCommon.ts'
import { exportCardPng, pngFileName } from '../../export/exportPng.ts'
import { CardSvg } from './CardSvg.tsx'

type Zoom = 'fit' | '100' | '200'
type Layer = 'card' | 'reference'

// 63mm at 96dpi ≈ 238px; "100%" shows the card at a comfortable 2x
const MM_TO_PX = mmToPx(1, 96)

// Reference renders in the project-root reference/ folder (gitignored), for
// side-by-side comparison. The dev server serves them (vite.config.ts), so
// the picker is dev-only.
const canCompare = import.meta.env.DEV
const referenceUrl = (file: string) => `${import.meta.env.BASE_URL}reference/${file}`

const other = (layer: Layer): Layer => (layer === 'card' ? 'reference' : 'card')

export function PreviewPane() {
  const layout = useStore((s) => s.layout)
  const stale = useStore((s) => s.stale)
  const [zoom, setZoom] = useState<Zoom>('fit')
  const [references, setReferences] = useState<string[]>([])
  const [refFile, setRefFile] = useState('')
  const [active, setActive] = useState<Layer>('card')
  const [held, setHeld] = useState(false)
  const calibrate = useMemo(() => new URLSearchParams(window.location.search).has('calibrate'), [])
  const resolveAsset = useMemo(() => {
    const { art } = getServices()
    return makePreviewResolver((file) => art.url(file))
  }, [])

  useEffect(() => {
    if (!canCompare) return
    let live = true
    void fetch(referenceUrl('index.json'))
      .then((res) => (res.ok ? (res.json() as Promise<string[]>) : []))
      .then((files) => live && setReferences(files))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // holding F shows the layer not selected, for flicker comparison
  useEffect(() => {
    if (!refFile) return
    const hold = (e: KeyboardEvent, down: boolean) => {
      if (e.key.toLowerCase() !== 'f' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      // an f typed into the editor or a field is text
      if (e.target instanceof Element && e.target.closest('.cm-editor, input, textarea, select'))
        return
      setHeld(down)
    }
    const onDown = (e: KeyboardEvent) => hold(e, true)
    const onUp = (e: KeyboardEvent) => hold(e, false)
    const release = () => setHeld(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
      setHeld(false)
    }
  }, [refFile])

  const shown: Layer = refFile ? (held ? other(active) : active) : 'card'
  const reference = shown === 'reference' ? referenceUrl(refFile) : undefined

  const width =
    zoom === 'fit' ? undefined : zoom === '100' ? CARD_W * MM_TO_PX * 2 : CARD_W * MM_TO_PX * 4

  const quickExport = async () => {
    const { currentId, cards } = useStore.getState()
    const card = cards.find((c) => c.id === currentId)
    if (!card) return
    downloadBlob(await exportCardPng(card.yamlText, card.name, 300), pngFileName(card.name))
  }

  return (
    <section className="preview-pane">
      <header className="preview-toolbar">
        {(['fit', '100', '200'] as const).map((z) => (
          <button
            key={z}
            className={zoom === z ? 'active' : ''}
            onClick={() => setZoom(z)}
            type="button"
          >
            {z === 'fit' ? 'Fit' : `${z}%`}
          </button>
        ))}
        {references.length > 0 && (
          <select
            className="preview-reference"
            value={refFile}
            onChange={(e) => {
              setRefFile(e.target.value)
              // so a held F reaches the window, not the select's typeahead
              e.currentTarget.blur()
            }}
            title="Official render to compare against (reference/, local only)"
          >
            <option value="">no reference</option>
            {references.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        {refFile && (
          <>
            {(['card', 'reference'] as const).map((layer) => (
              <button
                key={layer}
                className={shown === layer ? 'active' : ''}
                onClick={() => setActive(layer)}
                type="button"
              >
                {layer === 'card' ? 'Card' : 'Reference'}
              </button>
            ))}
            <span className="preview-hint">hold F for the other</span>
          </>
        )}
        <span className="top-spacer" />
        <button type="button" disabled={!layout || stale} onClick={() => void quickExport()}>
          Export PNG
        </button>
      </header>
      <div className={`preview-scroll ${zoom === 'fit' ? 'preview-fit' : ''}`}>
        {layout ? (
          <div
            className={`preview-card ${stale ? 'preview-stale' : ''}`}
            style={width ? { width: `${width}px` } : undefined}
          >
            <CardSvg
              layout={layout}
              resolveAsset={resolveAsset}
              calibrate={calibrate}
              reference={reference}
            />
            {stale && <div className="stale-badge">stale — fix errors to update</div>}
          </div>
        ) : (
          <div className="preview-empty">No valid card yet</div>
        )}
      </div>
      {layout && layout.warnings.length > 0 && (
        <footer className="preview-warnings">
          {layout.warnings.map((w) => (
            <div key={w.message}>⚠ {w.message}</div>
          ))}
        </footer>
      )}
    </section>
  )
}
