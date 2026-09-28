import { describe, expect, it } from 'vitest'
import { extended, NO_SELECTION, toggled, without, type Selection } from './selection.ts'

const order = ['a', 'b', 'c', 'd', 'e']
const ids = (sel: Selection) => [...sel.ids].sort()

describe('toggled', () => {
  it('adds a card, then takes it out, anchoring on it both times', () => {
    const one = toggled(NO_SELECTION, 'b')
    expect(ids(one)).toEqual(['b'])
    expect(one.anchor).toBe('b')
    const none = toggled(toggled(one, 'd'), 'b')
    expect(ids(none)).toEqual(['d'])
    expect(none.anchor).toBe('b')
  })
})

describe('extended', () => {
  it('adds the range from the anchor, either way, keeping what was selected', () => {
    const sel = toggled(toggled(NO_SELECTION, 'a'), 'd')
    expect(ids(extended(sel, order, 'b'))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(extended(sel, order, 'e'))).toEqual(['a', 'd', 'e'])
    expect(extended(sel, order, 'b').anchor).toBe('d')
  })

  it('without an anchor, adds the card alone and anchors on it', () => {
    const sel = extended(NO_SELECTION, order, 'c')
    expect(ids(sel)).toEqual(['c'])
    expect(sel.anchor).toBe('c')
  })
})

describe('without', () => {
  it('drops the cards that are gone, and an anchor among them', () => {
    const sel = toggled(toggled(NO_SELECTION, 'a'), 'c')
    expect(ids(without(sel, ['c']))).toEqual(['a'])
    expect(without(sel, ['c']).anchor).toBeUndefined()
    expect(without(sel, ['a']).anchor).toBe('c')
  })
})
