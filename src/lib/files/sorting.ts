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
 * ⚠️ CRITICAL: Moved from FileItem.tsx lines 42-60 WITHOUT CHANGES
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
 * Sort files by published date (reverse chronological), files without dates first
 * ⚠️ CRITICAL: Preserves array spreading with [...files].sort()
 *
 * @param files - Array of file entries to sort
 * @param mappings - Frontmatter field mappings (contains publishedDate field)
 * @returns New sorted array (does not mutate original)
 */
export function sortFilesByPublishedDate(
  files: FileEntry[],
  mappings: FieldMappings | null
): FileEntry[] {
  // ⚠️ CRITICAL: Use [...files].sort() not files.sort() to avoid mutation
  // This logic is copied exactly from LeftSidebar.tsx lines 241-258
  return [...files].sort((a, b) => {
    const dateA = getPublishedDate(
      a.frontmatter || {},
      mappings?.publishedDate || 'publishedDate'
    )
    const dateB = getPublishedDate(
      b.frontmatter || {},
      mappings?.publishedDate || 'publishedDate'
    )

    // Files without dates go to top
    if (!dateA && !dateB) return 0
    if (!dateA) return -1
    if (!dateB) return 1

    // Sort by date descending (newest first)
    return dateB.getTime() - dateA.getTime()
  })
}
