/**
 * Collection-scoped settings with three-tier fallback
 *
 * Fallback chain:
 * 1. Collection-specific setting (if set)
 * 2. Project-level setting (if set)
 * 3. Hard-coded default (from ASTRO_PATHS)
 */

import { ProjectSettings } from './types'
import { ASTRO_PATHS } from '../constants'

/**
 * Get effective settings for a specific collection with three-tier fallback
 *
 * @param projectSettings - Current project settings (may include collections array)
 * @param collectionName - Name of the collection to get settings for
 * @returns Fully resolved settings with all values populated including useRelativeAssetPaths
 */
export function getCollectionSettings(
  projectSettings: ProjectSettings | null | undefined,
  collectionName: string
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
  useRelativeAssetPaths: boolean
} {
  // Handle null/undefined projectSettings
  if (!projectSettings) {
    return {
      pathOverrides: {
        contentDirectory: ASTRO_PATHS.CONTENT_DIR,
        assetsDirectory: ASTRO_PATHS.ASSETS_DIR,
        mdxComponentsDirectory: ASTRO_PATHS.MDX_COMPONENTS_DIR,
      },
      frontmatterMappings: {
        publishedDate: ['pubDate', 'date', 'publishedDate'],
        title: 'title',
        description: 'description',
        draft: 'draft',
      },
      useRelativeAssetPaths: true,
    }
  }
  // Find collection-specific settings
  const collectionSettings = projectSettings.collections?.find(
    c => c.name === collectionName
  )?.settings

  // Define hard-coded defaults
  const defaults = {
    pathOverrides: {
      contentDirectory: ASTRO_PATHS.CONTENT_DIR,
      assetsDirectory: ASTRO_PATHS.ASSETS_DIR,
      mdxComponentsDirectory: ASTRO_PATHS.MDX_COMPONENTS_DIR,
    },
    frontmatterMappings: {
      publishedDate: ['pubDate', 'date', 'publishedDate'] as string | string[],
      title: 'title',
      description: 'description',
      draft: 'draft',
    },
  }

  // Implement three-tier fallback for path overrides
  const effectivePathOverrides = {
    contentDirectory:
      collectionSettings?.pathOverrides?.contentDirectory ||
      projectSettings.pathOverrides?.contentDirectory ||
      defaults.pathOverrides.contentDirectory,
    assetsDirectory:
      collectionSettings?.pathOverrides?.assetsDirectory ||
      projectSettings.pathOverrides?.assetsDirectory ||
      defaults.pathOverrides.assetsDirectory,
    mdxComponentsDirectory:
      projectSettings.pathOverrides?.mdxComponentsDirectory ||
      defaults.pathOverrides.mdxComponentsDirectory,
  }

  // Implement three-tier fallback for frontmatter mappings
  const effectiveFrontmatterMappings = {
    publishedDate:
      collectionSettings?.frontmatterMappings?.publishedDate ||
      projectSettings.frontmatterMappings?.publishedDate ||
      defaults.frontmatterMappings.publishedDate,
    title:
      collectionSettings?.frontmatterMappings?.title ||
      projectSettings.frontmatterMappings?.title ||
      defaults.frontmatterMappings.title,
    description:
      collectionSettings?.frontmatterMappings?.description ||
      projectSettings.frontmatterMappings?.description ||
      defaults.frontmatterMappings.description,
    draft:
      collectionSettings?.frontmatterMappings?.draft ||
      projectSettings.frontmatterMappings?.draft ||
      defaults.frontmatterMappings.draft,
  }

  // Three-tier fallback for useAbsoluteAssetPaths (inverted to useRelativeAssetPaths)
  // undefined or false → use relative paths (true)
  // true → use absolute paths (false)
  const useAbsolutePaths =
    collectionSettings?.useAbsoluteAssetPaths ??
    projectSettings.useAbsoluteAssetPaths ??
    false // Default to false (use relative paths, Astro convention)

  return {
    pathOverrides: effectivePathOverrides,
    frontmatterMappings: effectiveFrontmatterMappings,
    useRelativeAssetPaths: !useAbsolutePaths, // Invert: absolute=false means relative=true
  }
}
