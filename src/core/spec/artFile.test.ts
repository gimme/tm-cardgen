import { describe, expect, it } from 'vitest'
import { artFileOf, withArtFile } from './artFile.ts'

describe('artFileOf', () => {
  it('reads the file from either form of art, quoted or with spaces', () => {
    expect(artFileOf('name: A\nart: dust.png\n')).toBe('dust.png')
    expect(artFileOf('name: A\nart: { file: dust.png, zoom: 1.2 }\n')).toBe('dust.png')
    expect(artFileOf('name: A\nart:\n  zoom: 1.2\n  file: dust.png\n')).toBe('dust.png')
    expect(artFileOf('name: A\nart: blå himmel.png\n')).toBe('blå himmel.png')
    expect(artFileOf('name: A\nart: { file: "a,b.png" }\n')).toBe('a,b.png')
  })

  it('reads it from a card that is otherwise invalid', () => {
    expect(artFileOf('art: dust.png\ncost: many\nbody: "{nonsense"\n')).toBe('dust.png')
  })

  it('finds none where art is missing or is not a file name', () => {
    expect(artFileOf('name: A\n')).toBeUndefined()
    expect(artFileOf('name: A\nart: { zoom: 2 }\n')).toBeUndefined()
    expect(artFileOf('name: A\nart: 12\n')).toBeUndefined()
    expect(artFileOf('')).toBeUndefined()
  })
})

describe('withArtFile', () => {
  it('sets the file in either form, leaving the rest of the text alone', () => {
    expect(withArtFile('name: A\nart: dust.png # sky\ncost: 3\n', 'new.png')).toBe(
      'name: A\nart: new.png # sky\ncost: 3\n',
    )
    expect(withArtFile('art: { zoom: 1.2, file: dust.png, offset: [0, -4] }\n', 'new.png')).toBe(
      'art: { zoom: 1.2, file: new.png, offset: [0, -4] }\n',
    )
    expect(withArtFile('art:\n  file: dust.png\n  zoom: 2\n', 'new.png')).toBe(
      'art:\n  file: new.png\n  zoom: 2\n',
    )
  })

  it('keeps the quote style, and quotes a bare name that needs it', () => {
    expect(withArtFile('art: "dust.png"\n', 'a "b".png')).toBe('art: "a \\"b\\".png"\n')
    expect(withArtFile("art: 'dust.png'\n", "it's.png")).toBe("art: 'it''s.png'\n")
    expect(withArtFile('art: { file: dust.png }\n', 'a,b.png')).toBe('art: { file: "a,b.png" }\n')
    expect(withArtFile('art: dust.png\n', 'blå himmel.png')).toBe('art: blå himmel.png\n')
  })

  it('reads back what it wrote, and leaves a card without art alone', () => {
    for (const name of ['new.png', 'a,b.png', 'true', 'a: b.png', "it's.png"]) {
      expect(artFileOf(withArtFile('art: { file: dust.png, zoom: 2 }\n', name))).toBe(name)
    }
    expect(withArtFile('name: A\n', 'new.png')).toBe('name: A\n')
    // a block scalar becomes a plain one, its line break kept
    expect(withArtFile('art: |-\n  dust.png\ncost: 3\n', 'new.png')).toBe('art: new.png\ncost: 3\n')
  })
})
