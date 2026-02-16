import {
  FileText,
  FolderOpen,
  X,
  Sidebar,
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
} from 'lucide-react'
import { AppCommand, CommandContext } from './types'
import type { Collection } from '@/types'
import { toast } from '../toast'
import { openInIde } from '../ide'
import { openProjectViaDialog } from '../projects/actions'
import { useContentLinkerStore } from '@/store/contentLinkerStore'

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
      context.closeCurrentFile()
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
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    icon: Sidebar,
    group: 'navigation',
    execute: (context: CommandContext) => {
      context.toggleSidebar()
    },
    isAvailable: () => true,
  },
  {
    id: 'toggle-frontmatter-panel',
    label: 'Toggle Frontmatter Panel',
    description: 'Show or hide the frontmatter panel',
    icon: PanelRight,
    group: 'navigation',
    execute: (context: CommandContext) => {
      context.toggleFrontmatterPanel()
    },
    isAvailable: () => true,
  },
  {
    id: 'content-linker',
    label: 'Content Linker',
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
    description: 'Select a new project folder',
    icon: FolderOpen,
    group: 'project',
    execute: async () => {
      await openProjectViaDialog()
    },
    isAvailable: () => true,
  },
  {
    id: 'reload-collections',
    label: 'Reload Collections',
    description: 'Refresh the project structure',
    icon: RefreshCw,
    group: 'project',
    execute: (context: CommandContext) => {
      context.loadCollections()
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
 * Highlight commands for parts of speech with dynamic labels
 */
export function getHighlightCommands(context: CommandContext): AppCommand[] {
  const highlights = context.globalSettings?.general?.highlights

  // Get the actual state with proper defaults using nullish coalescing
  const highlightStates = {
    nouns: highlights?.nouns ?? true,
    verbs: highlights?.verbs ?? true,
    adjectives: highlights?.adjectives ?? true,
    adverbs: highlights?.adverbs ?? true,
    conjunctions: highlights?.conjunctions ?? true,
  }

  // Check if any highlights are enabled for the "Toggle All" command
  const anyEnabled = Object.values(highlightStates).some(enabled => enabled)

  return [
    {
      id: 'toggle-highlight-nouns',
      label: highlightStates.nouns
        ? 'Hide Noun Highlights'
        : 'Show Noun Highlights',
      description: 'Toggle highlighting of nouns in the editor',
      icon: Highlighter,
      group: 'highlight',
      execute: (context: CommandContext) => {
        context.toggleHighlightNouns()
      },
      isAvailable: () => true,
    },
    {
      id: 'toggle-highlight-verbs',
      label: highlightStates.verbs
        ? 'Hide Verb Highlights'
        : 'Show Verb Highlights',
      description: 'Toggle highlighting of verbs in the editor',
      icon: Highlighter,
      group: 'highlight',
      execute: (context: CommandContext) => {
        context.toggleHighlightVerbs()
      },
      isAvailable: () => true,
    },
    {
      id: 'toggle-highlight-adjectives',
      label: highlightStates.adjectives
        ? 'Hide Adjective Highlights'
        : 'Show Adjective Highlights',
      description: 'Toggle highlighting of adjectives in the editor',
      icon: Highlighter,
      group: 'highlight',
      execute: (context: CommandContext) => {
        context.toggleHighlightAdjectives()
      },
      isAvailable: () => true,
    },
    {
      id: 'toggle-highlight-adverbs',
      label: highlightStates.adverbs
        ? 'Hide Adverb Highlights'
        : 'Show Adverb Highlights',
      description: 'Toggle highlighting of adverbs in the editor',
      icon: Highlighter,
      group: 'highlight',
      execute: (context: CommandContext) => {
        context.toggleHighlightAdverbs()
      },
      isAvailable: () => true,
    },
    {
      id: 'toggle-highlight-conjunctions',
      label: highlightStates.conjunctions
        ? 'Hide Conjunction Highlights'
        : 'Show Conjunction Highlights',
      description: 'Toggle highlighting of conjunctions in the editor',
      icon: Highlighter,
      group: 'highlight',
      execute: (context: CommandContext) => {
        context.toggleHighlightConjunctions()
      },
      isAvailable: () => true,
    },
    {
      id: 'toggle-all-highlights',
      label: anyEnabled ? 'Hide All Highlights' : 'Show All Highlights',
      description: 'Toggle all part-of-speech highlights on or off together',
      icon: Highlighter,
      group: 'highlight',
      execute: (context: CommandContext) => {
        context.toggleAllHighlights()
      },
      isAvailable: () => true,
    },
  ]
}

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
      context.loadCollectionFiles()
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
  const highlightCommands = getHighlightCommands(context)

  return [
    ...fileCommands,
    ...navigationCommands,
    ...projectCommands,
    ...settingsCommands,
    ...viewModeCommands,
    ...highlightCommands,
    ...ideCommands,
    ...collectionCommands,
  ].filter(command => command.isAvailable(context))
}
