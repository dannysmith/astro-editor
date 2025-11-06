import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { globalCommandRegistry } from '../lib/editor/commands'
import { openProjectViaDialog } from '../lib/projects/actions'
import type { HeadingLevel } from '../lib/editor/markdown/types'

/**
 * Format menu event mapping for reducing duplication.
 * Maps event names to command names and optional arguments.
 */
type FormatCommand =
  | { command: 'toggleBold' | 'toggleItalic' | 'createLink' }
  | { command: 'formatHeading'; level: HeadingLevel }

const FORMAT_EVENT_MAP: Record<string, FormatCommand> = {
  'menu-format-bold': { command: 'toggleBold' },
  'menu-format-italic': { command: 'toggleItalic' },
  'menu-format-link': { command: 'createLink' },
  'menu-format-h1': { command: 'formatHeading', level: 1 as HeadingLevel },
  'menu-format-h2': { command: 'formatHeading', level: 2 as HeadingLevel },
  'menu-format-h3': { command: 'formatHeading', level: 3 as HeadingLevel },
  'menu-format-h4': { command: 'formatHeading', level: 4 as HeadingLevel },
  'menu-format-paragraph': {
    command: 'formatHeading',
    level: 0 as HeadingLevel,
  },
}

/**
 * Handles all Tauri menu events from the native macOS menu bar.
 *
 * Includes file operations, view toggles, formatting commands, and preferences.
 * Format menu events are handled via a map-based approach to reduce duplication.
 */
export function useMenuEvents(
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

  // Set up listeners once on mount, use refs for callbacks
  useEffect(() => {
    const unlistenFunctions: Array<() => void> = []

    const setupListeners = async () => {
      // File operations
      const fileUnlisteners = await Promise.all([
        listen('menu-open-project', () => {
          void openProjectViaDialog()
        }),
        listen('menu-save', () => {
          const { currentFile, isDirty, saveFile } = useEditorStore.getState()
          if (currentFile && isDirty) {
            void saveFile()
          }
        }),
        listen('menu-new-file', () => {
          const { selectedCollection } = useProjectStore.getState()
          if (selectedCollection) {
            void createFileRef.current()
          }
        }),
      ])

      // View operations
      const viewUnlisteners = await Promise.all([
        listen('menu-toggle-sidebar', () => {
          useUIStore.getState().toggleSidebar()
        }),
        listen('menu-toggle-frontmatter', () => {
          useUIStore.getState().toggleFrontmatterPanel()
        }),
      ])

      // Format operations (using map-based approach)
      const formatUnlisteners = await Promise.all(
        Object.entries(FORMAT_EVENT_MAP).map(([eventName, formatCmd]) =>
          listen(eventName, () => {
            const { currentFile } = useEditorStore.getState()
            if (currentFile) {
              if (formatCmd.command === 'formatHeading') {
                globalCommandRegistry.execute('formatHeading', formatCmd.level)
              } else {
                globalCommandRegistry.execute(formatCmd.command)
              }
            }
          })
        )
      )

      // Preferences
      const preferencesUnlistener = await listen('menu-preferences', () => {
        openPreferencesRef.current(true)
      })

      unlistenFunctions.push(
        ...fileUnlisteners,
        ...viewUnlisteners,
        ...formatUnlisteners,
        preferencesUnlistener
      )
    }

    void setupListeners()

    return () => {
      unlistenFunctions.forEach(unlisten => {
        if (unlisten && typeof unlisten === 'function') {
          unlisten()
        }
      })
    }
  }, []) // Empty deps - set up once on mount, use refs for callbacks
}
