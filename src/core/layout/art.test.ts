import { describe, expect, it } from 'vitest'
import { coverFit } from './art.ts'

const win = { x: 10, y: 20, w: 40, h: 30 }

describe('coverFit', () => {
  it('covers the window exactly for a matching aspect', () => {
    expect(coverFit(win, 400, 300, 1, [0, 0])).toEqual({ x: 10, y: 20, w: 40, h: 30 })
  })

  it('covers with overflow on the long axis, centered', () => {
    const r = coverFit(win, 400, 400, 1, [0, 0])
    expect(r.w).toBe(40)
    expect(r.h).toBe(40)
    expect(r.y).toBeCloseTo(20 - 5)
  })

  it('zoom scales beyond cover', () => {
    const r = coverFit(win, 400, 300, 1.5, [0, 0])
    expect(r.w).toBeCloseTo(60)
    expect(r.x).toBeCloseTo(10 - 10)
  })

  it('clamps offset so the window never uncovers', () => {
    const r = coverFit(win, 400, 400, 1, [0, 99])
    // pushed down as far as allowed: top edge at window top
    expect(r.y).toBe(20)
    const r2 = coverFit(win, 400, 400, 1, [0, -99])
    expect(r2.y + r2.h).toBeCloseTo(50)
  })

  it('never zooms below cover', () => {
    const r = coverFit(win, 400, 300, 0.5 as number, [0, 0])
    expect(r.w).toBe(40)
  })
})
