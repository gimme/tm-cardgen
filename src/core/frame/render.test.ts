import { describe, expect, it } from 'vitest'
import type { FrameColor } from '../layout/frames.ts'
import { renderFrameMarkup } from './render.ts'
import { BLUE, FAMILY, type FramePreset, placeSeam } from './spec.ts'

const COLORS = ['green', 'red', 'blue'] as const
/** a height-independent piece each family draws before its divider; the
 *  divider test looks for it in the shared prefix (blue has no tag band,
 *  its title plate stands in) */
const TOP_MARKER = {
  green: 'frame-tagband-clip',
  red: 'frame-tagband-clip',
  blue: 'frame-plate-clip',
} as const

const preset = (color: FrameColor, variant: FramePreset) => {
  const artBottom = FAMILY[color].artBottom[variant]
  return artBottom === undefined ? undefined : renderFrameMarkup(color, { artBottom })
}

const wellFormed = (markup: string, what: string) => {
  expect(markup).not.toMatch(/NaN|undefined|Infinity/)
  // fully self-contained vectors: no asset references left
  expect(markup).not.toContain('<image')
  // every paint reference resolves to a def in the same markup
  for (const [, id] of markup.matchAll(/url\(#([^)]+)\)/g)) {
    expect(markup, `${what}: missing def #${id}`).toContain(`id="${id}"`)
  }
}

describe('renderFrameMarkup', () => {
  it('emits well-formed markup for every color/variant preset', () => {
    for (const color of COLORS) {
      for (const variant of ['small', 'medium', 'large', 'empty'] as const) {
        const markup = preset(color, variant)
        if (FAMILY[color].artBottom[variant] === undefined) {
          // only blue has an empty preset; the others have no artBottom
          expect(markup, `${color}/${variant} has no preset`).toBeUndefined()
          continue
        }
        expect(markup).toBeDefined()
        wellFormed(markup!, `${color}/${variant}`)
      }
    }
  })

  it('covers every variant the preset table serves, per color', () => {
    // a family must serve every variant the layout can ask for in its color
    for (const color of COLORS) {
      for (const variant of Object.keys(FAMILY[color].artBottom)) {
        expect(
          preset(color, variant as FramePreset),
          `${color}/${variant} should render`,
        ).toBeDefined()
      }
    }
  })

  it('renders any artBottom, not just the presets', () => {
    for (const color of COLORS) {
      // odd in-between and out-of-preset heights
      for (const artBottom of [39.1, 48.57, 58.2]) {
        const markup = renderFrameMarkup(color, { artBottom })!
        expect(markup).toBeDefined()
        wellFormed(markup, `${color}@${artBottom}`)
      }
    }
  })

  it('slides the whole seam with seamX, trim pattern included', () => {
    const trimDef = (m: string) =>
      m.match(/<linearGradient id="frame-banner-trim".*?<\/linearGradient>/)![0]
    // per family: the default seamX gives the same markup as none; the trim
    // gradient is anchored on the seam, so a slid render's banner-trim def
    // must differ
    for (const [color, official] of [
      ['green', 28.65],
      ['red', 29.41],
      ['blue', 30.15],
    ] as const) {
      const artBottom = FAMILY[color].artBottom.medium!
      const at = (seamX?: number) => renderFrameMarkup(color, { artBottom, seamX })!
      expect(at(official)).toBe(at(undefined))
      const slid = at(22)
      expect(slid).not.toBe(at(undefined))
      expect(trimDef(slid)).not.toBe(trimDef(at(undefined)))
      wellFormed(slid, `${color}@seam22`)
    }
  })

  it("hangs blue's action divider off artTop", () => {
    const artBottom = FAMILY.blue.artBottom.medium!
    const at = (artTop?: number) => renderFrameMarkup('blue', { artBottom, artTop })!
    // the default artTop gives the same markup as none; a deeper action area
    // renders from the same continuous geometry
    expect(at(BLUE.artTop)).toBe(at(undefined))
    const deep = at(36.8)
    expect(deep).not.toBe(at(undefined))
    wellFormed(deep, 'blue@artTop36.8')
  })

  it('keeps the title plate fixed while artTop and artBottom move', () => {
    // the plate is fixed geometry above the action area: its geometry
    // (the clip path carries the whole boundary) must not follow the
    // free geometry inputs
    const plateClip = (m: string) => m.match(/<clipPath id="frame-plate-clip">.*?<\/clipPath>/)![0]
    const base = renderFrameMarkup('blue', { artBottom: FAMILY.blue.artBottom.medium! })!
    const moved = renderFrameMarkup('blue', { artBottom: 57.4, artTop: 36.8 })!
    expect(plateClip(moved)).toBe(plateClip(base))
  })

  it('isolates ids per instance so frames can share one document', () => {
    const ids = (markup: string) => [...markup.matchAll(/id="([^"]+)"/g)].map(([, id]) => id)
    const a = renderFrameMarkup('green', { artBottom: FAMILY.green.artBottom.medium! }, 'a')!
    const b = ids(renderFrameMarkup('red', { artBottom: 49.34 }, 'b')!)
    // every id and reference carries the instance; nothing crosses
    expect(ids(a).every((id) => id.startsWith('frame-a-'))).toBe(true)
    expect([...a.matchAll(/url\(#([^)]+)\)/g)].every(([, id]) => id.startsWith('frame-a-'))).toBe(
      true,
    )
    expect(ids(a).filter((id) => b.includes(id))).toEqual([])
    // without an instance, ids are the plain deterministic frame-* names
    expect(
      ids(renderFrameMarkup('green', { artBottom: FAMILY.green.artBottom.medium! })!).every((id) =>
        id.startsWith('frame-'),
      ),
    ).toBe(true)
  })

  it('moves only the divider assembly between heights', () => {
    for (const color of COLORS) {
      const drawing = (artBottom: number) =>
        renderFrameMarkup(color, { artBottom })!.split('</defs>')[1]
      const medium = drawing(50)
      const large = drawing(44)
      // the drawings must agree until the divider begins; the top of the
      // card does not depend on the height
      let i = 0
      while (i < medium.length && medium[i] === large[i]) i++
      const shared = medium.slice(0, i)
      expect(shared).toContain(TOP_MARKER[color])
      expect(shared).not.toContain('frame-panel')
    }
  })
})

describe('placeSeam', () => {
  it('stays at the official position when nothing pushes it', () => {
    expect(placeSeam('green')).toBeCloseTo(28.65)
    expect(placeSeam('red')).toBeCloseTo(29.41)
    expect(placeSeam('blue')).toBeCloseTo(30.15)
    // a min-width requirement bar and 1-3 tags leave it alone too
    expect(placeSeam('green', 19.5)).toBeCloseTo(28.65)
    expect(placeSeam('green', undefined, 32.9)).toBeCloseTo(28.65)
    expect(placeSeam('red', 19.5)).toBeCloseTo(29.41)
    expect(placeSeam('blue', 19.5)).toBeCloseTo(30.15)
    expect(placeSeam('blue', undefined, 32.9)).toBeCloseTo(30.15)
  })

  it('slides right of a wide requirement bar', () => {
    const x = placeSeam('green', 33)!
    expect(x).toBeGreaterThan(33)
    expect(x).toBeLessThan(36)
    // red's center keeps its whole leaning tip clear of the bar
    const r = placeSeam('red', 33)!
    expect(r).toBeGreaterThan(33 + 3.2)
    expect(r).toBeLessThan(33 + 5.5)
    // blue's left apex swings ~0.75 past its anchor and has to clear too
    const b = placeSeam('blue', 33)!
    expect(b).toBeGreaterThan(33 + 1.5)
    expect(b).toBeLessThan(33 + 3)
  })

  it('slides left for a 4th tag, unless the requirement bar objects', () => {
    const forTags = placeSeam('green', undefined, 23.7)!
    // whole seam (apex included) left of the tag, with margin
    expect(forTags).toBeLessThan(23.7 - 1.5)
    // red's foot reaches lean/2 right of center: all of it has to clear
    expect(placeSeam('red', undefined, 23.7)!).toBeLessThan(23.7 - 4.4)
    // blue's right apex reaches ~0.45 past its anchor
    expect(placeSeam('blue', undefined, 23.7)!).toBeLessThan(23.7 - 1.5)
    // the bar always wins over the tags
    expect(placeSeam('green', 33, 23.7)).toBe(placeSeam('green', 33))
    expect(placeSeam('red', 33, 23.7)).toBe(placeSeam('red', 33))
    expect(placeSeam('blue', 33, 23.7)).toBe(placeSeam('blue', 33))
  })
})
