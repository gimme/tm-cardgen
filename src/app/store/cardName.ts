// A card's name lives in its YAML `name:` line; the list entry only caches it.

/** The `name:` line's value, unquoted, or nothing. */
export function extractName(text: string): string | undefined {
  const m = /^name:[ \t]*(.+?)[ \t]*$/m.exec(text)
  if (!m) return undefined
  return m[1].replace(/^["']|["']$/g, '').trim() || undefined
}

/** `text` with its `name:` line set to `name`, keeping the line's quote
 *  style; unchanged when there is no name line. */
export function withName(text: string, name: string): string {
  return text.replace(/^(name:[ \t]*)(.*?)[ \t]*$/m, (_, key: string, old: string) => {
    if (old.startsWith('"')) return `${key}"${name.replace(/[\\"]/g, '\\$&')}"`
    if (old.startsWith("'")) return `${key}'${name.replace(/'/g, "''")}'`
    return key + name
  })
}

/** The name for a copy of `source`: "X (1)", or the first free number; a copy
 *  of "X (2)" counts up from the same base. */
export function copyName(source: string, taken: Iterable<string>): string {
  const base = source.replace(/ \(\d+\)$/, '')
  const used = new Set(taken)
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})`
    if (!used.has(candidate)) return candidate
  }
}
