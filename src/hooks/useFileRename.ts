import { useState } from 'react'
import { error as logError } from '@tauri-apps/plugin-log'
import type { FileEntry } from '@/types'
import { renameFile } from '../lib/files/rename'
import { useProjectStore } from '../store/projectStore'
import { useRenameFileMutation } from './mutations/useRenameFileMutation'

/** Renaming a file in the sidebar's list: which one, and finishing it */
export function useFileRename() {
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const renameMutation = useRenameFileMutation()

  const startRename = (file: FileEntry) => {
    setRenamingPath(file.path)
  }

  const cancelRename = () => {
    setRenamingPath(null)
  }

  const submitRename = (file: FileEntry, newName: string) => {
    const trimmedName = newName.trim()
    const originalFullName = file.extension
      ? `${file.name}.${file.extension}`
      : file.name
    if (!trimmedName || trimmedName === originalFullName) {
      setRenamingPath(null)
      return
    }

    const directory = file.path.substring(0, file.path.lastIndexOf('/'))
    const newPath = `${directory}/${trimmedName}`
    const { projectPath, selectedCollection } = useProjectStore.getState()
    if (!projectPath || !selectedCollection) {
      setRenamingPath(null)
      return
    }

    // mutateAsync rather than mutate's callbacks, which only run for the
    // latest call. On failure the name stays editable, so the writer can retry
    void renameFile(file.path, newPath, projectPath, () =>
      renameMutation.mutateAsync({
        oldPath: file.path,
        newPath,
        projectPath,
        collectionName: selectedCollection,
      })
    )
      .then(renamed => {
        // Another file may be being renamed by now
        if (renamed) {
          setRenamingPath(current => (current === file.path ? null : current))
        }
      })
      .catch((error: unknown) => {
        void logError(`Failed to rename file: ${String(error)}`)
      })
  }

  return { renamingPath, startRename, cancelRename, submitRename }
}
