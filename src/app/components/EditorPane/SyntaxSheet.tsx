// The rich text cheat sheet under the editor: each form and what it
// prints, then every icon by name, drawn by the card renderer.
import { Fragment, useId, useMemo } from 'react'
import { ICON_GROUPS, RICH_TEXT_SYNTAX } from '../../../core/index.ts'
import { iconMarkup } from '../../editor/iconMarkup.ts'

export function SyntaxSheet() {
  return (
    <div className="syntax-sheet">
      <section className="sheet-part">
        <h2>Syntax</h2>
        <dl className="syntax-forms">
          {Object.values(RICH_TEXT_SYNTAX).map(({ form, doc }) => (
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
      </section>
      <section className="sheet-part">
        <h2>Icons</h2>
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
      </section>
    </div>
  )
}

/** a doc line, its `backticked` parts set as code */
function Doc({ text }: { text: string }) {
  return text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))
}

function IconSample({ name }: { name: string }) {
  // each mounted <svg> scopes its ids; ':' breaks url() fragment references
  const idPrefix = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-`
  const { viewBox, width, height, markup } = useMemo(
    () => iconMarkup(name, idPrefix),
    [name, idPrefix],
  )
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
