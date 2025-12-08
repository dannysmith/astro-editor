import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

/**
 * Split the current selection into multiple cursors, one at the end of each line.
 * Empty lines within the selection are included.
 */
export const splitSelectionByLines = (view: EditorView): boolean => {
  const { state } = view
  const { from, to } = state.selection.main

  // If no selection (just a cursor), do nothing
  if (from === to) return false

  // Get all lines in the selection
  const startLine = state.doc.lineAt(from)
  let endLine = state.doc.lineAt(to)

  // Edge case: if `to` is exactly at the start of a line, the user hasn't
  // selected any content on that line (e.g., selected "Line 1\n" ending at
  // the start of Line 2). Exclude that line.
  if (to === endLine.from && endLine.number > startLine.number) {
    endLine = state.doc.line(endLine.number - 1)
  }

  // If selection is on a single line, nothing to split
  if (startLine.number === endLine.number) return false

  const cursors: number[] = []

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum)
    // Place cursor at end of each line
    cursors.push(line.to)
  }

  view.dispatch({
    selection: EditorSelection.create(
      cursors.map(pos => EditorSelection.cursor(pos)),
      cursors.length - 1 // Make last cursor the main selection
    ),
  })

  return true
}
