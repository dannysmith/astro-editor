import { EditorView, dropCursor, drawSelection } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { history } from '@codemirror/commands'
import { closeBrackets } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { markdownStyleExtension, comprehensiveHighlightStyle } from '../syntax'
import { altKeyState, urlHoverPlugin, handleUrlClick } from '../urls'
import { handlePaste } from '../paste'
import { createKeymapExtensions } from './keymap'
import { createEditorTheme } from './theme'
import { createFocusModeExtension } from './focus-mode'
import { createTypewriterModeExtension } from './typewriter-mode'
import { createCopyeditModeExtension } from './copyedit-mode'
import { hangingHeadersExtension } from './hanging-headers'

/**
 * Configuration for creating editor extensions
 */
export interface ExtensionConfig {
  onFocus: () => void
  onBlur: () => void
  componentBuilderHandler?: (view: EditorView) => boolean
}

/**
 * Create all editor extensions
 */
export const createExtensions = (config: ExtensionConfig) => {
  const { onFocus, onBlur, componentBuilderHandler } = config

  const extensions = [
    // Core functionality
    altKeyState,
    urlHoverPlugin,
    dropCursor(),
    drawSelection(),
    closeBrackets(),
    EditorState.allowMultipleSelections.of(true),
    EditorView.clickAddsSelectionRange.of(
      event => event.metaKey || event.ctrlKey
    ),

    // Language support
    markdown({
      extensions: [markdownStyleExtension],
    }),
    syntaxHighlighting(comprehensiveHighlightStyle),
    history(),

    // Keymaps
    ...createKeymapExtensions(componentBuilderHandler),

    // Event handlers
    EditorView.domEventHandlers({
      paste: (event, view) => handlePaste(view, event),
      click: (event, view) => {
        // Handle Alt+Click for URL opening
        if (event.altKey) {
          void handleUrlClick(view, event)
        }
        return false // Let default handling proceed
      },
      focus: () => {
        onFocus()
        return false
      },
      blur: () => {
        onBlur()
        return false
      },
    }),

    // Writing modes - Always include extensions, toggle via state
    ...createFocusModeExtension(),
    ...createTypewriterModeExtension(),
    ...createCopyeditModeExtension(),

    // Visual enhancements
    hangingHeadersExtension,

    // Theme and styling
    createEditorTheme(),
    EditorView.lineWrapping,
  ]

  return extensions
}
