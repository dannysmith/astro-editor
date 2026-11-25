import { highlightCode } from '@lezer/highlight'
import { jsxLanguage } from '@codemirror/lang-javascript'
import { StyleModule } from 'style-mod'
import { comprehensiveHighlightStyle } from './highlightStyle'

/** A run of code and the highlight classes for it */
export interface CodeSegment {
  text: string
  className: string
}

/**
 * Highlights JSX (a component's tag, its import lines) with the editor's
 * colours, for showing code outside the editor. Line breaks come back as
 * `\n` segments, so the result renders in a `white-space: pre-wrap` element.
 */
export function highlightJsx(code: string): CodeSegment[] {
  // The editor mounts its highlight styles itself, but this can run without it
  const { module } = comprehensiveHighlightStyle
  if (module) StyleModule.mount(document, module)

  const segments: CodeSegment[] = []
  highlightCode(
    code,
    jsxLanguage.parser.parse(code),
    comprehensiveHighlightStyle,
    (text, className) => segments.push({ text, className }),
    () => segments.push({ text: '\n', className: '' })
  )
  return segments
}
