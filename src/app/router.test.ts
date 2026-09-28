import { describe, expect, it } from 'vitest'
import { pathOf, routeOf } from './router.ts'

describe('routeOf', () => {
  it('reads the editor, on no card in particular, at the base', () => {
    expect(routeOf('/')).toEqual({ page: 'editor' })
    expect(routeOf('/tm-cardgen/', '/tm-cardgen/')).toEqual({ page: 'editor' })
    expect(routeOf('/tm-cardgen/index.html', '/tm-cardgen/')).toEqual({ page: 'editor' })
  })

  it('reads the gallery, with or without a trailing slash', () => {
    expect(routeOf('/gallery')).toEqual({ page: 'gallery' })
    expect(routeOf('/tm-cardgen/gallery/', '/tm-cardgen/')).toEqual({ page: 'gallery' })
  })

  it("reads a card's editor, with or without a trailing slash", () => {
    expect(routeOf('/card/meteor-swarm')).toEqual({ page: 'editor', slug: 'meteor-swarm' })
    expect(routeOf('/tm-cardgen/card/meteor-swarm-2/', '/tm-cardgen/')).toEqual({
      page: 'editor',
      slug: 'meteor-swarm-2',
    })
  })

  it('reads nothing at any other address', () => {
    expect(routeOf('/cards')).toBeUndefined()
    expect(routeOf('/gallery/meteor-swarm')).toBeUndefined()
    expect(routeOf('/card/')).toBeUndefined()
    expect(routeOf('/card/Meteor%20Swarm')).toBeUndefined()
    expect(routeOf('/card/meteor-swarm', '/tm-cardgen/')).toBeUndefined()
  })
})

describe('pathOf', () => {
  it('round-trips through routeOf', () => {
    for (const route of [
      { page: 'editor' },
      { page: 'gallery' },
      { page: 'editor', slug: 'dust-filters' },
    ] as const) {
      expect(routeOf(pathOf(route, '/tm-cardgen/'), '/tm-cardgen/')).toEqual(route)
    }
  })
})
