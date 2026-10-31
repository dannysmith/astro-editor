import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FileEntry } from '@/types'
import { commands } from '@/lib/bindings'
import { ASTRO_PATHS } from '@/lib/constants'
import { useProjectStore } from '../../store/projectStore'
import { useCollectionEntriesQuery } from './useCollectionEntriesQuery'

vi.mock('@/lib/bindings', () => ({
  commands: {
    scanProject: vi.fn(),
    scanCollectionFilesRecursive: vi.fn(),
    loadFileBasedCollection: vi.fn(),
  },
}))
vi.mock('@/lib/project-registry', () => ({
  getEffectiveContentDirectory: () => ASTRO_PATHS.CONTENT_DIR,
}))

function file(
  collection: string,
  id: string,
  frontmatter: FileEntry['frontmatter']
): FileEntry {
  return {
    id: `${collection}/${id}`,
    path: `/site/src/content/${collection}/${id}.md`,
    name: id,
    extension: 'md',
    collection,
    last_modified: null,
    frontmatter,
  }
}

function entries(collection: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useCollectionEntriesQuery(collection), { wrapper })
}

describe('useCollectionEntriesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({
      projectPath: '/site',
      currentProjectSettings: null,
    })
    vi.mocked(commands.scanProject).mockResolvedValue({
      status: 'ok',
      data: [{ name: 'articles', path: '/site/src/content/articles' }],
    })
  })

  it("gives a collection's files Astro's ids", async () => {
    vi.mocked(commands.scanCollectionFilesRecursive).mockResolvedValue({
      status: 'ok',
      data: [
        file('articles', '2024/My Post', { title: 'My post' }),
        file('articles', 'second', { title: 'Second', slug: 'advanced' }),
      ],
    })
    const { result } = entries('articles')
    await waitFor(() => expect(result.current.options).toHaveLength(2))
    expect(result.current.options).toEqual([
      { value: '2024/my-post', label: 'My post' },
      { value: 'advanced', label: 'Second' },
    ])
    expect(result.current.found).toBe(true)
  })

  it("gives a file-based collection's entries their own ids", async () => {
    vi.mocked(commands.loadFileBasedCollection).mockResolvedValue({
      status: 'ok',
      data: [file('authors', 'jane-doe', { name: 'Jane Doe' })],
    })
    const { result } = entries('authors')
    await waitFor(() => expect(result.current.options).toHaveLength(1))
    expect(result.current.options).toEqual([
      { value: 'jane-doe', label: 'Jane Doe' },
    ])
    expect(result.current.found).toBe(true)
  })

  it("isn't found when no collection has the name", async () => {
    vi.mocked(commands.loadFileBasedCollection).mockResolvedValue({
      status: 'error',
      error: 'not a file-based collection',
    })
    const { result } = entries('missing')
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.found).toBe(false)
    expect(result.current.options).toEqual([])
  })
})
