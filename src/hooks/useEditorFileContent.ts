import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
  // Object subscription needs shallow
  const currentFile = useEditorStore(useShallow(state => state.currentFile))
  const projectPath = useProjectStore(state => state.projectPath)

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
    const {
      isDirty: currentIsDirty,
      frontmatterBaseline,
      rawFrontmatter,
    } = useEditorStore.getState()
    if (currentIsDirty) {
      return // User is editing - their version is authoritative
    }

    // Safe to update - file is saved and matches disk. The first load after
    // opening becomes the baseline. So does a load whose frontmatter isn't
    // what the store last knew was on disk (as loaded, or as our last save
    // wrote it), since that's a change made outside the app. Loads after our
    // own saves leave it alone
    const changedOutside = data.raw_frontmatter !== rawFrontmatter
    useEditorStore.setState({
      editorContent: data.content,
      frontmatter: data.frontmatter,
      rawFrontmatter: data.raw_frontmatter,
      frontmatterBaseline:
        frontmatterBaseline === null || changedOutside
          ? { values: data.frontmatter, raw: data.raw_frontmatter }
          : frontmatterBaseline,
      imports: data.imports,
      isFrontmatterDirty: false, // Reset when loading from disk
      isLoaded: true,
      loadError: null,
      frontmatterError: data.frontmatter_error,
    })
  }, [data, currentFile])

  // A file that can't be loaded can't be edited, since the editor would only
  // hold an empty placeholder. A failed reload of a loaded file changes
  // nothing: what's in the editor is still the file
  useEffect(() => {
    if (!error || useEditorStore.getState().isLoaded) return
    useEditorStore.setState({ loadError: error.message })
  }, [error])

  return { isLoading, isError, error }
}
