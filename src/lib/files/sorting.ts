/**
 * File sorting utilities for sidebar file lists
 */

import type { FileEntry } from '@/types'
import { CompleteSchema, FieldType } from '../schema'

/**
 * Maps semantic field purposes to actual frontmatter field names.
 * Allows collections to use custom field names while maintaining consistent behavior.
 *
 * @property publishedDate - Field name(s) containing the publish date (checked in order if array)
 * @property title - Field name for the display title
 * @property description - Field name for the description/summary
 * @property draft - Field name for the draft status boolean
 */
export type FieldMappings = {
  publishedDate: string | string[]
  title: string
  description: string
  draft: string
}

/**
 * Represents a sorting option available for a collection's file list.
 *
 * @property id - Unique identifier for this sort option (e.g., 'title', 'date-publishedDate')
 * @property label - Human-readable label shown in the UI
 * @property type - Sort algorithm: 'default' (date with fallback), 'alpha', 'date', or 'numeric'
 * @property field - Frontmatter field name to sort by, or null for built-in sorts (filename, modified)
 */
export interface SortOption {
  id: string
  label: string
  type: 'default' | 'alpha' | 'date' | 'numeric'
  field: string | null
}

/**
 * Current sort configuration for a file list.
 *
 * @property mode - The active sort option id (matches SortOption.id)
 * @property direction - Sort direction: 'asc' for ascending, 'desc' for descending
 */
export interface SortConfig {
  mode: string
  direction: 'asc' | 'desc'
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
 * Get display title from file, falling back to filename (without extension)
 */
export function getTitle(file: FileEntry, titleField: string): string {
  if (
    file.frontmatter?.[titleField] &&
    typeof file.frontmatter[titleField] === 'string'
  ) {
    return file.frontmatter[titleField]
  }

  const filename = file.name || file.path.split('/').pop() || 'Untitled'
  return filename.replace(/\.(md|mdx)$/, '')
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

/**
 * Convert camelCase or simple strings to Title Case with spaces
 * Examples: "publishedDate" → "Published Date", "title" → "Title"
 */
function toTitleCase(str: string): string {
  // Insert space before uppercase letters, then capitalize first letter
  const spaced = str.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Generate sort options based on the collection's schema
 * Returns dynamic options including date fields from schema
 */
export function getSortOptionsForCollection(
  schema: CompleteSchema | null
): SortOption[] {
  const options: SortOption[] = [
    { id: 'default', label: 'Default', type: 'default', field: null },
    { id: 'title', label: 'Title', type: 'alpha', field: 'title' },
    { id: 'filename', label: 'Filename', type: 'alpha', field: null },
  ]

  if (schema) {
    // Add date fields from schema
    for (const field of schema.fields) {
      if (field.type === FieldType.Date) {
        options.push({
          id: `date-${field.name}`,
          label: toTitleCase(field.name),
          type: 'date',
          field: field.name,
        })
      }
    }

    // Add order field if present and numeric
    const orderField = schema.fields.find(f => f.name === 'order')
    if (
      orderField &&
      (orderField.type === FieldType.Number ||
        orderField.type === FieldType.Integer)
    ) {
      options.push({
        id: 'order',
        label: 'Order',
        type: 'numeric',
        field: 'order',
      })
    }
  }

  // Always add last modified
  options.push({
    id: 'modified',
    label: 'Last Modified',
    type: 'date',
    field: null,
  })

  return options
}

/**
 * Sort files by the given configuration
 *
 * @param files - Array of file entries to sort
 * @param config - Sort configuration (mode and direction)
 * @param mappings - Frontmatter field mappings
 * @returns New sorted array (does not mutate original)
 */
export function sortFiles(
  files: FileEntry[],
  config: SortConfig,
  mappings: FieldMappings | null
): FileEntry[] {
  // Default mode uses existing behavior
  if (config.mode === 'default') {
    return sortFilesByPublishedDate(files, mappings)
  }

  const titleField = mappings?.title || 'title'

  return [...files].sort((a, b) => {
    let valueA: unknown
    let valueB: unknown

    // Extract values based on mode
    switch (config.mode) {
      case 'filename':
        valueA = a.name
        valueB = b.name
        break
      case 'title':
        valueA = a.frontmatter?.[titleField] as string | undefined
        valueB = b.frontmatter?.[titleField] as string | undefined
        break
      case 'modified':
        valueA = a.last_modified
        valueB = b.last_modified
        break
      case 'order':
        valueA = a.frontmatter?.order as number | undefined
        valueB = b.frontmatter?.order as number | undefined
        break
      default:
        // Date field from frontmatter (mode = "date-{field}")
        if (config.mode.startsWith('date-')) {
          const field = config.mode.replace('date-', '')
          valueA = a.frontmatter?.[field]
          valueB = b.frontmatter?.[field]
        }
    }

    // Handle missing values - go to BOTTOM (opposite of Default mode)
    if (valueA == null && valueB == null) return 0
    if (valueA == null) return 1 // a goes to bottom
    if (valueB == null) return -1 // b goes to bottom

    // Compare based on type
    let comparison: number
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB
    } else if (config.mode.startsWith('date-') || config.mode === 'modified') {
      const timeA = new Date(valueA as string | number).getTime()
      const timeB = new Date(valueB as string | number).getTime()
      // Handle invalid dates (NaN) - treat as missing, push to bottom
      if (isNaN(timeA) && isNaN(timeB)) return 0
      if (isNaN(timeA)) return 1
      if (isNaN(timeB)) return -1
      comparison = timeA - timeB
    } else {
      // For string comparisons, ensure we have strings
      const strA = typeof valueA === 'string' ? valueA : ''
      const strB = typeof valueB === 'string' ? valueB : ''
      comparison = strA.localeCompare(strB)
    }

    return config.direction === 'desc' ? -comparison : comparison
  })
}
