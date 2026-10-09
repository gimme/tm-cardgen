import { describe, expect, it } from 'vitest'
import { ICONS } from '../icons.ts'
import { MC } from './megacredit.ts'
import { HALO, haloCenter, haloMarkup, haloPath, haloSpan } from './halo.ts'

/** the vertices of an all-line path */
const verts = (d: string) =>
  [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)])

describe('any-player halo', () => {
  it('gives every family one shape, and the odd icons none', () => {
    const shapes = (names: string[]) => new Set(names.map((n) => ICONS[n].halo))
    expect(shapes(['steel', 'plant', 'heat', 'microbe', 'animal', 'wild', 'tr'])).toEqual(
      new Set(['box']),
    )
    expect(shapes(['city', 'ocean', 'greenery', 'greenery-no-oxygen', 'special-tile'])).toEqual(
      new Set(['hexagon']),
    )
    expect(shapes(Object.keys(ICONS).filter((n) => n.endsWith('-tag')))).toEqual(
      new Set(['circle']),
    )
    expect(shapes(['colony', 'trade'])).toEqual(new Set(['triangle']))
    expect(shapes(['chairman', 'delegate', 'party-leader'])).toEqual(new Set(['bust']))
    expect(ICONS.mc.halo).toBe('octagon')
    expect(ICONS.card.halo).toBe('card')
    expect(ICONS.temperature.halo).toBe('thermometer')
    expect(ICONS.fighter.halo).toBe('box')
    // the oxygen disc fills its box, so it rings like a tag
    expect(ICONS.oxygen.halo).toBe('circle')
    expect(ICONS.venus.halo).toBe('venus')
    expect(ICONS.influence.halo).toBe('star')
    for (const n of ['*', '->', 'party-reds']) expect(ICONS[n].halo, n).toBeUndefined()
  })

  it('centers the box on the origin', () => {
    expect(haloPath('box', 3, 4)).toBe('M -1.5 -2 L 1.5 -2 L 1.5 2 L -1.5 2 Z')
    expect(haloCenter('box', 3, 4)).toEqual([1.5, 2])
  })

  it("cuts the octagon's corners like the coin's", () => {
    const c = (10 * MC.cut) / MC.size
    const v = verts(haloPath('octagon', 10, 10))
    expect(v).toHaveLength(8)
    expect(v[0][0]).toBeCloseTo(c - 5)
    expect(v[2]).toEqual([5, expect.closeTo(c - 5)])
  })

  it('stands a regular hexagon at the left of the box, whatever the box width', () => {
    const h = 12
    const hw = (h * Math.sqrt(3)) / 2
    const v = verts(haloPath('hexagon', 13, h))
    expect(v).toHaveLength(6)
    expect(Math.min(...v.map(([x]) => x))).toBeCloseTo(-hw / 2)
    expect(Math.max(...v.map(([x]) => x))).toBeCloseTo(hw / 2)
    expect(v[0]).toEqual([0, -6])
    expect(v[3]).toEqual([0, 6])
    // greenery's box is wider than its hexagon: the center stays the hexagon's
    expect(haloCenter('hexagon', 13, h)).toEqual([expect.closeTo(hw / 2), 6])
    expect(haloCenter('hexagon', hw, h)).toEqual([expect.closeTo(hw / 2), 6])
  })

  it('points the triangle up', () => {
    expect(verts(haloPath('triangle', 8, 6))).toEqual([
      [0, -3],
      [4, 3],
      [-4, 3],
    ])
  })

  it('rounds the disc and the card', () => {
    expect(haloPath('circle', 6, 6)).toMatch(/^M -3 0 C /)
    expect(haloPath('card', 10, 14)).toContain(`a ${HALO.cardCorner * 10}`)
  })

  it('points the star ten ways, its tips on the box and its notches three quarters out', () => {
    const v = verts(haloPath('star', 9.5, 10))
    expect(v).toHaveLength(20)
    expect(v[0]).toEqual([0, -5])
    expect(v[10]).toEqual([0, 5])
    expect(Math.max(...v.map(([x]) => x))).toBeCloseTo(4.75)
    expect(Math.min(...v.map(([x]) => x))).toBeCloseTo(-4.75)
    // the notch between the top tip and the next, on its way round
    const t = Math.PI / 10
    expect(v[1][1]).toBeCloseTo(-5 * 0.75 * Math.cos(t))
  })

  it('outlines venus as its half ring and the V standing in it', () => {
    const [w, h] = [9.5, 5.3]
    const d = haloPath('venus', w, h)
    const [ring, v] = d.split(' Z').filter((p) => p.trim())
    // the ring: an arc out to the box's sides and one back, its legs on the foot
    expect(ring.match(/ A /g)).toHaveLength(2)
    expect(ring).toMatch(/^M -4.75 2.65 /)
    // the V: a polygon from the box's top to its foot
    const corners = verts(v)
    expect(corners).toHaveLength(9)
    expect(Math.min(...corners.map(([, y]) => y))).toBeCloseTo(-h / 2, 1)
    expect(Math.max(...corners.map(([, y]) => y))).toBeCloseTo(h / 2, 1)
    for (const [x] of corners) expect(Math.abs(x)).toBeLessThan(w / 2)
  })

  it('builds the bust and the thermometer from two pieces each', () => {
    for (const shape of ['bust', 'thermometer'] as const) {
      const d = haloPath(shape, 6, 10)
      expect(d.split(' Z')).toHaveLength(3)
      // both pieces inside the icon box
      for (const [x, y] of verts(d)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(3)
        expect(Math.abs(y)).toBeLessThanOrEqual(5)
      }
    }
    // the bulb is the icon's full width, sitting at the bottom
    expect(haloPath('thermometer', 6, 10)).toContain('M -3 2 C')
  })

  it('draws the ring at the icon center, at full size scaled to the icon', () => {
    const m = haloMarkup('hexagon', 10, 20, 6, 12, 0.5, 'x-halo')
    // hexagon half-width at h=12 is 5.196
    expect(m).toMatch(/^<g transform="translate\(15\.196 26\) scale\(0\.5\)"><defs>/)
    expect(m).toContain('</defs><path d="M 0 -12 ')
    expect(m).toContain(
      `fill="url(#x-halo)" stroke="url(#x-halo)" stroke-width="${2 * HALO.width}"`,
    )
    expect(haloMarkup('box', 0, 0, 4, 4, 1, 'x')).toMatch(/^<g transform="translate\(2 2\)">/)
  })

  it("sweeps yellow at the center to red a streak away, or at a narrow shape's sides", () => {
    const sweep = (m: string) => {
      const [, x1, x2] = /x1="([^"]+)" y1="0" x2="([^"]+)" y2="0"/.exec(m)!
      return [Number(x1), Number(x2)]
    }
    const m = haloMarkup('box', 0, 0, 10, 10, 1, 'x-halo')
    expect(m).toContain('<linearGradient id="x-halo" gradientUnits="userSpaceOnUse"')
    expect(sweep(m)).toEqual([-HALO.streak, HALO.streak])
    const stops = [...m.matchAll(/offset="([^"]+)" stop-color="([^"]+)"/g)].map(
      ([, o, c]) => [Number(o), c] as const,
    )
    expect(stops[0]).toEqual([0, HALO.paint.knots[0][1]])
    expect(stops[stops.length - 1]).toEqual([1, HALO.paint.knots[0][1]])
    expect(stops.find(([o]) => o === 0.5)?.[1]).toBe('#ffea00')
    // the thermometer's stem and the bust's head are narrower than the streak
    expect(haloSpan('thermometer', 3, 10)).toBe(0.75)
    expect(sweep(haloMarkup('thermometer', 0, 0, 3, 10, 1, 'x'))).toEqual([-0.75, 0.75])
    expect(haloSpan('bust', 6, 8)).toBeLessThan(3)
    expect(haloSpan('hexagon', 13, 12)).toBeCloseTo((12 * Math.sqrt(3)) / 4)
    // a small icon's sweep scales with its ring: the span is in full-size mm
    expect(sweep(haloMarkup('thermometer', 0, 0, 1.5, 5, 0.5, 'x'))).toEqual([-0.75, 0.75])
  })
})
