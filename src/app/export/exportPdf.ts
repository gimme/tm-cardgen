// 3x3 print sheet: each card rasterized at the chosen DPI, placed at 63x88mm,
// its cut line stroked on top (card faces export full-bleed, square-cornered).
import { PDFDocument, rgb } from 'pdf-lib'
import { CARD_H, CARD_R, CARD_W, mmToPx, roundedRectPath } from '../../core/index.ts'
import { bytesToBlob, layoutFromText } from './exportCommon.ts'
import { exportCardPng, type ExportDpi } from './exportPng.ts'

export type PageSize = 'a4' | 'letter'
export type Spacing = 'gap' | 'flush'

interface PdfOptions {
  dpi: ExportDpi
  page: PageSize
  spacing: Spacing
  onProgress?: (done: number, total: number) => void
}

const CARD_W_PT = mmToPx(CARD_W, 72)
const CARD_H_PT = mmToPx(CARD_H, 72)
const GAP_PT = mmToPx(2, 72)

const PAGE_SIZES: Record<PageSize, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

export async function exportPdfSheet(
  cards: { name: string; yamlText: string }[],
  options: PdfOptions,
): Promise<Blob> {
  // fail fast on invalid cards before the slow rasterization
  for (const card of cards) layoutFromText(card.yamlText, card.name)

  const doc = await PDFDocument.create()
  const [pageW, pageH] = PAGE_SIZES[options.page]
  const gap = options.spacing === 'gap' ? GAP_PT : 0
  const gridW = 3 * CARD_W_PT + 2 * gap
  const gridH = 3 * CARD_H_PT + 2 * gap
  const originX = (pageW - gridW) / 2
  const originY = (pageH - gridH) / 2
  /** bottom-left of cell i of the 3x3 grid (PDF origin is bottom-left; row 0 at the top) */
  const cell = (i: number): [number, number] => [
    originX + (i % 3) * (CARD_W_PT + gap),
    originY + (2 - Math.floor(i / 3)) * (CARD_H_PT + gap),
  ]
  const cutLine = roundedRectPath(0, 0, CARD_W_PT, CARD_H_PT, mmToPx(CARD_R, 72))

  let done = 0
  for (let start = 0; start < cards.length; start += 9) {
    const page = doc.addPage([pageW, pageH])
    const batch = cards.slice(start, start + 9)
    for (let i = 0; i < batch.length; i++) {
      const png = await exportCardPng(batch[i].yamlText, batch[i].name, options.dpi)
      const image = await doc.embedPng(await png.arrayBuffer())
      const [x, y] = cell(i)
      page.drawImage(image, { x, y, width: CARD_W_PT, height: CARD_H_PT })
      done++
      options.onProgress?.(done, cards.length)
    }
    // drawSvgPath's y is the path's top edge, path coordinates going down
    for (let i = 0; i < batch.length; i++) {
      const [x, y] = cell(i)
      page.drawSvgPath(cutLine, {
        x,
        y: y + CARD_H_PT,
        borderColor: rgb(0.35, 0.35, 0.35),
        borderWidth: 0.4,
      })
    }
  }

  return bytesToBlob(await doc.save(), 'application/pdf')
}
