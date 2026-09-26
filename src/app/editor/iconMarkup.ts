// An icon on its own as inline SVG, drawn by the card renderer at the
// cheat sheet's scale: a resource cube 16px tall.
import { fmt, iconSample, renderSvgMarkup } from '../../core/index.ts'
import { makePreviewResolver } from '../services/assetService.ts'

const PX_PER_MM = 2.4

// the icons are bundled assets, never user art
const resolveAsset = makePreviewResolver(() => undefined)

export interface IconMarkup {
  viewBox: string
  width: number
  height: number
  markup: string
}

/** The coin's gradients carry ids, so each mounted <svg> scopes its own
 *  with `idPrefix`. An inscribed icon wears `inscription`, else an X. */
export function iconMarkup(name: string, idPrefix: string, inscription?: string): IconMarkup {
  const chunk = iconSample(name, inscription)
  return {
    viewBox: `0 0 ${fmt(chunk.w)} ${fmt(chunk.h)}`,
    // whole pixels: a fractional edge row gets clipped off
    width: Math.round(chunk.w * PX_PER_MM),
    height: Math.round(chunk.h * PX_PER_MM),
    markup: renderSvgMarkup(chunk, { resolveAsset, idPrefix }),
  }
}

/** the same as a DOM element, for CodeMirror's tooltips */
export function iconSvg(name: string, idPrefix: string, inscription?: string): SVGSVGElement {
  const { viewBox, width, height, markup } = iconMarkup(name, idPrefix, inscription)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.innerHTML = markup
  return svg
}
