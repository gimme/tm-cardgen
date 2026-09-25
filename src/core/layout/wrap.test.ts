import { describe, expect, it } from 'vitest'
import { wrapText } from './wrap.ts'
import { testFonts } from '../../../tests/helpers/fonts.ts'

describe('wrapText', () => {
  const fonts = testFonts()
  const serif = (t: string) => fonts.width(t, 'serif', 2.7)

  it('wraps greedily at word boundaries', () => {
    const lines = wrapText('Increase your plant production 1 step', 30, serif)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.w).toBeLessThanOrEqual(30)
  })

  it('keeps a single short line intact', () => {
    const lines = wrapText('gain 3 plants', 60, serif)
    expect(lines).toHaveLength(1)
  })

  it('gives an overlong word its own line', () => {
    const lines = wrapText('a Supercalifragilisticexpialidocious b', 10, serif)
    expect(lines).toHaveLength(3)
  })

  it('breaks at a newline and still wraps each side of it', () => {
    const lines = wrapText('gain 3 plants\nIncrease your plant production 1 step', 30, serif)
    expect(lines[0].text).toBe('gain 3 plants')
    expect(lines.length).toBeGreaterThan(2)
    for (const line of lines) expect(line.w).toBeLessThanOrEqual(30)
  })

  it('keeps an empty line, and treats a trailing newline as a terminator', () => {
    expect(wrapText('a\n\nb', 60, serif).map((l) => l.text)).toEqual(['a', '', 'b'])
    expect(wrapText('a\nb\n', 60, serif).map((l) => l.text)).toEqual(['a', 'b'])
  })

  it('collapses runs of spaces within a line', () => {
    expect(wrapText('  gain   3  plants ', 60, serif)[0].text).toBe('gain 3 plants')
  })
})
