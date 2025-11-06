import React, { useEffect, useState, useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useTheme } from '../../lib/theme-provider'
import { useProjectStore } from '../../store/projectStore'
import { UnifiedTitleBar } from './UnifiedTitleBar'
import { LeftSidebar } from './LeftSidebar'
import { MainEditor } from './MainEditor'
import { RightSidebar } from './RightSidebar'
import { StatusBar } from './StatusBar'
import { FrontmatterPanel } from '../frontmatter'
import { CommandPalette } from '../command-palette'
import { ComponentBuilderDialog } from '../component-builder'
import { Toaster } from '../ui/sonner'
import { PreferencesDialog } from '../preferences'
import { useProjectInitialization } from '../../hooks/useProjectInitialization'
import { useRustToastBridge } from '../../hooks/useRustToastBridge'
import { useEditorFocusTracking } from '../../hooks/useEditorFocusTracking'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useMenuEvents } from '../../hooks/useMenuEvents'
import { useDOMEventListeners } from '../../hooks/useDOMEventListeners'
import { useEditorFileContent } from '../../hooks/useEditorFileContent'
import { useFileChangeHandler } from '../../hooks/useFileChangeHandler'
import { useEditorActions } from '../../hooks/editor/useEditorActions'
import { useCreateFile } from '../../hooks/useCreateFile'
import { useEditorStore } from '../../store/editorStore'
import { focusEditor } from '../../lib/focus-utils'
import { LAYOUT_SIZES } from '../../lib/layout-constants'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../ui/resizable'

export const Layout: React.FC = () => {
  const { sidebarVisible, frontmatterPanelVisible } = useUIStore()
  const { setTheme } = useTheme()
  const { globalSettings } = useProjectStore()

  // Preferences state management
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  const handleSetPreferencesOpen = useCallback((open: boolean) => {
    setPreferencesOpen(open)
    if (!open) {
      setTimeout(() => {
        focusEditor()
      }, 100)
    }
  }, [])

  // Get editor actions (Hybrid Action Hooks pattern)
  const { saveFile } = useEditorActions()
  const { createNewFile: createNewFileWithQuery } = useCreateFile()

  // Register auto-save callback with store
  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(saveFile)
  }, [saveFile])

  // Compose all decomposed hooks
  useProjectInitialization()
  useRustToastBridge()
  useEditorFocusTracking()
  useKeyboardShortcuts(handleSetPreferencesOpen)
  useMenuEvents(createNewFileWithQuery, handleSetPreferencesOpen)
  useDOMEventListeners(createNewFileWithQuery, handleSetPreferencesOpen)

  // Enable query-based file loading
  useEditorFileContent()

  // Enable file change detection
  useFileChangeHandler()

  // Sync stored theme preference with theme provider on app load
  useEffect(() => {
    const storedTheme = globalSettings?.general?.theme
    if (storedTheme) {
      setTheme(storedTheme)
    }
  }, [globalSettings?.general?.theme, setTheme])

  // Update heading color CSS variables when appearance settings change
  useEffect(() => {
    const root = window.document.documentElement
    const isDark = root.classList.contains('dark')
    const headingColors = globalSettings?.appearance?.headingColor

    if (headingColors) {
      const color = isDark ? headingColors.dark : headingColors.light
      root.style.setProperty('--editor-color-heading', color)
    }
  }, [globalSettings?.appearance?.headingColor])

  // Also update heading color when theme changes (system theme changes)
  useEffect(() => {
    const root = window.document.documentElement
    const headingColors = globalSettings?.appearance?.headingColor

    if (headingColors) {
      const observer = new MutationObserver(() => {
        const isDark = root.classList.contains('dark')
        const color = isDark ? headingColors.dark : headingColors.light
        root.style.setProperty('--editor-color-heading', color)
      })

      observer.observe(root, { attributes: true, attributeFilter: ['class'] })

      return () => observer.disconnect()
    }
  }, [globalSettings?.appearance?.headingColor])

  return (
    <div className="h-screen w-screen bg-[var(--editor-color-background)] flex flex-col rounded-xl overflow-hidden">
      {/* Unified titlebar */}
      <UnifiedTitleBar />

      {/* Main content area with three-panel layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Sidebar */}
          <ResizablePanel
            defaultSize={sidebarVisible ? LAYOUT_SIZES.leftSidebar.default : 0}
            minSize={sidebarVisible ? LAYOUT_SIZES.leftSidebar.min : 0}
            maxSize={sidebarVisible ? LAYOUT_SIZES.leftSidebar.max : 0}
            className={`min-w-[${LAYOUT_SIZES.leftSidebar.minWidth}] ${sidebarVisible ? '' : 'hidden'}`}
          >
            <LeftSidebar />
          </ResizablePanel>
          <ResizableHandle
            className={`!cursor-col-resize ${sidebarVisible ? '' : 'hidden'}`}
          />

          {/* Main Editor */}
          <ResizablePanel
            defaultSize={LAYOUT_SIZES.mainEditor.getDefault(
              sidebarVisible,
              frontmatterPanelVisible
            )}
            minSize={LAYOUT_SIZES.mainEditor.min}
          >
            <MainEditor />
          </ResizablePanel>

          {/* Right Sidebar */}
          <ResizableHandle
            className={`!cursor-col-resize ${frontmatterPanelVisible ? '' : 'hidden'}`}
          />
          <ResizablePanel
            defaultSize={
              frontmatterPanelVisible ? LAYOUT_SIZES.rightSidebar.default : 0
            }
            minSize={
              frontmatterPanelVisible ? LAYOUT_SIZES.rightSidebar.min : 0
            }
            maxSize={
              frontmatterPanelVisible ? LAYOUT_SIZES.rightSidebar.max : 0
            }
            className={frontmatterPanelVisible ? '' : 'hidden'}
          >
            <RightSidebar>
              <FrontmatterPanel />
            </RightSidebar>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Status Bar - fixed at bottom */}
      <StatusBar />

      {/* Floating components */}
      <CommandPalette />
      <ComponentBuilderDialog />
      <PreferencesDialog
        open={preferencesOpen}
        onOpenChange={handleSetPreferencesOpen}
      />
      <Toaster />
    </div>
  )
}
