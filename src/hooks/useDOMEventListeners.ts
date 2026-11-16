import { useEffect, useRef } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'

/**
 * Handles custom DOM events for UI interactions.
 *
 * Events handled:
 * - 'create-new-file': Creates a new file (still needed for keyboard shortcuts)
 * - 'open-preferences': Opens the preferences dialog
 * - 'toggle-focus-mode': Toggles focus mode
 * - 'toggle-typewriter-mode': Toggles typewriter mode
 * - 'file-opened': Updates selected collection when file opens
 */
export function useDOMEventListeners(
  createNewFileWithQuery: () => Promise<void>,
  onOpenPreferences: (open: boolean) => void
) {
  // Use refs to capture latest callbacks without causing effect to re-run
  const createFileRef = useRef(createNewFileWithQuery)
  const openPreferencesRef = useRef(onOpenPreferences)

  // Update refs when callbacks change
  useEffect(() => {
    createFileRef.current = createNewFileWithQuery
    openPreferencesRef.current = onOpenPreferences
  }, [createNewFileWithQuery, onOpenPreferences])

  // Preferences dialog event
  useEffect(() => {
    const handleOpenPreferences = () => {
      openPreferencesRef.current(true)
    }

    window.addEventListener('open-preferences', handleOpenPreferences)
    return () =>
      window.removeEventListener('open-preferences', handleOpenPreferences)
  }, [])

  // Create new file event (still needed for keyboard shortcut)
  useEffect(() => {
    const handleCreateNewFile = () => {
      void createFileRef.current()
    }

    window.addEventListener('create-new-file', handleCreateNewFile)
    return () =>
      window.removeEventListener('create-new-file', handleCreateNewFile)
  }, [])

  // Focus mode, typewriter mode and file-opened event
  useEffect(() => {
    const handleToggleFocusMode = () => {
      useUIStore.getState().toggleFocusMode()
    }

    const handleToggleTypewriterMode = () => {
      useUIStore.getState().toggleTypewriterMode()
    }

    const handleFileOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ collectionName: string }>
      const { collectionName } = customEvent.detail
      const { selectedCollection } = useProjectStore.getState()

      if (selectedCollection !== collectionName) {
        useProjectStore.getState().setSelectedCollection(collectionName)
      }
    }

    // Register focus mode and typewriter mode listeners
    window.addEventListener('toggle-focus-mode', handleToggleFocusMode)
    window.addEventListener(
      'toggle-typewriter-mode',
      handleToggleTypewriterMode
    )

    window.addEventListener('file-opened', handleFileOpened)

    return () => {
      window.removeEventListener('toggle-focus-mode', handleToggleFocusMode)
      window.removeEventListener(
        'toggle-typewriter-mode',
        handleToggleTypewriterMode
      )
      window.removeEventListener('file-opened', handleFileOpened)
    }
  }, [])
}
