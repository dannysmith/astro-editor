/**
 * File name patterns: how a collection names its files, like
 * `{YYYY-MM-DD}-{title}`. `{title}` is the title as a slug (as "Copy as slug"
 * makes it), and any other placeholder is a date, written with `YYYY`, `YY`,
 * `MM`, `M`, `DD` and `D`. Everything else is kept as written. Rust resolves
 * each collection's pattern; picking a free name and renaming happen there too.
 */

import { slugFromTitle } from '../slug'

/** Patterns the setting offers as buttons */
export const FILE_NAME_PATTERN_PRESETS = [
  { label: 'Date', pattern: '{YYYY-MM-DD}' },
  { label: 'Title', pattern: '{title}' },
  { label: 'Date and title', pattern: '{YYYY-MM-DD}-{title}' },
]

type Part =
  | { kind: 'text'; text: string }
  | { kind: 'title' }
  | { kind: 'date'; format: string }

// Longest first, so `YYYY` isn't read as two `YY`s
const DATE_TOKENS = /YYYY|YY|MM|M|DD|D/g

const DATE_TOKEN_PATTERNS: Record<string, string> = {
  YYYY: '\\d{4}',
  YY: '\\d{2}',
  MM: '\\d{2}',
  M: '\\d{1,2}',
  DD: '\\d{2}',
  D: '\\d{1,2}',
}

/**
 * A pattern's parts, or why it can't name files. An empty pattern is an error
 * too: the setting treats it as unset.
 */
export function parseFileNamePattern(
  pattern: string
): { parts: Part[] } | { error: string } {
  if (!pattern.trim()) return { error: 'The pattern is empty.' }
  if (/[/\\:]/.test(pattern)) {
    return { error: "File names can't contain `/`, `\\` or `:`." }
  }
  if (pattern.startsWith('.')) {
    return { error: 'A file name starting with `.` would be hidden.' }
  }

  const parts: Part[] = []
  for (const piece of pattern.split(/(\{[^{}]*\})/)) {
    if (!piece) continue
    if (!piece.startsWith('{')) {
      if (/[{}]/.test(piece)) {
        return { error: 'A `{` or `}` is missing its partner.' }
      }
      parts.push({ kind: 'text', text: piece })
    } else if (piece === '{title}') {
      parts.push({ kind: 'title' })
    } else {
      const format = piece.slice(1, -1)
      if (!format || /[a-z]/i.test(format.replace(DATE_TOKENS, ''))) {
        return {
          error: `\`${piece}\` isn't a placeholder. Use \`{title}\`, or a date like \`{YYYY-MM-DD}\`.`,
        }
      }
      parts.push({ kind: 'date', format })
    }
  }
  return { parts }
}

/** Whether a pattern uses the title, so a file's name can follow it */
export function patternHasTitle(pattern: string): boolean {
  const parsed = parseFileNamePattern(pattern)
  return 'parts' in parsed && parsed.parts.some(p => p.kind === 'title')
}

function formatDate(format: string, date: Date): string {
  const values: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    M: String(date.getMonth() + 1),
    DD: String(date.getDate()).padStart(2, '0'),
    D: String(date.getDate()),
  }
  return format.replace(DATE_TOKENS, token => values[token] ?? token)
}

/**
 * A file name, without its extension, from a pattern. With no title yet (a new
 * file), `{title}` is empty and the hyphens around it go, so
 * `{YYYY-MM-DD}-{title}` gives just the date. Empty when the pattern can't name
 * files or gives nothing.
 */
export function fileNameStem(
  pattern: string,
  { title, date }: { title: string; date: Date }
): string {
  const parsed = parseFileNamePattern(pattern)
  if ('error' in parsed) return ''
  return parsed.parts
    .map(part => {
      if (part.kind === 'text') return part.text
      if (part.kind === 'title') return slugFromTitle(title)
      return formatDate(part.format, date)
    })
    .join('')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_. ]+|[-_ ]+$/g, '')
}

/**
 * A file's name, without its extension, with the dates in it changed to `date`
 * and everything else kept: for renaming a file when its published date
 * changes. Null when the pattern has no date or the name doesn't follow it. The
 * name comes back unchanged when its dates already match, even with a `-1` from
 * a clash after them.
 */
export function stemWithDate(
  stem: string,
  pattern: string,
  date: Date
): string | null {
  const parsed = parseFileNamePattern(pattern)
  if ('error' in parsed) return null
  const { parts } = parsed
  if (!parts.some(part => part.kind === 'date')) return null

  const groups = parts.map(part => {
    if (part.kind === 'text') return `(${escapeRegExp(part.text)})`
    if (part.kind === 'title') return '(.*)'
    return `(${escapeRegExp(part.format).replace(DATE_TOKENS, t => DATE_TOKEN_PATTERNS[t] ?? t)})`
  })
  const match = new RegExp(`^${groups.join('')}(-\\d+)?$`, 'i').exec(stem)
  if (!match) return null

  const kept = match.slice(1, parts.length + 1)
  const renamed = parts.map((part, i) =>
    part.kind === 'date' ? formatDate(part.format, date) : (kept[i] ?? '')
  )
  return renamed.join('') === kept.join('') ? stem : renamed.join('')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
