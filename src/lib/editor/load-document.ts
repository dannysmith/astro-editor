import { Compartment, type SelectionRange } from '@codemirror/state'
import { history } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'

/** Undo history, in a compartment so loading a document can start it afresh */
const historyCompartment = new Compartment()

/** The editor's undo history extension, which `loadDocument` resets */
export const undoHistory = () => historyCompartment.of(history())

/**
 * Replaces the whole document with `content` from disk (another file opened,
 * or this one changed outside the editor) and starts the undo history afresh.
 * Undo can't reach past a load: undoing into the previous file would put its
 * text in this one, and an earlier edit undone across a whole-document
 * replacement can insert stale text.
 */
export function loadDocument(
  view: EditorView,
  content: string,
  selection?: { anchor: number } | SelectionRange
): void {
  // The history is removed with the change, so it isn't recorded, then added
  // back empty. Added in the same transaction, it would record the change
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
    selection,
    effects: historyCompartment.reconfigure([]),
  })
  view.dispatch({ effects: historyCompartment.reconfigure(history()) })
}
