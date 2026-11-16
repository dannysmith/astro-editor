/**
 * Turns a Markdown or MDX document into the prose Harper should check.
 *
 * Everything that isn't prose (code, URLs, syntax marks, HTML and JSX tags,
 * MDX imports and `{expressions}`) is replaced with `MASK`, keeping newlines,
 * so the result is exactly as long as the document and Harper's offsets are
 * document positions with no mapping. Harper is given `MASK_PATTERN` as its
 * regex mask, so it skips those characters and joins the text either side
 * (`this</em>.` reads as `this.`). It checks the result as plain text, which
 * also stops it reading text indented inside an MDX component as a code
 * block, as its Markdown parser would.
 */

import type { Tree } from '@lezer/common'

/** Stands in for each character that isn't prose. A private-use character, so never in prose */
export const MASK = ''

/** Harper's `regex_mask`: masked runs are hidden from it */
export const MASK_PATTERN = `${MASK}+`

/** Nodes with no prose in them at all */
const SKIPPED = new Set([
  'FencedCode',
  'CodeBlock',
  'InlineCode',
  'Image',
  'Autolink',
  'URL',
  'LinkTitle',
  'LinkLabel',
  'LinkReference',
  'CommentBlock',
  'Comment',
  'ProcessingInstructionBlock',
  'ProcessingInstruction',
  'HTMLTag',
  'HorizontalRule',
  'Entity',
  'EmphasisMark',
  'StrikethroughMark',
  'QuoteMark',
  'LinkMark',
  'TaskMarker',
])

/**
 * Marks that start a block, or a table cell. Their first character becomes a
 * newline so Harper sees a paragraph break: list items, table cells and
 * headings would otherwise run together into one sentence.
 */
const BLOCK_MARKS = new Set(['ListMark', 'TableDelimiter', 'HeaderMark'])

/** MDX lines that are code: `import … from '…'` and `export const …` */
const MDX_STATEMENT = /^(?:import|export)\s/

/** Patterns masked across the whole text once the tree has been walked */
const TEXT_PATTERNS = [
  // Contents of script and style elements
  /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
  // MDX expressions, innermost first so nesting is handled by repeat passes
  /\{[^{}]*\}/g,
  /\{[^{}]*\}/g,
  // HTML and JSX tags, including multi-line ones. A letter must follow `<`, so
  // prose like `a < b` is left alone
  /<\/?[A-Za-z][^<>]*>/g,
]

/** The document's prose, as described above */
export function proseText(doc: string, tree: Tree): string {
  const chars = doc.split('')

  const mask = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      if (chars[i] !== '\n') chars[i] = MASK
    }
  }

  tree.iterate({
    enter: node => {
      if (BLOCK_MARKS.has(node.name)) {
        mask(node.from, node.to)
        chars[node.from] = '\n'
        return false
      }
      if (SKIPPED.has(node.name)) {
        mask(node.from, node.to)
        return false
      }
      if (node.name === 'Escape') {
        // Keep the escaped character, drop the backslash
        mask(node.from, node.from + 1)
        return false
      }
      if (
        node.name === 'Paragraph' &&
        MDX_STATEMENT.test(doc.slice(node.from, node.from + 7))
      ) {
        mask(node.from, node.to)
        return false
      }
      return undefined
    },
  })

  let text = chars.join('')
  for (const pattern of TEXT_PATTERNS) {
    text = text.replace(pattern, match => match.replace(/[^\n]/g, MASK))
  }
  return text
}
