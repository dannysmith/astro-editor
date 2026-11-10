import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEditorStore } from './editorStore'
import type { FileEntry } from '@/types'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'
import { useProjectStore } from './projectStore'

const fileEntry = (id: string): FileEntry => ({
  id,
  name: `${id}.md`,
  path: `/test/content/blog/${id}.md`,
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
})

describe('editorStore.openFile', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      editorContent: 'Unsaved edit',
      frontmatter: { title: 'First' },
      isDirty: true,
      autoSaveTimeoutId: null,
      autoSaveCallback: null,
    })
  })

  it('saves unsaved edits to the outgoing file before switching', () => {
    let seen: { id?: string; content: string } | null = null
    const save = vi.fn(() => {
      const state = useEditorStore.getState()
      seen = { id: state.currentFile?.id, content: state.editorContent }
      return Promise.resolve()
    })
    useEditorStore.setState({ autoSaveCallback: save })

    useEditorStore.getState().openFile(fileEntry('second'))

    expect(save).toHaveBeenCalledWith(false)
    expect(seen).toEqual({ id: 'first', content: 'Unsaved edit' })
    expect(useEditorStore.getState().currentFile?.id).toBe('second')
  })

  it("doesn't save when there are no unsaved edits", () => {
    const save = vi.fn(() => Promise.resolve())
    useEditorStore.setState({ autoSaveCallback: save, isDirty: false })

    useEditorStore.getState().openFile(fileEntry('second'))

    expect(save).not.toHaveBeenCalled()
  })

  it('keeps unsaved edits when the open file is opened again', () => {
    const save = vi.fn(() => Promise.resolve())
    useEditorStore.setState({ autoSaveCallback: save })

    useEditorStore.getState().openFile(fileEntry('first'))

    expect(save).not.toHaveBeenCalled()
    expect(useEditorStore.getState().editorContent).toBe('Unsaved edit')
    expect(useEditorStore.getState().isDirty).toBe(true)
  })

  it("drops the outgoing file's frontmatter baseline", () => {
    useEditorStore.setState({
      isDirty: false,
      frontmatterBaseline: { values: { title: 'First' }, raw: 'title: First' },
    })

    useEditorStore.getState().openFile(fileEntry('second'))

    expect(useEditorStore.getState().frontmatterBaseline).toBeNull()
  })
})

describe('reading files from disk', () => {
  const key = (id: string) => queryKeys.fileContent('/test', id)
  const stale = { content: 'An earlier file at this path' }

  beforeEach(() => {
    queryClient.clear()
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      isDirty: false,
      autoSaveCallback: null,
    })
  })

  it('never opens a file with content cached from its path', () => {
    queryClient.setQueryData(key('second'), stale)

    useEditorStore.getState().openFile(fileEntry('second'))
    expect(queryClient.getQueryData(key('second'))).toBeUndefined()
  })

  it('never follows a rename onto content cached from the new path', () => {
    queryClient.setQueryData(key('first'), { content: 'This file' })
    queryClient.setQueryData(key('second'), stale)

    // The path changes first, keeping the id, then the id follows
    const { updateCurrentFileAfterRename } = useEditorStore.getState()
    updateCurrentFileAfterRename({ ...fileEntry('first'), path: '/moved.md' })
    expect(queryClient.getQueryData(key('first'))).toEqual({
      content: 'This file',
    })
    updateCurrentFileAfterRename(fileEntry('second'))
    expect(queryClient.getQueryData(key('second'))).toBeUndefined()
  })
})

describe('editorStore.closeFile', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      editorContent: 'Unsaved edit',
      isDirty: true,
      autoSaveTimeoutId: null,
    })
  })

  it('saves unsaved edits, then closes', async () => {
    const save = vi.fn(() => {
      useEditorStore.setState({ isDirty: false })
      return Promise.resolve()
    })
    useEditorStore.setState({ autoSaveCallback: save })

    await useEditorStore.getState().closeFile()

    expect(save).toHaveBeenCalledWith(false)
    expect(useEditorStore.getState().currentFile).toBeNull()
  })

  it('stays open with its edits when the save fails', async () => {
    // A failed save keeps the file dirty
    useEditorStore.setState({
      autoSaveCallback: vi.fn(() => Promise.resolve()),
    })

    await useEditorStore.getState().closeFile()

    expect(useEditorStore.getState().currentFile?.id).toBe('first')
    expect(useEditorStore.getState().editorContent).toBe('Unsaved edit')
  })

  it('leaves a file opened during the save open', async () => {
    const save = vi.fn(() => {
      useEditorStore.setState({
        currentFile: fileEntry('second'),
        isDirty: false,
      })
      return Promise.resolve()
    })
    useEditorStore.setState({ autoSaveCallback: save })

    await useEditorStore.getState().closeFile()

    expect(useEditorStore.getState().currentFile?.id).toBe('second')
  })
})
