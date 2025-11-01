/**
 * Default File Type Resolution
 *
 * Implements three-tier fallback for resolving the default file type
 * for new files created in collections.
 *
 * Fallback chain: Collection → Project → Global → Hard-coded default ('md')
 */

import type { GlobalSettings, ProjectSettings } from './types'

/**
 * Resolves the default file type using three-tier fallback
 *
 * @param globalSettings - Global settings (may be null)
 * @param projectSettings - Project settings (may be null)
 * @param collectionName - Optional collection name for collection-level override
 * @returns The file extension to use ('md' or 'mdx')
 *
 * @example
 * // Get default for a specific collection
 * const ext = getDefaultFileType(globalSettings, projectSettings, 'blog')
 *
 * @example
 * // Get default at project level
 * const ext = getDefaultFileType(globalSettings, projectSettings)
 */
export const getDefaultFileType = (
  globalSettings: GlobalSettings | null,
  projectSettings: ProjectSettings | null,
  collectionName?: string
): 'md' | 'mdx' => {
  // Collection-level override (highest priority)
  if (collectionName && projectSettings?.collections) {
    const collectionSettings = projectSettings.collections.find(
      c => c.name === collectionName
    )
    if (collectionSettings?.settings?.defaultFileType) {
      return collectionSettings.settings.defaultFileType
    }
  }

  // Project-level override
  if (projectSettings?.defaultFileType) {
    return projectSettings.defaultFileType
  }

  // Global setting
  if (globalSettings?.general?.defaultFileType) {
    return globalSettings.general.defaultFileType
  }

  // Hard-coded default (maintains backwards compatibility)
  return 'md'
}
