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
  isDirty: boolean
  globalSettings: GlobalSettings | null

  // Store actions
  createNewFile: () => void
  setSelectedCollection: (collection: string | null) => void
  setProject: (path: string) => void
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
  saveFile: () => Promise<void>
  closeCurrentFile: () => void
  loadCollections: () => void
  loadCollectionFiles: () => void
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
  group: 'file' | 'navigation' | 'project' | 'ide' | 'settings' | 'highlight'
  execute: (context: CommandContext) => void | Promise<void>
  isAvailable: (context: CommandContext) => boolean
}

export interface CommandGroup {
  heading: string
  commands: AppCommand[]
}
