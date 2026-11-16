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
  // A backslash at the end of a line, or two spaces
  'HardBreak',
])

/**
 * Marks that start a block, or a table cell. Their first character becomes a
 * newline so Harper sees a paragraph break: list items, table cells and
 * headings would otherwise run together into one sentence.
 */
const BLOCK_MARKS = new Set(['ListMark', 'TableDelimiter', 'HeaderMark'])

/** MDX lines that are code: `import … from '…'` and `export const …` */
const MDX_STATEMENT = /^(?:import|export)\s/

/**
 * Patterns masked across the whole text once the tree has been walked. The
 * tree reads an HTML or MDX component as one HTML block, so the Markdown
 * inside one (code, links, images) is only masked by these.
 */
const TEXT_PATTERNS = [
  // Anything too long to be a word, like a pasted hash or base64, first:
  // Harper crashes on a single token of a few thousand characters, and the
  // path and domain patterns below slow down badly on one
  new RegExp(`[^\\s${MASK}]{200,}`, 'g'),
  // Contents of script and style elements
  /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
  // Fenced code, which may be indented inside a component
  /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm,
  // Inline code
  /`[^`\n]+`/g,
  // Display maths
  /\$\$[\s\S]*?\$\$/g,
  // Images
  /!\[[^\]\n]*\]\([^)\n]*\)/g,
  // Bare URLs
  /\bhttps?:\/\/[^\s)>\]]+/g,
  // Paths, file names and domains: src/assets, first-post.md, astro.build
  /(?:\/?[\w.-]+\/)+[\w.-]*/g,
  // (lowercase after the dot, so "end.Next" is left as a missing space)
  /\b[\w-]+(?:\.[a-z0-9-]{2,})+\b/g,
  // MDX expressions, innermost first, so a second pass masks one level of
  // nesting. They can't span a blank line, so a stray `{` in prose doesn't
  // hide the paragraphs after it
  /\{(?:[^{}\n]|\n(?![ \t]*\n))*\}/g,
  /\{(?:[^{}\n]|\n(?![ \t]*\n))*\}/g,
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

  const maskAll = (match: string) => match.replace(/[^\n]/g, MASK)
  let text = chars.join('')
  for (const pattern of TEXT_PATTERNS) {
    text = text.replace(pattern, maskAll)
  }
  // Links: the text is prose, the brackets and target aren't
  return text.replace(
    /\[([^\]\n]*)\](\([^)\n]*\))/g,
    (_match, label: string, target: string) =>
      MASK + label + maskAll(`]${target}`)
  )
}
