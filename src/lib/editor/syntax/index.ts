/**
 * Markdown syntax highlighting system
 *
 * This module provides a comprehensive syntax highlighting system for markdown
 * content in CodeMirror 6. It includes:
 *
 * - Custom markdown tags for fine-grained control
 * - Parser extension to map syntax nodes to tags
 * - Comprehensive highlight styles for markdown and programming languages
 * - The editor's language: Markdown or MDX, with languages for fenced code
 *
 * Usage:
 * ```typescript
 * import { editorLanguage, comprehensiveHighlightStyle } from './syntax'
 *
 * const extensions = [
 *   editorLanguage(),
 *   syntaxHighlighting(comprehensiveHighlightStyle)
 * ]
 * // and setEditorLanguage(view, path) whenever a file is opened
 * ```
 */

export { markdownTags } from './markdownTags'
export { comprehensiveHighlightStyle } from './highlightStyle'
export { editorLanguage, setEditorLanguage } from './language'
