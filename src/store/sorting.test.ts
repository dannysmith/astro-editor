import { describe, it, expect } from 'vitest'
import type { FileEntry } from '@/types'

// This would be a utility function that should be in the store
function sortFilesByDate(files: FileEntry[]): FileEntry[] {
  return files.sort((a, b) => {
    const aDate = extractDateFromFrontmatter(a.frontmatter)
    const bDate = extractDateFromFrontmatter(b.frontmatter)

    // Files without dates should appear at the top
    if (!aDate && !bDate) return 0
    if (!aDate) return -1
    if (!bDate) return 1

    // Sort by date descending (newest first)
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })
}

function extractDateFromFrontmatter(
  frontmatter: Record<string, unknown> | undefined
): string | null {
  if (!frontmatter) return null

  // Check common date field names
  const dateFields = ['pubDate', 'date', 'publishedDate', 'publishDate']

  for (const field of dateFields) {
    const value = frontmatter[field]
    if (typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }

  return null
}

describe('File Sorting Business Logic', () => {
  const mockFiles: FileEntry[] = [
    {
      id: 'posts/oldest',
      path: '/test/oldest.md',
      name: 'oldest',
      extension: 'md',
      isDraft: false,
      collection: 'posts',
      frontmatter: { pubDate: '2023-01-01' },
    },
    {
      id: 'posts/newest',
      path: '/test/newest.md',
      name: 'newest',
      extension: 'md',
      isDraft: false,
      collection: 'posts',
      frontmatter: { pubDate: '2023-12-31' },
    },
    {
      id: 'posts/middle',
      path: '/test/middle.md',
      name: 'middle',
      extension: 'md',
      isDraft: false,
      collection: 'posts',
      frontmatter: { pubDate: '2023-06-15' },
    },
    {
      id: 'posts/no-date',
      path: '/test/no-date.md',
      name: 'no-date',
      extension: 'md',
      isDraft: false,
      collection: 'posts',
      frontmatter: {},
    },
    {
      id: 'posts/alt-date-field',
      path: '/test/alt-date.md',
      name: 'alt-date',
      extension: 'md',
      isDraft: false,
      collection: 'posts',
      frontmatter: { date: '2023-08-20' },
    },
  ]

  it('should sort files by date descending with undated items first', () => {
    const sorted = sortFilesByDate([...mockFiles])

    expect(sorted).toHaveLength(5)
    expect(sorted[0]?.name).toBe('no-date') // No date should be first
    expect(sorted[1]?.name).toBe('newest') // 2023-12-31
    expect(sorted[2]?.name).toBe('alt-date') // 2023-08-20
    expect(sorted[3]?.name).toBe('middle') // 2023-06-15
    expect(sorted[4]?.name).toBe('oldest') // 2023-01-01
  })

  it('should handle different date field names', () => {
    const filesWithDifferentDateFields: FileEntry[] = [
      {
        id: 'posts/pub-date',
        path: '/test/pub-date.md',
        name: 'pub-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { pubDate: '2023-03-15' },
      },
      {
        id: 'posts/date',
        path: '/test/date.md',
        name: 'date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { date: '2023-03-20' },
      },
      {
        id: 'posts/publish-date',
        path: '/test/publish-date.md',
        name: 'publish-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { publishedDate: '2023-03-10' },
      },
    ]

    const sorted = sortFilesByDate(filesWithDifferentDateFields)

    expect(sorted).toHaveLength(3)
    expect(sorted[0]?.name).toBe('date') // 2023-03-20 (newest)
    expect(sorted[1]?.name).toBe('pub-date') // 2023-03-15
    expect(sorted[2]?.name).toBe('publish-date') // 2023-03-10 (oldest)
  })

  it('should handle empty and invalid date values', () => {
    const filesWithBadDates: FileEntry[] = [
      {
        id: 'posts/empty-date',
        path: '/test/empty-date.md',
        name: 'empty-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { pubDate: '' },
      },
      {
        id: 'posts/null-date',
        path: '/test/null-date.md',
        name: 'null-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { pubDate: null },
      },
      {
        id: 'posts/valid-date',
        path: '/test/valid-date.md',
        name: 'valid-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { pubDate: '2023-05-01' },
      },
    ]

    const sorted = sortFilesByDate(filesWithBadDates)

    expect(sorted).toHaveLength(3)
    expect(sorted[0]?.name).toBe('empty-date') // Empty date should be first
    expect(sorted[1]?.name).toBe('null-date') // Null date should be second
    expect(sorted[2]?.name).toBe('valid-date') // Valid date should be last
  })

  it('should handle ISO datetime strings', () => {
    const filesWithISODates: FileEntry[] = [
      {
        id: 'posts/iso-date',
        path: '/test/iso-date.md',
        name: 'iso-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { pubDate: '2023-07-15T10:30:00Z' },
      },
      {
        id: 'posts/simple-date',
        path: '/test/simple-date.md',
        name: 'simple-date',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
        frontmatter: { pubDate: '2023-07-20' },
      },
    ]

    const sorted = sortFilesByDate(filesWithISODates)

    expect(sorted).toHaveLength(2)
    expect(sorted[0]?.name).toBe('simple-date') // 2023-07-20 (newer)
    expect(sorted[1]?.name).toBe('iso-date') // 2023-07-15 (older)
  })

  describe('extractDateFromFrontmatter', () => {
    it('should extract date from pubDate field', () => {
      const frontmatter = { pubDate: '2023-05-01' }
      expect(extractDateFromFrontmatter(frontmatter)).toBe('2023-05-01')
    })

    it('should extract date from date field', () => {
      const frontmatter = { date: '2023-05-01' }
      expect(extractDateFromFrontmatter(frontmatter)).toBe('2023-05-01')
    })

    it('should extract date from publishedDate field', () => {
      const frontmatter = { publishedDate: '2023-05-01' }
      expect(extractDateFromFrontmatter(frontmatter)).toBe('2023-05-01')
    })

    it('should prefer pubDate over other fields', () => {
      const frontmatter = {
        pubDate: '2023-05-01',
        date: '2023-05-02',
        publishedDate: '2023-05-03',
      }
      expect(extractDateFromFrontmatter(frontmatter)).toBe('2023-05-01')
    })

    it('should return null for missing frontmatter', () => {
      expect(extractDateFromFrontmatter(undefined)).toBe(null)
    })

    it('should return null for empty frontmatter', () => {
      expect(extractDateFromFrontmatter({})).toBe(null)
    })

    it('should return null for non-string date values', () => {
      const frontmatter = { pubDate: 123 }
      expect(extractDateFromFrontmatter(frontmatter)).toBe(null)
    })
  })
})
