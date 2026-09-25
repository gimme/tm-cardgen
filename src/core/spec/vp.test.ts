import { describe, expect, it } from 'vitest'
import { parseVp } from './vp.ts'

describe('parseVp', () => {
  it('reads an integer as the numeral alone in the disc', () => {
    expect(parseVp(2).vp).toMatchObject([{ kind: 'text', text: '2', big: false }])
    expect(parseVp(-1).vp).toMatchObject([{ kind: 'text', text: '-1', big: false }])
    expect(parseVp('3').vp).toMatchObject([{ kind: 'text', text: '3', big: false }])
    expect(parseVp('-1').warnings).toEqual([])
  })

  it('reads a row: the bare numeral, then the braces as in any row', () => {
    const { vp, warnings } = parseVp('1 {/ 2 microbe}')
    expect(warnings).toEqual([])
    expect(vp).toMatchObject([
      { kind: 'text', text: '1', big: false },
      { kind: 'op', op: '/' },
      { kind: 'text', text: '2', big: true },
      { kind: 'icon', name: 'microbe' },
    ])
    expect(parseVp('1 {/ jovian-tag}').vp).toMatchObject([
      { kind: 'text', text: '1', big: false },
      { kind: 'op', op: '/' },
      { kind: 'icon', name: 'jovian-tag' },
    ])
  })

  it('hints when no numeral stands outside the braces', () => {
    const src = '{1 / 2 microbe}'
    const { vp, warnings } = parseVp(src)
    expect(vp).toHaveLength(4)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('outside the braces')
    expect(warnings[0]).toMatchObject({ start: 0, end: src.length })
  })

  it('rejects malformed values', () => {
    const message = (value: unknown) => parseVp(value).errors[0]?.message
    expect(message(1.5)).toContain('integer or a row')
    expect(message(null)).toContain('integer or a row')
    expect(message('')).toContain('integer or a row')
    expect(message('{1 / a}')).toContain("unknown icon 'a'")
    expect(message('{1} | {2}')).toContain('one line')
    expect(parseVp('{1 / a}').vp).toBeUndefined()
  })
})
