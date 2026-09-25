import type { RichTextItem } from './richtext.ts'

/** Derived, never written: active rows make it active, an event tag event, else automated. */
export type CardType = 'automated' | 'event' | 'active'

export interface ArtSpec {
  file: string
  /** scale beyond cover-fit; 1 = exact cover */
  zoom: number
  /** pan in mm, applied after cover-fit, clamped so no gaps appear */
  offset: [number, number]
}

/** One row string as written, with a break item wherever a bare `|` split it. */
export type Row = RichTextItem[]

export interface Requirement {
  max: boolean
  items: RichTextItem[]
}

/** The disc's contents as a row: bare text is the numeral, braces hold the rest. */
export type VpSpec = Row

export interface CardSpec {
  name: string
  type: CardType
  cost?: number | 'X'
  tags: string[]
  requirement?: Requirement
  /** blue only: the rows of the action area at the top of the card */
  active?: Row[]
  /** the rows of the box under the art */
  body: Row[]
  vp?: VpSpec
  flavor?: string
  number?: string
  art?: ArtSpec
  artist?: string
  /** crystal texture seed; omitted, it derives from the card name */
  seed?: number
}

export interface Diagnostic {
  severity: 'error' | 'warning'
  message: string
  /** absolute character offsets into the YAML source */
  from: number
  to: number
}
