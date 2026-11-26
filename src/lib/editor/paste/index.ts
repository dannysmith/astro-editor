/**
 * Paste handling system for the editor
 *
 * This module provides enhanced paste functionality:
 *
 * - URL detection in clipboard content
 * - Automatic markdown link creation when pasting URLs over selected text
 * - Integration with existing URL utilities
 *
 * Usage:
 * ```typescript
 * import { handlePaste } from './paste'
 *
 * const extensions = [
 *   EditorView.domEventHandlers({
 *     paste: (event, view) => handlePaste(view, event)
 *   })
 * ]
 * ```
 */

export { handlePaste, isClipboardUrl, pasteAsPlainText } from './handlers'
