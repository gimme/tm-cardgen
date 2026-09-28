import { describe, expect, it } from 'vitest'
import type { LayoutContext } from '../../../core/index.ts'
import { NEW_CARD_TEMPLATE } from '../../samples/index.ts'
import { testFonts } from '../../../../tests/helpers/fonts.ts'
import { cachedTile, tileOf } from './tile.ts'

const ctx: LayoutContext = { measurer: testFonts(), artSize: () => undefined }

describe('tileOf', () => {
  it('lays out a valid card', () => {
    const tile = tileOf(NEW_CARD_TEMPLATE, ctx)
    expect(tile.error).toBeUndefined()
    expect(tile.layout?.nodes.length).toBeGreaterThan(0)
  })

  it("keeps the layout's warnings", () => {
    const tile = tileOf(`${NEW_CARD_TEMPLATE}art: missing.png\n`, ctx)
    expect(tile.layout?.warnings.map((w) => w.message)).toContain(
      "art 'missing.png' not found — add it in the Art manager",
    )
  })

  it('gives the first error of a card that does not parse', () => {
    const tile = tileOf('name: [unclosed\n', ctx)
    expect(tile.layout).toBeUndefined()
    expect(tile.error).toMatch(/\S/)
  })
})

describe('cachedTile', () => {
  it('lays a card out again only once its text or the art has changed', () => {
    const first = cachedTile('a', NEW_CARD_TEMPLATE, 0, ctx)
    expect(cachedTile('a', NEW_CARD_TEMPLATE, 0, ctx)).toBe(first)
    expect(cachedTile('a', `${NEW_CARD_TEMPLATE}number: "7"\n`, 0, ctx)).not.toBe(first)
    const again = cachedTile('a', NEW_CARD_TEMPLATE, 0, ctx)
    expect(cachedTile('a', NEW_CARD_TEMPLATE, 1, ctx)).not.toBe(again)
  })
})
