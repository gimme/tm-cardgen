import { describe, expect, it } from 'vitest'
import { gapIsNoop, indexForGap } from './reorder.ts'

function move(list: string[], fromIndex: number, gap: number): string[] {
  const out = [...list]
  const [moved] = out.splice(fromIndex, 1)
  out.splice(indexForGap(fromIndex, gap), 0, moved)
  return out
}

describe('indexForGap', () => {
  const abcd = ['a', 'b', 'c', 'd']

  it('drops a row above the row a gap sits over, moving down', () => {
    expect(move(abcd, 0, 2)).toEqual(['b', 'a', 'c', 'd'])
    expect(move(abcd, 0, 3)).toEqual(['b', 'c', 'a', 'd'])
    expect(move(abcd, 0, 4)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('drops a row above the row a gap sits over, moving up', () => {
    expect(move(abcd, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(move(abcd, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(move(abcd, 2, 1)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('leaves the list alone for the gaps beside the row itself', () => {
    expect(move(abcd, 1, 1)).toEqual(abcd)
    expect(move(abcd, 1, 2)).toEqual(abcd)
    expect(gapIsNoop(1, 1)).toBe(true)
    expect(gapIsNoop(1, 2)).toBe(true)
    expect(gapIsNoop(1, 0)).toBe(false)
    expect(gapIsNoop(1, 3)).toBe(false)
  })
})
