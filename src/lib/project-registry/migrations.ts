/**
 * Preference structure migrations
 *
 * This module handles migration from v1 to v2 preference structure.
 */

import { error as logError, info } from '@tauri-apps/plugin-log'
import { GlobalSettings, ProjectData } from './types'
import { DEFAULT_PROJECT_SETTINGS } from './defaults'

/**
 * Migrate global settings from v1 to v2
 *
 * v1: Has defaultProjectSettings in global settings
 * v2: No defaultProjectSettings (moved to hard-coded defaults)
 *
 * @param oldSettings - The v1 global settings object
 * @returns Migrated v2 global settings
 */
export function migrateGlobalSettingsV1toV2(
  oldSettings: Record<string, unknown>
): GlobalSettings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultProjectSettings, version, ...rest } = oldSettings

  const migratedSettings: GlobalSettings = {
    general: (rest.general as GlobalSettings['general']) || {
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
    },
    appearance: (rest.appearance as GlobalSettings['appearance']) || {
      headingColor: {
        light: '#191919',
        dark: '#cccccc',
      },
    },
    version: 2,
  }

  return migratedSettings
}

/**
 * Migrate project data from v1 to v2
 *
 * v1: Has metadata field (redundant with registry)
 * v2: No metadata field, has collections array, has version field
 *
 * @param oldProjectData - The v1 project data object
 * @returns Migrated v2 project data
 */
export function migrateProjectDataV1toV2(
  oldProjectData: Record<string, unknown>
): ProjectData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { metadata, ...rest } = oldProjectData

  const migratedData: ProjectData = {
    settings: (rest.settings as ProjectData['settings']) || {
      ...DEFAULT_PROJECT_SETTINGS,
    },
    collections: [], // Start with empty collections array
    version: 2,
  }

  return migratedData
}

/**
 * Check if global settings need migration
 */
export function needsGlobalSettingsMigration(
  settings: Record<string, unknown>
): boolean {
  const version = settings.version as number | undefined
  const hasDefaultProjectSettings = 'defaultProjectSettings' in settings

  // Needs migration if version is 1 (or missing) AND has defaultProjectSettings
  return (!version || version === 1) && hasDefaultProjectSettings
}

/**
 * Check if project data needs migration
 */
export function needsProjectDataMigration(
  projectData: Record<string, unknown>
): boolean {
  const version = projectData.version as number | undefined
  const hasMetadata = 'metadata' in projectData

  // Needs migration if version is missing AND has metadata field
  return !version && hasMetadata
}

/**
 * Migrate global settings with logging
 */
export async function migrateGlobalSettingsWithLogging(
  oldSettings: Record<string, unknown>
): Promise<GlobalSettings> {
  await info('Astro Editor [MIGRATION] Migrating global settings from v1 to v2')

  try {
    const migrated = migrateGlobalSettingsV1toV2(oldSettings)
    await info('Astro Editor [MIGRATION] Global settings migration completed')
    return migrated
  } catch (err) {
    await logError(
      `Astro Editor [MIGRATION] Failed to migrate global settings: ${String(err)}`
    )
    throw err
  }
}

/**
 * Migrate project data with logging
 */
export async function migrateProjectDataWithLogging(
  projectId: string,
  oldProjectData: Record<string, unknown>
): Promise<ProjectData> {
  await info(
    `Astro Editor [MIGRATION] Migrating project data for ${projectId} from v1 to v2`
  )

  try {
    const migrated = migrateProjectDataV1toV2(oldProjectData)
    await info(
      `Astro Editor [MIGRATION] Project data migration completed for ${projectId}`
    )
    return migrated
  } catch (err) {
    await logError(
      `Astro Editor [MIGRATION] Failed to migrate project data for ${projectId}: ${String(err)}`
    )
    throw err
  }
}
