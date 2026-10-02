import { describe, expect, it } from 'vitest'
import { dropped, edgeScroll, gapAt, heldSlots, nearestSlot } from './drag.ts'

// three to a row, 100 × 140 with 20 between, the last row short
const size = { x: 100, y: 140 }
const slots = [0, 1, 2, 3, 4].map((i) => ({ x: (i % 3) * 120, y: Math.floor(i / 3) * 160 }))
const order = ['a', 'b', 'c', 'd', 'e']

describe('nearestSlot', () => {
  it('picks the slot a point is over, and the nearer one in the gap between', () => {
    expect(nearestSlot(slots, size, { x: 50, y: 70 })).toBe(0)
    expect(nearestSlot(slots, size, { x: 108, y: 70 })).toBe(0)
    expect(nearestSlot(slots, size, { x: 112, y: 70 })).toBe(1)
    expect(nearestSlot(slots, size, { x: 170, y: 245 })).toBe(4)
  })

  it('picks the nearest slot for a point past the grid', () => {
    expect(nearestSlot(slots, size, { x: -500, y: -500 })).toBe(0)
    // beside the short last row, under the last of the row above
    expect(nearestSlot(slots, size, { x: 290, y: 280 })).toBe(4)
    expect(nearestSlot(slots, size, { x: 290, y: 180 })).toBe(2)
  })
})

describe('gapAt', () => {
  it('opens the gap at the slot, but no later than the end of the rest', () => {
    expect(gapAt(0, 5, 1)).toBe(0)
    expect(gapAt(4, 5, 1)).toBe(4)
    expect(gapAt(2, 5, 3)).toBe(2)
    expect(gapAt(4, 5, 3)).toBe(2)
  })
})

describe('heldSlots', () => {
  it('closes up over a dragged card and opens the gap', () => {
    // c out, held over b's place
    expect(heldSlots(order, new Set(['c']), 1)).toEqual([0, 2, undefined, 3, 4])
    // held where it was, nothing moves
    expect(heldSlots(order, new Set(['c']), 2)).toEqual([0, 1, undefined, 3, 4])
    // held at the end
    expect(heldSlots(order, new Set(['a']), 4)).toEqual([undefined, 0, 1, 2, 3])
  })

  it('leaves one gap for several dragged cards', () => {
    expect(heldSlots(order, new Set(['a', 'c']), 1)).toEqual([undefined, 0, undefined, 2, 3])
  })
})

describe('dropped', () => {
  it('puts the dragged cards at the gap, in the order they had', () => {
    expect(dropped(order, new Set(['c']), 0)).toEqual(['c', 'a', 'b', 'd', 'e'])
    expect(dropped(order, new Set(['a']), 4)).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(dropped(order, new Set(['e', 'b']), 1)).toEqual(['a', 'b', 'e', 'c', 'd'])
  })

  it('leaves the order alone for a card dropped where it was', () => {
    expect(dropped(order, new Set(['c']), 2)).toEqual(order)
    expect(dropped(order, new Set(['b', 'c']), 1)).toEqual(order)
  })
})

describe('edgeScroll', () => {
  const at = (y: number) => edgeScroll(y, 100, 700, 50, 20)

  it('scrolls only near an edge, faster nearer it, and at full speed past it', () => {
    expect(at(400)).toBe(0)
    expect(at(150)).toBe(0)
    expect(at(125)).toBe(-10)
    expect(at(100)).toBe(-20)
    expect(at(0)).toBe(-20)
    expect(at(675)).toBe(10)
    expect(at(900)).toBe(20)
  })
})
