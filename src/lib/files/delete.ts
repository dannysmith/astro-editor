import { ask } from '@tauri-apps/plugin-dialog'
import { commands } from '../bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

/**
 * Deletes the file at `path` through Rust, which refuses paths outside the
 * project. It's moved to the Trash, or with the "Permanently delete files"
 * preference, removed after asking (`name` is what the question calls it).
 * If it's the open file, it's closed without saving, since the next save would
 * write it back. Resolves to whether it was deleted. Throws if the delete
 * fails, leaving the file open.
 */
export async function deleteFile(
  path: string,
  projectPath: string,
  name: string
): Promise<boolean> {
  const permanent =
    useProjectStore.getState().globalSettings?.general.permanentlyDeleteFiles ??
    false
  if (permanent) {
    const confirmed = await ask(
      `"${name}" will be deleted permanently. This can't be undone.`,
      { title: 'Delete File', kind: 'warning', okLabel: 'Delete' }
    )
    if (!confirmed) return false
  }

  const result = await commands.deleteFile(path, projectPath, permanent)
  if (result.status === 'error') throw new Error(result.error)
  const { currentFile, closeCurrentFile } = useEditorStore.getState()
  if (currentFile?.path === path) closeCurrentFile()
  return true
}
