import { describe, expect, it } from 'vitest'
import { explainAt, ROW_FIELDS, type Explanation } from './explain.ts'
import { ROW_SYNTAX } from './syntax.ts'

/** The explanation for the character after the ‸ in `row`. */
function at(row: string, opts = ROW_FIELDS.body): Explanation | undefined {
  return explainAt(row.replace('‸', ''), row.indexOf('‸'), opts)
}

describe('explainAt', () => {
  it('shows an icon by name, with the number written on it', () => {
    expect(at('{pl‸ant}')).toEqual({ from: 1, to: 6, doc: '`plant`', icon: { name: 'plant' } })
    expect(at('{‸science-tag}')?.icon).toEqual({ name: 'science-tag' })
    expect(at('{2‸5mc}')).toEqual({
      from: 1,
      to: 5,
      doc: ROW_SYNTAX.coin.doc,
      icon: { name: 'mc', inscription: '25' },
    })
    expect(at('{‸mc}')).toEqual({ from: 1, to: 3, doc: ROW_SYNTAX.coin.doc, icon: { name: 'mc' } })
    expect(at('{-‸>}')).toEqual({ from: 1, to: 3, doc: ROW_SYNTAX.arrow.doc, icon: { name: '->' } })
  })

  it("explains the other words in braces in the cheat sheet's words", () => {
    expect(at('{r‸ed plant}')).toEqual({ from: 1, to: 4, doc: ROW_SYNTAX.red.doc })
    expect(at('{plant ‸*}')?.doc).toBe(ROW_SYNTAX.note.doc)
    expect(at('{city ‸: 2mc}')?.doc).toBe(ROW_SYNTAX.operator.doc)
    expect(at('{plant} {3m‸m} {plant}')).toEqual({ from: 9, to: 12, doc: ROW_SYNTAX.spacer.doc })
    expect(at('{‸3 plant}')?.doc).toBe(ROW_SYNTAX.big.doc)
    expect(at('{STEA‸L 2}')?.doc).toBe(ROW_SYNTAX.big.doc)
    // an unknown word gets the CAPS rule, as the linter's hint does
    expect(at('{pl‸a}')?.doc).toBe(ROW_SYNTAX.big.doc)
  })

  it('explains the brackets', () => {
    expect(at('‸{plant}')).toEqual({ from: 0, to: 7, doc: ROW_SYNTAX.icon.doc })
    expect(at('{plant‸}')).toEqual({ from: 0, to: 7, doc: ROW_SYNTAX.icon.doc })
    expect(at('‸{plant plant}')?.doc).toBe(ROW_SYNTAX.group.doc)
    expect(at('‸[{plant}]')).toEqual({ from: 0, to: 1, doc: ROW_SYNTAX.box.doc })
    expect(at('[{plant}‸]')?.doc).toBe(ROW_SYNTAX.box.doc)
    expect(at('[{pl‸ant}]')?.icon).toEqual({ name: 'plant' })
    expect(at('‸<{plant} | {heat}>')?.doc).toBe(ROW_SYNTAX.stack.doc)
    expect(at('<{plant} ‸| {heat}>')).toEqual({ from: 9, to: 10, doc: ROW_SYNTAX.line.doc })
    expect(at('{plant} ‸| {plant}')?.doc).toBe(ROW_SYNTAX.line.doc)
    expect(at('{plant} |3‸mm| {plant}')).toEqual({ from: 8, to: 13, doc: ROW_SYNTAX.gap.doc })
    expect(at('{plant} ‸|3mm| {plant}')?.doc).toBe(ROW_SYNTAX.gap.doc)
  })

  it('explains rules text as a whole and bare words one by one', () => {
    expect(at('{plant} (Gain a ‸plant.)')).toEqual({ from: 8, to: 23, doc: ROW_SYNTAX.rules.doc })
    expect(at('(Gain a plant.‸)')?.doc).toBe(ROW_SYNTAX.rules.doc)
    expect(at('OPPONENTS M‸AY NOT {plant}')).toEqual({
      from: 10,
      to: 13,
      doc: ROW_SYNTAX.words.doc,
    })
    expect(at('MA‸Y{plant}')).toEqual({ from: 0, to: 3, doc: ROW_SYNTAX.words.doc })
  })

  it('is silent between tokens and past the row', () => {
    expect(at('{plant}‸ {plant}')).toBeUndefined()
    expect(at('{plant ‸ plant}')).toBeUndefined()
    expect(at('{plant} ‸')).toBeUndefined()
    expect(explainAt('{plant}', 7)).toBeUndefined()
    expect(explainAt('{plant}', -1)).toBeUndefined()
  })

  it('reads a broken row as far as it goes', () => {
    expect(at('{pl‸ant')?.icon).toEqual({ name: 'plant' })
    expect(at('‸{plant')).toEqual({ from: 0, to: 6, doc: ROW_SYNTAX.icon.doc })
    expect(at('(Gain a ‸plant.')?.doc).toBe(ROW_SYNTAX.words.doc)
    expect(at('{plant} ‸|3mm {plant}')?.doc).toBe(ROW_SYNTAX.line.doc)
  })

  it('reads the requirement and the disc by their own rules', () => {
    const req = ROW_FIELDS.requirement
    expect(at('m‸ax 6% {oxygen}', req)).toEqual({ from: 0, to: 3, doc: req.bare })
    expect(at('max 6‸% {oxygen}', req)?.doc).toBe(req.bare)
    expect(at('{oxy‸gen} (x)', req)?.icon).toEqual({ name: 'oxygen' })
    // no rules text there: the parentheses are words
    expect(at('{oxygen} (‸x)', req)).toEqual({ from: 9, to: 12, doc: req.bare })
    const vp = ROW_FIELDS.vp
    expect(at('‸1 {/ 2 microbe}', vp)).toEqual({ from: 0, to: 1, doc: vp.bare })
    expect(at('1 {‸/ 2 microbe}', vp)?.doc).toBe(ROW_SYNTAX.operator.doc)
    // nor boxes: the brackets are words too
    expect(at('1 ‸[x]', vp)).toEqual({ from: 2, to: 5, doc: vp.bare })
  })
})
