import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '../editorStore'
import { useProjectStore } from '../projectStore'
import { makeCollection, makeScan } from '../../test/fixtures'
import type { FileEntry } from '@/types'

const { fetchQuery, getQueryData } = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  getQueryData: vi.fn(),
}))

vi.mock('../../lib/query-client', () => ({
  queryClient: {
    fetchQuery,
    getQueryData,
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/bindings', () => ({
  commands: {
    saveProjectSettings: vi.fn(() =>
      Promise.resolve({ status: 'ok', data: null })
    ),
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
  path: '/site/src/content/blog/post.md',
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
}

const settings = {
  project: {},
  collections: { blog: { folder: 'src/posts' } },
}

describe('changing the open file’s collection folder', () => {
  beforeEach(() => {
    getQueryData.mockReturnValue(makeScan([makeCollection({ name: 'blog' })]))
    fetchQuery.mockResolvedValue(
      makeScan([makeCollection({ name: 'blog', path: '/site/src/posts' })])
    )
    useProjectStore.setState({
      projectPath: '/site',
      currentProjectId: 'site-1234',
    })
    useEditorStore.setState({
      currentFile: file,
      editorContent: 'unsaved words',
      isDirty: true,
    })
  })

  it('saves and closes the file', async () => {
    useEditorStore.getState().setAutoSaveCallback(() => {
      useEditorStore.setState({ isDirty: false })
      return Promise.resolve()
    })

    await useProjectStore.getState().updateProjectSettings(settings)

    expect(useEditorStore.getState().currentFile).toBeNull()
  })

  it('keeps the file open with its edits if the save fails', async () => {
    // A failed save leaves the file dirty rather than throwing
    useEditorStore.getState().setAutoSaveCallback(() => Promise.resolve())

    await useProjectStore.getState().updateProjectSettings(settings)

    expect(useEditorStore.getState().currentFile).toEqual(file)
    expect(useEditorStore.getState().editorContent).toBe('unsaved words')
  })
})

describe('a settings change while another is saving', () => {
  beforeEach(() => {
    fetchQuery.mockReset()
    getQueryData.mockReturnValue(makeScan([makeCollection({ name: 'blog' })]))
    fetchQuery.mockResolvedValue(makeScan([makeCollection({ name: 'blog' })]))
    useProjectStore.setState({
      projectPath: '/site',
      currentProjectId: 'site-1234',
      projectSettings: { project: {}, collections: {} },
    })
    useEditorStore.setState({ currentFile: null, isDirty: false })
  })

  it('builds on it, since the store has it before it’s saved', async () => {
    const saving = useProjectStore.getState().updateProjectSettings(settings)
    expect(useProjectStore.getState().projectSettings).toEqual(settings)
    await saving
  })

  it('keeps a newer change when an earlier save fails', async () => {
    const { commands } = await import('@/lib/bindings')
    let failFirst = () => {}
    vi.mocked(commands.saveProjectSettings).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          failFirst = () => resolve({ status: 'error', error: 'disk full' })
        })
    )
    const first = useProjectStore.getState().updateProjectSettings(settings)
    const newer = { project: {}, collections: { blog: { folder: 'src/b' } } }
    const second = useProjectStore.getState().updateProjectSettings(newer)
    failFirst()
    await Promise.all([first, second])
    expect(useProjectStore.getState().projectSettings).toEqual(newer)
  })

  it('stops if the project changed before the save finished', async () => {
    const saving = useProjectStore.getState().updateProjectSettings(settings)
    useProjectStore.setState({ projectPath: '/other' })
    await saving
    expect(fetchQuery).not.toHaveBeenCalled()
  })
})
