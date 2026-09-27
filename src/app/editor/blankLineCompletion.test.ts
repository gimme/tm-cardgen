// @vitest-environment jsdom
import {
  completionStatus,
  currentCompletions,
  selectedCompletionIndex,
} from '@codemirror/autocomplete'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ArtCache } from '../services/artCache.ts'
import { type Services, setServices } from '../store/services.ts'
import { atBlankLine } from './blankLineCompletion.ts'
import { makeEditorState } from './cmSetup.ts'

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

/** The editor as the app assembles it, mounted, with the cursor at the ^ in
 *  `doc`. Placing the cursor is not an edit, so no list comes up for it. */
function editor(doc: string): EditorView {
  const view = new EditorView({
    state: makeEditorState(doc.replace('^', ''), () => {}),
    parent: document.body,
  })
  view.dispatch({ selection: EditorSelection.cursor(doc.indexOf('^')) })
  return view
}

/** A key going down in the editor, as the browser reports it. */
function press(view: EditorView, key: string): void {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

/** Waits out the moment the completion plugin takes to run its sources. */
async function settled(view: EditorView): Promise<void> {
  for (let i = 0; i < 100 && completionStatus(view.state) === 'pending'; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/** The document with the cursor marked, as `editor` takes it. */
function text(view: EditorView): string {
  const doc = view.state.doc.toString()
  const head = view.state.selection.main.head
  return `${doc.slice(0, head)}^${doc.slice(head)}`
}

const labels = (view: EditorView) => currentCompletions(view.state).map((c) => c.label)

describe('the list on a blank line', () => {
  // the completion source lists the art files; nothing else in the services is touched
  beforeAll(() => setServices({ art: new ArtCache() } as Services))

  const views: EditorView[] = []
  const mount = (doc: string) => {
    const view = editor(doc)
    views.push(view)
    return view
  }
  afterEach(() => {
    for (const view of views.splice(0)) view.destroy()
  })

  it('comes up when Enter leaves the cursor on a blank line: the keys not yet written, in the spec order', async () => {
    const view = mount('name: x^')
    press(view, 'Enter')
    await settled(view)
    expect(text(view)).toBe('name: x\n^')
    expect(completionStatus(view.state)).toBe('active')
    expect(labels(view)).toEqual([
      'cost',
      'tags',
      'requirement',
      'active',
      'body',
      'vp',
      'flavor',
      'number',
      'art',
      'artist',
    ])
  })

  it('does not come up for the cursor merely moving onto a blank line', () => {
    // a list on its way would already read as pending
    const view = mount('name: x\n^\ncost: 3')
    expect(completionStatus(view.state)).toBeNull()
  })

  it('lets a second Enter through as a plain newline, then comes up again', async () => {
    const view = mount('name: x^')
    press(view, 'Enter')
    await settled(view)
    press(view, 'Enter')
    await settled(view)
    expect(text(view)).toBe('name: x\n\n^')
    expect(completionStatus(view.state)).toBe('active')
    press(view, 'Enter')
    await settled(view)
    expect(text(view)).toBe('name: x\n\n\n^')
  })

  it('takes Enter as a pick once the selection has been moved', async () => {
    const view = mount('name: x^')
    press(view, 'Enter')
    await settled(view)
    press(view, 'ArrowDown')
    expect(selectedCompletionIndex(view.state)).toBe(1)
    press(view, 'Enter')
    await settled(view)
    expect(text(view)).toBe('name: x\ntags: ^')
    expect(completionStatus(view.state)).toBeNull()
  })

  it('takes Tab as a pick at any time', async () => {
    const view = mount('name: x^')
    press(view, 'Enter')
    await settled(view)
    press(view, 'Tab')
    await settled(view)
    expect(text(view)).toBe('name: x\ncost: ^')
  })
})
