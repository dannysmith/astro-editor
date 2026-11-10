import { create } from 'zustand'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import { useProjectStore } from './projectStore'
import { setNestedValue, deleteNestedValue } from '../lib/object-utils'
import type { FileEntry } from '@/types'
import type { FrontmatterBaseline } from '../lib/files/frontmatter-baseline'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'

const MAX_AUTO_SAVE_DELAY_MS = 10000 // Maximum time between auto-saves (10 seconds)

interface EditorState {
  // File state
  currentFile: FileEntry | null

  // Content state
  editorContent: string // Content without frontmatter and imports
  frontmatter: Record<string, unknown> // Current frontmatter being edited
  rawFrontmatter: string // Original frontmatter string from disk
  /** The frontmatter as first loaded after opening; see `FrontmatterBaseline` */
  frontmatterBaseline: FrontmatterBaseline | null
  imports: string // MDX imports (hidden from editor)

  // Status state
  isDirty: boolean // True if ANY changes need to be saved
  isFrontmatterDirty: boolean // True if frontmatter was modified (vs content-only edits)
  autoSaveTimeoutId: ReturnType<typeof setTimeout> | null // Auto-save timeout ID
  lastSaveTimestamp: number | null // Timestamp of last successful save
  autoSaveCallback: ((showToast?: boolean) => Promise<void>) | null // Hook-provided save callback

  // Actions
  openFile: (file: FileEntry) => void
  closeCurrentFile: () => void
  saveFile: (showToast?: boolean) => Promise<void>
  setEditorContent: (content: string) => void
  setImports: (imports: string) => void
  updateFrontmatter: (frontmatter: Record<string, unknown>) => void
  updateFrontmatterField: (key: string, value: unknown) => void
  scheduleAutoSave: () => void
  setAutoSaveCallback: (
    callback: ((showToast?: boolean) => Promise<void>) | null
  ) => void
  /** Points the open file at its new name, keeping its unsaved state */
  updateCurrentFileAfterRename: (newFile: FileEntry) => void
}

/**
 * Drops any cached content for `file`, so the editor reads it from disk. The
 * cache is keyed by path, and a path isn't a stable identity: renaming or
 * deleting a file frees its path for another file, whose content the cache
 * would otherwise serve from the old one.
 */
function readFromDisk(file: FileEntry) {
  const { projectPath } = useProjectStore.getState()
  if (!projectPath) return
  void queryClient.resetQueries({
    queryKey: queryKeys.fileContent(projectPath, file.id),
    exact: true,
  })
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  currentFile: null,
  editorContent: '',
  frontmatter: {},
  rawFrontmatter: '',
  frontmatterBaseline: null,
  imports: '',
  isDirty: false,
  isFrontmatterDirty: false,
  autoSaveTimeoutId: null,
  lastSaveTimestamp: null,
  autoSaveCallback: null,

  // Actions
  openFile: (file: FileEntry) => {
    const { autoSaveTimeoutId, autoSaveCallback, currentFile, isDirty } = get()

    // Re-opening the open file would reload it from disk over unsaved edits
    if (isDirty && currentFile?.id === file.id) return

    // Clear auto-save timeout if it exists to prevent race condition
    // where previous file's auto-save could fire after opening new file
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }

    // Save unsaved edits before switching, or they're lost. saveFile reads the
    // store synchronously when it starts, so it captures the outgoing file
    // before the set() below replaces it
    if (isDirty && autoSaveCallback) {
      void autoSaveCallback(false)
    }

    // An opened file's content always comes from disk, never the cache
    readFromDisk(file)

    // CRITICAL: Clear content FIRST, then set currentFile
    // This prevents Editor.tsx from reading stale content via getState()
    set({
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      frontmatterBaseline: null,
      imports: '',
      currentFile: file,
      isDirty: false,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: Date.now(),
    })

    // Update the selected collection to match the opened file's collection
    // Use custom event to communicate with project store (Bridge Pattern)
    window.dispatchEvent(
      new CustomEvent('file-opened', {
        detail: { collectionName: file.collection },
      })
    )

    // Content will be loaded by useFileContentQuery hook
  },

  closeCurrentFile: () => {
    // Clear auto-save timeout if it exists
    const { autoSaveTimeoutId } = get()
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }

    // Clear all file-related state
    set({
      currentFile: null,
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      frontmatterBaseline: null,
      imports: '',
      isDirty: false,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: null,
    })
  },

  saveFile: async (showToast = true) => {
    // Delegate to hook-provided callback (Hybrid Action Hooks pattern)
    // This allows stores to trigger saves without having direct access to React hooks
    const { autoSaveCallback } = get()
    if (autoSaveCallback) {
      await autoSaveCallback(showToast)
    } else {
      void logWarn('saveFile called but no callback registered')
    }
  },

  setEditorContent: (content: string) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()
  },

  // Marks the file dirty in the same update: until then, useEditorFileContent
  // would put back the imports from disk
  setImports: (imports: string) => {
    set({ imports, isDirty: true })
    get().scheduleAutoSave()
  },

  updateFrontmatter: (frontmatter: Record<string, unknown>) => {
    set({ frontmatter, isDirty: true, isFrontmatterDirty: true })
    get().scheduleAutoSave()
  },

  updateFrontmatterField: (key: string, value: unknown) => {
    const { frontmatter } = get()

    // Clearing a field removes its key (and any parent objects left empty)
    // rather than writing `title: ''` or `tags: []` into the file
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)

    // Keys are dot paths for nested objects (`coverImage.alt`), matching the
    // flattened field names in the schema
    const newFrontmatter = isEmpty
      ? deleteNestedValue(frontmatter, key)
      : setNestedValue(frontmatter, key, value)

    set({
      frontmatter: newFrontmatter,
      isDirty: true,
      isFrontmatterDirty: true,
    })
    get().scheduleAutoSave()
  },

  scheduleAutoSave: () => {
    const store = get()
    const now = Date.now()

    // Check if we should force save due to max delay
    if (store.isDirty && store.lastSaveTimestamp) {
      const timeSinceLastSave = now - store.lastSaveTimestamp
      if (timeSinceLastSave >= MAX_AUTO_SAVE_DELAY_MS) {
        const { autoSaveCallback } = store
        if (autoSaveCallback) {
          void autoSaveCallback(false) // Auto-save without toast
        }
        return
      }
    }

    // Clear existing timeout
    if (store.autoSaveTimeoutId) {
      clearTimeout(store.autoSaveTimeoutId)
    }

    // Get auto-save delay from global settings (default to 2 seconds)
    const globalSettings = useProjectStore.getState().globalSettings
    const autoSaveDelay = globalSettings?.general?.autoSaveDelay || 2

    // Schedule new auto-save (without toast)
    const timeoutId = setTimeout(() => {
      const { autoSaveCallback } = get()
      if (autoSaveCallback) {
        void autoSaveCallback(false) // Auto-save without toast
      }
    }, autoSaveDelay * 1000) // Convert from seconds to milliseconds

    set({ autoSaveTimeoutId: timeoutId })
  },

  setAutoSaveCallback: (
    callback: ((showToast?: boolean) => Promise<void>) | null
  ) => {
    set({ autoSaveCallback: callback })
  },

  updateCurrentFileAfterRename: (newFile: FileEntry) => {
    const { currentFile } = get()
    if (!currentFile) return
    // Its new path may have content cached from a file that was there before
    if (newFile.id !== currentFile.id) readFromDisk(newFile)
    set({ currentFile: newFile })
  },
}))

// Components can use direct selectors like:
// const currentFile = useEditorStore(state => state.currentFile)
