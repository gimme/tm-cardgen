import { yaml } from '@codemirror/lang-yaml'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { richTextHelpAt } from './richTextHelp.ts'

/** The help for hovering at the ‸ in `doc`, with the pointer on the side it marks: after it by default. */
function hover(doc: string, side: -1 | 1 = 1) {
  const pos = doc.indexOf('‸')
  const state = EditorState.create({ doc: doc.replace('‸', ''), extensions: [yaml()] })
  return richTextHelpAt(state, pos, side)
}

describe('richTextHelpAt', () => {
  it('explains a body row, with document offsets', () => {
    expect(hover('body:\n  - "{pl‸ant} {->}"')).toEqual({
      from: 12,
      to: 17,
      icon: { name: 'plant' },
    })
    expect(hover('body:\n  - "{plant} {-‸>}"')?.icon).toEqual({ name: '->' })
    expect(hover('body:\n  - "{r‸ed plant}"')?.doc).toMatch(/any-player/)
    expect(hover('body:\n  - "[{plant}] (Gain a p‸lant.)"')).toBeUndefined()
  })

  it('reads the row as written: quoted either way, plain, or one string', () => {
    expect(hover("body:\n  - '{25‸mc}'")?.icon).toEqual({ name: 'mc', inscription: '25' })
    expect(hover('body:\n  - plain {st‸eel} row')?.icon).toEqual({ name: 'steel' })
    expect(hover('body: "{st‸eel}"')?.icon).toEqual({ name: 'steel' })
    expect(hover('body: ["{plant}", "{st‸eel}"]')?.icon).toEqual({ name: 'steel' })
    expect(hover('active:\n  - "{st‸eel}"')?.icon).toEqual({ name: 'steel' })
  })

  it('reads a block scalar as the one row it is, literal or folded', () => {
    const block =
      'active: |-\n  <{8mm earth-tag : -2mc} |1‸mm| {red space-tag 0mm red event-tag : card}>\n' +
      '  (Effect: When you play an Earth tag, you pay 2 M€ less.\n' +
      '  Effect: When any player plays a space event, draw 1 card.)\n'
    expect(hover(block)?.doc).toBe('A line break: 1 mm between the lines')
    const plain = block.replace('‸', '')
    expect(hover(plain.replace('earth-tag', 'ear‸th-tag'))?.icon).toEqual({ name: 'earth-tag' })
    expect(hover(plain.replace('Effect: When any', 'Eff‸ect: When any'))).toBeUndefined()
    expect(hover('body:\n  - >-\n    {pl‸ant}\n    {steel}')?.icon).toEqual({ name: 'plant' })
    expect(hover('body: |\n  {pl‸ant}\n')).toEqual({ from: 11, to: 16, icon: { name: 'plant' } })
    expect(hover('name: |\n  {pl‸ant}\n')).toBeUndefined()
  })

  it('reads the requirement and the disc by their own rules', () => {
    expect(hover('requirement: "max 6% {oxy‸gen}"')?.icon).toEqual({ name: 'oxygen' })
    expect(hover('requirement: "m‸ax 6% {oxygen}"')?.doc).toMatch(/upper limit/)
    expect(hover('requirement: "(x {oxy‸gen}"')?.icon).toEqual({ name: 'oxygen' })
    expect(hover('body: "(x {oxy‸gen}"')).toBeUndefined()
    expect(hover('vp: 1 {/ 2 mic‸robe}')?.icon).toEqual({ name: 'microbe' })
  })

  it('takes the character before the boundary when the pointer is there', () => {
    expect(hover('body:\n  - "{plant‸} {steel}"', -1)?.icon).toEqual({ name: 'plant' })
    expect(hover('body:\n  - "{plant‸} {steel}"', 1)).toBeUndefined()
    expect(hover('body:\n  - "{‸plant} {steel}"', -1)).toBeUndefined()
  })

  it('knows the row fields only where they belong', () => {
    expect(hover('name: {pl‸ant}')).toBeUndefined()
    expect(hover('flavor: {pl‸ant}')).toBeUndefined()
    expect(hover('bo‸dy: "{plant}"')).toBeUndefined()
    expect(hover('body:\n  - ‸"{plant}"')).toBeUndefined()
    expect(hover('body:\n  - "{plant}‸"')).toBeUndefined()
    expect(hover('x:\n  body: "{pl‸ant}"')).toBeUndefined()
  })
})
