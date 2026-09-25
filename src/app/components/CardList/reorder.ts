/** The index a row lands at when dropped into `gap` (0 above the first row,
 *  n below the last). */
export function indexForGap(fromIndex: number, gap: number): number {
  return gap > fromIndex ? gap - 1 : gap
}

export function gapIsNoop(fromIndex: number, gap: number): boolean {
  return gap === fromIndex || gap === fromIndex + 1
}
