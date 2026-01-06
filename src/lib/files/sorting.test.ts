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

  it('should place undated files at top (alphabetically), then dated files (newest first)', () => {
    const files: FileEntry[] = [
      createMockFile({
        id: '1',
        name: 'jan-post',
        frontmatter: { publishedDate: '2024-01-01', title: 'January Post' },
      }),
      createMockFile({
        id: '2',
        name: 'z-draft',
        frontmatter: { title: 'Z Draft' },
      }),
      createMockFile({
        id: '3',
        name: 'feb-post',
        frontmatter: { publishedDate: '2024-02-01', title: 'February Post' },
      }),
      createMockFile({
        id: '4',
        name: 'a-draft',
        frontmatter: { title: 'A Draft' },
      }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    // Undated first (alphabetically: A Draft, Z Draft), then dated (newest first: Feb, Jan)
    expect(result.map(f => f.id)).toEqual(['4', '2', '3', '1'])
  })

  it('should sort undated files alphabetically by title', () => {
    const files: FileEntry[] = [
      createMockFile({
        id: '1',
        name: 'zebra',
        frontmatter: { title: 'Zebra Post' },
      }),
      createMockFile({
        id: '2',
        name: 'apple',
        frontmatter: { title: 'Apple Post' },
      }),
      createMockFile({
        id: '3',
        name: 'mango',
        frontmatter: { title: 'Mango Post' },
      }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result.map(f => f.id)).toEqual(['2', '3', '1']) // Apple, Mango, Zebra
  })

  it('should sort undated files by filename when no title', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', name: 'zebra', frontmatter: {} }),
      createMockFile({ id: '2', name: 'apple', frontmatter: {} }),
      createMockFile({ id: '3', name: 'mango', frontmatter: {} }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result.map(f => f.id)).toEqual(['2', '3', '1']) // apple, mango, zebra
  })

  it('should use alphabetical tiebreaker for same-date files', () => {
    const files: FileEntry[] = [
      createMockFile({
        id: '1',
        name: 'z',
        frontmatter: { publishedDate: '2024-01-15', title: 'Zebra' },
      }),
      createMockFile({
        id: '2',
        name: 'a',
        frontmatter: { publishedDate: '2024-01-15', title: 'Apple' },
      }),
      createMockFile({
        id: '3',
        name: 'm',
        frontmatter: { publishedDate: '2024-01-15', title: 'Mango' },
      }),
    ]

    const result = sortFilesByPublishedDate(files, mockMappings)
    expect(result.map(f => f.id)).toEqual(['2', '3', '1']) // Apple, Mango, Zebra
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
