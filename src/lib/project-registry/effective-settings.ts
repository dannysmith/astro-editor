/**
 * Utilities for getting effective project settings
 */

import { useProjectStore } from '../../store/projectStore'
import { ProjectSettings } from './types'
import { ASTRO_PATHS } from '../constants'

/**
 * Hook to get effective project settings with overrides applied
 * Returns default values if no project is loaded or no overrides exist
 */
export const useEffectiveSettings = () => {
  const { currentProjectSettings } = useProjectStore()

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
 * Direct functions for use outside React components
 */
export const getEffectiveSettings = (
  currentProjectSettings?: ProjectSettings | null
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
