import type { EditorState, Range } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Code Block Background Extension
 *
 * Adds a background color to fenced code blocks (``` syntax).
 * Applies line decorations to each line within the code block,
 * including the opening and closing fence markers.
 */

function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FencedCode') {
        // Get all lines within the fenced code block
        const startLine = state.doc.lineAt(node.from)
        const endLine = state.doc.lineAt(node.to)
        const isSingleLine = startLine.number === endLine.number

        // Apply decoration to each line in the code block
        for (
          let lineNum = startLine.number;
          lineNum <= endLine.number;
          lineNum++
        ) {
          const line = state.doc.line(lineNum)
          const isFirst = lineNum === startLine.number
          const isLast = lineNum === endLine.number

          // Determine CSS class based on position
          let className = 'cm-codeblock-line'
          if (isSingleLine) {
            className += ' cm-codeblock-only'
          } else if (isFirst) {
            className += ' cm-codeblock-first'
          } else if (isLast) {
            className += ' cm-codeblock-last'
          }

          decorations.push(
            Decoration.line({ class: className }).range(line.from)
          )
        }
      }
    },
  })

  return Decoration.set(decorations, true)
}

export const codeBlockBackgroundExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildCodeBlockDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged) {
      return buildCodeBlockDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})
