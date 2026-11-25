import { beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { FileEntry } from '@/types'
import { queryKeys } from '@/lib/query-keys'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { makeCollection, makeScan } from '../test/fixtures'
import { useTagSuggestions } from './useTagSuggestions'

const entry = (path: string, tags: string[]): FileEntry => ({
  id: path,
  path,
  name: path,
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: { tags },
  is_entry: true,
})

const scans = () =>
  globalThis.mockTauri.invoke.mock.calls.filter(
    ([command]) => command === 'scan_collection_files_recursive'
  ).length

describe('useTagSuggestions', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue([entry('b', ['astro'])])
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(
      queryKeys.collections('/site'),
      makeScan([makeCollection({ name: 'blog' })])
    )
    queryClient.setQueryData(queryKeys.collectionFiles('/site', 'blog'), [
      entry('open', ['mine']),
      entry('a', ['astro', 'css']),
    ])
    useProjectStore.setState({ projectPath: '/site' })
    useEditorStore.setState({ currentFile: entry('open', []) })
  })

  const render = (active: boolean) =>
    renderHook(({ active }) => useTagSuggestions('tags', active), {
      initialProps: { active },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    })

  it("suggests the collection's values from the cached listing, leaving out the open file", () => {
    const { result } = render(false)
    expect(result.current.map(s => s.value)).toEqual(['astro', 'css'])
  })

  it('re-reads an out-of-date listing only once the input has focus', async () => {
    const { result, rerender } = render(false)
    await queryClient.invalidateQueries({
      queryKey: queryKeys.collectionFiles('/site', 'blog'),
    })
    expect(scans()).toBe(0)

    rerender({ active: true })
    await waitFor(() =>
      expect(result.current).toEqual([{ value: 'astro', count: 1 }])
    )
    expect(scans()).toBe(1)
  })
})
