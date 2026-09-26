// The row language as the editor's cheat sheet tells it: the forms body and
// active rows, the requirement and the VP disc are written in, then every
// icon by name. Each form is a row that parses clean (syntax.test.ts). The
// tokenizer is richtext.ts.
import { KNOWN_TAGS } from '../icons.ts'

export interface SyntaxEntry {
  /** what to write */
  form: string
  /** what it prints, in plain words */
  doc: string
}

/** The forms in the cheat sheet's order, keyed so the editor can quote
 *  one of them. */
export const ROW_SYNTAX = {
  icon: { form: '{plant}', doc: 'An icon by its name' },
  group: { form: '{plant plant}', doc: 'Icons that belong together share braces and sit closer' },
  big: {
    form: '{4 plant} {OR} {STEAL 2}',
    doc: 'Numbers and keywords print large; keywords are written in CAPS',
  },
  coin: { form: '{25mc} {Xmc} {-2mc}', doc: 'An amount of megacredits, printed on the coin' },
  arrow: { form: '{->}', doc: 'The action arrow' },
  operator: { form: '{+} {-} {=} {:} {/}', doc: 'Operators, as in `{city : 2mc}`' },
  red: { form: '{red plant}', doc: '`red` draws the any-player ring around the icon after it' },
  note: {
    form: '{plant *}',
    doc: '`*` attaches the see-rules asterisk to the icon or text before it',
  },
  spacer: {
    form: '{plant} {3mm} {plant}',
    doc: 'A spacer: sets the gap between its neighbours in mm; negative overlaps them',
  },
  box: { form: '[{plant}]', doc: 'A production box' },
  line: {
    form: '[{plant} | {- heat}]',
    doc: '`|` starts a new line, in the row or inside a production box or stack',
  },
  stack: {
    form: '<{plant} | {heat}>',
    doc: 'A stack: items on top of each other, like a production box without the box',
  },
  gap: {
    form: '{plant} |3mm| {plant}',
    doc: '`|3mm|` breaks the line, with 3 mm of space in between',
  },
  rules: { form: '(Gain 3 plants.)', doc: 'The rules text, in the small font' },
  words: {
    form: 'OPPONENTS MAY NOT REMOVE YOUR {plant}',
    doc: 'Words outside braces print as bold text among the icons, for rules that icons cannot show',
  },
} satisfies Record<string, SyntaxEntry>

export interface IconGroup {
  title: string
  names: string[]
}

/** the official parties in the Turmoil rulebook's order, then the fan-made ones */
const PARTIES = [
  'mars-first',
  'scientists',
  'unity',
  'greens',
  'reds',
  'kelvinists',
  'bureaucrats',
  'centrists',
  'empower',
  'populists',
  'spome',
  'transhumanists',
]

/** Every icon spelt as a word, once (syntax.test.ts); the marks -> and *
 *  are in the table. The everyday icons come first, in the order the
 *  rulebook and the player board present them; variants and fan-made ones
 *  last, the fan-made alphabetically. */
export const ICON_GROUPS: IconGroup[] = [
  {
    title: 'Resources',
    names: [
      'mc',
      'steel',
      'titanium',
      'plant',
      'power',
      'heat',
      'card',
      'tr',
      'microbe',
      'animal',
      'science',
      'floater',
      'fighter',
      'wild',
      'data',
      'radiation',
    ],
  },
  {
    title: 'Tiles',
    names: [
      'city',
      'ocean',
      'greenery',
      'special-tile',
      'empty-tile',
      'colony',
      'trade',
      'greenery-no-oxygen',
      'offworld-city',
    ],
  },
  { title: 'Global parameters', names: ['oxygen', 'temperature', 'venus'] },
  { title: 'Tags', names: KNOWN_TAGS.map((t) => `${t}-tag`) },
  { title: 'Turmoil', names: ['chairman', 'party-leader', 'delegate', 'influence'] },
  { title: 'Parties', names: PARTIES.map((p) => `party-${p}`) },
]
