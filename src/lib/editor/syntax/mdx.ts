import type {
  BlockContext,
  Element,
  Line,
  MarkdownConfig,
} from '@lezer/markdown'

/**
 * MDX's JSX tags on their own lines, for `.mdx` files.
 *
 * CommonMark reads a line like `<Callout>` as the start of an HTML block that
 * runs to the next blank line, so the Markdown inside a component isn't
 * parsed. In MDX a component's children are Markdown, so here a line holding
 * only tags (which may span lines, like `<Card title="…"\n  href={…} />`)
 * becomes an `HTMLBlock` of just those tags, and the lines after it parse as
 * Markdown. Reusing `HTMLBlock` keeps everything that handles HTML (tag
 * highlighting, Harper's masking) working unchanged.
 *
 * Lines with text after a tag (`<Badge>New</Badge> and more`) are left to the
 * paragraph, where tags parse inline. `.md` files keep CommonMark's rules,
 * which match how Astro renders them.
 */

const LT = 60 // <

/**
 * A tag's start: `<Name`, `</Name` (names may hold `.`, `:` and `-`) or a
 * fragment's `<>` and `</>`. What follows the name rules out autolinks like
 * `<https://…>` and prose like `a < b`
 */
const TAG_START = /^<(?:\/?[A-Za-z][\w.:-]*(?=[\s>{]|\/>|$)|\/?>)/

/** Where the scan is between lines, while a tag spans several */
interface ScanState {
  inTag: boolean
  quote: string | null
  braces: number
}

type ScanResult = 'tags' | 'open' | 'text'

/**
 * Scans `text` from `from`. `tags` when the line holds only complete tags and
 * space, `open` when a tag continues on the next line, and `text` when
 * anything else is on the line outside a tag.
 */
function scanLine(text: string, from: number, state: ScanState): ScanResult {
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (state.inTag) {
      if (state.quote) {
        if (ch === state.quote) state.quote = null
      } else if (ch === '"' || ch === "'" || ch === '`') {
        state.quote = ch
      } else if (ch === '{') {
        state.braces++
      } else if (ch === '}') {
        state.braces = Math.max(0, state.braces - 1)
      } else if (ch === '>' && state.braces === 0) {
        state.inTag = false
      }
    } else if (ch === '<' && TAG_START.test(text.slice(i))) {
      state.inTag = true
    } else if (ch !== ' ' && ch !== '\t') {
      return 'text'
    }
  }
  // A string or expression can't run on past the end of the line outside a tag
  return state.inTag ? 'open' : 'tags'
}

/** Whether `line` starts with a tag and holds nothing but tags */
function isTagLine(line: Line): boolean {
  if (line.next !== LT || !TAG_START.test(line.text.slice(line.pos))) {
    return false
  }
  const state: ScanState = { inTag: false, quote: null, braces: 0 }
  return scanLine(line.text, line.pos, state) !== 'text'
}

function parseJsxFlow(cx: BlockContext, line: Line): boolean {
  if (!isTagLine(line)) return false

  const from = cx.lineStart + line.pos
  const state: ScanState = { inTag: false, quote: null, braces: 0 }
  const markers: Element[] = []
  let result = scanLine(line.text, line.pos, state)
  while (result === 'open' && cx.nextLine()) {
    markers.push(...line.markers)
    result = scanLine(line.text, line.pos, state)
  }
  cx.nextLine()
  cx.addElement(cx.elt('HTMLBlock', from, cx.prevLineEnd(), markers))
  return true
}

/** The Markdown extension for `.mdx` files */
export const mdxJsxFlow: MarkdownConfig = {
  parseBlock: [
    {
      name: 'MDXJsxFlow',
      before: 'SetextHeading',
      parse: parseJsxFlow,
      // In MDX a tag on its own line ends the paragraph before it, so a
      // component's closing tag isn't read as part of its last paragraph
      endLeaf: (_, line) => isTagLine(line),
    },
  ],
  // CommonMark's HTML blocks would swallow a component's contents; HTML
  // comments aren't valid MDX, and anything else starting with `<` is a tag.
  // MDX has no indented code, so a component's indented children stay prose
  remove: ['HTMLBlock', 'IndentedCode'],
}
