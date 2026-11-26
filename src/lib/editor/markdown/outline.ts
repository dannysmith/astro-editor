import { EditorSelection, type EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { ensureSyntaxTree } from '@codemirror/language'
import { defaultFilter } from 'cmdk'

/** A heading in the document, as listed by the command palette's `#` mode */
export interface DocumentHeading {
  level: number
  text: string
  /** Where the heading's text ends; the cursor goes here when jumping to it */
  to: number
}

const HEADING_NODE = /^(?:ATX|Setext)Heading([1-6])$/

/**
 * The document's headings in order, read from the Markdown syntax tree so `#`
 * lines inside code blocks don't count. Headings with no text are skipped.
 */
export function getDocumentHeadings(state: EditorState): DocumentHeading[] {
  // The palette can open before the background parser reaches the end of a
  // long document, so finish the parse first
  const tree = ensureSyntaxTree(state, state.doc.length, 1000)
  if (!tree) return []

  const headings: DocumentHeading[] = []
  tree.iterate({
    enter(node) {
      const match = HEADING_NODE.exec(node.name)
      if (!match) return
      // The text sits between the heading's marks: `## Text ##`, or a Setext
      // heading's text above its `===` underline
      let from = node.from
      let to = node.to
      for (let mark = node.node.firstChild; mark; mark = mark.nextSibling) {
        if (mark.name !== 'HeaderMark') continue
        if (mark.from === node.from) from = mark.to
        else to = Math.min(to, mark.from)
      }
      const raw = state.doc.sliceString(from, to)
      const text = raw.trim().replace(/\s+/g, ' ')
      if (text) {
        headings.push({
          level: Number(match[1]),
          text,
          to: to - (raw.length - raw.trimEnd().length),
        })
      }
      return false
    },
  })
  return headings
}

/**
 * The headings matching a `#` search, fuzzily as cmdk matches, kept in
 * document order so their indentation still reads as an outline
 */
export function filterHeadings(
  headings: DocumentHeading[],
  search: string
): DocumentHeading[] {
  const query = search.replace(/^#+/, '').trim()
  if (!query) return headings
  return headings.filter(heading => defaultFilter(heading.text, query) > 0)
}

/**
 * Puts the cursor at the end of a heading and scrolls it to the top of the
 * editor. In typewriter mode its own scroll comes after this one and centres
 * the heading instead. Does nothing if the heading isn't where it was read,
 * as when the file is reloaded from disk while the palette lists its headings.
 */
export function goToHeading(view: EditorView, heading: DocumentHeading) {
  const current = getDocumentHeadings(view.state)
  if (!current.some(h => h.to === heading.to && h.text === heading.text)) {
    return
  }
  view.dispatch({
    selection: EditorSelection.cursor(heading.to),
    effects: EditorView.scrollIntoView(heading.to, { y: 'start', yMargin: 48 }),
    userEvent: 'select',
  })
}
