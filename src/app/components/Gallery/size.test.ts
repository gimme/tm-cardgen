import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_WIDTH, stopOf, storedWidth, storeWidth, widthAt, widthFrom } from './size.ts'

describe('the stops', () => {
  const { min, max, steps, initial } = CARD_WIDTH
  const widths = Array.from({ length: steps + 1 }, (_, i) => widthAt(i))

  it('run from the smallest width to the largest', () => {
    expect(widths[0]).toBe(min)
    expect(widths[steps]).toBe(max)
  })

  it('grow by one ratio', () => {
    const ratios = widths.slice(1).map((w, i) => w / widths[i]!)
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0]!, 1)
  })

  it('put the initial width in the middle', () => {
    expect(stopOf(initial)).toBe(steps / 2)
  })

  it('are each their own nearest stop', () => {
    widths.forEach((w, i) => expect(stopOf(w)).toBe(i))
  })
})

describe('widthFrom', () => {
  it('keeps a width on the slider', () => {
    expect(widthFrom('305')).toBe(305)
  })

  it('starts at the initial width without one', () => {
    expect(widthFrom(null)).toBe(CARD_WIDTH.initial)
    expect(widthFrom('')).toBe(CARD_WIDTH.initial)
    expect(widthFrom('big')).toBe(CARD_WIDTH.initial)
    expect(widthFrom('0')).toBe(CARD_WIDTH.initial)
  })

  it('brings a width back onto the slider', () => {
    expect(widthFrom('20')).toBe(CARD_WIDTH.min)
    expect(widthFrom('9000')).toBe(CARD_WIDTH.max)
    expect(widthFrom('290')).toBe(284)
    expect(widthFrom('300')).toBe(305)
  })
})

describe('storeWidth', () => {
  const kept = new Map<string, string>()
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => kept.set(k, v),
      removeItem: (k: string) => kept.delete(k),
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    kept.clear()
  })

  it('keeps a picked width', () => {
    storeWidth(CARD_WIDTH.max)
    expect(storedWidth()).toBe(CARD_WIDTH.max)
  })

  it('keeps nothing for the initial width', () => {
    storeWidth(CARD_WIDTH.max)
    storeWidth(CARD_WIDTH.initial)
    expect(kept.size).toBe(0)
    expect(storedWidth()).toBe(CARD_WIDTH.initial)
  })
})
