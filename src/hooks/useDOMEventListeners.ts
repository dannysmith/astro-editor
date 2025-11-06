import { useEffect, useRef } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { updateCopyeditModePartsOfSpeech } from '../lib/editor/extensions/copyedit-mode'

type PartOfSpeech =
  | 'nouns'
  | 'verbs'
  | 'adjectives'
  | 'adverbs'
  | 'conjunctions'

const PARTS_OF_SPEECH: PartOfSpeech[] = [
  'nouns',
  'verbs',
  'adjectives',
  'adverbs',
  'conjunctions',
]

/**
 * Handles custom DOM events for UI interactions.
 *
 * Events handled:
 * - 'create-new-file': Creates a new file (still needed for keyboard shortcuts)
 * - 'open-preferences': Opens the preferences dialog
 * - Parts-of-speech highlight toggles for copyedit mode
 * - 'toggle-all-highlights': Toggles all highlights on/off
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

  // Focus mode and typewriter mode, parts-of-speech highlighting, and file-opened event
  useEffect(() => {
    const handleToggleFocusMode = () => {
      useUIStore.getState().toggleFocusMode()
    }

    const handleToggleTypewriterMode = () => {
      useUIStore.getState().toggleTypewriterMode()
    }

    const handleToggleHighlight = (partOfSpeech: PartOfSpeech) => {
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
          defaultFileType: globalSettings?.general?.defaultFileType || 'md',
        },
      }

      void updateGlobalSettings(newSettings).then(() => {
        setTimeout(() => {
          updateCopyeditModePartsOfSpeech()
        }, 50)
      })
    }

    const handleToggleAllHighlights = () => {
      const { globalSettings, updateGlobalSettings } =
        useProjectStore.getState()
      const highlights = globalSettings?.general?.highlights || {}

      const anyEnabled = Object.values(highlights).some(enabled => enabled)
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
          defaultFileType: globalSettings?.general?.defaultFileType || 'md',
        },
      }

      void updateGlobalSettings(newSettings).then(() => {
        setTimeout(() => {
          updateCopyeditModePartsOfSpeech()
        }, 50)
      })
    }

    const handleFileOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ collectionName: string }>
      const { collectionName } = customEvent.detail
      const { selectedCollection } = useProjectStore.getState()

      if (selectedCollection !== collectionName) {
        useProjectStore.getState().setSelectedCollection(collectionName)
      }
    }

    // Register focus and typewriter mode listeners
    window.addEventListener('toggle-focus-mode', handleToggleFocusMode)
    window.addEventListener(
      'toggle-typewriter-mode',
      handleToggleTypewriterMode
    )

    // Generate and register part-of-speech toggle handlers
    const partOfSpeechHandlers = PARTS_OF_SPEECH.map(pos => {
      const handler = () => handleToggleHighlight(pos)
      window.addEventListener(`toggle-highlight-${pos}`, handler)
      return { event: `toggle-highlight-${pos}`, handler }
    })

    window.addEventListener('toggle-all-highlights', handleToggleAllHighlights)
    window.addEventListener('file-opened', handleFileOpened)

    return () => {
      window.removeEventListener('toggle-focus-mode', handleToggleFocusMode)
      window.removeEventListener(
        'toggle-typewriter-mode',
        handleToggleTypewriterMode
      )
      partOfSpeechHandlers.forEach(({ event, handler }) => {
        window.removeEventListener(event, handler)
      })
      window.removeEventListener(
        'toggle-all-highlights',
        handleToggleAllHighlights
      )
      window.removeEventListener('file-opened', handleFileOpened)
    }
  }, [])
}
