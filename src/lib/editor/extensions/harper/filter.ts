/**
 * Which of Harper's issues to show. Some come from masking (`prose.ts`), and
 * some are Harper being stricter than a writer needs: these checks are an
 * aid, so it's better to miss a mistake than to nag about a name.
 */

import { MASK } from './prose'

/** An issue, by the rule that found it, its kind and its span in the prose */
export interface Found {
  rule: string
  kind: string
  start: number
  end: number
}

/** Word-level kinds, which don't depend on the words around them */
const WORD_KINDS = new Set(['Spelling', 'Typo'])

/** Acronyms and initialisms: MDX, APIs, MDX's */
const ACRONYM = /^[A-Z][A-Z0-9]+(?:s|['’]s)?$/

/** A list item or table cell starts between the line's start and the issue */
const BLOCK_START = /(?:^[\s>]*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|\|\s*)$/

/** Whether to show an issue found in `text`, the prose of `doc` */
export function shouldShow(found: Found, text: string, doc: string): boolean {
  const { rule, kind, start, end } = found
  const problem = text.slice(start, end)

  // Runs of spaces, or words joined across code
  if (!problem.trim() || problem.includes(MASK)) return false

  if (WORD_KINDS.has(kind)) {
    // Names: an acronym, or a capitalised word inside a sentence
    if (ACRONYM.test(problem)) return false
    if (/^[A-Z]/.test(problem) && !startsSentence(text, doc, start))
      return false
    // Code written as prose: pubDate, v1, max_width
    if (/[a-z][A-Z]|\d|_/.test(problem)) return false
    // A suffix on code, like the "s" in "`import`s"
    if (text.charAt(start - 1) === MASK || text.charAt(end) === MASK)
      return false
    return true
  }

  // Harper can't see masked code, so it misreads the words beside it: "an
  // `index.ts`", or "`expected` is" as a sentence starting "is"
  if (besideMask(text, start, end)) return false

  // Lowercase list items and table cells are a choice, not a mistake
  if (rule === 'SentenceCapitalization') {
    const lineStart = doc.lastIndexOf('\n', start - 1) + 1
    if (BLOCK_START.test(doc.slice(lineStart, start))) return false
  }

  return true
}

const SKIPPED_BEFORE = new Set([' ', '\t', MASK, '"', "'", '“', '‘', '(', '['])

/**
 * Whether the word at `start` begins a sentence: it follows the start of the
 * text, a paragraph break, a table cell's start or the end of a sentence
 */
function startsSentence(text: string, doc: string, start: number): boolean {
  let newlines = 0
  for (let i = start - 1; i >= 0; i--) {
    const char = text.charAt(i)
    if (char === '\n') {
      // `proseText` turns each table cell's `|` into a newline
      if (++newlines === 2 || doc.charAt(i) === '|') return true
    } else if (!SKIPPED_BEFORE.has(char)) {
      return '.!?…'.includes(char)
    }
  }
  return true
}

/** Whether masked text is next to `start`…`end`, ignoring spaces */
function besideMask(text: string, start: number, end: number): boolean {
  let before = start - 1
  while (/[ \t]/.test(text.charAt(before))) before--
  let after = end
  while (/[ \t]/.test(text.charAt(after))) after++
  return text.charAt(before) === MASK || text.charAt(after) === MASK
}
