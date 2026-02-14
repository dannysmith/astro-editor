/**
 * Editor Extensions Factory
 *
 * Creates and configures all CodeMirror extensions for the editor. This is the
 * main entry point for editor configuration.
 *
 * EXTENSION CATEGORIES:
 *
 * 1. Core Functionality
 *    - Alt key state tracking, URL hover, drag/drop cursor
 *    - Multiple selection support, bracket closing
 *
 * 2. Language Support
 *    - Markdown parser with custom style extensions
 *    - Syntax highlighting via comprehensiveHighlightStyle
 *    - Undo/redo history
 *
 * 3. Keymaps
 *    - Tab handling, markdown shortcuts, default bindings
 *    - See keymap.ts for full shortcut reference
 *
 * 4. Event Handlers
 *    - Paste handling, Alt+Click URL opening
 *    - Focus/blur callbacks for external state sync
 *
 * 5. Writing Modes
 *    - Focus mode (sentence-based dimming)
 *    - Copyedit mode (parts of speech highlighting)
 *
 * 6. Visual Enhancements
 *    - Hanging headers (# in margin)
 *    - Syntax mark decorations (heading/emphasis/strong marks)
 *    - Code block backgrounds
 *    - Blockquote line styling
 *
 * 7. Theme
 *    - Editor styling, line wrapping
 */

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
import { createCopyeditModeExtension } from './copyedit-mode'
import { createTypewriterModeExtension } from './typewriter-mode'
import { hangingHeadersExtension } from './hanging-headers'
import { syntaxMarkDecorationsExtension } from './syntax-mark-decorations'
import { codeBlockBackgroundExtension } from './code-block-background'
import { blockquoteStyleExtension } from './blockquote-style'

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
    ...createCopyeditModeExtension(),
    ...createTypewriterModeExtension(),

    // Visual enhancements
    hangingHeadersExtension,
    syntaxMarkDecorationsExtension,
    codeBlockBackgroundExtension,
    blockquoteStyleExtension,

    // Theme and styling
    createEditorTheme(),
    EditorView.lineWrapping,
  ]

  return extensions
}
