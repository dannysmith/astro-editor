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
 * 4. Clear stale content immediately when switching files
 */
export function useEditorFileContent() {
  const { currentFile } = useEditorStore()
  const { projectPath } = useProjectStore()

  // CRITICAL: Clear content immediately when file changes
  // Prevents showing stale content from previous file during query loading
  useEffect(() => {
    if (currentFile) {
      useEditorStore.setState({
        editorContent: '',
        frontmatter: {},
        rawFrontmatter: '',
        imports: '',
      })
    }
  }, [currentFile])

  // Query fetches content based on current file
  const { data, isLoading, isError, error } = useFileContentQuery(
    projectPath,
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
  }, [data, currentFile]) // Only sync when data or file changes

  return { isLoading, isError, error }
}
