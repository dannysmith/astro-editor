import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { isValidUrl } from '../urls/detection'
import { imagesToPaste, pasteImages } from './images'

/**
 * Handles a paste: a URL over selected text makes a link, and images are
 * saved into the collection's assets and inserted. Anything else is left to
 * CodeMirror.
 * @param view - CodeMirror editor view
 * @param event - ClipboardEvent from paste
 * @returns true if the event was handled, false to allow default behavior
 */
export const handlePaste = (
  view: EditorView,
  event: ClipboardEvent
): boolean => {
  if (pasteUrlOverSelection(view, event)) return true

  const images = imagesToPaste(event.clipboardData)
  if (images) {
    event.preventDefault()
    void pasteImages(view, images)
    return true
  }
  return false
}

/** Makes a Markdown link when a URL is pasted over selected text */
const pasteUrlOverSelection = (
  view: EditorView,
  event: ClipboardEvent
): boolean => {
  const clipboardText = event.clipboardData?.getData('text/plain')
  if (!clipboardText || !isValidUrl(clipboardText.trim())) {
    return false // Let default paste behavior handle non-URLs
  }

  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.sliceDoc(from, to)

  if (selectedText.trim()) {
    // Create markdown link with selected text and pasted URL
    const trimmedUrl = clipboardText.trim()
    const linkText = `[${selectedText}](${trimmedUrl})`
    const urlStart = from + selectedText.length + 3 // Position after "[selectedText]("
    const urlEnd = urlStart + trimmedUrl.length // End of URL

    view.dispatch({
      changes: { from, to, insert: linkText },
      selection: EditorSelection.range(urlStart, urlEnd), // Select just the URL part
    })
    return true // Prevent default paste
  }

  return false // Let default paste behavior handle if no text selected
}

/**
 * Check if clipboard contains a URL
 * @param clipboardText - Text from clipboard
 * @returns true if clipboard contains a valid URL
 */
export const isClipboardUrl = (clipboardText: string | null): boolean => {
  if (clipboardText === null || clipboardText === undefined) return false
  return isValidUrl(clipboardText.trim())
}
