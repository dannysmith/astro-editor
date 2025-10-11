/**
 * Tests for preference structure migrations (v1 → v2)
 *
 * These tests verify that the migration logic correctly handles:
 * - Removing defaultProjectSettings from global settings
 * - Removing metadata from project data files
 * - Adding collections array to project data
 * - Preserving existing user preferences during migration
 */

import { describe, it, expect } from 'vitest'
import {
  migrateGlobalSettingsV1toV2,
  migrateProjectDataV1toV2,
  needsGlobalSettingsMigration,
  needsProjectDataMigration,
} from './migrations'
import { DEFAULT_PROJECT_SETTINGS } from './defaults'

describe('Global Settings Migration', () => {
  describe('migrateGlobalSettingsV1toV2', () => {
    it('removes defaultProjectSettings from v1 global settings', () => {
      const v1Settings = {
        general: {
          ideCommand: 'cursor',
          theme: 'dark',
          highlights: {
            nouns: true,
            verbs: false,
          },
          autoSaveDelay: 3,
        },
        appearance: {
          headingColor: {
            light: '#000000',
            dark: '#ffffff',
          },
        },
        defaultProjectSettings: {
          pathOverrides: {
            contentDirectory: 'content/',
          },
          frontmatterMappings: {
            title: 'heading',
          },
        },
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // Should not have defaultProjectSettings anymore
      expect(migrated).not.toHaveProperty('defaultProjectSettings')

      // Should preserve existing settings
      expect(migrated.general.ideCommand).toBe('cursor')
      expect(migrated.general.theme).toBe('dark')
      expect(migrated.general.autoSaveDelay).toBe(3)
      expect(migrated.appearance.headingColor.light).toBe('#000000')

      // Should update version to 2
      expect(migrated.version).toBe(2)
    })

    it('preserves all user preferences during migration', () => {
      const v1Settings = {
        general: {
          ideCommand: 'code',
          theme: 'light',
          highlights: {
            nouns: false,
            verbs: false,
            adjectives: true,
            adverbs: true,
            conjunctions: false,
          },
          autoSaveDelay: 5,
        },
        appearance: {
          headingColor: {
            light: '#ad1a72',
            dark: '#e255a1',
          },
        },
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // All user preferences should be preserved exactly
      expect(migrated.general).toEqual(v1Settings.general)
      expect(migrated.appearance).toEqual(v1Settings.appearance)
    })

    it('handles missing optional fields with defaults', () => {
      const v1Settings = {
        // Missing general and appearance entirely
        defaultProjectSettings: {
          pathOverrides: {},
        },
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // Should have default general settings
      expect(migrated.general).toBeDefined()
      expect(migrated.general.ideCommand).toBe('')
      expect(migrated.general.theme).toBe('system')
      expect(migrated.general.highlights.nouns).toBe(false)

      // Should have default appearance settings
      expect(migrated.appearance).toBeDefined()
      expect(migrated.appearance.headingColor).toBeDefined()
    })

    it('handles partial general settings', () => {
      const v1Settings = {
        general: {
          ideCommand: 'cursor',
          theme: 'dark',
          // Missing highlights and autoSaveDelay - these are filled by loadGlobalSettings
        },
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // Should preserve the set values
      expect(migrated.general.ideCommand).toBe('cursor')
      expect(migrated.general.theme).toBe('dark')

      // Note: Deep merging with defaults happens in loadGlobalSettings,
      // not in the migration function itself
    })
  })

  describe('needsGlobalSettingsMigration', () => {
    it('returns true when v1 format detected (has defaultProjectSettings)', () => {
      const v1Settings = {
        general: {},
        appearance: {},
        defaultProjectSettings: {},
        version: 1,
      }

      expect(needsGlobalSettingsMigration(v1Settings)).toBe(true)
    })

    it('returns true when version is missing but has defaultProjectSettings', () => {
      const v1Settings = {
        general: {},
        appearance: {},
        defaultProjectSettings: {},
      }

      expect(needsGlobalSettingsMigration(v1Settings)).toBe(true)
    })

    it('returns false when already v2 format (no defaultProjectSettings)', () => {
      const v2Settings = {
        general: {},
        appearance: {},
        version: 2,
      }

      expect(needsGlobalSettingsMigration(v2Settings)).toBe(false)
    })

    it('returns false when v1 version but no defaultProjectSettings', () => {
      const settings = {
        general: {},
        appearance: {},
        version: 1,
      }

      expect(needsGlobalSettingsMigration(settings)).toBe(false)
    })
  })
})

describe('Project Data Migration', () => {
  describe('migrateProjectDataV1toV2', () => {
    it('removes metadata field from v1 project data', () => {
      const v1ProjectData = {
        metadata: {
          id: 'test-project',
          name: 'Test Project',
          path: '/path/to/project',
          lastOpened: '2025-01-01T00:00:00.000Z',
          created: '2025-01-01T00:00:00.000Z',
        },
        settings: {
          pathOverrides: {
            contentDirectory: 'src/content/',
          },
          frontmatterMappings: {
            title: 'title',
          },
        },
      }

      const migrated = migrateProjectDataV1toV2(v1ProjectData)

      // Should not have metadata anymore (it's in the registry)
      expect(migrated).not.toHaveProperty('metadata')

      // Should preserve settings
      expect(migrated.settings).toEqual(v1ProjectData.settings)

      // Should add empty collections array
      expect(migrated.collections).toEqual([])

      // Should have version 2
      expect(migrated.version).toBe(2)
    })

    it('preserves user settings during migration', () => {
      const v1ProjectData = {
        metadata: {
          id: 'my-blog',
          name: 'My Blog',
          path: '/Users/me/projects/blog',
        },
        settings: {
          pathOverrides: {
            contentDirectory: 'content/',
            assetsDirectory: 'public/images/',
            mdxComponentsDirectory: 'components/mdx/',
          },
          frontmatterMappings: {
            publishedDate: 'publishDate',
            title: 'heading',
            description: 'summary',
            draft: 'published',
          },
          collectionViewSettings: {
            blog: { showDraftsOnly: true },
          },
        },
      }

      const migrated = migrateProjectDataV1toV2(v1ProjectData)

      // All settings should be preserved exactly
      expect(migrated.settings).toEqual(v1ProjectData.settings)
    })

    it('handles missing settings with defaults', () => {
      const v1ProjectData = {
        metadata: {
          id: 'test',
          name: 'Test',
          path: '/test',
        },
        // Missing settings entirely
      }

      const migrated = migrateProjectDataV1toV2(v1ProjectData)

      // Should use default project settings
      expect(migrated.settings).toEqual(DEFAULT_PROJECT_SETTINGS)
      expect(migrated.collections).toEqual([])
      expect(migrated.version).toBe(2)
    })

    it('preserves collections array if somehow already present in v1', () => {
      const v1ProjectData = {
        metadata: {},
        settings: {},
        collections: [
          {
            name: 'blog',
            settings: {
              pathOverrides: {
                contentDirectory: 'content/blog/',
              },
            },
          },
        ],
      }

      const migrated = migrateProjectDataV1toV2(v1ProjectData)

      // This shouldn't happen in practice, but if collections somehow exist,
      // the migration will create a fresh empty array
      expect(migrated.collections).toEqual([])
    })
  })

  describe('needsProjectDataMigration', () => {
    it('returns true when v1 format detected (has metadata, no version)', () => {
      const v1ProjectData = {
        metadata: {
          id: 'test',
          name: 'Test',
          path: '/test',
        },
        settings: {},
      }

      expect(needsProjectDataMigration(v1ProjectData)).toBe(true)
    })

    it('returns false when version field exists (already migrated)', () => {
      const v2ProjectData = {
        settings: {},
        collections: [],
        version: 2,
      }

      expect(needsProjectDataMigration(v2ProjectData)).toBe(false)
    })

    it('returns false when no metadata field present', () => {
      const projectData = {
        settings: {},
        // No metadata, no version - could be corrupted or manual creation
      }

      expect(needsProjectDataMigration(projectData)).toBe(false)
    })

    it('returns false when has version even with metadata', () => {
      const projectData = {
        metadata: {},
        settings: {},
        version: 2,
      }

      // Has version field, so it's considered migrated even if metadata exists
      expect(needsProjectDataMigration(projectData)).toBe(false)
    })
  })
})

describe('Migration Robustness', () => {
  describe('handles edge cases gracefully', () => {
    it('migrates global settings and preserves user values', () => {
      const v1Settings = {
        general: {
          highlights: {
            nouns: true,
            verbs: false,
            adjectives: true,
            adverbs: false,
            conjunctions: false,
          },
          theme: 'dark',
          autoSaveDelay: 3,
        },
        appearance: {
          headingColor: {
            light: '#000000',
            dark: '#ffffff',
          },
        },
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // Should preserve all user values exactly
      expect(migrated.general.highlights.nouns).toBe(true)
      expect(migrated.general.highlights.verbs).toBe(false)
      expect(migrated.general.theme).toBe('dark')
      expect(migrated.appearance.headingColor).toBeDefined()
    })

    it('handles project data with only partial settings', () => {
      const v1ProjectData = {
        metadata: { id: 'test', name: 'Test', path: '/test' },
        settings: {
          pathOverrides: {
            contentDirectory: 'content/',
            assetsDirectory: 'public/',
          },
          frontmatterMappings: {
            title: 'heading',
          },
        },
      }

      const migrated = migrateProjectDataV1toV2(v1ProjectData)

      // Should preserve user settings exactly as provided
      expect(migrated.settings.pathOverrides.contentDirectory).toBe('content/')
      expect(migrated.settings.frontmatterMappings.title).toBe('heading')
    })

    it('preserves all user-customized highlight settings', () => {
      const v1Settings = {
        general: {
          highlights: {
            nouns: false,
            verbs: true,
            adjectives: false,
            adverbs: true,
            conjunctions: false,
          },
        },
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // Every highlight setting should match the user's choices
      expect(migrated.general.highlights.nouns).toBe(false)
      expect(migrated.general.highlights.verbs).toBe(true)
      expect(migrated.general.highlights.adjectives).toBe(false)
      expect(migrated.general.highlights.adverbs).toBe(true)
      expect(migrated.general.highlights.conjunctions).toBe(false)
    })
  })

  describe('defaults are correct', () => {
    it('uses highlights: false for all types by default', () => {
      const v1Settings = {
        // No general settings at all
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      // All highlights should default to false
      expect(migrated.general.highlights.nouns).toBe(false)
      expect(migrated.general.highlights.verbs).toBe(false)
      expect(migrated.general.highlights.adjectives).toBe(false)
      expect(migrated.general.highlights.adverbs).toBe(false)
      expect(migrated.general.highlights.conjunctions).toBe(false)
    })

    it('uses empty string for ideCommand by default', () => {
      const v1Settings = {
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      expect(migrated.general.ideCommand).toBe('')
    })

    it('uses system theme by default', () => {
      const v1Settings = {
        version: 1,
      }

      const migrated = migrateGlobalSettingsV1toV2(v1Settings)

      expect(migrated.general.theme).toBe('system')
    })
  })
})
