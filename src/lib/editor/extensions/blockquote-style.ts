import type { EditorState, Range } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Blockquote Style Extension
 *
 * Adds CSS class to lines within blockquotes to enable
 * styling of the entire line content (italic, grey color).
 *
 * This is necessary because CodeMirror's styleTags only applies
 * to exact nodes, not their children. Blockquote text is in child
 * Paragraph nodes that don't inherit the Blockquote styling.
 */

function buildBlockquoteDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'Blockquote') {
        // Get all lines within this blockquote
        const startLine = state.doc.lineAt(node.from)
        const endLine = state.doc.lineAt(node.to)

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = state.doc.line(lineNum)
          decorations.push(
            Decoration.line({
              class: 'cm-blockquote',
            }).range(line.from)
          )
        }
      }
    },
  })

  return Decoration.set(decorations, true)
}

export const blockquoteStyleExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildBlockquoteDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged) {
      return buildBlockquoteDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})
