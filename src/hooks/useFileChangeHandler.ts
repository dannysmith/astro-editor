import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { queryClient } from '../lib/query-client'
import { isFileListing, queryKeys } from '../lib/query-keys'
import { debug, info } from '@tauri-apps/plugin-log'

interface FileChangeEvent {
  path: string
  kind: string
}

// Events for the open file this soon after our own save are probably that save
const OWN_SAVE_WINDOW_MS = 3000

/**
 * Handles file-changed events from the Rust watcher
 *
 * Responsibilities:
 * 1. Refresh the sidebar and entry pickers when any content file is added,
 *    removed, renamed or edited outside the app
 * 2. Reload the open file when it changes on disk
 * 3. Respect isDirty state (don't reload user's unsaved work)
 * 4. Ignore events that occur immediately after our own save (race condition protection)
 */
export function useFileChangeHandler() {
  useEffect(() => {
    const handleFileChanged = (event: Event) => {
      const customEvent = event as CustomEvent<FileChangeEvent>
      const { path } = customEvent.detail

      const { currentFile, isDirty, lastSaveTimestamp } =
        useEditorStore.getState()
      const { projectPath } = useProjectStore.getState()
      if (!projectPath) return

      const isOpenFile = currentFile?.path === path
      const timeSinceLastSave =
        lastSaveTimestamp === null ? Infinity : Date.now() - lastSaveTimestamp
      const isOwnSave = isOpenFile && timeSinceLastSave < OWN_SAVE_WINDOW_MS

      // Our own saves already refresh the file list (useEditorActions). Only
      // queries on screen refetch, and scans don't write, so this can't loop
      if (!isOwnSave) {
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) => isFileListing(queryKey, projectPath),
        })
      }

      // The rest only concerns the open file
      if (!currentFile || !isOpenFile) {
        return
      }

      // User is editing - their version is authoritative. The "ignoring" logs
      // are dev-only: our own saves trigger them every few seconds while typing
      if (isDirty) {
        if (import.meta.env.DEV) {
          void debug(
            `Ignoring external change to ${path} - file has unsaved edits`
          )
        }
        return
      }

      // The watcher can emit several events for one save, and some arrive after
      // isDirty is cleared
      if (isOwnSave) {
        if (import.meta.env.DEV) {
          void debug(
            `Ignoring external change to ${path} - file was recently saved (${timeSinceLastSave}ms ago)`
          )
        }
        return
      }

      // File is saved and not recently modified by us - safe to reload from disk
      void info(`External change detected on ${path} - reloading`)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(projectPath, currentFile.id),
      })
    }

    window.addEventListener('file-changed', handleFileChanged)
    return () => window.removeEventListener('file-changed', handleFileChanged)
  }, [])
}
