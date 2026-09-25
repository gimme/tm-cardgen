import { describe, expect, it } from 'vitest'
import { layoutCard, titleSize, type LayoutContext } from './layout.ts'
import { OPERATOR_TEXT_SIZE } from './chunks.ts'
import { HALO } from '../frame/halo.ts'
import { ICONS, NOTE_GAP } from '../icons.ts'
import { COLON, SLASH, slashWidth } from '../frame/operators.ts'
import { ACTION, COMMON, NUM_TYPE, TITLE_SIZE, TITLE_STYLES, TITLE_TRACKING } from './frames.ts'
import type { CardLayout, LayoutNode, TextNode } from './model.ts'
import type { Rect } from '../units.ts'
import { parseRequirement } from '../spec/requirement.ts'
import { parseVp } from '../spec/vp.ts'
import { parseRichText } from '../spec/richtext.ts'
import type { CardSpec, Row } from '../spec/types.ts'
import { testFonts } from '../../../tests/helpers/fonts.ts'

const ctx: LayoutContext = {
  measurer: testFonts(),
  artSize: () => ({ w: 400, h: 300 }),
}

function card(over: Partial<CardSpec>): CardSpec {
  return { name: 'Test', type: 'automated', tags: [], body: [], ...over }
}

/** a row from its source string */
const row = (src: string): Row => {
  const { items, errors } = parseRichText(src)
  expect(errors).toEqual([])
  return items
}

const RULES =
  '(A rules text long enough to wrap over several lines in the body, so a narrower column shows as more lines.)'

/** the small art window height (artBottom − artTop, from the frame spec) */
const ART_H_SMALL = 46.25
/** green: flavor bottom 83.5, bodyTop = artBottom + 3.54, artTop 15.44 */
const GREEN_ART_H_FOR = (bodyH: number) => 83.5 - bodyH - 3.54 - 15.44

const artH = (l: CardLayout) => l.frame.regions.artWindow.h
const bodyH = (l: CardLayout) => l.frame.regions.bodyBox.h

const frameNode = (l: CardLayout) =>
  l.nodes.find((n): n is Extract<LayoutNode, { kind: 'frame' }> => n.kind === 'frame')!

type Box = Extract<LayoutNode, { kind: 'image' | 'rect' | 'vector' }>
const icons = (l: CardLayout, name: string) =>
  l.nodes.filter(
    (n): n is Extract<LayoutNode, { kind: 'image' }> =>
      n.kind === 'image' && n.asset.type === 'asset' && n.asset.path.includes(`/${name}.png`),
  )
const vectors = (l: CardLayout, icon: Extract<LayoutNode, { kind: 'vector' }>['icon']) =>
  l.nodes.filter(
    (n): n is Extract<LayoutNode, { kind: 'vector' }> => n.kind === 'vector' && n.icon === icon,
  )
const rulesLines = (l: CardLayout) =>
  l.nodes.filter((n): n is TextNode => n.kind === 'text' && n.font === 'serif' && !n.rotate)
const directiveLines = (l: CardLayout) =>
  l.nodes.filter((n): n is TextNode => n.kind === 'text' && n.font === 'sansBold')
/** a spaced line's set width: the run, its tracking and its word spacing */
const setWidth = (n: TextNode) =>
  ctx.measurer.width(n.text, n.font, n.size) +
  (n.letterSpacing ?? 0) * Math.max(0, n.text.length - 1) +
  (n.wordSpacing ?? 0) * (n.text.match(/ /g)?.length ?? 0)

describe('frame sizing', () => {
  it('shrinks the body to fit light content — the art gets the rest', () => {
    const layout = layoutCard(card({ body: [row('{plant}')] }), ctx)
    expect(layout.warnings).toEqual([])
    // a body lighter than the small preset, so the art outgrows it
    expect(bodyH(layout)).toBeLessThan(18.27)
    expect(bodyH(layout)).toBeGreaterThanOrEqual(10)
    expect(artH(layout)).toBeGreaterThan(ART_H_SMALL)
  })

  it('grows the body continuously as rows stack up', () => {
    const at = (n: number) =>
      artH(layoutCard(card({ body: Array.from({ length: n }, () => row('{plant}')) }), ctx))
    expect(at(3)).toBeLessThan(at(1))
    expect(at(5)).toBeLessThan(at(3))
  })

  it('fits the box to the rows exactly: first row at the body top', () => {
    const layout = layoutCard(card({ body: [row('{plant}'), row(RULES)] }), ctx)
    const top = Math.min(...icons(layout, 'plant').map((n) => n.y))
    expect(top).toBeGreaterThanOrEqual(layout.frame.regions.bodyTop - 1e-6)
    expect(top).toBeLessThan(layout.frame.regions.bodyTop + 0.1)
  })

  it('stops at the max body and warns when nothing fits', () => {
    const rows = Array.from({ length: 12 }, () => row('{plant}'))
    const layout = layoutCard(card({ body: rows }), ctx)
    expect(bodyH(layout)).toBeCloseTo(52)
    expect(artH(layout)).toBeCloseTo(GREEN_ART_H_FOR(52))
    expect(layout.warnings.some((w) => w.message.includes('body overflows'))).toBe(true)
  })

  it('keeps VP cards at the official small body so the circle stays off the art', () => {
    const layout = layoutCard(card({ body: [row('{plant}')], vp: row('1') }), ctx)
    expect(bodyH(layout)).toBeCloseTo(18.27)
    expect(artH(layout)).toBeCloseTo(ART_H_SMALL)
  })

  it('places the banner seam: official position by default, left of a 4th tag', () => {
    const plain = layoutCard(card({}), ctx)
    expect(frameNode(plain).seamX).toBeCloseTo(28.65)
    // three tags never reach the seam
    const three = layoutCard(card({ tags: ['space', 'space', 'space'] }), ctx)
    expect(frameNode(three).seamX).toBeCloseTo(28.65)
    // a 4th tag comes in at the last slot; with no requirement bar the seam
    // slides left of it (bow + stroke + margin clear of the slot edge)
    const four = layoutCard(card({ tags: ['space', 'space', 'space', 'space'] }), ctx)
    expect(frameNode(four).seamX!).toBeLessThan(COMMON.tagSlots.xs[3] - 1.5)
  })

  it('pushes the seam right of a wide requirement bar, which beats the tags', () => {
    const requirement = {
      max: false,
      items: [
        {
          kind: 'text' as const,
          text: 'a very very wide requirement',
          big: false,
          start: 0,
          end: 0,
        },
      ],
    }
    const wide = layoutCard(card({ requirement }), ctx)
    const seam = frameNode(wide).seamX!
    expect(seam).toBeGreaterThan(28.6)
    // the requirement bar wins over the 4th tag
    const both = layoutCard(card({ requirement, tags: ['space', 'space', 'space', 'space'] }), ctx)
    expect(frameNode(both).seamX).toBeCloseTo(seam)
  })

  it('draws the requirement box as written: icons repeat, a number is text at the box size', () => {
    const withReq = (src: string) => {
      const { req, errors } = parseRequirement(src)
      expect(errors).toEqual([])
      return layoutCard(card({ requirement: req }), ctx)
    }
    const proto = (l: CardLayout, text: string) =>
      l.nodes.filter(
        (n): n is TextNode => n.kind === 'text' && n.font === 'proto' && n.text === text,
      )
    // two oceans are two tiles, not a count
    const two = withReq('{ocean ocean}')
    expect(icons(two, 'ocean')).toHaveLength(2)
    expect(proto(two, '2')).toHaveLength(0)
    // "5" and one tile: the number in the plaque's own text size...
    const five = withReq('{5 ocean}')
    expect(icons(five, 'ocean')).toHaveLength(1)
    const [prefix] = proto(five, '5')
    expect(prefix.size).toBe(COMMON.reqBar.textSize)
    // ...which is the size a hand-written "6%" gets
    const [pct] = proto(withReq('6% {oxygen}'), '6%')
    expect(pct.size).toBe(prefix.size)
  })

  it('spells "max" out in the max box, joined to a leading word; the min box says nothing', () => {
    const withReq = (src: string) => {
      const { req, errors } = parseRequirement(src)
      expect(errors).toEqual([])
      return layoutCard(card({ requirement: req }), ctx)
    }
    const protoTexts = (l: CardLayout) =>
      l.nodes
        .filter((n): n is TextNode => n.kind === 'text' && n.font === 'proto')
        .map((n) => n.text)
    expect(protoTexts(withReq('max 6% {oxygen}'))).toContain('max 6%')
    expect(protoTexts(withReq('max {ocean}'))).toContain('max')
    expect(protoTexts(withReq('6% {oxygen}')).some((t) => t.startsWith('max'))).toBe(false)
  })
})

describe('text in braces', () => {
  const proto = (l: CardLayout, text: string) =>
    l.nodes.find((n): n is TextNode => n.kind === 'text' && n.font === 'proto' && n.text === text)!
  const sans = (l: CardLayout, text: string) =>
    l.nodes.find(
      (n): n is TextNode => n.kind === 'text' && n.font === 'sansBold' && n.text === text,
    )!

  it('prints at the count size, above the directive size of bare words', () => {
    const layout = layoutCard(card({ body: [row('{OR 3} {microbe} STEAL {5 heat}')] }), ctx)
    expect(layout.warnings).toEqual([])
    expect(icons(layout, 'microbe')).toHaveLength(1)
    expect(proto(layout, 'OR 3').size).toBe(proto(layout, '5').size)
    expect(sans(layout, 'STEAL').size).toBeLessThan(proto(layout, 'OR 3').size)
  })

  it("sets text sharing an icon's braces beside it; a number inscribes on mc only", () => {
    const layout = layoutCard(
      card({ body: [row('{OR STEAL red 3mc} MOVE'), row('{X heat}')] }),
      ctx,
    )
    expect(layout.warnings).toEqual([])
    expect(icons(layout, 'heat')).toHaveLength(1)
    expect(proto(layout, 'OR STEAL').size).toBe(proto(layout, 'X').size)
    expect(sans(layout, 'MOVE').size).toBeLessThan(proto(layout, 'X').size)
    // the 3 is inscribed on the coin, the X set before the heat
    expect(proto(layout, '3').anchor).toBe('middle')
    expect(proto(layout, 'X').anchor).toBe('start')
    const inscribedX = proto(layoutCard(card({ body: [row('{Xmc}')] }), ctx), 'X')
    expect(inscribedX.anchor).toBe('middle')
  })

  /** edge-to-edge distance between the first two plants of a row */
  const apart = (src: string) => {
    const [a, b] = icons(layoutCard(card({ body: [row(src)] }), ctx), 'plant')
    return b.x - (a.x + a.w)
  }

  it('sets one braces tight and separate elements further apart', () => {
    expect(apart('{plant plant}')).toBeCloseTo(1)
    expect(apart('{plant} {plant}')).toBeCloseTo(2)
    // the same text, grouped or on its own, moves the plants 1mm more each side
    expect(apart('{plant} {OR} {plant}') - apart('{plant OR plant}')).toBeCloseTo(2)
    // production boxes stand alone, at the loose gap
    const boxed = layoutCard(card({ body: [row('[{plant}] {plant}')] }), ctx)
    const [inBox, beside] = icons(boxed, 'plant')
    expect(beside.x - (inBox.x + inBox.w)).toBeGreaterThan(2)
  })

  it('sets the rules text apart like any separate element', () => {
    const layout = layoutCard(card({ body: [row('{plant} (Gain 1 plant.)')] }), ctx)
    const [plant] = icons(layout, 'plant')
    const text = rulesLines(layout)[0]
    expect(text.x - (plant.x + plant.w)).toBeCloseTo(2)
  })

  it('sets a spacer as the whole distance between its neighbours', () => {
    expect(apart('{plant} {3mm} {plant}')).toBeCloseTo(3)
    expect(apart('{plant 0mm plant}')).toBeCloseTo(0)
    expect(apart('{plant} {-1mm} {plant}')).toBeCloseTo(-1)
    expect(apart('{plant} {1mm} {1mm} {plant}')).toBeCloseTo(2)
    // the rules text takes the width the spacer leaves
    const spaced = layoutCard(card({ body: [row(`{plant} {6mm} ${RULES}`)] }), ctx)
    const plain = layoutCard(card({ body: [row(`{plant} ${RULES}`)] }), ctx)
    expect(rulesLines(spaced).length).toBeGreaterThan(rulesLines(plain).length)
  })

  it('takes the plaque text size in the requirement box', () => {
    const { req, errors } = parseRequirement('{OR} {ocean}')
    expect(errors).toEqual([])
    const layout = layoutCard(card({ requirement: req }), ctx)
    expect(proto(layout, 'OR').size).toBe(COMMON.reqBar.textSize)
  })
})

describe('the title', () => {
  it('prints in ALL CAPS however the spec writes it', () => {
    const layout = layoutCard(card({ name: 'Dust Filters' }), ctx)
    const title = layout.nodes.find(
      (n): n is TextNode => n.kind === 'text' && n.font === 'proto' && !!n.letterSpacing,
    )!
    expect(title.text).toBe('DUST FILTERS')
  })
})

describe('the action area', () => {
  const blue = (active: Row[], over: Partial<CardSpec> = {}) =>
    layoutCard(card({ type: 'active', active, ...over }), ctx)

  it("keeps the family's own divider for light rows, centering them", () => {
    const layout = blue([row('{heat}')])
    expect(layout.warnings).toEqual([])
    expect(frameNode(layout).artTop).toBeCloseTo(ACTION.minArtTop)
    const icon = icons(layout, 'heat')[0]
    const box = { top: ACTION.top, bottom: ACTION.minArtTop - ACTION.pad }
    expect(icon.y - box.top).toBeCloseTo(box.bottom - (icon.y + icon.h))
  })

  it('deepens the action area as rows stack, and the window follows', () => {
    const one = blue([row('{heat}')])
    const three = blue([row('{heat}'), row('{heat}'), row(RULES)])
    expect(three.warnings).toEqual([])
    expect(frameNode(three).artTop!).toBeGreaterThan(frameNode(one).artTop!)
    expect(three.frame.regions.artWindow.y).toBeCloseTo(frameNode(three).artTop!)
    // the last row ends `pad` above the divider
    const last = Math.max(...rulesLines(three).map((n) => n.y))
    expect(last).toBeLessThan(frameNode(three).artTop! - ACTION.pad)
  })

  it('stops where the window would collapse, and warns', () => {
    const rows = Array.from({ length: 8 }, () => row('{heat}'))
    const layout = blue(rows)
    expect(layout.warnings.some((w) => w.message.includes('action area overflows'))).toBe(true)
    expect(layout.frame.regions.artWindow.h).toBeCloseTo(10.5)
  })

  it('keeps the body rows in the box under the art', () => {
    const layout = blue([row('{heat}')], { body: [row('{plant}')] })
    expect(icons(layout, 'plant')[0].y).toBeGreaterThan(layout.frame.regions.bodyTop - 1e-6)
    expect(icons(layout, 'heat')[0].y).toBeLessThan(ACTION.minArtTop)
  })
})

describe('rows', () => {
  it('centers each row on the card axis, elements centered on each other', () => {
    const layout = layoutCard(card({ body: [row('{ocean} {steel}')] }), ctx)
    const ocean = icons(layout, 'ocean')[0]
    const steel = icons(layout, 'steel')[0]
    expect(ocean.x + ocean.w).toBeLessThan(steel.x)
    expect((ocean.x + steel.x + steel.w) / 2).toBeCloseTo(COMMON.cx, 5)
    expect(ocean.y + ocean.h / 2).toBeCloseTo(steel.y + steel.h / 2, 5)
  })

  it('hangs the asterisk off the top-right corner of a cube, NOTE_GAP clear of it', () => {
    const layout = layoutCard(card({ body: [row('{steel *}')] }), ctx)
    const steel = icons(layout, 'steel')[0]
    const star = vectors(layout, 'asterisk')[0]
    expect(star.x - (steel.x + steel.w)).toBeCloseTo(NOTE_GAP, 5)
    expect(star.y + star.h / 2).toBeCloseTo(steel.y, 5)
    // the mark counts in the row's width, and rides above its height
    expect((steel.x + star.x + star.w) / 2).toBeCloseTo(COMMON.cx, 5)
    expect(bodyH(layout)).toBeCloseTo(bodyH(layoutCard(card({ body: [row('{steel}')] }), ctx)), 5)
  })

  it("stands the asterisk flush against a tile's box, centered on its top edge", () => {
    const layout = layoutCard(card({ body: [row('{ocean *}')] }), ctx)
    const ocean = icons(layout, 'ocean')[0]
    const star = vectors(layout, 'asterisk')[0]
    expect(star.x).toBeCloseTo(ocean.x + ocean.w, 5)
    expect(star.y + star.h / 2).toBeCloseTo(ocean.y, 5)
  })

  it("moves the asterisk in over a triangle's slope by the icon's own fix-up", () => {
    const layout = layoutCard(card({ body: [row('{colony *}')] }), ctx)
    const tile = icons(layout, 'colony')[0]
    const star = vectors(layout, 'asterisk')[0]
    const [dx, dy] = ICONS.colony.noteAt!
    expect(dx).toBeLessThan(0)
    expect(star.x).toBeCloseTo(tile.x + tile.w + dx, 5)
    expect(star.y + star.h / 2).toBeCloseTo(tile.y + dy, 5)
  })

  it("hangs the asterisk off a red icon's box: the ring's counted share, not its edge", () => {
    const layout = layoutCard(card({ body: [row('{red ocean *}')] }), ctx)
    const ocean = icons(layout, 'ocean')[0]
    const star = vectors(layout, 'asterisk')[0]
    const counted = HALO.width * HALO.counted
    expect(star.x).toBeCloseTo(ocean.x + ocean.w + counted, 5)
    expect(star.y + star.h / 2).toBeCloseTo(ocean.y - counted, 5)
  })

  it('wraps rules text in the width the other elements leave, flush left', () => {
    const alone = layoutCard(card({ body: [row(RULES)] }), ctx)
    const beside = layoutCard(card({ body: [row(`{ocean ocean} ${RULES}`)] }), ctx)
    expect(rulesLines(alone).every((n) => n.anchor === 'middle')).toBe(true)
    expect(rulesLines(beside).every((n) => n.anchor === 'start')).toBe(true)
    expect(rulesLines(beside).length).toBeGreaterThan(rulesLines(alone).length)
    // the block sits right of the icon, vertically centered on it
    const ocean = icons(beside, 'ocean').at(-1)!
    const lines = rulesLines(beside)
    expect(Math.min(...lines.map((n) => n.x))).toBeGreaterThan(ocean.x + ocean.w)
    const first = lines[0].y - ctx.measurer.capHeight('serif', lines[0].size)
    const last = lines.at(-1)!.y + lines[0].size * 0.25
    expect((first + last) / 2).toBeCloseTo(ocean.y + ocean.h / 2, 1)
  })

  it('sets bare words as one directive run, wrapped beside the icons, its lines centered', () => {
    const layout = layoutCard(
      card({ body: [row('{red city : animal} ANIMALS MAY NOT BE REMOVED FROM THIS CARD')] }),
      ctx,
    )
    expect(layout.warnings).toEqual([])
    const lines = directiveLines(layout)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.map((n) => n.text).join(' ')).toBe('ANIMALS MAY NOT BE REMOVED FROM THIS CARD')
    // one block of centered lines, right of the cube and centered on it
    const centers = lines.map((n) => n.x + setWidth(n) / 2)
    expect(centers.every((c) => Math.abs(c - centers[0]) < 1e-6)).toBe(true)
    const animal = icons(layout, 'animal')[0]
    expect(Math.min(...lines.map((n) => n.x))).toBeGreaterThan(animal.x + animal.w)
    // the run is tracked and its spaces tightened
    expect(lines[0].letterSpacing).toBeLessThan(0)
    expect(lines[0].wordSpacing).toBeLessThan(0)
    const cap = ctx.measurer.capHeight(lines[0].font, lines[0].size)
    expect((lines[0].y - cap + lines.at(-1)!.y) / 2).toBeCloseTo(animal.y + animal.h / 2, 5)
  })

  it('centers a directive run standing alone; a newline in it breaks the line', () => {
    const alone = layoutCard(card({ body: [row('MOVE')] }), ctx)
    expect(directiveLines(alone).map((n) => n.text)).toEqual(['MOVE'])
    const move = directiveLines(alone)[0]
    expect(move.x + setWidth(move) / 2).toBeCloseTo(COMMON.cx, 5)
    const broken = layoutCard(card({ body: [row('MOVE\nALONG')] }), ctx)
    expect(directiveLines(broken).map((n) => n.text)).toEqual(['MOVE', 'ALONG'])
  })

  it('prints the rules text as written, parentheses and all', () => {
    const layout = layoutCard(card({ body: [row('(Gain 3 MC.)')] }), ctx)
    expect(
      rulesLines(layout)
        .map((n) => n.text)
        .join(' '),
    ).toBe('(Gain 3 MC.)')
  })

  it('draws a multi-line production box beside icons, icons at one size', () => {
    const layout = layoutCard(
      card({ body: [row('[{2mc} | {plant plant plant}] {plant plant}')] }),
      ctx,
    )
    const plants = icons(layout, 'plant')
    expect(plants).toHaveLength(5)
    expect(new Set(plants.map((p) => p.h.toFixed(3))).size).toBe(1)
    const box = layout.nodes.find(
      (n): n is Extract<LayoutNode, { kind: 'rect' }> =>
        n.kind === 'rect' && n.gradient === 'prod-outer',
    )!
    // the box's two lines stack, the loose plants sit right of the box
    const inBox = plants.filter((p) => p.x < box.x + box.w)
    expect(inBox).toHaveLength(3)
    expect(plants.filter((p) => p.x > box.x + box.w)).toHaveLength(2)
    const mc = layout.nodes.find((n): n is Box => n.kind === 'vector')!
    expect(mc.y + mc.h).toBeLessThanOrEqual(inBox[0].y + 1e-6)
  })

  it('warns about a row too wide for the flow', () => {
    const layout = layoutCard(card({ body: [row('{ocean ocean ocean} {ocean ocean ocean}')] }), ctx)
    expect(layout.warnings.some((w) => /body row 1 is .*too wide/.test(w.message))).toBe(true)
  })
})

describe('stacks and lines', () => {
  it('stacks a column beside the rest of the row, centered on it', () => {
    const layout = layoutCard(card({ body: [row('<{plant} | {steel}> {->} {7mc}')] }), ctx)
    expect(layout.warnings).toEqual([])
    const plant = icons(layout, 'plant')[0]
    const steel = icons(layout, 'steel')[0]
    const arrow = icons(layout, 'arrow')[0]
    // plant over steel at the line gap, centered on each other
    expect(steel.y - (plant.y + plant.h)).toBeCloseTo(2)
    expect(plant.x + plant.w / 2).toBeCloseTo(steel.x + steel.w / 2, 5)
    // the column stands at the loose gap from the arrow, centered on it
    expect(arrow.x - (plant.x + plant.w)).toBeCloseTo(2)
    expect((plant.y + steel.y + steel.h) / 2).toBeCloseTo(arrow.y + arrow.h / 2, 5)
  })

  it('sets the lines of a stack as rows, stacks nesting either way', () => {
    const src = '<{plant} {->} {7mc} | [{steel} | <{heat} | {heat}>]> {2 plant}'
    const layout = layoutCard(card({ body: [row(src)] }), ctx)
    expect(layout.warnings).toEqual([])
    const [plant, loose] = icons(layout, 'plant')
    const arrow = icons(layout, 'arrow')[0]
    const [heat1, heat2] = icons(layout, 'heat')
    const steel = icons(layout, 'steel')[0]
    // the first line is a row: the arrow beside the plant, centered on it
    expect(arrow.x - (plant.x + plant.w)).toBeCloseTo(2)
    expect(arrow.y + arrow.h / 2).toBeCloseTo(plant.y + plant.h / 2, 5)
    // the box is the second line, a bare stack inside it at the box's gap
    expect(steel.y).toBeGreaterThan(plant.y + plant.h)
    expect(heat1.y).toBeGreaterThan(steel.y + steel.h)
    expect(heat2.y - (heat1.y + heat1.h)).toBeCloseTo(1.1)
    // the loose plant stands right of the whole stack
    expect(loose.x).toBeGreaterThan(arrow.x + arrow.w)
  })

  it('takes a bare | as exactly a new row, and an empty row as nothing', () => {
    const listed = layoutCard(card({ body: [row('{plant}'), row('{steel}')] }), ctx)
    const piped = layoutCard(card({ body: [row('{plant} | {steel}')] }), ctx)
    expect(piped.nodes).toEqual(listed.nodes)
    const empty = layoutCard(card({ body: [row('{plant}'), row(''), row('{steel}')] }), ctx)
    expect(empty.nodes).toEqual(listed.nodes)
    const spaced = layoutCard(card({ body: [row('{plant}'), row('{3mm}'), row('{steel}')] }), ctx)
    expect(spaced.nodes).toEqual(listed.nodes)
  })

  it('sets a gapped break as the whole distance between its lines', () => {
    const gap = (rows: string[]) => {
      const plants = icons(layoutCard(card({ body: rows.map(row) }), ctx), 'plant')
      const [a, b] = plants.sort((p, q) => p.y - q.y)
      return b.y - (a.y + a.h)
    }
    expect(gap(['{plant}', '{plant}'])).toBeCloseTo(2)
    expect(gap(['{plant} |3mm| {plant}'])).toBeCloseTo(3)
    expect(gap(['{plant}', '|3mm| {plant}'])).toBeCloseTo(3)
    expect(gap(['{plant} |3mm|', '{plant}'])).toBeCloseTo(3)
    expect(gap(['{plant}', '|3mm|', '{plant}'])).toBeCloseTo(3)
    expect(gap(['{plant} |1mm|', '|2mm| {plant}'])).toBeCloseTo(3)
    expect(gap(['{plant} |-1mm| {plant}'])).toBeCloseTo(-1)
    // the same inside a stack
    const inner = layoutCard(card({ body: [row('<{plant} |0mm| {plant}> {steel}')] }), ctx)
    const [a, b] = icons(inner, 'plant')
    expect(b.y - (a.y + a.h)).toBeCloseTo(0)
  })

  it('pads the flow with a gap at either end', () => {
    // rows enough to stand clear of the body's floor
    const plain = layoutCard(card({ body: [row(RULES), row('{plant}')] }), ctx)
    const below = layoutCard(card({ body: [row(RULES), row('{plant} |3mm|')] }), ctx)
    const above = layoutCard(card({ body: [row(`|3mm| ${RULES}`), row('{plant}')] }), ctx)
    expect(bodyH(below) - bodyH(plain)).toBeCloseTo(3, 5)
    expect(bodyH(above) - bodyH(plain)).toBeCloseTo(3, 5)
    // the plant moves up off the flavor by the pad...
    expect(icons(below, 'plant')[0].y).toBeLessThan(icons(plain, 'plant')[0].y - 2.9)
    // ...or stays at the flow's bottom under it
    expect(icons(above, 'plant')[0].y).toBeCloseTo(icons(plain, 'plant')[0].y, 0)
  })

  it('gives a stack holding rules text the width the row leaves', () => {
    const alone = layoutCard(card({ body: [row(RULES)] }), ctx)
    const stacked = layoutCard(card({ body: [row(`{ocean ocean} <{plant} | ${RULES}>`)] }), ctx)
    expect(stacked.warnings).toEqual([])
    const lines = rulesLines(stacked)
    expect(lines.length).toBeGreaterThan(rulesLines(alone).length)
    // the text wraps under the plant, right of the ocean
    const plant = icons(stacked, 'plant')[0]
    const ocean = icons(stacked, 'ocean').at(-1)!
    expect(Math.min(...lines.map((n) => n.y))).toBeGreaterThan(plant.y + plant.h)
    expect(Math.min(...lines.map((n) => n.x - n.size))).toBeGreaterThan(ocean.x + ocean.w)
    // two such stacks share the leftover equally
    const two = layoutCard(card({ body: [row(`<{plant} | ${RULES}> <{steel} | ${RULES}>`)] }), ctx)
    expect(two.warnings).toEqual([])
    const [left, right] = icons(two, 'plant').concat(icons(two, 'steel'))
    expect(COMMON.cx - (left.x + left.w / 2)).toBeCloseTo(right.x + right.w / 2 - COMMON.cx, 5)
  })
})

describe('the VP circle', () => {
  const vp = row('1')
  const discLeft = COMMON.vpRect.x + COMMON.vpMargin
  const discTop = COMMON.vpRect.y + COMMON.vpMargin

  it('squeezes the rows beside it into the corridor on its left', () => {
    const layout = layoutCard(card({ body: [row(RULES)], vp }), ctx)
    const lines = rulesLines(layout)
    expect(lines.length).toBeGreaterThan(0)
    for (const n of lines) {
      expect(n.y).toBeGreaterThan(discTop) // beside the disc
      const w = ctx.measurer.width(n.text, 'serif', n.size)
      expect(n.x + w / 2).toBeLessThan(discLeft - COMMON.vpClear + 1e-6)
    }
  })

  it('lets rows above the disc run the full width', () => {
    const wide = '[{2mc} | {plant plant plant}] {plant plant}'
    const layout = layoutCard(card({ body: [row(wide), row(RULES)], vp }), ctx)
    expect(layout.warnings).toEqual([])
    const plants = icons(layout, 'plant')
    expect(Math.max(...plants.map((p) => p.y + p.h))).toBeLessThan(discTop)
    // centered on the card, not the corridor
    const box = layout.nodes.find(
      (n): n is Extract<LayoutNode, { kind: 'rect' }> =>
        n.kind === 'rect' && n.gradient === 'prod-outer',
    )!
    const right = Math.max(...plants.map((p) => p.x + p.w))
    expect((box.x + right) / 2).toBeCloseTo(COMMON.cx, 5)
  })

  it('moves a row too wide for the corridor up clear of the disc', () => {
    // wider than the corridor, narrower than the flow
    const wide = '{ocean ocean ocean} {ocean ocean}'
    const withVp = layoutCard(card({ body: [row(wide)], vp }), ctx)
    expect(withVp.warnings).toEqual([])
    const bottom = Math.max(...icons(withVp, 'ocean').map((p) => p.y + p.h))
    expect(bottom).toBeLessThanOrEqual(discTop - 1.0 + 1e-6)
    expect(bottom).toBeGreaterThan(discTop - 3)
    // it stays card-centered
    const xs = icons(withVp, 'ocean').map((p) => p.x)
    const ws = icons(withVp, 'ocean').map((p) => p.w)
    expect((Math.min(...xs) + Math.max(...xs.map((x, i) => x + ws[i]))) / 2).toBeCloseTo(
      COMMON.cx,
      5,
    )
  })

  it('centers a short flow in the VP-floored body', () => {
    const layout = layoutCard(card({ body: [row('{plant}')], vp }), ctx)
    const plant = icons(layout, 'plant')[0]
    const { bodyTop } = layout.frame.regions
    const flowBottom = COMMON.flavor.bottom - 2.2
    expect(plant.y - bodyTop).toBeCloseTo(flowBottom - (plant.y + plant.h), 5)
  })
})

describe('layout content', () => {
  it('draws the backdrop over the window of a card that names no art', () => {
    const backdrop = (l: CardLayout) =>
      l.nodes.find((n): n is Extract<LayoutNode, { kind: 'backdrop' }> => n.kind === 'backdrop')
    const layout = layoutCard(card({}), ctx)
    expect(layout.warnings).toEqual([])
    const b = backdrop(layout)!
    const win = layout.frame.regions.artWindow
    // past the window on every side, so the rim blends over sky
    expect(b.x).toBeLessThan(win.x)
    expect(b.y).toBeLessThan(win.y)
    expect(b.x + b.w).toBeGreaterThan(win.x + win.w)
    expect(b.y + b.h).toBeGreaterThan(win.y + win.h)
    const withArt = layoutCard(card({ art: { file: 'a.png', zoom: 1, offset: [0, 0] } }), ctx)
    expect(backdrop(withArt)).toBeUndefined()
  })

  it('warns and renders a placeholder for missing art', () => {
    const noArt: LayoutContext = { measurer: testFonts(), artSize: () => undefined }
    const layout = layoutCard(card({ art: { file: 'nope.png', zoom: 1, offset: [0, 0] } }), noArt)
    expect(layout.warnings.some((w) => w.message.includes("art 'nope.png' not found"))).toBe(true)
    expect(layout.nodes.some((n) => n.kind === 'rect' && n.fill === 'checkerboard')).toBe(true)
  })

  it('keeps every flowed node inside the card', () => {
    const layout = layoutCard(
      card({
        body: [row('{plant} [{2mc} | {plant}]'), row(RULES)],
        flavor: 'Quiet words.',
        vp: row('2'),
      }),
      ctx,
    )
    expect(layout.warnings).toEqual([])
    for (const n of layout.nodes) {
      if (n.kind === 'frame' || n.kind === 'reqbox') continue // fixed by construction
      expect(n.x).toBeGreaterThanOrEqual(-1)
      expect(n.y).toBeGreaterThanOrEqual(-1)
      if (n.kind !== 'text') {
        expect(n.x + n.w).toBeLessThanOrEqual(64)
        expect(n.y + n.h).toBeLessThanOrEqual(89)
      }
    }
  })
})

describe('any-player halo', () => {
  type Halo = Extract<LayoutNode, { kind: 'halo' }>
  const halos = (l: CardLayout) => l.nodes.filter((n): n is Halo => n.kind === 'halo')
  const one = (src: string) => {
    const layout = layoutCard(card({ body: [row(src)] }), ctx)
    expect(layout.warnings).toEqual([])
    return { layout, halo: halos(layout)[0] }
  }

  it('rings the icon after each red, in its own shape', () => {
    expect(halos(one('{red plant red plant}').layout)).toHaveLength(2)
    expect(halos(one('{red plant plant}').layout)).toHaveLength(1)
    expect(one('{red plant}').halo.shape).toBe('box')
    expect(one('{red city}').halo.shape).toBe('hexagon')
    expect(one('{red 3mc}').halo.shape).toBe('octagon')
  })

  it("sits on the icon box, drawn under the icon, at the icon's scale", () => {
    const { layout, halo } = one('{red plant}')
    const [plant] = icons(layout, 'plant')
    expect([halo.x, halo.y, halo.w, halo.h]).toEqual([plant.x, plant.y, plant.w, plant.h])
    expect(halo.scale).toBe(1)
    expect(layout.nodes.indexOf(halo)).toBeLessThan(layout.nodes.indexOf(plant))
    // every body icon is a cube tall or taller: full ring
    expect(one('{red city}').halo.scale).toBe(1)
    // the plaque sets its icons under a cube's height: one thinner ring for all
    const { req, errors } = parseRequirement('{red city} {red plant}')
    expect(errors).toEqual([])
    const plaque = layoutCard(card({ requirement: req }), ctx)
    const scale = COMMON.reqBar.iconH / HALO.fullFrom
    expect(scale).toBeLessThan(1)
    expect(halos(plaque).map((n) => n.scale)).toEqual([scale, scale])
  })

  it('counts only part of the ring, the rest hanging into the gap', () => {
    const [a, b] = icons(one('{red plant red plant}').layout, 'plant')
    expect(b.x - (a.x + a.w)).toBeCloseTo(1 + 2 * HALO.width * HALO.counted)
    // the rings stand closer than the tight gap, but do not touch
    const ringGap = b.x - HALO.width - (a.x + a.w + HALO.width)
    expect(ringGap).toBeGreaterThan(0)
    expect(ringGap).toBeLessThan(1)
  })

  it('leaves the note on a ringed icon bare', () => {
    const { layout } = one('{red ocean *}')
    expect(halos(layout)).toHaveLength(1)
    expect(vectors(layout, 'asterisk')).toHaveLength(1)
  })

  it('keeps the coin number centered on the ringed coin', () => {
    const { layout, halo } = one('{red 3mc}')
    const three = layout.nodes.find((n): n is TextNode => n.kind === 'text' && n.text === '3')!
    expect(three.x).toBeCloseTo(halo.x + halo.w / 2)
  })
})

// The two blocks below assert properties that hold whatever the constants in
// frames.ts are set to, so retuning the geometry does not mean rewriting them.

describe('title sizing', () => {
  const m = testFonts()
  const style = TITLE_STYLES.green
  // real names top out near 30 characters; the same letter throughout keeps
  // width proportional to length, which is what the ordering test needs
  const names = Array.from({ length: 40 }, (_, i) => 'W'.repeat(i + 1))

  const drawnWidth = (name: string, size: number) =>
    m.width(name, 'proto', size) + TITLE_TRACKING * Math.max(0, name.length - 1)

  it('keeps every name inside the title plate', () => {
    for (const name of names) {
      expect(drawnWidth(name, titleSize(name, style, m))).toBeLessThanOrEqual(style.maxWidth)
    }
  })

  it('never sets a longer name larger than a shorter one', () => {
    const sizes = names.map((n) => titleSize(n, style, m))
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1])
  })

  it('lands on whole 0.1mm steps', () => {
    for (const name of names) {
      const tenths = titleSize(name, style, m) * 10
      expect(Math.abs(tenths - Math.round(tenths))).toBeLessThan(1e-9)
    }
  })

  it('leaves a short name at full size', () => {
    expect(titleSize('ICE CAP', style, m)).toBe(TITLE_SIZE)
  })
})

describe('flavor text placement', () => {
  const flavorLines = (l: CardLayout): TextNode[] =>
    l.nodes.filter((n): n is TextNode => n.kind === 'text' && n.font === 'serifBoldItalic')

  const separator = (l: CardLayout) => {
    const rules = l.nodes.filter(
      (n): n is Extract<LayoutNode, { kind: 'rect' }> =>
        n.kind === 'rect' && n.h === 0.2 && n.fill === '#000000',
    )
    expect(rules).toHaveLength(1)
    return rules[0]
  }

  it('bottom-anchors the last line whatever the line count', () => {
    for (const flavor of ['One line.', 'One.\nTwo.\nThree.']) {
      const lines = flavorLines(layoutCard(card({ flavor }), ctx))
      expect(lines.at(-1)!.y).toBeCloseTo(COMMON.flavor.bottom)
    }
  })

  it('stacks explicit line breaks upward from that baseline', () => {
    const lines = flavorLines(layoutCard(card({ flavor: 'first\nsecond\nthird' }), ctx))
    expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third'])
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].y - lines[i - 1].y).toBeCloseTo(COMMON.flavor.lineH)
    }
  })

  it('wraps a long line even when another break is explicit', () => {
    const long = 'A line long enough that it cannot possibly fit across the body box in one go'
    const lines = flavorLines(layoutCard(card({ flavor: `short\n${long}` }), ctx))
    expect(lines[0].text).toBe('short')
    expect(lines.length).toBeGreaterThan(2)
    for (const l of lines)
      expect(ctx.measurer.width(l.text, 'serifBoldItalic', l.size)).toBeLessThanOrEqual(
        COMMON.flavor.w,
      )
  })

  it('puts the rule above the top line', () => {
    const layout = layoutCard(card({ flavor: 'first\nsecond' }), ctx)
    expect(separator(layout).y).toBeLessThan(flavorLines(layout)[0].y)
  })

  it('keeps the rule clear of the VP circle', () => {
    // long lines, so the rule is wide enough to run into the circle at
    // every height if nothing stopped it
    const line = 'A line long enough to reach right across the card'
    for (const count of [1, 2, 3, 4]) {
      const layout = layoutCard(
        card({ flavor: Array(count).fill(line).join('\n'), vp: row('3') }),
        ctx,
      )
      const rule = separator(layout)
      const vp = COMMON.vpRect
      const centerX = vp.x + vp.w / 2
      const centerY = vp.y + vp.h / 2
      const radius = vp.w / 2 - COMMON.vpMargin
      // the rule runs to the circle's left, so its right end is its nearest
      // point; that point has to fall outside the visible disc
      const distance = Math.hypot(rule.x + rule.w - centerX, rule.y - centerY)
      expect(distance).toBeGreaterThan(radius)
    }
  })
})

describe('artist credit', () => {
  const art = { file: 'a.png', zoom: 1, offset: [0, 0] as [number, number] }
  const credit = (l: CardLayout) =>
    l.nodes.find((n): n is TextNode => n.kind === 'text' && n.rotate === -90)!

  it("runs up the art window's right edge, white over dark art", () => {
    const layout = layoutCard(card({ artist: 'Ed Bierman', art }), {
      ...ctx,
      artBrightness: () => 0.3,
    })
    expect(layout.warnings).toEqual([])
    const c = credit(layout)
    const win = layout.frame.regions.artWindow
    expect(c.text).toBe('Ed Bierman')
    expect(c.font).toBe('serif')
    expect(c.size).toBe(1.3)
    expect(c.fill).toBe('#fff')
    expect(c.anchor).toBe('start')
    // baseline just inside the right keyline, run starting above the bottom
    expect(c.x).toBeCloseTo(win.x + win.w - 0.27, 6)
    expect(c.y).toBeCloseTo(win.y + win.h - 1.0, 6)
  })

  it('goes black over light art and the missing-art checkerboard, white over the backdrop', () => {
    const light = layoutCard(card({ artist: 'Ed Bierman', art }), {
      ...ctx,
      artBrightness: () => 0.8,
    })
    expect(credit(light).fill).toBe('#000')
    const unknown = layoutCard(card({ artist: 'Ed Bierman', art }), ctx)
    expect(credit(unknown).fill).toBe('#fff')
    const missing = layoutCard(card({ artist: 'Ed Bierman', art }), {
      measurer: testFonts(),
      artSize: () => undefined,
    })
    expect(credit(missing).fill).toBe('#000')
    const noArt = layoutCard(card({ artist: 'Ed Bierman' }), ctx)
    expect(credit(noArt).fill).toBe('#fff')
  })

  it('samples the art right under the run', () => {
    let seen: Rect | undefined
    let file: string | undefined
    const layout = layoutCard(card({ artist: 'Ed Bierman', art }), {
      ...ctx,
      artBrightness: (f, region) => {
        file = f
        seen = region
        return 0.3
      },
    })
    expect(file).toBe('a.png')
    // map the image-fraction region back onto the card: the glyph column
    // (cap high, the run long) with 0.4mm of art around it
    const img = layout.nodes.find((n) => n.kind === 'image')!
    const strip = {
      x: img.x + seen!.x * img.w,
      y: img.y + seen!.y * img.h,
      w: seen!.w * img.w,
      h: seen!.h * img.h,
    }
    const c = credit(layout)
    const cap = ctx.measurer.capHeight('serif', c.size)
    const run = ctx.measurer.width(c.text, 'serif', c.size)
    expect(strip.x + strip.w).toBeCloseTo(c.x + 0.4, 6)
    expect(strip.w).toBeCloseTo(cap + 0.8, 6)
    expect(strip.y + strip.h).toBeCloseTo(c.y + 0.4, 6)
    expect(strip.h).toBeCloseTo(run + 0.8, 6)
  })

  it('shrinks a long credit to fit a short window and says so', () => {
    const name = 'A Very Long Studio Name With Several Contributors'
    // a body deep enough to leave the window short
    const rows = Array.from({ length: 4 }, () => row('{plant}'))
    const layout = layoutCard(card({ artist: name, art, body: [...rows, row(RULES)] }), {
      ...ctx,
      artBrightness: () => 0.3,
    })
    expect(layout.warnings.map((w) => w.message)).toContain(
      'artist credit shrunk to fit the art window',
    )
    const c = credit(layout)
    expect(c.size).toBeLessThan(1.3)
    const run = ctx.measurer.width(name, 'serif', c.size)
    expect(run).toBeLessThanOrEqual(layout.frame.regions.artWindow.h - 2.0 + 1e-6)
  })
})

describe('operators', () => {
  const proto = (l: CardLayout, text: string) =>
    l.nodes.filter((n): n is TextNode => n.kind === 'text' && n.font === 'proto' && n.text === text)
  const slashes = (l: CardLayout) => vectors(l, 'slash')

  it('prints a symbol standing alone at the operator size, its ink centered on its neighbours', () => {
    const layout = layoutCard(
      card({ body: [row('{titanium} {:} {+ 1mc} {- 5mc} {=} {+/-2}')] }),
      ctx,
    )
    expect(layout.warnings).toEqual([])
    const [plus] = proto(layout, '+')
    expect(plus.size).toBe(OPERATOR_TEXT_SIZE)
    expect(proto(layout, '=')[0].size).toBe(OPERATOR_TEXT_SIZE)
    // the minus is the en dash, as wide as the plus
    expect(proto(layout, '-')).toHaveLength(0)
    expect(proto(layout, '–')).toHaveLength(1)
    // a symbol in a word is count-size text
    expect(proto(layout, '+/-2')[0].size).toBeLessThan(OPERATOR_TEXT_SIZE)
    // the glyph's ink centers on the cube's middle, not its cap box
    const [cube] = icons(layout, 'titanium')
    const mid = cube.y + cube.h / 2
    const ink = ctx.measurer.inkBounds('+', 'proto', OPERATOR_TEXT_SIZE)
    expect(plus.y + (ink.y1 + ink.y2) / 2).toBeCloseTo(mid)
    // the colon is drawn: two round dots, centered the same
    const [colon] = vectors(layout, 'colon')
    expect(colon.w).toBeCloseTo(COLON.dot * OPERATOR_TEXT_SIZE)
    expect(colon.h).toBeCloseTo(COLON.span * OPERATOR_TEXT_SIZE)
    expect(colon.y + colon.h / 2).toBeCloseTo(mid)
  })

  it('prints the slash at one size wherever it stands, centered on its neighbours', () => {
    const between = layoutCard(card({ body: [row('{ocean / plant}')] }), ctx)
    const [tile] = icons(between, 'ocean')
    const [bar] = slashes(between)
    expect(bar.h).toBeCloseTo(SLASH.h)
    expect(bar.w).toBeCloseTo(slashWidth(SLASH.h))
    expect(bar.y + bar.h / 2).toBeCloseTo(tile.y + tile.h / 2)
    // alone, and beside taller company: the same bar
    expect(slashes(layoutCard(card({ body: [row('{/}')] }), ctx))[0].h).toBeCloseTo(SLASH.h)
    const line = layoutCard(card({ body: [row('{plant} {/} {card}')] }), ctx)
    expect(slashes(line)[0].h).toBeCloseTo(SLASH.h)
    // in the requirement box too; only a production box scales it, with all it holds
    const { req, errors } = parseRequirement('{ocean / temperature}')
    expect(errors).toEqual([])
    expect(slashes(layoutCard(card({ requirement: req }), ctx))[0].h).toBeCloseTo(SLASH.h)
    const boxed = parseRequirement('[{plant / steel}]')
    expect(boxed.errors).toEqual([])
    expect(slashes(layoutCard(card({ requirement: boxed.req }), ctx))[0].h).toBeCloseTo(
      SLASH.h * COMMON.reqBar.prodScale,
    )
  })
})

describe('the VP disc', () => {
  const proto = (l: CardLayout, text: string) =>
    l.nodes.filter((n): n is TextNode => n.kind === 'text' && n.font === 'proto' && n.text === text)
  const slash = (l: CardLayout) =>
    l.nodes.find(
      (n): n is Extract<LayoutNode, { kind: 'vector' }> =>
        n.kind === 'vector' && n.icon === 'slash',
    )!
  const plaques = (l: CardLayout) =>
    l.nodes.filter(
      (n) => n.kind === 'image' && n.asset.type === 'asset' && n.asset.path.startsWith('VPs/'),
    )
  const vp = (src: string) => {
    const { vp, errors } = parseVp(src)
    expect(errors).toEqual([])
    return vp!
  }
  const disc = COMMON.vpRect
  const center = { x: disc.x + disc.w / 2, y: disc.y + disc.h / 2 }
  const V = COMMON.vp
  const width = (text: string, size: number) => ctx.measurer.width(text, 'proto', size)

  it('centers a numeral alone as one big glyph in the outline', () => {
    const layout = layoutCard(card({ vp: vp('3') }), ctx)
    const [three] = proto(layout, '3')
    expect(three.size).toBe(V.flatSize)
    expect(three.outline).toEqual(V.outline)
    const cap = ctx.measurer.capHeight('proto', V.flatSize)
    const ink = ctx.measurer.inkBounds('3', 'proto', V.flatSize)
    expect(three.y - cap / 2).toBeCloseTo(center.y)
    expect(three.x + (ink.x1 + ink.x2) / 2).toBeCloseTo(center.x)
  })

  it('sets a negative value the same way, the sign part of the numeral', () => {
    const layout = layoutCard(card({ vp: vp('-1') }), ctx)
    const [minusOne] = proto(layout, '-1')
    expect(minusOne.size).toBe(V.flatSize)
    expect(minusOne.outline).toEqual(V.outline)
    expect(minusOne.fill).toBe('#000')
    expect(plaques(layout)).toHaveLength(1) // the Mars disc; no second plaque
  })

  it('sets a row: the bare numeral at the ratio size in the outline, the braces as in any row', () => {
    const layout = layoutCard(card({ vp: vp('1 {/ 2 ocean}') }), ctx)
    expect(layout.warnings).toEqual([])
    const [one] = proto(layout, '1')
    expect(one.size).toBe(V.textSize)
    expect(one.outline).toEqual(V.outline)
    const [two] = proto(layout, '2')
    expect(two.size).toBe(V.countSize)
    expect(two.outline).toBeUndefined()
    const [tile] = icons(layout, 'ocean')
    expect(tile.h).toBeCloseTo(V.iconH)
    // the slash is the one bar, here too
    expect(slash(layout).h).toBeCloseTo(SLASH.h)
    // the row centers on the disc; the numeral's outlined box (ink plus the
    // bands' reach) and the tile are centered on each other and as tall as
    // each other
    const cap = ctx.measurer.capHeight('proto', V.textSize)
    const ink = ctx.measurer.inkBounds('1', 'proto', V.textSize)
    const reach = V.outline.bands.reduce((sum, band) => sum + band.width, 0) - V.outline.inset
    expect(one.y - cap / 2).toBeCloseTo(center.y)
    expect(tile.y + tile.h / 2).toBeCloseTo(center.y)
    expect((one.x + ink.x1 - reach + tile.x + tile.w) / 2).toBeCloseTo(center.x)
    expect(cap + 2 * reach).toBeCloseTo(tile.h, 1)
    // one gap throughout: from the outline's edge outside the braces, from
    // the digit's advance in
    expect(slash(layout).x - (one.x + ink.x2 + reach)).toBeCloseTo(V.gap)
    expect(tile.x - (two.x + width('2', two.size))).toBeCloseTo(V.gap)
  })

  it('shrinks nothing: a row wider than the disc holds warns', () => {
    const layout = layoutCard(card({ vp: vp('1 {/ 2 ocean ocean}') }), ctx)
    for (const tile of icons(layout, 'ocean')) expect(tile.h).toBeCloseTo(V.iconH)
    expect(proto(layout, '1')[0].size).toBe(V.textSize)
    expect(layout.warnings.map((w) => w.message)).toEqual([
      expect.stringContaining('VP disc content is'),
    ])
  })
})

describe('card number', () => {
  const m = testFonts()
  const numberNode = (l: CardLayout, text: string) =>
    l.nodes.find((n): n is TextNode => n.kind === 'text' && n.text === text)!
  /** the run's drawn width: the advances plus the gaps between them */
  const runWidth = (n: TextNode) =>
    m.width(n.text, n.font, n.size) + (n.letterSpacing ?? 0) * (n.text.length - 1)

  it("sets three characters at the officials' size and tracking, centered on the box", () => {
    const layout = layoutCard(card({ number: '055' }), ctx)
    const n = numberNode(layout, '055')
    expect(n.size).toBe(NUM_TYPE.size)
    expect(n.letterSpacing).toBe(NUM_TYPE.tracking)
    expect(n.anchor).toBe('start')
    const { numCenter } = layout.frame.regions
    expect(n.x + runWidth(n) / 2).toBeCloseTo(numCenter.x, 9)
    expect(n.y - m.capHeight('proto', n.size) / 2).toBeCloseTo(numCenter.y, 9)
    expect(runWidth(n)).toBeLessThanOrEqual(NUM_TYPE.room)
  })

  it('keeps the tracking fixed: a narrow 1 makes a shorter run, still centered', () => {
    const wide = numberNode(layoutCard(card({ number: '000' }), ctx), '000')
    const narrow = numberNode(layoutCard(card({ number: '211' }), ctx), '211')
    expect(narrow.letterSpacing).toBe(wide.letterSpacing)
    expect(runWidth(narrow)).toBeLessThan(runWidth(wide) - 0.5)
    expect(narrow.x + runWidth(narrow) / 2).toBeCloseTo(wide.x + runWidth(wide) / 2, 9)
  })

  it('closes the gaps of a four-character run to fit the box at full size', () => {
    const layout = layoutCard(card({ number: '1234' }), ctx)
    const n = numberNode(layout, '1234')
    expect(n.size).toBe(NUM_TYPE.size)
    expect(n.letterSpacing).toBeGreaterThan(0)
    expect(n.letterSpacing).toBeLessThan(NUM_TYPE.tracking)
    expect(runWidth(n)).toBeCloseTo(NUM_TYPE.room, 9)
    expect(n.x + runWidth(n) / 2).toBeCloseTo(layout.frame.regions.numCenter.x, 9)
  })

  it('shrinks the type once even solid glyphs overflow the box', () => {
    const layout = layoutCard(card({ number: '0000' }), ctx)
    const n = numberNode(layout, '0000')
    expect(n.letterSpacing).toBe(0)
    expect(n.size).toBeLessThan(NUM_TYPE.size)
    expect(n.size).toBeGreaterThan(1.2)
    expect(runWidth(n)).toBeCloseTo(NUM_TYPE.room, 9)
    expect(n.x + runWidth(n) / 2).toBeCloseTo(layout.frame.regions.numCenter.x, 9)
  })
})
