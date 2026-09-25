import { describe, expect, it } from 'vitest'
import { parseRichText } from './richtext.ts'

describe('parseRichText', () => {
  it('reads braces word by word: icons as written, numbers as text', () => {
    const { items, errors } = parseRichText('{titanium} {->} {4 heat} {plant plant plant}')
    expect(errors).toEqual([])
    expect(items.map((i) => i.kind)).toEqual([
      'icon',
      'icon',
      'text',
      'icon',
      'icon',
      'icon',
      'icon',
    ])
    expect(items[0]).toMatchObject({ kind: 'icon', name: 'titanium', red: false })
    expect(items[2]).toMatchObject({ kind: 'text', text: '4', big: true })
    expect(items[3]).toMatchObject({ kind: 'icon', name: 'heat' })
    expect(items[3]).not.toHaveProperty('inscription')
    expect(items.slice(4).map((i) => i.kind === 'icon' && i.name)).toEqual([
      'plant',
      'plant',
      'plant',
    ])
  })

  it('records exact offsets for each word inside the braces', () => {
    const src = '{titanium} {OR STEAL 3 plant}'
    const { items } = parseRichText(src)
    expect(src.slice(items[0].start, items[0].end)).toBe('titanium')
    expect(items[1]).toMatchObject({ kind: 'text', text: 'OR STEAL 3' })
    expect(src.slice(items[1].start, items[1].end)).toBe('OR STEAL 3')
    expect(src.slice(items[2].start, items[2].end)).toBe('plant')
  })

  it('reads braces holding no icon as one run of text at the count size', () => {
    const src = '{OR 3} {microbe} {3} {-12°C}'
    const { items, errors } = parseRichText(src)
    expect(errors).toEqual([])
    expect(items.map((i) => i.kind)).toEqual(['text', 'icon', 'text', 'text'])
    expect(items[0]).toMatchObject({ kind: 'text', text: 'OR 3', big: true })
    expect(src.slice(items[0].start, items[0].end)).toBe('OR 3')
    expect(items[2]).toMatchObject({ kind: 'text', text: '3' })
    expect(items[3]).toMatchObject({ kind: 'text', text: '-12°C' })
    expect(parseRichText('MOVE').items[0]).toMatchObject({ kind: 'text', text: 'MOVE', big: false })
  })

  it('inscribes the count attached to mc, and halos the icon right after red', () => {
    const src = '{OR STEAL red 3mc} {X microbe} {STEAL 2} {red steel} {red plant red plant} {-2mc}'
    const { items, errors, warnings } = parseRichText(src)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(items[0]).toMatchObject({ kind: 'text', text: 'OR STEAL' })
    expect(items[1]).toMatchObject({ name: 'mc', inscription: '3', red: true })
    expect(src.slice(items[1].start, items[1].end)).toBe('3mc')
    expect(items[2]).toMatchObject({ kind: 'text', text: 'X' })
    expect(items[3]).toMatchObject({ name: 'microbe', red: false })
    expect(items[4]).toMatchObject({ kind: 'text', text: 'STEAL 2' })
    expect(items[5]).toMatchObject({ name: 'steel', red: true })
    expect(items[6]).toMatchObject({ name: 'plant', red: true })
    expect(items[7]).toMatchObject({ name: 'plant', red: true })
    expect(items[8]).toMatchObject({ name: 'mc', inscription: '-2', red: false })
    expect(parseRichText('{Xmc}').items[0]).toMatchObject({ name: 'mc', inscription: 'X' })
    expect(parseRichText('{red 3mc}').errors).toEqual([])
    expect(parseRichText('{red}').errors[0].message).toContain('needs an icon')
    // red marks one icon, the one right after it, and never reaches past its braces
    expect(parseRichText('{plant plant red}').errors[0].message).toContain('right after it')
    expect(parseRichText('{red 3 plant}').errors[0].message).toContain('right after it')
    expect(parseRichText('{red} {plant}').errors[0].message).toContain('needs an icon')
    for (const src of ['{red *}', '{red ->}', '{red oxygen}'])
      expect(parseRichText(src).errors[0].message, src).toContain('takes no halo')
    expect(parseRichText('{city big}').errors[0].message).toContain("unknown icon 'big'")
    // a name the registry inherits from Object is no icon either
    expect(parseRichText('{toString}').errors[0].message).toContain("unknown icon 'toString'")
    expect(parseRichText('{plant rde}').errors[0].message).toContain("did you mean 'red'?")
    // a count glued to any other icon is a typo for that icon
    expect(parseRichText('{3plant}').errors[0].message).toContain("did you mean 'plant'?")
  })

  it('warns on a bare mc and keeps it', () => {
    const bare = parseRichText('{mc}')
    expect(bare.errors).toEqual([])
    expect(bare.items[0]).toMatchObject({ name: 'mc' })
    expect(bare.items[0]).not.toHaveProperty('inscription')
    expect(bare.warnings[0].message).toContain("needs its number attached: '3mc'")
    // a number beside it is text like any other, and the coin still warns
    const split = '{STEAL 3 red mc}'
    const { items, warnings } = parseRichText(split)
    expect(items).toMatchObject([
      { kind: 'text', text: 'STEAL 3' },
      { name: 'mc', red: true },
    ])
    expect(split.slice(warnings[0].start, warnings[0].end)).toBe('mc')
  })

  it('stamps every item with the braces it was written in', () => {
    const { items } = parseRichText('{4 plant} {plant} MOVE (rules)')
    expect(items).toMatchObject([
      { kind: 'text', text: '4', group: 0 },
      { kind: 'icon', name: 'plant', group: 0 },
      { kind: 'icon', name: 'plant', group: 10 },
      { kind: 'text', text: 'MOVE' },
      { kind: 'rules' },
    ])
    expect(items[3]).not.toHaveProperty('group')
  })

  it('reads a spacer: a signed width with the mm unit attached', () => {
    const { items, errors } = parseRichText('{2mm} {-1.5mm} {.5mm plant} {+2mm}')
    expect(errors).toEqual([])
    expect(items).toMatchObject([
      { kind: 'spacer', w: 2 },
      { kind: 'spacer', w: -1.5 },
      { kind: 'spacer', w: 0.5 },
      { kind: 'icon', name: 'plant' },
      { kind: 'spacer', w: 2 },
    ])
    // the unit is lowercase and glued on: these are errors, with hints
    expect(parseRichText('{3 mm}').errors[0].message).toContain("one word: '3mm'")
    expect(parseRichText('{gap 3}').errors[0].message).toContain("unknown icon 'gap'")
  })

  it('reads a symbol standing alone in its word as an operator, in a word as text', () => {
    const src = '{titanium} {:} {+ 1mc} {- 5mc} {+/-2} {ocean / temperature} {=}'
    const { items, errors, warnings } = parseRichText(src)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(items).toMatchObject([
      { kind: 'icon', name: 'titanium' },
      { kind: 'op', op: ':' },
      { kind: 'op', op: '+', group: 15 },
      { kind: 'icon', name: 'mc', inscription: '1', group: 15 },
      { kind: 'op', op: '-' },
      { kind: 'icon', name: 'mc', inscription: '5' },
      { kind: 'text', text: '+/-2', big: true },
      { kind: 'icon', name: 'ocean' },
      { kind: 'op', op: '/' },
      { kind: 'icon', name: 'temperature' },
      { kind: 'op', op: '=' },
    ])
    expect(src.slice(items[2].start, items[2].end)).toBe('+')
    // an operator is no icon for red to halo
    expect(parseRichText('{red +}').errors[0].message).toContain('needs an icon')
    // bare, it is directive text, with a hint
    const bare = parseRichText('{titanium} : {1mc}')
    expect(bare.items[1]).toMatchObject({ kind: 'text', text: ':', big: false })
    expect(bare.warnings[0].message).toContain("written '{:}'")
  })

  it('reserves lowercase for icon names: a misspelt one is an error on that word', () => {
    const src = '{titanium} {OR platn}'
    const { errors } = parseRichText(src)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("did you mean 'plant'?")
    expect(src.slice(errors[0].start, errors[0].end)).toBe('platn')
    expect(parseRichText('{3 platn}').errors[0].message).toContain("unknown icon 'platn'")
    expect(parseRichText('{Or}').errors[0].message).toContain('CAPS')
  })

  it('has no escapes: a doubled bracket is two brackets', () => {
    // rules text may open with an aside; the inner pair is part of the text
    const { items, errors } = parseRichText('((twice) more) {plant}')
    expect(errors).toEqual([])
    expect(items[0]).toMatchObject({ kind: 'rules', text: '((twice) more)' })
    expect(items[1]).toMatchObject({ kind: 'icon', name: 'plant' })
    // and a doubled brace is an unknown token plus a stray brace, not text
    const bad = parseRichText('play {{now}}')
    expect(bad.errors.map((e) => e.message)).toEqual([
      expect.stringContaining("unknown icon '{now'"),
      expect.stringContaining("stray '}'"),
    ])
  })

  it('parses a production box: a stack, painted, one line per |', () => {
    const src = '[{2mc} | {plant plant}] {2 plant}'
    const { items, errors } = parseRichText(src)
    expect(errors).toEqual([])
    expect(items).toHaveLength(3)
    const box = items[0]
    expect(box).toMatchObject({ kind: 'stack', box: true })
    if (box.kind === 'stack') {
      expect(box.items).toMatchObject([
        { kind: 'icon', name: 'mc', inscription: '2' },
        { kind: 'break' },
        { name: 'plant' },
        { name: 'plant' },
      ])
      expect(box.items[1]).not.toHaveProperty('gap')
      expect(src.slice(box.start, box.end)).toBe('[{2mc} | {plant plant}]')
    }
  })

  it('parses a bare stack in angle brackets, its lines rows in their own right', () => {
    const src = '<{plant} | {steel} {->} [{2mc}]> {->} {7mc}'
    const { items, errors } = parseRichText(src)
    expect(errors).toEqual([])
    expect(items.map((i) => i.kind)).toEqual(['stack', 'icon', 'icon'])
    const stack = items[0]
    expect(stack).toMatchObject({ kind: 'stack', box: false })
    if (stack.kind === 'stack') {
      expect(stack.items.map((i) => i.kind)).toEqual(['icon', 'break', 'icon', 'icon', 'stack'])
      expect(stack.items[4]).toMatchObject({ kind: 'stack', box: true })
      expect(src.slice(stack.start, stack.end)).toBe('<{plant} | {steel} {->} [{2mc}]>')
    }
    // stacks nest either way round, and a nested one may close its parent
    expect(parseRichText('[[{plant}] | <{steel}>]').errors).toEqual([])
    const nested = parseRichText('<<{plant}> | <{steel}>>')
    expect(nested.errors).toEqual([])
    expect(nested.items).toHaveLength(1)
    expect(nested.items[0]).toMatchObject({
      kind: 'stack',
      items: [{ kind: 'stack' }, { kind: 'break' }, { kind: 'stack' }],
    })
  })

  it('breaks lines at a bare |, with its own gap as |3mm|', () => {
    const src = '{plant} | {steel} |2mm| {heat} | -1.5mm | {2mc}'
    const { items, errors, warnings } = parseRichText(src)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(items).toMatchObject([
      { kind: 'icon', name: 'plant' },
      { kind: 'break' },
      { kind: 'icon', name: 'steel' },
      { kind: 'break', gap: 2 },
      { kind: 'icon', name: 'heat' },
      { kind: 'break', gap: -1.5 },
      { kind: 'icon', name: 'mc' },
    ])
    expect(items[1]).not.toHaveProperty('gap')
    expect(src.slice(items[3].start, items[3].end)).toBe('|2mm|')
    expect(src.slice(items[5].start, items[5].end)).toBe('| -1.5mm |')
    // the gap needs both pipes, and a bare mm word gets its hint too
    expect(parseRichText('{plant} |2mm {steel}').errors[0].message).toContain("'|2mm|'")
    expect(parseRichText('{plant} 2mm {steel}').warnings[0].message).toContain("'{2mm}'")
    expect(parseRichText('{plant} | {2mm} | {steel}').warnings[0].message).toContain('only spacers')
  })

  it('parses the rules text block verbatim, keeping its parentheses and inner pairs', () => {
    const src = '{ocean *} (PLACE THE NOMADS (a gold cube)\n  on the board.)'
    const { items, errors } = parseRichText(src)
    expect(errors).toEqual([])
    // whitespace is left for the layout to read: newlines break lines there
    expect(items[2]).toMatchObject({
      kind: 'rules',
      text: '(PLACE THE NOMADS (a gold cube)\n  on the board.)',
    })
    expect(src.slice(items[2].start, items[2].end)).toBe(
      '(PLACE THE NOMADS (a gold cube)\n  on the board.)',
    )
  })

  it('allows one rules block per line, in a stack too, holding plain text', () => {
    expect(parseRichText('(a) (b)').errors[0].message).toContain('one (rules text) block')
    expect(parseRichText('(a) | (b)').errors).toEqual([])
    expect(parseRichText('<{plant} (a) | (b)> [{2mc} (c)]').errors).toEqual([])
    const inner = parseRichText('(gain {plant})')
    expect(inner.errors[0].message).toContain('plain text')
    expect(inner.errors[0]).toMatchObject({ start: 6, end: 7 })
  })

  it('can turn stacks, rules text and line breaks off per context', () => {
    const { items, errors } = parseRichText('[x] <y> (z)', { stacks: false, rules: false })
    expect(errors).toEqual([])
    expect(items).toMatchObject([{ kind: 'text', text: '[x] <y> (z)', big: false }])
    // a one-line field: the pipe is an error, not a line...
    const one = parseRichText('{plant} | {steel}', { lines: false })
    expect(one.errors[0].message).toContain('one line')
    // ...while a box's own lines are still fine there
    expect(parseRichText('[{plant} | {steel}]', { lines: false }).errors).toEqual([])
  })

  it('reports unclosed tokens with offsets', () => {
    const { errors } = parseRichText('{plant')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ start: 0, end: 6 })
    expect(parseRichText('(open').errors[0].message).toContain('unclosed (')
  })

  it('reports stray closers and recovers from an unclosed stack', () => {
    expect(parseRichText('a } b').errors[0].message).toContain("stray '}'")
    expect(parseRichText('a ) b').errors[0].message).toContain("stray ')'")
    expect(parseRichText('a ] b').errors[0].message).toContain("stray ']'")
    expect(parseRichText('a > b').errors[0].message).toContain("stray '>'")
    const res = parseRichText('[ {plant}')
    expect(res.errors[0].message).toContain("unclosed '['")
    expect(res.items).toMatchObject([{ kind: 'icon', name: 'plant' }])
    expect(parseRichText('<{plant} | {steel}').errors[0].message).toContain("unclosed '<'")
  })

  it('rejects an empty token and an empty stack; an empty line is nothing', () => {
    expect(parseRichText('{}').errors[0].message).toContain('empty token')
    expect(parseRichText('[]').errors[0].message).toContain('empty production box')
    expect(parseRichText('< | >').errors[0].message).toContain('empty stack')
    expect(parseRichText('[{plant} |]').errors).toEqual([])
    expect(parseRichText('| {plant} ||').errors).toEqual([])
  })

  it('gathers the bare words between tokens into one directive run', () => {
    const src = '{->} MOVE THE CUBE {plant}'
    const { items, warnings } = parseRichText(src)
    expect(warnings).toEqual([])
    expect(items).toHaveLength(3)
    expect(items[1]).toMatchObject({ kind: 'text', text: 'MOVE THE CUBE', big: false })
    expect(src.slice(items[1].start, items[1].end)).toBe('MOVE THE CUBE')
  })

  it('hints a lone operator or spacer standing as a run, at an edge too', () => {
    const flagged = (src: string) =>
      parseRichText(src).warnings.map((w) => src.slice(w.start, w.end))
    expect(flagged('{plant} + {heat}')).toEqual(['+'])
    expect(flagged('+ {plant} | {steel} :')).toEqual(['+', ':'])
    expect(flagged('{plant} 3mm {steel}')).toEqual(['3mm'])
    expect(parseRichText('{plant} + {heat}').warnings[0].message).toContain("'{+}'")
    // inside prose a symbol is text, no hint
    expect(flagged('STEEL / TITANIUM')).toEqual([])
    expect(flagged('{plant} + 3mm MORE')).toEqual([])
  })

  it('reads the arrow and the asterisk as icons by their symbol', () => {
    const { items, errors } = parseRichText('{->} {red ocean *} {2 *}')
    expect(errors).toEqual([])
    expect(items.map((i) => (i.kind === 'icon' ? i.name : i.kind))).toEqual([
      '->',
      'ocean',
      '*',
      'text',
      '*',
    ])
    // the asterisk marks the icon or text right before it, in its own braces
    const stray = (src: string) => parseRichText(src).errors[0]?.message
    expect(stray('{* ocean}')).toContain('right before it')
    expect(stray('{ocean} {*}')).toContain('right before it')
    for (const src of ['{+ *}', '{2mm *}', '{ocean * *}'])
      expect(stray(src), src).toContain('right before it')
    // no escapes: a bare arrow's > is a bracket like any other
    expect(parseRichText('{plant} -> {heat}').errors[0].message).toContain("stray '>'")
  })
})
