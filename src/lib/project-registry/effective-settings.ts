/**
 * Utilities for getting effective project settings with collection-scoped overrides
 */

import { useProjectStore } from '../../store/projectStore'
import { ProjectSettings } from './types'
import { ASTRO_PATHS } from '../constants'
import { getCollectionSettings } from './collection-settings'

/**
 * Hook to get effective settings with optional collection-specific overrides
 *
 * @param collectionName - Optional collection name for collection-scoped settings
 * @returns Effective settings with three-tier fallback (collection → project → defaults)
 */
export const useEffectiveSettings = (collectionName?: string) => {
  const { currentProjectSettings } = useProjectStore()

  // If collection is specified and we have project settings, use collection-scoped settings
  if (collectionName && currentProjectSettings) {
    return getCollectionSettings(currentProjectSettings, collectionName)
  }

  // Otherwise, return project-level settings (two-tier fallback: project → defaults)
  const getEffectivePathOverrides = () => {
    const defaults = {
      contentDirectory: ASTRO_PATHS.CONTENT_DIR,
      assetsDirectory: ASTRO_PATHS.ASSETS_DIR,
      mdxComponentsDirectory: ASTRO_PATHS.MDX_COMPONENTS_DIR,
    }

    const projectOverrides = currentProjectSettings?.pathOverrides || {}

    return {
      contentDirectory:
        projectOverrides.contentDirectory || defaults.contentDirectory,
      assetsDirectory:
        projectOverrides.assetsDirectory || defaults.assetsDirectory,
      mdxComponentsDirectory:
        projectOverrides.mdxComponentsDirectory ||
        defaults.mdxComponentsDirectory,
    }
  }

  const getEffectiveFrontmatterMappings = () => {
    const defaults = {
      publishedDate: ['pubDate', 'date', 'publishedDate'],
      title: 'title',
      description: 'description',
      draft: 'draft',
    }

    const projectOverrides = currentProjectSettings?.frontmatterMappings || {}

    return {
      publishedDate: projectOverrides.publishedDate || defaults.publishedDate,
      title: projectOverrides.title || defaults.title,
      description: projectOverrides.description || defaults.description,
      draft: projectOverrides.draft || defaults.draft,
    }
  }

  return {
    pathOverrides: getEffectivePathOverrides(),
    frontmatterMappings: getEffectiveFrontmatterMappings(),
  }
}

/**
 * Direct function for use outside React components
 *
 * @param currentProjectSettings - Project settings to use for fallback
 * @param collectionName - Optional collection name for collection-scoped settings
 * @returns Effective settings with three-tier fallback (collection → project → defaults)
 */
export const getEffectiveSettings = (
  currentProjectSettings?: ProjectSettings | null,
  collectionName?: string
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
} => {
  // If collection is specified and we have project settings, use collection-scoped settings
  if (collectionName && currentProjectSettings) {
    return getCollectionSettings(currentProjectSettings, collectionName)
  }

  // Otherwise, return project-level settings (two-tier fallback: project → defaults)
  const defaults = {
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
  }

  const projectOverrides = currentProjectSettings || {
    pathOverrides: {},
    frontmatterMappings: {},
  }

  return {
    pathOverrides: {
      contentDirectory:
        projectOverrides.pathOverrides?.contentDirectory ||
        defaults.pathOverrides.contentDirectory,
      assetsDirectory:
        projectOverrides.pathOverrides?.assetsDirectory ||
        defaults.pathOverrides.assetsDirectory,
      mdxComponentsDirectory:
        projectOverrides.pathOverrides?.mdxComponentsDirectory ||
        defaults.pathOverrides.mdxComponentsDirectory,
    },
    frontmatterMappings: {
      publishedDate:
        projectOverrides.frontmatterMappings?.publishedDate ||
        defaults.frontmatterMappings.publishedDate,
      title:
        projectOverrides.frontmatterMappings?.title ||
        defaults.frontmatterMappings.title,
      description:
        projectOverrides.frontmatterMappings?.description ||
        defaults.frontmatterMappings.description,
      draft:
        projectOverrides.frontmatterMappings?.draft ||
        defaults.frontmatterMappings.draft,
    },
  }
}
