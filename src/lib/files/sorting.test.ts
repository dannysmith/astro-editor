import { describe, it, expect } from 'vitest'
import { getPublishedDate, sortFilesByPublishedDate } from './sorting'
import type { FileEntry } from '@/types'

const mockMappings = {
  publishedDate: 'publishedDate',
  title: 'title',
  description: 'description',
  draft: 'draft',
}

const createMockFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  id: 'test-id',
  path: 'test/path.md',
  name: 'test.md',
  extension: 'md',
  isDraft: false,
  collection: 'posts',
  last_modified: null,
  frontmatter: null,
  ...overrides,
})

describe('getPublishedDate', () => {
  it('should get date from single field', () => {
    const frontmatter = { publishedDate: '2024-01-15' }
    const result = getPublishedDate(frontmatter, 'publishedDate')
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toContain('2024-01-15')
  })

  it('should get date from first matching field in array', () => {
    const frontmatter = { date: '2024-01-15' }
    const result = getPublishedDate(frontmatter, [
      'pubDate',
      'date',
      'publishedDate',
    ])
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toContain('2024-01-15')
  })

  it('should try all fields in order when array is provided', () => {
    const frontmatter = { publishedDate: '2024-01-15' }
    const result = getPublishedDate(frontmatter, [
      'pubDate',
      'date',
      'publishedDate',
    ])
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toContain('2024-01-15')
  })

  it('should return null when field does not exist', () => {
    const frontmatter = {}
    const result = getPublishedDate(frontmatter, 'publishedDate')
    expect(result).toBeNull()
  })

  it('should return null when date is invalid', () => {
    const frontmatter = { publishedDate: 'invalid-date' }
    const result = getPublishedDate(frontmatter, 'publishedDate')
    expect(result).toBeNull()
  })

  it('should handle ISO date strings', () => {
    const frontmatter = { publishedDate: '2024-01-15T10:30:00Z' }
    const result = getPublishedDate(frontmatter, 'publishedDate')
    expect(result).toBeInstanceOf(Date)
  })

  it('should handle Date objects', () => {
    const date = new Date('2024-01-15')
    const frontmatter = { publishedDate: date }
    const result = getPublishedDate(frontmatter, 'publishedDate')
    expect(result).toBeInstanceOf(Date)
  })

  it('should handle empty frontmatter', () => {
    const result = getPublishedDate({}, 'publishedDate')
    expect(result).toBeNull()
  })
})

describe('sortFilesByPublishedDate', () => {
  it('should sort files by date descending (newest first)', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { publishedDate: '2024-01-01' } }),
      createMockFile({ id: '2', frontmatter: { publishedDate: '2024-03-01' } }),
      createMockFile({ id: '3', frontmatter: { publishedDate: '2024-02-01' } }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result.map(f => f.id)).toEqual(['2', '3', '1'])
  })

  it('should place files without dates at the top', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { publishedDate: '2024-01-01' } }),
      createMockFile({ id: '2', frontmatter: {} }),
      createMockFile({ id: '3', frontmatter: { publishedDate: '2024-02-01' } }),
      createMockFile({ id: '4', frontmatter: {} }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result.slice(0, 2).map(f => f.id)).toEqual(['2', '4'])
    expect(result.slice(2).map(f => f.id)).toEqual(['3', '1'])
  })

  it('should maintain order for files without dates', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: {} }),
      createMockFile({ id: '2', frontmatter: {} }),
      createMockFile({ id: '3', frontmatter: {} }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result.map(f => f.id)).toEqual(['1', '2', '3'])
  })

  it('should not mutate original array', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { publishedDate: '2024-01-01' } }),
      createMockFile({ id: '2', frontmatter: { publishedDate: '2024-02-01' } }),
    ]
    const originalOrder = files.map(f => f.id)

    sortFilesByPublishedDate(files, mockMappings)
    expect(files.map(f => f.id)).toEqual(originalOrder)
  })

  it('should handle null mappings with fallback', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { publishedDate: '2024-01-01' } }),
      createMockFile({ id: '2', frontmatter: { publishedDate: '2024-02-01' } }),
    ]

    const result = sortFilesByPublishedDate(files, null)
    expect(result.map(f => f.id)).toEqual(['2', '1'])
  })

  it('should handle array of date fields', () => {
    const mappingsWithArray = {
      ...mockMappings,
      publishedDate: ['pubDate', 'date', 'publishedDate'] as string | string[],
    }
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { date: '2024-01-01' } }),
      createMockFile({ id: '2', frontmatter: { pubDate: '2024-02-01' } }),
    ]

    const result = sortFilesByPublishedDate(files, mappingsWithArray)
    expect(result.map(f => f.id)).toEqual(['2', '1'])
  })

  it('should handle empty file list', () => {
    const result = sortFilesByPublishedDate([], mockMappings)
    expect(result).toEqual([])
  })

  it('should handle files without frontmatter', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: undefined }),
      createMockFile({ id: '2', frontmatter: { publishedDate: '2024-01-01' } }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result[0]!.id).toBe('1')
    expect(result[1]!.id).toBe('2')
  })

  it('should preserve original file object references', () => {
    const file1 = createMockFile({
      id: '1',
      frontmatter: { publishedDate: '2024-01-01' },
    })
    const file2 = createMockFile({
      id: '2',
      frontmatter: { publishedDate: '2024-02-01' },
    })
    const files = [file1, file2]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result[0]).toBe(file2)
    expect(result[1]).toBe(file1)
  })
})
