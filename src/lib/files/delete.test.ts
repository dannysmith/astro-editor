import { describe, it, expect, beforeEach } from 'vitest'
import { deleteFile } from './delete'
import { useEditorStore } from '../../store/editorStore'
import type { FileEntry } from '@/types'

const open: FileEntry = {
  id: 'blog/post',
  name: 'post',
  path: '/site/src/content/blog/post.md',
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
}

describe('deleteFile', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    useEditorStore.setState({
      currentFile: open,
      editorContent: 'Unsaved',
      isDirty: true,
    })
  })

  it('closes the open file without saving it back', async () => {
    globalThis.mockTauri.invoke.mockResolvedValue(null)

    await deleteFile(open.path, '/site')

    expect(useEditorStore.getState().currentFile).toBeNull()
    expect(useEditorStore.getState().isDirty).toBe(false)
  })

  it('leaves other files open', async () => {
    globalThis.mockTauri.invoke.mockResolvedValue(null)

    await deleteFile('/site/src/content/blog/other.md', '/site')

    expect(useEditorStore.getState().currentFile).toEqual(open)
  })

  it('throws and keeps the file open when the delete fails', async () => {
    globalThis.mockTauri.invoke.mockRejectedValue('Permission denied')

    await expect(deleteFile(open.path, '/site')).rejects.toThrow(
      'Permission denied'
    )
    expect(useEditorStore.getState().currentFile).toEqual(open)
  })
})
