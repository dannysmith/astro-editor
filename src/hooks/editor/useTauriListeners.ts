import { useEffect } from 'react'
import { EditorView } from '@codemirror/view'
import { listen } from '@tauri-apps/api/event'
import { handleTauriFileDrop } from '../../lib/editor/dragdrop'

/**
 * Hook for setting up Tauri event listeners
 */
export const useTauriListeners = (editorView: EditorView | null) => {
  useEffect(() => {
    // Don't set up listeners if editor view isn't ready yet
    if (!editorView) {
      return
    }

    const setupTauriListeners = async () => {
      try {
        // Listen for file drop events
        const unlistenDrop = await listen('tauri://drag-drop', event => {
          void handleTauriFileDrop(event.payload, editorView)
        })

        // Return cleanup function
        return () => {
          unlistenDrop()
        }
      } catch {
        // Ignore errors in setting up Tauri listeners
      }
    }

    const cleanup = setupTauriListeners()

    return () => {
      void cleanup.then(cleanupFn => cleanupFn?.())
    }
  }, [editorView])
}
