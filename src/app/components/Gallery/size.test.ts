import { describe, expect, it } from 'vitest'
import { CARD_WIDTH, widthFrom } from './size.ts'

describe('widthFrom', () => {
  it('keeps a width on the slider', () => {
    expect(widthFrom('320')).toBe(320)
  })

  it('starts at the initial width without one', () => {
    expect(widthFrom(null)).toBe(CARD_WIDTH.initial)
    expect(widthFrom('')).toBe(CARD_WIDTH.initial)
    expect(widthFrom('big')).toBe(CARD_WIDTH.initial)
  })

  it('brings a width back onto the slider', () => {
    expect(widthFrom('20')).toBe(CARD_WIDTH.min)
    expect(widthFrom('9000')).toBe(CARD_WIDTH.max)
    expect(widthFrom('254')).toBe(250)
    expect(widthFrom('256')).toBe(260)
  })
})
