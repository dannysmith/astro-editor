/**
 * Focus management utilities
 */

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

    if (cmEditor) {
      cmEditor.focus()
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
    // eslint-disable-next-line no-console
    console.warn('Failed to focus editor:', error)
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
