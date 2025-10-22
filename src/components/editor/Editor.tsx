import React, { useRef, useEffect, useState, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useEditorStore } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import { useProjectStore } from '../../store/projectStore'
import { useEditorSetup, useEditorHandlers } from '../../hooks/editor'
import { useImageHover } from '../../hooks/editor/useImageHover'
import { handleTauriFileDrop } from '../../lib/editor/dragdrop'
import { ImagePreview } from './ImagePreview'
import { altKeyEffect } from '../../lib/editor/urls'
import { toggleFocusMode } from '../../lib/editor/extensions/focus-mode'
import { toggleTypewriterMode } from '../../lib/editor/extensions/typewriter-mode'
import './Editor.css'
import '../../lib/editor/extensions/copyedit-mode.css'

// Extend window to include editor focus tracking
declare global {
  interface Window {
    isEditorFocused: boolean
  }
}

const EditorViewComponent: React.FC = () => {
  const currentFileId = useEditorStore(state => state.currentFile?.id)
  const currentFilePath = useEditorStore(state => state.currentFile?.path)
  const projectPath = useProjectStore(state => state.projectPath)
  const focusModeEnabled = useUIStore(state => state.focusModeEnabled)
  const typewriterModeEnabled = useUIStore(state => state.typewriterModeEnabled)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [isAltPressed, setIsAltPressed] = useState(false)
  const isProgrammaticUpdate = useRef(false)

  // Typing detection for distraction-free mode
  const typingCharCount = useRef(0)
  const typingResetTimeout = useRef<number | null>(null)

  // Initialize global focus flag (menu state managed in Layout)
  useEffect(() => {
    window.isEditorFocused = false
  }, [])

  const { handleChange, handleFocus, handleBlur, handleSave } =
    useEditorHandlers()

  const componentBuilderHandler = useCallback((view: EditorView) => {
    // Only open component builder for .mdx files
    const { currentFile } = useEditorStore.getState()
    if (currentFile?.path.endsWith('.mdx')) {
      useComponentBuilderStore.getState().open(view)
      return true // Indicates we handled the command
    }
    return false // Let CodeMirror handle it (insert comment)
  }, [])

  const { extensions, setupCommands, cleanupCommands } = useEditorSetup(
    handleSave,
    handleFocus,
    handleBlur,
    componentBuilderHandler
  )

  // Track hovered image URLs when Alt is pressed
  const hoveredImage = useImageHover(viewRef.current, isAltPressed)

  // Handle mode changes - use stable callback with getState() pattern
  const handleModeChange = useCallback(() => {
    // Get fresh values from store using getState() pattern per architecture guide
    const {
      focusModeEnabled: currentFocusMode,
      typewriterModeEnabled: currentTypewriterMode,
    } = useUIStore.getState()

    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [
          toggleFocusMode.of(currentFocusMode),
          toggleTypewriterMode.of(currentTypewriterMode),
        ],
      })
    }
  }, []) // Stable dependency array per architecture guide

  // Subscribe to mode changes using the stable callback
  useEffect(() => {
    handleModeChange()
  }, [handleModeChange, focusModeEnabled, typewriterModeEnabled])

  // Track Alt key state for URL highlighting - moved back to component for timing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !isAltPressed) {
        setIsAltPressed(true)
        if (viewRef.current) {
          viewRef.current.dispatch({
            effects: altKeyEffect.of(true),
          })
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey && isAltPressed) {
        setIsAltPressed(false)
        if (viewRef.current) {
          viewRef.current.dispatch({
            effects: altKeyEffect.of(false),
          })
        }
      }
    }

    // Handle window blur to reset Alt state
    const handleBlur = () => {
      setIsAltPressed(false)
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: altKeyEffect.of(false),
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isAltPressed])

  // Initialize the CodeMirror editor once
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return

    // Get current handlers - capture them at effect creation time
    const currentHandleChange = handleChange
    const currentSetupCommands = setupCommands
    const currentCleanupCommands = cleanupCommands

    // Get initial content directly from store, not from subscription
    const { editorContent } = useEditorStore.getState()

    const startState = EditorState.create({
      doc: editorContent,
      extensions: [
        ...extensions,
        EditorView.updateListener.of(update => {
          if (update.docChanged && !isProgrammaticUpdate.current) {
            const newContent = update.state.doc.toString()
            // Use captured handler to avoid infinite loops
            currentHandleChange(newContent)

            // Typing detection for distraction-free mode
            typingCharCount.current++

            // Clear existing timeout
            if (typingResetTimeout.current) {
              clearTimeout(typingResetTimeout.current)
            }

            // Reset counter after 500ms of no typing
            typingResetTimeout.current = window.setTimeout(() => {
              typingCharCount.current = 0
            }, 500)

            // Hide bars after 4 characters using getState() pattern
            if (typingCharCount.current >= 4) {
              useUIStore.getState().handleTypingInEditor()
              typingCharCount.current = 0
            }
          }
        }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    })

    viewRef.current = view

    // Set up commands once the view is ready
    currentSetupCommands(view)

    // Set up Tauri event listeners now that view is ready
    let unlistenDrop: UnlistenFn | null = null
    const setupTauriListeners = async () => {
      try {
        unlistenDrop = await listen('tauri://drag-drop', event => {
          void handleTauriFileDrop(event.payload, view)
        })
      } catch (error) {
        // Ignore errors in setting up Tauri listeners
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Failed to setup Tauri drag-drop listener:', error)
        }
      }
    }
    void setupTauriListeners()

    return () => {
      view.destroy()
      viewRef.current = null
      currentCleanupCommands()

      // Clean up Tauri listeners
      if (unlistenDrop) {
        unlistenDrop()
      }

      // Clean up typing detection timeout
      if (typingResetTimeout.current) {
        clearTimeout(typingResetTimeout.current)
        typingResetTimeout.current = null
      }
    }
    // CRITICAL: Empty dependency array - only create once!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load content when file changes (not on every content update)
  useEffect(() => {
    if (!viewRef.current || !currentFileId) return

    // Get content directly from store when file changes
    const { editorContent } = useEditorStore.getState()

    if (viewRef.current.state.doc.toString() !== editorContent) {
      // Mark this as a programmatic update to prevent triggering the update listener
      isProgrammaticUpdate.current = true

      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: editorContent,
        },
      })

      // Reset the flag after the update is complete
      setTimeout(() => {
        isProgrammaticUpdate.current = false
      }, 0)
    }
  }, [currentFileId]) // Only trigger when file changes, not on content changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCommands()
    }
  }, [cleanupCommands])

  return (
    <div className="editor-view" style={{ padding: '0 24px' }}>
      <div
        ref={editorRef}
        className={`editor-codemirror ${isAltPressed ? 'alt-pressed' : ''} ${typewriterModeEnabled ? 'typewriter-mode' : ''}`}
        data-editor-container
      />
      {projectPath && (
        <ImagePreview
          hoveredImage={hoveredImage}
          projectPath={projectPath}
          currentFilePath={currentFilePath || null}
        />
      )}
    </div>
  )
}

// PERFORMANCE FIX: Memoize Editor to prevent re-renders when editorContent changes
// Only re-render when UI state actually changes, not on every keystroke
const MemoizedEditor = React.memo(EditorViewComponent, () => {
  // Custom comparison - Editor has no props, so always equal unless React forces update
  return true
})

export { MemoizedEditor as EditorViewComponent }
