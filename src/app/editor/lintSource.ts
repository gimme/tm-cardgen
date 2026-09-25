import { linter, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import { checkCard } from '../../core/index.ts'

/** core ranges are absolute offsets, as CodeMirror wants */
export const cardLinter = linter(
  (view) => {
    const text = view.state.doc.toString()
    const max = text.length
    return checkCard(text).diagnostics.map((d): CmDiagnostic => ({
      from: Math.min(d.from, max),
      to: Math.min(Math.max(d.to, d.from + 1), max),
      severity: d.severity,
      message: d.message,
    }))
  },
  { delay: 200 },
)
