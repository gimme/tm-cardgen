import { describe, expect, it } from 'vitest'
import { frameRegions } from '../layout/frames.ts'
import type { CardLayout, TextOutline } from '../layout/model.ts'
import { renderSvgMarkup } from './svgString.ts'

// one node of every id-generating kind: the frame's defs, a clip, the
// production pattern, the requirement box's gradient, the backdrop's
// gradients, the megacredit defs and a halo's sweep
const layout: CardLayout = {
  warnings: [],
  frame: { color: 'green', regions: frameRegions('green', 26.7) },
  nodes: [
    { kind: 'frame', color: 'green', artBottom: 53.23, seamX: 28.6 },
    { kind: 'reqbox', w: 20, max: false },
    { kind: 'backdrop', x: 5, y: 15, w: 53, h: 38 },
    {
      kind: 'rect',
      x: 5,
      y: 60,
      w: 10,
      h: 10,
      fill: 'production-pattern',
      patternOrigin: { x: 5, y: 60 },
    },
    { kind: 'vector', icon: 'mc', x: 2, y: 2, w: 5, h: 5 },
    { kind: 'halo', shape: 'hexagon', x: 20, y: 60, w: 5, h: 5, scale: 1 },
    {
      kind: 'image',
      asset: { type: 'asset', path: 'x.png' },
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      clip: { x: 0, y: 0, w: 5, h: 5 },
    },
  ],
}
const resolveAsset = () => 'about:blank'

describe('renderSvgMarkup id scoping', () => {
  const ids = (m: string) => [...m.matchAll(/id="([^"]+)"/g)].map(([, id]) => id)
  const refs = (m: string) => [...m.matchAll(/url\(#([^)]+)\)/g)].map(([, id]) => id)

  it('stamps idPrefix on every generated id and reference', () => {
    const a = renderSvgMarkup(layout, { resolveAsset, idPrefix: 'a-' })
    for (const id of [...ids(a), ...refs(a)]) {
      // the frame renderer scopes its ids as frame-<prefix>-*
      expect(id, `unscoped id ${id}`).toMatch(/^(a-|frame-a-)/)
    }
  })

  it('keeps two mounts with different prefixes from sharing any id', () => {
    const a = ids(renderSvgMarkup(layout, { resolveAsset, idPrefix: 'a-' }))
    const b = ids(renderSvgMarkup(layout, { resolveAsset, idPrefix: 'b-' }))
    expect(a.length).toBeGreaterThan(0)
    expect(a.filter((id) => b.includes(id))).toEqual([])
  })

  it('is byte-deterministic without a prefix (export, goldens)', () => {
    const bare = renderSvgMarkup(layout, { resolveAsset })
    expect(bare).toBe(renderSvgMarkup(layout, { resolveAsset }))
  })
})

describe('outlined text', () => {
  const text = (outline?: TextOutline): CardLayout => ({
    warnings: [],
    frame: layout.frame,
    nodes: [
      {
        kind: 'text',
        font: 'proto',
        size: 5,
        x: 1,
        y: 2,
        text: '1',
        fill: '#000',
        anchor: 'start',
      },
    ].map((n) => (outline ? { ...n, outline } : n)) as CardLayout['nodes'],
  })
  const strokes = (m: string) =>
    [...m.matchAll(/stroke="([^"]+)" stroke-width="([^"]+)"/g)].map(([, color, w]) => [color, w])

  const bands = [
    { color: '#ff0', width: 0.2 },
    { color: '#f80', width: 0.3 },
  ]

  it('draws a copy per band, the outermost first, each under its own fill', () => {
    const m = renderSvgMarkup(text({ inset: 0, bands }), { resolveAsset })
    expect(strokes(m)).toEqual([
      ['#f80', '1'],
      ['#ff0', '0.4'],
    ])
    expect(m.match(/<text /g)).toHaveLength(2)
    expect(m.match(/paint-order="stroke"/g)).toHaveLength(2)
  })

  it('lays the inset over the fill: a bare stroke of the innermost band, twice the inset wide, clipped to the glyph', () => {
    const m = renderSvgMarkup(text({ inset: 0.15, bands }), { resolveAsset })
    // the bands reach 0.35 past the glyph's edge; the yellow only 0.05
    expect(strokes(m)).toEqual([
      ['#f80', '0.7'],
      ['#ff0', '0.1'],
      ['#ff0', '0.3'],
    ])
    expect(m.match(/<text /g)).toHaveLength(4) // two under-copies, the clip's, the clipped
    expect(m.match(/paint-order="stroke"/g)).toHaveLength(2)
    expect(m).toMatch(/<clipPath id="clip0"><text [^>]*>1<\/text><\/clipPath>/)
    expect(m).toMatch(
      /<g clip-path="url\(#clip0\)"><text [^>]*fill="none" text-anchor="start" stroke="#ff0" stroke-width="0.3"/,
    )
  })

  it('draws no copy for a band lying wholly inside the glyph', () => {
    const m = renderSvgMarkup(text({ inset: 0.2, bands }), { resolveAsset })
    expect(strokes(m)).toEqual([
      ['#f80', '0.6'],
      ['#ff0', '0.4'],
    ])
    expect(m.match(/<text /g)).toHaveLength(3)
    expect(m.match(/paint-order="stroke"/g)).toHaveLength(1)
  })

  it('draws plain text once, unstroked', () => {
    const m = renderSvgMarkup(text(), { resolveAsset })
    expect(strokes(m)).toEqual([])
    expect(m.match(/<text /g)).toHaveLength(1)
  })
})
