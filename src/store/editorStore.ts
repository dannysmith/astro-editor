import { create } from 'zustand'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import { useProjectStore } from './projectStore'
import { setNestedValue, deleteNestedValue } from '../lib/object-utils'
import type { FileEntry } from '@/types'
import type { FrontmatterBaseline } from '../lib/files/frontmatter-baseline'
import { rememberLastEntry } from '../lib/projects/last-entry'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'

const MAX_AUTO_SAVE_DELAY_MS = 10000 // Maximum time between auto-saves (10 seconds)

interface EditorState {
  // File state
  currentFile: FileEntry | null

  // Content state
  editorContent: string // Content without frontmatter and imports
  frontmatter: Record<string, unknown> // Current frontmatter being edited
  rawFrontmatter: string // The frontmatter block as written on disk, fences included
  /** The frontmatter as first loaded after opening; see `FrontmatterBaseline` */
  frontmatterBaseline: FrontmatterBaseline | null
  imports: string // MDX imports (hidden from editor)

  // Load state. Until the open file has loaded, the editor holds an empty
  // placeholder, so nothing may edit or save it: a save would write the
  // placeholder over the file
  /** Whether the open file's content has loaded from disk */
  isLoaded: boolean
  /** Why the open file couldn't be loaded, if it couldn't */
  loadError: string | null
  /**
   * Why the open file's frontmatter couldn't be read, if it couldn't. The
   * body can still be edited, the frontmatter can't, and saving writes
   * `rawFrontmatter` back unchanged
   */
  frontmatterError: string | null
  /**
   * While git rewrites files on disk (a pull), nothing may be edited: an edit
   * not saved before the pull ends would keep the old text, and its save would
   * undo the pulled changes. The editor is read-only and edits are ignored
   */
  editingPaused: boolean

  // Status state
  isDirty: boolean // True if ANY changes need to be saved
  isFrontmatterDirty: boolean // True if frontmatter was modified (vs content-only edits)
  autoSaveTimeoutId: ReturnType<typeof setTimeout> | null // Auto-save timeout ID
  lastSaveTimestamp: number | null // Timestamp of last successful save
  /** When the first edit not yet saved was made: the forced save's clock */
  dirtySince: number | null
  autoSaveCallback: ((showToast?: boolean) => Promise<void>) | null // Hook-provided save callback

  // Actions
  /** Opens `file` from disk, saving the open file first, and remembers it as the project's last entry */
  openFile: (file: FileEntry) => void
  /**
   * Closes the open file as the writer asked: saves its unsaved edits first,
   * and leaves it open if that fails (the save has said why)
   */
  closeFile: () => Promise<void>
  /**
   * Clears the open file without saving, so callers save first. Forgets it as
   * the project's last entry, so opening the project again doesn't undo the
   * close. Switching projects passes `keepLastEntry`, since that file is the
   * one to go back to.
   */
  closeCurrentFile: (options?: { keepLastEntry?: boolean }) => void
  saveFile: (showToast?: boolean) => Promise<void>
  setEditorContent: (content: string) => void
  setImports: (imports: string) => void
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
  isLoaded: false,
  loadError: null,
  frontmatterError: null,
  editingPaused: false,
  isDirty: false,
  isFrontmatterDirty: false,
  autoSaveTimeoutId: null,
  lastSaveTimestamp: null,
  dirtySince: null,
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

    // The outgoing file's content is cleared in the same update that sets
    // currentFile, so Editor.tsx never reads it against the new file.
    // lastSaveTimestamp makes useFileChangeHandler ignore changes to the file
    // on disk for its first few seconds, as it does after a save
    set({
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      frontmatterBaseline: null,
      imports: '',
      isLoaded: false,
      loadError: null,
      frontmatterError: null,
      currentFile: file,
      isDirty: false,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: Date.now(),
      dirtySince: null,
    })
    rememberLastEntry(file.path)

    // Update the selected collection to match the opened file's collection
    // Use custom event to communicate with project store (Bridge Pattern)
    window.dispatchEvent(
      new CustomEvent('file-opened', {
        detail: { collectionName: file.collection },
      })
    )

    // useEditorFileContent loads the content
  },

  closeFile: async () => {
    const { currentFile, isDirty, saveFile } = get()
    if (!currentFile) return
    if (isDirty) await saveFile(false)
    // Still dirty means the save failed; another file means one was opened
    // while saving, which isn't the one to close
    const after = get()
    if (after.isDirty || after.currentFile?.id !== currentFile.id) return
    after.closeCurrentFile()
  },

  closeCurrentFile: options => {
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
      isLoaded: false,
      loadError: null,
      frontmatterError: null,
      isDirty: false,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: null,
      dirtySince: null,
    })
    if (!options?.keepLastEntry) rememberLastEntry(null)
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

  // The edits below are ignored until the file has loaded (see `isLoaded`),
  // while editing is paused (`editingPaused`), and the frontmatter ones while
  // its frontmatter can't be read

  setEditorContent: (content: string) => {
    if (!get().isLoaded || get().editingPaused) return
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()
  },

  // Marks the file dirty in the same update: until then, useEditorFileContent
  // would put back the imports from disk
  setImports: (imports: string) => {
    if (!get().isLoaded || get().editingPaused) return
    set({ imports, isDirty: true })
    get().scheduleAutoSave()
  },

  updateFrontmatterField: (key: string, value: unknown) => {
    const { frontmatter, isLoaded, frontmatterError, editingPaused } = get()
    if (!isLoaded || frontmatterError || editingPaused) return

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

    // Debouncing never saves during continuous typing, so a save is forced
    // once the first unsaved edit is 10 seconds old. Timed from that edit,
    // not the last save, so the first keystroke after a pause isn't saved on
    // its own
    if (store.dirtySince === null) {
      set({ dirtySince: now })
    } else if (
      store.isDirty &&
      now - store.dirtySince >= MAX_AUTO_SAVE_DELAY_MS
    ) {
      const { autoSaveCallback } = store
      if (autoSaveCallback) {
        void autoSaveCallback(false) // Auto-save without toast
      }
      return
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
    rememberLastEntry(newFile.path)
  },
}))

// Components can use direct selectors like:
// const currentFile = useEditorStore(state => state.currentFile)
