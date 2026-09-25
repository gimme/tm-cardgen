import { zipSync, type Zippable } from 'fflate'
import { CARD_H, CARD_W, mmToPx, type CardLayout } from '../../core/index.ts'
import { bytesToBlob, exportSvg, layoutFromText, slugify } from './exportCommon.ts'

export type ExportDpi = 300 | 600

export const pngFileName = (cardName: string): string => `${slugify(cardName)}.png`

/** Rasterize a laid-out card: standalone SVG -> <img> -> canvas -> PNG blob. */
async function layoutToPngBlob(layout: CardLayout, dpi: ExportDpi): Promise<Blob> {
  const svg = await exportSvg(layout)
  const [w, h] = [Math.round(mmToPx(CARD_W, dpi)), Math.round(mmToPx(CARD_H, dpi))]
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')
  return blob
}

export function exportCardPng(yamlText: string, cardName: string, dpi: ExportDpi): Promise<Blob> {
  return layoutToPngBlob(layoutFromText(yamlText, cardName), dpi)
}

/** Every card as a PNG, in one uncompressed zip. */
export async function exportCardsPngZip(
  cards: { name: string; yamlText: string }[],
  dpi: ExportDpi,
  onProgress?: (done: number) => void,
): Promise<Blob> {
  const files: Zippable = {}
  for (const [i, card] of cards.entries()) {
    const blob = await exportCardPng(card.yamlText, card.name, dpi)
    files[pngFileName(card.name)] = new Uint8Array(await blob.arrayBuffer())
    onProgress?.(i + 1)
  }
  return bytesToBlob(zipSync(files, { level: 0 }), 'application/zip')
}
