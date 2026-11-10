import { commands } from '../bindings'
import { useEditorStore } from '../../store/editorStore'

/**
 * Deletes the file at `path` through Rust, which refuses paths outside the
 * project. If it's the open file, it's closed without saving, since the next
 * save would write it back. Throws if the delete fails, leaving the file open.
 */
export async function deleteFile(
  path: string,
  projectPath: string
): Promise<void> {
  const result = await commands.deleteFile(path, projectPath)
  if (result.status === 'error') throw new Error(result.error)
  const { currentFile, closeCurrentFile } = useEditorStore.getState()
  if (currentFile?.path === path) closeCurrentFile()
}
