import React, { useState, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { exit } from '@tauri-apps/plugin-process'
import { message } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { commands } from '@/lib/bindings'
import { toast } from '@/lib/toast'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'

/**
 * Windows-specific overflow menu providing access to app functions.
 * Mirrors the macOS native menu bar functionality.
 */
export const WindowsMenu: React.FC = () => {
  const currentFile = useEditorStore(state => state.currentFile)
  const isDirty = useEditorStore(state => state.isDirty)
  const selectedCollection = useProjectStore(state => state.selectedCollection)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const window = getCurrentWindow()

    // Check initial fullscreen state
    void window.isFullscreen().then(fullscreen => {
      if (!cancelled) setIsFullscreen(fullscreen)
    })

    // Listen for fullscreen changes
    const unlisten = window.onResized(() => {
      if (cancelled) return
      void window.isFullscreen().then(fullscreen => {
        if (!cancelled) setIsFullscreen(fullscreen)
      })
    })

    return () => {
      cancelled = true
      void unlisten.then(fn => fn())
    }
  }, [])

  const handleOpenProject = () => {
    void emit('menu-open-project')
  }

  const handleNewFile = () => {
    void emit('menu-new-file')
  }

  const handleSave = () => {
    void emit('menu-save')
  }

  const handleToggleSidebar = () => {
    void emit('menu-toggle-sidebar')
  }

  const handleToggleFrontmatter = () => {
    void emit('menu-toggle-frontmatter')
  }

  const handleFullScreen = async () => {
    try {
      const window = getCurrentWindow()
      const isFullscreen = await window.isFullscreen()
      await window.setFullscreen(!isFullscreen)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to toggle fullscreen:', error)
      toast.error('Failed to toggle fullscreen')
    }
  }

  const handlePreferences = () => {
    void emit('menu-preferences')
  }

  const handleCheckUpdates = () => {
    void emit('menu-check-updates')
  }

  const handleAbout = async () => {
    let version = 'Unknown'
    try {
      const result = await commands.getAppVersion()
      if (result.status === 'ok') {
        version = result.data
      }
    } catch {
      // Fallback to unknown
    }

    await message(
      `Astro Editor\nVersion ${version}\n\nA native markdown editor for Astro content collections.\n\nBuilt with Tauri and React.`,
      { title: 'About Astro Editor', kind: 'info' }
    )
  }

  const handleExit = () => {
    void exit(0)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 text-gray-700 dark:text-gray-300"
          title="Menu"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleOpenProject}>
          Open Project...
          <DropdownMenuShortcut>Ctrl+Shift+O</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleNewFile}
          disabled={!selectedCollection}
        >
          New File
          <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSave}
          disabled={!currentFile || !isDirty}
        >
          Save
          <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleToggleSidebar}>
          Toggle Sidebar
          <DropdownMenuShortcut>Ctrl+1</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleFrontmatter}>
          Toggle Frontmatter
          <DropdownMenuShortcut>Ctrl+2</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleFullScreen()}>
          {isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          <DropdownMenuShortcut>F11</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handlePreferences}>
          Preferences...
          <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCheckUpdates}>
          Check for Updates...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleAbout()}>
          About Astro Editor
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleExit}>Exit</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
