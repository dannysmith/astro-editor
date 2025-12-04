import { useCallback } from 'react'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { useQueryClient } from '@tanstack/react-query'
import { commands, type Collection, type JsonValue } from '@/types'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { saveRecoveryData, saveCrashReport } from '../../lib/recovery'
import { toast } from '../../lib/toast'
import { queryKeys } from '../../lib/query-keys'
import { deserializeCompleteSchema } from '../../lib/schema'

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

        useEditorStore.setState({
          isDirty: false,
          isFrontmatterDirty: false,
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

  return { saveFile }
}
