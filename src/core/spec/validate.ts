// Validates the parsed YAML Document into a CardSpec. Walking the Document
// keeps an exact source range on every diagnostic.
import { type Document, isMap, isScalar, isSeq, type Node, type Pair, Scalar } from 'yaml'
import { KNOWN_TAGS, suggest } from '../icons.ts'
import {
  parseRichText,
  type RichTextError,
  type RichTextItem,
  type RichTextOptions,
} from './richtext.ts'
import { parseRequirement } from './requirement.ts'
import { parseVp, VP_USAGE } from './vp.ts'
import type { ArtSpec, CardSpec, Diagnostic, Row } from './types.ts'

export interface ValidateResult {
  diagnostics: Diagnostic[]
  /** present only when there are no error-severity diagnostics */
  spec?: CardSpec
}

/** Every accepted top-level key, with the one-line help shown by the editor's
 *  completions. */
export const TOP_LEVEL_FIELDS = {
  name: { doc: 'Card name (title band)' },
  cost: { doc: 'MC cost (integer or "X")' },
  tags: { doc: 'Tag list, order = left to right; an event tag makes the card red' },
  requirement: { doc: 'Requirement, e.g. "max 6% {oxygen}" or "{science-tag science-tag}"' },
  active: {
    doc: 'Rows of the action area at the top (a list, or one string); makes the card blue',
  },
  body: { doc: 'Rows of the box under the art (a list of row strings, or one string)' },
  vp: {
    doc: 'Victory points: an integer, or a row set in the disc, the bare number in its style: "1 {/ 2 microbe}"',
  },
  flavor: { doc: 'Flavor text (italic, bottom of the body box)' },
  number: { doc: 'Card number (bottom-right box); an integer is padded to 3 digits' },
  art: { doc: 'Art file name, or {file, zoom, offset: [mm, mm]}; left out, a drawn Mars sky' },
  artist: { doc: 'Artist credit, printed up the right edge of the art' },
  seed: { doc: "Reroll the frame's crystal texture (any integer; default derives from the name)" },
} satisfies Record<string, { doc: string }>

/** The keys of art's map form, with the same one-line help. */
export const ART_FIELDS = {
  file: { doc: 'Art file name, as listed in the Art panel' },
  zoom: { doc: 'Scale beyond cover-fit; 1 = exact cover' },
  offset: { doc: 'Pan [x, y] in mm, clamped so no gaps appear' },
} satisfies Record<string, { doc: string }>

class Ctx {
  diagnostics: Diagnostic[] = []
  doc: Document
  source: string

  constructor(doc: Document, source: string) {
    this.doc = doc
    this.source = source
  }

  error(node: Node | null | undefined, message: string) {
    this.add('error', node, message)
  }
  warn(node: Node | null | undefined, message: string) {
    this.add('warning', node, message)
  }
  add(severity: 'error' | 'warning', node: Node | null | undefined, message: string) {
    const range = node?.range
    this.diagnostics.push({
      severity,
      message,
      from: range ? range[0] : 0,
      to: range ? range[1] : this.source.length,
    })
  }
  addAt(severity: 'error' | 'warning', from: number, to: number, message: string) {
    this.diagnostics.push({ severity, message, from, to })
  }
  get hasErrors() {
    return this.diagnostics.some((d) => d.severity === 'error')
  }
}

/** Maps offsets inside a scalar's string value to absolute source offsets.
 *  Exact for single-line plain or quoted scalars, checked against the
 *  source; falls back to the whole scalar range otherwise. */
function scalarMapper(ctx: Ctx, node: Scalar): (start: number, end: number) => [number, number] {
  const range = node.range
  const whole: [number, number] = range ? [range[0], range[1]] : [0, ctx.source.length]
  if (!range || typeof node.value !== 'string') return () => whole
  const value = node.value
  const quoted = node.type === Scalar.QUOTE_DOUBLE || node.type === Scalar.QUOTE_SINGLE
  const base = range[0] + (quoted ? 1 : 0)
  return (start, end) => {
    const from = base + start
    const to = base + end
    if (to <= range[1] && ctx.source.slice(from, to) === value.slice(start, end)) {
      return [from, to]
    }
    return whole
  }
}

function keyOf(pair: Pair): string | undefined {
  return isScalar(pair.key) && typeof pair.key.value === 'string' ? pair.key.value : undefined
}

function asStringScalar(ctx: Ctx, node: Node | null | undefined, what: string): Scalar | undefined {
  if (isScalar(node) && typeof node.value === 'string' && node.value.trim() !== '') {
    return node
  }
  if (isScalar(node) && typeof node.value === 'number') {
    // a bare number is fine where a string is expected (name: 2077)
    return node
  }
  ctx.error(node, `${what} must be a non-empty string`)
  return undefined
}

/** Validate row items inside a scalar: tokenizer errors, each mapped to
 *  its exact range inside the scalar when possible. Undefined when
 *  anything is wrong. */
function validateItems(ctx: Ctx, node: Scalar, opts: RichTextOptions): RichTextItem[] | undefined {
  const { items, errors, warnings } = parseRichText(String(node.value), opts)
  return reportTokens(ctx, scalarMapper(ctx, node), errors, warnings) ? undefined : items
}

/** Tokenizer diagnostics mapped onto their scalar; true when any is an
 *  error. */
function reportTokens(
  ctx: Ctx,
  map: ReturnType<typeof scalarMapper>,
  errors: RichTextError[],
  warnings: RichTextError[],
): boolean {
  for (const e of errors) {
    const [from, to] = map(e.start, e.end)
    ctx.addAt('error', from, to, e.message)
  }
  for (const w of warnings) {
    const [from, to] = map(w.start, w.end)
    ctx.addAt('warning', from, to, w.message)
  }
  return errors.length > 0
}

/** A flow: a list of row strings, or one string. A bare key with nothing
 *  under it is an empty flow. */
function validateRows(ctx: Ctx, node: Node | null, what: string): Row[] | undefined {
  if (node === null || (isScalar(node) && node.value === null)) return []
  const rowOf = (n: Scalar) => validateItems(ctx, n, { stacks: true, rules: true, lines: true })
  if (isScalar(node) && typeof node.value === 'string') {
    const items = rowOf(node)
    return items && [items]
  }
  if (!isSeq(node)) {
    ctx.error(
      node,
      `${what} must be a list of row strings (or one string), e.g. - "{plant} (Gain a plant.)"`,
    )
    return undefined
  }
  const rows: Row[] = []
  let bad = false
  for (const item of node.items) {
    if (!isScalar(item) || typeof item.value !== 'string') {
      ctx.error(item as Node, `${what} rows are strings, e.g. - "{plant} (Gain a plant.)"`)
      bad = true
      continue
    }
    const items = rowOf(item)
    if (items) rows.push(items)
    else bad = true
  }
  return bad ? undefined : rows
}

function asPoint(node: Node | null | undefined): [number, number] | undefined {
  if (
    isSeq(node) &&
    node.items.length === 2 &&
    node.items.every((n) => isScalar(n) && typeof n.value === 'number')
  ) {
    return [(node.items[0] as Scalar).value as number, (node.items[1] as Scalar).value as number]
  }
  return undefined
}

function validateArt(ctx: Ctx, node: Node | null): ArtSpec | undefined {
  if (isScalar(node) && typeof node.value === 'string' && node.value.trim() !== '') {
    return { file: node.value, zoom: 1, offset: [0, 0] }
  }
  if (isMap(node)) {
    const fileNode = node.get('file', true) as Node | null
    if (!isScalar(fileNode) || typeof fileNode.value !== 'string') {
      ctx.error(node, 'art needs a file name: art: foo.png or art: {file: foo.png, zoom: 1.2}')
      return undefined
    }
    const art: ArtSpec = { file: fileNode.value, zoom: 1, offset: [0, 0] }
    for (const pair of node.items) {
      const key = keyOf(pair)
      const value = pair.value as Node | null
      if (key === 'zoom') {
        if (isScalar(value) && typeof value.value === 'number' && value.value >= 1) {
          art.zoom = value.value
        } else ctx.error(value ?? node, 'zoom must be a number >= 1 (1 = exact cover fit)')
      } else if (key === 'offset') {
        const p = asPoint(value)
        if (p) art.offset = p
        else ctx.error(value ?? node, 'offset must be [x, y] in mm')
      } else if (key !== 'file') {
        ctx.warn((pair.key as Node) ?? node, `unknown art property '${key}'`)
      }
    }
    return art
  }
  ctx.error(node, 'art must be a file name or {file, zoom, offset}')
  return undefined
}

export function validateCard(doc: Document, source: string): ValidateResult {
  const ctx = new Ctx(doc, source)
  const root = doc.contents
  if (!isMap(root)) {
    ctx.addAt('error', 0, source.length, 'card must be a YAML mapping (name: ..., body: ...)')
    return { diagnostics: ctx.diagnostics }
  }

  const spec: Partial<CardSpec> = { tags: [], body: [] }
  let tagsNode: Node | null = null

  for (const pair of root.items) {
    const key = keyOf(pair)
    if (key === undefined) continue
    if (!Object.hasOwn(TOP_LEVEL_FIELDS, key)) {
      const hint = suggest(key, Object.keys(TOP_LEVEL_FIELDS))
      ctx.warn(
        (pair.key as Node) ?? root,
        `unknown field '${key}'${hint ? ` — did you mean '${hint}'?` : ''}`,
      )
      continue
    }
    const value = pair.value as Node | null
    switch (key) {
      case 'name': {
        const s = asStringScalar(ctx, value, 'name')
        if (s) spec.name = String(s.value)
        break
      }
      case 'cost': {
        if (isScalar(value) && typeof value.value === 'number' && Number.isInteger(value.value)) {
          if (value.value < 0) ctx.error(value, 'cost cannot be negative')
          else spec.cost = value.value
        } else if (isScalar(value) && (value.value === 'X' || value.value === 'x')) {
          spec.cost = 'X'
        } else {
          ctx.error(value ?? root, 'cost must be a non-negative integer or "X"')
        }
        break
      }
      case 'tags': {
        if (!isSeq(value)) {
          ctx.error(value ?? root, 'tags must be a list, e.g. [building, space]')
          break
        }
        tagsNode = value
        for (const item of value.items) {
          if (isScalar(item) && KNOWN_TAGS.includes(String(item.value))) {
            spec.tags!.push(String(item.value))
          } else {
            const name = isScalar(item) ? String(item.value) : ''
            const hint = suggest(name, KNOWN_TAGS)
            ctx.error(
              item as Node,
              `unknown tag '${name}'${hint ? ` — did you mean '${hint}'?` : ''}`,
            )
          }
        }
        if (spec.tags!.length > 4) ctx.warn(value, 'only 4 tag slots fit; extra tags are dropped')
        break
      }
      case 'requirement': {
        const s = asStringScalar(ctx, value, 'requirement')
        if (!s) break
        const { req, errors, warnings } = parseRequirement(String(s.value))
        if (!reportTokens(ctx, scalarMapper(ctx, s), errors, warnings)) spec.requirement = req
        break
      }
      case 'active': {
        spec.active = validateRows(ctx, value, 'active') ?? []
        break
      }
      case 'body': {
        spec.body = validateRows(ctx, value, 'body') ?? []
        break
      }
      case 'vp': {
        if (!isScalar(value)) {
          ctx.error(value ?? root, VP_USAGE)
          break
        }
        const { vp, errors, warnings } = parseVp(value.value)
        if (!reportTokens(ctx, scalarMapper(ctx, value), errors, warnings)) spec.vp = vp
        break
      }
      case 'flavor': {
        const s = asStringScalar(ctx, value, 'flavor')
        if (s) {
          spec.flavor = String(s.value)
          const text = spec.flavor.trimEnd()
          if (text.endsWith('.') && !text.endsWith('...')) {
            const [from, to] = scalarMapper(ctx, s)(text.length - 1, text.length)
            ctx.addAt('warning', from, to, 'flavor text takes no final period')
          }
        }
        break
      }
      case 'number': {
        if (isScalar(value) && typeof value.value === 'string') {
          spec.number = value.value
        } else if (
          isScalar(value) &&
          typeof value.value === 'number' &&
          Number.isInteger(value.value) &&
          value.value >= 0
        ) {
          spec.number = String(value.value).padStart(3, '0')
        } else ctx.error(value ?? root, 'number must be a string or non-negative integer')
        break
      }
      case 'art': {
        spec.art = validateArt(ctx, value)
        break
      }
      case 'artist': {
        const s = asStringScalar(ctx, value, 'artist')
        if (s) spec.artist = String(s.value)
        break
      }
      case 'seed': {
        if (isScalar(value) && typeof value.value === 'number' && Number.isInteger(value.value)) {
          spec.seed = value.value
        } else ctx.error(value ?? root, 'seed must be an integer')
        break
      }
    }
  }

  if (spec.name === undefined) {
    ctx.addAt('error', 0, Math.min(source.length, 1), 'card needs a name')
  }

  const isEvent = spec.tags!.includes('event')
  if (spec.active !== undefined) {
    spec.type = 'active'
    if (isEvent) ctx.warn(tagsNode, 'an event tag on a card with active: rows — the card is blue')
  } else {
    spec.type = isEvent ? 'event' : 'automated'
  }

  if (ctx.hasErrors) return { diagnostics: ctx.diagnostics }
  return { diagnostics: ctx.diagnostics, spec: spec as CardSpec }
}
