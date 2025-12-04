import { useEffect } from 'react'
import { commands } from '@/lib/bindings'
import { useEditorStore } from '../store/editorStore'

/**
 * Tracks editor focus state and manages format menu enabled/disabled state.
 *
 * The format menu (Bold, Italic, etc.) should only be enabled when:
 * 1. A file is currently open
 * 2. The editor has focus
 *
 * This hook listens to the 'editor-focus-changed' event and currentFile changes,
 * updating the native menu state accordingly.
 */
export function useEditorFocusTracking() {
  // Initialize focus state and listen for changes
  useEffect(() => {
    window.isEditorFocused = false
    void commands.updateFormatMenuState(false)

    const updateMenuState = () => {
      const { currentFile } = useEditorStore.getState()
      const shouldEnableMenu = Boolean(currentFile && window.isEditorFocused)
      void commands.updateFormatMenuState(shouldEnableMenu)
    }

    // Listen to focus changes
    const handleEditorFocusChange = () => {
      updateMenuState()
    }

    window.addEventListener('editor-focus-changed', handleEditorFocusChange)

    // Subscribe to currentFile changes in the store
    let previousFile = useEditorStore.getState().currentFile

    const unsubscribe = useEditorStore.subscribe(state => {
      const newFile = state.currentFile
      // Only update if currentFile actually changed
      if (newFile !== previousFile) {
        previousFile = newFile
        updateMenuState()
      }
    })

    return () => {
      window.removeEventListener(
        'editor-focus-changed',
        handleEditorFocusChange
      )
      unsubscribe()
    }
  }, [])
}
