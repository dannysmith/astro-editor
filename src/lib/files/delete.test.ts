import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ask } from '@tauri-apps/plugin-dialog'
import { deleteFile } from './delete'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import type { GlobalSettings } from '@/lib/bindings'
import type { FileEntry } from '@/types'

vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: vi.fn() }))

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

function setPermanentlyDelete(on: boolean) {
  useProjectStore.setState({
    globalSettings: {
      general: { permanentlyDeleteFiles: on },
    } as GlobalSettings,
  })
}

describe('deleteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue(null)
    setPermanentlyDelete(false)
    useEditorStore.setState({
      currentFile: open,
      editorContent: 'Unsaved',
      isDirty: true,
    })
  })

  it('moves the file to the Trash without asking', async () => {
    expect(await deleteFile(open.path, '/site', 'Post')).toBe(true)

    expect(ask).not.toHaveBeenCalled()
    expect(globalThis.mockTauri.invoke).toHaveBeenCalledWith('delete_file', {
      filePath: open.path,
      projectRoot: '/site',
      permanent: false,
    })
  })

  it('asks before deleting permanently, when the preference is on', async () => {
    setPermanentlyDelete(true)
    vi.mocked(ask).mockResolvedValue(true)

    expect(await deleteFile(open.path, '/site', 'Post')).toBe(true)

    expect(ask).toHaveBeenCalledOnce()
    expect(globalThis.mockTauri.invoke).toHaveBeenCalledWith('delete_file', {
      filePath: open.path,
      projectRoot: '/site',
      permanent: true,
    })
  })

  it('leaves the file when a permanent delete is declined', async () => {
    setPermanentlyDelete(true)
    vi.mocked(ask).mockResolvedValue(false)

    expect(await deleteFile(open.path, '/site', 'Post')).toBe(false)

    expect(globalThis.mockTauri.invoke).not.toHaveBeenCalled()
    expect(useEditorStore.getState().currentFile).toEqual(open)
  })

  it('closes the open file without saving it back', async () => {
    await deleteFile(open.path, '/site', 'Post')

    expect(useEditorStore.getState().currentFile).toBeNull()
    expect(useEditorStore.getState().isDirty).toBe(false)
  })

  it('leaves other files open', async () => {
    await deleteFile('/site/src/content/blog/other.md', '/site', 'Other')

    expect(useEditorStore.getState().currentFile).toEqual(open)
  })

  it('throws and keeps the file open when the delete fails', async () => {
    globalThis.mockTauri.invoke.mockRejectedValue('Permission denied')

    await expect(deleteFile(open.path, '/site', 'Post')).rejects.toThrow(
      'Permission denied'
    )
    expect(useEditorStore.getState().currentFile).toEqual(open)
  })
})
