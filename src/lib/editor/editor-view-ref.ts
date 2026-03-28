import type { EditorView } from '@codemirror/view'

/**
 * Module-level reference to the active CodeMirror EditorView.
 * Set by Editor.tsx on mount, cleared on unmount.
 * Used by features that need the editor view without a direct reference
 * (e.g. content linker opened from the command palette).
 */
let currentView: EditorView | null = null

export function setCurrentEditorView(view: EditorView | null) {
  currentView = view
}

export function getCurrentEditorView(): EditorView | null {
  return currentView
}
