import { create } from 'zustand'
import { useProjectStore } from './projectStore'
import { setNestedValue, deleteNestedValue } from '../lib/object-utils'
import type { FileEntry } from '@/types'

const MAX_AUTO_SAVE_DELAY_MS = 10000 // Maximum time between auto-saves (10 seconds)

interface EditorState {
  // File state
  currentFile: FileEntry | null

  // Content state
  editorContent: string // Content without frontmatter and imports
  frontmatter: Record<string, unknown> // Current frontmatter being edited
  rawFrontmatter: string // Original frontmatter string from disk
  imports: string // MDX imports (hidden from editor)

  // Status state
  isDirty: boolean // True if changes need to be saved
  autoSaveTimeoutId: number | null // Auto-save timeout ID
  lastSaveTimestamp: number | null // Timestamp of last successful save
  autoSaveCallback: ((showToast?: boolean) => Promise<void>) | null // Hook-provided save callback

  // Actions
  openFile: (file: FileEntry) => void
  closeCurrentFile: () => void
  saveFile: (showToast?: boolean) => Promise<void>
  setEditorContent: (content: string) => void
  updateFrontmatter: (frontmatter: Record<string, unknown>) => void
  updateFrontmatterField: (key: string, value: unknown) => void
  scheduleAutoSave: () => void
  setAutoSaveCallback: (
    callback: ((showToast?: boolean) => Promise<void>) | null
  ) => void
  updateCurrentFileAfterRename: (newPath: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  currentFile: null,
  editorContent: '',
  frontmatter: {},
  rawFrontmatter: '',
  imports: '',
  isDirty: false,
  autoSaveTimeoutId: null,
  lastSaveTimestamp: null,
  autoSaveCallback: null,

  // Actions
  openFile: (file: FileEntry) => {
    // Clear auto-save timeout if it exists to prevent race condition
    // where previous file's auto-save could fire after opening new file
    const { autoSaveTimeoutId } = get()
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }

    // CRITICAL: Clear content FIRST, then set currentFile
    // This prevents Editor.tsx from reading stale content via getState()
    set({
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      imports: '',
      currentFile: file,
      isDirty: false,
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
      imports: '',
      isDirty: false,
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
      // eslint-disable-next-line no-console
      console.warn('saveFile called but no callback registered')
    }
  },

  setEditorContent: (content: string) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()
  },

  updateFrontmatter: (frontmatter: Record<string, unknown>) => {
    set({ frontmatter, isDirty: true })
    get().scheduleAutoSave()
  },

  updateFrontmatterField: (key: string, value: unknown) => {
    const { frontmatter } = get()

    // Check if value is empty
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)

    // Handle nested paths (dot notation) for nested objects
    const newFrontmatter = isEmpty
      ? deleteNestedValue(frontmatter, key)
      : setNestedValue(frontmatter, key, value)

    set({
      frontmatter: newFrontmatter,
      isDirty: true,
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

  updateCurrentFileAfterRename: (newPath: string) => {
    const { currentFile } = get()
    if (currentFile) {
      set({
        currentFile: {
          ...currentFile,
          path: newPath,
          name: newPath
            .substring(newPath.lastIndexOf('/') + 1)
            .replace(/\.[^.]+$/, ''),
        },
      })
    }
  },
}))

// Components can use direct selectors like:
// const currentFile = useEditorStore(state => state.currentFile)
