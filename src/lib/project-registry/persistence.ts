/**
 * Project registry persistence layer
 *
 * Handles saving and loading project data using the application support directory
 */

import { commands } from '@/lib/bindings'
import { error, info } from '@tauri-apps/plugin-log'
import { ProjectRegistry, GlobalSettings, ProjectData } from './types'
import { DEFAULT_PROJECT_REGISTRY, DEFAULT_GLOBAL_SETTINGS } from './defaults'
import {
  needsGlobalSettingsMigration,
  needsProjectDataMigration,
  migrateGlobalSettingsWithLogging,
  migrateProjectDataWithLogging,
} from './migrations'

/**
 * Get the application support directory paths
 */
async function getAppSupportPaths() {
  const result = await commands.getAppDataDir()
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  const appDataDir = result.data
  return {
    preferencesDir: `${appDataDir}/preferences`,
    projectsDir: `${appDataDir}/preferences/projects`,
    globalSettingsPath: `${appDataDir}/preferences/global-settings.json`,
    projectRegistryPath: `${appDataDir}/preferences/project-registry.json`,
  }
}

/**
 * Ensure preferences directory exists
 */
async function ensurePreferencesDir() {
  const { preferencesDir, projectsDir } = await getAppSupportPaths()

  try {
    // Use the safer app data file operations that create directories as needed
    const prefResult = await commands.writeAppDataFile(
      `${preferencesDir}/.init`,
      'directory initialized'
    )
    if (prefResult.status === 'error') {
      throw new Error(prefResult.error)
    }

    const projResult = await commands.writeAppDataFile(
      `${projectsDir}/.init`,
      'directory initialized'
    )
    if (projResult.status === 'error') {
      throw new Error(projResult.error)
    }

    // Clean up the init files
    try {
      await commands.readAppDataFile(`${preferencesDir}/.init`)
      await commands.readAppDataFile(`${projectsDir}/.init`)
    } catch {
      // Files might not exist, that's fine
    }
  } catch (err) {
    await error(`Failed to ensure preferences directories: ${String(err)}`)
    throw err
  }
}

/**
 * Load the project registry from disk
 */
export async function loadProjectRegistry(): Promise<ProjectRegistry> {
  try {
    const { projectRegistryPath } = await getAppSupportPaths()
    const result = await commands.readAppDataFile(projectRegistryPath)
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    const content = result.data

    const registry = JSON.parse(content) as ProjectRegistry

    // Validate and migrate if needed
    const finalRegistry = {
      ...DEFAULT_PROJECT_REGISTRY,
      ...registry,
      version: registry.version || 1,
    }
    return finalRegistry
  } catch {
    // File doesn't exist or is invalid, return defaults
    return { ...DEFAULT_PROJECT_REGISTRY }
  }
}

/**
 * Save the project registry to disk
 */
export async function saveProjectRegistry(
  registry: ProjectRegistry
): Promise<void> {
  try {
    await ensurePreferencesDir()
    const { projectRegistryPath } = await getAppSupportPaths()

    const result = await commands.writeAppDataFile(
      projectRegistryPath,
      JSON.stringify(registry, null, 2)
    )
    if (result.status === 'error') {
      throw new Error(result.error)
    }
  } catch (err) {
    await error(`Failed to save project registry: ${String(err)}`)
    throw err
  }
}

/**
 * Load global settings from disk
 */
export async function loadGlobalSettings(): Promise<GlobalSettings> {
  try {
    const { globalSettingsPath } = await getAppSupportPaths()
    const result = await commands.readAppDataFile(globalSettingsPath)
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    const content = result.data

    const rawSettings = JSON.parse(content) as Record<string, unknown>

    // Check if migration is needed
    if (needsGlobalSettingsMigration(rawSettings)) {
      await info(
        'Astro Editor [PREFERENCES] Global settings v1 detected, migrating to v2'
      )

      // Migrate the settings
      const migratedSettings =
        await migrateGlobalSettingsWithLogging(rawSettings)

      // Save the migrated settings to disk
      await saveGlobalSettings(migratedSettings)

      await info(
        'Astro Editor [PREFERENCES] Global settings migration completed and saved'
      )

      return migratedSettings
    }

    // Validate and deep merge to preserve nested objects
    const settings = rawSettings as Partial<GlobalSettings>
    return {
      ...DEFAULT_GLOBAL_SETTINGS,
      ...settings,
      general: {
        ...DEFAULT_GLOBAL_SETTINGS.general,
        ...(settings.general || {}),
        highlights: {
          ...DEFAULT_GLOBAL_SETTINGS.general.highlights,
          ...(settings.general?.highlights || {}),
        },
      },
      appearance: {
        ...DEFAULT_GLOBAL_SETTINGS.appearance,
        ...(settings.appearance || {}),
        headingColor: {
          ...DEFAULT_GLOBAL_SETTINGS.appearance.headingColor,
          ...(settings.appearance?.headingColor || {}),
        },
      },
      version: settings.version || DEFAULT_GLOBAL_SETTINGS.version,
    }
  } catch {
    // File doesn't exist or is invalid, return defaults
    // Deep clone to ensure nested objects are preserved
    return JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS)) as GlobalSettings
  }
}

/**
 * Save global settings to disk
 */
export async function saveGlobalSettings(
  settings: GlobalSettings
): Promise<void> {
  try {
    await ensurePreferencesDir()
    const { globalSettingsPath } = await getAppSupportPaths()

    const result = await commands.writeAppDataFile(
      globalSettingsPath,
      JSON.stringify(settings, null, 2)
    )
    if (result.status === 'error') {
      throw new Error(result.error)
    }
  } catch (err) {
    await error(`Failed to save global settings: ${String(err)}`)
    throw err
  }
}

/**
 * Load project-specific data from disk
 */
export async function loadProjectData(
  projectId: string
): Promise<ProjectData | null> {
  try {
    const { projectsDir } = await getAppSupportPaths()
    const projectFilePath = `${projectsDir}/${projectId}.json`

    const result = await commands.readAppDataFile(projectFilePath)
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    const content = result.data

    const rawData = JSON.parse(content) as Record<string, unknown>

    // Check if migration is needed
    if (needsProjectDataMigration(rawData)) {
      await info(
        `Astro Editor [PREFERENCES] Project data v1 detected for ${projectId}, migrating to v2`
      )

      // Migrate the project data
      const migratedData = await migrateProjectDataWithLogging(
        projectId,
        rawData
      )

      // Save the migrated data to disk
      await saveProjectData(projectId, migratedData)

      await info(
        `Astro Editor [PREFERENCES] Project data migration completed and saved for ${projectId}`
      )

      return migratedData
    }

    return rawData as Partial<ProjectData> as ProjectData
  } catch {
    // File doesn't exist or is invalid
    return null
  }
}

/**
 * Save project-specific data to disk
 */
export async function saveProjectData(
  projectId: string,
  data: ProjectData
): Promise<void> {
  try {
    await ensurePreferencesDir()
    const { projectsDir } = await getAppSupportPaths()
    const projectFilePath = `${projectsDir}/${projectId}.json`

    const result = await commands.writeAppDataFile(
      projectFilePath,
      JSON.stringify(data, null, 2)
    )
    if (result.status === 'error') {
      throw new Error(result.error)
    }
  } catch (err) {
    await error(`Failed to save project data: ${String(err)}`)
    throw err
  }
}
