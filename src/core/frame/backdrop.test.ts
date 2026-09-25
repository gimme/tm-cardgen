import { describe, expect, it } from 'vitest'
import { meanBrightness } from '../layout/art.ts'
import { backdropLuma, backdropMarkup } from './backdrop.ts'

const rect = { x: 5.2, y: 14.64, w: 52.6, h: 39.39 }

describe('backdrop', () => {
  it('paints the sky and the haze over the rect, ids under the prefix', () => {
    const m = backdropMarkup(rect, 'p-')
    expect(m).toContain('<linearGradient id="p-backdrop-sky"')
    expect(m).toContain('<radialGradient id="p-backdrop-haze"')
    expect(m.match(/url\(#p-backdrop-(sky|haze)\)/g)).toHaveLength(2)
    expect(m.match(/<rect x="5.2" y="14.64" width="52.6" height="39.39"/g)).toHaveLength(2)
    expect(m).toBe(backdropMarkup(rect, 'p-'))
  })

  it('reads as a horizon: darker sky above, lighter ground below', () => {
    const luma = backdropLuma()
    const top = meanBrightness(luma, { x: 0, y: 0, w: 1, h: 0.5 })!
    const bottom = meanBrightness(luma, { x: 0, y: 0.5, w: 1, h: 0.5 })!
    expect(top).toBeLessThan(bottom)
    expect(bottom).toBeLessThan(0.6)
  })
})
