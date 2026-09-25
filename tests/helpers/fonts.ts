// Loads the real vendored TTFs so measurements in tests are exact — and
// proves the core runs in plain Node (environment: 'node', no DOM).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng } from './png.ts'
import { FONT_FILES, FontService, lumaMap, meanBrightness } from '../../src/core/index.ts'
import type { FontId, LumaMap, Rect } from '../../src/core/index.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(HERE, '../../public/assets')

let service: FontService | undefined

export function testFonts(): FontService {
  if (!service) {
    const toArrayBuffer = (b: Buffer): ArrayBuffer =>
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    const buffers = Object.fromEntries(
      (Object.keys(FONT_FILES) as FontId[]).map((id) => [
        id,
        toArrayBuffer(fs.readFileSync(path.join(ASSETS, FONT_FILES[id]))),
      ]),
    ) as Record<FontId, ArrayBuffer>
    service = new FontService(buffers)
  }
  return service
}

export function pngSize(file: string): { w: number; h: number } {
  const b = fs.readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

export const SAMPLE_ART_DIR = path.join(HERE, '../../public/samples/art')

const lumaCache = new Map<string, LumaMap>()

/** Brightness of a region of a PNG, the way the app's ArtCache answers
 *  LayoutContext.artBrightness (from the full decode, not a thumbnail). */
export function pngBrightness(file: string, region: Rect): number | undefined {
  let map = lumaCache.get(file)
  if (!map) {
    const img = decodePng(fs.readFileSync(file))
    map = lumaMap(img.data, img.w, img.h)
    lumaCache.set(file, map)
  }
  return meanBrightness(map, region)
}
