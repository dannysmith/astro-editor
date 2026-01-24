import type { EditorState, Range } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Syntax Mark Decorations Extension
 *
 * Applies custom styling to markdown syntax marks (the symbols like #, *, **, etc.)
 * that need styling beyond what the highlight system provides.
 *
 * WHY THIS EXISTS:
 * A behavior change in @lezer/highlight 1.2.2 means that when custom styleTags are
 * added to nodes that already have rules, the old rules are now preserved and checked
 * first. The built-in @lezer/markdown maps all marks to tags.processingInstruction,
 * which matches before our contextual rules (like 'ATXHeading1/HeaderMark') can be
 * evaluated.
 *
 * This extension bypasses the highlight system by directly decorating mark nodes
 * with custom classes that we style in theme.ts.
 *
 * MARKS HANDLED:
 * - HeaderMark inside ATXHeading → .cm-heading-mark (pink, bold)
 * - EmphasisMark inside Emphasis → .cm-emphasis-mark (gray, italic)
 * - EmphasisMark inside StrongEmphasis → .cm-strong-mark (gray, bold)
 */

const headingMarkDecoration = Decoration.mark({ class: 'cm-heading-mark' })
const emphasisMarkDecoration = Decoration.mark({ class: 'cm-emphasis-mark' })
const strongMarkDecoration = Decoration.mark({ class: 'cm-strong-mark' })

function buildMarkDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter(node) {
      const parent = node.node.parent
      if (!parent) return

      // HeaderMark inside ATX headings → pink, bold
      if (node.name === 'HeaderMark' && /^ATXHeading[1-6]$/.test(parent.name)) {
        decorations.push(headingMarkDecoration.range(node.from, node.to))
      }

      // EmphasisMark inside Emphasis → gray, italic
      if (node.name === 'EmphasisMark' && parent.name === 'Emphasis') {
        decorations.push(emphasisMarkDecoration.range(node.from, node.to))
      }

      // EmphasisMark inside StrongEmphasis → gray, bold
      if (node.name === 'EmphasisMark' && parent.name === 'StrongEmphasis') {
        decorations.push(strongMarkDecoration.range(node.from, node.to))
      }
    },
  })

  return Decoration.set(decorations, true)
}

export const syntaxMarkDecorationsExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildMarkDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged) {
      return buildMarkDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})
