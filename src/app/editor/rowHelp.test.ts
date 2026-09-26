import { yaml } from '@codemirror/lang-yaml'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { ROW_SYNTAX } from '../../core/index.ts'
import { rowHelpAt } from './rowHelp.ts'

/** The help for hovering at the ‸ in `doc`, with the pointer on the side it marks: after it by default. */
function hover(doc: string, side: -1 | 1 = 1) {
  const pos = doc.indexOf('‸')
  const state = EditorState.create({ doc: doc.replace('‸', ''), extensions: [yaml()] })
  return rowHelpAt(state, pos, side)
}

describe('rowHelpAt', () => {
  it('explains a body row, with document offsets', () => {
    expect(hover('body:\n  - "{pl‸ant} {->}"')).toEqual({
      from: 12,
      to: 17,
      doc: '`plant`',
      icon: { name: 'plant' },
    })
    expect(hover('body:\n  - "{plant} {-‸>}"')?.doc).toBe(ROW_SYNTAX.arrow.doc)
    expect(hover('body:\n  - "[{plant}] (Gain a p‸lant.)"')?.doc).toBe(ROW_SYNTAX.rules.doc)
  })

  it('reads the row as written: quoted either way, plain, or one string', () => {
    expect(hover("body:\n  - '{25‸mc}'")?.icon).toEqual({ name: 'mc', inscription: '25' })
    expect(hover('body:\n  - plain {st‸eel} row')?.icon).toEqual({ name: 'steel' })
    expect(hover('body: "{st‸eel}"')?.icon).toEqual({ name: 'steel' })
    expect(hover('body: ["{plant}", "{st‸eel}"]')?.icon).toEqual({ name: 'steel' })
    expect(hover('active:\n  - "{st‸eel}"')?.icon).toEqual({ name: 'steel' })
  })

  it('reads the requirement and the disc by their own rules', () => {
    expect(hover('requirement: "max 6% {oxy‸gen}"')?.icon).toEqual({ name: 'oxygen' })
    expect(hover('requirement: "m‸ax 6% {oxygen}"')?.doc).toMatch(/upper limit/)
    expect(hover('vp: 1 {/ 2 mic‸robe}')?.icon).toEqual({ name: 'microbe' })
    expect(hover('vp: ‸1 {/ 2 microbe}')?.doc).toMatch(/numeral/)
  })

  it('takes the character before the boundary when the pointer is there', () => {
    expect(hover('body:\n  - "{plant‸} {steel}"', -1)?.icon).toEqual({ name: 'plant' })
    expect(hover('body:\n  - "{plant‸} {steel}"', 1)?.doc).toBe(ROW_SYNTAX.icon.doc)
  })

  it('knows the row fields only where they belong', () => {
    expect(hover('name: {pl‸ant}')).toBeUndefined()
    expect(hover('flavor: {pl‸ant}')).toBeUndefined()
    expect(hover('bo‸dy: "{plant}"')).toBeUndefined()
    expect(hover('body:\n  - ‸"{plant}"')).toBeUndefined()
    expect(hover('body:\n  - "{plant}‸"')).toBeUndefined()
    expect(hover('x:\n  body: "{pl‸ant}"')).toBeUndefined()
    expect(hover('body:\n  - >-\n    {pl‸ant}')).toBeUndefined()
  })
})
