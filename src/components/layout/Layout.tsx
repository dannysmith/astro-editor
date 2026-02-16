import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '../../store/uiStore'
import { useTheme } from '../../lib/theme-provider'
import { useProjectStore } from '../../store/projectStore'
import { UnifiedTitleBar } from './unified-title-bar'
import { LeftSidebar } from './LeftSidebar'
import { MainEditor } from './MainEditor'
import { RightSidebar } from './RightSidebar'
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
import { useSquareCornersEffect } from '../../hooks/useSquareCornersEffect'
import { useEditorStore } from '../../store/editorStore'
import { focusEditor } from '../../lib/focus-utils'
import { LAYOUT_SIZES } from '../../lib/layout-constants'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type PanelImperativeHandle,
} from '../ui/resizable'

export const Layout: React.FC = () => {
  // UI state - use selector syntax for consistency
  const sidebarVisible = useUIStore(state => state.sidebarVisible)
  const frontmatterPanelVisible = useUIStore(
    state => state.frontmatterPanelVisible
  )

  const { setTheme } = useTheme()

  // Extract specific nested values for useEffect dependencies
  const theme = useProjectStore(state => state.globalSettings?.general?.theme)
  const headingColor = useProjectStore(
    useShallow(state => state.globalSettings?.appearance?.headingColor) // headingColor is an object with .light and .dark
  )
  const editorBaseFontSize = useProjectStore(
    state => state.globalSettings?.appearance?.editorBaseFontSize
  )

  const [preferencesOpen, setPreferencesOpen] = useState(false)

  // Panel refs for imperative collapse/expand control
  const leftPanelRef = useRef<PanelImperativeHandle>(null)
  const rightPanelRef = useRef<PanelImperativeHandle>(null)

  // Sync sidebar visibility with panel collapse state
  useEffect(() => {
    if (sidebarVisible) {
      leftPanelRef.current?.expand()
    } else {
      leftPanelRef.current?.collapse()
    }
  }, [sidebarVisible])

  useEffect(() => {
    if (frontmatterPanelVisible) {
      rightPanelRef.current?.expand()
    } else {
      rightPanelRef.current?.collapse()
    }
  }, [frontmatterPanelVisible])

  // Sync drag-to-collapse back to the store
  const handleLeftPanelResize = useCallback(
    (size: { asPercentage: number }) => {
      const isCollapsed = size.asPercentage === 0
      const { sidebarVisible: current, setSidebarVisible } =
        useUIStore.getState()
      if (isCollapsed && current) setSidebarVisible(false)
      if (!isCollapsed && !current) setSidebarVisible(true)
    },
    []
  )

  const handleRightPanelResize = useCallback(
    (size: { asPercentage: number }) => {
      const isCollapsed = size.asPercentage === 0
      const { frontmatterPanelVisible: current, setFrontmatterPanelVisible } =
        useUIStore.getState()
      if (isCollapsed && current) setFrontmatterPanelVisible(false)
      if (!isCollapsed && !current) setFrontmatterPanelVisible(true)
    },
    []
  )

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
    return () => {
      useEditorStore.getState().setAutoSaveCallback(null)
    }
  }, [saveFile])

  // Compose all decomposed hooks
  useProjectInitialization()
  useRustToastBridge()
  useEditorFocusTracking()
  useKeyboardShortcuts(handleSetPreferencesOpen)
  useMenuEvents(createNewFileWithQuery, handleSetPreferencesOpen)
  useSquareCornersEffect()
  useDOMEventListeners(createNewFileWithQuery, handleSetPreferencesOpen)

  // Enable query-based file loading
  useEditorFileContent()

  // Enable file change detection
  useFileChangeHandler()

  // Sync stored theme preference with theme provider on app load
  useEffect(() => {
    if (theme) {
      setTheme(theme)
    }
  }, [theme, setTheme])

  // Update heading color CSS variables when appearance settings change
  useEffect(() => {
    const root = window.document.documentElement
    const isDark = root.classList.contains('dark')

    if (headingColor) {
      const color = isDark ? headingColor.dark : headingColor.light
      root.style.setProperty('--editor-color-heading', color)
    }
  }, [headingColor])

  // Also update heading color when theme changes (system theme changes)
  useEffect(() => {
    const root = window.document.documentElement

    if (headingColor) {
      const observer = new MutationObserver(() => {
        const isDark = root.classList.contains('dark')
        const color = isDark ? headingColor.dark : headingColor.light
        root.style.setProperty('--editor-color-heading', color)
      })

      observer.observe(root, { attributes: true, attributeFilter: ['class'] })

      return () => observer.disconnect()
    }
  }, [headingColor])

  // Apply editor base font size CSS variable
  useEffect(() => {
    const root = window.document.documentElement
    const size = editorBaseFontSize ?? 18
    root.style.setProperty('--editor-base-font-size', `${size}px`)
  }, [editorBaseFontSize])

  return (
    <div className="h-screen w-screen bg-[var(--editor-color-background)] flex flex-col overflow-hidden">
      <UnifiedTitleBar />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full"
          autoSaveId="astro-editor-layout"
        >
          <ResizablePanel
            id="left-sidebar"
            panelRef={leftPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize={LAYOUT_SIZES.leftSidebar.default}
            minSize={LAYOUT_SIZES.leftSidebar.min}
            maxSize={LAYOUT_SIZES.leftSidebar.max}
            style={{
              minWidth: sidebarVisible
                ? LAYOUT_SIZES.leftSidebar.minWidth
                : undefined,
            }}
            onResize={handleLeftPanelResize}
          >
            <LeftSidebar />
          </ResizablePanel>
          <ResizableHandle
            className={`!cursor-col-resize ${sidebarVisible ? '' : 'hidden'}`}
          />

          <ResizablePanel
            id="main-editor"
            defaultSize={LAYOUT_SIZES.mainEditor.default}
            minSize={LAYOUT_SIZES.mainEditor.min}
          >
            <MainEditor />
          </ResizablePanel>

          <ResizableHandle
            className={`!cursor-col-resize ${frontmatterPanelVisible ? '' : 'hidden'}`}
          />
          <ResizablePanel
            id="right-sidebar"
            panelRef={rightPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize={LAYOUT_SIZES.rightSidebar.default}
            minSize={LAYOUT_SIZES.rightSidebar.min}
            maxSize={LAYOUT_SIZES.rightSidebar.max}
            onResize={handleRightPanelResize}
          >
            <RightSidebar>
              <FrontmatterPanel />
            </RightSidebar>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

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
