import { describe, it, expect } from 'vitest'
import { filterFilesByDraft } from './filtering'
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

describe('filterFilesByDraft', () => {
  it('should return all files when showDraftsOnly is false', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', isDraft: true }),
      createMockFile({ id: '2', isDraft: false }),
      createMockFile({ id: '3', frontmatter: { draft: true } }),
    ]

    const result = filterFilesByDraft(files, false, mockMappings)
    expect(result).toEqual(files)
    expect(result.length).toBe(3)
  })

  it('should filter to only files with isDraft=true when showDraftsOnly is true', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', isDraft: true }),
      createMockFile({ id: '2', isDraft: false }),
      createMockFile({ id: '3', isDraft: true }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(2)
    expect(result.map(f => f.id)).toEqual(['1', '3'])
  })

  it('should filter to files with frontmatter draft=true when showDraftsOnly is true', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { draft: true } }),
      createMockFile({ id: '2', frontmatter: { draft: false } }),
      createMockFile({ id: '3', frontmatter: { draft: true } }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(2)
    expect(result.map(f => f.id)).toEqual(['1', '3'])
  })

  it('should include files with either isDraft or frontmatter.draft=true', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', isDraft: true, frontmatter: {} }),
      createMockFile({ id: '2', isDraft: false, frontmatter: { draft: true } }),
      createMockFile({
        id: '3',
        isDraft: false,
        frontmatter: { draft: false },
      }),
      createMockFile({ id: '4', isDraft: true, frontmatter: { draft: true } }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(3)
    expect(result.map(f => f.id)).toEqual(['1', '2', '4'])
  })

  it('should handle null mappings', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', isDraft: true }),
      createMockFile({ id: '2', isDraft: false, frontmatter: { draft: true } }),
    ]

    const result = filterFilesByDraft(files, true, null)
    expect(result.length).toBe(2)
    expect(result.map(f => f.id)).toEqual(['1', '2'])
  })

  it('should preserve original file object references', () => {
    const file1 = createMockFile({ id: '1', isDraft: true })
    const file2 = createMockFile({ id: '2', isDraft: false })
    const files = [file1, file2]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result[0]).toBe(file1)
  })

  it('should handle empty file list', () => {
    const result = filterFilesByDraft([], true, mockMappings)
    expect(result).toEqual([])
  })

  it('should handle files without frontmatter', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', isDraft: true, frontmatter: undefined }),
      createMockFile({ id: '2', isDraft: false, frontmatter: undefined }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(1)
    expect(result[0]!.id).toBe('1')
  })
})
