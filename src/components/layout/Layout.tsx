import React, { useEffect, useState, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '../../store/uiStore'
import { useTheme } from '../../lib/theme-provider'
import { useProjectStore } from '../../store/projectStore'
import { UnifiedTitleBar } from './unified-title-bar'
import { LeftSidebar } from './LeftSidebar'
import { MainEditor } from './MainEditor'
import { RightSidebar } from './RightSidebar'
import { CommandPalette } from '../command-palette'
import { ComponentBuilderDialog } from '../component-builder'
import { ContentLinkerDialog } from '../content-linker'
import { ProjectListDialog } from '../project-list'
import { ProjectSettingsDialog } from '../project-settings'
import { Toaster } from '../ui/sonner'
import { PreferencesDialog } from '../preferences'
import { AgentBridge } from '../agent-bridge'
import { useProjectInitialization } from '../../hooks/useProjectInitialization'
import { useRustToastBridge } from '../../hooks/useRustToastBridge'
import { useEditorFocusTracking } from '../../hooks/useEditorFocusTracking'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useMenuEvents } from '../../hooks/useMenuEvents'
import { useDOMEventListeners } from '../../hooks/useDOMEventListeners'
import { useEditorFileContent } from '../../hooks/useEditorFileContent'
import { useFileChangeHandler } from '../../hooks/useFileChangeHandler'
import { useSaveOnQuit } from '../../hooks/useSaveOnQuit'
import { useEditorActions } from '../../hooks/editor/useEditorActions'
import { useCreateFile } from '../../hooks/useCreateFile'
import { useDeepLink } from '../../hooks/useDeepLink'
import { useSquareCornersEffect } from '../../hooks/useSquareCornersEffect'
import { useColourTheme } from '../../hooks/useColourTheme'
import { useExternalLinkHandler } from '../../hooks/useExternalLinkHandler'
import { useEditorStore } from '../../store/editorStore'
import { focusEditor } from '../../lib/focus-utils'
import { commands } from '../../lib/bindings'
import { getPlatform } from '../../hooks/usePlatform'
import { LAYOUT_SIZES } from '../../lib/layout-constants'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type PanelImperativeHandle,
} from '../ui/resizable'

export const Layout: React.FC = () => {
  // UI state - use selector syntax for consistency
  const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)
  const rightSidebarVisible = useUIStore(state => state.rightSidebarVisible)

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
    if (leftSidebarVisible) {
      leftPanelRef.current?.expand()
    } else {
      leftPanelRef.current?.collapse()
    }
  }, [leftSidebarVisible])

  useEffect(() => {
    if (rightSidebarVisible) {
      rightPanelRef.current?.expand()
    } else {
      rightPanelRef.current?.collapse()
    }
  }, [rightSidebarVisible])

  // Sync drag-to-collapse back to the store
  const handleLeftPanelResize = useCallback(
    (size: { asPercentage: number }) => {
      const isCollapsed = size.asPercentage === 0
      const { leftSidebarVisible: current, setLeftSidebarVisible } =
        useUIStore.getState()
      if (isCollapsed && current) setLeftSidebarVisible(false)
      if (!isCollapsed && !current) setLeftSidebarVisible(true)
    },
    []
  )

  // Whether the right sidebar has width. Its panels are shown from this rather
  // than rightSidebarVisible, which changes a render before the panel expands:
  // a panel shown then would measure itself (textarea heights, scrolling to an
  // item) at zero width
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState(
    () => useUIStore.getState().rightSidebarVisible
  )

  const handleRightPanelResize = useCallback(
    (size: { asPercentage: number }) => {
      const isCollapsed = size.asPercentage === 0
      // Synchronously, before the browser paints (this runs in a
      // ResizeObserver callback). A panel hidden with <Activity> doesn't follow
      // the stores, and a sync render brings it up to date as it's shown;
      // otherwise it shows the previous file's values for a moment
      flushSync(() => {
        setRightSidebarExpanded(!isCollapsed)
      })
      const { rightSidebarVisible: current, setRightSidebarVisible } =
        useUIStore.getState()
      if (isCollapsed && current) setRightSidebarVisible(false)
      if (!isCollapsed && !current) setRightSidebarVisible(true)
    },
    []
  )

  const handleSetPreferencesOpen = useCallback((open: boolean) => {
    setPreferencesOpen(open)
    if (!open) {
      setTimeout(() => {
        // Not when Preferences closed to open Project Settings, which would
        // lose focus to the editor behind it
        if (!useUIStore.getState().projectSettingsOpen) focusEditor()
      }, 100)
    }
  }, [])

  // Get editor actions (Hybrid Action Hooks pattern)
  const { saveFile, openFileByPath } = useEditorActions()
  const { createNewFile: createNewFileWithQuery } = useCreateFile()

  // Register auto-save callback with store
  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(saveFile)
    return () => {
      useEditorStore.getState().setAutoSaveCallback(null)
    }
  }, [saveFile])
  useSaveOnQuit()

  // Compose all decomposed hooks
  useProjectInitialization()
  useRustToastBridge()
  useEditorFocusTracking()
  useKeyboardShortcuts(handleSetPreferencesOpen)
  useMenuEvents(createNewFileWithQuery, handleSetPreferencesOpen)
  useSquareCornersEffect()
  useDOMEventListeners(createNewFileWithQuery, handleSetPreferencesOpen)
  useDeepLink(openFileByPath)
  useExternalLinkHandler()

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

  useColourTheme()

  // Heading colours from appearance settings. --editor-color-heading picks
  // between them with light-dark(), so theme changes need nothing here. Unset,
  // headings take the editor text colour
  useEffect(() => {
    const { style } = window.document.documentElement
    for (const mode of ['light', 'dark'] as const) {
      const color = headingColor?.[mode]
      if (color) style.setProperty(`--heading-color-${mode}`, color)
      else style.removeProperty(`--heading-color-${mode}`)
    }
  }, [headingColor])

  // Apply editor base font size CSS variable
  useEffect(() => {
    const root = window.document.documentElement
    const size = editorBaseFontSize ?? 18
    root.style.setProperty('--editor-base-font-size', `${size}px`)
  }, [editorBaseFontSize])

  // On Linux, detect the DE's configured UI font and apply it via CSS variable
  useEffect(() => {
    let cancelled = false
    try {
      if (getPlatform() !== 'linux') return
    } catch {
      return
    }

    void commands
      .getLinuxUiFont()
      .then(result => {
        if (cancelled) return
        if (result.status === 'ok' && result.data) {
          window.document.documentElement.style.setProperty(
            '--font-ui',
            `'${result.data}', -apple-system, 'Segoe UI', 'Ubuntu', 'Cantarell', 'Noto Sans', 'DejaVu Sans', sans-serif`
          )
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-editor-background">
      <UnifiedTitleBar />

      <div className="min-h-0 flex-1">
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
              minWidth: leftSidebarVisible
                ? LAYOUT_SIZES.leftSidebar.minWidth
                : undefined,
            }}
            onResize={handleLeftPanelResize}
          >
            <LeftSidebar />
          </ResizablePanel>
          <ResizableHandle
            className={`!cursor-col-resize ${leftSidebarVisible ? '' : 'hidden'}`}
          />

          <ResizablePanel
            id="main-editor"
            defaultSize={LAYOUT_SIZES.mainEditor.default}
            minSize={LAYOUT_SIZES.mainEditor.min}
          >
            <MainEditor />
          </ResizablePanel>

          <ResizableHandle
            className={`!cursor-col-resize ${rightSidebarVisible ? '' : 'hidden'}`}
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
            <RightSidebar expanded={rightSidebarExpanded} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Floating components */}
      <CommandPalette />
      <ComponentBuilderDialog />
      <ContentLinkerDialog />
      <ProjectListDialog />
      <ProjectSettingsDialog />
      <PreferencesDialog
        open={preferencesOpen}
        onOpenChange={handleSetPreferencesOpen}
      />
      <Toaster />
      {import.meta.env.DEV && <AgentBridge />}
    </div>
  )
}
