import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { markdownTags } from './markdownTags'

/**
 * Comprehensive highlight style that includes both markdown and standard language tags
 * This is the single source of truth for all syntax highlighting in the editor
 */
export const comprehensiveHighlightStyle = HighlightStyle.define([
  // === MARKDOWN-SPECIFIC TAGS ===
  // Headings - inherit base size, just make bold and customizable color
  {
    tag: markdownTags.heading1,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: markdownTags.heading2,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: markdownTags.heading3,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: markdownTags.heading4,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: markdownTags.heading5,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: markdownTags.heading6,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: markdownTags.headingMark,
    color: 'var(--editor-color-heading)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },

  // Emphasis and Strong
  {
    tag: markdownTags.emphasis,
    fontStyle: 'italic',
    fontFamily: 'var(--editor-font-family-italic)',
  },
  {
    tag: markdownTags.emphasisMark,
    color: 'var(--editor-color-mdtag)',
    fontFamily: 'var(--editor-font-family-italic)',
    fontStyle: 'italic',
  },
  { tag: markdownTags.strong, fontWeight: 'var(--editor-font-weight-bold)' },
  {
    tag: markdownTags.strongMark,
    color: 'var(--editor-color-mdtag)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  {
    tag: markdownTags.strikethrough,
    textDecoration: 'line-through',
    color: 'var(--editor-color-mdtag)',
  },
  {
    tag: markdownTags.strikethroughMark,
    color: 'var(--editor-color-mdtag)',
  },

  // Code
  {
    tag: markdownTags.inlineCode,
    backgroundColor: 'var(--editor-color-codeblock-background)',
    fontFamily: 'iA Writer Mono Variable, iA Writer Mono, monospace',
    padding: '1px 3px',
    borderRadius: '2px',
  },
  { tag: markdownTags.inlineCodeMark, color: 'var(--editor-color-mdtag)' },
  {
    tag: markdownTags.codeBlock,
    fontFamily: 'iA Writer Mono Variable, iA Writer Mono, monospace',
  },
  { tag: markdownTags.codeBlockMark, color: 'var(--editor-color-mdtag)' },
  { tag: markdownTags.codeFence, color: 'var(--editor-color-mdtag)' },

  // Links and Images
  { tag: markdownTags.link },
  { tag: markdownTags.linkMark, color: 'var(--editor-color-mdtag)' },
  { tag: markdownTags.linkText, color: 'var(--editor-color-mdtag)' },
  {
    tag: markdownTags.linkUrl,
    color: 'var(--editor-color-mdtag)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--editor-color-underline)',
  },
  { tag: markdownTags.image },
  { tag: markdownTags.imageMark, color: 'var(--editor-color-mdtag)' },
  { tag: markdownTags.imageAlt, color: 'var(--editor-color-mdtag)' },
  {
    tag: markdownTags.imageUrl,
    color: 'var(--editor-color-mdtag)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--editor-color-underline)',
  },

  // Lists
  { tag: markdownTags.listMark, color: 'var(--editor-color-mdtag)' },
  { tag: markdownTags.listItem },

  // Blockquotes
  {
    tag: markdownTags.blockquote,
    fontStyle: 'italic',
    fontFamily: 'var(--editor-font-family-italic)',
  },
  { tag: markdownTags.blockquoteMark, color: 'var(--editor-color-mdtag)' },

  // Horizontal Rules
  {
    tag: markdownTags.horizontalRule,
    color: 'var(--editor-color-mdtag)',
  },

  // Tables
  { tag: markdownTags.table },
  {
    tag: markdownTags.tableHeader,
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  { tag: markdownTags.tableSeparator, color: 'var(--editor-color-mdtag)' },
  { tag: markdownTags.tableRow },
  { tag: markdownTags.tableCell },

  // HTML - use the red family as specified
  { tag: markdownTags.htmlTag, color: 'var(--editor-color-red)' },
  { tag: markdownTags.htmlAttribute, color: 'var(--editor-color-brown)' },

  // Escape
  { tag: markdownTags.escape, color: 'var(--editor-color-mdtag)' },

  // Footnotes
  { tag: markdownTags.footnote },
  { tag: markdownTags.footnoteMark, color: 'var(--editor-color-mdtag)' },

  // === STANDARD LANGUAGE TAGS (HTML, CSS, JS, etc.) ===
  // HTML Tags - Red/Orange/Green as per spec
  { tag: tags.tagName, color: 'var(--editor-color-red)' },
  { tag: tags.angleBracket, color: 'var(--editor-color-red)' },
  { tag: tags.attributeName, color: 'var(--editor-color-brown)' },
  { tag: tags.attributeValue, color: 'var(--editor-color-green)' },

  // JavaScript/Programming - Use iA Writer colors
  {
    tag: tags.keyword,
    color: 'var(--editor-color-blue)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  { tag: tags.function(tags.variableName), color: 'var(--editor-color-blue)' },
  { tag: tags.variableName, color: 'var(--editor-color-text)' },
  {
    tag: tags.className,
    color: 'var(--editor-color-pink)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  { tag: tags.namespace, color: 'var(--editor-color-pink)' },
  { tag: tags.typeName, color: 'var(--editor-color-pink)' },

  // Literals
  { tag: tags.string, color: 'var(--editor-color-green)' },
  { tag: tags.character, color: 'var(--editor-color-green)' },
  { tag: tags.number, color: 'var(--editor-color-blue)' },
  {
    tag: tags.bool,
    color: 'var(--editor-color-blue)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  { tag: tags.null, color: 'var(--editor-color-blue)', fontStyle: 'italic' },

  // Comments - Use mdtag color
  {
    tag: tags.comment,
    color: 'var(--editor-color-mdtag)',
    fontStyle: 'italic',
  },
  {
    tag: tags.blockComment,
    color: 'var(--editor-color-mdtag)',
    fontStyle: 'italic',
  },
  {
    tag: tags.lineComment,
    color: 'var(--editor-color-mdtag)',
    fontStyle: 'italic',
  },
  {
    tag: tags.docComment,
    color: 'var(--editor-color-mdtag)',
    fontStyle: 'italic',
    fontWeight: 'var(--editor-font-weight-bold)',
  },

  // Operators and Punctuation
  { tag: tags.operator, color: 'var(--editor-color-text)' },
  { tag: tags.punctuation, color: 'var(--editor-color-text)' },
  { tag: tags.bracket, color: 'var(--editor-color-text)' },
  { tag: tags.paren, color: 'var(--editor-color-text)' },
  { tag: tags.squareBracket, color: 'var(--editor-color-text)' },

  // CSS
  {
    tag: tags.propertyName,
    color: 'var(--editor-color-blue)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  { tag: tags.unit, color: 'var(--editor-color-blue)' },
  {
    tag: tags.color,
    color: 'var(--editor-color-pink)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },

  // Special/Meta
  { tag: tags.meta, color: 'var(--editor-color-brown)' },
  { tag: tags.processingInstruction, color: 'var(--editor-color-brown)' },
  {
    tag: tags.definition(tags.variableName),
    color: 'var(--editor-color-text)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },
  {
    tag: tags.definition(tags.function(tags.variableName)),
    color: 'var(--editor-color-blue)',
    fontWeight: 'var(--editor-font-weight-bold)',
  },

  // Invalid/Error
  {
    tag: tags.invalid,
    color: 'var(--editor-color-red)',
    textDecoration: 'underline wavy',
  },
  {
    tag: tags.deleted,
    color: 'var(--editor-color-red)',
    textDecoration: 'line-through',
  },
  { tag: tags.inserted, color: 'var(--editor-color-green)' },
  { tag: tags.changed, color: 'var(--editor-color-brown)' },

  // URLs and Links
  {
    tag: tags.url,
    color: 'var(--editor-color-mdtag)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--editor-color-underline)',
  },
  {
    tag: tags.link,
    color: 'var(--editor-color-mdtag)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--editor-color-underline)',
  },

  // Headings (for other languages that have them)
  {
    tag: tags.heading,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: tags.heading1,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: tags.heading2,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: tags.heading3,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: tags.heading4,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: tags.heading5,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
  {
    tag: tags.heading6,
    fontWeight: 'var(--editor-font-weight-bold)',
    color: 'var(--editor-color-heading)',
  },
])
