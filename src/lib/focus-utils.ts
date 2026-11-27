/**
 * Focus management utilities
 */

import { getCurrentEditorView } from './editor/editor-view-ref'

/**
 * Focuses the editor, if a file is open. `view.focus()` keeps the scroll
 * position, which focusing the content element directly doesn't in WebKit
 */
export function focusEditor(): void {
  getCurrentEditorView()?.focus()
}

/**
 * Focuses the editor with a small delay to allow for DOM updates
 * Useful after closing dialogs or modals
 */
export function focusEditorDelayed(delay = 100): void {
  setTimeout(() => {
    // Don't steal focus from dialogs that opened after the delay was scheduled
    // (e.g. command palette executing a command that opens a dialog)
    if (document.querySelector('[role="dialog"]')) return
    focusEditor()
  }, delay)
}
