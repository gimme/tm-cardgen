// Glass textures: crystalTexture for green and red, bubbleTexture for blue.
// Deterministic for a given spec. Levels are positions on the palette ramp.
import { fmt } from '../units.ts'
import { linear, profileAt, profileStops, rampAt, type Profile, type Ramp } from './paint.ts'
import { edgeYat, type Edge } from './paths.ts'

export interface CrystalSpec {
  /** paint bounds; overscan past the clip so nothing ends at a visible edge */
  box: { x0: number; y0: number; x1: number; y1: number }
  seed: number
  /** ground brightness along x (levels through the palette ramp) */
  ground: Profile
  shards: { count: number; sMin: number; sMax: number; blur: number }
  /** the first `cores` blobs get a hot center; `lMax` caps the glow level */
  bokeh: { count: number; rMin: number; rMax: number; blur: number; cores?: number; lMax?: number }
  facets?: { count: number; sMin: number; sMax: number; blur: number }
  sparks?: { count: number; rMin: number; rMax: number }
  /** authored glows at absolute ramp levels */
  glows?: readonly { x: number; y: number; rx: number; ry: number; level: number; alpha: number }[]
  bubbles?: { x: number; y: number; rx: number; ry: number; count: number; alpha: number }
}

/** mix a per-card salt into an authored seed; salt 0 is the identity */
export function mixSeed(seed: number, salt: number): number {
  return (seed + Math.imul(salt, 0x9e3779b9)) >>> 0
}

/** FNV-1a hash of a card name: the default per-card seed salt */
export function nameSeed(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** one blur filter def; explicit user-space region so nothing clips */
export function blurDef(id: string, box: CrystalSpec['box'], sigma: number): string {
  const pad = 3 * sigma + 0.5
  return (
    `<filter id="${id}" filterUnits="userSpaceOnUse" ` +
    `x="${fmt(box.x0 - pad)}" y="${fmt(box.y0 - pad)}" ` +
    `width="${fmt(box.x1 - box.x0 + 2 * pad)}" height="${fmt(box.y1 - box.y0 + 2 * pad)}">` +
    `<feGaussianBlur stdDeviation="${fmt(sigma)}"/></filter>`
  )
}

function facetPoints(rand: () => number, cx: number, cy: number, s: number, t: number): string {
  if (rand() > 0.4 * t) return shardPoints(rand, cx, cy, s)
  const n = 7 + Math.floor(rand() * 3)
  const angles = Array.from({ length: n }, () => rand() * 2 * Math.PI).sort((a, b) => a - b)
  const spike = Math.floor(rand() * n)
  const squash = 0.55 + rand() * 0.35
  return angles
    .map((a, i) => {
      const notch = rand() < 0.3
      const r = s * (i === spike ? 1.35 : notch ? 0.3 + rand() * 0.2 : 0.55 + rand() * 0.45)
      return `${fmt(cx + Math.cos(a) * r)},${fmt(cy + Math.sin(a) * r * squash)}`
    })
    .join(' ')
}

function shardPoints(rand: () => number, cx: number, cy: number, s: number): string {
  const n = rand() < 0.45 ? 4 : 3
  const angles = Array.from({ length: n }, () => rand() * 2 * Math.PI).sort((a, b) => a - b)
  const spike = Math.floor(rand() * n)
  const squash = 0.55 + rand() * 0.5
  return angles
    .map((a, i) => {
      const r = s * (0.35 + rand() * 0.65) * (i === spike ? 1.7 : 1)
      return `${fmt(cx + Math.cos(a) * r)},${fmt(cy + Math.sin(a) * r * squash)}`
    })
    .join(' ')
}

/** `{ defs, body }`; the caller clips body. `id` must begin `frame-` for
 *  instance rewriting. */
export function crystalTexture(
  id: string,
  spec: CrystalSpec,
  ramp: Ramp,
): { defs: string; body: string } {
  const { box, seed, ground, shards, bokeh, facets, sparks, glows, bubbles } = spec
  const rand = prng(seed)
  const level = (x: number) => profileAt(ground, x)
  const ink = (x: number, dLevel: number) => rampAt(ramp, clamp01(level(x) + dLevel))
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const at = () => [box.x0 + rand() * w, box.y0 + rand() * h] as const

  const defs: string[] = [
    linear(`${id}-ground`, [box.x0, 0], [box.x1, 0], profileStops(ramp, ground, box.x0, box.x1)),
    blurDef(`${id}-soft`, box, bokeh.blur),
    blurDef(`${id}-haze`, box, shards.blur),
  ]
  const out: string[] = []

  out.push(
    `<rect x="${fmt(box.x0)}" y="${fmt(box.y0)}" width="${fmt(w)}" height="${fmt(h)}" ` +
      `fill="url(#${id}-ground)"/>`,
  )

  if (facets) {
    defs.push(blurDef(`${id}-facet`, box, facets.blur))
    const facet: string[] = []
    for (let i = 0; i < facets.count; i++) {
      const [x, y] = at()
      const s = facets.sMin + rand() * (facets.sMax - facets.sMin)
      const dark = rand() < 0.5
      const dLevel = (0.18 + rand() * 0.26) * (dark ? -1 : 1) * (1 - 0.5 * level(x))
      const alpha = 0.45 + rand() * 0.35
      const t = (s - facets.sMin) / (facets.sMax - facets.sMin)
      facet.push(
        `<polygon points="${facetPoints(rand, x, y, s, t)}" fill="${ink(x, dLevel)}" ` +
          `opacity="${fmt(alpha)}"/>`,
      )
    }
    out.push(`<g filter="url(#${id}-facet)">${facet.join('')}</g>`)
  }

  const glow: string[] = []
  const core: string[] = []
  for (let i = 0; i < bokeh.count; i++) {
    const [x, y] = at()
    const r = bokeh.rMin + rand() * (bokeh.rMax - bokeh.rMin)
    const fill = rampAt(ramp, Math.min(bokeh.lMax ?? 1, clamp01(level(x) + 0.14 + rand() * 0.22)))
    const alpha = 0.3 + rand() * 0.4
    glow.push(
      `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="${fill}" opacity="${fmt(alpha)}"/>`,
    )
    if (i < (bokeh.cores ?? 0)) {
      const rc = 0.12 + rand() * 0.07 + r * 0.12
      core.push(
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(rc)}" fill="${ink(x, 0.42 + rand() * 0.1)}" ` +
          `opacity="${fmt(0.5 + rand() * 0.2)}"/>`,
      )
    }
  }
  for (const g of glows ?? []) {
    glow.push(
      `<ellipse cx="${fmt(g.x)}" cy="${fmt(g.y)}" rx="${fmt(g.rx)}" ry="${fmt(g.ry)}" ` +
        `fill="${rampAt(ramp, g.level)}" opacity="${fmt(g.alpha)}"/>`,
    )
  }
  out.push(`<g filter="url(#${id}-soft)">${glow.join('')}</g>`)

  const shard: string[] = [...core]
  for (let i = 0; i < shards.count; i++) {
    const [x, y] = at()
    const s = shards.sMin + rand() * (shards.sMax - shards.sMin)
    const dark = rand() < 0.78 - 0.45 * level(x)
    const dLevel = (0.12 + rand() * 0.18) * (dark ? -1 : 1)
    const alpha = 0.3 + rand() * 0.35
    shard.push(
      `<polygon points="${shardPoints(rand, x, y, s)}" fill="${ink(x, dLevel)}" ` +
        `opacity="${fmt(alpha)}"/>`,
    )
  }
  if (sparks) {
    for (let i = 0; i < sparks.count; i++) {
      const [x, y] = at()
      if (rand() > level(x)) continue
      const r = sparks.rMin + rand() * (sparks.rMax - sparks.rMin)
      shard.push(
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="${ink(x, 0.25)}" ` +
          `opacity="${fmt(0.4 + rand() * 0.35)}"/>`,
      )
    }
  }
  if (bubbles) shard.push(bubbleRings(bubbles, rand, (x) => ink(x, -0.14)))
  out.push(`<g filter="url(#${id}-haze)">${shard.join('')}</g>`)

  return { defs: defs.join(''), body: out.join('') }
}

export interface BubbleSpec {
  /** paint bounds; centers scatter past them so the big bubbles show only an arc */
  box: { x0: number; y0: number; x1: number; y1: number }
  seed: number
  /** ground brightness along x (levels through the palette ramp) */
  ground: Profile
  count: number
  rMin: number
  rMax: number
  /** caps the fill opacity */
  alpha: number
}

/** `{ defs, body }`; the caller clips body. Fill levels cap at LID so the
 *  plate's gloss pools keep the ramp's top. */
export function bubbleTexture(
  id: string,
  spec: BubbleSpec,
  ramp: Ramp,
): { defs: string; body: string } {
  const { box, seed, ground, count, rMin, rMax, alpha } = spec
  const rand = prng(seed)
  const level = (x: number) => profileAt(ground, x)
  const LID = 0.72
  const ink = (x: number, dLevel: number) => rampAt(ramp, Math.min(LID, clamp01(level(x) + dLevel)))
  const at = (r: number): readonly [number, number] => {
    const g = 0.6 * r
    return [
      box.x0 - g + rand() * (box.x1 - box.x0 + 2 * g),
      box.y0 - g + rand() * (box.y1 - box.y0 + 2 * g),
    ]
  }

  const defs: string[] = [
    linear(`${id}-ground`, [box.x0, 0], [box.x1, 0], profileStops(ramp, ground, box.x0, box.x1)),
  ]
  const out: string[] = []

  out.push(
    `<rect x="${fmt(box.x0)}" y="${fmt(box.y0)}" width="${fmt(box.x1 - box.x0)}" ` +
      `height="${fmt(box.y1 - box.y0)}" fill="url(#${id}-ground)"/>`,
  )

  const bubbles: { x: number; y: number; r: number; fill: string; fo: number; so: number }[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    const r = rMin * (rMax / rMin) ** t * (0.9 + 0.2 * rand())
    const [x, y] = at(r)
    bubbles.push({
      x,
      y,
      r,
      fill: ink(x, 0.14 + rand() * 0.08),
      fo: alpha * (0.65 + 0.25 * rand()),
      so: 0.4 + rand() * 0.35,
    })
  }
  // big before small so every rim stays readable
  for (const b of bubbles.sort((p, q) => q.r - p.r)) {
    out.push(
      `<circle cx="${fmt(b.x)}" cy="${fmt(b.y)}" r="${fmt(b.r)}" ` +
        `fill="${b.fill}" fill-opacity="${fmt(b.fo)}" ` +
        `stroke="${ink(b.x, 0.3)}" stroke-width="${fmt(0.08 + 0.02 * Math.min(b.r, 4))}" ` +
        `stroke-opacity="${fmt(b.so)}"/>`,
    )
  }

  return { defs: defs.join(''), body: out.join('') }
}

export interface GlintSpec {
  seed: number
  count: number
  /** x scatter range */
  x0: number
  x1: number
  /** shard size range */
  sMin: number
  sMax: number
  /** ramp level floor */
  level: number
}

/** tiny bright shards just above a contour; the caller draws them into the haze group */
export function contourGlints(edge: Edge, g: GlintSpec, ramp: Ramp): string {
  const rand = prng(g.seed)
  const out: string[] = []
  for (let i = 0; i < g.count; i++) {
    const x = g.x0 + rand() * (g.x1 - g.x0)
    const y = edgeYat(edge, x) - (0.12 + rand() * 0.3)
    const s = g.sMin + rand() * (g.sMax - g.sMin)
    const fill = rampAt(ramp, clamp01(g.level + rand() * (1 - g.level)))
    out.push(
      `<polygon points="${shardPoints(rand, x, y, s)}" fill="${fill}" ` +
        `opacity="${fmt(0.55 + rand() * 0.35)}"/>`,
    )
  }
  return out.join('')
}

function bubbleRings(
  b: NonNullable<CrystalSpec['bubbles']>,
  rand: () => number,
  ink: (x: number) => string,
): string {
  const out: string[] = []
  for (let i = 0; i < b.count; i++) {
    const a = rand() * 2 * Math.PI
    const d = Math.sqrt(rand())
    const [x, y] = [b.x + Math.cos(a) * d * b.rx, b.y + Math.sin(a) * d * b.ry]
    const r = 0.09 + rand() * 0.22
    out.push(
      `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="none" ` +
        `stroke="${ink(x)}" stroke-width="${fmt(r * 0.7)}" opacity="${fmt(b.alpha)}"/>`,
    )
  }
  return out.join('')
}
