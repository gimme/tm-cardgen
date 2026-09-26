// The row-language cheat sheet under the editor: each form and what it
// prints, then every icon by name, drawn by the card renderer.
import { Fragment, useId, useMemo } from 'react'
import { fmt, ICON_GROUPS, iconSample, renderSvgMarkup, ROW_SYNTAX } from '../../../core/index.ts'
import { makePreviewResolver } from '../../services/assetService.ts'

/** the icons print at this scale: a resource cube 16px tall */
const PX_PER_MM = 2.4

// the icons are bundled assets, never user art
const resolveAsset = makePreviewResolver(() => undefined)

export function SyntaxSheet() {
  return (
    <div className="syntax-sheet">
      <dl className="syntax-forms">
        {ROW_SYNTAX.map(({ form, doc }) => (
          <Fragment key={form}>
            <dt>
              <code>{form}</code>
            </dt>
            <dd>
              <Doc text={doc} />
            </dd>
          </Fragment>
        ))}
      </dl>
      {ICON_GROUPS.map(({ title, names }) => (
        <section key={title}>
          <h3>{title}</h3>
          <ul>
            {names.map((name) => (
              <li key={name}>
                <IconSample name={name} />
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** a doc line, its `backticked` parts set as code */
function Doc({ text }: { text: string }) {
  return text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))
}

function IconSample({ name }: { name: string }) {
  // the coin's gradients carry ids; each mounted <svg> scopes its own
  const idPrefix = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-`
  const { w, h, markup } = useMemo(() => {
    const chunk = iconSample(name)
    return { w: chunk.w, h: chunk.h, markup: renderSvgMarkup(chunk, { resolveAsset, idPrefix }) }
  }, [name, idPrefix])
  // whole pixels: a fractional edge row gets clipped off
  return (
    <svg
      viewBox={`0 0 ${fmt(w)} ${fmt(h)}`}
      width={Math.round(w * PX_PER_MM)}
      height={Math.round(h * PX_PER_MM)}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
