import { describe, expect, it } from 'vitest'
import { SLASH, slashPath, slashWidth } from './operators.ts'

describe('the slash', () => {
  const corners = (d: string) =>
    [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)])

  it('is a rectangle leaning right, its ends square to its run, one corner on each side of its box', () => {
    const h = 5
    const w = slashWidth(h)
    const [left, bottom, right, top] = corners(slashPath(1, 2, w, h))
    expect(left[0]).toBeCloseTo(1)
    expect(bottom[1]).toBeCloseTo(2 + h)
    expect(right[0]).toBeCloseTo(1 + w)
    expect(top[1]).toBeCloseTo(2)
    // the long sides lean SLASH.angle off vertical
    const lean = (Math.atan2(right[0] - bottom[0], bottom[1] - right[1]) * 180) / Math.PI
    expect(lean).toBeCloseTo(SLASH.angle, 1)
    // the ends run square to the sides, SLASH.stroke of the height across
    const end = [bottom[0] - left[0], bottom[1] - left[1]]
    const side = [right[0] - bottom[0], right[1] - bottom[1]]
    expect(end[0] * side[0] + end[1] * side[1]).toBeCloseTo(0)
    expect(Math.hypot(end[0], end[1])).toBeCloseTo(SLASH.stroke * h)
  })
})
