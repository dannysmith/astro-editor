/**
 * Project Registry Types
 *
 * Simple type definitions for project identification and persistence
 */

export interface ProjectMetadata {
  id: string // Generated project ID (package.json name + path hash if needed)
  name: string // From package.json
  path: string // Current full path
  lastOpened: string // ISO timestamp
  created: string // ISO timestamp
}

export interface ProjectSettings {
  // Project-specific overrides for paths
  pathOverrides: {
    contentDirectory?: string
    assetsDirectory?: string
    mdxComponentsDirectory?: string
  }
  // Project-specific overrides for frontmatter field mappings
  frontmatterMappings: {
    publishedDate?: string
    title?: string
    description?: string
    draft?: string
  }
  // Default file type for new files
  defaultFileType?: 'md' | 'mdx'
  // Collection-specific settings overrides
  collections?: CollectionSettings[]
}

// Collection-specific settings (subset of ProjectSettings)
export interface CollectionSpecificSettings {
  pathOverrides?: {
    contentDirectory?: string
    assetsDirectory?: string
  }
  frontmatterMappings?: {
    publishedDate?: string | string[]
    title?: string
    description?: string
    draft?: string
  }
  // Default file type for new files in this collection
  defaultFileType?: 'md' | 'mdx'
}

export interface CollectionSettings {
  name: string // Collection identifier
  settings: CollectionSpecificSettings
}

export interface ProjectData {
  settings: ProjectSettings
  collections?: CollectionSettings[] // Collection-specific overrides
  version: number
}

export interface ProjectRegistry {
  projects: Record<string, ProjectMetadata> // projectId -> metadata
  lastOpenedProject: string | null
  version: number
}

export interface GlobalSettings {
  general: {
    ideCommand: string
    theme: 'light' | 'dark' | 'system'
    highlights: {
      nouns: boolean
      verbs: boolean
      adjectives: boolean
      adverbs: boolean
      conjunctions: boolean
    }
    autoSaveDelay: number
    defaultFileType: 'md' | 'mdx'
  }
  appearance: {
    headingColor: {
      light: string
      dark: string
    }
  }
  version: number
}
