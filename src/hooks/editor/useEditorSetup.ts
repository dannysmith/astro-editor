import { useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { createExtensions } from '../../lib/editor/extensions'
import type { KeymapHandlers } from '../../lib/editor/extensions/keymap'
import {
  globalCommandRegistry,
  createEditorCommandRegistry,
} from '../../lib/editor/commands'

/**
 * Hook for setting up editor extensions and commands
 */
export const useEditorSetup = (
  onFocus: () => void,
  onBlur: () => void,
  keymapHandlers?: KeymapHandlers
) => {
  // Create extensions with current configuration
  const extensions = createExtensions({
    onFocus,
    onBlur,
    keymapHandlers,
  })

  // Set up editor commands when editor view is available
  const setupCommands = useCallback((editorView: EditorView) => {
    globalCommandRegistry.register(createEditorCommandRegistry(), editorView)
  }, [])

  // Cleanup commands
  const cleanupCommands = useCallback(() => {
    globalCommandRegistry.unregister()
  }, [])

  return {
    extensions,
    setupCommands,
    cleanupCommands,
  }
}
