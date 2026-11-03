/**
 * Centralized path resolution with collection-scoped settings support
 *
 * The content and assets directories a project or collection uses, with
 * three-tier fallback (collection → project → defaults)
 */

import { ProjectSettings } from './types'
import { ASTRO_PATHS } from '../constants'

/**
 * Get effective content directory path for a collection
 *
 * Implements three-tier fallback:
 * 1. Collection-specific contentDirectory override
 * 2. Project-level contentDirectory override
 * 3. Hard-coded default (ASTRO_PATHS.CONTENT_DIR)
 *
 * @param projectSettings - Current project settings
 * @param collectionName - Optional collection name for collection-scoped override
 * @returns Effective content directory path (relative to project root)
 */
export function getEffectiveContentDirectory(
  projectSettings?: ProjectSettings | null,
  collectionName?: string | null
): string {
  // If collection is specified, check for collection-specific override
  if (collectionName && projectSettings?.collections) {
    const collectionSettings = projectSettings.collections.find(
      c => c.name === collectionName
    )
    if (collectionSettings?.settings.pathOverrides?.contentDirectory) {
      return collectionSettings.settings.pathOverrides.contentDirectory
    }
  }

  // Fall back to project-level override
  if (projectSettings?.pathOverrides?.contentDirectory) {
    return projectSettings.pathOverrides.contentDirectory
  }

  // Fall back to default
  return ASTRO_PATHS.CONTENT_DIR
}

/**
 * Get effective assets directory path for a collection
 *
 * Implements three-tier fallback:
 * 1. Collection-specific assetsDirectory override
 * 2. Project-level assetsDirectory override
 * 3. Hard-coded default (ASTRO_PATHS.ASSETS_DIR)
 *
 * @param projectSettings - Current project settings
 * @param collectionName - Optional collection name for collection-scoped override
 * @returns Effective assets directory path (relative to project root)
 */
export function getEffectiveAssetsDirectory(
  projectSettings?: ProjectSettings | null,
  collectionName?: string | null
): string {
  // If collection is specified, check for collection-specific override
  if (collectionName && projectSettings?.collections) {
    const collectionSettings = projectSettings.collections.find(
      c => c.name === collectionName
    )
    if (collectionSettings?.settings.pathOverrides?.assetsDirectory) {
      return collectionSettings.settings.pathOverrides.assetsDirectory
    }
  }

  // Fall back to project-level override
  if (projectSettings?.pathOverrides?.assetsDirectory) {
    return projectSettings.pathOverrides.assetsDirectory
  }

  // Fall back to default
  return ASTRO_PATHS.ASSETS_DIR
}
