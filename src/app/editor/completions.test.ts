import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { cardCompletions } from './completions.ts'

const ART_FILES = ['123', 'a #1.png', 'a,b.png', 'a: b.png', 'blå himmel.png', 'dust.png', 'true']

/** Completions for a document whose cursor sits at the end of `doc`. */
function completeAtEnd(doc: string) {
  const state = EditorState.create({ doc })
  return cardCompletions(new CompletionContext(state, doc.length, false), ART_FILES)
}

/** What the document becomes once `label` is picked. */
function applied(doc: string, label: string): string {
  const result = completeAtEnd(doc)
  if (!result) throw new Error(`no completions for ${JSON.stringify(doc)}`)
  const option = result.options.find((o) => o.label === label)
  if (!option) throw new Error(`no option ${label} for ${JSON.stringify(doc)}`)
  const text = typeof option.apply === 'string' ? option.apply : option.label
  return doc.slice(0, result.from) + text
}

describe('cardCompletions', () => {
  it('completes icon names inside braces, whatever came before', () => {
    expect(applied('body:\n  - "{3 pla', 'plant')).toBe('body:\n  - "{3 plant')
    expect(applied('body:\n  - "{OR STEAL 3 red m', 'mc')).toBe('body:\n  - "{OR STEAL 3 red mc')
    expect(completeAtEnd('title: ')).toBeNull()
    // a lone sign is an operator, {+ 1mc}, or a coin or spacer still to come
    expect(completeAtEnd('body:\n  - "{+')).toBeNull()
  })

  it('completes a number glued to the front with the coin or a spacer, keeping it', () => {
    expect(applied('body:\n  - "{25m', 'mc')).toBe('body:\n  - "{25mc')
    expect(applied('body:\n  - "{OR STEAL red 3', 'mc')).toBe('body:\n  - "{OR STEAL red 3mc')
    expect(applied('body:\n  - "[{-2', 'mc')).toBe('body:\n  - "[{-2mc')
    expect(applied('body:\n  - "{-1.5m', 'mm')).toBe('body:\n  - "{-1.5mm')
    const labels = (doc: string) => completeAtEnd(doc)?.options.map((o) => o.label)
    expect(labels('body:\n  - "{3')).toEqual(['mc', 'mm'])
    expect(labels('body:\n  - "{X')).toEqual(['mc'])
    expect(labels('body:\n  - "{.5')).toEqual(['mm'])
  })

  it('skips tag completion when the space after the colon is missing', () => {
    expect(completeAtEnd('tags: [spa')?.options.map((o) => o.label)).toContain('space')
    expect(completeAtEnd('tags:[spa')).toBeNull()
  })

  it("completes art's keys inside its braces or indented under it, never icons", () => {
    const labels = (doc: string) => completeAtEnd(doc)?.options.map((o) => o.label)
    expect(labels('art: {')).toEqual(['file', 'zoom', 'offset'])
    expect(applied('art: { fi', 'file')).toBe('art: { file: ')
    expect(applied('art: { file: a.png, offset: [0, -4], zo', 'zoom')).toBe(
      'art: { file: a.png, offset: [0, -4], zoom: ',
    )
    expect(applied('art:\n  file: a.png\n  zo', 'zoom')).toBe('art:\n  file: a.png\n  zoom: ')
    expect(applied('art: {\n  file: a.png,\n  of', 'offset')).toBe(
      'art: {\n  file: a.png,\n  offset: ',
    )
    // the other values and the scalar art:{ complete to nothing
    expect(completeAtEnd('art: { file: a.png, zoom: 1')).toBeNull()
    expect(completeAtEnd('art: { file: a.png, offset: [0, ')).toBeNull()
    expect(completeAtEnd('art:{fi')).toBeNull()
    // a new top-level key under a block-form art is still a top-level key
    expect(applied('art:\n  file: a.png\nfla', 'flavor')).toBe('art:\n  file: a.png\nflavor: ')
  })

  it("completes the project's art files as art's value or its file", () => {
    expect(completeAtEnd('art: ')?.options.map((o) => o.label)).toEqual(ART_FILES)
    expect(applied('art: du', 'dust.png')).toBe('art: dust.png')
    expect(applied('art: { file: du', 'dust.png')).toBe('art: { file: dust.png')
    expect(applied('art: { zoom: 1.2, file: du', 'dust.png')).toBe(
      'art: { zoom: 1.2, file: dust.png',
    )
    expect(applied('art:\n  file: du', 'dust.png')).toBe('art:\n  file: dust.png')
    // a space is fine bare and the typed words are replaced whole; a comma needs quotes
    expect(applied('art: blå hi', 'blå himmel.png')).toBe('art: blå himmel.png')
    expect(applied('art: { file: a', 'a,b.png')).toBe('art: { file: "a,b.png"')
    // so does anything else YAML would read as something other than the name
    expect(applied('art: a', 'a: b.png')).toBe('art: "a: b.png"')
    expect(applied('art: a', 'a #1.png')).toBe('art: "a #1.png"')
    expect(applied('art: t', 'true')).toBe('art: "true"')
    expect(applied('art: 1', '123')).toBe('art: "123"')
    // inside a quote already typed, only the name goes in
    expect(applied('art: "a', 'a,b.png')).toBe('art: "a,b.png')
    expect(applied("art: { file: 'du", 'dust.png')).toBe("art: { file: 'dust.png")
  })

  it('completes top-level keys with their colon and space', () => {
    expect(applied('fla', 'flavor')).toBe('flavor: ')
    expect(applied('act', 'active')).toBe('active: ')
  })
})
