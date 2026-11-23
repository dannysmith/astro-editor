import {
  FileText,
  FolderCog,
  FolderOpen,
  X,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Plus,
  ExternalLink,
  Code,
  Folder,
  Settings,
  Eye,
  AlignVerticalSpaceAround,
  Highlighter,
  Link,
  BookOpen,
  Keyboard,
  PenLine,
} from 'lucide-react'
import { openPath } from '@tauri-apps/plugin-opener'
import { AppCommand, CommandContext } from './types'
import type { Collection } from '@/types'
import { toast } from '../toast'
import { openInIde } from '../ide'
import { showProjectList } from '../projects/actions'
import { showProjectSettings } from '../project-settings/actions'
import { renameOpenFileFromPattern } from '../files/rename'
import { DOCS_URLS } from '../docs-urls'
import { useContentLinkerStore } from '@/store/contentLinkerStore'
import { useUIStore } from '@/store/uiStore'
import {
  RIGHT_SIDEBAR_TABS,
  isRightSidebarTabAvailableNow,
} from '../right-sidebar'
import {
  POS_CONFIGS,
  readHighlights,
  toggleAllHighlights,
  toggleHighlight,
} from '../editor/extensions/copyedit-mode'

/**
 * File-related commands
 */
export const fileCommands: AppCommand[] = [
  {
    id: 'new-file',
    label: 'New File',
    description: 'Create a new file in the selected collection',
    icon: Plus,
    group: 'file',
    execute: (context: CommandContext) => {
      context.createNewFile()
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.selectedCollection && context.projectPath)
    },
  },
  {
    id: 'close-file',
    label: 'Close File',
    description: 'Close the current file',
    icon: X,
    group: 'file',
    execute: (context: CommandContext) => {
      void context.closeFile()
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.currentFile)
    },
  },
  {
    id: 'rename-file-from-pattern',
    label: 'Rename File from Pattern',
    description:
      "Name the open file by its collection's file name pattern, from its title and date",
    icon: PenLine,
    group: 'file',
    execute: () => {
      void renameOpenFileFromPattern()
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.currentFile)
    },
  },
]

/**
 * Navigation-related commands
 */
export const navigationCommands: AppCommand[] = [
  {
    id: 'toggle-left-sidebar',
    label: 'Toggle Left Sidebar',
    description: 'Show or hide the file list',
    icon: PanelLeft,
    group: 'navigation',
    execute: () => {
      useUIStore.getState().toggleLeftSidebar()
    },
    isAvailable: () => true,
  },
  {
    id: 'toggle-right-sidebar',
    label: 'Toggle Right Sidebar',
    description: 'Show or hide the right sidebar, keeping its tab',
    icon: PanelRight,
    group: 'navigation',
    execute: () => {
      useUIStore.getState().toggleRightSidebar()
    },
    isAvailable: () => true,
  },
  ...RIGHT_SIDEBAR_TABS.map((tab): AppCommand => ({
    id: `toggle-${tab.id}-panel`,
    label: `Toggle ${tab.label} Panel`,
    description: `Show the ${tab.label} panel in the right sidebar, or hide the sidebar if it's showing`,
    icon: tab.icon,
    group: 'navigation',
    execute: () => {
      useUIStore.getState().toggleRightSidebarTab(tab.id)
    },
    isAvailable: () => isRightSidebarTabAvailableNow(tab.id),
  })),
  {
    id: 'content-linker',
    label: 'Find Content',
    description: 'Search content to open or insert a link',
    icon: Link,
    group: 'navigation',
    execute: () => {
      useContentLinkerStore.getState().open(null)
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.projectPath)
    },
  },
]

/**
 * Project-related commands
 */
export const projectCommands: AppCommand[] = [
  {
    id: 'open-project',
    label: 'Open Project',
    description: 'Switch to another project or open a folder',
    icon: FolderOpen,
    group: 'project',
    execute: () => {
      showProjectList()
    },
    isAvailable: () => true,
  },
  {
    id: 'project-settings',
    label: 'Project Settings',
    description: 'See how the project was read, and change its settings',
    icon: FolderCog,
    group: 'project',
    execute: () => {
      showProjectSettings()
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.projectPath)
    },
  },
  {
    id: 'reload-collections',
    label: 'Reload Collections',
    description: 'Refresh the project structure',
    icon: RefreshCw,
    group: 'project',
    execute: async (context: CommandContext) => {
      await context.reloadCollections()
      toast.success('Collections reloaded')
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.projectPath)
    },
  },
]

/**
 * Settings-related commands
 */
export const settingsCommands: AppCommand[] = [
  {
    id: 'open-preferences',
    label: 'Open Preferences',
    description: 'Open application preferences and settings',
    icon: Settings,
    group: 'settings',
    execute: (context: CommandContext) => {
      context.openPreferences()
    },
    isAvailable: () => true,
  },
]

/**
 * Writing mode commands
 */
export const viewModeCommands: AppCommand[] = [
  {
    id: 'toggle-focus-mode',
    label: 'Toggle Focus Mode',
    description: 'Dim all text except current sentence',
    icon: Eye,
    group: 'settings',
    execute: (context: CommandContext) => {
      context.toggleFocusMode()
    },
    isAvailable: () => true,
  },
  {
    id: 'toggle-typewriter-mode',
    label: 'Toggle Typewriter Mode',
    description: 'Keep cursor line centred in viewport',
    icon: AlignVerticalSpaceAround,
    group: 'settings',
    execute: (context: CommandContext) => {
      context.toggleTypewriterMode()
    },
    isAvailable: () => true,
  },
]

/**
 * Copyedit commands: the part-of-speech highlights, with labels that say what
 * they'll do
 */
export function getCopyeditCommands(context: CommandContext): AppCommand[] {
  // Labels read the context, so the palette updates when a highlight changes
  const highlights = readHighlights(context.globalSettings)
  const anyEnabled = Object.values(highlights).some(Boolean)

  return [
    ...POS_CONFIGS.map(({ settingKey, name }): AppCommand => ({
      id: `toggle-highlight-${settingKey}`,
      label: `${highlights[settingKey] ? 'Hide' : 'Show'} ${name} Highlights`,
      description: `Toggle highlighting of ${settingKey} in the editor`,
      icon: Highlighter,
      group: 'copyedit',
      execute: () => {
        toggleHighlight(settingKey)
      },
      isAvailable: () => true,
    })),
    {
      id: 'toggle-all-highlights',
      label: anyEnabled ? 'Hide All Highlights' : 'Show All Highlights',
      description: 'Toggle all part-of-speech highlights on or off together',
      icon: Highlighter,
      group: 'copyedit',
      execute: () => {
        toggleAllHighlights()
      },
      isAvailable: () => true,
    },
  ]
}

/**
 * Help-related commands. These open the documentation site in the user's
 * default browser, so they intentionally have no keyboard shortcut.
 */
export const helpCommands: AppCommand[] = [
  {
    id: 'open-user-guide',
    label: 'User Guide',
    description: 'Open the Astro Editor documentation in your browser',
    icon: BookOpen,
    group: 'help',
    execute: async () => {
      await openPath(DOCS_URLS.userGuide)
    },
    isAvailable: () => true,
  },
  {
    id: 'open-keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    description: 'Open the keyboard shortcuts reference in your browser',
    icon: Keyboard,
    group: 'help',
    execute: async () => {
      await openPath(DOCS_URLS.keyboardShortcuts)
    },
    isAvailable: () => true,
  },
]

/**
 * Generate dynamic collection commands based on available collections
 */
export function generateCollectionCommands(
  collections: Collection[]
): AppCommand[] {
  return collections.map(collection => ({
    id: `open-collection-${collection.name}`,
    label: `Open Collection: ${collection.name}`,
    description: `Switch to the ${collection.name} collection`,
    icon: FileText,
    group: 'navigation' as const,
    execute: (context: CommandContext) => {
      context.setSelectedCollection(collection.name)
    },
    isAvailable: (context: CommandContext) => {
      return context.selectedCollection !== collection.name
    },
  }))
}

/**
 * IDE-related commands
 */
export const ideCommands: AppCommand[] = [
  {
    id: 'open-project-in-ide',
    label: 'Open Project in IDE',
    description: 'Open the current project in your preferred IDE',
    icon: Code,
    group: 'ide',
    execute: async (context: CommandContext) => {
      const ideCommand = context.globalSettings?.general?.ideCommand
      if (ideCommand && context.projectPath) {
        await openInIde(context.projectPath, ideCommand)
      }
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(
        context.globalSettings?.general?.ideCommand && context.projectPath
      )
    },
  },
  {
    id: 'open-collection-in-ide',
    label: 'Open Collection in IDE',
    description: 'Open the current collection directory in your preferred IDE',
    icon: Folder,
    group: 'ide',
    execute: async (context: CommandContext) => {
      const ideCommand = context.globalSettings?.general?.ideCommand
      if (ideCommand && context.selectedCollection && context.projectPath) {
        // Find the collection to get its path
        const collection = context.collections.find(
          c => c.name === context.selectedCollection
        )
        if (collection) {
          await openInIde(collection.path, ideCommand)
        }
      }
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(
        context.globalSettings?.general?.ideCommand &&
        context.selectedCollection &&
        context.projectPath
      )
    },
  },
  {
    id: 'open-file-in-ide',
    label: 'Open File in IDE',
    description: 'Open the current file in your preferred IDE',
    icon: ExternalLink,
    group: 'ide',
    execute: async (context: CommandContext) => {
      const ideCommand = context.globalSettings?.general?.ideCommand
      if (ideCommand && context.currentFile) {
        await openInIde(context.currentFile.path, ideCommand)
      }
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(
        context.globalSettings?.general?.ideCommand && context.currentFile
      )
    },
  },
]

/**
 * Get all available commands based on current context
 */
export function getAllCommands(context: CommandContext): AppCommand[] {
  const collectionCommands = generateCollectionCommands(context.collections)
  const copyeditCommands = getCopyeditCommands(context)

  return [
    ...fileCommands,
    ...navigationCommands,
    ...projectCommands,
    ...settingsCommands,
    ...viewModeCommands,
    ...copyeditCommands,
    ...ideCommands,
    ...helpCommands,
    ...collectionCommands,
  ].filter(command => command.isAvailable(context))
}
