import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '../editorStore'
import { useProjectStore } from '../projectStore'
import { commands } from '@/lib/bindings'
import { makeScan } from '../../test/fixtures'
import type { FileEntry } from '@/types'

vi.mock('../../lib/query-client', () => ({
  queryClient: {
    fetchQuery: vi.fn(() => Promise.resolve(makeScan([]))),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/bindings', () => ({
  commands: {
    openProject: vi.fn(),
    startWatchingProject: vi.fn(() =>
      Promise.resolve({ status: 'ok', data: null })
    ),
    stopWatchingProject: vi.fn(() =>
      Promise.resolve({ status: 'ok', data: null })
    ),
  },
}))

const file: FileEntry = {
  id: 'blog/post',
  name: 'post',
  path: '/sites/blog/src/content/blog/post.md',
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
}

const opened = {
  status: 'ok' as const,
  data: {
    project: {
      id: 'docs-1234',
      name: 'docs',
      path: '/sites/docs',
      lastOpened: '2026-11-05T12:00:00.000Z',
      created: '2026-11-05T12:00:00.000Z',
    },
    settings: { project: {}, collections: {} },
    newSettings: false,
  },
}

describe('switching projects with unsaved edits', () => {
  beforeEach(() => {
    vi.mocked(commands.openProject).mockReset().mockResolvedValue(opened)
    useProjectStore.setState({ projectPath: '/sites/blog' })
    useEditorStore.setState({
      currentFile: file,
      editorContent: 'unsaved words',
      isDirty: true,
    })
  })

  it('saves the open file before switching', async () => {
    const save = vi.fn(() => {
      useEditorStore.setState({ isDirty: false })
      return Promise.resolve()
    })
    useEditorStore.getState().setAutoSaveCallback(save)

    useProjectStore.getState().setProject('/sites/docs')

    await vi.waitFor(() =>
      expect(useProjectStore.getState().projectPath).toBe('/sites/docs')
    )
    expect(save).toHaveBeenCalledWith(false)
    expect(useEditorStore.getState().currentFile).toBeNull()
  })

  it("stays put if the save fails, keeping the file's edits", async () => {
    // A failed save writes recovery data and leaves the file dirty
    const save = vi.fn(() => Promise.resolve())
    useEditorStore.getState().setAutoSaveCallback(save)

    useProjectStore.getState().setProject('/sites/docs')

    await vi.waitFor(() => expect(save).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(commands.openProject).not.toHaveBeenCalled()
    expect(useProjectStore.getState().projectPath).toBe('/sites/blog')
    expect(useEditorStore.getState().editorContent).toBe('unsaved words')
  })
})
