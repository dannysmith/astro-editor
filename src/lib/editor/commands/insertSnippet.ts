import { EditorView } from '@codemirror/view'
import { snippet } from '@codemirror/autocomplete'

/** Whether the cursor's line has nothing on it but whitespace */
export function isOnEmptyLine(view: EditorView): boolean {
  const { state } = view
  return state.doc.lineAt(state.selection.main.from).text.trim() === ''
}

/**
 * Inserts a snippet at the current cursor position with tab navigation support
 * @param view The CodeMirror EditorView
 * @param template The snippet template string with ${} placeholders
 * @param block Put the snippet in a paragraph of its own, adding the blank
 *   lines MDX needs around a block component when it isn't already in one
 */
export function insertSnippet(
  view: EditorView,
  template: string,
  { block = false } = {}
) {
  if (!view) return

  const { state } = view
  const range = state.selection.main
  let before = ''
  let after = ''
  if (block) {
    const startLine = state.doc.lineAt(range.from)
    const endLine = state.doc.lineAt(range.to)
    const lineHasText = (n: number) =>
      n >= 1 && n <= state.doc.lines && state.doc.line(n).text.trim() !== ''

    if (state.sliceDoc(startLine.from, range.from).trim()) before = '\n\n'
    else if (lineHasText(startLine.number - 1)) before = '\n'
    if (state.sliceDoc(range.to, endLine.to).trim()) after = '\n\n'
    else if (lineHasText(endLine.number + 1)) after = '\n'
  }

  snippet(before + template + after)(view, null, range.from, range.to)
  view.focus()
}
