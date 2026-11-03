/**
 * Default settings and values for the project registry system
 */

import { GlobalSettings, ProjectSettings, ProjectRegistry } from './types'

/**
 * Field names tried, in order, for a file's published date when the collection
 * has no date mapping, and after the mapped field when it has one
 */
export const DEFAULT_PUBLISHED_DATE_FIELDS = [
  'pubDate',
  'date',
  'publishedDate',
]

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  pathOverrides: {
    contentDirectory: 'src/content/',
    assetsDirectory: 'src/assets/',
    mdxComponentsDirectory: 'src/components/mdx/',
  },
  // No published date mapping, so DEFAULT_PUBLISHED_DATE_FIELDS applies
  frontmatterMappings: {
    title: 'title',
    description: 'description',
    draft: 'draft',
  },
  // useAbsoluteAssetPaths: undefined by default (uses relative paths, matching Astro conventions)
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  general: {
    ideCommand: '',
    theme: 'system',
    highlights: {
      nouns: false,
      verbs: false,
      adjectives: false,
      adverbs: false,
      conjunctions: false,
    },
    autoSaveDelay: 2,
    defaultFileType: 'md',
  },
  appearance: {
    headingColor: {
      light: '#191919', // Use default text color
      dark: '#cccccc', // Use default text color
    },
  },
  version: 2,
}

export const DEFAULT_PROJECT_REGISTRY: ProjectRegistry = {
  projects: {},
  lastOpenedProject: null,
  version: 2,
}
