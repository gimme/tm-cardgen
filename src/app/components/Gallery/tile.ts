// What a gallery tile shows for a card's text: the card, or why there is none.
import { checkCard, layoutCard, type CardLayout, type LayoutContext } from '../../../core/index.ts'

export type Tile = { layout: CardLayout; error?: undefined } | { layout?: undefined; error: string }

export function tileOf(yamlText: string, ctx: LayoutContext): Tile {
  const { diagnostics, spec } = checkCard(yamlText)
  if (!spec) {
    return { error: diagnostics.find((d) => d.severity === 'error')?.message ?? 'invalid card' }
  }
  return { layout: layoutCard(spec, ctx) }
}

// each card's last tile, so the gallery lays a card out again only once its
// text or the art has changed
const cache = new Map<string, { yamlText: string; artVersion: number; tile: Tile }>()

export function cachedTile(
  id: string,
  yamlText: string,
  artVersion: number,
  ctx: LayoutContext,
): Tile {
  const hit = cache.get(id)
  if (hit && hit.yamlText === yamlText && hit.artVersion === artVersion) return hit.tile
  const tile = tileOf(yamlText, ctx)
  cache.set(id, { yamlText, artVersion, tile })
  return tile
}
