import { acceptCompletion, autocompletion } from '@codemirror/autocomplete'
import { redo } from '@codemirror/commands'
import { yaml, yamlLanguage } from '@codemirror/lang-yaml'
import { lintGutter } from '@codemirror/lint'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { getServices } from '../store/services.ts'
import { blankLineCompletion } from './blankLineCompletion.ts'
import { optionIcons, optionIconTheme } from './completionIcons.ts'
import { cardCompletions } from './completions.ts'
import { continueList, openRows } from './continueList.ts'
import { keyHelp } from './keyHelp.ts'
import { cardLinter } from './lintSource.ts'
import { richTextHelp } from './richTextHelp.ts'

export function makeEditorState(text: string, onChange: (text: string) => void): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      // the list of keys that comes up on a blank line, and Enter's way past it
      blankLineCompletion,
      keymap.of([
        // basicSetup only binds Ctrl-Shift-Z for redo on platforms it sniffs as Linux
        { key: 'Mod-Shift-z', run: redo, preventDefault: true },
        // Tab still moves focus when no completion popup is open
        { key: 'Tab', run: acceptCompletion },
        // ahead of basicSetup's newline; an open completion popup still takes Enter first
        { key: 'Enter', run: openRows },
        { key: 'Enter', run: continueList },
      ]),
      basicSetup,
      yaml(),
      // closeBrackets pairs and wraps only the brackets listed, and only before
      // whitespace or a `before` character: card text uses <>, and a quoted row
      // puts a bracket right before its closing quote
      yamlLanguage.data.of({
        closeBrackets: { brackets: ['(', '[', '{', "'", '"', '<'], before: ')]}:;>"\'' },
      }),
      // One Dark paints the chosen completion darker than the list around it,
      // so with few rows the others look like the lit one; its reference theme
      // fills a chosen list row blue with white text. Placed ahead of oneDark:
      // of two themes styling one thing, the earlier wins
      EditorView.theme({
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
          backgroundColor: '#4d78cc',
          color: 'white',
        },
      }),
      oneDark,
      cardLinter,
      lintGutter(),
      keyHelp,
      richTextHelp,
      autocompletion({
        override: [(context) => cardCompletions(context, getServices().art.files())],
        // cardCompletions is synchronous, so the popup delays buy nothing
        activateOnTypingDelay: 0,
        interactionDelay: 0,
        // the icon column draws the icons a word in braces names
        icons: false,
        addToOptions: [optionIcons],
      }),
      optionIconTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString())
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" },
      }),
    ],
  })
}
