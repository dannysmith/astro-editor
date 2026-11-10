import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '../editorStore'
import { useProjectStore } from '../projectStore'
import { commands } from '@/lib/bindings'
import { makeScan } from '../../test/fixtures'
import { toast } from '../../lib/toast'
import type { FileEntry } from '@/types'

vi.mock('../../lib/query-client', () => ({
  queryClient: {
    fetchQuery: vi.fn(() => Promise.resolve(makeScan([]))),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    resetQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/bindings', () => ({
  commands: {
    openProject: vi.fn(),
    resolveFileEntry: vi.fn(),
    setLastEntry: vi.fn(() => Promise.resolve({ status: 'ok', data: null })),
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
      lastEntry: null as string | null,
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

  it('switches anyway if the writer chooses to, after a failed save', async () => {
    useEditorStore
      .getState()
      .setAutoSaveCallback(vi.fn(() => Promise.resolve()))

    const error = vi.spyOn(toast, 'error')

    useProjectStore.getState().setProject('/sites/docs')
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    const options = error.mock.calls.at(-1)?.[1] as {
      action: { onClick: () => void }
    }
    options.action.onClick()

    await vi.waitFor(() =>
      expect(useProjectStore.getState().projectPath).toBe('/sites/docs')
    )
    expect(useEditorStore.getState().currentFile).toBeNull()
  })
})

describe('opening two projects at once', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectPath: null })
    useEditorStore.setState({ currentFile: null, isDirty: false })
    vi.mocked(commands.startWatchingProject).mockClear()
  })

  it('leaves the project to the later open, with one watcher', async () => {
    const opening = (path: string) => ({
      ...opened,
      data: {
        ...opened.data,
        project: { ...opened.data.project, id: path, path },
      },
    })
    // The first open answers last
    let answerFirst: (value: typeof opened) => void = () => {}
    vi.mocked(commands.openProject)
      .mockReset()
      .mockReturnValueOnce(new Promise(resolve => (answerFirst = resolve)))
      .mockResolvedValueOnce(opening('/sites/second'))

    useProjectStore.getState().setProject('/sites/first')
    useProjectStore.getState().setProject('/sites/second')
    await vi.waitFor(() =>
      expect(useProjectStore.getState().projectPath).toBe('/sites/second')
    )
    answerFirst(opening('/sites/first'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(useProjectStore.getState().projectPath).toBe('/sites/second')
    expect(commands.startWatchingProject).toHaveBeenCalledTimes(1)
  })
})

describe('reopening the last entry', () => {
  const docsPost: FileEntry = {
    ...file,
    id: 'docs/intro',
    path: '/sites/docs/src/content/docs/intro.md',
    collection: 'docs',
  }
  const withLastEntry = (lastEntry: string | null, path = '/sites/docs') => ({
    ...opened,
    data: {
      ...opened.data,
      project: { ...opened.data.project, id: path, path, lastEntry },
    },
  })
  const resolvesTo = (entry: FileEntry | null) =>
    vi
      .mocked(commands.resolveFileEntry)
      .mockReset()
      .mockResolvedValue({ status: 'ok', data: entry })

  beforeEach(() => {
    useProjectStore.setState({ projectPath: null })
    useEditorStore.setState({ currentFile: null, isDirty: false })
  })

  it('opens the entry that was open when the project was left', async () => {
    resolvesTo(docsPost)
    vi.mocked(commands.openProject)
      .mockReset()
      .mockResolvedValue(withLastEntry('src/content/docs/intro.md'))

    useProjectStore.getState().setProject('/sites/docs')

    await vi.waitFor(() =>
      expect(useEditorStore.getState().currentFile).toEqual(docsPost)
    )
    expect(commands.resolveFileEntry).toHaveBeenCalledWith(
      '/sites/docs/src/content/docs/intro.md',
      '/sites/docs'
    )
  })

  it('opens nothing when the entry is gone or no longer an entry', async () => {
    resolvesTo(null)
    vi.mocked(commands.openProject)
      .mockReset()
      .mockResolvedValue(withLastEntry('src/content/docs/deleted.md'))

    useProjectStore.getState().setProject('/sites/docs')

    await vi.waitFor(() => expect(commands.resolveFileEntry).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(useEditorStore.getState().currentFile).toBeNull()
  })

  it('leaves a file opened meanwhile, like a deep link’s, open', async () => {
    let resolve: (value: { status: 'ok'; data: FileEntry }) => void = () => {}
    vi.mocked(commands.resolveFileEntry)
      .mockReset()
      .mockReturnValue(new Promise(r => (resolve = r)))
    vi.mocked(commands.openProject)
      .mockReset()
      .mockResolvedValue(withLastEntry('src/content/docs/intro.md'))

    useProjectStore.getState().setProject('/sites/docs')
    await vi.waitFor(() => expect(commands.resolveFileEntry).toHaveBeenCalled())
    const linked = { ...docsPost, id: 'docs/linked', path: '/sites/docs/l.md' }
    useEditorStore.getState().openFile(linked)
    resolve({ status: 'ok', data: docsPost })
    await new Promise(r => setTimeout(r, 0))

    expect(useEditorStore.getState().currentFile).toEqual(linked)
  })

  it("doesn't reopen for an open that a later one overtook", async () => {
    let resolveFirst: (value: {
      status: 'ok'
      data: FileEntry
    }) => void = () => {}
    vi.mocked(commands.resolveFileEntry)
      .mockReset()
      .mockReturnValueOnce(new Promise(r => (resolveFirst = r)))
    vi.mocked(commands.openProject)
      .mockReset()
      .mockResolvedValueOnce(withLastEntry('src/content/docs/intro.md'))
      .mockResolvedValueOnce(withLastEntry(null, '/sites/second'))

    useProjectStore.getState().setProject('/sites/docs')
    await vi.waitFor(() => expect(commands.resolveFileEntry).toHaveBeenCalled())
    useProjectStore.getState().setProject('/sites/second')
    await vi.waitFor(() =>
      expect(useProjectStore.getState().projectPath).toBe('/sites/second')
    )
    resolveFirst({ status: 'ok', data: docsPost })
    await new Promise(r => setTimeout(r, 0))

    expect(useEditorStore.getState().currentFile).toBeNull()
  })
})
