// The art file a card's YAML names: read, rewritten and spelled without going
// through validation, so a card that is otherwise invalid still counts.
import { isMap, isScalar, parseDocument, Scalar } from 'yaml'
import { parseCardYaml } from './parse.ts'

function artFileNode(text: string): Scalar<string> | undefined {
  const art = parseCardYaml(text).doc.get('art', true)
  const file = isMap(art) ? art.get('file', true) : art
  if (isScalar(file) && typeof file.value === 'string' && file.value.trim() !== '') {
    return file as Scalar<string>
  }
  return undefined
}

/** The art file the card text names. */
export function artFileOf(text: string): string | undefined {
  return artFileNode(text)?.value
}

/** `text` with the art file it names set to `name`, keeping the quote style;
 *  unchanged where it names none. */
export function withArtFile(text: string, name: string): string {
  const range = artFileNode(text)?.range
  if (!range) return text
  const old = text.slice(range[0], range[1])
  const quote = /^["']/.exec(old)?.[0] ?? ''
  // a block scalar's range takes its line break with it
  const lineBreak = old.endsWith('\n') ? '\n' : ''
  const written = quote + yamlFileName(name, quote) + quote + lineBreak
  return text.slice(0, range[0]) + written + text.slice(range[1])
}

/** A file name as YAML: escaped for the quote it sits in, bare where a flow
 *  sequence, the strictest place for a plain scalar, reads it back as written,
 *  else double-quoted. */
export function yamlFileName(name: string, quote: string): string {
  if (quote === "'") return name.replaceAll("'", "''")
  const quoted = JSON.stringify(name)
  if (quote === '"') return quoted.slice(1, -1)
  const doc = parseDocument(`[${name}]`)
  const read: unknown = doc.errors.length === 0 ? doc.toJS() : undefined
  return Array.isArray(read) && read.length === 1 && read[0] === name ? name : quoted
}
