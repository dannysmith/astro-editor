/**
 * Focus management utilities
 */

import { warn as logWarn } from '@tauri-apps/plugin-log'

/**
 * Focuses the main editor if it's visible and available
 * Returns true if focus was successfully set, false otherwise
 */
export function focusEditor(): boolean {
  try {
    // Look for CodeMirror editor content area
    const cmEditor = document.querySelector(
      '.cm-editor .cm-content'
    ) as HTMLElement

    // Without preventScroll, WebKit scrolls the editor to the top of its content
    // whenever focusing it, losing the reader's place
    if (cmEditor) {
      cmEditor.focus({ preventScroll: true })
      return true
    }

    // Fallback: try to find the editor container
    const editorContainer = document.querySelector(
      '[data-editor-container]'
    ) as HTMLElement

    if (editorContainer) {
      editorContainer.focus()
      return true
    }

    return false
  } catch (error) {
    void logWarn(`Failed to focus editor: ${String(error)}`)
    return false
  }
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
