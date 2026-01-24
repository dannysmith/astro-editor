import type { EditorState, Range } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Heading Mark Style Extension
 *
 * Applies custom styling to heading marks (the # symbols in ATX headings).
 *
 * This extension exists because of a behavior change in @lezer/highlight 1.2.2:
 * when custom styleTags are added to nodes that already have rules, the old rules
 * are now preserved and checked first. The built-in @lezer/markdown maps HeaderMark
 * to tags.processingInstruction, which matches before our contextual rule
 * 'ATXHeading1/HeaderMark' can be evaluated.
 *
 * This extension bypasses the highlight system by directly decorating HeaderMark
 * nodes inside ATXHeading nodes with a custom class that we style in theme.ts.
 */

const headingMarkDecoration = Decoration.mark({ class: 'cm-heading-mark' })

function buildHeadingMarkDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter(node) {
      // Check if this is a HeaderMark inside an ATX heading
      if (node.name === 'HeaderMark') {
        // Check parent is an ATX heading (not Setext)
        const parent = node.node.parent
        if (parent && /^ATXHeading[1-6]$/.test(parent.name)) {
          decorations.push(headingMarkDecoration.range(node.from, node.to))
        }
      }
    },
  })

  return Decoration.set(decorations, true)
}

export const headingMarkStyleExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildHeadingMarkDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged) {
      return buildHeadingMarkDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})
