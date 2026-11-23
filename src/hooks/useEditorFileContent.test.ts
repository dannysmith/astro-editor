import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEditorFileContent } from './useEditorFileContent'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import type { FileEntry } from '@/types'

const query = vi.hoisted(() => ({
  data: undefined as unknown,
  dataUpdatedAt: 0,
  error: null as Error | null,
}))
vi.mock('./queries/useFileContentQuery', () => ({
  useFileContentQuery: () => ({
    data: query.data,
    dataUpdatedAt: query.dataUpdatedAt,
    isLoading: false,
    isError: query.error !== null,
    error: query.error,
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
  frontmatter_error: null,
})

describe('useEditorFileContent', () => {
  beforeEach(() => {
    query.data = undefined
    query.dataUpdatedAt = 0
    query.error = null
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: file,
      frontmatterBaseline: null,
      lastSaveTimestamp: null,
      isDirty: false,
      isLoaded: false,
      loadError: null,
      frontmatterError: null,
    })
  })

  it("marks the file loaded, with its frontmatter's error", () => {
    query.data = {
      ...fromDisk('title: [', ''),
      frontmatter: {},
      frontmatter_error: 'did not find expected node content',
    }
    renderHook(() => useEditorFileContent())

    expect(useEditorStore.getState()).toMatchObject({
      isLoaded: true,
      rawFrontmatter: 'title: [',
      frontmatterError: 'did not find expected node content',
    })
  })

  it("records why a file couldn't be loaded", () => {
    query.error = new Error('Failed to read file')
    renderHook(() => useEditorFileContent())

    expect(useEditorStore.getState().loadError).toBe('Failed to read file')
  })

  it('stops showing the previous file once the file loads', () => {
    useEditorStore.setState({
      heldFrontmatter: {
        values: { title: 'Previous' },
        path: '/test/content/blog/previous.md',
        collection: 'blog',
      },
    })
    query.data = fromDisk('title: Hello', 'Hello')
    renderHook(() => useEditorFileContent())

    expect(useEditorStore.getState().heldFrontmatter).toBeNull()
  })

  it("stops showing the previous file when the file can't be loaded", () => {
    useEditorStore.setState({
      heldFrontmatter: {
        values: { title: 'Previous' },
        path: '/test/content/blog/previous.md',
        collection: 'blog',
      },
    })
    query.error = new Error('Failed to read file')
    renderHook(() => useEditorFileContent())

    expect(useEditorStore.getState().heldFrontmatter).toBeNull()
  })

  it('keeps a loaded file when it fails to reload', () => {
    useEditorStore.setState({ isLoaded: true })
    query.error = new Error('Failed to read file')
    renderHook(() => useEditorFileContent())

    expect(useEditorStore.getState().loadError).toBeNull()
  })

  it('keeps the first load as the baseline when our own save reloads', () => {
    query.data = fromDisk('title: "Hello"', 'Hello')
    const { rerender } = renderHook(() => useEditorFileContent())

    // Our save wrote new text, which it keeps in the store, then the reload
    useEditorStore.setState({ rawFrontmatter: 'title: Hello!' })
    query.data = fromDisk('title: Hello!', 'Hello!')
    rerender()

    const state = useEditorStore.getState()
    expect(state.rawFrontmatter).toBe('title: Hello!')
    expect(state.frontmatterBaseline).toEqual({
      values: { title: 'Hello' },
      raw: 'title: "Hello"',
    })
  })

  it('ignores a read from before the last save, then takes the next one', () => {
    useEditorStore.setState({
      isLoaded: true,
      editorContent: 'Newer text',
      lastSaveTimestamp: 2000,
    })
    query.data = { ...fromDisk('title: Old', 'Old'), content: 'Older text' }
    query.dataUpdatedAt = 1000
    const { rerender } = renderHook(() => useEditorFileContent())

    expect(useEditorStore.getState().editorContent).toBe('Newer text')

    query.data = { ...fromDisk('title: New', 'New'), content: 'Newer text' }
    query.dataUpdatedAt = 3000
    rerender()

    expect(useEditorStore.getState().rawFrontmatter).toBe('title: New')
  })

  it('takes a change made outside the app as the baseline', () => {
    query.data = fromDisk('title: "Hello"', 'Hello')
    const { rerender } = renderHook(() => useEditorFileContent())

    query.data = fromDisk(
      '# A comment added elsewhere\ntitle: "Hello"',
      'Hello'
    )
    rerender()

    expect(useEditorStore.getState().frontmatterBaseline).toEqual({
      values: { title: 'Hello' },
      raw: '# A comment added elsewhere\ntitle: "Hello"',
    })
  })
})
