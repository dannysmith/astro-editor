import type { EditorState, Range } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Hanging Headers Extension
 *
 * Adds CSS classes to ATX-style heading lines (# syntax) to enable
 * hanging indent styling where hash marks appear in the left margin
 * and heading text aligns with body text.
 *
 * Only affects ATX headings (ATXHeading1-6), not Setext headings (underline syntax).
 */

function buildHeaderDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter(node) {
      // Only process ATX headings (not Setext)
      if (/^ATXHeading[1-6]$/.test(node.name)) {
        const line = state.doc.lineAt(node.from)
        const level = node.name.slice(-1) // "1" through "6"

        decorations.push(
          Decoration.line({
            class: `cm-hanging-header cm-hanging-header-${level}`,
          }).range(line.from)
        )
      }
    },
  })

  return Decoration.set(decorations, true)
}

export const hangingHeadersExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildHeaderDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged) {
      return buildHeaderDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})
