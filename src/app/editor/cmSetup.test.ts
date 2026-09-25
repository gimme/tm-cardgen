import { acceptCompletion } from '@codemirror/autocomplete'
import { insertNewlineAndIndent } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { makeEditorState } from './cmSetup.ts'
import { continueList, openRows } from './continueList.ts'

describe('makeEditorState', () => {
  it('binds Enter to the completion popup, then the list commands, then a plain newline', () => {
    const state = makeEditorState('', () => {})
    const enter = state
      .facet(keymap)
      .flat()
      .filter((b) => b.key === 'Enter')
      .map((b) => b.run)
    // basicSetup binds the completion keymap once more after these
    expect(enter.slice(0, 4)).toEqual([
      acceptCompletion,
      openRows,
      continueList,
      insertNewlineAndIndent,
    ])
  })
})
