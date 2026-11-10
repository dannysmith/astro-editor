import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEditorFileContent } from './useEditorFileContent'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import type { FileEntry } from '@/types'

const query = vi.hoisted(() => ({ data: undefined as unknown }))
vi.mock('./queries/useFileContentQuery', () => ({
  useFileContentQuery: () => ({
    data: query.data,
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

const file: FileEntry = {
  id: 'post',
  name: 'post.md',
  path: '/test/content/blog/post.md',
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
}

const fromDisk = (raw: string, title: string) => ({
  content: 'Body',
  frontmatter: { title },
  raw_frontmatter: raw,
  imports: '',
})

describe('useEditorFileContent', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: file,
      frontmatterBaseline: null,
      isDirty: false,
    })
  })

  it('keeps the first load as the baseline when the file reloads', () => {
    query.data = fromDisk('title: "Hello"', 'Hello')
    const { rerender } = renderHook(() => useEditorFileContent())

    // The reload after our own save, which rewrote the text
    query.data = fromDisk('title: Hello!', 'Hello!')
    rerender()

    const state = useEditorStore.getState()
    expect(state.rawFrontmatter).toBe('title: Hello!')
    expect(state.frontmatterBaseline).toEqual({
      values: { title: 'Hello' },
      raw: 'title: "Hello"',
    })
  })
})
