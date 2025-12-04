/**
 * Pure functions for POS matching and filtering.
 * These functions have no side effects and are easily testable.
 */

import type {
  CompromiseDocument,
  CompromiseMatch,
  MatchRange,
  PosConfig,
} from './types'

/**
 * Check if a position is within a code block or frontmatter
 */
export function isExcludedContent(
  text: string,
  from: number,
  to: number
): boolean {
  // Check if inside fenced code block (```...```)
  const fencedCodeBlocks = text.matchAll(/```[\s\S]*?```/g)
  for (const match of fencedCodeBlocks) {
    if (
      match.index !== undefined &&
      from >= match.index &&
      to <= match.index + match[0].length
    ) {
      return true
    }
  }

  // Check if inside inline code (`...`)
  const inlineCodeBlocks = text.matchAll(/`[^`\n]+`/g)
  for (const match of inlineCodeBlocks) {
    if (
      match.index !== undefined &&
      from >= match.index &&
      to <= match.index + match[0].length
    ) {
      return true
    }
  }

  // Check if inside frontmatter (---...---)
  const frontmatterMatch = text.match(/^---[\s\S]*?---/)
  if (frontmatterMatch && from < frontmatterMatch[0].length) {
    return true
  }

  // Check if inside link syntax [text](url)
  const linkMatches = text.matchAll(/\[([^\]]+)\]\([^)]+\)/g)
  for (const match of linkMatches) {
    if (
      match.index !== undefined &&
      from >= match.index &&
      to <= match.index + match[0].length
    ) {
      return true
    }
  }

  return false
}

/**
 * Check if a decoration range overlaps with the cursor position or nearby area.
 * This prevents decorations from interfering with active editing.
 */
export function isRangeBeingEdited(
  from: number,
  to: number,
  cursorPosition: number
): boolean {
  if (cursorPosition === -1) return false

  // Exclude decorations that contain the cursor or are very close to it
  // This prevents interference when editing within or near decorated words
  const buffer = 2 // Small buffer around cursor
  return (
    (cursorPosition >= from - buffer && cursorPosition <= to + buffer) ||
    (from <= cursorPosition && to >= cursorPosition)
  )
}

/**
 * Build exclusion set from Compromise document for specified tags.
 * Returns lowercase text of all matches for the exclusion tags.
 */
export function buildExclusionSet(
  doc: CompromiseDocument,
  exclusionTags: string[]
): Set<string> {
  const exclusions = new Set<string>()

  for (const tag of exclusionTags) {
    const matches = doc.match(tag)
    matches.forEach((match: CompromiseMatch) => {
      const matchText = match.text()
      if (matchText) {
        exclusions.add(matchText.toLowerCase())
      }
    })
  }

  return exclusions
}

/**
 * Get match ranges from a Compromise document for a specific POS tag.
 * Handles both offset-based and regex-fallback matching.
 */
export function getMatchRanges(
  doc: CompromiseDocument,
  tag: string,
  text: string,
  exclusions: Set<string>
): MatchRange[] {
  const ranges: MatchRange[] = []
  const matches = doc.match(tag)

  matches.forEach((match: CompromiseMatch) => {
    const matchText = match.text()
    if (
      !matchText ||
      matchText.trim().length === 0 ||
      exclusions.has(matchText.toLowerCase())
    ) {
      return
    }

    // Try to get offset from Compromise first
    const offset = match.offset
    if (offset && offset.start >= 0 && offset.length > 0) {
      ranges.push({
        from: offset.start,
        to: offset.start + offset.length,
        text: matchText,
      })
    } else {
      // Fallback: find all occurrences with word boundary checking
      const escapedText = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'g')
      const regexMatches = Array.from(text.matchAll(wordBoundaryRegex))

      for (const regexMatch of regexMatches) {
        ranges.push({
          from: regexMatch.index,
          to: regexMatch.index + regexMatch[0].length,
          text: matchText,
        })
      }
    }
  })

  return ranges
}

/**
 * Check if a range is valid for decoration creation.
 */
export function isValidRange(
  range: MatchRange,
  text: string,
  cursorPosition: number,
  processedRanges: Set<string>
): boolean {
  const { from, to } = range
  const rangeKey = `${from}-${to}`

  // Check bounds
  if (from < 0 || to > text.length || from >= to) {
    return false
  }

  // Check for duplicate
  if (processedRanges.has(rangeKey)) {
    return false
  }

  // Check for excluded content
  if (isExcludedContent(text, from, to)) {
    return false
  }

  // Check for cursor proximity
  if (isRangeBeingEdited(from, to, cursorPosition)) {
    return false
  }

  return true
}

/**
 * Process matches for a single POS type and return valid ranges.
 * This is the main orchestration function for POS matching.
 */
export function processPosType(
  doc: CompromiseDocument,
  text: string,
  config: PosConfig,
  cursorPosition: number,
  processedRanges: Set<string>
): MatchRange[] {
  // Build exclusion set if needed
  const exclusions = config.exclusionTags
    ? buildExclusionSet(doc, config.exclusionTags)
    : new Set<string>()

  // Get all potential match ranges
  const ranges = getMatchRanges(doc, config.tag, text, exclusions)

  // Filter to valid ranges and mark as processed
  const validRanges: MatchRange[] = []
  for (const range of ranges) {
    if (isValidRange(range, text, cursorPosition, processedRanges)) {
      validRanges.push(range)
      processedRanges.add(`${range.from}-${range.to}`)
    } else if (
      import.meta.env.DEV &&
      (range.from < 0 || range.to > text.length || range.from >= range.to)
    ) {
      // eslint-disable-next-line no-console
      console.warn('[CopyeditMode] Invalid range detected:', {
        from: range.from,
        to: range.to,
        matchText: range.text,
      })
    }
  }

  return validRanges
}
