import { describe, expect, it } from 'vitest'
import { parseCardYaml } from './parse.ts'
import { validateCard } from './validate.ts'

function check(source: string) {
  const { doc, syntaxErrors } = parseCardYaml(source)
  expect(syntaxErrors).toEqual([])
  return validateCard(doc, source)
}

const MINIMAL = 'name: Test Card\n'

describe('validateCard', () => {
  it('accepts a minimal card', () => {
    const { diagnostics, spec } = check(MINIMAL)
    expect(diagnostics).toEqual([])
    expect(spec).toMatchObject({ name: 'Test Card', type: 'automated', body: [] })
  })

  it('derives the type: active rows make blue, an event tag red', () => {
    expect(check(MINIMAL + 'active:\n  - "{plant}"\n').spec?.type).toBe('active')
    expect(check(MINIMAL + 'active:\n').spec).toMatchObject({ type: 'active', active: [] })
    expect(check(MINIMAL + 'tags: [space, event]\n').spec?.type).toBe('event')
    const both = check(MINIMAL + 'tags: [event]\nactive: []\n')
    expect(both.spec?.type).toBe('active')
    expect(both.diagnostics[0]).toMatchObject({ severity: 'warning' })
    expect(both.diagnostics[0].message).toContain('the card is blue')
  })

  it('squiggles exactly the bad token with a suggestion', () => {
    const source = MINIMAL + 'body:\n  - "{platn}"\n'
    const { diagnostics, spec } = check(source)
    expect(spec).toBeUndefined()
    expect(diagnostics).toHaveLength(1)
    const d = diagnostics[0]
    expect(d.message).toContain("did you mean 'plant'?")
    expect(source.slice(d.from, d.to)).toBe('platn')
  })

  it('accepts CAPS text in braces', () => {
    const { diagnostics, spec } = check(MINIMAL + 'body:\n  - "{OR 3} {microbe}"\n')
    expect(diagnostics).toEqual([])
    expect(spec?.body[0][0]).toMatchObject({ kind: 'text', text: 'OR 3' })
  })

  it('flags unknown top-level fields as warnings with suggestions', () => {
    const source = MINIMAL + 'flavour: nope\n'
    const { diagnostics, spec } = check(source)
    expect(spec).toBeDefined()
    expect(diagnostics[0]).toMatchObject({ severity: 'warning' })
    expect(diagnostics[0].message).toContain("did you mean 'flavor'?")
    expect(source.slice(diagnostics[0].from, diagnostics[0].to)).toBe('flavour')
  })

  it('warns on a flavor that ends in a period, squiggling the period', () => {
    const source = MINIMAL + 'flavor: Life finds a way.\n'
    const { diagnostics, spec } = check(source)
    expect(spec?.flavor).toBe('Life finds a way.')
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ severity: 'warning' })
    expect(diagnostics[0].message).toContain('period')
    expect(source.slice(diagnostics[0].from, diagnostics[0].to)).toBe('.')
    expect(check(MINIMAL + 'flavor: Life finds a way\n').diagnostics).toEqual([])
    expect(check(MINIMAL + 'flavor: Life finds a way...\n').diagnostics).toEqual([])
  })

  it('ranges point at the offending tag', () => {
    const source = MINIMAL + 'tags: [building, spaace]\n'
    const { diagnostics } = check(source)
    expect(diagnostics).toHaveLength(1)
    expect(source.slice(diagnostics[0].from, diagnostics[0].to)).toBe('spaace')
    expect(diagnostics[0].message).toContain("did you mean 'space'?")
  })

  it('parses requirements with max flag', () => {
    const { spec } = check(MINIMAL + 'requirement: "max 6% {oxygen}"\n')
    expect(spec?.requirement?.max).toBe(true)
  })

  it('maps token offsets inside block scalars conservatively', () => {
    const source = MINIMAL + 'body:\n  - >-\n      {platn}\n      more\n'
    const { diagnostics } = check(source)
    expect(diagnostics.length).toBeGreaterThan(0)
    // exact or whole-scalar, never outside the scalar
    expect(diagnostics[0].from).toBeGreaterThanOrEqual(source.indexOf('>-'))
  })

  it('takes rows as strings, or the whole flow as one string', () => {
    const { diagnostics } = check(MINIMAL + 'body:\n  - content: "{plant}"\n')
    expect(diagnostics[0].message).toContain('rows are strings')
    const one = check(MINIMAL + 'body: "{plant} | (Gain a plant.)"\n')
    expect(one.diagnostics).toEqual([])
    expect(one.spec?.body.map((r) => r.map((i) => i.kind))).toEqual([['icon', 'break', 'rules']])
    expect(check(MINIMAL + 'body: 5\n').diagnostics[0].message).toContain('list of row strings')
  })

  it('parses rows into their elements', () => {
    const { diagnostics, spec } = check(
      MINIMAL + 'body:\n  - "[{2mc} | {3 plant}] {plant plant}"\n  - "(Gain 2 plants.)"\n',
    )
    expect(diagnostics).toEqual([])
    expect(spec?.body.map((row) => row.map((i) => i.kind))).toEqual([
      ['stack', 'icon', 'icon'],
      ['rules'],
    ])
  })

  it('keeps the spec on a bare mc, with a warning naming the numbered coin', () => {
    const source = MINIMAL + 'body:\n  - "{mc}"\n'
    const { diagnostics, spec } = check(source)
    expect(spec?.body[0]).toMatchObject([{ kind: 'icon', name: 'mc' }])
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ severity: 'warning' })
    expect(diagnostics[0].message).toContain("'3mc'")
    expect(source.slice(diagnostics[0].from, diagnostics[0].to)).toBe('mc')
  })

  it('rejects the retired icon size flags', () => {
    const { diagnostics } = check(MINIMAL + 'body:\n  - "{city big}"\n')
    expect(diagnostics[0].message).toContain("unknown icon 'big'")
  })

  it('pads an integer card number to three digits', () => {
    expect(check(MINIMAL + 'number: 55\n').spec?.number).toBe('055')
    expect(check(MINIMAL + 'number: 5\n').spec?.number).toBe('005')
    expect(check(MINIMAL + 'number: 1234\n').spec?.number).toBe('1234')
    expect(check(MINIMAL + 'number: "55"\n').spec?.number).toBe('55')
    expect(check(MINIMAL + 'number: "?01"\n').spec?.number).toBe('?01')
    expect(check(MINIMAL + 'number: -5\n').diagnostics[0].message).toContain('non-negative')
    expect(check(MINIMAL + 'number: 5.5\n').diagnostics[0].message).toContain('integer')
  })

  it('validates vp rows against the icon registry, and hints at a numeral hidden in braces', () => {
    const { diagnostics } = check(MINIMAL + 'vp: "{1 / jovain-tag}"\n')
    expect(diagnostics[0].message).toContain("did you mean 'jovian-tag'?")
    const hidden = check(MINIMAL + 'vp: "{1 / 2 microbe}"\n')
    expect(hidden.diagnostics[0]).toMatchObject({ severity: 'warning' })
    expect(hidden.diagnostics[0].message).toContain('outside the braces')
    expect(hidden.spec?.vp).toHaveLength(4)
    expect(check(MINIMAL + 'vp: -1\n').spec?.vp).toMatchObject([{ kind: 'text', text: '-1' }])
    expect(check(MINIMAL + 'vp: 1.5\n').diagnostics[0].message).toContain('integer')
    expect(check(MINIMAL + 'vp: [1]\n').diagnostics[0].message).toContain('integer')
  })

  it('reports yaml syntax errors from the parser', () => {
    const { syntaxErrors } = parseCardYaml('name: [unclosed\n')
    expect(syntaxErrors.length).toBeGreaterThan(0)
    expect(syntaxErrors[0].from).toBeGreaterThanOrEqual(0)
  })
})
