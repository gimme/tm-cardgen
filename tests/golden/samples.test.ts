// Goldens: per sample card, snapshot the CardLayout JSON and the export SVG
// string (outlined text, logical asset refs). Pins the whole pipeline —
// parse -> validate -> layout -> render — against the real fonts.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkCard, layoutCard, renderSvgString, type AssetRef } from '../../src/core/index.ts'
import { pngBrightness, pngSize, SAMPLE_ART_DIR, testFonts } from '../helpers/fonts.ts'

const SAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/app/samples')
const samples = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.yaml'))

// logical refs keep goldens small and asset-content-independent
const resolveAsset = (ref: AssetRef): string =>
  ref.type === 'asset' ? `asset:${ref.path}` : `art:${ref.file}`

describe('sample goldens', () => {
  it('has all eight samples', () => {
    expect(samples).toHaveLength(8)
  })

  for (const file of samples) {
    it(`${file} lays out and renders stably`, async () => {
      const source = fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf8')
      const { diagnostics, spec } = checkCard(source)
      expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
      expect(spec).toBeDefined()

      const layout = layoutCard(spec!, {
        measurer: testFonts(),
        artSize: (name) => {
          const p = path.join(SAMPLE_ART_DIR, name)
          return fs.existsSync(p) ? pngSize(p) : undefined
        },
        artBrightness: (name, region) => {
          const p = path.join(SAMPLE_ART_DIR, name)
          return fs.existsSync(p) ? pngBrightness(p, region) : undefined
        },
      })
      expect(layout.warnings).toEqual([])

      const base = file.replace('.yaml', '')
      await expect(JSON.stringify(layout, null, 1)).toMatchFileSnapshot(
        `__snapshots__/${base}.layout.json`,
      )
      const svg = renderSvgString(layout, { resolveAsset, outline: testFonts() })
      await expect(svg).toMatchFileSnapshot(`__snapshots__/${base}.svg`)
    })
  }
})
