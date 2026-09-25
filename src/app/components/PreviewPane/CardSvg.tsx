// The preview card: core's markup (the export path minus text outlining) in
// an <svg> wrapper, with the cut line and the dev overlays.
import { useId, useMemo } from 'react'
import {
  CARD_H,
  CARD_R,
  CARD_W,
  COMMON,
  fmt,
  renderSvgMarkup,
  REQ_BOX,
  type AssetRef,
  type CardLayout,
  type Rect,
} from '../../../core/index.ts'

interface CardSvgProps {
  layout: CardLayout
  resolveAsset: (ref: AssetRef) => string
  /** dev calibration overlay: mm grid + frame region outlines */
  calibrate?: boolean
  /** dev: a reference render's href, shown in the card's place */
  reference?: string
}

// the cut corner as percentages, so CSS scales it with the rendered card
const CORNER = `${fmt((CARD_R / CARD_W) * 100)}% / ${fmt((CARD_R / CARD_H) * 100)}%`

export function CardSvg({ layout, resolveAsset, calibrate, reference }: CardSvgProps) {
  // HTML resolves url(#...) page-wide across inline <svg>s, so every mounted
  // card scopes its generated ids with its own prefix (useId is unique per
  // mount; sanitized because ':' breaks url() fragment references)
  const idPrefix = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-`
  // memoized: the frame markup is rebuilt from scratch on every call
  const markup = useMemo(
    () => renderSvgMarkup(layout, { resolveAsset, idPrefix }),
    [layout, resolveAsset, idPrefix],
  )
  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      style={{ borderRadius: CORNER }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {reference ? (
        <image href={reference} width={CARD_W} height={CARD_H} preserveAspectRatio="none" />
      ) : (
        <g dangerouslySetInnerHTML={{ __html: markup }} />
      )}
      {calibrate && <CalibrationOverlay layout={layout} />}
    </svg>
  )
}

/** mm grid + key region outlines, toggled with ?calibrate */
function CalibrationOverlay({ layout }: { layout: CardLayout }) {
  const regions = layout.frame.regions
  const outlines: { rect: Rect; color: string; label: string }[] = []
  if (regions) {
    outlines.push({ rect: regions.artWindow, color: '#0ff', label: 'art' })
    outlines.push({ rect: regions.bodyBox, color: '#0f0', label: 'body' })
    outlines.push({
      rect: { x: regions.numCenter.x - 1.55, y: regions.numCenter.y - 0.7, w: 3.1, h: 1.4 },
      color: '#fa0',
      label: 'num',
    })
    if (regions.actionTop !== undefined)
      outlines.push({
        rect: {
          x: regions.bodyBox.x,
          y: regions.actionTop,
          w: regions.bodyBox.w,
          h: regions.artWindow.y - regions.actionTop,
        },
        color: '#08f',
        label: 'action',
      })
    outlines.push({ rect: COMMON.vpRect, color: '#f80', label: 'vp' })
    outlines.push({
      rect: { x: REQ_BOX.x, y: REQ_BOX.top, w: 44, h: REQ_BOX.h },
      color: '#f00',
      label: 'req',
    })
  }
  const lines = []
  for (let x = 0; x <= CARD_W; x += 1) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={CARD_H}
        stroke={x % 10 === 0 ? '#f0f' : '#f0f6'}
        strokeWidth={x % 10 === 0 ? 0.08 : 0.03}
      />,
    )
  }
  for (let y = 0; y <= CARD_H; y += 1) {
    lines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={CARD_W}
        y2={y}
        stroke={y % 10 === 0 ? '#f0f' : '#f0f6'}
        strokeWidth={y % 10 === 0 ? 0.08 : 0.03}
      />,
    )
  }
  return (
    <g>
      {lines}
      {outlines.map(({ rect, color, label }) => (
        <g key={label}>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill="none"
            stroke={color}
            strokeWidth={0.25}
          />
          <text x={rect.x + 0.5} y={rect.y + 1.6} fontSize={1.6} fill={color}>
            {label}
          </text>
        </g>
      ))}
    </g>
  )
}
