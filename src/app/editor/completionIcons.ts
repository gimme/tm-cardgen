// The cell before each completion's label, in place of CodeMirror's own:
// its glyph for the completion's type, and for a word in braces the icon
// it names, when it names one.
import type { Completion } from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import { hasIcon } from './completions.ts'
import { iconSvg } from './iconMarkup.ts'

function optionCell(completion: Completion): HTMLElement {
  const cell = document.createElement('div')
  cell.className = 'cm-completionIcon'
  if (completion.type)
    cell.classList.add(...completion.type.split(/\s+/).map((t) => `cm-completionIcon-${t}`))
  cell.setAttribute('aria-hidden', 'true')
  if (hasIcon(completion)) {
    const { name, inscription } = completion.icon
    // the coin's gradients carry ids: a list holds each icon once
    cell.append(iconSvg(name, `cm-opt-${name.replace(/[^a-zA-Z0-9_-]/g, '')}-`, inscription))
  }
  return cell
}

/** for autocompletion(): `addToOptions: [optionIcons]`, with `icons: false` */
export const optionIcons = { render: optionCell, position: 20 }

/** The icon column: wide enough for the widest icon at the cheat sheet's
 *  scale, the tall ones shrunk to the row. */
export const optionIconTheme = EditorView.theme({
  '.cm-completionIcon-word': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '18px',
    paddingRight: '6px',
    verticalAlign: 'middle',
    opacity: '1',
  },
  '.cm-completionIcon-word svg': {
    width: 'auto',
    height: 'auto',
    maxWidth: '26px',
    maxHeight: '18px',
  },
})
