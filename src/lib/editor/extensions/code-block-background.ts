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
 *
 * The block holding the cursor also gets `cm-codeblock-active`. Code is parsed
 * in its fence's language everywhere, but `theme.ts` only shows that
 * highlighting in the active block, so code stays calm while writing around it.
 */

/** Nodes that can't contain a fenced code block */
const LEAF_BLOCKS = new Set(['Paragraph', 'FencedCode', 'CodeBlock', 'Table'])

function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const cursor = state.selection.main.head

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FencedCode') {
        // Get all lines within the fenced code block
        const startLine = state.doc.lineAt(node.from)
        const endLine = state.doc.lineAt(node.to)
        const isSingleLine = startLine.number === endLine.number
        const isActive = cursor >= node.from && cursor <= node.to

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
          if (isActive) className += ' cm-codeblock-active'

          decorations.push(
            Decoration.line({ class: className }).range(line.from)
          )
        }
      }
      // This runs on every cursor move, so skip what can't hold a code block
      return !LEAF_BLOCKS.has(node.name)
    },
  })

  return Decoration.set(decorations, true)
}

export const codeBlockBackgroundExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildCodeBlockDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged || tr.selection) {
      return buildCodeBlockDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})
