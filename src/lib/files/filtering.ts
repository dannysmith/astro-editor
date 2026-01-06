/**
 * File filtering utilities for sidebar file lists
 */

import type { FileEntry } from '@/types'

type FieldMappings = {
  publishedDate: string | string[]
  title: string
  description: string
  draft: string
}

/**
 * Filter files by draft status
 * ⚠️ CRITICAL: Parameter name is `showDraftsOnly` (not `showDrafts`) to match existing code
 *
 * @param files - Array of file entries to filter
 * @param showDraftsOnly - If true, only show draft files
 * @param mappings - Frontmatter field mappings (contains draft field name)
 * @returns Filtered array of files (preserves original object references)
 */
export function filterFilesByDraft(
  files: FileEntry[],
  showDraftsOnly: boolean,
  mappings: FieldMappings | null
): FileEntry[] {
  // If drafts-only mode is disabled, return all files
  if (!showDraftsOnly) {
    return files
  }

  // Filter to show only draft files
  // Draft detection uses only the user-configured field (or 'draft' default)
  const draftField = mappings?.draft || 'draft'
  return files.filter(file => file.frontmatter?.[draftField] === true)
}
