import { useEffect, useRef } from 'react'
import { error as logError } from '@tauri-apps/plugin-log'
import { useHotkeys } from 'react-hotkeys-hook'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { focusEditor } from '../lib/focus-utils'
import { showProjectList } from '../lib/projects/actions'
import { toast } from '../lib/toast'
import { useEditorActions } from './editor/useEditorActions'
import { usePlatform } from './usePlatform'

// App shortcuts must work while typing: the editor is a contenteditable and the
// frontmatter fields are inputs, and react-hotkeys-hook ignores both by default.
const DEFAULT_HOTKEY_OPTS = {
  preventDefault: true,
  enableOnFormTags: true,
  enableOnContentEditable: true,
}

/**
 * Registers the app-wide keyboard shortcuts. Editor-only shortcuts are
 * CodeMirror keymaps in lib/editor/extensions/keymap.ts.
 *
 * Saving goes through useEditorActions (the Hybrid Action Hooks pattern).
 */
export function useKeyboardShortcuts(
  onOpenPreferences: (open: boolean) => void
) {
  const { saveFile } = useEditorActions()
  const platform = usePlatform()

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

  // Cmd+W on macOS: close the window, like the red button. The app keeps
  // running and the Dock icon brings the window back as it was (lib.rs hides it
  // rather than closing it). Handled here because the page sees the key before
  // the native Close menu item.
  // Ctrl+W on Windows and Linux: close the current file, since closing the
  // only window would quit
  useHotkeys(
    'mod+w',
    () => {
      if (platform === 'macos') {
        void getCurrentWindow().close()
        return
      }
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

  // Cmd+Shift+O: Open Project
  useHotkeys(
    'mod+shift+o',
    () => {
      showProjectList()
    },
    DEFAULT_HOTKEY_OPTS
  )

  // F11: Toggle Full Screen (Windows and Linux; macOS uses the native menu's Ctrl+Cmd+F)
  useHotkeys(
    'f11',
    () => {
      const tauriWindow = getCurrentWindow()
      void tauriWindow
        .isFullscreen()
        .then(isFullscreen => tauriWindow.setFullscreen(!isFullscreen))
        .catch(error => {
          void logError(`Failed to toggle fullscreen: ${String(error)}`)
          toast.error('Failed to toggle fullscreen')
        })
    },
    {
      ...DEFAULT_HOTKEY_OPTS,
      enabled: platform === 'windows' || platform === 'linux',
    }
  )
}
