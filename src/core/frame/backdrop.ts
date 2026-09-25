// The backdrop: a drawn Mars sky shown in the art window of a card that
// names no art. Every artless card shares the one sky.
import { fmt, type Rect } from '../units.ts'
import { lumaMap, type LumaMap } from '../layout/art.ts'
import { hexToRgb, linear, ramp, rampAt, rampStops } from './paint.ts'

const BACKDROP = {
  /** the sky, top (0) to bottom (1) of the drawn rect */
  sky: ramp('0 #1e100c, 0.5 #6a3a24, 1 #b3733a'),
  /** glow placed and sized in fractions of the rect, fading linearly to the rim */
  haze: { cx: 0.5, cy: 0.92, rx: 0.8, ry: 0.55, ink: '#dc9a52', alpha: 0.4 },
}

export function backdropMarkup(r: Rect, idPrefix = ''): string {
  const { sky, haze } = BACKDROP
  const skyId = `${idPrefix}backdrop-sky`
  const hazeId = `${idPrefix}backdrop-haze`
  const rect = (fill: string) =>
    `<rect x="${fmt(r.x)}" y="${fmt(r.y)}" width="${fmt(r.w)}" height="${fmt(r.h)}" fill="${fill}"/>`
  const hazeDef =
    `<radialGradient id="${hazeId}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" ` +
    `gradientTransform="translate(${fmt(r.x + haze.cx * r.w)} ${fmt(r.y + haze.cy * r.h)}) ` +
    `scale(${fmt(haze.rx * r.w)} ${fmt(haze.ry * r.h)})">` +
    `<stop offset="0" stop-color="${haze.ink}" stop-opacity="${fmt(haze.alpha)}"/>` +
    `<stop offset="1" stop-color="${haze.ink}" stop-opacity="0"/></radialGradient>`
  return (
    `<g><defs>${linear(skyId, [0, r.y], [0, r.y + r.h], rampStops(sky))}${hazeDef}</defs>` +
    rect(`url(#${skyId})`) +
    rect(`url(#${hazeId})`) +
    `</g>`
  )
}

/** The backdrop as a LumaMap, the form the app rasterizes off real art, so
 *  the artist credit picks its ink the same way. Computed once. */
export function backdropLuma(): LumaMap {
  return (luma ??= computeLuma())
}
let luma: LumaMap | undefined

const LUMA_W = 16
const LUMA_H = 32

function computeLuma(): LumaMap {
  const { sky, haze } = BACKDROP
  const hazeRgb = hexToRgb(haze.ink)
  const rgba = new Uint8Array(LUMA_W * LUMA_H * 4)
  for (let j = 0; j < LUMA_H; j++) {
    const v = (j + 0.5) / LUMA_H
    const skyRgb = hexToRgb(rampAt(sky, v))
    for (let i = 0; i < LUMA_W; i++) {
      const u = (i + 0.5) / LUMA_W
      const d = Math.hypot((u - haze.cx) / haze.rx, (v - haze.cy) / haze.ry)
      const a = haze.alpha * Math.max(0, 1 - d)
      const p = (j * LUMA_W + i) * 4
      for (let c = 0; c < 3; c++) rgba[p + c] = Math.round(skyRgb[c] * (1 - a) + hazeRgb[c] * a)
      rgba[p + 3] = 255
    }
  }
  return lumaMap(rgba, LUMA_W, LUMA_H)
}
