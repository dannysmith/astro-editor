/**
 * Markdown syntax highlighting system
 *
 * This module provides a comprehensive syntax highlighting system for markdown
 * content in CodeMirror 6. It includes:
 *
 * - Custom markdown tags for fine-grained control
 * - Parser extension to map syntax nodes to tags
 * - Comprehensive highlight styles for markdown and programming languages
 *
 * Usage:
 * ```typescript
 * import { markdownStyleExtension, comprehensiveHighlightStyle } from './syntax'
 *
 * const extensions = [
 *   markdown({ extensions: [markdownStyleExtension] }),
 *   syntaxHighlighting(comprehensiveHighlightStyle)
 * ]
 * ```
 */

export { markdownTags } from './markdownTags'
export { markdownStyleExtension } from './styleExtension'
export { comprehensiveHighlightStyle } from './highlightStyle'
export { codeLanguages } from './codeLanguages'
