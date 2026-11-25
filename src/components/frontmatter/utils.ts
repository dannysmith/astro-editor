import type { Tag } from '../ui/tag-input'

/**
 * Helper function to convert Tag objects back to string arrays
 */
export const tagsToStringArray = (tags: Tag[]): string[] =>
  tags.map(tag => tag.text)

/**
 * Whether a frontmatter field or component prop is named `emoji`, which gets a
 * button for the system emoji palette. Only macOS can open one from code
 */
export const isEmojiField = (name: string, platform?: string): boolean =>
  platform === 'macos' && name.split('.').at(-1) === 'emoji'

/**
 * Helper function to safely convert frontmatter values to strings
 */
export const valueToString = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.join(',')
  return ''
}
