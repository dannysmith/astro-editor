import { EditorView } from '@codemirror/view'

/**
 * Create the editor theme extension
 */
export const createEditorTheme = () => {
  return EditorView.theme({
    '&': {
      fontSize: 'var(--editor-font-size)',
      fontFamily: 'var(--editor-font-family)',
      fontWeight: 'var(--editor-font-weight-normal)',
      fontVariationSettings: 'var(--editor-font-variation-settings)',
      letterSpacing: 'var(--editor-letter-spacing)',
      WebkitFontSmoothing: 'subpixel-antialiased',
      backgroundColor: 'var(--editor-color-background)',
      color: 'var(--editor-color-text)',
      containerType: 'inline-size',
      containerName: 'editor',
    },
    '.cm-editor': {
      backgroundColor: 'var(--editor-color-background)',
      borderRadius: '0',
      outline: 'none',
    },
    '.cm-content': {
      lineHeight: 'var(--editor-line-height)',
      minHeight: 'calc(100vh - 68px)', // Subtract titlebar (44px) + statusbar (24px)
      maxWidth: 'var(--editor-content-max-width)',
      margin: '0 auto',
      padding: '40px 0',
    },
    '.cm-scroller': {
      fontVariantLigatures: 'none', // Disable ligatures to fix cursor positioning with iA Writer Duo
      backgroundColor: 'var(--editor-color-background)',
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-editor.cm-focused': {
      outline: 'none !important',
    },
    '.cm-line': {
      padding: '0',
    },
    // Cursor styling
    '.cm-cursor': {
      borderLeftColor: 'var(--editor-color-carat)',
      borderLeftWidth: '3px',
      height: '1.1em',
    },
    // Selection styling
    '.cm-selectionBackground': {
      backgroundColor: 'var(--editor-color-selectedtext-background) !important',
    },
    '.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--editor-color-selectedtext-background) !important',
    },
    // URL Alt+Click hover styling
    '&.alt-pressed .cm-content': {
      cursor: 'default',
    },

    // Snippet field styling
    '.cm-snippetField': {
      border: '1px solid rgba(0, 0, 0, 0.05)',
      backgroundColor: 'var(--editor-color-background)',
      borderRadius: '1px',
      padding: '1px',
      color: 'var(--editor-color-text)',
    },
    '.cm-snippetFieldPosition': {
      borderLeft: '1px solid rgba(0, 0, 0, 0.05)',
    },
    // Active/focused snippet field
    '.cm-snippetField.cm-focused': {
      backgroundColor: 'var(--editor-color-background)',
      border: '1px solid rgba(0, 0, 0, 0.1)',
    },
  })
}
