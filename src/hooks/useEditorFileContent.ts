import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useFileContentQuery } from './queries/useFileContentQuery'

/**
 * Hook that bridges TanStack Query (server state) with Zustand (local editing state)
 *
 * Responsibilities:
 * 1. Fetch file content when currentFile changes
 * 2. Sync query data to store ONLY when appropriate
 * 3. Respect isDirty state (don't overwrite user's edits)
 */
export function useEditorFileContent() {
  console.log('[PERF] useEditorFileContent HOOK EXECUTE')

  const { currentFile } = useEditorStore()
  const { projectPath } = useProjectStore()

  // Query fetches content based on current file
  // Pass both id (for cache key) and path (for Rust command)
  const { data, isLoading, isError, error } = useFileContentQuery(
    projectPath,
    currentFile?.id || null,
    currentFile?.path || null
  )

  // Sync query data to local editing state when it arrives
  useEffect(() => {
    if (!data || !currentFile) return

    // CRITICAL: Don't overwrite user's unsaved edits
    const { isDirty: currentIsDirty } = useEditorStore.getState()
    if (currentIsDirty) {
      return // User is editing - their version is authoritative
    }

    // Safe to update - file is saved and matches disk
    useEditorStore.setState({
      editorContent: data.content,
      frontmatter: data.frontmatter,
      rawFrontmatter: data.raw_frontmatter,
      imports: data.imports,
    })
  }, [data, currentFile])

  return { isLoading, isError, error }
}
