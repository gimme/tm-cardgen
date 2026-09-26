// Rows measured into chunks: a chunk is a block of layout primitives with
// its size. The Engine builds them; layout.ts places them on the card.
import { HALO } from '../frame/halo.ts'
import { COLON, SLASH, slashWidth } from '../frame/operators.ts'
import type { Pt } from '../frame/paths.ts'
import { ICONS, type IconDef } from '../icons.ts'
import type { IconToken, Operator, RichTextItem, Stack } from '../spec/richtext.ts'
import type { Requirement, Row } from '../spec/types.ts'
import { COMMON, PROD_BOX } from './frames.ts'
import type { LayoutNode, LayoutWarning, TextNode, TextOutline } from './model.ts'
import { spacedWidth, type FontId, type TextMeasurer } from './measure.ts'
import { wrapText } from './wrap.ts'

// ---- tunables ------------------------------------------------------------
/** between lines: the rows of a flow and the lines of a stack alike */
export const LINE_GAP = 2.0
/** between elements written in one {braces} */
const TOKEN_GAP = 1.0
/** between separate elements */
const GROUP_GAP = 2.0
/** directive text, the bare words: mm em, lead between lines, and the
 *  extra mm on every letter gap and every space (negative tightens) */
const DIRECTIVE = { size: 2.65, lineSpace: 0.75, tracking: -0.06, wordSpacing: -0.1 }
/** text in braces ({4 heat}, {OR 3}): mm em */
const COUNT_TEXT_SIZE = 3.9
/** a symbol standing alone in braces ({+}, {:}): mm em */
export const OPERATOR_TEXT_SIZE = 5.3
export interface ElementStyle {
  bigSize: number
  textSize: number
  /** bare text's face, and its lead, tracking and word spacing when it wraps */
  textFont: FontId
  textLineSpace: number
  textTracking: number
  textWordSpacing: number
  /** an operator glyph's em */
  opSize: number
  iconH?: number
  /** around bare text; text in braces prints plain */
  outline?: TextOutline
  /** icon presets scale by this */
  scale: number
  /** between elements sharing braces / separate elements */
  gap: { tight: number; loose: number }
  /** between the lines of a stack */
  lineGap: number
  prodScale: number
  prodPad?: number
}
export const bodyStyle = (scale: number): ElementStyle => ({
  bigSize: COUNT_TEXT_SIZE * scale,
  textSize: DIRECTIVE.size * scale,
  textFont: 'sansBold',
  textLineSpace: DIRECTIVE.lineSpace * scale,
  textTracking: DIRECTIVE.tracking * scale,
  textWordSpacing: DIRECTIVE.wordSpacing * scale,
  opSize: OPERATOR_TEXT_SIZE * scale,
  scale,
  gap: { tight: TOKEN_GAP, loose: GROUP_GAP },
  lineGap: LINE_GAP,
  prodScale: scale,
})
const boxStyle = (scale: number): ElementStyle => ({
  ...bodyStyle(scale),
  gap: { tight: PROD_BOX.itemGap * scale, loose: PROD_BOX.itemGap * scale },
  lineGap: PROD_BOX.lineGap * scale,
})
const RULES_INK = '#111'

// ---- icons ---------------------------------------------------------------
/** the icon's own drawing: its vector markup, or its image */
function iconNode(def: IconDef, x: number, y: number, w: number, h: number): LayoutNode {
  return def.vector
    ? { kind: 'vector', icon: def.vector, x, y, w, h }
    : { kind: 'image', asset: { type: 'asset', path: def.file }, x, y, w, h }
}

/** A registered icon by itself at its body height, for showing it off. */
export function iconSample(name: string): Chunk {
  const def = ICONS[name]
  const h = def.h
  const w = h * def.aspect
  return { w, h, nodes: [iconNode(def, 0, 0, w, h)] }
}

// ---- chunk machinery -----------------------------------------------------
/** A measured block of primitives with (0,0) at its top-left. */
export interface Chunk {
  w: number
  h: number
  nodes: LayoutNode[]
  /** a {3mm} spacer or a |3mm| line: its width (height) is the whole
   *  distance to its neighbours, so no gap is added beside it */
  spacer?: boolean
  /** the {braces} the element was written in; neighbours sharing one sit
   *  at the tight gap */
  group?: number
  /** a footnote mark (icons.ts): hangs off the element before it */
  note?: true
  /** the corner a note hangs off, from this chunk's top-left: the mark's
   *  left edge there, its center level with it. Absent, the top-right. */
  noteCorner?: Pt
}

export function shift(nodes: LayoutNode[], dx: number, dy: number): LayoutNode[] {
  return nodes.map((n) => {
    // fixed-position elements, never part of a chunk
    if (n.kind === 'frame' || n.kind === 'reqbox') return n
    const moved = { ...n, x: n.x + dx, y: n.y + dy }
    if (n.kind === 'image' && n.clip) {
      ;(moved as typeof n).clip = { ...n.clip, x: n.clip.x + dx, y: n.clip.y + dy }
    }
    if (n.kind === 'rect' && n.patternOrigin) {
      ;(moved as typeof n).patternOrigin = {
        x: n.patternOrigin.x + dx,
        y: n.patternOrigin.y + dy,
      }
    }
    return moved
  })
}

/** a note hangs off the element before it in its braces, but not off a
 *  spacer or another note */
function hosts(a: Chunk, b: Chunk): boolean {
  return b.note === true && b.group !== undefined && a.group === b.group && !a.spacer && !a.note
}

/** the note's top-left from its host's */
function noteOffset(host: Chunk, note: Chunk): Pt {
  const [x, y] = host.noteCorner ?? [host.w, 0]
  return [x, y - note.h / 2]
}

function between(a: Chunk, b: Chunk, tight: number, loose: number): number {
  if (hosts(a, b)) return noteOffset(a, b)[0] - a.w
  if (a.spacer || b.spacer) return 0
  return a.group !== undefined && a.group === b.group ? tight : loose
}

function gapsAcross(chunks: Chunk[], tight: number, loose: number): number {
  let sum = 0
  for (let i = 1; i < chunks.length; i++) sum += between(chunks[i - 1], chunks[i], tight, loose)
  return sum
}

/** side by side, centered on each other. A note hangs off its host's
 *  top-right corner and rides above the row's height like the printed ones. */
function hstack(chunks: Chunk[], tight: number, loose = tight): Chunk {
  const hosted = (i: number) => i > 0 && hosts(chunks[i - 1], chunks[i])
  const h = Math.max(0, ...chunks.filter((_, i) => !hosted(i)).map((c) => c.h))
  let x = 0
  const nodes: LayoutNode[] = []
  chunks.forEach((c, i) => {
    const y = hosted(i)
      ? (h - chunks[i - 1].h) / 2 + noteOffset(chunks[i - 1], c)[1]
      : (h - c.h) / 2
    nodes.push(...shift(c.nodes, x, y))
    x += c.w
    if (i + 1 < chunks.length) x += between(c, chunks[i + 1], tight, loose)
  })
  return { w: Math.max(0, x), h, nodes }
}

function vgap(a: Chunk, b: Chunk, gap: number): number {
  return a.spacer || b.spacer ? 0 : gap
}

/** one under the other, centered on each other */
function vstack(chunks: Chunk[], gap: number): Chunk {
  const w = Math.max(0, ...chunks.map((c) => c.w))
  let y = 0
  const nodes: LayoutNode[] = []
  chunks.forEach((c, i) => {
    nodes.push(...shift(c.nodes, (w - c.w) / 2, y))
    y += c.h
    if (i + 1 < chunks.length) y += vgap(c, chunks[i + 1], gap)
  })
  return { w, h: Math.max(0, y), nodes }
}

// ---- lines ---------------------------------------------------------------
/** a row of items, or the distance a |3mm| break stands for */
export type Line = { items: RichTextItem[] } | { space: number }

/** Split at breaks; empty lines drop, a gapped break becomes a spacer line. */
function toLines(items: RichTextItem[]): Line[] {
  const lines: Line[] = []
  let line: RichTextItem[] = []
  const flush = () => {
    if (line.some((it) => it.kind !== 'spacer')) lines.push({ items: line })
    line = []
  }
  for (const item of items) {
    if (item.kind !== 'break') {
      line.push(item)
      continue
    }
    flush()
    if (item.gap !== undefined) lines.push({ space: item.gap })
  }
  flush()
  return lines
}

/** the rows joined by plain breaks, so a bare | in a row is a new row */
export function flowLines(rows: Row[]): Line[] {
  const items: RichTextItem[] = []
  rows.forEach((row, i) => {
    if (i > 0) items.push({ kind: 'break', start: 0, end: 0 })
    items.push(...row)
  })
  return toLines(items)
}

/** wrapping elements share the width the fixed ones leave */
function wraps(item: RichTextItem): boolean {
  return (
    item.kind === 'rules' ||
    (item.kind === 'text' && !item.big) ||
    (item.kind === 'stack' && item.items.some(wraps))
  )
}

// ---- engine --------------------------------------------------------------
export class Engine {
  warnings: LayoutWarning[] = []
  readonly m: TextMeasurer

  constructor(m: TextMeasurer) {
    this.m = m
  }

  warn(message: string) {
    if (!this.warnings.some((w) => w.message === message)) this.warnings.push({ message })
  }

  /** Boxed by advance and cap; outlined text by its ink plus the bands' reach. */
  textChunk(text: string, font: FontId, size: number, fill: string, outline?: TextOutline): Chunk {
    const cap = this.m.capHeight(font, size)
    if (!outline) {
      const node: TextNode = { kind: 'text', font, size, x: 0, y: cap, text, fill, anchor: 'start' }
      return { w: this.m.width(text, font, size), h: cap, nodes: [node] }
    }
    const reach = outline.bands.reduce((sum, band) => sum + band.width, 0) - outline.inset
    const ink = this.m.inkBounds(text, font, size)
    const node: TextNode = {
      kind: 'text',
      font,
      size,
      x: reach - ink.x1,
      y: reach + cap,
      text,
      fill,
      anchor: 'start',
      outline,
    }
    return { w: ink.x2 - ink.x1 + 2 * reach, h: cap + 2 * reach, nodes: [node] }
  }

  /** at the preset height times `scale`, or at `h`; a note keeps its preset */
  iconChunk(item: IconToken, scale: number, h?: number): Chunk {
    const def = ICONS[item.name]
    if (!def) return this.textChunk(`{${item.name}}`, 'proto', 3 * scale, '#c00')
    if (def.note || h === undefined) h = def.h * scale
    const w = h * def.aspect
    const nodes: LayoutNode[] = []
    let boxW = w
    let boxH = h
    let ix = 0
    let iy = 0
    if (item.red && def.halo) {
      // the box counts only part of the ring; the rest overlaps the gap
      const scale = Math.min(1, h / HALO.fullFrom)
      const counted = HALO.width * scale * HALO.counted
      boxW = w + 2 * counted
      boxH = h + 2 * counted
      ix = iy = counted
      nodes.push({ kind: 'halo', shape: def.halo, x: ix, y: iy, w, h, scale })
    }
    nodes.push(iconNode(def, ix, iy, w, h))
    if (item.inscription !== undefined) {
      // the inscription's em and baseline as fractions of the coin's height
      const size = h * 0.565
      nodes.push({
        kind: 'text',
        font: 'proto',
        size,
        x: boxW / 2,
        y: boxH / 2 + size * 0.36,
        text: item.inscription,
        fill: '#000',
        anchor: 'middle',
      })
    }
    // a note hangs off the box's top-right corner (a ring's counted share
    // included), moved by the icon's own fix-up (icons.ts)
    const [dx, dy] = def.noteAt ?? [0, 0]
    const noteCorner: Pt = [boxW + dx * scale, dy * scale]
    return { w: boxW, h: boxH, nodes, noteCorner, ...(def.note && { note: true }) }
  }

  /** boxed by its ink so it centers like an icon; the minus is the en dash */
  operatorChunk(op: Exclude<Operator, '/' | ':'>, style: ElementStyle): Chunk {
    const text = op === '-' ? '–' : op
    const size = style.opSize
    const b = this.m.inkBounds(text, 'proto', size)
    return {
      w: b.x2 - b.x1,
      h: b.y2 - b.y1,
      nodes: [
        {
          kind: 'text',
          font: 'proto',
          size,
          x: -b.x1,
          y: -b.y1,
          text,
          fill: '#000',
          anchor: 'start',
        },
      ],
    }
  }

  slashChunk(h: number): Chunk {
    const w = slashWidth(h)
    return { w, h, nodes: [{ kind: 'vector', icon: 'slash', x: 0, y: 0, w, h }] }
  }

  colonChunk(em: number): Chunk {
    const w = COLON.dot * em
    const h = COLON.span * em
    return { w, h, nodes: [{ kind: 'vector', icon: 'colon', x: 0, y: 0, w, h }] }
  }

  elementChunk(
    item: Exclude<RichTextItem, { kind: 'rules' | 'break' }>,
    style: ElementStyle,
    maxW = 0,
  ): Chunk {
    switch (item.kind) {
      case 'text': {
        const chunk = item.big
          ? this.textChunk(item.text, 'proto', style.bigSize, '#000')
          : this.directiveChunk(item.text, style, maxW)
        return { ...chunk, group: item.group }
      }
      case 'icon':
        return { ...this.iconChunk(item, style.scale, style.iconH), group: item.group }
      case 'op': {
        const chunk =
          item.op === '/'
            ? this.slashChunk(SLASH.h * style.scale)
            : item.op === ':'
              ? this.colonChunk(style.opSize)
              : this.operatorChunk(item.op, style)
        return { ...chunk, group: item.group }
      }
      case 'spacer':
        return { w: item.w, h: 0, nodes: [], spacer: true, group: item.group }
      case 'stack':
        return this.stackChunk(item, style, maxW)
    }
  }

  /** bare, or in the production box at its scale and gaps */
  stackChunk(stack: Stack, style: ElementStyle, maxW: number): Chunk {
    if (!stack.box) return this.linesChunk(stack.items, style, maxW)
    const scale = style.prodScale
    const pad = style.prodPad ?? PROD_BOX.pad * scale
    const inner = this.linesChunk(stack.items, boxStyle(scale), Math.max(0, maxW - 2 * pad))
    const w = inner.w + pad * 2
    const h = inner.h + pad * 2
    const b = PROD_BOX.border
    return {
      w,
      h,
      nodes: [
        { kind: 'rect', x: 0, y: 0, w, h, fill: '#808080', gradient: 'prod-outer' },
        {
          kind: 'rect',
          x: b,
          y: b,
          w: w - 2 * b,
          h: h - 2 * b,
          fill: '#7a5236',
          gradient: 'prod-inner',
        },
        {
          kind: 'rect',
          x: 2 * b,
          y: 2 * b,
          w: w - 4 * b,
          h: h - 4 * b,
          fill: 'production-pattern',
          patternOrigin: { x: 0, y: 0 },
        },
        ...shift(inner.nodes, pad, pad),
      ],
    }
  }

  linesChunk(items: RichTextItem[], style: ElementStyle, maxW: number): Chunk {
    return vstack(
      toLines(items).map((line) => this.lineChunk(line, style, maxW)),
      style.lineGap,
    )
  }

  lineChunk(line: Line, style: ElementStyle, maxW: number): Chunk {
    if ('space' in line) return { w: 0, h: line.space, nodes: [], spacer: true }
    return this.rowChunk(line.items, maxW, style)
  }

  /** (0,0) at the first line's cap top; lines center when the block stands
   *  alone in its row */
  rulesChunk(text: string, maxW: number, alone: boolean): Chunk {
    const R = COMMON.rules
    const font: FontId = 'serif'
    const advance = R.size + R.lineSpace
    const lines = wrapText(text, maxW, (t) => this.m.width(t, font, R.size))
    const w = Math.max(0, ...lines.map((l) => l.w))
    const cap = this.m.capHeight(font, R.size)
    const nodes: LayoutNode[] = lines.map((line, i) => ({
      kind: 'text',
      font,
      size: R.size,
      x: alone ? w / 2 : 0,
      y: cap + i * advance,
      text: line.text,
      fill: RULES_INK,
      anchor: alone ? 'middle' : 'start',
    }))
    return {
      w,
      h: lines.length === 0 ? 0 : cap + (lines.length - 1) * advance + R.size * 0.25,
      nodes,
    }
  }

  /** With a width, the wrapped directive block, lines centered; without,
   *  one line in the style's face and outline. */
  directiveChunk(text: string, style: ElementStyle, maxW: number): Chunk {
    const font = style.textFont
    const size = style.textSize
    if (maxW <= 0)
      return this.textChunk(text.split(/\s+/).join(' '), font, size, '#000', style.outline)
    const cap = this.m.capHeight(font, size)
    const advance = size + style.textLineSpace
    const ls = style.textTracking
    const ws = style.textWordSpacing
    const lines = wrapText(text, maxW, (t) => spacedWidth(this.m, t, font, size, ls, ws))
    const w = Math.max(0, ...lines.map((l) => l.w))
    // start-anchored: the browser's letter-spacing trails the last letter,
    // so a middle anchor would drift
    const nodes: LayoutNode[] = lines.map((line, i) => ({
      kind: 'text',
      font,
      size,
      x: (w - line.w) / 2,
      y: cap + i * advance,
      text: line.text,
      fill: '#000',
      anchor: 'start',
      letterSpacing: ls,
      wordSpacing: ws,
    }))
    return { w, h: cap + (lines.length - 1) * advance, nodes }
  }

  /** wrapping elements share the width the fixed ones leave */
  rowChunk(row: RichTextItem[], maxW: number, style: ElementStyle = bodyStyle(1)): Chunk {
    const items = row.filter(
      (it): it is Exclude<RichTextItem, { kind: 'break' }> => it.kind !== 'break',
    )
    // the wrapping elements stand in at no width until the others are measured
    const fixed = items.map((item) =>
      item.kind === 'rules' || wraps(item)
        ? { w: 0, h: 0, nodes: [] }
        : this.elementChunk(item, style),
    )
    const { tight, loose } = style.gap
    const fixedW = fixed.reduce((s, c) => s + c.w, 0)
    const gaps = gapsAcross(fixed, tight, loose)
    const wrapping = items.filter(wraps).length
    const share = wrapping > 0 ? Math.max(0, maxW - fixedW - gaps) / wrapping : 0
    const chunks = items.map((item, i) =>
      !wraps(item)
        ? fixed[i]
        : item.kind === 'rules'
          ? this.rulesChunk(item.text, share, items.length === 1)
          : this.elementChunk(item, style, share),
    )
    return hstack(chunks, tight, loose)
  }

  requirementChunk(requirement: Requirement): Chunk {
    const req = COMMON.reqBar
    const style: ElementStyle = {
      bigSize: req.textSize,
      textSize: req.textSize,
      textFont: 'proto',
      textLineSpace: 0,
      textTracking: 0,
      textWordSpacing: 0,
      opSize: OPERATOR_TEXT_SIZE * (req.textSize / COUNT_TEXT_SIZE),
      iconH: req.iconH,
      scale: 1,
      gap: { tight: req.gap, loose: req.gap },
      lineGap: LINE_GAP,
      prodScale: req.prodScale,
      prodPad: req.prodPad,
    }
    return this.rowChunk(withMaxWord(requirement), 0, style)
  }
}

/** the max box spells "max" out before its contents */
function withMaxWord(req: Requirement): RichTextItem[] {
  if (!req.max) return req.items
  const [first, ...rest] = req.items
  if (first?.kind === 'text') return [{ ...first, text: `max ${first.text}` }, ...rest]
  return [{ kind: 'text', text: 'max', big: false, start: 0, end: 0 }, ...req.items]
}
