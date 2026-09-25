import { yaml } from '@codemirror/lang-yaml'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { ART_FIELDS, TOP_LEVEL_FIELDS } from '../../core/index.ts'
import { keyHelpAt } from './keyHelp.ts'

/** The help for hovering at the ‸ in `doc`, with the pointer on the side it marks: after it by default. */
function hover(doc: string, side: -1 | 1 = 1) {
  const pos = doc.indexOf('‸')
  const state = EditorState.create({ doc: doc.replace('‸', ''), extensions: [yaml()] })
  return keyHelpAt(state, pos, side)
}

describe('keyHelpAt', () => {
  it('explains a top-level key, but not its value', () => {
    expect(hover('name: Foo\nco‸st: 3')).toEqual({
      from: 10,
      to: 14,
      doc: TOP_LEVEL_FIELDS.cost.doc,
    })
    expect(hover('‸name: Foo')?.doc).toBe(TOP_LEVEL_FIELDS.name.doc)
    expect(hover('name: F‸oo')).toBeUndefined()
    expect(hover('tags: [bu‸ilding]')).toBeUndefined()
    expect(hover('body:\n  - "{pl‸ant}"')).toBeUndefined()
  })

  it('takes the key at its end only when the pointer is before the boundary', () => {
    expect(hover('name‸: Foo', -1)?.doc).toBe(TOP_LEVEL_FIELDS.name.doc)
    expect(hover('name‸: Foo', 1)).toBeUndefined()
  })

  it("explains art's keys inside its flow or block map", () => {
    expect(hover('art: { file: a.png, zo‸om: 1.2 }')?.doc).toBe(ART_FIELDS.zoom.doc)
    expect(hover('art:\n  fi‸le: a.png\n  offset: [0, 1]')).toEqual({
      from: 7,
      to: 11,
      doc: ART_FIELDS.file.doc,
    })
    expect(hover('art:\n  file: a.png\n  off‸set: [0, 1]')?.doc).toBe(ART_FIELDS.offset.doc)
  })

  it('knows each key only where it belongs', () => {
    expect(hover('fi‸le: a.png')).toBeUndefined()
    expect(hover('art: { na‸me: a.png }')).toBeUndefined()
    expect(hover('body:\n  fi‸le: a.png')).toBeUndefined()
    expect(hover('x:\n  art:\n    fi‸le: a.png')).toBeUndefined()
    expect(hover('bo‸gus: 1')).toBeUndefined()
  })

  it('reads a quoted key, spanning its quotes', () => {
    expect(hover('"co‸st": 3')).toEqual({ from: 0, to: 6, doc: TOP_LEVEL_FIELDS.cost.doc })
  })
})
