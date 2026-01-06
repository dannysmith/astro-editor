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
  collection: 'posts',
  last_modified: null,
  frontmatter: null,
  ...overrides,
})

describe('filterFilesByDraft', () => {
  it('should return all files when showDraftsOnly is false', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { draft: true } }),
      createMockFile({ id: '2', frontmatter: { draft: false } }),
      createMockFile({ id: '3', frontmatter: {} }),
    ]

    const result = filterFilesByDraft(files, false, mockMappings)
    expect(result).toEqual(files)
    expect(result.length).toBe(3)
  })

  it('should filter to only files with frontmatter draft=true when showDraftsOnly is true', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { draft: true } }),
      createMockFile({ id: '2', frontmatter: { draft: false } }),
      createMockFile({ id: '3', frontmatter: { draft: true } }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(2)
    expect(result.map(f => f.id)).toEqual(['1', '3'])
  })

  it('should use custom draft field from mappings', () => {
    const customMappings = {
      ...mockMappings,
      draft: 'archived',
    }
    const files: FileEntry[] = [
      createMockFile({
        id: '1',
        frontmatter: { draft: true, archived: false },
      }),
      createMockFile({
        id: '2',
        frontmatter: { draft: false, archived: true },
      }),
      createMockFile({ id: '3', frontmatter: { archived: true } }),
    ]

    const result = filterFilesByDraft(files, true, customMappings)
    expect(result.length).toBe(2)
    expect(result.map(f => f.id)).toEqual(['2', '3'])
  })

  it('should handle null mappings with fallback to draft field', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { draft: true } }),
      createMockFile({ id: '2', frontmatter: { draft: false } }),
    ]

    const result = filterFilesByDraft(files, true, null)
    expect(result.length).toBe(1)
    expect(result.map(f => f.id)).toEqual(['1'])
  })

  it('should preserve original file object references', () => {
    const file1 = createMockFile({ id: '1', frontmatter: { draft: true } })
    const file2 = createMockFile({ id: '2', frontmatter: { draft: false } })
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
      createMockFile({ id: '1', frontmatter: { draft: true } }),
      createMockFile({ id: '2', frontmatter: undefined }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(1)
    expect(result[0]!.id).toBe('1')
  })

  it('should not treat draft: "true" (string) as draft', () => {
    const files: FileEntry[] = [
      createMockFile({ id: '1', frontmatter: { draft: 'true' } }),
      createMockFile({ id: '2', frontmatter: { draft: true } }),
    ]

    const result = filterFilesByDraft(files, true, mockMappings)
    expect(result.length).toBe(1)
    expect(result[0]!.id).toBe('2')
  })
})
