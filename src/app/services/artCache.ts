// In-memory view of user art: object URLs, intrinsic sizes and a brightness
// thumbnail, with a subscribe hook so previews re-layout when art arrives.
// Persistence is the ProjectStore's.
import { lumaMap, meanBrightness, type LumaMap, type Rect } from '../../core/index.ts'

export interface ArtEntry {
  url: string
  w: number
  h: number
  bytes: number
  /** brightness thumbnail; absent where the image could not be rasterized,
   *  and the credit then stays white */
  luma?: LumaMap
}

/** longest side of the brightness thumbnail */
const LUMA_SIDE = 256

type Listener = () => void

export class ArtCache {
  private entries = new Map<string, ArtEntry>()
  private listeners = new Set<Listener>()

  url(file: string): string | undefined {
    return this.entries.get(file)?.url
  }

  size(file: string): { w: number; h: number } | undefined {
    const e = this.entries.get(file)
    return e ? { w: e.w, h: e.h } : undefined
  }

  entry(file: string): ArtEntry | undefined {
    return this.entries.get(file)
  }

  /** mean brightness (0..1) of a region of the art, the region in image
   *  fractions (LayoutContext.artBrightness) */
  brightness(file: string, region: Rect): number | undefined {
    const luma = this.entries.get(file)?.luma
    return luma ? meanBrightness(luma, region) : undefined
  }

  files(): string[] {
    return [...this.entries.keys()].sort()
  }

  async setBlob(file: string, blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob)
    try {
      const { w, h, luma } = await decode(url)
      const old = this.entries.get(file)
      if (old) URL.revokeObjectURL(old.url)
      this.entries.set(file, { url, w, h, bytes: blob.size, luma })
      this.notify()
    } catch (err) {
      URL.revokeObjectURL(url)
      throw err
    }
  }

  remove(file: string): void {
    const old = this.entries.get(file)
    if (old) {
      URL.revokeObjectURL(old.url)
      this.entries.delete(file)
      this.notify()
    }
  }

  rename(from: string, to: string): void {
    const e = this.entries.get(from)
    if (e) {
      this.entries.delete(from)
      this.entries.set(to, e)
      this.notify()
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    for (const l of this.listeners) l()
  }
}

function decode(url: string): Promise<{ w: number; h: number; luma?: LumaMap }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({ w: img.naturalWidth, h: img.naturalHeight, luma: thumbnailLuma(img) })
    img.onerror = () => reject(new Error('could not decode image'))
    img.src = url
  })
}

/** the image rasterized small and reduced to brightness */
function thumbnailLuma(img: HTMLImageElement): LumaMap | undefined {
  const scale = Math.min(1, LUMA_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')
    if (!g) return undefined
    g.drawImage(img, 0, 0, w, h)
    return lumaMap(g.getImageData(0, 0, w, h).data, w, h)
  } catch {
    return undefined
  }
}
