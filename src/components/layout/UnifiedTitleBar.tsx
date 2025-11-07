import React, { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { useCreateFile } from '../../hooks/useCreateFile'
import { Button } from '../ui/button'
import {
  Save,
  PanelRight,
  PanelLeft,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '../../lib/utils'

export const UnifiedTitleBar: React.FC = () => {
  console.log('[PERF] UnifiedTitleBar RENDER')

  const { saveFile, isDirty, currentFile } = useEditorStore()
  const [isWindowFocused, setIsWindowFocused] = useState(true)

  const { projectPath, selectedCollection } = useProjectStore()

  const {
    toggleFrontmatterPanel,
    frontmatterPanelVisible,
    toggleSidebar,
    sidebarVisible,
    focusModeEnabled,
    toggleFocusMode,
    distractionFreeBarsHidden,
    showBars,
  } = useUIStore()

  const { createNewFile } = useCreateFile()

  const handleSave = () => {
    if (currentFile && isDirty) {
      void saveFile()
    }
  }

  const handleNewFile = () => {
    void createNewFile()
  }

  const handleToggleFocusMode = () => {
    toggleFocusMode()
  }

  const handleMinimize = async () => {
    const window = getCurrentWindow()
    await window.minimize()
  }

  const handleToggleMaximize = async () => {
    const window = getCurrentWindow()
    const isFullscreen = await window.isFullscreen()
    await window.setFullscreen(!isFullscreen)
  }

  const handleClose = async () => {
    const window = getCurrentWindow()
    await window.hide()
  }

  const bothPanelsHidden = !sidebarVisible && !frontmatterPanelVisible

  // Handle window focus/blur for traffic lights
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true)
    const handleBlur = () => setIsWindowFocused(false)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return (
    <div
      className={cn(
        'w-full flex items-center justify-between px-3 py-1.5 select-none border-b',
        bothPanelsHidden
          ? 'bg-[var(--editor-color-background)] border-transparent'
          : 'bg-gray-50 dark:bg-black border-border',
        distractionFreeBarsHidden &&
          bothPanelsHidden &&
          'opacity-0 transition-opacity duration-300'
      )}
      data-tauri-drag-region
      onMouseEnter={showBars}
    >
      {/* Left: Traffic lights + sidebar toggle + project name */}
      <div className="flex items-center gap-2 flex-1" data-tauri-drag-region>
        {/* Custom traffic lights - no drag region on these */}
        <div
          className={cn(
            'traffic-lights-group mr-3',
            !isWindowFocused && 'window-unfocused'
          )}
        >
          <button
            onClick={() => void handleClose()}
            className="traffic-light traffic-light-close"
          >
            <span className="symbol">×</span>
          </button>
          <button
            onClick={() => void handleMinimize()}
            className="traffic-light traffic-light-minimize"
          >
            <span className="symbol">−</span>
          </button>
          <button
            onClick={() => void handleToggleMaximize()}
            className="traffic-light traffic-light-maximize"
          >
            <span className="symbol">⤢</span>
          </button>
        </div>

        {/* Left sidebar toggle - no drag region */}
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="sm"
          className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-gray-700 dark:text-gray-300"
          title={sidebarVisible ? 'Close Sidebar' : 'Open Sidebar'}
        >
          {sidebarVisible ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeft className="size-4" />
          )}
        </Button>

        {/* Project name - on the left */}
        {projectPath ? (
          <span className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            {projectPath.split('/').pop() || projectPath}
          </span>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            Astro Editor
          </span>
        )}
      </div>

      {/* Right: New file + Focus mode + Save button + Right sidebar toggle */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        {/* New file button - only show when in a collection */}
        {selectedCollection && (
          <Button
            onClick={handleNewFile}
            variant="ghost"
            size="sm"
            className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-gray-700 dark:text-gray-300"
            title={`New ${selectedCollection} file`}
          >
            <Plus className="size-4" />
          </Button>
        )}

        {/* Focus mode toggle */}
        <Button
          onClick={handleToggleFocusMode}
          variant="ghost"
          size="sm"
          className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-gray-700 dark:text-gray-300"
          title={focusModeEnabled ? 'Disable Focus Mode' : 'Enable Focus Mode'}
          aria-label={
            focusModeEnabled ? 'Disable Focus Mode' : 'Enable Focus Mode'
          }
        >
          {focusModeEnabled ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>

        {/* Save button - no drag region */}
        <Button
          onClick={handleSave}
          variant="ghost"
          size="sm"
          disabled={!currentFile || !isDirty}
          title={`Save${isDirty ? ' (unsaved changes)' : ''}`}
          className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-gray-700 dark:text-gray-300"
        >
          <Save className="size-4" />
        </Button>

        {/* Right sidebar toggle - no drag region */}
        <Button
          onClick={toggleFrontmatterPanel}
          variant="ghost"
          size="sm"
          className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-gray-700 dark:text-gray-300"
          title={
            frontmatterPanelVisible
              ? 'Close Frontmatter Panel'
              : 'Open Frontmatter Panel'
          }
        >
          {frontmatterPanelVisible ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRight className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
