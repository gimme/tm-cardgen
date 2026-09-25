import { describe, expect, it } from 'vitest'
import {
  profileAt,
  profileStops,
  rampAt,
  rampStops,
  toneAt,
  toneStops,
  type Stops,
} from './paint.ts'
import { MC } from './megacredit.ts'
import { BANNER, GREEN, INTERIOR, SHEEN } from './spec.ts'

const hexToRgb = (hex: string): number[] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/** what SVG paints from a stop list: piecewise-linear sRGB at offset t */
function paintAt(stops: Stops, t: number): number[] {
  let i = 0
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++
  const [t0, c0] = stops[i]
  const [t1, c1] = stops[i + 1]
  const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  const [a, b] = [hexToRgb(c0), hexToRgb(c1)]
  return a.map((v, ch) => v + (b[ch] - v) * f)
}

/** max channel error of the compiled stops against the true curve */
function maxErr(stops: Stops, trueAt: (t: number) => string, a: number, b: number): number {
  let worst = 0
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000
    const painted = paintAt(stops, t)
    const model = hexToRgb(trueAt(a + (b - a) * t))
    for (let ch = 0; ch < 3; ch++) worst = Math.max(worst, Math.abs(painted[ch] - model[ch]))
  }
  return worst
}

// the compiler's TOL is 2 levels; hex rounding on each side adds ±0.5
const BOUND = 3

describe('paint compilation', () => {
  it('keeps sampled tone fields within tolerance of the model', () => {
    const rad = (SHEEN.angle * Math.PI) / 180
    const len =
      (INTERIOR.x1 - SHEEN.origin[0]) * Math.cos(rad) +
      (INTERIOR.bottom - SHEEN.origin[1]) * Math.sin(rad)
    expect(maxErr(toneStops(SHEEN, 0, len), (d) => toneAt(SHEEN, d), 0, len)).toBeLessThanOrEqual(
      BOUND,
    )
    const trim = BANNER.trim
    const [a, b] = [INTERIOR.x0 - GREEN.seam.x, INTERIOR.x1 - GREEN.seam.x]
    expect(maxErr(toneStops(trim, a, b), (d) => toneAt(trim, d), a, b)).toBeLessThanOrEqual(BOUND)
  })

  it('keeps sampled oklab ramps within tolerance of the curve', () => {
    const ring = GREEN.ring
    for (const [a, b] of [
      [0, 0.2068],
      [0.2068, 0.5],
      [0.5, 0.7068],
      [0.7068, 1],
    ]) {
      expect(maxErr(rampStops(ring, a, b), (t) => rampAt(ring, t), a, b)).toBeLessThanOrEqual(BOUND)
    }
    for (const ramp of [MC.bg.ramp, MC.bevel, MC.detail]) {
      const [a, b] = [ramp.knots[0][0], ramp.knots[ramp.knots.length - 1][0]]
      expect(maxErr(rampStops(ramp), (t) => rampAt(ramp, t), a, b)).toBeLessThanOrEqual(BOUND)
    }
  })

  it('keeps sampled profiles within tolerance of the model', () => {
    const ramp = GREEN.crystalRamp
    for (const p of [
      GREEN.crystal.tag.ground,
      GREEN.crystal.tag.shine.profile,
      GREEN.crystal.divider.ground,
    ]) {
      const [a, b] = [p[0][0], p[p.length - 1][0]]
      // interpolating between two already-rounded stops can add another
      // half level on top of the BOUND budget
      expect(
        maxErr(profileStops(ramp, p, a, b), (x) => rampAt(ramp, profileAt(p, x)), a, b),
      ).toBeLessThanOrEqual(BOUND + 0.5)
    }
  })

  it('slices of one cyclic ramp agree wherever they meet', () => {
    // adjacent slices of the same ramp end and begin on the identical
    // evaluated color, wherever they are cut
    const ring = GREEN.ring
    for (const cut of [0.1, 0.2068, 0.33, 0.5, 0.7068, 0.9]) {
      const before = rampStops(ring, 0, cut)
      const after = rampStops(ring, cut, 1)
      expect(before[before.length - 1][1]).toBe(after[0][1])
    }
  })
})
