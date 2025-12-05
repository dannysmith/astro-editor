import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { useCollectionsQuery } from '../queries/useCollectionsQuery'
import { useEditorActions } from '../editor/useEditorActions'
import { CommandContext } from '../../lib/commands/types'

/**
 * Creates command context from current app state
 * This provides all the information and actions commands need
 */
export function useCommandContext(): CommandContext {
  // Object subscriptions need shallow
  const currentFile = useEditorStore(useShallow(state => state.currentFile))
  const globalSettings = useProjectStore(
    useShallow(state => state.globalSettings)
  )
  const currentProjectSettings = useProjectStore(
    useShallow(state => state.currentProjectSettings)
  )

  // Primitive subscriptions
  const isDirty = useEditorStore(state => state.isDirty)
  const closeCurrentFile = useEditorStore(state => state.closeCurrentFile)

  const selectedCollection = useProjectStore(state => state.selectedCollection)
  const projectPath = useProjectStore(state => state.projectPath)
  const setSelectedCollection = useProjectStore(
    state => state.setSelectedCollection
  )
  const setProject = useProjectStore(state => state.setProject)

  const toggleSidebar = useUIStore(state => state.toggleSidebar)
  const toggleFrontmatterPanel = useUIStore(
    state => state.toggleFrontmatterPanel
  )

  // Get editor actions (Hybrid Action Hooks pattern)
  const { saveFile } = useEditorActions()

  // Get collections data from TanStack Query
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  return {
    currentFile,
    selectedCollection,
    collections, // Now properly populated from TanStack Query
    projectPath,
    isDirty,
    globalSettings,
    createNewFile: () => {
      // Dispatch a custom event that Layout can listen to
      window.dispatchEvent(new CustomEvent('create-new-file'))
    },
    setSelectedCollection,
    setProject,
    toggleSidebar,
    toggleFrontmatterPanel,
    saveFile,
    closeCurrentFile,
    loadCollections: () => {
      // Use custom event pattern since command context can't use React hooks
      window.dispatchEvent(new CustomEvent('reload-collections'))
    },
    loadCollectionFiles: () => {
      // Use custom event pattern since command context can't use React hooks
      window.dispatchEvent(new CustomEvent('reload-collection-files'))
    },
    openPreferences: () => {
      // Dispatch a custom event that Layout can listen to
      window.dispatchEvent(new CustomEvent('open-preferences'))
    },
    toggleFocusMode: () => {
      window.dispatchEvent(new CustomEvent('toggle-focus-mode'))
    },
    toggleHighlightNouns: () => {
      window.dispatchEvent(new CustomEvent('toggle-highlight-nouns'))
    },
    toggleHighlightVerbs: () => {
      window.dispatchEvent(new CustomEvent('toggle-highlight-verbs'))
    },
    toggleHighlightAdjectives: () => {
      window.dispatchEvent(new CustomEvent('toggle-highlight-adjectives'))
    },
    toggleHighlightAdverbs: () => {
      window.dispatchEvent(new CustomEvent('toggle-highlight-adverbs'))
    },
    toggleHighlightConjunctions: () => {
      window.dispatchEvent(new CustomEvent('toggle-highlight-conjunctions'))
    },
    toggleAllHighlights: () => {
      window.dispatchEvent(new CustomEvent('toggle-all-highlights'))
    },
    // Future: editor selection context could be added here
  }
}
