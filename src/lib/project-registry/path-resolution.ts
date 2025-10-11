/**
 * Centralized path resolution with collection-scoped settings support
 *
 * This module provides utilities for resolving paths and frontmatter mappings
 * with proper three-tier fallback (collection → project → defaults)
 */

import { ProjectSettings, CollectionSettings } from './types'
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

/**
 * Get effective MDX components directory path
 *
 * Note: MDX components directory is project-level only (no collection-specific override)
 *
 * Implements two-tier fallback:
 * 1. Project-level mdxComponentsDirectory override
 * 2. Hard-coded default (ASTRO_PATHS.MDX_COMPONENTS_DIR)
 *
 * @param projectSettings - Current project settings
 * @returns Effective MDX components directory path (relative to project root)
 */
export function getEffectiveMdxComponentsDirectory(
  projectSettings?: ProjectSettings | null
): string {
  // Fall back to project-level override
  if (projectSettings?.pathOverrides?.mdxComponentsDirectory) {
    return projectSettings.pathOverrides.mdxComponentsDirectory
  }

  // Fall back to default
  return ASTRO_PATHS.MDX_COMPONENTS_DIR
}

/**
 * Get effective frontmatter field mappings for a collection
 *
 * Implements three-tier fallback for each field:
 * 1. Collection-specific mapping
 * 2. Project-level mapping
 * 3. Hard-coded default
 *
 * @param projectSettings - Current project settings
 * @param collectionName - Optional collection name for collection-scoped override
 * @returns Effective frontmatter mappings with all fields populated
 */
export function getEffectiveFrontmatterMappings(
  projectSettings?: ProjectSettings | null,
  collectionName?: string | null
): {
  publishedDate: string | string[]
  title: string
  description: string
  draft: string
} {
  // Define defaults
  const defaults = {
    publishedDate: ['pubDate', 'date', 'publishedDate'] as string | string[],
    title: 'title',
    description: 'description',
    draft: 'draft',
  }

  // If collection is specified, check for collection-specific overrides
  let collectionSettings: CollectionSettings | undefined
  if (collectionName && projectSettings?.collections) {
    collectionSettings = projectSettings.collections.find(
      c => c.name === collectionName
    )
  }

  return {
    publishedDate:
      collectionSettings?.settings.frontmatterMappings?.publishedDate ||
      projectSettings?.frontmatterMappings?.publishedDate ||
      defaults.publishedDate,
    title:
      collectionSettings?.settings.frontmatterMappings?.title ||
      projectSettings?.frontmatterMappings?.title ||
      defaults.title,
    description:
      collectionSettings?.settings.frontmatterMappings?.description ||
      projectSettings?.frontmatterMappings?.description ||
      defaults.description,
    draft:
      collectionSettings?.settings.frontmatterMappings?.draft ||
      projectSettings?.frontmatterMappings?.draft ||
      defaults.draft,
  }
}

/**
 * Get all effective path overrides for a collection
 *
 * Convenience function that returns all path overrides at once
 *
 * @param projectSettings - Current project settings
 * @param collectionName - Optional collection name for collection-scoped override
 * @returns Object with all effective path overrides
 */
export function getEffectivePathOverrides(
  projectSettings?: ProjectSettings | null,
  collectionName?: string | null
): {
  contentDirectory: string
  assetsDirectory: string
  mdxComponentsDirectory: string
} {
  return {
    contentDirectory: getEffectiveContentDirectory(
      projectSettings,
      collectionName
    ),
    assetsDirectory: getEffectiveAssetsDirectory(
      projectSettings,
      collectionName
    ),
    mdxComponentsDirectory: getEffectiveMdxComponentsDirectory(projectSettings),
  }
}

/**
 * Get all effective settings for a collection
 *
 * Convenience function that returns both path overrides and frontmatter mappings
 *
 * @param projectSettings - Current project settings
 * @param collectionName - Optional collection name for collection-scoped override
 * @returns Object with all effective settings
 */
export function getEffectiveCollectionSettings(
  projectSettings?: ProjectSettings | null,
  collectionName?: string | null
): {
  pathOverrides: {
    contentDirectory: string
    assetsDirectory: string
    mdxComponentsDirectory: string
  }
  frontmatterMappings: {
    publishedDate: string | string[]
    title: string
    description: string
    draft: string
  }
} {
  return {
    pathOverrides: getEffectivePathOverrides(projectSettings, collectionName),
    frontmatterMappings: getEffectiveFrontmatterMappings(
      projectSettings,
      collectionName
    ),
  }
}
