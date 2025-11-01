import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { queryClient } from '../lib/query-client'
import { saveRecoveryData, saveCrashReport } from '../lib/recovery'
import { toast } from '../lib/toast'
import { queryKeys } from '../lib/query-keys'
import { useProjectStore } from './projectStore'
import type { FileEntry } from '@/types'

const MAX_AUTO_SAVE_DELAY_MS = 10000 // Maximum time between auto-saves (10 seconds)

/**
 * Set a nested value in an object using dot notation
 * Example: setNestedValue(obj, 'author.name', 'John') → { author: { name: 'John' } }
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.')
  if (keys.length === 1) {
    // Protect against prototype pollution on simple keys
    if (
      path === '__proto__' ||
      path === 'constructor' ||
      path === 'prototype'
    ) {
      throw new Error(
        `Unsafe key "${path}" in path "${path}", prototype pollution prevented.`
      )
    }
    // Simple key, no nesting
    return { ...obj, [path]: value }
  }

  // Create nested structure
  const result = { ...obj }
  let current: Record<string, unknown> = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    // Protect against prototype pollution in nested paths
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(
        `Unsafe key "${key}" in path "${path}", prototype pollution prevented.`
      )
    }
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    } else {
      // Clone existing nested object
      current[key] = { ...(current[key] as Record<string, unknown>) }
    }
    current = current[key] as Record<string, unknown>
  }

  // Set the final value
  const lastKey = keys[keys.length - 1]!
  // Protect against prototype pollution on final key
  if (
    lastKey === '__proto__' ||
    lastKey === 'constructor' ||
    lastKey === 'prototype'
  ) {
    throw new Error(
      `Unsafe key "${lastKey}" in path "${path}", prototype pollution prevented.`
    )
  }
  current[lastKey] = value

  return result
}

/**
 * Get a nested value from an object using dot notation
 * Example: getNestedValue(obj, 'author.name') → 'John'
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

/**
 * Delete a nested value in an object using dot notation
 * Also cleans up empty parent objects
 */
function deleteNestedValue(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  const keys = path.split('.')
  if (keys.length === 1) {
    // Protect against prototype pollution on simple keys
    if (
      path === '__proto__' ||
      path === 'constructor' ||
      path === 'prototype'
    ) {
      throw new Error(
        `Unsafe key "${path}" in path "${path}", prototype pollution prevented.`
      )
    }
    // Simple key
    const result = { ...obj }
    delete result[path]
    return result
  }

  // Navigate to parent and delete
  const result = { ...obj }
  let current: Record<string, unknown> = result
  const parents: Array<{ obj: Record<string, unknown>; key: string }> = []

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    // Protect against prototype pollution in nested paths
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(
        `Unsafe key "${key}" in path "${path}", prototype pollution prevented.`
      )
    }
    if (typeof current[key] !== 'object' || current[key] === null) {
      // Path doesn't exist, nothing to delete
      return result
    }
    // Clone nested object
    current[key] = { ...(current[key] as Record<string, unknown>) }
    parents.push({ obj: current, key })
    current = current[key] as Record<string, unknown>
  }

  // Delete the final key
  const lastKey = keys[keys.length - 1]!
  // Protect against prototype pollution on final key
  if (
    lastKey === '__proto__' ||
    lastKey === 'constructor' ||
    lastKey === 'prototype'
  ) {
    throw new Error(
      `Unsafe key "${lastKey}" in path "${path}", prototype pollution prevented.`
    )
  }
  delete current[lastKey]

  // Clean up empty parent objects (bottom-up)
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i]!
    const { obj, key } = parent
    const nested = obj[key] as Record<string, unknown>
    if (Object.keys(nested).length === 0) {
      delete obj[key]
    } else {
      break // Stop cleaning if parent is not empty
    }
  }

  return result
}

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

  // Actions
  openFile: (file: FileEntry) => void
  closeCurrentFile: () => void
  saveFile: (showToast?: boolean) => Promise<void>
  setEditorContent: (content: string) => void
  updateFrontmatter: (frontmatter: Record<string, unknown>) => void
  updateFrontmatterField: (key: string, value: unknown) => void
  scheduleAutoSave: () => void
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

  // Actions
  openFile: (file: FileEntry) => {
    set({
      currentFile: file,
      isDirty: false,
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
    })
  },

  saveFile: async (showToast = true) => {
    const { currentFile, editorContent, frontmatter, imports } = get()
    if (!currentFile) return

    // Get project path using direct store access pattern (architecture guide: performance patterns)
    const { projectPath } = useProjectStore.getState()

    if (!projectPath) {
      throw new Error('No project path available')
    }

    try {
      // Get schema field order from collections data via custom event
      let schemaFieldOrder: string[] | null = null
      if (currentFile) {
        try {
          // Dispatch event to get schema field order for current collection
          const schemaEvent = new CustomEvent('get-schema-field-order', {
            detail: { collectionName: currentFile.collection },
          })

          // Set up a listener for the response
          let responseReceived = false
          const handleSchemaResponse = (event: Event) => {
            const customEvent = event as CustomEvent<{
              fieldOrder: string[] | null
            }>
            schemaFieldOrder = customEvent.detail.fieldOrder || null
            responseReceived = true
          }

          window.addEventListener(
            'schema-field-order-response',
            handleSchemaResponse
          )
          window.dispatchEvent(schemaEvent)

          // Wait a short time for the response (synchronous-style with events)
          await new Promise(resolve => {
            const checkResponse = () => {
              if (responseReceived) {
                resolve(null)
              } else {
                setTimeout(checkResponse, 10)
              }
            }
            checkResponse()
          })

          window.removeEventListener(
            'schema-field-order-response',
            handleSchemaResponse
          )
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Could not get schema field order:', error)
        }
      }

      await invoke('save_markdown_content', {
        filePath: currentFile.path,
        frontmatter,
        content: editorContent,
        imports,
        schemaFieldOrder,
        projectRoot: projectPath,
      })

      // Clear auto-save timeout since we just saved
      const { autoSaveTimeoutId } = get()
      if (autoSaveTimeoutId) {
        clearTimeout(autoSaveTimeoutId)
        set({ autoSaveTimeoutId: null })
      }

      set({ isDirty: false, lastSaveTimestamp: Date.now() })

      // Invalidate queries to update UI
      if (projectPath) {
        // Invalidate file content query to refresh cached content
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fileContent(projectPath, currentFile.path),
        })

        // Invalidate directory scans for this collection (root + all subdirectories)
        if (currentFile.collection) {
          void queryClient.invalidateQueries({
            queryKey: [
              ...queryKeys.all,
              projectPath,
              currentFile.collection,
              'directory',
            ],
          })
        }
      }

      // Show success toast only if requested
      if (showToast) {
        toast.success('File saved successfully')
      }
    } catch (error) {
      toast.error('Save failed', {
        description: `Could not save file: ${error instanceof Error ? error.message : 'Unknown error occurred'}. Recovery data has been saved.`,
      })
      await logError(`Save failed: ${String(error)}`)
      await info('Attempting to save recovery data...')

      // Save recovery data
      const state = get()
      await saveRecoveryData({
        currentFile: state.currentFile,
        projectPath,
        editorContent: state.editorContent,
        frontmatter: state.frontmatter,
      })

      // Save crash report
      await saveCrashReport(error as Error, {
        currentFile: state.currentFile?.path,
        projectPath: projectPath || undefined,
        action: 'save',
      })

      // Keep the file marked as dirty since save failed
      set({ isDirty: true })
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
        void store.saveFile(false)
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
      void store.saveFile(false)
    }, autoSaveDelay * 1000) // Convert from seconds to milliseconds

    set({ autoSaveTimeoutId: timeoutId })
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
