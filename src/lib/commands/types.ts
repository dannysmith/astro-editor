import type { FileEntry, Collection } from '@/types'
import type { GlobalSettings } from '../project-registry'

/**
 * Command system types for the application command palette
 */

export interface CommandContext {
  // Current application state
  currentFile: FileEntry | null
  selectedCollection: string | null
  collections: Collection[]
  projectPath: string | null
  globalSettings: GlobalSettings | null

  // Store actions
  createNewFile: () => void
  setSelectedCollection: (collection: string | null) => void
  setProject: (path: string) => void
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
  closeCurrentFile: () => void
  /** Refetches everything read from the project; resolves once it's done */
  reloadCollections: () => Promise<void>
  openPreferences: () => void
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  toggleHighlightNouns: () => void
  toggleHighlightVerbs: () => void
  toggleHighlightAdjectives: () => void
  toggleHighlightAdverbs: () => void
  toggleHighlightConjunctions: () => void
  toggleAllHighlights: () => void

  // Future extensibility
  editorSelection?: {
    text: string
    from: number
    to: number
  }
}

export interface AppCommand {
  id: string
  label: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  group:
    | 'file'
    | 'navigation'
    | 'project'
    | 'ide'
    | 'settings'
    | 'highlight'
    | 'help'
  execute: (context: CommandContext) => void | Promise<void>
  isAvailable: (context: CommandContext) => boolean
}

export interface CommandGroup {
  heading: string
  commands: AppCommand[]
}
