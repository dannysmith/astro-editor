import { Compartment } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  defineLanguageFacet,
  Language,
  LanguageSupport,
} from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { htmlLanguage } from '@codemirror/lang-html'
import { jsxLanguage } from '@codemirror/lang-javascript'
import {
  Parser,
  type Input,
  type PartialParse,
  type TreeFragment,
} from '@lezer/common'
import { GFM } from '@lezer/markdown'
import { codeLanguages } from './codeLanguages'
import { mdxJsxFlow } from './mdx'
import { markdownStyleExtension } from './styleExtension'

// GFM enables tables, task lists, strikethrough, and autolinks.
// We add the GFM bundle rather than switching to `base: markdownLanguage`
// so we get GFM only, without subscript/superscript/emoji (single `~x~`
// would otherwise become subscript, which is hostile to prose writing).
// Fenced code is parsed in its language, but only highlighted in the block
// holding the cursor (code-block-background.ts).
const markdownSupport = markdown({
  extensions: [markdownStyleExtension, GFM],
  codeLanguages,
})

const closingTagParser = htmlLanguage.configure({ dialect: 'noMatch' }).parser

/**
 * Parses an MDX file's tags as JSX, so attributes like `date={new Date()}`
 * highlight. JSX can't parse a closing tag without its opening tag, which is
 * how they arrive (each tag line is parsed on its own), so a tag starting
 * `</` is parsed as HTML instead.
 */
class MdxTagParser extends Parser {
  createParse(
    input: Input,
    _fragments: readonly TreeFragment[],
    ranges: readonly { from: number; to: number }[]
  ): PartialParse {
    const from = ranges[0]?.from ?? 0
    const parser =
      input.read(from, from + 2) === '</'
        ? closingTagParser
        : jsxLanguage.parser
    // Fragments from an earlier parse may come from the other parser
    return parser.startParse(input, [], ranges)
  }
}

const mdxTagLanguage = new LanguageSupport(
  new Language(defineLanguageFacet(), new MdxTagParser(), [], 'mdx-tag')
)

/** As above, reading JSX tags as MDX does (see `mdx.ts`) */
const mdxSupport = markdown({
  extensions: [markdownStyleExtension, GFM, mdxJsxFlow],
  codeLanguages,
  htmlTagLanguage: mdxTagLanguage,
})

const languageCompartment = new Compartment()

/** The editor's language: Markdown until a file is opened */
export const editorLanguage = () => languageCompartment.of(markdownSupport)

/** Parses the document as MDX or as Markdown, from the open file's path */
export function setEditorLanguage(view: EditorView, filePath: string): void {
  const support = filePath.endsWith('.mdx') ? mdxSupport : markdownSupport
  if (languageCompartment.get(view.state) === support) return
  view.dispatch({ effects: languageCompartment.reconfigure(support) })
}
