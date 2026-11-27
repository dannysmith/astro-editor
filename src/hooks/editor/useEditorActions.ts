import { useCallback } from 'react'
import {
  info,
  error as logError,
  warn as logWarn,
} from '@tauri-apps/plugin-log'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { commands, type DirectoryScanResult, type JsonValue } from '@/types'
import type { ProjectScan } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { saveRecoveryData, saveCrashReport } from '../../lib/recovery'
import { toast } from '../../lib/toast'
import { queryKeys } from '../../lib/query-keys'
import {
  deserializeCompleteSchema,
  frontmatterSchema,
  type SchemaField,
} from '../../lib/schema'
import { isBackToBaseline } from '../../lib/files/frontmatter-baseline'
import { openProjectForLink } from '../../lib/projects/actions'
import { renameUnderWay } from '../../lib/files/rename'
import { queueWrite } from '../../lib/files/write-queue'

/**
 * Saves the open file: writes its body, imports and frontmatter (edited
 * values spliced into the frontmatter's text, see below), marks it clean if
 * nothing changed meanwhile, and refreshes the queries that show it. On
 * failure, writes recovery data and a crash report and keeps the file dirty.
 * It reads the store as soon as it's called, even if its write has to queue,
 * which switching files relies on.
 * Plain function rather than inline in the hook so the React Compiler can
 * compile the hook (it can't handle `throw` inside `try`).
 */
async function saveCurrentFile(
  queryClient: QueryClient,
  showToast: boolean
): Promise<void> {
  const {
    currentFile,
    editorContent,
    frontmatter,
    rawFrontmatter,
    frontmatterBaseline,
    isFrontmatterDirty,
    imports,
    isLoaded,
    openGeneration,
  } = useEditorStore.getState()
  // Until the file has loaded, the store holds an empty placeholder, which
  // must never be written over it
  if (!currentFile || !isLoaded) return

  // Get project path using direct store access pattern
  const { projectPath } = useProjectStore.getState()

  if (!projectPath) {
    throw new Error('No project path available')
  }

  try {
    // The collection's schema fields, from the query cache, for their order,
    // which hold dates, and to compare with the baseline
    let fields: SchemaField[] | null = null
    const scan = queryClient.getQueryData<ProjectScan>(
      queryKeys.collections(projectPath)
    )
    const collection = scan?.collections.find(
      c => c.name === currentFile.collection
    )
    // Only with the whole schema: without it, the keys would just be sorted
    // alphabetically
    const reorderFrontmatter =
      (scan?.projectSettings.reorderFrontmatter.value ?? false) &&
      collection?.schemaStatus === 'complete'
    try {
      const schema = collection?.completeSchema
        ? deserializeCompleteSchema(collection.completeSchema)
        : null
      fields = schema?.fields ?? null
    } catch (error) {
      void logWarn(`Could not get schema fields: ${String(error)}`)
    }

    // If the file is being renamed, save to its new path, not the old one
    const rename = renameUnderWay(currentFile.path)
    const path = rename ? await rename : currentFile.path

    // Unedited frontmatter is written back as it is on disk. Edited, its
    // values are spliced into the baseline's text (the frontmatter as the
    // file was opened, or last changed outside the app), so the file only
    // ever differs from that by the edits, however many saves came between:
    // a key cleared and retyped goes back where it was, and how one looked
    // halfway through typing doesn't stick. Edited back to the baseline's
    // values, the baseline's text is written as it is
    const backToBaseline =
      isFrontmatterDirty &&
      frontmatterBaseline !== null &&
      isBackToBaseline(frontmatter, frontmatterBaseline, fields ?? [])
    const writeValues = isFrontmatterDirty && !backToBaseline
    const text =
      isFrontmatterDirty && frontmatterBaseline !== null
        ? frontmatterBaseline.raw
        : rawFrontmatter

    const result = await queueWrite(() =>
      commands.saveMarkdownContent(
        path,
        writeValues ? (frontmatter as Record<string, JsonValue>) : null,
        text,
        editorContent,
        imports,
        frontmatterSchema(fields ?? []),
        reorderFrontmatter,
        projectPath
      )
    )
    if (result.status === 'error') {
      throw new Error(result.error)
    }

    // If a file was opened during the save (openFile saves the outgoing file),
    // the store now holds that file's state: leave it alone. That includes
    // switching away and back, where it holds this file's unloaded placeholder
    const currentState = useEditorStore.getState()
    if (currentState.openGeneration === openGeneration) {
      // Clear auto-save timeout since we just saved
      if (currentState.autoSaveTimeoutId) {
        clearTimeout(currentState.autoSaveTimeoutId)
      }

      // Only mark as clean if content hasn't changed during save (race condition protection)
      // Check the body, imports and frontmatter to avoid dropping unsaved edits
      const contentUnchanged =
        currentState.editorContent === editorContent &&
        currentState.imports === imports
      const frontmatterUnchanged =
        JSON.stringify(currentState.frontmatter) === JSON.stringify(frontmatter)

      const stillDirty = !contentUnchanged || !frontmatterUnchanged
      useEditorStore.setState({
        autoSaveTimeoutId: null,
        isDirty: stillDirty,
        isFrontmatterDirty:
          currentState.isFrontmatterDirty || !frontmatterUnchanged,
        lastSaveTimestamp: Date.now(),
        // What's on disk now. A load that brings anything else is a change
        // made outside the app (see useEditorFileContent)
        rawFrontmatter: result.data,
        // Edits made during the save start the clock again
        dirtySince: stillDirty ? Date.now() : null,
      })
      // Their auto-save timer was cleared above, so they need another
      if (stillDirty) useEditorStore.getState().scheduleAutoSave()
    }

    // Invalidate queries to update UI
    if (projectPath) {
      // Invalidate file content query to refresh cached content
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(projectPath, path),
      })

      // The collection's folder listings (root + all subdirectories)
      const directories = [
        ...queryKeys.all,
        projectPath,
        currentFile.collection,
        'directory',
      ]
      if (isFrontmatterDirty) {
        // The sidebar and entry pickers show titles, dates and ids, which come
        // from the frontmatter (a `slug` is the id)
        void queryClient.invalidateQueries({ queryKey: directories })
        void queryClient.invalidateQueries({
          queryKey: queryKeys.collectionFiles(
            projectPath,
            currentFile.collection
          ),
        })
      } else {
        // A body-only save changes only the file's modified time, which the
        // sidebar can sort by. Updating it in place saves re-reading every
        // file in the folder on each auto-save. A write marks a listing fresh,
        // so listings waiting to be re-read (after a change outside the app)
        // and listings without the file are left alone
        const lastModified = Math.floor(Date.now() / 1000)
        queryClient.setQueriesData<DirectoryScanResult>(
          {
            queryKey: directories,
            predicate: query => !query.state.isInvalidated,
          },
          data => {
            if (!data?.files.some(file => file.path === path)) return undefined
            return {
              ...data,
              files: data.files.map(file =>
                file.path === path
                  ? { ...file, last_modified: lastModified }
                  : file
              ),
            }
          }
        )
      }
    }

    // Show success toast only if requested
    if (showToast) {
      toast.success('File saved successfully')
    }
  } catch (error) {
    void logError(`Save failed: ${String(error)}`)
    void info('Attempting to save recovery data...')

    // Save recovery data for the file that failed: the store's latest edits
    // if it's still open, otherwise what this save tried to write
    const state = useEditorStore.getState()
    const stillOpen = state.openGeneration === openGeneration
    const recovered = await saveRecoveryData(
      stillOpen
        ? {
            currentFile: state.currentFile,
            projectPath,
            editorContent: state.editorContent,
            frontmatter: state.frontmatter,
          }
        : { currentFile, projectPath, editorContent, frontmatter }
    )

    const reason =
      error instanceof Error ? error.message : 'Unknown error occurred'
    // One toast, replaced by each failure, while saving keeps failing
    toast.error('Save failed', {
      id: 'save-failed',
      description: `Could not save file: ${reason}.${recovered ? ' Recovery data has been saved.' : ''}`,
    })

    // Save crash report
    await saveCrashReport(error as Error, {
      currentFile: currentFile.path,
      projectPath: projectPath || undefined,
      action: 'save',
    })

    // Keep the file marked as dirty since save failed. Restarting the clock
    // for the forced save means it's retried every 10 seconds while the
    // writer types, not on every keystroke. Another file may have opened
    // while the recovery data was written
    if (useEditorStore.getState().openGeneration === openGeneration) {
      useEditorStore.setState({ isDirty: true, dirtySince: Date.now() })
    }
  }
}

/**
 * Editor action hooks following the Hybrid Action Hooks pattern.
 *
 * User-triggered actions (like save, delete) live in hooks, which have natural
 * access to both Zustand stores (via getState()) and TanStack Query data.
 * State-triggered actions (like auto-save) live in stores and call these hooks
 * via registered callbacks, which read query data directly rather than
 * firing events for a hook to pick up.
 */
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(
    (showToast = true) => saveCurrentFile(queryClient, showToast),
    [queryClient]
  )

  /**
   * Opens a file by absolute path. Used by `astro-editor://open?path=...` deep
   * links (which focus the window first) and the dev-only agent bridge.
   *
   * Resolves the file against the *known* projects (the registry), switching
   * projects if needed, then reuses `openFile` — the same path the sidebar uses.
   */
  const openFileByPath = useCallback(async (filePath: string) => {
    // Only Markdown/MDX files are openable.
    const lower = filePath.toLowerCase()
    if (!lower.endsWith('.md') && !lower.endsWith('.mdx')) {
      toast.error('Astro Editor can only open .md or .mdx files')
      return
    }

    const projectPath = await openProjectForLink(filePath)
    if (!projectPath) return

    // Resolve the file to a FileEntry within the project (reuses the Rust scan).
    const result = await commands.resolveFileEntry(filePath, projectPath)

    if (result.status === 'error') {
      toast.error("Couldn't open that file", { description: result.error })
      await logError(`Deep link resolve failed: ${result.error}`)
      return
    }

    if (!result.data) {
      // Project is now open, but the file isn't part of a loadable collection.
      toast.warning("Couldn't find that file in the project", {
        description: 'It may not be part of a content collection.',
      })
      return
    }

    useEditorStore.getState().openFile(result.data)
    await info(`Deep link opened file: ${result.data.id}`)
  }, [])

  return { saveFile, openFileByPath }
}
