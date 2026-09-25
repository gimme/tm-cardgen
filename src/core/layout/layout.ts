// layoutCard: CardSpec to CardLayout. Rows stack down at a fixed gap, each
// centered on the card axis; a row's elements center vertically on each
// other, and rules text takes the width the others leave. The frame sizes
// its box to the rows. A VP disc narrows the rows beside it; a row too wide
// for that moves up clear of it. Flavor is bottom-anchored on a fixed
// baseline. The renderers only serialize the result.
import { CARD_H, CARD_W, type Rect } from '../units.ts'
import { backdropLuma } from '../frame/backdrop.ts'
import { nameSeed } from '../frame/crystal.ts'
import { REQ_BOX } from '../frame/reqbox.ts'
import { placeSeam } from '../frame/spec.ts'
import { tagFile } from '../icons.ts'
import type { CardSpec, CardType, Row } from '../spec/types.ts'
import { coverFit, meanBrightness } from './art.ts'
import { bodyStyle, Engine, flowLines, LINE_GAP, shift } from './chunks.ts'
import {
  ACTION,
  ART_MIN_H,
  COMMON,
  FRAME_BODY,
  frameRegions,
  TITLE_SHRINK_TO,
  TITLE_SIZE,
  TITLE_STYLES,
  TITLE_TRACKING,
  NUM_TYPE,
  vpFloorBody,
  type FrameColor,
  type FrameRegions,
  type TitleStyle,
} from './frames.ts'
import type { CardLayout, LayoutNode } from './model.ts'
import { spacedWidth, type FontId, type TextMeasurer } from './measure.ts'
import { wrapText } from './wrap.ts'

export interface LayoutContext {
  measurer: TextMeasurer
  /** intrinsic pixel size of user art, when available */
  artSize?: (file: string) => { w: number; h: number } | undefined
  /** mean brightness (0..1) of a region of the art, the region in fractions
   *  of the image; undefined when unknown */
  artBrightness?: (file: string, region: Rect) => number | undefined
}

const VP_ROW_CLEAR = 1.0 // a row pushed clear of the VP disc keeps this above it
const ART_OVERSHOOT = 0.8 // art drawn past the window so the rim blends

// ---- artist credit -------------------------------------------------------
const CREDIT = {
  font: 'serif' as FontId,
  size: 1.3,
  /** baseline inset from the window's right edge */
  inset: 0.27,
  /** run start above the window's bottom, and clearance under its top */
  gap: 1.0,
  /** brightness is sampled this far around the glyph column */
  pad: 0.4,
  /** black ink above this mean brightness of the art behind the run */
  darkAbove: 0.6,
}

// ---- title size ----------------------------------------------------------
// Titles never wrap. EASE shrinks a wide name for looks, FIT keeps it inside
// the plate; the smaller wins, in 0.1mm steps. Letters scale, tracking gaps
// don't.
export function titleSize(name: string, ts: TitleStyle, m: TextMeasurer): number {
  const glyphs = m.width(name, 'proto', TITLE_SIZE)
  const track = TITLE_TRACKING * Math.max(0, name.length - 1)
  const want = glyphs + track
  if (glyphs <= 0) return TITLE_SIZE
  // the ease's far end is given as a DRAWN width, so convert: what does a
  // name that draws shrinkUntil at TITLE_SHRINK_TO want at full size?
  const until = track + ((ts.shrinkUntil - track) * TITLE_SIZE) / TITLE_SHRINK_TO
  const span = Math.max(0.1, until - ts.shrinkAt)
  const over = Math.min(1, Math.max(0, (want - ts.shrinkAt) / span))
  const eased = TITLE_SIZE - (TITLE_SIZE - TITLE_SHRINK_TO) * over
  const fitted = (TITLE_SIZE * (ts.maxWidth - track)) / glyphs
  return Math.max(0.1, Math.floor(Math.min(TITLE_SIZE, eased, fitted) * 10) / 10)
}

// ---- the flow ------------------------------------------------------------
/** The column rows center in. */
interface Flow {
  cx: number
  w: number
}

const BODY_FLOW: Flow = { cx: COMMON.cx, w: COMMON.flow.w }

/** the width left of the VP disc, and the y a row must clear when it does
 *  not fit there */
const VP = (() => {
  const left = BODY_FLOW.cx - BODY_FLOW.w / 2
  const right = COMMON.vpRect.x + COMMON.vpMargin - COMMON.vpClear
  return {
    corridor: { cx: (left + right) / 2, w: right - left } as Flow,
    clearY: COMMON.vpRect.y + COMMON.vpMargin - VP_ROW_CLEAR,
  }
})()

interface PlacedFlow {
  nodes: LayoutNode[]
  /** top edge of the first row (= `bottom` with no rows) */
  top: number
}

/** Lines placed bottom-up so the last ends at `bottom`. Beside the VP disc
 *  a line takes the narrower width if it fits, else moves up clear of it. */
function placeFlow(
  engine: Engine,
  rows: Row[],
  flow: Flow,
  bottom: number,
  vp: boolean,
): PlacedFlow {
  const nodes: LayoutNode[] = []
  const lines = flowLines(rows)
  let y = bottom
  let top = bottom
  for (let i = lines.length - 1; i >= 0; i--) {
    let chunk = engine.lineChunk(lines[i], bodyStyle(1), flow.w)
    let cx = flow.cx
    if (vp && y > VP.clearY + 1e-6) {
      const narrow = engine.lineChunk(lines[i], bodyStyle(1), VP.corridor.w)
      if (narrow.w <= VP.corridor.w + 1e-6) {
        chunk = narrow
        cx = VP.corridor.cx
      } else {
        y = VP.clearY
      }
    }
    nodes.push(...shift(chunk.nodes, cx - chunk.w / 2, y - chunk.h))
    top = y - chunk.h
    const spaced = 'space' in lines[i] || (i > 0 && 'space' in lines[i - 1])
    y = top - (i > 0 && !spaced ? LINE_GAP : 0)
  }
  return { nodes, top }
}

/** Rows in [top, bottom], centered when the box is taller. Centering can
 *  lift rows clear of the disc, so placement repeats until it settles. */
function centerFlow(
  engine: Engine,
  rows: Row[],
  flow: Flow,
  top: number,
  bottom: number,
  vp: boolean,
): LayoutNode[] {
  let b = bottom
  let placed = placeFlow(engine, rows, flow, b, vp)
  for (let k = 0; k < 8; k++) {
    const slack = bottom - top - (b - placed.top)
    if (slack <= 1e-6) break
    const next = bottom - slack / 2
    if (Math.abs(next - b) < 1e-6) break
    b = next
    placed = placeFlow(engine, rows, flow, b, vp)
  }
  return placed.nodes
}

/** Warn on any row wider than the flow. */
function checkRowWidths(engine: Engine, rows: Row[], flow: Flow, what: string) {
  flowLines(rows).forEach((line, i) => {
    const over = engine.lineChunk(line, bodyStyle(1), flow.w).w - flow.w
    if (over > 0.05) engine.warn(`${what} row ${i + 1} is ${over.toFixed(1)}mm too wide — split it`)
  })
}

const TYPE_COLOR: Record<CardType, FrameColor> = {
  automated: 'green',
  event: 'red',
  active: 'blue',
}

/** One entry per line with its own baseline; the last line may run
 *  full-width under the VP disc. */
interface FlavorBlock {
  lines: { text: string; x: number; baseline: number; w: number }[]
  /** separator rule y (above the top line's ascenders) */
  sepY: number
  sepStart: number
  sepEnd: number
}

function buildFlavor(flavor: string, vpPresent: boolean, m: TextMeasurer): FlavorBlock {
  const F = COMMON.flavor
  const cx = COMMON.cx
  const fmeasure = (s: string) => m.width(s, 'serifBoldItalic', F.size)
  let lines = wrapText(flavor, vpPresent ? F.vpW : F.w, (t) =>
    m.width(t, 'serifBoldItalic', F.size),
  ).map((l) => l.text)
  if (vpPresent && lines.length > 1 && !flavor.includes('\n')) {
    // one full-width line under the disc beats two beside it
    const whole = lines.join(' ')
    if (fmeasure(whole) <= F.oneLineMax) lines = [whole]
  }
  const n = lines.length
  // only a multi-line block shifts beside the disc
  const singleUnder = vpPresent && n === 1
  const axis = vpPresent && !singleUnder ? COMMON.vpShiftX : cx
  const placed = lines.map((text, i) => ({
    text,
    x: !vpPresent || singleUnder ? cx : COMMON.vpShiftX,
    baseline: F.bottom - (n - 1 - i) * F.lineH,
    w: fmeasure(text),
  }))
  // the rule is centered on the block and never overlaps the disc
  const sepY = F.bottom - (n - 1) * F.lineH - Math.round(F.size * 11) / 10
  const half = Math.max(...placed.map((l) => l.w)) / 2 - 2.1
  const sepStart = Math.max(4.0, axis - half)
  let sepEnd = axis + half
  if (vpPresent) {
    const vp = COMMON.vpRect
    let cap = vp.x + COMMON.vpMargin + COMMON.vpClear
    const vcx = vp.x + vp.w / 2
    const vcy = vp.y + vp.h / 2
    const vr = vp.w / 2 - COMMON.vpMargin // visible circle inside the block PNG
    const dy = sepY - vcy
    if (Math.abs(dy) < vr) {
      // the rule stops short of where the circle's edge crosses its own height
      cap = Math.min(cap, vcx - Math.sqrt(vr * vr - dy * dy) - COMMON.vpClear)
    }
    sepEnd = Math.min(sepEnd, cap)
  }
  return { lines: placed, sepY, sepStart, sepEnd }
}

/** mm rounded up to the next 0.1 */
const ceil10 = (v: number) => Math.ceil(v * 10 - 1e-6) / 10

export function layoutCard(spec: CardSpec, ctx: LayoutContext): CardLayout {
  const engine = new Engine(ctx.measurer)
  const m = ctx.measurer
  const color = TYPE_COLOR[spec.type]
  const isBlue = color === 'blue'
  const vpPresent = spec.vp !== undefined

  // ---- flavor (frame-independent) ----------------------------------------
  const flavorBlock = spec.flavor ? buildFlavor(spec.flavor, vpPresent, m) : undefined
  // the body flow ends above the separator, or the flavor zone without one
  const flowBottom = flavorBlock ? flavorBlock.sepY - 1.2 : COMMON.flavor.bottom - 2.2

  // ---- body: size the frame to the rows ----------------------------------
  checkRowWidths(engine, spec.body, BODY_FLOW, 'body')
  const bodyFlow = placeFlow(engine, spec.body, BODY_FLOW, flowBottom, vpPresent)
  const bodyWanted = ceil10(COMMON.flavor.bottom - bodyFlow.top)
  // VP cards stop at the small body, which keeps the disc on the panel
  const bodyFloor = vpPresent ? Math.max(FRAME_BODY.min, vpFloorBody(color)) : FRAME_BODY.min
  const bodyMax = FRAME_BODY.max[color]
  const bodyH = Math.min(bodyMax, Math.max(bodyFloor, bodyWanted))
  if (bodyWanted > bodyMax + 1e-6) {
    engine.warn(`body overflows by ${(bodyWanted - bodyMax).toFixed(1)}mm — trim it`)
  }

  // ---- action area (blue): the divider follows the rows -------------------
  let artTop: number | undefined
  const active = spec.active ?? []
  if (isBlue) {
    checkRowWidths(engine, active, BODY_FLOW, 'active')
    const h = -placeFlow(engine, active, BODY_FLOW, 0, false).top
    const wanted = ceil10(ACTION.top + h + ACTION.pad)
    // the body has first call on the window; the action area takes the rest
    const base = frameRegions(color, bodyH).artWindow
    const artTopMax = base.y + base.h - ART_MIN_H
    artTop = Math.min(artTopMax, Math.max(ACTION.minArtTop, wanted))
    if (wanted > artTopMax + 1e-6) {
      engine.warn(`action area overflows by ${(wanted - artTopMax).toFixed(1)}mm — trim it`)
    }
  }

  const regions = frameRegions(color, bodyH, artTop)
  const artWin = regions.artWindow
  const req = requirementNodes(spec, engine)
  // the seam moves right of the requirement bar and left of a 4th tag (placeSeam)
  const tagCount = Math.min(spec.tags.length, COMMON.tagSlots.xs.length)
  const tagsLeft = tagCount > 0 ? COMMON.tagSlots.xs[tagCount - 1] : undefined
  const seamX = placeSeam(color, req.right, tagsLeft)
  const backing = placeBacking(spec, artWin, ctx)
  const nodes: LayoutNode[] = [
    ...backgroundNodes(backing, artWin, engine),
    ...frameNodes(color, regions, seamX, spec.seed ?? nameSeed(spec.name)),
    ...req.nodes,
    ...costNodes(spec, m),
    ...tagNodes(spec, engine),
    ...titleNodes(spec, color, m),
    ...fanMadeNodes(regions),
    ...cardNumberNodes(spec, regions, m),
    // under the rows and flavor, which may draw over its transparent margin
    ...vpNodes(spec, engine),
  ]

  // ---- the flows, placed in their boxes ----------------------------------
  if (isBlue) {
    nodes.push(...centerFlow(engine, active, BODY_FLOW, ACTION.top, artTop! - ACTION.pad, false))
  }
  nodes.push(...centerFlow(engine, spec.body, BODY_FLOW, regions.bodyTop, flowBottom, vpPresent))
  nodes.push(...flavorNodes(flavorBlock), ...creditNodes(spec, artWin, backing, engine, ctx))

  return { nodes, warnings: engine.warnings, frame: { color, regions } }
}

// ---- card regions --------------------------------------------------------
// One function per region; layoutCard concatenates them in paint order.

/** What fills the art window: cover-fitted art, the drawn backdrop, or a
 *  missing file's name. */
type Backing =
  | { kind: 'art'; file: string; rect: Rect; clip: Rect }
  | { kind: 'backdrop'; rect: Rect }
  | { kind: 'missing'; file: string }

/** the window grown by ART_OVERSHOOT, so the rim's anti-aliasing blends
 *  over the picture rather than white */
function bleed(artWin: Rect): Rect {
  const o = ART_OVERSHOOT
  return { x: artWin.x - o, y: artWin.y - o, w: artWin.w + 2 * o, h: artWin.h + 2 * o }
}

function placeBacking(spec: CardSpec, artWin: Rect, ctx: LayoutContext): Backing {
  const clip = bleed(artWin)
  if (!spec.art) return { kind: 'backdrop', rect: clip }
  const size = ctx.artSize?.(spec.art.file)
  if (!size) return { kind: 'missing', file: spec.art.file }
  const rect = coverFit(clip, size.w, size.h, spec.art.zoom, spec.art.offset)
  return { kind: 'art', file: spec.art.file, rect, clip }
}

function backgroundNodes(backing: Backing, artWin: Rect, engine: Engine): LayoutNode[] {
  const nodes: LayoutNode[] = [{ kind: 'rect', x: 0, y: 0, w: CARD_W, h: CARD_H, fill: '#ffffff' }]
  switch (backing.kind) {
    case 'art':
      nodes.push({
        kind: 'image',
        asset: { type: 'art', file: backing.file },
        ...backing.rect,
        clip: backing.clip,
      })
      break
    case 'backdrop':
      nodes.push({ kind: 'backdrop', ...backing.rect })
      break
    case 'missing':
      engine.warn(`art '${backing.file}' not found — add it in the Art manager`)
      nodes.push({ kind: 'rect', ...artWin, fill: 'checkerboard' })
      nodes.push({
        kind: 'text',
        font: 'proto',
        size: 2.6,
        x: artWin.x + artWin.w / 2,
        y: artWin.y + artWin.h / 2,
        text: backing.file,
        fill: '#666',
        anchor: 'middle',
      })
      break
  }
  return nodes
}

function frameNodes(
  color: FrameColor,
  regions: FrameRegions,
  seamX: number | undefined,
  seed: number,
): LayoutNode[] {
  const artBottom = regions.artWindow.y + regions.artWindow.h
  const artTop = color === 'blue' ? regions.artWindow.y : undefined
  return [{ kind: 'frame', color, artBottom, artTop, seamX, seed }]
}

/** `right` is the box's right edge, which the banner seam keeps clear of. */
function requirementNodes(spec: CardSpec, engine: Engine): { nodes: LayoutNode[]; right?: number } {
  if (!spec.requirement) {
    return { nodes: [{ kind: 'reqbox', w: REQ_BOX.emptyW, max: false }] }
  }
  const R = COMMON.reqBar
  const content = engine.requirementChunk(spec.requirement)
  // hug: 2.1mm clear of the glyph column on the left, 1.4 on the right
  const barW = Math.max(R.minW, content.w + R.hug)
  const nodes: LayoutNode[] = [{ kind: 'reqbox', w: barW, max: spec.requirement.max }]
  // contents centered slightly right of the box's center, clear of the column
  const ccx = REQ_BOX.x + (0.7 + barW) / 2
  const cy = REQ_BOX.top + REQ_BOX.h / 2
  nodes.push(...shift(content.nodes, ccx - content.w / 2, cy - content.h / 2))
  return { nodes, right: REQ_BOX.x + barW }
}

function costNodes(spec: CardSpec, m: TextMeasurer): LayoutNode[] {
  if (spec.cost === undefined) return []
  const { cx, cy, size } = COMMON.cost
  const cap = m.capHeight('proto', size)
  return [
    {
      kind: 'text',
      font: 'proto',
      size,
      x: cx,
      y: cy + cap / 2,
      text: String(spec.cost),
      fill: '#000',
      anchor: 'middle',
    },
  ]
}

/** Tags fill their slots from the right. */
function tagNodes(spec: CardSpec, engine: Engine): LayoutNode[] {
  const slots = COMMON.tagSlots
  const tagCount = Math.min(spec.tags.length, slots.xs.length)
  if (spec.tags.length > slots.xs.length) {
    engine.warn(`only ${slots.xs.length} tag slots fit — extra tags dropped`)
  }
  const nodes: LayoutNode[] = []
  for (let i = 0; i < tagCount; i++) {
    // spec order is left to right; slot 0 is the rightmost slot
    const slot = tagCount - 1 - i
    nodes.push({
      kind: 'image',
      asset: { type: 'asset', path: tagFile(spec.tags[i]) },
      x: slots.xs[slot],
      y: slots.y,
      w: slots.size,
      h: slots.size,
    })
  }
  if (tagCount === 4 && spec.requirement) {
    engine.warn('4th tag slot overlaps the requirement bar; check the render')
  }
  return nodes
}

/** ALL CAPS, set smaller when long. The trailing tracking gap counts in the
 *  centering. */
function titleNodes(spec: CardSpec, color: FrameColor, m: TextMeasurer): LayoutNode[] {
  const ts = TITLE_STYLES[color]
  const name = spec.name.toUpperCase()
  const size = titleSize(name, ts, m)
  const cap = m.capHeight('proto', size)
  const w = spacedWidth(m, name, 'proto', size, TITLE_TRACKING)
  return [
    {
      kind: 'text',
      font: 'proto',
      size,
      x: COMMON.cx - (w + TITLE_TRACKING) / 2,
      y: ts.cy + cap / 2,
      text: name,
      fill: '#000',
      anchor: 'start',
      letterSpacing: TITLE_TRACKING,
    },
  ]
}

function fanMadeNodes(regions: FrameRegions): LayoutNode[] {
  return [
    {
      kind: 'text',
      font: 'proto',
      size: 2.0,
      x: COMMON.cx,
      y: regions.fanY,
      text: 'FAN MADE',
      fill: regions.fanColor,
      anchor: 'middle',
    },
  ]
}

/** Three characters fit at NUM_TYPE's tracking; a wider run closes its gaps,
 *  then shrinks. Start-anchored so preview and export center alike. */
function cardNumberNodes(spec: CardSpec, regions: FrameRegions, m: TextMeasurer): LayoutNode[] {
  if (!spec.number) return []
  const text = spec.number
  const gaps = Math.max(0, text.length - 1)
  const { room } = NUM_TYPE
  let { size, tracking } = NUM_TYPE
  let glyphs = m.width(text, 'proto', size)
  if (glyphs >= room) {
    // advances scale with the em, so the solid run lands exactly on room
    size *= room / glyphs
    glyphs = room
    tracking = 0
  } else if (glyphs + tracking * gaps > room) {
    tracking = (room - glyphs) / gaps
  }
  const w = glyphs + tracking * gaps
  const cap = m.capHeight('proto', size)
  return [
    {
      kind: 'text',
      font: 'proto',
      size,
      x: regions.numCenter.x - w / 2,
      y: regions.numCenter.y + cap / 2,
      text,
      fill: NUM_TYPE.ink,
      anchor: 'start',
      letterSpacing: tracking,
    },
  ]
}

/** Bare text is the numeral: the flat size alone, the ratio size with
 *  company. Nothing shrinks; too wide warns. */
function vpNodes(spec: CardSpec, engine: Engine): LayoutNode[] {
  if (!spec.vp) return []
  const { x: vx, y: vy, w: vs } = COMMON.vpRect
  const V = COMMON.vp
  const plaque: LayoutNode = {
    kind: 'image',
    asset: { type: 'asset', path: 'VPs/blank.png' },
    x: vx,
    y: vy,
    w: vs,
    h: vs,
  }
  const alone = spec.vp.length === 1
  const content = engine.rowChunk(spec.vp, 0, {
    ...bodyStyle(1),
    bigSize: V.countSize,
    textSize: alone ? V.flatSize : V.textSize,
    textFont: 'proto',
    textTracking: 0,
    textWordSpacing: 0,
    outline: V.outline,
    iconH: V.iconH,
    gap: { tight: V.gap, loose: V.gap },
  })
  // the visible disc's chord at the row's height
  const r = vs / 2 - COMMON.vpMargin
  const room = 2 * Math.sqrt(Math.max(0, r * r - (content.h / 2) ** 2))
  if (content.w > room + 0.05)
    engine.warn(`VP disc content is ${(content.w - room).toFixed(1)}mm too wide — trim it`)
  return [plaque, ...shift(content.nodes, vx + (vs - content.w) / 2, vy + (vs - content.h) / 2)]
}

function flavorNodes(block: FlavorBlock | undefined): LayoutNode[] {
  if (!block) return []
  const nodes: LayoutNode[] = [
    {
      kind: 'rect',
      x: block.sepStart,
      y: block.sepY - 0.1,
      w: Math.max(0, block.sepEnd - block.sepStart),
      h: 0.2,
      fill: '#000000',
    },
  ]
  for (const line of block.lines) {
    nodes.push({
      kind: 'text',
      font: 'serifBoldItalic',
      size: COMMON.flavor.size,
      x: line.x,
      y: line.baseline,
      text: line.text,
      fill: '#000',
      anchor: 'middle',
    })
  }
  return nodes
}

function creditNodes(
  spec: CardSpec,
  artWin: Rect,
  backing: Backing,
  engine: Engine,
  ctx: LayoutContext,
): LayoutNode[] {
  if (!spec.artist) return []
  const m = ctx.measurer
  const avail = artWin.h - 2 * CREDIT.gap
  let size = CREDIT.size
  let run = m.width(spec.artist, CREDIT.font, size)
  if (run > avail) {
    size = (size * avail) / run
    run = avail
    engine.warn('artist credit shrunk to fit the art window')
  }
  const x = artWin.x + artWin.w - CREDIT.inset
  const y = artWin.y + artWin.h - CREDIT.gap
  const cap = m.capHeight(CREDIT.font, size)
  // the glyph column and a little art around it, in card mm
  const strip: Rect = {
    x: x - cap - CREDIT.pad,
    y: y - run - CREDIT.pad,
    w: cap + 2 * CREDIT.pad,
    h: run + 2 * CREDIT.pad,
  }
  return [
    {
      kind: 'text',
      font: CREDIT.font,
      size,
      x,
      y,
      text: spec.artist,
      fill: creditInk(strip, backing, ctx),
      anchor: 'start',
      rotate: -90,
    },
  ]
}

/** White ink, or black over light art; the missing-file checkerboard counts
 *  as light. */
function creditInk(strip: Rect, backing: Backing, ctx: LayoutContext): string {
  if (backing.kind === 'missing') return '#000'
  const { rect } = backing
  // the strip in fractions of the picture, the way a LumaMap is read
  const region: Rect = {
    x: (strip.x - rect.x) / rect.w,
    y: (strip.y - rect.y) / rect.h,
    w: strip.w / rect.w,
    h: strip.h / rect.h,
  }
  const brightness =
    backing.kind === 'art'
      ? ctx.artBrightness?.(backing.file, region)
      : meanBrightness(backdropLuma(), region)
  return brightness !== undefined && brightness > CREDIT.darkAbove ? '#000' : '#fff'
}
