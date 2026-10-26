import { EditorView } from '@codemirror/view'
import { openPath } from '@tauri-apps/plugin-opener'
import { findUrlsInText } from './detection'

/**
 * Handle Alt+Click on URLs to open them in browser
 * @param view - CodeMirror editor view
 * @param event - Mouse event
 * @returns true if the event was handled, false otherwise
 */
export const handleUrlClick = async (
  view: EditorView,
  event: MouseEvent
): Promise<boolean> => {
  if (!event.altKey) return false

  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return false

  const doc = view.state.doc
  const line = doc.lineAt(pos)
  const urls = findUrlsInText(line.text, line.from)

  // Check if click position is within any URL
  const clickedUrl = urls.find(url => pos >= url.from && pos <= url.to)
  if (!clickedUrl) return false

  try {
    await openPath(clickedUrl.url)
    return true // Prevent default click behavior
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error('Failed to open URL:', error)
    return false
  }
}
