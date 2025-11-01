import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'
import { debug, info } from '@tauri-apps/plugin-log'

interface FileChangeEvent {
  path: string
  kind: string
}

/**
 * Handles file-changed events from the Rust watcher
 *
 * Responsibilities:
 * 1. Listen for file-changed events from watcher
 * 2. Invalidate queries to trigger refetch
 * 3. Respect isDirty state (don't reload user's unsaved work)
 */
export function useFileChangeHandler() {
  useEffect(() => {
    const handleFileChanged = (event: Event) => {
      const customEvent = event as CustomEvent<FileChangeEvent>
      const { path } = customEvent.detail

      const { currentFile, isDirty } = useEditorStore.getState()
      const { projectPath } = useProjectStore.getState()

      // Only care about currently open file
      if (!currentFile || currentFile.path !== path) {
        return
      }

      // User is editing - their version is authoritative
      if (isDirty) {
        void debug(
          `Ignoring external change to ${path} - file has unsaved edits`
        )
        return
      }

      // File is saved - safe to reload from disk
      void info(`External change detected on ${path} - reloading`)

      if (projectPath) {
        // Invalidate query - TanStack Query will refetch
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fileContent(projectPath, currentFile.id),
        })
      }
    }

    window.addEventListener('file-changed', handleFileChanged)
    return () => window.removeEventListener('file-changed', handleFileChanged)
  }, [])
}
