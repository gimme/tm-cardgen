import { yaml } from '@codemirror/lang-yaml'
import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { continueList, openRows } from './continueList.ts'

/** `command` run with the cursor at the `^` in `doc`: the document after it,
 *  cursor marked the same way, or null when the command leaves the key to the
 *  default. */
function pressAt(command: StateCommand) {
  return (doc: string): string | null => {
    const at = doc.indexOf('^')
    let state = EditorState.create({
      doc: doc.replace('^', ''),
      selection: EditorSelection.cursor(at),
      extensions: [yaml()],
    })
    const handled = command({ state, dispatch: (tr) => (state = tr.state) })
    if (!handled) return null
    const text = state.doc.toString()
    const head = state.selection.main.head
    return `${text.slice(0, head)}^${text.slice(head)}`
  }
}

function selecting(command: StateCommand, doc: string, from: number, to: number) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.range(from, to),
    extensions: [yaml()],
  })
  return command({ state, dispatch: () => {} })
}

describe('openRows', () => {
  const enter = pressAt(openRows)

  it('opens the first row under a bare rows key, cursor in its quotes', () => {
    expect(enter('body:^')).toBe('body:\n  - "^"')
    expect(enter('active:^\nvp: 1')).toBe('active:\n  - "^"\nvp: 1')
    expect(enter('name: x\nbody:^\nvp: 1')).toBe('name: x\nbody:\n  - "^"\nvp: 1')
    // as the completion leaves the line, and from anywhere past the colon
    expect(enter('body: ^')).toBe('body:\n  - "^"')
    expect(enter('body:^  ')).toBe('body:\n  - "^"')
    expect(enter('body:^ # note')).toBe('body: # note\n  - "^"')
    expect(enter('body: # no^te')).toBe('body: # note\n  - "^"')
  })

  it('puts the row ahead of the ones the key has, at their indent', () => {
    expect(enter('body:^\n  - "{plant}"')).toBe('body:\n  - "^"\n  - "{plant}"')
    expect(enter('body:^\n    - "{plant}"')).toBe('body:\n    - "^"\n    - "{plant}"')
    expect(enter('body: # note^\n  - "{plant}"')).toBe('body: # note\n  - "^"\n  - "{plant}"')
  })

  it('leaves a key holding anything but a list alone', () => {
    // the one-string form, on the line or under it
    expect(enter('body: "{plant}"^')).toBeNull()
    expect(enter('body:^\n  "{plant}"')).toBeNull()
    expect(enter('body:^\n  plain text')).toBeNull()
    expect(enter('body: |^\n  text')).toBeNull()
    expect(enter('body: [a, b]^')).toBeNull()
  })

  it('leaves every other Enter alone', () => {
    // up to the colon
    expect(enter('^body:')).toBeNull()
    expect(enter('bo^dy:')).toBeNull()
    expect(enter('body^:')).toBeNull()
    // not a rows key, or not the top-level one
    expect(enter('tags:^')).toBeNull()
    expect(enter('bodyguard:^')).toBeNull()
    expect(enter('name: body:^')).toBeNull()
    expect(enter('art:\n  body:^')).toBeNull()
    expect(enter('flavor: |\n  body:^')).toBeNull()
  })

  it('stands aside for a selection', () => {
    expect(selecting(openRows, 'body:', 0, 5)).toBe(false)
  })
})

describe('continueList', () => {
  const enter = pressAt(continueList)

  it('starts the next item at the end of one, dropping trailing space', () => {
    expect(enter('tags:\n- space^\n- earth')).toBe('tags:\n- space\n- ^\n- earth')
    expect(enter('tags:\n  - space^  \nvp: 1')).toBe('tags:\n  - space\n  - ^\nvp: 1')
    expect(enter('body:\n  - 3^')).toBe('body:\n  - 3\n  - ^')
  })

  it('opens the next item in quotes when this one is, cursor on either side of the closer', () => {
    expect(enter('body:\n  - "{plant}"^')).toBe('body:\n  - "{plant}"\n  - "^"')
    expect(enter('body:\n  - "{plant}^"')).toBe('body:\n  - "{plant}"\n  - "^"')
    expect(enter('body:\n  - "{plant}"^  \nvp: 1')).toBe('body:\n  - "{plant}"\n  - "^"\nvp: 1')
  })

  it('splits an item at the cursor, each half quoted as the whole was', () => {
    expect(enter('tags:\n  - space^ earth')).toBe('tags:\n  - space\n  - ^earth')
    expect(enter('body:\n  - "{plant}^ {heat}"')).toBe('body:\n  - "{plant}"\n  - "^{heat}"')
    expect(enter("body:\n  - '{plant} ^{heat}'")).toBe("body:\n  - '{plant}'\n  - '^{heat}'")
    expect(enter('body:\n  - "a | ^b"')).toBe('body:\n  - "a |"\n  - "^b"')
    // wherever the cursor is, brackets included
    expect(enter('body:\n  - "[{titanium^}]"')).toBe('body:\n  - "[{titanium"\n  - "^}]"')
    // at the very start, the item moves down whole
    expect(enter('body:\n  - "^{plant}"')).toBe('body:\n  - ""\n  - "^{plant}"')
    expect(enter('body:\n  - ^"{plant}"')).toBe('body:\n  - ""\n  - "^{plant}"')
  })

  it('keeps a comment after the value with the head', () => {
    expect(enter("body:\n  - 'a^bc'  # note")).toBe("body:\n  - 'a'  # note\n  - '^bc'")
    expect(enter("body:\n  - 'abc'  # no^te")).toBe("body:\n  - 'abc'  # note\n  - '^'")
    expect(enter('tags:\n  - sp^ace # note')).toBe('tags:\n  - sp # note\n  - ^ace')
  })

  it('ends the list on an item with nothing in it, quoted or not', () => {
    expect(enter('body:\n  - "{plant}"\n  - ^')).toBe('body:\n  - "{plant}"\n^')
    expect(enter('body:\n  -^\nvp: 1')).toBe('body:\n^\nvp: 1')
    expect(enter('body:\n  - "^"')).toBe('body:\n^')
    expect(enter('body:\n  - ""^')).toBe('body:\n^')
    expect(enter("body:\n  - ' ^ '")).toBe('body:\n^')
  })

  it('continues a map or flow item only from the end of its line', () => {
    expect(enter('body:\n  - [a, b]^')).toBe('body:\n  - [a, b]\n  - ^')
    expect(enter('body:\n  - {plant}^')).toBe('body:\n  - {plant}\n  - ^')
    expect(enter('body:\n  - key: val^')).toBe('body:\n  - key: val\n  - ^')
    expect(enter('body:\n  - [a, ^b]')).toBeNull()
    expect(enter('body:\n  - ke^y: val')).toBeNull()
  })

  it('leaves an item that runs past its line alone', () => {
    // a string continued on the next line, or left open
    expect(enter('body:\n  - "abc^\n    def"')).toBeNull()
    expect(enter('body:\n  - "abc^\nvp: 1')).toBeNull()
    expect(enter('body:\n  - "abc^')).toBeNull()
    expect(enter('body:\n  - "^')).toBeNull()
    // a flow collection continued below
    expect(enter('body:\n  - [a,^\n    b]')).toBeNull()
    // a block scalar, whose text may look like an item
    expect(enter('body:\n  - |^\n    text')).toBeNull()
    expect(enter('body:\n  - |\n    text\n    - more^')).toBeNull()
  })

  it('leaves every other Enter alone', () => {
    // before the dash
    expect(enter('body:\n^  - "{plant}"')).toBeNull()
    expect(enter('body:\n  ^- "{plant}"')).toBeNull()
    // not a list item
    expect(enter('name: Dust Filters^')).toBeNull()
    expect(enter('cost: -3^')).toBeNull()
    expect(enter('tags: [space, earth]^')).toBeNull()
  })

  it('stands aside for a selection', () => {
    expect(selecting(continueList, 'body:\n  - "{plant}"', 10, 19)).toBe(false)
  })
})
