/**
 * File sorting utilities for sidebar file lists
 */

import type { FileEntry } from '@/types'

type FieldMappings = {
  publishedDate: string | string[]
  title: string
  description: string
  draft: string
}

/**
 * Get published date from frontmatter
 *
 * @param frontmatter - File frontmatter object
 * @param publishedDateField - Field name(s) to check for published date
 * @returns Date object if found and valid, null otherwise
 */
export function getPublishedDate(
  frontmatter: Record<string, unknown>,
  publishedDateField: string | string[]
): Date | null {
  const dateFields = Array.isArray(publishedDateField)
    ? publishedDateField
    : [publishedDateField]

  for (const field of dateFields) {
    const value = frontmatter[field]
    if (value) {
      const date = new Date(value as string)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }
  return null
}

/**
 * Get display title from file, falling back to filename
 */
function getTitle(file: FileEntry, titleField: string): string {
  const title = file.frontmatter?.[titleField]
  if (title && typeof title === 'string') {
    return title
  }
  return file.name
}

/**
 * Sort files by published date with alphabetical fallback.
 *
 * Sorting order:
 * 1. Undated files at top, sorted alphabetically by title (falling back to filename)
 * 2. Dated files below, sorted newest first
 * 3. Same-date files use alphabetical tiebreaker
 *
 * @param files - Array of file entries to sort
 * @param mappings - Frontmatter field mappings (contains publishedDate and title fields)
 * @returns New sorted array (does not mutate original)
 */
export function sortFilesByPublishedDate(
  files: FileEntry[],
  mappings: FieldMappings | null
): FileEntry[] {
  const titleField = mappings?.title || 'title'
  const publishedDateField = mappings?.publishedDate || 'publishedDate'

  return [...files].sort((a, b) => {
    const dateA = getPublishedDate(a.frontmatter || {}, publishedDateField)
    const dateB = getPublishedDate(b.frontmatter || {}, publishedDateField)

    // Undated files go to top, sorted alphabetically among themselves
    if (!dateA && !dateB) {
      return getTitle(a, titleField).localeCompare(getTitle(b, titleField))
    }
    if (!dateA) return -1
    if (!dateB) return 1

    // Dated files: newest first, alphabetical tiebreaker
    const dateDiff = dateB.getTime() - dateA.getTime()
    if (dateDiff !== 0) return dateDiff
    return getTitle(a, titleField).localeCompare(getTitle(b, titleField))
  })
}
