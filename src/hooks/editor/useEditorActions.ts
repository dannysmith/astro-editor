import { useCallback } from 'react'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useQueryClient } from '@tanstack/react-query'
import { commands, type Collection, type JsonValue } from '@/types'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { saveRecoveryData, saveCrashReport } from '../../lib/recovery'
import { toast } from '../../lib/toast'
import { queryKeys } from '../../lib/query-keys'
import { deserializeCompleteSchema } from '../../lib/schema'
import {
  projectRegistryManager,
  getEffectiveContentDirectory,
} from '../../lib/project-registry'
import { findOwningProjectPath } from '../../lib/deep-link'
import { ASTRO_PATHS } from '../../lib/constants'

/**
 * Waits until the project store reflects `targetPath` as the active project with
 * its settings loaded. Resolves `false` if that doesn't happen within `timeoutMs`.
 *
 * `setProject` is fire-and-forget, so deep-link handling must wait for the switch
 * to complete before resolving/opening a file in the new project.
 */
function waitForProjectReady(
  targetPath: string,
  timeoutMs = 8000
): Promise<boolean> {
  const state = useProjectStore.getState()
  if (state.projectPath === targetPath && state.currentProjectSettings) {
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
      if (
        current.projectPath === targetPath &&
        current.currentProjectSettings
      ) {
        clearTimeout(handles.timer)
        handles.unsubscribe?.()
        resolve(true)
      }
    })
  })
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
    async (showToast = true) => {
      const {
        currentFile,
        editorContent,
        frontmatter,
        rawFrontmatter,
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
        // Get schema field order from collections data - NO EVENTS!
        // Direct synchronous access to query cache
        let schemaFieldOrder: string[] | null = null
        if (currentFile) {
          try {
            const collections = queryClient.getQueryData<Collection[]>(
              queryKeys.collections(projectPath)
            )
            if (collections && Array.isArray(collections)) {
              const collection = collections.find(
                (c: Collection) => c.name === currentFile.collection
              )
              const schema = collection?.complete_schema
                ? deserializeCompleteSchema(collection.complete_schema)
                : null
              schemaFieldOrder = schema ? schema.fields.map(f => f.name) : null
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Could not get schema field order:', error)
          }
        }

        // Only pass frontmatter object if it was edited, otherwise pass raw to preserve formatting
        const result = await commands.saveMarkdownContent(
          currentFile.path,
          isFrontmatterDirty
            ? (frontmatter as Partial<Record<string, JsonValue>>)
            : null,
          isFrontmatterDirty ? null : rawFrontmatter,
          editorContent,
          imports,
          schemaFieldOrder,
          projectPath
        )
        if (result.status === 'error') {
          throw new Error(result.error)
        }

        // Clear auto-save timeout since we just saved
        const { autoSaveTimeoutId } = useEditorStore.getState()
        if (autoSaveTimeoutId) {
          clearTimeout(autoSaveTimeoutId)
          useEditorStore.setState({ autoSaveTimeoutId: null })
        }

        // Only mark as clean if content hasn't changed during save (race condition protection)
        // Check both content AND frontmatter to avoid dropping unsaved edits
        const currentState = useEditorStore.getState()
        const contentUnchanged = currentState.editorContent === editorContent
        const frontmatterUnchanged =
          JSON.stringify(currentState.frontmatter) ===
          JSON.stringify(frontmatter)

        useEditorStore.setState({
          isDirty: !contentUnchanged || !frontmatterUnchanged,
          isFrontmatterDirty:
            currentState.isFrontmatterDirty || !frontmatterUnchanged,
          lastSaveTimestamp: Date.now(),
        })

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
        const state = useEditorStore.getState()
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
        useEditorStore.setState({ isDirty: true })
      }
    },
    [queryClient]
  )

  /**
   * Opens a file from an `astro-editor://open?path=...` deep link.
   *
   * Resolves the file against the *known* projects (the registry), switching
   * projects if needed, then reuses `openFile` — the same path the sidebar uses.
   */
  const openFileByPath = useCallback(async (filePath: string) => {
    // Bring the window forward immediately so the app visibly responds.
    try {
      const win = getCurrentWindow()
      await win.show()
      await win.unminimize()
      await win.setFocus()
    } catch {
      // Best-effort — focusing should never block opening the file.
    }

    // Only Markdown/MDX files are openable.
    const lower = filePath.toLowerCase()
    if (!lower.endsWith('.md') && !lower.endsWith('.mdx')) {
      toast.error('Astro Editor can only open .md or .mdx files')
      return
    }

    // Find the known project that owns this file (initializing the registry if
    // this is a cold start that raced ahead of normal initialization).
    let knownProjectPaths: string[]
    try {
      knownProjectPaths = Object.values(
        projectRegistryManager.getRegistry().projects
      ).map(p => p.path)
    } catch {
      await projectRegistryManager.initialize()
      knownProjectPaths = Object.values(
        projectRegistryManager.getRegistry().projects
      ).map(p => p.path)
    }

    const owningProjectPath = findOwningProjectPath(knownProjectPaths, filePath)
    if (!owningProjectPath) {
      toast.error("That file isn't in a project Astro Editor knows about", {
        description:
          'Open the project once, then links to its files will work.',
      })
      return
    }

    // Switch to the owning project if it isn't already active, then wait for it.
    const isCurrentProject =
      useProjectStore.getState().projectPath === owningProjectPath
    if (!isCurrentProject) {
      useProjectStore.getState().setProject(owningProjectPath)
      const ready = await waitForProjectReady(owningProjectPath)
      if (!ready) {
        toast.error('Failed to open the project for that link')
        return
      }
    }

    // Resolve the file to a FileEntry within the project (reuses the Rust scan).
    const { currentProjectSettings } = useProjectStore.getState()
    const contentDirectory = getEffectiveContentDirectory(
      currentProjectSettings
    )
    const result = await commands.resolveFileEntry(
      filePath,
      owningProjectPath,
      contentDirectory !== ASTRO_PATHS.CONTENT_DIR ? contentDirectory : null
    )

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
