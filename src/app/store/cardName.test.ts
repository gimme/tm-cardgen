import { describe, expect, it } from 'vitest'
import { cardSlugs, copyName, extractName, slugify, withName } from './cardName.ts'

describe('withName', () => {
  it('rewrites a plain name line and leaves the rest alone', () => {
    expect(withName('cost: 3\nname: Old\ntags: [x]\n', 'New')).toBe(
      'cost: 3\nname: New\ntags: [x]\n',
    )
  })

  it('keeps the quote style', () => {
    expect(withName('name: "Old: one"\n', 'Say "hi" (1)')).toBe('name: "Say \\"hi\\" (1)"\n')
    expect(withName("name: 'Old'\n", "Bob's (1)")).toBe("name: 'Bob''s (1)'\n")
  })

  it('is a no-op without a name line', () => {
    expect(withName('cost: 3\n', 'New')).toBe('cost: 3\n')
  })

  it('round-trips through extractName', () => {
    for (const text of ['name: A\n', 'name: "A"\n', "name:   'A'  \n"]) {
      expect(extractName(withName(text, 'B (1)'))).toBe('B (1)')
    }
  })
})

describe('copyName', () => {
  it('appends (1) when free', () => {
    expect(copyName('Pets', ['Pets'])).toBe('Pets (1)')
  })

  it('takes the first free number', () => {
    expect(copyName('Pets', ['Pets', 'Pets (1)', 'Pets (3)'])).toBe('Pets (2)')
  })

  it('counts from the base when copying a copy', () => {
    expect(copyName('Pets (1)', ['Pets', 'Pets (1)'])).toBe('Pets (2)')
  })
})

describe('slugify', () => {
  it('keeps lowercase letters and digits, dashes between', () => {
    expect(slugify('Meteor Swarm (2)')).toBe('meteor-swarm-2')
    expect(slugify('  ASTEROID—MINING  ')).toBe('asteroid-mining')
  })

  it('falls back when nothing is left', () => {
    expect(slugify('???')).toBe('card')
  })
})

describe('cardSlugs', () => {
  it('numbers a repeat from 2, and steps past a slug already taken', () => {
    expect(cardSlugs(['Pets', 'Pets 2', 'Pets', 'Moss'])).toEqual([
      'pets',
      'pets-2',
      'pets-3',
      'moss',
    ])
  })
})
