// @vitest-environment jsdom
import { undo } from '@codemirror/commands'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, expect, it } from 'vitest'
import { makeEditorState, replaceText } from './cmSetup.ts'

const views: EditorView[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

/** The editor as the app assembles it, with the cursor at the ^ in `doc`,
 *  and the texts its onChange heard. */
function editor(doc: string): { view: EditorView; heard: string[] } {
  const heard: string[] = []
  const view = new EditorView({
    state: makeEditorState(doc.replace('^', ''), (text) => heard.push(text)),
    parent: document.body,
  })
  view.dispatch({ selection: EditorSelection.cursor(doc.indexOf('^')) })
  views.push(view)
  return { view, heard }
}

/** The document with the cursor marked. */
function text(view: EditorView): string {
  const doc = view.state.doc.toString()
  const head = view.state.selection.main.head
  return `${doc.slice(0, head)}^${doc.slice(head)}`
}

it('text from outside keeps the cursor with the text around it', () => {
  const { view } = editor('name: Pets\ncost: 1^0\n')
  // a change before the cursor moves it along
  replaceText(view, 'name: Big Pets\ncost: 10\n')
  expect(text(view)).toBe('name: Big Pets\ncost: 1^0\n')
  // and one just after it leaves it where it is
  replaceText(view, 'name: Big Pets\ncost: 12\n')
  expect(text(view)).toBe('name: Big Pets\ncost: 1^2\n')
})

it('text from outside is not heard by onChange, and Undo leaves it', () => {
  const { view, heard } = editor('name: Pets^\n')
  view.dispatch({ changes: { from: 10, insert: '!' } })
  expect(heard).toEqual(['name: Pets!\n'])

  replaceText(view, 'name: Pets!\ncost: 3\n')
  expect(heard).toEqual(['name: Pets!\n'])

  // Undo takes back this editor's own edit, and the outside one stays
  undo(view)
  expect(view.state.doc.toString()).toBe('name: Pets\ncost: 3\n')
  expect(undo(view)).toBe(false)
})
