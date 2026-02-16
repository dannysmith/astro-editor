import { useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import {
  GlobalSettings,
  ProjectSettings,
  CollectionSpecificSettings,
  DeepPartial,
} from '../lib/project-registry'

/**
 * Custom hook for managing preferences with easy read/write access
 */
export const usePreferences = () => {
  const globalSettings = useProjectStore(state => state.globalSettings)
  const currentProjectSettings = useProjectStore(
    state => state.currentProjectSettings
  )
  const updateGlobalSettings = useProjectStore(
    state => state.updateGlobalSettings
  )
  const updateProjectSettings = useProjectStore(
    state => state.updateProjectSettings
  )
  const currentProjectId = useProjectStore(state => state.currentProjectId)
  const projectPath = useProjectStore(state => state.projectPath)

  const updateGlobal = useCallback(
    (settings: DeepPartial<GlobalSettings>) => {
      return updateGlobalSettings(settings)
    },
    [updateGlobalSettings]
  )

  const updateProject = useCallback(
    (settings: Partial<ProjectSettings>) => {
      return updateProjectSettings(settings)
    },
    [updateProjectSettings]
  )

  /**
   * Update settings for a specific collection
   * Creates or updates the collection in the collections array
   */
  const updateCollectionSettings = useCallback(
    (collectionName: string, settings: CollectionSpecificSettings) => {
      if (!currentProjectSettings) return Promise.resolve()

      const existingCollections = currentProjectSettings.collections || []
      const collectionIndex = existingCollections.findIndex(
        c => c.name === collectionName
      )

      let updatedCollections
      if (collectionIndex >= 0) {
        // Update existing collection
        updatedCollections = [...existingCollections]
        updatedCollections[collectionIndex] = {
          name: collectionName,
          settings,
        }
      } else {
        // Add new collection
        updatedCollections = [
          ...existingCollections,
          {
            name: collectionName,
            settings,
          },
        ]
      }

      // Remove collections with no settings (cleanup)
      updatedCollections = updatedCollections.filter(c => {
        const hasPathOverrides =
          c.settings.pathOverrides &&
          Object.keys(c.settings.pathOverrides).some(
            key =>
              c.settings.pathOverrides?.[
                key as keyof typeof c.settings.pathOverrides
              ] !== undefined
          )
        const hasFrontmatterMappings =
          c.settings.frontmatterMappings &&
          Object.keys(c.settings.frontmatterMappings).some(
            key =>
              c.settings.frontmatterMappings?.[
                key as keyof typeof c.settings.frontmatterMappings
              ] !== undefined
          )
        const hasDefaultFileType = c.settings.defaultFileType !== undefined
        const hasUrlPattern = c.settings.urlPattern !== undefined
        return (
          hasPathOverrides ||
          hasFrontmatterMappings ||
          hasDefaultFileType ||
          hasUrlPattern
        )
      })

      return updateProjectSettings({
        collections: updatedCollections,
      })
    },
    [currentProjectSettings, updateProjectSettings]
  )

  // Get project name from path
  const projectName = projectPath
    ? projectPath.split('/').pop() || 'Unknown Project'
    : null

  return {
    globalSettings,
    currentProjectSettings,
    updateGlobal,
    updateProject,
    updateCollectionSettings,
    hasProject: !!currentProjectId,
    currentProjectId,
    projectPath,
    projectName,
  }
}
