import { useEffect, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { focusEditor } from '../lib/focus-utils'
import { useEditorActions } from './editor/useEditorActions'

const DEFAULT_HOTKEY_OPTS = {
  preventDefault: true,
  enableOnFormTags: true,
  enableOnContentEditable: true,
}

/**
 * Registers all keyboard shortcuts for the application.
 *
 * Uses direct hook calls (useEditorActions) for consistency with the
 * Hybrid Action Hooks pattern established in Task 1.
 */
export function useKeyboardShortcuts(
  onOpenPreferences: (open: boolean) => void
) {
  const { saveFile } = useEditorActions()

  // Use refs to capture latest callbacks
  const saveFileRef = useRef(saveFile)
  const openPreferencesRef = useRef(onOpenPreferences)

  // Update refs when callbacks change
  useEffect(() => {
    saveFileRef.current = saveFile
    openPreferencesRef.current = onOpenPreferences
  }, [saveFile, onOpenPreferences])

  // Cmd+S: Save File
  useHotkeys(
    'mod+s',
    () => {
      const { currentFile, isDirty } = useEditorStore.getState()
      if (currentFile && isDirty) {
        void saveFileRef.current()
      }
    },
    DEFAULT_HOTKEY_OPTS
  )

  // Cmd+1: Toggle Sidebar
  useHotkeys(
    'mod+1',
    () => {
      useUIStore.getState().toggleSidebar()
    },
    DEFAULT_HOTKEY_OPTS
  )

  // Cmd+2: Toggle Frontmatter Panel
  useHotkeys(
    'mod+2',
    () => {
      useUIStore.getState().toggleFrontmatterPanel()
    },
    DEFAULT_HOTKEY_OPTS
  )

  // Cmd+N: Create New File
  useHotkeys(
    'mod+n',
    () => {
      const { selectedCollection } = useProjectStore.getState()
      if (selectedCollection) {
        window.dispatchEvent(new CustomEvent('create-new-file'))
        // Fix for cursor disappearing - ensure cursor is visible
        document.body.style.cursor = 'auto'
        void document.body.offsetHeight
      }
    },
    DEFAULT_HOTKEY_OPTS
  )

  // Cmd+W: Close Current File
  useHotkeys(
    'mod+w',
    () => {
      const { currentFile, closeCurrentFile } = useEditorStore.getState()
      if (currentFile) {
        closeCurrentFile()
      }
    },
    DEFAULT_HOTKEY_OPTS
  )

  // Cmd+,: Open Preferences
  useHotkeys(
    'mod+comma',
    () => {
      openPreferencesRef.current(true)
    },
    DEFAULT_HOTKEY_OPTS
  )

  // Cmd+0: Focus main editor
  useHotkeys(
    'mod+0',
    () => {
      focusEditor()
    },
    DEFAULT_HOTKEY_OPTS
  )
}
