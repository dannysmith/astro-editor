import { invoke } from '@tauri-apps/api/core'
import {
  FileText,
  FolderOpen,
  Save,
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
  Edit,
  Highlighter,
} from 'lucide-react'
import { AppCommand, CommandContext } from './types'
import type { Collection, FileEntry } from '../../types'
import { toast } from '../toast'
import { queryClient } from '../query-client'
import { queryKeys } from '../query-keys'
import { useEditorStore } from '../../store/editorStore'

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
    id: 'save-file',
    label: 'Save File',
    description: 'Save the current file',
    icon: Save,
    group: 'file',
    execute: async (context: CommandContext) => {
      await context.saveFile()
    },
    isAvailable: (context: CommandContext) => {
      return Boolean(context.currentFile && context.isDirty)
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
    execute: async (context: CommandContext) => {
      try {
        const projectPath = await invoke<string>('select_project_folder')
        if (projectPath) {
          context.setProject(projectPath)
          toast.success('Project opened successfully')
        }
      } catch (error) {
        toast.error('Failed to open project', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
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
    description: 'Keep current line centered while typing',
    icon: Edit,
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
 * Allowed IDE commands for display purposes (validation happens in Rust)
 */
export const ALLOWED_IDES = [
  'cursor',
  'code',
  'vim',
  'nvim',
  'emacs',
  'subl',
] as const

/**
 * Helper function to execute IDE commands using secure Rust backend
 */
async function executeIdeCommand(ideCommand: string, path: string) {
  try {
    // Call the secure Rust command handler
    await invoke<string>('open_path_in_ide', {
      ideCommand,
      filePath: path,
    })

    toast.success(`Opened in ${ideCommand}`)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    // eslint-disable-next-line no-console
    console.error('Failed to execute IDE command:', {
      ideCommand,
      path,
      error: errorMessage,
      fullError: error,
    })

    toast.error('Failed to open in IDE', {
      description: errorMessage,
    })
  }
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
        await executeIdeCommand(ideCommand, context.projectPath)
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
          await executeIdeCommand(ideCommand, collection.path)
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
        await executeIdeCommand(ideCommand, context.currentFile.path)
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
 * Generate search result commands based on search query
 *
 * Note: This function only searches collections that have been loaded into the
 * TanStack Query cache. Collections are automatically loaded when visited via
 * the sidebar, following the established architecture patterns.
 */
function generateSearchCommands(
  context: CommandContext,
  searchValue: string
): AppCommand[] {
  // Only show search results if user has typed at least 2 characters
  if (!searchValue || searchValue.length < 2 || !context.projectPath) {
    return []
  }

  const searchCommands: AppCommand[] = []

  // Get all files from collections that are cached
  // This follows the architecture guide's pattern of using cached query data
  context.collections.forEach(collection => {
    const filesData = queryClient.getQueryData<FileEntry[]>(
      queryKeys.collectionFiles(context.projectPath!, collection.name)
    )

    if (filesData) {
      filesData.forEach(file => {
        // Create searchable text from filename and title
        const title = file.frontmatter?.title as string | undefined
        const searchableText = title ? `${file.name} ${title}` : file.name

        // Perform case-insensitive search
        if (searchableText.toLowerCase().includes(searchValue.toLowerCase())) {
          searchCommands.push({
            id: `search-file-${file.id}`,
            label: title || file.name,
            description: `${collection.name}/${file.name}.${file.extension}`,
            icon: FileText,
            group: 'search',
            execute: () => {
              // Open the file using the editor store
              const { openFile } = useEditorStore.getState()
              openFile(file)
            },
            isAvailable: () => true,
          })
        }
      })
    }
  })

  // Limit to top 10 results for performance
  return searchCommands.slice(0, 10)
}

/**
 * Get all available commands based on current context
 */
export function getAllCommands(
  context: CommandContext,
  searchValue = ''
): AppCommand[] {
  const collectionCommands = generateCollectionCommands(context.collections)
  const searchCommands = generateSearchCommands(context, searchValue)
  const highlightCommands = getHighlightCommands(context)

  return [
    ...searchCommands, // Search results first when searching
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
