/**
 * Suggestions for a list field's tag input, from the values the same field
 * has in the collection's other entries, so writers reuse a tag rather than
 * invent a near-duplicate (`JavaScript`, `javascript`, `js`).
 */

import type { FileEntry } from '@/types'
import { getNestedValue } from './object-utils'

/** A value a list field already has in the collection */
export interface TagSuggestion {
  value: string
  /** How many entries use it */
  count: number
}

/** How many suggestions the input lists at once */
export const MAX_SUGGESTIONS = 8

/**
 * Each value of a list field (`field` may be a dot path) across a
 * collection's entries, with how many entries use it, most used first, then
 * A–Z. Leaves out the entry at `excludePath` (the open file, whose own values
 * are already in the field), and anything that isn't a list of strings.
 */
export function tagSuggestions(
  entries: FileEntry[],
  field: string,
  excludePath: string | undefined
): TagSuggestion[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    if (!entry.is_entry || entry.path === excludePath || !entry.frontmatter) {
      continue
    }
    const values = getNestedValue(entry.frontmatter, field)
    if (!Array.isArray(values)) continue
    // An entry with a tag twice uses it once
    for (const value of new Set(values)) {
      if (typeof value === 'string' && value.trim()) {
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value)
  )
}

/**
 * The suggestions to list for what's been typed: those containing it,
 * ignoring case, and not already in the field, in their order. All of them
 * (up to the limit) when nothing's been typed.
 */
export function matchSuggestions(
  suggestions: TagSuggestion[],
  query: string,
  taken: string[]
): TagSuggestion[] {
  const needle = query.trim().toLowerCase()
  const inField = new Set(taken.map(value => value.toLowerCase()))
  const matches: TagSuggestion[] = []
  for (const suggestion of suggestions) {
    const value = suggestion.value.toLowerCase()
    if (inField.has(value) || !value.includes(needle)) continue
    matches.push(suggestion)
    if (matches.length === MAX_SUGGESTIONS) break
  }
  return matches
}

/**
 * The collection's spelling of a value typed in another case, the most used
 * if there are several, so typing `javascript` adds `JavaScript`. Otherwise
 * the value as typed.
 */
export function existingSpelling(
  suggestions: TagSuggestion[],
  value: string
): string {
  const lower = value.toLowerCase()
  return (
    suggestions.find(suggestion => suggestion.value.toLowerCase() === lower)
      ?.value ?? value
  )
}
