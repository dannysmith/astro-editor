/**
 * File name patterns: how a collection names its files, like
 * `{YYYY-MM-DD}-{slug}`. Its placeholders:
 *
 * - `{slug}`: the title as a slug with every word. `{title}` is the same.
 * - `{shortSlug}`: the title as a shorter slug, as "Copy as slug" makes it.
 * - `{index}`: the number after the highest in the folder. `{index:2}` pads
 *   it to two digits, so `01` sorts before `10`.
 * - Anything else is a date and time in Moment's tokens. `YYYY`, `YY`, `MM`,
 *   `M`, `DD` and `D` are the published date. `HH`, `H`, `mm`, `m`, `ss`, `s`,
 *   and `X` and `x` (a Unix timestamp in seconds and milliseconds) are when the
 *   file is named.
 *
 * Everything else is kept as written. Renaming a file keeps the times and the
 * number already in its name, so a name like `202611122158` stays the same ID.
 * Rust resolves each collection's pattern; picking a free name and renaming
 * happen there too.
 */

import { shortSlugFromTitle, slugFromTitle } from '../slug'

/** Patterns the setting offers as buttons */
export const FILE_NAME_PATTERN_PRESETS = [
  { label: 'Date', pattern: '{YYYY-MM-DD}' },
  { label: 'Title', pattern: '{slug}' },
  { label: 'Date and title', pattern: '{YYYY-MM-DD}-{slug}' },
]

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Each token's value, what it matches in a name, and whether it's part of the
 * date (from the published date, and changed by renames) or the time (from
 * when the file is named, and kept by renames)
 */
const TOKENS = {
  YYYY: {
    isDate: true,
    match: '\\d{4}',
    format: (d: Date) => String(d.getFullYear()),
  },
  YY: {
    isDate: true,
    match: '\\d{2}',
    format: (d: Date) => String(d.getFullYear()).slice(-2),
  },
  MM: {
    isDate: true,
    match: '\\d{2}',
    format: (d: Date) => pad(d.getMonth() + 1),
  },
  M: {
    isDate: true,
    match: '\\d{1,2}',
    format: (d: Date) => String(d.getMonth() + 1),
  },
  DD: { isDate: true, match: '\\d{2}', format: (d: Date) => pad(d.getDate()) },
  D: {
    isDate: true,
    match: '\\d{1,2}',
    format: (d: Date) => String(d.getDate()),
  },
  HH: {
    isDate: false,
    match: '\\d{2}',
    format: (d: Date) => pad(d.getHours()),
  },
  H: {
    isDate: false,
    match: '\\d{1,2}',
    format: (d: Date) => String(d.getHours()),
  },
  mm: {
    isDate: false,
    match: '\\d{2}',
    format: (d: Date) => pad(d.getMinutes()),
  },
  m: {
    isDate: false,
    match: '\\d{1,2}',
    format: (d: Date) => String(d.getMinutes()),
  },
  ss: {
    isDate: false,
    match: '\\d{2}',
    format: (d: Date) => pad(d.getSeconds()),
  },
  s: {
    isDate: false,
    match: '\\d{1,2}',
    format: (d: Date) => String(d.getSeconds()),
  },
  X: {
    isDate: false,
    match: '\\d+',
    format: (d: Date) => String(Math.floor(d.getTime() / 1000)),
  },
  x: { isDate: false, match: '\\d+', format: (d: Date) => String(d.getTime()) },
}
type Token = keyof typeof TOKENS

// Longest first, so `YYYY` isn't read as two `YY`s. Splitting on it puts the
// tokens at odd indexes.
const TOKEN = /(YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s|X|x)/

type TokenPart = { kind: 'token'; token: Token }
type Part =
  | { kind: 'text'; text: string }
  | { kind: 'slug' }
  | { kind: 'shortSlug' }
  | { kind: 'index'; width: number }
  | TokenPart

const isDatePart = (part: Part): part is TokenPart =>
  part.kind === 'token' && TOKENS[part.token].isDate

/**
 * A pattern's parts, or why it can't name files. An empty pattern is an error
 * too: the setting treats it as unset.
 */
export function parseFileNamePattern(
  pattern: string
): { parts: Part[] } | { error: string } {
  if (!pattern.trim()) return { error: 'The pattern is empty.' }
  if (/[/\\:]/.test(pattern.replace(/\{index:[1-9]\}/g, ''))) {
    return { error: "File names can't contain `/`, `\\` or `:`." }
  }
  if (pattern.startsWith('.')) {
    return { error: 'A file name starting with `.` would be hidden.' }
  }

  const parts: Part[] = []
  for (const piece of pattern.split(/(\{[^{}]*\})/)) {
    if (!piece) continue
    const index = /^\{index(?::([1-9]))?\}$/.exec(piece)
    if (!piece.startsWith('{')) {
      if (/[{}]/.test(piece)) {
        return { error: 'A `{` or `}` is missing its partner.' }
      }
      parts.push({ kind: 'text', text: piece })
    } else if (piece === '{slug}' || piece === '{title}') {
      parts.push({ kind: 'slug' })
    } else if (piece === '{shortSlug}') {
      parts.push({ kind: 'shortSlug' })
    } else if (index) {
      parts.push({ kind: 'index', width: Number(index[1] ?? 1) })
    } else {
      const pieces = piece.slice(1, -1).split(TOKEN)
      const text = pieces.filter((_, i) => i % 2 === 0)
      if (pieces.length === 1 || text.some(t => /[a-z]/i.test(t))) {
        return {
          error: `\`${piece}\` isn't a placeholder. Use \`{slug}\`, \`{shortSlug}\`, \`{index}\`, or a date like \`{YYYY-MM-DD}\`.`,
        }
      }
      pieces.forEach((p, i) => {
        if (i % 2 === 1) parts.push({ kind: 'token', token: p as Token })
        else if (p) parts.push({ kind: 'text', text: p })
      })
    }
  }
  return { parts }
}

/** Whether a pattern uses the title, so a file's name can follow it */
export function patternHasTitle(pattern: string): boolean {
  const parsed = parseFileNamePattern(pattern)
  return (
    'parts' in parsed &&
    parsed.parts.some(p => p.kind === 'slug' || p.kind === 'shortSlug')
  )
}

/** Whether a pattern numbers files, so naming one needs its folder's names */
export function patternHasIndex(pattern: string): boolean {
  const parsed = parseFileNamePattern(pattern)
  return 'parts' in parsed && parsed.parts.some(p => p.kind === 'index')
}

/** What a file's name is made from */
export type FileNameValues = {
  title: string
  /** The published date, or today: for the date */
  date: Date
  /** When the file is named: for the time and timestamps */
  now: Date
  /** The file's number: for `{index}` (see `nextIndex`) */
  index: number
  /** The file's current name, if it has one. The times and number in it are kept. */
  current?: string
}

/**
 * A file name, without its extension, from a pattern. With no title yet (a new
 * file), the slug is empty and the hyphens around it go, so
 * `{YYYY-MM-DD}-{slug}` gives just the date. Empty when the pattern can't name
 * files or gives nothing.
 */
export function fileNameStem(
  pattern: string,
  { title, date, now, index, current }: FileNameValues
): string {
  const parsed = parseFileNamePattern(pattern)
  if ('error' in parsed) return ''
  const kept =
    current === undefined ? undefined : matchName(current, parsed.parts)?.values
  return parsed.parts
    .map(part => {
      if (part.kind === 'text') return part.text
      if (part.kind === 'slug') return slugFromTitle(title)
      if (part.kind === 'shortSlug') return shortSlugFromTitle(title)
      if (part.kind === 'index') {
        return kept?.get(part) ?? String(index).padStart(part.width, '0')
      }
      const { isDate, format } = TOKENS[part.token]
      return isDate ? format(date) : (kept?.get(part) ?? format(now))
    })
    .join('')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_. ]+|[-_ ]+$/g, '')
}

/**
 * The number after the highest `{index}` among the names in a folder, or 1.
 * Names that don't follow the pattern are skipped.
 */
export function nextIndex(pattern: string, names: string[]): number {
  const parsed = parseFileNamePattern(pattern)
  if ('error' in parsed) return 1
  const indexPart = parsed.parts.find(p => p.kind === 'index')
  if (!indexPart) return 1
  let highest = 0
  for (const name of names) {
    const value = matchName(name, parsed.parts)?.values.get(indexPart)
    if (value) highest = Math.max(highest, Number(value))
  }
  return highest + 1
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
  if ('error' in parsed || !parsed.parts.some(isDatePart)) return null
  const match = matchName(stem, parsed.parts)
  if (!match) return null

  const kept = match.parts.map(part => match.values.get(part) ?? '').join('')
  const renamed = match.parts
    .map(part =>
      isDatePart(part)
        ? TOKENS[part.token].format(date)
        : (match.values.get(part) ?? '')
    )
    .join('')
  return renamed === kept ? stem : renamed
}

/**
 * What each part of a pattern is in a name that follows it, with or without a
 * title (as `fileNameStem` names a new file), ignoring a `-1` from a clash.
 * `parts` is the pattern's parts as the name has them. Null if the name
 * doesn't follow the pattern.
 */
function matchName(
  name: string,
  parts: Part[]
): { parts: Part[]; values: Map<Part, string> } | null {
  for (const candidate of [parts, untitledParts(parts)]) {
    const groups = candidate.map(part => {
      if (part.kind === 'text') return `(${escapeRegExp(part.text)})`
      if (part.kind === 'index') return '(\\d+)'
      if (part.kind === 'token') return `(${TOKENS[part.token].match})`
      return '(.*)'
    })
    const match = new RegExp(`^${groups.join('')}(-\\d+)?$`, 'i').exec(name)
    if (match) {
      const values = new Map(
        candidate.map((part, i) => [part, match[i + 1] ?? ''])
      )
      return { parts: candidate, values }
    }
  }
  return null
}

/**
 * A pattern's parts as a name without a title has them: the slugs left out,
 * then the hyphens around them merged and trimmed as `fileNameStem` does
 */
function untitledParts(parts: Part[]): Part[] {
  const merged: Part[] = []
  for (const part of parts) {
    if (part.kind === 'slug' || part.kind === 'shortSlug') continue
    const last = merged.at(-1)
    if (part.kind === 'text' && last?.kind === 'text') {
      merged[merged.length - 1] = { kind: 'text', text: last.text + part.text }
    } else {
      merged.push(part)
    }
  }
  return merged
    .map((part, i): Part => {
      if (part.kind !== 'text') return part
      let text = part.text.replace(/-{2,}/g, '-')
      if (i === 0) text = text.replace(/^[-_. ]+/, '')
      if (i === merged.length - 1) text = text.replace(/[-_ ]+$/, '')
      return { kind: 'text', text }
    })
    .filter(part => part.kind !== 'text' || part.text)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
