// Runs before every test file. The editor tests mount CodeMirror under jsdom
// (`@vitest-environment jsdom` at the top of the file), and its measuring
// pass reads client rects off DOM ranges, which jsdom, laying nothing out,
// leaves unimplemented. Empty rects do: those tests read state, not
// positions. A no-op under the default node environment.
if (typeof Range !== 'undefined') {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () =>
      ({ length: 0, item: () => null, *[Symbol.iterator]() {} }) as unknown as DOMRectList
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect
  }
}
