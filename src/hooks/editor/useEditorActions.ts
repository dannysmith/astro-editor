import { useCallback } from 'react'
import {
  info,
  error as logError,
  warn as logWarn,
} from '@tauri-apps/plugin-log'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { commands, type JsonValue } from '@/types'
import type { ProjectScan } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { saveRecoveryData, saveCrashReport } from '../../lib/recovery'
import { toast } from '../../lib/toast'
import { queryKeys } from '../../lib/query-keys'
import { deserializeCompleteSchema, type SchemaField } from '../../lib/schema'
import { isBackToBaseline } from '../../lib/files/frontmatter-baseline'
import { findOwningProjectPath } from '../../lib/deep-link'
import { showProjectList } from '../../lib/projects/actions'
import { renameUnderWay } from '../../lib/files/rename'

/**
 * Waits until the project store has the project `projectId` open, with its
 * settings loaded. Resolves `false` if that doesn't happen within `timeoutMs`.
 *
 * `setProject` is fire-and-forget, so deep-link handling must wait for the switch
 * to complete before resolving/opening a file in the new project.
 */
function waitForProjectReady(
  projectId: string,
  timeoutMs = 8000
): Promise<boolean> {
  const state = useProjectStore.getState()
  if (state.currentProjectId === projectId && state.projectSettings) {
    return Promise.resolve(true)
  }

  return new Promise<boolean>(resolve => {
    const handles: {
      unsubscribe?: () => void
      timer?: ReturnType<typeof setTimeout>
    } = {}

    handles.timer = setTimeout(() => {
      handles.unsubscribe?.()
      resolve(false)
    }, timeoutMs)

    handles.unsubscribe = useProjectStore.subscribe(current => {
      if (current.currentProjectId === projectId && current.projectSettings) {
        clearTimeout(handles.timer)
        handles.unsubscribe?.()
        resolve(true)
      }
    })
  })
}

/**
 * The latest save's write, while it's under way. Saves can overlap (Cmd+S
 * during an auto-save, or the forced save while typing on a slow disk), so
 * each write waits for the one before and they land in the order they were
 * asked for. Each save still reads the store as soon as it's asked for, which
 * switching files relies on.
 */
let writeUnderWay: Promise<void> | null = null

/**
 * Saves the open file: writes its body, imports and frontmatter (in the
 * schema's field order, or the original text if its values are unchanged
 * from it), marks it clean if nothing changed meanwhile, and
 * refreshes the queries that show it. On failure, writes recovery data and a
 * crash report and keeps the file dirty. Plain function rather than inline in
 * the hook so the React Compiler can compile the hook (it can't handle `throw`
 * inside `try`).
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
  } = useEditorStore.getState()
  if (!currentFile) return

  // Get project path using direct store access pattern
  const { projectPath } = useProjectStore.getState()

  if (!projectPath) {
    throw new Error('No project path available')
  }

  try {
    // The collection's schema fields, from the query cache, for the field
    // order and to compare with the baseline
    let fields: SchemaField[] | null = null
    try {
      const collection = queryClient
        .getQueryData<ProjectScan>(queryKeys.collections(projectPath))
        ?.collections.find(c => c.name === currentFile.collection)
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

    // Edited frontmatter is re-serialised from its values. Unedited, or edited
    // back to what was loaded, the original text is written instead, keeping
    // its formatting
    const backToBaseline =
      isFrontmatterDirty &&
      frontmatterBaseline !== null &&
      isBackToBaseline(frontmatter, frontmatterBaseline, fields ?? [])
    const writeValues = isFrontmatterDirty && !backToBaseline
    const originalText = backToBaseline
      ? frontmatterBaseline.raw
      : rawFrontmatter

    // Waits for a write under way, so an older save can't land last
    const save = () =>
      commands.saveMarkdownContent(
        path,
        writeValues ? (frontmatter as Record<string, JsonValue>) : null,
        writeValues ? null : originalText,
        editorContent,
        imports,
        fields ? fields.map(f => f.name) : null,
        projectPath
      )
    const write = writeUnderWay ? writeUnderWay.then(save) : save()
    const settled = write.then(
      () => undefined,
      () => undefined
    )
    writeUnderWay = settled
    void settled.then(() => {
      if (writeUnderWay === settled) writeUnderWay = null
    })
    const result = await write
    if (result.status === 'error') {
      throw new Error(result.error)
    }

    // If another file was opened during the save (openFile saves the
    // outgoing file), the store now holds that file's state: leave it alone
    const currentState = useEditorStore.getState()
    if (currentState.currentFile?.path === path) {
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

      useEditorStore.setState({
        autoSaveTimeoutId: null,
        isDirty: !contentUnchanged || !frontmatterUnchanged,
        isFrontmatterDirty:
          currentState.isFrontmatterDirty || !frontmatterUnchanged,
        lastSaveTimestamp: Date.now(),
      })
    }

    // Invalidate queries to update UI
    if (projectPath) {
      // Invalidate file content query to refresh cached content
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(projectPath, currentFile.id),
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

      // Entry pickers show titles and ids, which come from the frontmatter
      // (a `slug` is the id)
      if (isFrontmatterDirty) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.collectionFiles(
            projectPath,
            currentFile.collection
          ),
        })
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
    const stillOpen = state.currentFile?.id === currentFile.id
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
    toast.error('Save failed', {
      description: `Could not save file: ${reason}.${recovered ? ' Recovery data has been saved.' : ''}`,
    })

    // Save crash report
    await saveCrashReport(error as Error, {
      currentFile: currentFile.path,
      projectPath: projectPath || undefined,
      action: 'save',
    })

    // Keep the file marked as dirty since save failed
    if (stillOpen) {
      useEditorStore.setState({ isDirty: true })
    }
  }
}

/**
 * Editor action hooks following the Hybrid Action Hooks pattern.
 *
 * User-triggered actions (like save, delete) live in hooks, which have natural
 * access to both Zustand stores (via getState()) and TanStack Query data.
 * State-triggered actions (like auto-save) live in stores and call these hooks
 * via registered callbacks.
 *
 * This pattern eliminates the event bridge polling pattern and provides:
 * - Direct synchronous access to query data (no polling)
 * - Full type safety
 * - Clear data flow and dependencies
 * - Standard React patterns
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

    // Find the known project that owns this file. The registry is read fresh,
    // since on a cold start this can run before preferences have loaded.
    const preferences = await commands.loadPreferences()
    if (preferences.status === 'error') {
      toast.error("Couldn't open that file", { description: preferences.error })
      return
    }
    // Reading them sets aside settings files that can't be read, as at startup
    for (const problem of preferences.data.problems) {
      toast.warning('Settings were reset', { description: problem })
    }
    const knownProjects = Object.values(preferences.data.registry.projects)
    const owningProjectPath = findOwningProjectPath(
      knownProjects.map(p => p.path),
      filePath
    )
    const owningProject = knownProjects.find(p => p.path === owningProjectPath)
    if (!owningProject) {
      toast.error("That file isn't in a project Astro Editor knows about", {
        description:
          'If its project has moved, locate it in the project list. Otherwise open the project once, then links to its files will work.',
        action: { label: 'Show Projects', onClick: showProjectList },
        duration: 10_000,
      })
      return
    }

    // Switch to the owning project if it isn't already active, then wait for it.
    const isCurrentProject =
      useProjectStore.getState().currentProjectId === owningProject.id
    if (!isCurrentProject) {
      useProjectStore.getState().setProject(owningProject.path)
      const ready = await waitForProjectReady(owningProject.id)
      if (!ready) {
        toast.error('Failed to open the project for that link')
        return
      }
    }

    // Resolve the file to a FileEntry within the project (reuses the Rust scan).
    const result = await commands.resolveFileEntry(filePath, owningProject.path)

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
