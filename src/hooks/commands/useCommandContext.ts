import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { useCollectionsQuery } from '../queries/useCollectionsQuery'
import { CommandContext } from '../../lib/commands/types'

/**
 * Creates command context from current app state
 * This provides all the information and actions commands need
 */
export function useCommandContext(): CommandContext {
  const { currentFile, isDirty, saveFile, closeCurrentFile } = useEditorStore()

  const {
    selectedCollection,
    projectPath,
    globalSettings,
    currentProjectSettings,
    setSelectedCollection,
    setProject,
  } = useProjectStore()

  const { toggleSidebar, toggleFrontmatterPanel } = useUIStore()

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
    toggleTypewriterMode: () => {
      window.dispatchEvent(new CustomEvent('toggle-typewriter-mode'))
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
