/**
 * File search/filter utilities for sidebar file lists
 */

import type { FileEntry } from '@/types'
import type { FieldMappings } from './sorting'

/**
 * Filter files by search query
 * Matches against both title (from frontmatter) and filename
 *
 * @param files - Array of file entries to filter
 * @param query - Search query string
 * @param mappings - Frontmatter field mappings (contains title field name)
 * @returns Filtered array of files matching the query
 */
export function filterFilesBySearch(
  files: FileEntry[],
  query: string,
  mappings: FieldMappings | null
): FileEntry[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return files

  const lowerQuery = trimmedQuery.toLowerCase()
  const titleField = mappings?.title || 'title'

  return files.filter(file => {
    const title = file.frontmatter?.[titleField] as string | undefined
    const searchableText = title ? `${file.name} ${title}` : file.name
    return searchableText.toLowerCase().includes(lowerQuery)
  })
}
