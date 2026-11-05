import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFileChangeHandler } from './useFileChangeHandler'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'
import type { FileEntry } from '@/types'

const openFile: FileEntry = {
  id: 'posts/open',
  name: 'open',
  path: '/project/src/content/posts/open.md',
  extension: 'md',
  collection: 'posts',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
}

const directoryKey = queryKeys.directoryContents('/project', 'posts', 'root')
const pickerKey = queryKeys.collectionFiles('/project', 'posts')
const fileContentKey = queryKeys.fileContent('/project', openFile.id)

function fileChanged(path: string) {
  window.dispatchEvent(
    new CustomEvent('file-changed', { detail: { path, kind: 'Create(File)' } })
  )
}

/** The query keys invalidated so far, out of the open file's and its collection's */
function invalidated(): ReadonlyArray<readonly unknown[]> {
  return invalidateSpy.mock.calls.flatMap(([filters]) => {
    if (filters?.queryKey) return [filters.queryKey]
    return [directoryKey, pickerKey, fileContentKey].filter(key =>
      filters?.predicate?.({ queryKey: key } as never)
    )
  })
}

const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

describe('useFileChangeHandler', () => {
  beforeEach(() => {
    invalidateSpy.mockClear()
    useProjectStore.setState({ projectPath: '/project' })
    useEditorStore.setState({
      currentFile: openFile,
      isDirty: false,
      lastSaveTimestamp: null,
    })
    renderHook(() => useFileChangeHandler())
  })

  it('refreshes the file list and entry pickers when another file changes', () => {
    fileChanged('/project/src/content/posts/new.md')

    expect(invalidated()).toEqual([directoryKey, pickerKey])
  })

  it("leaves everything alone for the open file's own save", () => {
    useEditorStore.setState({ lastSaveTimestamp: Date.now() })

    fileChanged(openFile.path)

    expect(invalidated()).toEqual([])
  })

  it('refreshes the list and reloads the open file when it changes outside the app', () => {
    useEditorStore.setState({ lastSaveTimestamp: Date.now() - 10_000 })

    fileChanged(openFile.path)

    expect(invalidated()).toEqual([directoryKey, pickerKey, fileContentKey])
  })
})
