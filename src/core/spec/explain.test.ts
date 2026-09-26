import { describe, expect, it } from 'vitest'
import { explainAt, ROW_FIELDS, type Explanation } from './explain.ts'
import { ROW_SYNTAX } from './syntax.ts'

/** The explanation for the character after the ‸ in `row`. */
function at(row: string, opts = ROW_FIELDS.body): Explanation | undefined {
  return explainAt(row.replace('‸', ''), row.indexOf('‸'), opts)
}

describe('explainAt', () => {
  it('shows an icon by name, with the number written on it', () => {
    expect(at('{pl‸ant}')).toEqual({ from: 1, to: 6, icon: { name: 'plant' } })
    expect(at('{‸science-tag}')?.icon).toEqual({ name: 'science-tag' })
    expect(at('{2‸5mc}')).toEqual({ from: 1, to: 5, icon: { name: 'mc', inscription: '25' } })
    expect(at('{‸mc}')).toEqual({ from: 1, to: 3, icon: { name: 'mc' } })
    expect(at('{-‸>}')).toEqual({ from: 1, to: 3, icon: { name: '->' } })
    expect(at('[{pl‸ant}]')?.icon).toEqual({ name: 'plant' })
    expect(at('{OR STEAL 3 red pl‸ant}')?.icon).toEqual({ name: 'plant' })
  })

  it('says what the modifiers do', () => {
    expect(at('{r‸ed plant}')).toEqual({
      from: 1,
      to: 4,
      doc: 'Draws the any-player ring around the icon after it',
    })
    expect(at('{plant ‸*}')?.doc).toMatch(/^Attaches the see-rules asterisk/)
    expect(at('{plant} {3m‸m} {plant}')).toEqual({
      from: 9,
      to: 12,
      doc: 'A spacer: 3 mm between its neighbours',
    })
    expect(at('{‸.5mm}')?.doc).toBe('A spacer: 0.5 mm between its neighbours')
    expect(at('{‸-1.5mm}')?.doc).toBe('A spacer: its neighbours overlap by 1.5 mm')
  })

  it('names the brackets and the breaks', () => {
    expect(at('‸[{plant}]')).toEqual({ from: 0, to: 1, doc: ROW_SYNTAX.box.doc })
    expect(at('[{plant}‸]')?.doc).toBe(ROW_SYNTAX.box.doc)
    expect(at('‸<{plant} | {heat}>')?.doc).toBe(ROW_SYNTAX.stack.doc)
    expect(at('<{plant} | {heat}‸>')?.doc).toBe(ROW_SYNTAX.stack.doc)
    expect(at('<{plant} ‸| {heat}>')).toEqual({ from: 9, to: 10, doc: 'A line break' })
    expect(at('{plant} ‸| {plant}')?.doc).toBe('A line break')
    expect(at('{plant} |3‸mm| {plant}')).toEqual({
      from: 8,
      to: 13,
      doc: 'A line break: 3 mm between the lines',
    })
    expect(at('{plant} ‸|3mm| {plant}')?.doc).toMatch(/3 mm/)
    expect(at('{plant} | -1mm ‸| {plant}')?.doc).toBe('A line break: the lines overlap by 1 mm')
  })

  it('is silent on everything that shows what it is', () => {
    // numbers, keywords and unknown words in braces: the linter hints at those
    expect(at('{‸3 plant}')).toBeUndefined()
    expect(at('{STEA‸L 2}')).toBeUndefined()
    expect(at('{pl‸a}')).toBeUndefined()
    // operators and braces
    expect(at('{city ‸: 2mc}')).toBeUndefined()
    expect(at('‸{plant}')).toBeUndefined()
    expect(at('{plant‸}')).toBeUndefined()
    // rules text and bare words, and the space between tokens
    expect(at('{plant} (Gain a ‸plant.)')).toBeUndefined()
    expect(at('OPPONENTS M‸AY NOT {plant}')).toBeUndefined()
    expect(at('{plant}‸ {plant}')).toBeUndefined()
    expect(at('{plant ‸ plant}')).toBeUndefined()
    expect(at('{plant} ‸')).toBeUndefined()
    expect(explainAt('{plant}', 7)).toBeUndefined()
    expect(explainAt('{plant}', -1)).toBeUndefined()
  })

  it('reads a broken row as far as it goes', () => {
    expect(at('{pl‸ant')?.icon).toEqual({ name: 'plant' })
    expect(at('{plant} {r‸ed')?.doc).toMatch(/any-player/)
    expect(at('‸[{plant}')?.doc).toBe(ROW_SYNTAX.box.doc)
    // braces in rules text are an error, not icons; an unclosed one runs to the end
    expect(at('(Gain a {pl‸ant}.)')).toBeUndefined()
    expect(at('(Gain a {pl‸ant}.')).toBeUndefined()
    // a half-written gap is an error the linter explains
    expect(at('{plant} ‸|3mm {plant}')).toBeUndefined()
  })

  it('reads the requirement and the disc by their own rules', () => {
    const req = ROW_FIELDS.requirement
    expect(at('max 6% {oxy‸gen}', req)?.icon).toEqual({ name: 'oxygen' })
    expect(at('m‸ax 6% {oxygen}', req)).toEqual({
      from: 0,
      to: 3,
      doc: 'Makes the requirement an upper limit',
    })
    expect(at(' ‸max 6% {oxygen}', req)?.doc).toMatch(/upper limit/)
    // only a leading max is the keyword
    expect(at('6% {oxygen} m‸ax', req)).toBeUndefined()
    expect(at('m‸ax 6% {oxygen}')).toBeUndefined()
    // no rules text there: a parenthesis is a word, not an unclosed block
    expect(at('(x {oxy‸gen}', req)?.icon).toEqual({ name: 'oxygen' })
    expect(at('(x {oxy‸gen}')).toBeUndefined()
    // one line: a break is an error, except inside a box
    expect(at('{plant} ‸| {heat}', req)).toBeUndefined()
    expect(at('[{plant} ‸| {heat}]', req)?.doc).toBe('A line break')
    expect(at('‸[{plant}]', req)?.doc).toBe(ROW_SYNTAX.box.doc)
    const vp = ROW_FIELDS.vp
    expect(at('1 {/ 2 mic‸robe}', vp)?.icon).toEqual({ name: 'microbe' })
    expect(at('‸1 {/ 2 microbe}', vp)).toBeUndefined()
    // nor boxes: the brackets are words there
    expect(at('1 ‸[x]', vp)).toBeUndefined()
    expect(at('1 ‸| 2', vp)).toBeUndefined()
  })
})
