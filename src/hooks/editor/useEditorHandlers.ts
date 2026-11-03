import { useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'

/**
 * Hook for creating editor event handlers
 */
export const useEditorHandlers = () => {
  // No store subscriptions needed - use getState() pattern

  // Handle content changes
  const handleChange = useCallback((value: string) => {
    // Use getState() to avoid dependency on setEditorContent function reference
    useEditorStore.getState().setEditorContent(value)
  }, [])

  // Handle editor focus - just set flag, menu state managed in Layout
  const handleFocus = useCallback(() => {
    window.isEditorFocused = true
    window.dispatchEvent(new CustomEvent('editor-focus-changed'))
  }, [])

  // Handle editor blur - just clear flag, menu state managed in Layout
  const handleBlur = useCallback(() => {
    window.isEditorFocused = false
    window.dispatchEvent(new CustomEvent('editor-focus-changed'))

    // Manual save on blur for immediate feedback
    const { currentFile, isDirty, saveFile } = useEditorStore.getState()
    if (currentFile && isDirty) {
      void saveFile()
    }
  }, [])

  return {
    handleChange,
    handleFocus,
    handleBlur,
  }
}
