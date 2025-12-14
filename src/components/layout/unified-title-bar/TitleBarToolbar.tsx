import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { useUIStore } from '../../../store/uiStore'
import { useCreateFile } from '../../../hooks/useCreateFile'
import { Button } from '../../ui/button'
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
import { cn } from '../../../lib/utils'

interface TitleBarToolbarProps {
  /** Content to render at the start of the left section (e.g., traffic lights on macOS) */
  leftSlot?: React.ReactNode
  /** Content to render at the end of the right section (e.g., window controls on Windows) */
  rightSlot?: React.ReactNode
}

/**
 * Shared toolbar component for the unified title bar.
 * Contains sidebar toggles, project name, and action buttons.
 * Platform-specific window controls are passed via slots.
 */
export const TitleBarToolbar: React.FC<TitleBarToolbarProps> = ({
  leftSlot,
  rightSlot,
}) => {
  // Object subscription needs shallow
  const currentFile = useEditorStore(useShallow(state => state.currentFile))

  // Primitive subscriptions - selector syntax for consistency
  const saveFile = useEditorStore(state => state.saveFile)
  const isDirty = useEditorStore(state => state.isDirty)

  const projectPath = useProjectStore(state => state.projectPath)
  const selectedCollection = useProjectStore(state => state.selectedCollection)

  // UI store values (all already primitives or functions)
  const toggleFrontmatterPanel = useUIStore(
    state => state.toggleFrontmatterPanel
  )
  const frontmatterPanelVisible = useUIStore(
    state => state.frontmatterPanelVisible
  )
  const toggleSidebar = useUIStore(state => state.toggleSidebar)
  const sidebarVisible = useUIStore(state => state.sidebarVisible)
  const focusModeEnabled = useUIStore(state => state.focusModeEnabled)
  const toggleFocusMode = useUIStore(state => state.toggleFocusMode)
  const distractionFreeBarsHidden = useUIStore(
    state => state.distractionFreeBarsHidden
  )
  const showBars = useUIStore(state => state.showBars)

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

  const bothPanelsHidden = !sidebarVisible && !frontmatterPanelVisible

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
      {/* Left: Platform slot + sidebar toggle + project name */}
      <div className="flex items-center gap-2 flex-1" data-tauri-drag-region>
        {leftSlot}

        {/* Left sidebar toggle */}
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

        {/* Project name */}
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

      {/* Right: Action buttons + platform slot */}
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

        {/* Save button */}
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

        {/* Right sidebar toggle */}
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

        {rightSlot}
      </div>
    </div>
  )
}
