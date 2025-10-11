import { useEffect, useState, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { globalCommandRegistry } from '../lib/editor/commands'
import { toast } from '../lib/toast'
import { initializeRustToastBridge } from '../lib/rust-toast-bridge'
import { focusEditor } from '../lib/focus-utils'
import { useCreateFile } from './useCreateFile'
import { updateCopyeditModePartsOfSpeech } from '../lib/editor/extensions/copyedit-mode'

export function useLayoutEventListeners() {
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  // Only subscribe to data that triggers re-renders (none in this case)
  // Use getState() pattern for all store access in callbacks
  const { createNewFile: createNewFileWithQuery } = useCreateFile()

  // Custom setPreferencesOpen that returns focus to editor when closed
  const handleSetPreferencesOpen = useCallback((open: boolean) => {
    setPreferencesOpen(open)
    if (!open) {
      // Return focus to editor when preferences are closed
      setTimeout(() => {
        focusEditor()
      }, 100) // Small delay to allow dialog to fully close
    }
  }, [])

  // Update format menu state based on editor focus and file presence
  useEffect(() => {
    const { currentFile } = useEditorStore.getState()
    const shouldEnableMenu = Boolean(currentFile && window.isEditorFocused)
    void invoke('update_format_menu_state', { enabled: shouldEnableMenu })
  })

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

  // Keyboard shortcuts
  useHotkeys(
    'mod+s',
    () => {
      // Cmd+S: Save File - get isDirty directly to avoid subscription
      const { currentFile, isDirty, saveFile } = useEditorStore.getState()
      if (currentFile && isDirty) {
        void saveFile()
      }
    },
    { preventDefault: true }
  )

  useHotkeys(
    'mod+1',
    () => {
      // Cmd+1: Toggle Sidebar
      useUIStore.getState().toggleSidebar()
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+2',
    () => {
      // Cmd+2: Toggle Frontmatter Panel
      useUIStore.getState().toggleFrontmatterPanel()
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+n',
    () => {
      // Cmd+N: Create New File (only if a collection is selected)
      const { selectedCollection } = useProjectStore.getState()
      if (selectedCollection) {
        // Use DOM event system to trigger the existing listener
        window.dispatchEvent(new CustomEvent('create-new-file'))
        // Fix for cursor disappearing - ensure cursor is visible
        document.body.style.cursor = 'auto'
        // Force a reflow to ensure the cursor change is applied
        void document.body.offsetHeight
      }
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    }
  )

  useHotkeys(
    'mod+w',
    () => {
      // Cmd+W: Close Current File (only if a file is open)
      const { currentFile, closeCurrentFile } = useEditorStore.getState()
      if (currentFile) {
        closeCurrentFile()
      }
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+comma',
    () => {
      // Cmd+,: Open Preferences
      handleSetPreferencesOpen(true)
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+0',
    () => {
      // Cmd+0: Focus main editor
      focusEditor()
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in all contexts
    }
  )

  // DOM event listeners for menu actions
  useEffect(() => {
    const handleOpenPreferences = () => {
      handleSetPreferencesOpen(true)
    }

    window.addEventListener('open-preferences', handleOpenPreferences)
    return () =>
      window.removeEventListener('open-preferences', handleOpenPreferences)
  }, [handleSetPreferencesOpen])

  useEffect(() => {
    const handleCreateNewFile = () => {
      void createNewFileWithQuery()
    }

    window.addEventListener('create-new-file', handleCreateNewFile)
    return () =>
      window.removeEventListener('create-new-file', handleCreateNewFile)
  }, [createNewFileWithQuery])

  // Focus mode and typewriter mode event listeners
  useEffect(() => {
    const handleToggleFocusMode = () => {
      useUIStore.getState().toggleFocusMode()
    }

    const handleToggleTypewriterMode = () => {
      useUIStore.getState().toggleTypewriterMode()
    }

    const handleToggleHighlight = (
      partOfSpeech:
        | 'nouns'
        | 'verbs'
        | 'adjectives'
        | 'adverbs'
        | 'conjunctions'
    ) => {
      const { globalSettings, updateGlobalSettings } =
        useProjectStore.getState()
      const currentValue =
        globalSettings?.general?.highlights?.[partOfSpeech] ?? true

      const newSettings = {
        general: {
          ideCommand: globalSettings?.general?.ideCommand || '',
          theme: globalSettings?.general?.theme || 'system',
          highlights: {
            nouns: globalSettings?.general?.highlights?.nouns ?? true,
            verbs: globalSettings?.general?.highlights?.verbs ?? true,
            adjectives: globalSettings?.general?.highlights?.adjectives ?? true,
            adverbs: globalSettings?.general?.highlights?.adverbs ?? true,
            conjunctions:
              globalSettings?.general?.highlights?.conjunctions ?? true,
            [partOfSpeech]: !currentValue,
          },
          autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
        },
      }

      void updateGlobalSettings(newSettings).then(() => {
        // Add a small delay to let any pending edits complete before re-analyzing
        setTimeout(() => {
          updateCopyeditModePartsOfSpeech()
        }, 50)
      })
    }

    const handleToggleAllHighlights = () => {
      const { globalSettings, updateGlobalSettings } =
        useProjectStore.getState()
      const highlights = globalSettings?.general?.highlights || {}

      // Check if any are currently enabled
      const anyEnabled = Object.values(highlights).some(enabled => enabled)

      // If any are enabled, turn all off; otherwise turn all on
      const newValue = !anyEnabled

      const newSettings = {
        general: {
          ideCommand: globalSettings?.general?.ideCommand || '',
          theme: globalSettings?.general?.theme || 'system',
          highlights: {
            nouns: newValue,
            verbs: newValue,
            adjectives: newValue,
            adverbs: newValue,
            conjunctions: newValue,
          },
          autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
        },
      }

      void updateGlobalSettings(newSettings).then(() => {
        // Add a small delay to let any pending edits complete before re-analyzing
        setTimeout(() => {
          updateCopyeditModePartsOfSpeech()
        }, 50)
      })
    }

    const handleFileOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ collectionName: string }>
      const { collectionName } = customEvent.detail
      const { selectedCollection } = useProjectStore.getState()

      // Only update the selected collection if it's actually changing
      // This prevents resetting currentSubdirectory when opening a file in the same collection
      if (selectedCollection !== collectionName) {
        useProjectStore.getState().setSelectedCollection(collectionName)
      }
    }

    window.addEventListener('toggle-focus-mode', handleToggleFocusMode)
    window.addEventListener(
      'toggle-typewriter-mode',
      handleToggleTypewriterMode
    )
    const handleToggleHighlightNouns = () => handleToggleHighlight('nouns')
    const handleToggleHighlightVerbs = () => handleToggleHighlight('verbs')
    const handleToggleHighlightAdjectives = () =>
      handleToggleHighlight('adjectives')
    const handleToggleHighlightAdverbs = () => handleToggleHighlight('adverbs')
    const handleToggleHighlightConjunctions = () =>
      handleToggleHighlight('conjunctions')

    window.addEventListener(
      'toggle-highlight-nouns',
      handleToggleHighlightNouns
    )
    window.addEventListener(
      'toggle-highlight-verbs',
      handleToggleHighlightVerbs
    )
    window.addEventListener(
      'toggle-highlight-adjectives',
      handleToggleHighlightAdjectives
    )
    window.addEventListener(
      'toggle-highlight-adverbs',
      handleToggleHighlightAdverbs
    )
    window.addEventListener(
      'toggle-highlight-conjunctions',
      handleToggleHighlightConjunctions
    )
    window.addEventListener('toggle-all-highlights', handleToggleAllHighlights)
    window.addEventListener('file-opened', handleFileOpened)

    return () => {
      window.removeEventListener('toggle-focus-mode', handleToggleFocusMode)
      window.removeEventListener(
        'toggle-typewriter-mode',
        handleToggleTypewriterMode
      )
      window.removeEventListener(
        'toggle-highlight-nouns',
        handleToggleHighlightNouns
      )
      window.removeEventListener(
        'toggle-highlight-verbs',
        handleToggleHighlightVerbs
      )
      window.removeEventListener(
        'toggle-highlight-adjectives',
        handleToggleHighlightAdjectives
      )
      window.removeEventListener(
        'toggle-highlight-adverbs',
        handleToggleHighlightAdverbs
      )
      window.removeEventListener(
        'toggle-highlight-conjunctions',
        handleToggleHighlightConjunctions
      )
      window.removeEventListener(
        'toggle-all-highlights',
        handleToggleAllHighlights
      )
      window.removeEventListener('file-opened', handleFileOpened)
    }
  }, [])

  // Load persisted project on mount
  useEffect(() => {
    void useProjectStore.getState().loadPersistedProject()
  }, [])

  // Initialize Rust toast bridge
  useEffect(() => {
    let cleanup: (() => void) | undefined

    void initializeRustToastBridge().then(unlisten => {
      cleanup = unlisten
    })

    return () => {
      cleanup?.()
    }
  }, [])

  // Tauri event listeners for menu actions
  useEffect(() => {
    const handleOpenProject = async () => {
      try {
        const projectPath = await invoke<string>('select_project_folder')
        if (projectPath) {
          useProjectStore.getState().setProject(projectPath)
          toast.success('Project opened successfully')
        }
      } catch (error) {
        toast.error('Failed to open project', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Failed to open project:', error)
        }
      }
    }

    // Store all unlisten functions for cleanup
    const unlistenFunctions: Array<() => void> = []

    // Set up all listeners asynchronously
    const setupListeners = async () => {
      const unlisteners = await Promise.all([
        listen('menu-open-project', () => {
          void handleOpenProject()
        }),
        listen('menu-save', () => {
          const { currentFile, isDirty, saveFile } = useEditorStore.getState()
          if (currentFile && isDirty) {
            void saveFile()
          }
        }),
        listen('menu-toggle-sidebar', () => {
          useUIStore.getState().toggleSidebar()
        }),
        listen('menu-toggle-frontmatter', () => {
          useUIStore.getState().toggleFrontmatterPanel()
        }),
        listen('menu-new-file', () => {
          const { selectedCollection } = useProjectStore.getState()
          if (selectedCollection) {
            void createNewFileWithQuery()
          }
        }),
        // Text formatting menu listeners
        listen('menu-format-bold', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('toggleBold')
          }
        }),
        listen('menu-format-italic', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('toggleItalic')
          }
        }),
        listen('menu-format-link', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('createLink')
          }
        }),
        listen('menu-format-h1', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 1)
          }
        }),
        listen('menu-format-h2', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 2)
          }
        }),
        listen('menu-format-h3', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 3)
          }
        }),
        listen('menu-format-h4', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 4)
          }
        }),
        listen('menu-format-paragraph', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 0)
          }
        }),
        listen('menu-preferences', () => {
          handleSetPreferencesOpen(true)
        }),
      ])

      // Add all unlisteners to the array
      unlistenFunctions.push(...unlisteners)
    }

    // Set up listeners
    void setupListeners()

    return () => {
      // Call all unlisten functions
      unlistenFunctions.forEach(unlisten => {
        if (unlisten && typeof unlisten === 'function') {
          unlisten()
        }
      })
    }
  }, [createNewFileWithQuery, handleSetPreferencesOpen])

  return {
    preferencesOpen,
    setPreferencesOpen: handleSetPreferencesOpen,
  }
}
