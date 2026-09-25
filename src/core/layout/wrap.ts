export interface Line {
  text: string
  w: number
}

/** Greedy word wrap. A newline is a hard break (a trailing one ends the
 *  last line); a word longer than maxW gets its own line. */
export function wrapText(text: string, maxW: number, width: (text: string) => number): Line[] {
  const paragraphs = text.split('\n')
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1] === '') paragraphs.pop()
  return paragraphs.flatMap((p) => wrapParagraph(p, maxW, width))
}

function wrapParagraph(text: string, maxW: number, width: (text: string) => number): Line[] {
  const words = text.split(/\s+/).filter((w) => w !== '')
  if (words.length === 0) return [{ text: '', w: 0 }]
  const lines: Line[] = []
  let current = ''
  for (const word of words) {
    const candidate = current === '' ? word : current + ' ' + word
    if (current !== '' && width(candidate) > maxW) {
      lines.push({ text: current, w: width(current) })
      current = word
    } else {
      current = candidate
    }
  }
  lines.push({ text: current, w: width(current) })
  return lines
}
