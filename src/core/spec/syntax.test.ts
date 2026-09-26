import { describe, expect, it } from 'vitest'
import { ICON_NAMES } from '../icons.ts'
import { iconSample } from '../layout/chunks.ts'
import { renderSvgMarkup } from '../render/svgString.ts'
import { parseRichText } from './richtext.ts'
import { ICON_GROUPS, RICH_TEXT_SYNTAX } from './syntax.ts'

describe('RICH_TEXT_SYNTAX', () => {
  it.each(Object.values(RICH_TEXT_SYNTAX))('$form parses clean', ({ form, doc }) => {
    const { errors, warnings } = parseRichText(form)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    // the doc's code spans are paired backticks
    expect((doc.match(/`/g) ?? []).length % 2).toBe(0)
  })
})

describe('ICON_GROUPS', () => {
  it('lists every icon spelt as a word once; the marks are in the table', () => {
    const listed = ICON_GROUPS.flatMap((g) => g.names)
    const words = ICON_NAMES.filter((n) => /^[a-z]/.test(n))
    expect([...listed].sort()).toEqual([...words].sort())
    for (const mark of ICON_NAMES.filter((n) => !/^[a-z]/.test(n)))
      expect(Object.values(RICH_TEXT_SYNTAX).some((r) => r.form.includes(mark))).toBe(true)
  })

  it('draws each icon on its own', () => {
    for (const name of ICON_NAMES) {
      const chunk = iconSample(name)
      expect(chunk.h).toBeGreaterThan(0)
      const markup = renderSvgMarkup(chunk, {
        resolveAsset: (ref) => (ref.type === 'asset' ? ref.path : ''),
      })
      expect(markup).toMatch(/<(image|path|g)/)
    }
  })

  it('shows the coin with an X where its number goes', () => {
    const texts = iconSample('mc').nodes.filter((n) => n.kind === 'text')
    expect(texts.map((n) => n.text)).toEqual(['X'])
    expect(iconSample('plant').nodes.some((n) => n.kind === 'text')).toBe(false)
  })
})
