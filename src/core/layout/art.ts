import type { Rect } from '../units.ts'

/** Cover-fit `img` (intrinsic w/h) into `window`, scaled by `zoom` (>= 1),
 *  panned by `offset` mm, and clamped so the window is never uncovered. */
export function coverFit(
  window: Rect,
  imgW: number,
  imgH: number,
  zoom: number,
  offset: [number, number],
): Rect {
  const scale = Math.max(window.w / imgW, window.h / imgH) * Math.max(1, zoom)
  const w = imgW * scale
  const h = imgH * scale
  // centered, then panned; clamp so edges never pull inside the window
  const minX = window.x + window.w - w
  const minY = window.y + window.h - h
  const x = clamp(window.x + (window.w - w) / 2 + offset[0], minX, window.x)
  const y = clamp(window.y + (window.h - h) / 2 + offset[1], minY, window.y)
  return { x, y, w, h }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** One brightness byte (0..255) per pixel of an image, at any resolution. */
export interface LumaMap {
  w: number
  h: number
  data: Uint8Array
}

/** Rec. 601 luma from RGBA bytes, transparency composited over white. */
export function lumaMap(rgba: ArrayLike<number>, w: number, h: number): LumaMap {
  const data = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    const y = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000
    const a = rgba[p + 3] / 255
    data[i] = Math.round(y * a + 255 * (1 - a))
  }
  return { w, h, data }
}

/** Mean brightness (0..1) of `region`, given as fractions of the image
 *  (0..1 on both axes); undefined when the region misses it entirely. */
export function meanBrightness(map: LumaMap, region: Rect): number | undefined {
  const x0 = Math.max(0, Math.floor(region.x * map.w))
  const x1 = Math.min(map.w, Math.ceil((region.x + region.w) * map.w))
  const y0 = Math.max(0, Math.floor(region.y * map.h))
  const y1 = Math.min(map.h, Math.ceil((region.y + region.h) * map.h))
  if (x1 <= x0 || y1 <= y0) return undefined
  let sum = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) sum += map.data[y * map.w + x]
  }
  return sum / ((x1 - x0) * (y1 - y0) * 255)
}
