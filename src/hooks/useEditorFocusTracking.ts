import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../store/editorStore'

/**
 * Tracks editor focus state and manages format menu enabled/disabled state.
 *
 * The format menu (Bold, Italic, etc.) should only be enabled when:
 * 1. A file is currently open
 * 2. The editor has focus
 *
 * This hook listens to the 'editor-focus-changed' event and updates the
 * native menu state accordingly.
 */
export function useEditorFocusTracking() {
  // Update format menu state based on editor focus and file presence
  useEffect(() => {
    const { currentFile } = useEditorStore.getState()
    const shouldEnableMenu = Boolean(currentFile && window.isEditorFocused)
    void invoke('update_format_menu_state', { enabled: shouldEnableMenu })
  })

  // Initialize focus state and listen for changes
  useEffect(() => {
    window.isEditorFocused = false
    void invoke('update_format_menu_state', { enabled: false })

    const handleEditorFocusChange = () => {
      const { currentFile } = useEditorStore.getState()
      const shouldEnableMenu = Boolean(currentFile && window.isEditorFocused)
      void invoke('update_format_menu_state', { enabled: shouldEnableMenu })
    }

    window.addEventListener('editor-focus-changed', handleEditorFocusChange)
    return () =>
      window.removeEventListener(
        'editor-focus-changed',
        handleEditorFocusChange
      )
  }, [])
}
