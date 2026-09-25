// Gradient paints: a Ramp, ToneField or Profile compiled to SVG stops.
// SVG only lerps sRGB between stops, so curves are sampled adaptively.

import { fmt } from '../units.ts'

export type Knot = readonly [number, string]

/** compiled stops; offsets 0..1 unless the use site says card mm */
export type Stops = readonly Knot[]

/** Authored knots, interpolated in oklab. A distinct type from compiled
 *  Stops (sRGB lerp) so the two cannot be mixed up. */
export interface Ramp {
  knots: Stops
}

export const oklab = (knots: Stops): Ramp => ({ knots })

/** oklab ramp from `"pos #hex, pos #hex, …"` */
export function ramp(s: string): Ramp {
  return oklab(
    s.split(',').map((k) => {
      const [t, c] = k.trim().split(/\s+/)
      return [Number(t), c] as const
    }),
  )
}

/** profile from `"x level, x level, …"` */
export function profile(s: string): Profile {
  return s.split(',').map((k) => {
    const [x, l] = k.trim().split(/\s+/).map(Number)
    return [x, l] as const
  })
}

/** tone bands from `"at width strength, …"` */
export function bands(s: string): ToneBand[] {
  return s.split(',').map((k) => {
    const [at, width, strength] = k.trim().split(/\s+/).map(Number)
    return { at, width, strength }
  })
}

/** a flash crested at `at` (mm along the axis), fading over `width`,
 *  pulling `strength` toward `bright` (negative: toward `dark`) */
export interface ToneBand {
  at: number
  width: number
  strength: number
}

/** a base tone with flashes along one axis; lobes sum; mixing is plain RGB
 *  by design */
export interface ToneField {
  base: string
  dark: string
  bright: string
  bands: readonly ToneBand[]
}

/** max channel error (of 255) of the compiled stops */
const TOL = 2

type Vec3 = readonly [number, number, number]

export const hexToRgb = (hex: string): Vec3 => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

const rgbToHex = (c: Vec3): string =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/** a hex ink at an alpha, as CSS */
export const rgba = (hex: string, a: number): string => `rgba(${hexToRgb(hex).join(',')},${fmt(a)})`

/** sRGB lerp between two hexes */
export const mixHex = (hexA: string, hexB: string, t: number): string =>
  rgbToHex(lerp3(hexToRgb(hexA), hexToRgb(hexB), t))

// ---- Oklab (Björn Ottosson's reference coefficients) ----

const toLinear = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const toGamma = (c: number): number =>
  255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function rgbToLab(c: Vec3): Vec3 {
  const [r, g, b] = [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function labToRgb([L, A, B]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

// ---- evaluation ----

/** oklab-interpolated color at t, clamped to the knot span */
function evalRamp(ramp: Ramp, t: number): Vec3 {
  const ks = ramp.knots
  let i = 0
  while (i < ks.length - 2 && t > ks[i + 1][0]) i++
  const [t0, c0] = ks[i]
  const [t1, c1] = ks[i + 1]
  const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  return labToRgb(lerp3(rgbToLab(hexToRgb(c0)), rgbToLab(hexToRgb(c1)), f))
}

export function rampAt(ramp: Ramp, t: number): string {
  return rgbToHex(evalRamp(ramp, t))
}

/** [position, level] knots; a level indexes a Ramp's 0..1 knot space */
export type Profile = readonly (readonly [number, number])[]

/** the profile's level at x: linear between knots, clamped at the ends */
export function profileAt(p: Profile, x: number): number {
  let i = 0
  while (i < p.length - 2 && x > p[i + 1][0]) i++
  const [x0, l0] = p[i]
  const [x1, l1] = p[i + 1]
  const f = x1 === x0 ? 0 : Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
  return l0 + (l1 - l0) * f
}

export function toneAt(f: ToneField, d: number): string {
  return rgbToHex(toneRgb(f, d))
}

function toneRgb(f: ToneField, d: number): Vec3 {
  let pull = 0
  for (const b of f.bands) {
    const t = Math.abs(d - b.at) / (b.width / 2)
    // a cosine lobe: full at the crest, easing to nothing at the edges
    if (t < 1) pull += 0.5 * (1 + Math.cos(Math.PI * t)) * b.strength
  }
  return pull >= 0
    ? lerp3(hexToRgb(f.base), hexToRgb(f.bright), Math.min(1, pull))
    : lerp3(hexToRgb(f.base), hexToRgb(f.dark), Math.min(1, -pull))
}

// ---- compilation to stops ----

/** sample a curve over [a, b] into stops: seeds mark features, then each
 *  interval splits until it stays within `tol` of its chord */
function sample(
  f: (t: number) => Vec3,
  a: number,
  b: number,
  seeds: readonly number[],
  tol: number,
): Stops {
  const ts = [...new Set([a, ...seeds.filter((s) => s > a && s < b), b])].sort((x, y) => x - y)
  const out: [number, Vec3][] = [[a, f(a)]]
  // tested at ¼, ½ and ¾, not the midpoint alone: a cosine half-lobe
  // crosses its own chord's middle, so its midpoint error is zero
  const chordErr = (t0: number, c0: Vec3, t1: number, c1: Vec3): number => {
    let err = 0
    for (const k of [0.25, 0.5, 0.75]) {
      const c = f(t0 + (t1 - t0) * k)
      for (let ch = 0; ch < 3; ch++)
        err = Math.max(err, Math.abs(c[ch] - (c0[ch] + (c1[ch] - c0[ch]) * k)))
    }
    return err
  }
  const refine = (t0: number, c0: Vec3, t1: number, c1: Vec3, depth: number): void => {
    if (depth >= 10 || chordErr(t0, c0, t1, c1) <= tol) return
    const tm = (t0 + t1) / 2
    const cm = f(tm)
    refine(t0, c0, tm, cm, depth + 1)
    out.push([tm, cm])
    refine(tm, cm, t1, c1, depth + 1)
  }
  for (let i = 1; i < ts.length; i++) {
    const [t0, c0] = out[out.length - 1]
    const c1 = f(ts[i])
    refine(t0, c0, ts[i], c1, 0)
    out.push([ts[i], c1])
  }
  const hex = out.map(([t, c]) => [t, rgbToHex(c)] as const)
  return hex
    .filter(
      (s, i) => i === 0 || i === hex.length - 1 || hex[i - 1][1] !== s[1] || s[1] !== hex[i + 1][1],
    )
    .map(([t, c]) => [(t - a) / (b - a), c] as const)
}

/** stops for a ramp over [a, b] in knot units */
export function rampStops(
  ramp: Ramp,
  a = ramp.knots[0][0],
  b = ramp.knots[ramp.knots.length - 1][0],
  tol = TOL,
): Stops {
  const seeds = ramp.knots.map(([t]) => t)
  return sample((t) => evalRamp(ramp, t), a, b, seeds, tol)
}

/** stops for ramp∘profile over [a, b] in profile units */
export function profileStops(ramp: Ramp, p: Profile, a: number, b: number, tol = TOL): Stops {
  const seeds = p.map(([x]) => x)
  return sample((x) => evalRamp(ramp, profileAt(p, x)), a, b, seeds, tol)
}

/** stops for a tone field over [a, b] mm */
export function toneStops(f: ToneField, a: number, b: number, tol = TOL): Stops {
  const seeds = f.bands.flatMap((band) => [
    band.at - band.width / 2,
    band.at,
    band.at + band.width / 2,
  ])
  return sample((d) => toneRgb(f, d), a, b, seeds, tol)
}

// Gradient defs, in the caller's user space.

export const stops = (ss: Stops): string =>
  ss.map(([o, c]) => `<stop offset="${fmt(o)}" stop-color="${c}"/>`).join('')

export const linear = (
  id: string,
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
  ss: Stops,
) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
  `x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}">${stops(ss)}</linearGradient>`

/** a pair of radii makes the gradient elliptical (a unit circle scaled
 *  into place; SVG radial gradients have no ry of their own) */
export const radial = (
  id: string,
  [cx, cy]: [number, number],
  r: number | [number, number],
  ss: Stops,
) =>
  typeof r === 'number'
    ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
      `cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}">${stops(ss)}</radialGradient>`
    : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" ` +
      `gradientTransform="translate(${fmt(cx)} ${fmt(cy)}) scale(${fmt(r[0])} ${fmt(r[1])})">` +
      `${stops(ss)}</radialGradient>`
