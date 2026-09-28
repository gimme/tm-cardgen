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

/** A card name as it goes into a file name or an address: lowercase letters,
 *  digits and dashes. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'card'
}

/** Each card's slug, in the order given: a name's first card has it bare,
 *  and any later card whose slug is taken counts up from -2. */
export function cardSlugs(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    const base = slugify(name)
    let slug = base
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
    used.add(slug)
    return slug
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
