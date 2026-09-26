// Icon registry: spec names to asset files and rendering metadata.
import { asteriskBox } from './frame/operators.ts'
import { CARD_H, CARD_W } from './units.ts'

/** The any-player halo's shape (frame/halo.ts): a ring around the icon in
 *  its family's outline. An icon without one takes no halo. */
export type HaloShape =
  'box' | 'octagon' | 'hexagon' | 'circle' | 'card' | 'triangle' | 'bust' | 'thermometer'

interface IconMeta {
  /** width / height of the source image */
  aspect: number
  /** default rendered height in mm in a body row */
  h: number
  /** a number or X written attached before the name is drawn on it: {25mc} */
  inscribed?: boolean
  /** the shape of the `red` halo, for icons that take one */
  halo?: HaloShape
  /** a footnote mark: hangs off the top-right corner of the element before
   *  it instead of standing in the row (layout/chunks.ts) */
  note?: true
  /** where the asterisk hangs off this icon, mm right and down of the
   *  default: flush against the box's right edge, centered on its top edge */
  noteAt?: [dx: number, dy: number]
}

export type IconDef = IconMeta &
  (
    | {
        /** path under public/assets/ */
        file: string
        vector?: undefined
      }
    | {
        /** drawn as vector markup (VectorNode) instead of from a PNG */
        vector: 'mc' | 'asterisk'
        file?: undefined
      }
  )

const R = 'resources/'
const T = 'tiles/'
const G = 'globalparameters/'
const TAG = 'tags/'
const M = 'misc/'
const P = 'parties/'

/** a regular hexagon's width from its height */
const HEX = Math.sqrt(3) / 2
/** tiles and the thermometer print at one height */
const TALL = 9.3
/** the see-rules asterisk, at the printed arm length */
const STAR = asteriskBox()
/** a rectangular icon (a cube, the coin, TR, the card) stands the asterisk
 *  off by this much; other shapes it touches */
export const NOTE_GAP = 0.7
const RECT_NOTE: [number, number] = [NOTE_GAP, 0]
/** beside a triangle the asterisk comes in over the slope, and down a bit */
const TRIANGLE_NOTE: [number, number] = [-1.5, 0.6]

// Body heights in mm, measured on the printed cards. The cube is the unit
// (6.7, every printing).
const cube = (file: string, aspect = 1): IconDef => ({
  file: R + file,
  aspect,
  h: 6.7,
  halo: 'box',
  noteAt: RECT_NOTE,
})
export const ICONS: Record<string, IconDef> = {
  // resources
  mc: { vector: 'mc', aspect: 1, h: 6.7, inscribed: true, halo: 'octagon', noteAt: RECT_NOTE },
  steel: cube('steel.png'),
  titanium: cube('titanium.png'),
  plant: cube('plant.png'),
  power: cube('power.png'),
  heat: cube('heat.png'),
  // a miniature card, in the card's own proportions
  card: { file: R + 'card.png', aspect: CARD_W / CARD_H, h: 9.0, halo: 'card', noteAt: RECT_NOTE },
  microbe: cube('microbe.png', 329 / 331),
  animal: cube('animal.png'),
  science: cube('science.png'),
  floater: cube('floater.png'),
  data: cube('data.png'),
  fighter: cube('fighter.png'),
  radiation: cube('radiation.png'),
  wild: cube('wild.png'),
  tr: { file: R + 'TR.png', aspect: 535 / 391, h: 8.0, halo: 'box', noteAt: RECT_NOTE },

  // tiles
  city: { file: T + 'city.png', aspect: HEX, h: TALL, halo: 'hexagon' },
  ocean: { file: T + 'ocean.png', aspect: HEX, h: TALL, halo: 'hexagon' },
  // greenery and the off-world city carry a badge past the hexagon's right edge
  greenery: { file: T + 'greenery.png', aspect: 492 / 478, h: TALL, halo: 'hexagon' },
  'greenery-no-oxygen': {
    file: T + 'greenery_no_O2.png',
    aspect: HEX,
    h: TALL,
    halo: 'hexagon',
  },
  colony: {
    file: T + 'colony.png',
    aspect: 373 / 324,
    h: TALL,
    halo: 'triangle',
    noteAt: TRIANGLE_NOTE,
  },
  special: { file: T + 'special.png', aspect: HEX, h: TALL, halo: 'hexagon' },
  trade: {
    file: T + 'trade.png',
    aspect: 374 / 324,
    h: TALL,
    halo: 'triangle',
    noteAt: TRIANGLE_NOTE,
  },
  'empty-tile': { file: T + 'empty.png', aspect: HEX, h: TALL, halo: 'hexagon' },
  'offworld-city': { file: T + 'off-world_city.png', aspect: 496 / 477, h: TALL, halo: 'hexagon' },

  // global parameters
  // the disc prints at 0.93 of the thermometer
  oxygen: { file: G + 'oxygen.png', aspect: 1, h: 8.7 },
  temperature: { file: G + 'temperature.png', aspect: 163 / 547, h: TALL, halo: 'thermometer' },
  venus: { file: G + 'venus.png', aspect: 775 / 432, h: 5.3 },

  // turmoil
  chairman: { file: M + 'chairman.png', aspect: 548 / 710, h: 7.2, halo: 'bust' },
  delegate: { file: M + 'delegate.png', aspect: 548 / 710, h: 7.2, halo: 'bust' },
  'party-leader': { file: M + 'party_leader.png', aspect: 548 / 710, h: 7.2, halo: 'bust' },
  influence: { file: M + 'influence.png', aspect: 1080 / 1136, h: 8.9 },

  // punctuation: the action arrow and the see-rules asterisk. The operators
  // + - = : / are text, spec/richtext.ts
  // the printed arrow is 2.4:1; the PNG (531:248) is drawn stretched to it
  '->': { file: M + 'arrow.png', aspect: 2.4, h: 4.1 },
  '*': { vector: 'asterisk', aspect: STAR.w / STAR.h, h: STAR.h, note: true },
}

const TAG_NAMES = [
  'building',
  'space',
  'science',
  'power',
  'earth',
  'jovian',
  'city',
  'microbe',
  'plant',
  'animal',
  'event',
  'venus',
  'mars',
  'moon',
  'wild',
  'galactic',
  'planetary',
  'infrastructure',
  'radioactive',
  'multi',
] as const

export const KNOWN_TAGS: readonly string[] = TAG_NAMES

/** tag icons usable inline via the -tag suffix, e.g. {science-tag} */
for (const tag of TAG_NAMES) {
  ICONS[`${tag}-tag`] = { file: `${TAG}${tag}.png`, aspect: 1, h: 6.5, halo: 'circle' }
}

const PARTY_FILES: Record<string, string> = {
  bureaucrats: 'bureacrats.png', // upstream file name typo, kept verbatim
  centrists: 'centrists.png',
  empower: 'empower.png',
  greens: 'greens.png',
  kelvinists: 'kelvinists.png',
  'mars-first': 'mars_first.png',
  populists: 'populists.png',
  reds: 'reds.png',
  scientists: 'scientists.png',
  spome: 'spome.png',
  transhumanists: 'transhumanists.png',
  unity: 'unity.png',
}
for (const [name, file] of Object.entries(PARTY_FILES)) {
  ICONS[`party-${name}`] = { file: P + file, aspect: 154 / 111, h: 8.9 }
}

export const ICON_NAMES = Object.keys(ICONS)

export function tagFile(tag: string): string {
  return `${TAG}${tag}.png`
}

/** Levenshtein distance, for "did you mean" suggestions. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  return dp[a.length][b.length]
}

export function suggest(name: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDist = Math.max(2, Math.floor(name.length / 3)) + 1
  for (const c of candidates) {
    const d = editDistance(name.toLowerCase(), c)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}
