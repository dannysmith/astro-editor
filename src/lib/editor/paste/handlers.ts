import { EditorView } from '@codemirror/view'
import { EditorSelection, type EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { commands } from '@/lib/bindings'
import { useEditorStore } from '../../../store/editorStore'
import { isValidUrl } from '../urls/detection'
import { htmlToMarkdown } from './html-to-markdown'
import { imagesToPaste, pasteImages } from './images'

/**
 * Handles a paste: a URL over selected text makes a link, images are saved
 * into the collection's assets and inserted, and copied rich text is pasted
 * as Markdown. Anything else is left to CodeMirror.
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

  const markdown = markdownToPaste(view.state, event.clipboardData)
  if (markdown) {
    event.preventDefault()
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: markdown },
      selection: { anchor: from + markdown.length },
      scrollIntoView: true,
      userEvent: 'input.paste',
    })
    return true
  }
  return false
}

/** Syntax nodes the cursor can be in where copied text is pasted as it is */
const CODE = new Set(['FencedCode', 'CodeBlock', 'InlineCode'])

/**
 * Copied rich text as Markdown, or null to paste its plain text: when
 * there's no HTML, when it's from VS Code (which copies highlighted code as
 * HTML), when the cursor is in code, or when the HTML has no formatting to
 * keep.
 */
export const markdownToPaste = (
  state: EditorState,
  clipboard: DataTransfer | null
): string | null => {
  const html = clipboard?.getData('text/html')
  if (!html || clipboard?.types.includes('vscode-editor-data')) return null

  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(
      state.selection.main.from,
      -1
    );
    node;
    node = node.parent
  ) {
    if (CODE.has(node.name)) return null
  }

  const markdown = htmlToMarkdown(html)
  const plain = clipboard?.getData('text/plain') ?? ''
  const words = (text: string) => text.replace(/\s+/g, ' ').trim()
  const unescaped = markdown.replace(/\\(.)/g, '$1')
  return markdown && words(unescaped) !== words(plain) ? markdown : null
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

/**
 * Pastes the clipboard's text as it is, with no conversion (Mod-Shift-v).
 * WebKit gives no paste event for it, so the text is read through Rust
 */
export const pasteAsPlainText = (view: EditorView): boolean => {
  const { openGeneration } = useEditorStore.getState()
  void commands.readTextFromClipboard().then(result => {
    if (result.status === 'error' || !result.data) return
    // The view is reused for the next file opened
    if (useEditorStore.getState().openGeneration !== openGeneration) return
    const text = result.data
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
      userEvent: 'input.paste',
    })
  })
  return true
}
