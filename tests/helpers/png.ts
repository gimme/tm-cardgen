// Minimal PNG decoder: 8-bit RGB/RGBA, non-interlaced — what the sample art
// is. Lets the golden test read art brightness the way the app does.
import { inflateSync } from 'node:zlib'

export interface Image {
  w: number
  h: number
  /** RGBA, row-major, 4 bytes per pixel */
  data: Uint8Array
}

export function decodePng(buf: Uint8Array): Image {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let off = 8 // signature
  let w = 0
  let h = 0
  let channels = 0
  const idat: Uint8Array[] = []
  while (off < buf.length) {
    const len = view.getUint32(off)
    const type = String.fromCharCode(...buf.subarray(off + 4, off + 8))
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = view.getUint32(off + 8)
      h = view.getUint32(off + 12)
      const [depth, color, , , interlace] = data.subarray(8)
      if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0)
        throw new Error(`unsupported PNG (depth ${depth}, color type ${color})`)
      channels = color === 6 ? 4 : 3
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    off += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * channels
  const out = new Uint8Array(w * h * 4)
  const prev = new Uint8Array(stride)
  const cur = new Uint8Array(stride)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    cur.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    unfilterRow(filter, cur, prev, channels)
    for (let x = 0; x < w; x++) {
      const s = x * channels
      const d = (y * w + x) * 4
      out[d] = cur[s]
      out[d + 1] = cur[s + 1]
      out[d + 2] = cur[s + 2]
      out[d + 3] = channels === 4 ? cur[s + 3] : 255
    }
    prev.set(cur)
  }
  return { w, h, data: out }
}

function unfilterRow(filter: number, cur: Uint8Array, prev: Uint8Array, bpp: number): void {
  const n = cur.length
  for (let i = 0; i < n; i++) {
    const a = i >= bpp ? cur[i - bpp] : 0
    const b = prev[i]
    const c = i >= bpp ? prev[i - bpp] : 0
    switch (filter) {
      case 0:
        break
      case 1:
        cur[i] = (cur[i] + a) & 0xff
        break
      case 2:
        cur[i] = (cur[i] + b) & 0xff
        break
      case 3:
        cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff
        break
      case 4: {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
        break
      }
      default:
        throw new Error(`bad PNG filter ${filter}`)
    }
  }
}
