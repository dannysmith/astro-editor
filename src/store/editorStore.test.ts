import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEditorStore } from './editorStore'
import type { FileEntry } from '@/types'

const fileEntry = (id: string): FileEntry => ({
  id,
  name: `${id}.md`,
  path: `/test/content/blog/${id}.md`,
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
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
})
