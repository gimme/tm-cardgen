import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { atBlankLine } from './blankLineCompletion.ts'

/** Whether the cursor at the ^ in `doc` is on a blank line. */
function blank(doc: string): boolean {
  const at = doc.indexOf('^')
  const state = EditorState.create({
    doc: doc.replace('^', ''),
    selection: EditorSelection.cursor(at),
  })
  return atBlankLine(state)
}

describe('atBlankLine', () => {
  it('is the end of a line with nothing written on it: empty, an indent, or a bare list item', () => {
    expect(blank('^')).toBe(true)
    expect(blank('name: x\n^')).toBe(true)
    expect(blank('name: x\n^\ncost: 3')).toBe(true)
    expect(blank('art:\n  ^')).toBe(true)
    expect(blank('tags:\n  - ^')).toBe(true)
    expect(blank('tags:\n  -^')).toBe(true)
  })

  it('is not a line with anything on it, nor the start of one', () => {
    expect(blank('name: x^')).toBe(false)
    expect(blank('^name: x')).toBe(false)
    expect(blank('tags:\n  - space^')).toBe(false)
    expect(blank('body:\n  - "^"')).toBe(false)
    expect(blank('art:\n^  ')).toBe(false)
  })

  it('is not a selection', () => {
    const state = EditorState.create({ doc: 'name: x\n', selection: EditorSelection.range(0, 8) })
    expect(atBlankLine(state)).toBe(false)
  })
})
