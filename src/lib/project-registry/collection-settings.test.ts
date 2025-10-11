/**
 * Tests for collection-scoped settings with three-tier fallback
 */

import { describe, it, expect } from 'vitest'
import { getCollectionSettings } from './collection-settings'
import { ProjectSettings } from './types'
import { ASTRO_PATHS } from '../constants'

describe('getCollectionSettings', () => {
  describe('three-tier fallback for path overrides', () => {
    it('returns collection-specific path when set', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'project/content',
          assetsDirectory: 'project/assets',
        },
        frontmatterMappings: {},
        collections: [
          {
            name: 'blog',
            settings: {
              pathOverrides: {
                contentDirectory: 'content/blog',
                assetsDirectory: 'public/blog-images',
              },
            },
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.pathOverrides.contentDirectory).toBe('content/blog')
      expect(result.pathOverrides.assetsDirectory).toBe('public/blog-images')
    })

    it('falls back to project-level path when collection path not set', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'project/content',
          assetsDirectory: 'project/assets',
        },
        frontmatterMappings: {},
        collections: [
          {
            name: 'blog',
            settings: {
              // No path overrides for this collection
            },
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.pathOverrides.contentDirectory).toBe('project/content')
      expect(result.pathOverrides.assetsDirectory).toBe('project/assets')
    })

    it('falls back to defaults when neither collection nor project paths set', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {},
        frontmatterMappings: {},
        collections: [
          {
            name: 'blog',
            settings: {},
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.pathOverrides.contentDirectory).toBe(
        ASTRO_PATHS.CONTENT_DIR
      )
      expect(result.pathOverrides.assetsDirectory).toBe(ASTRO_PATHS.ASSETS_DIR)
    })

    it('handles mixed overrides (some collection, some project, some default)', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'project/content',
          // No assetsDirectory override at project level
        },
        frontmatterMappings: {},
        collections: [
          {
            name: 'blog',
            settings: {
              pathOverrides: {
                // Only override assets, not content
                assetsDirectory: 'public/blog-images',
              },
            },
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      // Content: project override
      expect(result.pathOverrides.contentDirectory).toBe('project/content')
      // Assets: collection override
      expect(result.pathOverrides.assetsDirectory).toBe('public/blog-images')
      // MDX: default (no overrides at any level)
      expect(result.pathOverrides.mdxComponentsDirectory).toBe(
        ASTRO_PATHS.MDX_COMPONENTS_DIR
      )
    })
  })

  describe('three-tier fallback for frontmatter mappings', () => {
    it('returns collection-specific mapping when set', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {},
        frontmatterMappings: {
          publishedDate: 'date',
          title: 'title',
        },
        collections: [
          {
            name: 'blog',
            settings: {
              frontmatterMappings: {
                publishedDate: 'publishDate',
                title: 'heading',
              },
            },
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.frontmatterMappings.publishedDate).toBe('publishDate')
      expect(result.frontmatterMappings.title).toBe('heading')
    })

    it('falls back to project-level mapping when collection mapping not set', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {},
        frontmatterMappings: {
          publishedDate: 'customDate',
          title: 'customTitle',
        },
        collections: [
          {
            name: 'blog',
            settings: {
              // No frontmatter mappings for this collection
            },
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.frontmatterMappings.publishedDate).toBe('customDate')
      expect(result.frontmatterMappings.title).toBe('customTitle')
    })

    it('falls back to defaults when neither collection nor project mappings set', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {},
        frontmatterMappings: {},
        collections: [
          {
            name: 'blog',
            settings: {},
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.frontmatterMappings.publishedDate).toEqual([
        'pubDate',
        'date',
        'publishedDate',
      ])
      expect(result.frontmatterMappings.title).toBe('title')
      expect(result.frontmatterMappings.description).toBe('description')
      expect(result.frontmatterMappings.draft).toBe('draft')
    })

    it('handles array-type publishedDate mapping from collection', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {},
        frontmatterMappings: {},
        collections: [
          {
            name: 'blog',
            settings: {
              frontmatterMappings: {
                publishedDate: ['publishDate', 'postDate'],
              },
            },
          },
        ],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.frontmatterMappings.publishedDate).toEqual([
        'publishDate',
        'postDate',
      ])
    })
  })

  describe('collection not found', () => {
    it('returns project-level settings when collection not found', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'project/content',
        },
        frontmatterMappings: {
          title: 'customTitle',
        },
        collections: [
          {
            name: 'blog',
            settings: {
              pathOverrides: {
                contentDirectory: 'content/blog',
              },
            },
          },
        ],
      }

      // Query for a collection that doesn't exist
      const result = getCollectionSettings(projectSettings, 'docs')

      // Should get project-level overrides, not the blog collection's
      expect(result.pathOverrides.contentDirectory).toBe('project/content')
      expect(result.frontmatterMappings.title).toBe('customTitle')
    })
  })

  describe('no collections array', () => {
    it('returns project-level settings when collections array is undefined', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'project/content',
        },
        frontmatterMappings: {
          title: 'customTitle',
        },
        // No collections array
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.pathOverrides.contentDirectory).toBe('project/content')
      expect(result.frontmatterMappings.title).toBe('customTitle')
    })

    it('returns project-level settings when collections array is empty', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'project/content',
        },
        frontmatterMappings: {
          title: 'customTitle',
        },
        collections: [],
      }

      const result = getCollectionSettings(projectSettings, 'blog')

      expect(result.pathOverrides.contentDirectory).toBe('project/content')
      expect(result.frontmatterMappings.title).toBe('customTitle')
    })
  })

  describe('complete integration scenario', () => {
    it('handles real-world configuration with multiple collections', () => {
      const projectSettings: ProjectSettings = {
        pathOverrides: {
          contentDirectory: 'src/content',
          assetsDirectory: 'src/assets',
        },
        frontmatterMappings: {
          publishedDate: 'date',
          title: 'title',
          description: 'description',
          draft: 'draft',
        },
        collections: [
          {
            name: 'blog',
            settings: {
              pathOverrides: {
                contentDirectory: 'content/blog-posts',
                assetsDirectory: 'public/blog-images',
              },
              frontmatterMappings: {
                publishedDate: 'publishDate',
                title: 'heading',
              },
            },
          },
          {
            name: 'docs',
            settings: {
              // Docs only overrides the content directory
              pathOverrides: {
                contentDirectory: 'content/documentation',
              },
            },
          },
        ],
      }

      // Blog collection: Full overrides
      const blogSettings = getCollectionSettings(projectSettings, 'blog')
      expect(blogSettings.pathOverrides.contentDirectory).toBe(
        'content/blog-posts'
      )
      expect(blogSettings.pathOverrides.assetsDirectory).toBe(
        'public/blog-images'
      )
      expect(blogSettings.frontmatterMappings.publishedDate).toBe('publishDate')
      expect(blogSettings.frontmatterMappings.title).toBe('heading')

      // Docs collection: Partial override (content dir only)
      const docsSettings = getCollectionSettings(projectSettings, 'docs')
      expect(docsSettings.pathOverrides.contentDirectory).toBe(
        'content/documentation'
      )
      expect(docsSettings.pathOverrides.assetsDirectory).toBe('src/assets') // Project level
      expect(docsSettings.frontmatterMappings.title).toBe('title') // Project level

      // Unconfigured collection: Project defaults
      const newsSettings = getCollectionSettings(projectSettings, 'news')
      expect(newsSettings.pathOverrides.contentDirectory).toBe('src/content')
      expect(newsSettings.pathOverrides.assetsDirectory).toBe('src/assets')
      expect(newsSettings.frontmatterMappings.publishedDate).toBe('date')
    })
  })
})
