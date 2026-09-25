// Serialize a CardLayout to SVG. With `outline` set, every text node becomes
// a <path> (export); otherwise text uses font-family names (preview).
import { CARD_H, CARD_W, fmt } from '../units.ts'
import { FONT_FAMILIES } from '../fonts/fontService.ts'
import { backdropMarkup } from '../frame/backdrop.ts'
import { haloMarkup } from '../frame/halo.ts'
import { MC, mcBody, mcDefs } from '../frame/megacredit.ts'
import { renderFrameMarkup } from '../frame/render.ts'
import { reqBoxMarkup } from '../frame/reqbox.ts'
import { asteriskPath, colonMarkup, slashPath } from '../frame/operators.ts'
import { PROD_BOX } from '../layout/frames.ts'
import type { AssetRef, CardLayout, LayoutNode } from '../layout/model.ts'
import { spacedWidth, type FontId, type TextMeasurer } from '../layout/measure.ts'

/** what the export renderer needs to outline text; FontService satisfies it */
export interface TextOutliner extends TextMeasurer {
  pathData(
    text: string,
    font: FontId,
    size: number,
    x: number,
    y: number,
    letterSpacing?: number,
    wordSpacing?: number,
  ): string
}

function outlineStartX(x: number, anchor: 'start' | 'middle' | 'end', width: number): number {
  if (anchor === 'middle') return x - width / 2
  if (anchor === 'end') return x - width
  return x
}

export interface RenderOptions {
  /** logical asset ref -> URL or data URI */
  resolveAsset: (ref: AssetRef) => string
  /** outline all text via font tables (export); omit for <text> (preview) */
  outline?: TextOutliner
  /** Prefix on every generated id. HTML resolves url(#...) page-wide across
   *  inline <svg>s, so mounted cards need distinct prefixes; single-card
   *  documents omit it. */
  idPrefix?: string
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** The card's `<defs>` and drawing elements, without the outer `<svg>`. */
export function renderSvgMarkup(layout: CardLayout, opts: RenderOptions): string {
  const p = opts.idPrefix ?? ''
  const defs: string[] = []
  const body: string[] = []
  let clipCounter = 0
  let needMcDefs = false
  let haloCounter = 0
  /** one production pattern per distinct tile-grid origin */
  const prodPatterns = new Map<string, { id: string; x: number; y: number }>()
  let needChecker = false
  const gradients = new Set<string>()

  for (const node of layout.nodes) {
    body.push(renderNode(node))
  }

  function renderNode(node: LayoutNode): string {
    switch (node.kind) {
      case 'image': {
        const href = esc(opts.resolveAsset(node.asset))
        let clipAttr = ''
        if (node.clip) {
          const id = `${p}clip${clipCounter++}`
          defs.push(
            `<clipPath id="${id}"><rect x="${fmt(node.clip.x)}" y="${fmt(node.clip.y)}" width="${fmt(node.clip.w)}" height="${fmt(node.clip.h)}"/></clipPath>`,
          )
          clipAttr = ` clip-path="url(#${id})"`
        }
        return `<image href="${href}" x="${fmt(node.x)}" y="${fmt(node.y)}" width="${fmt(node.w)}" height="${fmt(node.h)}" preserveAspectRatio="none"${clipAttr}/>`
      }
      case 'vector': {
        if (node.icon === 'slash')
          return `<path d="${slashPath(node.x, node.y, node.w, node.h)}" fill="#000"/>`
        if (node.icon === 'colon') return colonMarkup(node.x, node.y, node.w, node.h)
        if (node.icon === 'asterisk')
          return `<path d="${asteriskPath(node.x, node.y, node.w, node.h)}" fill="#000"/>`
        // the megacredit is square, so one uniform scale places it
        needMcDefs = true
        return `<g transform="translate(${fmt(node.x)} ${fmt(node.y)}) scale(${fmt(node.h / MC.size)})">${mcBody(`${p}mc`)}</g>`
      }
      case 'halo':
        // halo, reqbox, backdrop and frame markup each carry their own <defs>
        return haloMarkup(
          node.shape,
          node.x,
          node.y,
          node.w,
          node.h,
          node.scale,
          `${p}halo${haloCounter++}`,
        )
      case 'reqbox': {
        return reqBoxMarkup(node.w, node.max, p)
      }
      case 'backdrop': {
        return backdropMarkup(node, p)
      }
      case 'frame': {
        return renderFrameMarkup(
          node.color,
          { artBottom: node.artBottom, artTop: node.artTop, seamX: node.seamX, seed: node.seed },
          p === '' ? undefined : p,
        )
      }
      case 'rect': {
        let fill: string
        if (node.fill === 'production-pattern') {
          const o = node.patternOrigin ?? { x: 0, y: 0 }
          const key = `${o.x},${o.y}`
          let entry = prodPatterns.get(key)
          if (!entry) {
            entry = { id: `${p}production${prodPatterns.size}`, x: o.x, y: o.y }
            prodPatterns.set(key, entry)
          }
          fill = `url(#${entry.id})`
        } else if (node.fill === 'checkerboard') {
          needChecker = true
          fill = `url(#${p}checker)`
        } else if (node.gradient) {
          gradients.add(node.gradient)
          fill = `url(#${p}${node.gradient})`
        } else {
          fill = node.fill
        }
        return `<rect x="${fmt(node.x)}" y="${fmt(node.y)}" width="${fmt(node.w)}" height="${fmt(node.h)}" fill="${fill}"/>`
      }
      case 'text': {
        const rotate = node.rotate
          ? ` transform="rotate(${fmt(node.rotate)} ${fmt(node.x)} ${fmt(node.y)})"`
          : ''
        const ls = node.letterSpacing ?? 0
        const ws = node.wordSpacing ?? 0
        const draw = (fill: string, stroke: string): string => {
          if (opts.outline) {
            const width = spacedWidth(opts.outline, node.text, node.font, node.size, ls, ws)
            const x = outlineStartX(node.x, node.anchor, width)
            const d = opts.outline.pathData(node.text, node.font, node.size, x, node.y, ls, ws)
            return `<path d="${d}" fill="${fill}"${stroke}${rotate}/>`
          }
          const fam = FONT_FAMILIES[node.font]
          const style = fam.style === 'italic' ? ' font-style="italic"' : ''
          const weight = fam.weight !== 400 ? ` font-weight="${fam.weight}"` : ''
          const spacing =
            (ls ? ` letter-spacing="${fmt(ls)}"` : '') + (ws ? ` word-spacing="${fmt(ws)}"` : '')
          return `<text x="${fmt(node.x)}" y="${fmt(node.y)}" font-family="${esc(fam.family)}"${style}${weight} font-size="${fmt(node.size)}"${spacing} fill="${fill}" text-anchor="${node.anchor}"${stroke}${rotate}>${esc(node.text)}</text>`
        }
        if (!node.outline) return draw(node.fill, '')
        // one copy per band, outermost first, stroked to the band's far edge;
        // then the inset as a clipped stroke of the innermost color
        const { bands, inset } = node.outline
        let reach = bands.reduce((sum, band) => sum + band.width, 0) - inset
        const copies: string[] = []
        for (const band of [...bands].reverse()) {
          if (reach > 1e-9)
            copies.push(
              draw(
                node.fill,
                ` stroke="${band.color}" stroke-width="${fmt(2 * reach)}" paint-order="stroke" stroke-linejoin="round"`,
              ),
            )
          reach -= band.width
        }
        if (copies.length === 0) copies.push(draw(node.fill, ''))
        if (inset > 0 && bands.length > 0) {
          const id = `${p}clip${clipCounter++}`
          defs.push(`<clipPath id="${id}">${draw(node.fill, '')}</clipPath>`)
          copies.push(
            `<g clip-path="url(#${id})">${draw('none', ` stroke="${bands[0].color}" stroke-width="${fmt(2 * inset)}" stroke-linejoin="round"`)}</g>`,
          )
        }
        return copies.join('')
      }
    }
  }

  if (needMcDefs) defs.push(mcDefs(`${p}mc`))
  if (prodPatterns.size > 0) {
    const t = fmt(PROD_BOX.patternTile)
    const href = esc(opts.resolveAsset({ type: 'asset', path: 'production.png' }))
    for (const { id, x, y } of prodPatterns.values()) {
      defs.push(
        `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${fmt(x)}" y="${fmt(y)}" width="${t}" height="${t}"><image href="${href}" x="0" y="0" width="${t}" height="${t}"/></pattern>`,
      )
    }
  }
  if (needChecker) {
    defs.push(
      `<pattern id="${p}checker" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="#d8d8d8"/><rect width="3" height="3" fill="#bfbfbf"/><rect x="3" y="3" width="3" height="3" fill="#bfbfbf"/></pattern>`,
    )
  }
  if (gradients.has('prod-outer')) {
    defs.push(
      `<linearGradient id="${p}prod-outer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#505050"/><stop offset="1" stop-color="#c0c0c0"/></linearGradient>`,
    )
  }
  if (gradients.has('prod-inner')) {
    defs.push(
      `<linearGradient id="${p}prod-inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9d6c43"/><stop offset="1" stop-color="#5a412c"/></linearGradient>`,
    )
  }

  return (defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '') + body.join('')
}

/** A standalone SVG document at real card size (used by every export path). */
export function renderSvgString(layout: CardLayout, opts: RenderOptions): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" ` +
    `width="${CARD_W}mm" height="${CARD_H}mm">${renderSvgMarkup(layout, opts)}</svg>`
  )
}
