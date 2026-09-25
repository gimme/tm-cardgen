import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { bytesToBlob } from './exportCommon.ts'
import { previewImport } from './importZip.ts'

function makeZip(files: Record<string, string | Uint8Array>): Blob {
  const zippable = Object.fromEntries(
    Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]),
  )
  return bytesToBlob(zipSync(zippable), 'application/zip')
}

describe('previewImport', () => {
  it('reads manifest order, cards and art', async () => {
    const zip = makeZip({
      'project.json': JSON.stringify({ formatVersion: 1, order: ['zeta', 'alpha'] }),
      'cards/alpha.yaml': 'name: Alpha\n',
      'cards/zeta.yaml': 'name: Zeta\ntags: [event]\n',
      'art/pic.png': new Uint8Array([137, 80]),
    })
    const preview = await previewImport(zip)
    // manifest order wins over alphabetical
    expect(preview.cards.map((c) => c.slug)).toEqual(['zeta', 'alpha'])
    expect(preview.cards.every((c) => c.valid)).toBe(true)
    expect(preview.art).toHaveLength(1)
    expect(preview.art[0].name).toBe('pic.png')
    expect(preview.problems).toEqual([])
  })

  it('ignores unknown slugs in the order and appends unlisted cards', async () => {
    const zip = makeZip({
      'project.json': JSON.stringify({ formatVersion: 1, order: ['gone', 'zeta'] }),
      'cards/alpha.yaml': 'name: Alpha\n',
      'cards/beta.yaml': 'name: Beta\n',
      'cards/zeta.yaml': 'name: Zeta\n',
    })
    const preview = await previewImport(zip)
    expect(preview.cards.map((c) => c.slug)).toEqual(['zeta', 'alpha', 'beta'])
    expect(preview.problems).toEqual([])
  })

  it('tolerates a manifest without a usable order', async () => {
    const zip = makeZip({
      'project.json': JSON.stringify({ formatVersion: 1 }),
      'cards/b.yaml': 'name: B\n',
      'cards/a.yaml': 'name: A\n',
    })
    const preview = await previewImport(zip)
    expect(preview.cards.map((c) => c.slug)).toEqual(['a', 'b'])
  })

  it('marks invalid cards but keeps them importable', async () => {
    const zip = makeZip({
      'cards/bad.yaml': 'name: Bad\ncost: -1\n',
    })
    const preview = await previewImport(zip)
    expect(preview.cards[0].valid).toBe(false)
    expect(preview.cards[0].error).toContain('cost cannot be negative')
  })

  it('flags an empty zip', async () => {
    const preview = await previewImport(makeZip({ 'readme.txt': 'hi' }))
    expect(preview.problems.some((p) => p.includes('no cards'))).toBe(true)
  })
})
