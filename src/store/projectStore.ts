import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { error as logError, info, debug } from '@tauri-apps/plugin-log'
import { toast } from '../lib/toast'
import { ASTRO_PATHS } from '../lib/constants'
import { formatErrorForLogging } from '../lib/diagnostics'
import {
  projectRegistryManager,
  GlobalSettings,
  ProjectSettings,
} from '../lib/project-registry'
import { useEditorStore } from './editorStore'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'

interface ProjectState {
  // Core identifiers
  projectPath: string | null
  currentProjectId: string | null
  selectedCollection: string | null
  currentSubdirectory: string | null // Relative path from collection root, e.g., "2024/january"

  // Settings
  globalSettings: GlobalSettings | null
  currentProjectSettings: ProjectSettings | null

  // Actions
  setProject: (path: string) => void
  setSelectedCollection: (collection: string | null) => void
  setCurrentSubdirectory: (subdirectory: string | null) => void
  navigateUp: () => void // Go up one level in directory hierarchy
  navigateToRoot: () => void // Go to collection root (clear subdirectory)
  loadPersistedProject: () => Promise<void>
  initializeProjectRegistry: () => Promise<void>
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => Promise<void>
  updateProjectSettings: (settings: Partial<ProjectSettings>) => Promise<void>
  startFileWatcher: () => Promise<void>
  stopFileWatcher: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projectPath: null,
  currentProjectId: null,
  selectedCollection: null,
  currentSubdirectory: null,
  globalSettings: null,
  currentProjectSettings: null,

  // Actions
  setProject: (path: string) => {
    void (async () => {
      try {
        await info(
          `Astro Editor [PROJECT_SETUP] Starting project setup: ${path}`
        )

        // Close any currently open file when switching projects
        useEditorStore.getState().closeCurrentFile()

        // Register the project and get its ID
        await info(`Astro Editor [PROJECT_SETUP] Registering project: ${path}`)
        const projectId = await projectRegistryManager.registerProject(path)
        await debug(
          `Astro Editor [PROJECT_SETUP] Project ID generated: ${projectId}`
        )

        // Load project settings
        await info(
          `Astro Editor [PROJECT_SETUP] Loading project settings for: ${projectId}`
        )
        const projectSettings =
          await projectRegistryManager.getEffectiveSettings(projectId)

        set({
          projectPath: path,
          currentProjectId: projectId,
          currentProjectSettings: projectSettings,
          selectedCollection: null, // Reset collection when switching projects
          currentSubdirectory: null, // Reset subdirectory when switching projects
        })

        // Project persistence is now handled by the project registry system

        await info(`Astro Editor [PROJECT_SETUP] Starting file watcher`)
        await get().startFileWatcher()

        await info(
          `Astro Editor [PROJECT_SETUP] Project setup completed successfully: ${projectId}`
        )
      } catch (error) {
        const errorMsg = formatErrorForLogging(
          'PROJECT_SETUP',
          'Failed during project setup',
          {
            projectPath: path,
            step: 'Project Setup',
            error: error instanceof Error ? error : String(error),
          }
        )

        toast.error('Failed to set project', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
        await logError(errorMsg)
      }
    })()
  },

  setSelectedCollection: (collection: string | null) => {
    set({
      selectedCollection: collection,
      currentSubdirectory: null, // Always reset when switching collections
    })
  },

  setCurrentSubdirectory: (subdirectory: string | null) => {
    set({ currentSubdirectory: subdirectory })
  },

  navigateUp: () => {
    const { currentSubdirectory } = get()
    if (!currentSubdirectory) {
      // Already at collection root, go to collections list
      set({ selectedCollection: null })
    } else {
      // Go to parent directory
      const parts = currentSubdirectory.split('/')
      parts.pop() // Remove last segment
      set({
        currentSubdirectory: parts.length > 0 ? parts.join('/') : null,
      })
    }
  },

  navigateToRoot: () => {
    set({ currentSubdirectory: null })
  },

  startFileWatcher: async () => {
    const { projectPath, currentProjectSettings } = get()
    if (!projectPath) return

    try {
      // Use path override if configured
      const contentDirectory =
        currentProjectSettings?.pathOverrides?.contentDirectory

      if (contentDirectory && contentDirectory !== ASTRO_PATHS.CONTENT_DIR) {
        await invoke('start_watching_project_with_content_dir', {
          projectPath,
          contentDirectory,
        })
      } else {
        await invoke('start_watching_project', { projectPath })
      }

      // Listen for file change events
      const unlistenFileChanged = listen(
        'file-changed',
        (event: { payload: unknown }) => {
          // File refresh is now handled by TanStack Query invalidation
          // This event is kept for future use

          // Dispatch custom event for editor store to handle recently saved file logic
          window.dispatchEvent(
            new CustomEvent('file-changed', {
              detail: event.payload,
            })
          )
        }
      )

      // Store the unlisten function for cleanup (though we don't currently clean it up)
      void unlistenFileChanged
    } catch (error) {
      const errorMsg = formatErrorForLogging(
        'PROJECT_SETUP',
        'File watcher failed to start',
        { projectPath, error: error instanceof Error ? error : String(error) }
      )

      toast.warning('File watcher failed to start', {
        description: 'Changes to files may not be automatically detected.',
      })
      await logError(errorMsg)
    }
  },

  stopFileWatcher: async () => {
    const { projectPath } = get()
    if (!projectPath) return

    try {
      await invoke('stop_watching_project', { projectPath })
    } catch (error) {
      const errorMsg = formatErrorForLogging(
        'PROJECT_SETUP',
        'Failed to stop file watcher',
        { projectPath, error: error instanceof Error ? error : String(error) }
      )

      toast.warning('Failed to stop file watcher', {
        description: 'File watcher may still be running in the background.',
      })
      await logError(errorMsg)
    }
  },

  loadPersistedProject: async () => {
    try {
      await get().initializeProjectRegistry()

      // Try to load the last opened project from registry
      const lastProjectId = projectRegistryManager.getLastOpenedProjectId()
      if (lastProjectId) {
        // Get project metadata from registry (not from project data)
        const registry = projectRegistryManager.getRegistry()
        const projectMetadata = registry.projects[lastProjectId]

        if (projectMetadata) {
          try {
            // Verify the project path still exists before setting it
            await invoke('scan_project', {
              projectPath: projectMetadata.path,
            })
            // If no error, the project path is valid, so restore it
            get().setProject(projectMetadata.path)
          } catch (error) {
            toast.info('Previous project no longer available', {
              description: 'The last opened project could not be found.',
            })
            // eslint-disable-next-line no-console
            console.warn(
              'Saved project path no longer valid:',
              projectMetadata.path,
              error
            )
          }
        }
      }

      // Project persistence is now fully handled by the file-based project registry
      // Clean up any legacy localStorage entries to prevent conflicts
      try {
        localStorage.removeItem('astro-editor-last-project')
      } catch {
        // Ignore errors - localStorage cleanup is optional
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load persisted project:', error)
    }
  },

  initializeProjectRegistry: async () => {
    try {
      await info(
        'Astro Editor [PROJECT_REGISTRY] Initializing project registry'
      )
      await projectRegistryManager.initialize()
      const globalSettings = projectRegistryManager.getGlobalSettings()
      set({ globalSettings })
      await info(
        'Astro Editor [PROJECT_REGISTRY] Project registry initialized successfully'
      )
    } catch (error) {
      const errorMsg = formatErrorForLogging(
        'PROJECT_REGISTRY',
        'Failed to initialize project registry',
        {
          error: error instanceof Error ? error : String(error),
          step: 'Registry Initialization',
        }
      )

      toast.error('Failed to initialize project registry', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
      await logError(errorMsg)

      // Don't throw - allow app to continue without registry if needed
      await info(
        'Astro Editor [PROJECT_REGISTRY] Continuing without registry - some features may be limited'
      )
    }
  },

  updateGlobalSettings: async (settings: Partial<GlobalSettings>) => {
    try {
      await projectRegistryManager.updateGlobalSettings(settings)
      const updatedSettings = projectRegistryManager.getGlobalSettings()
      set({ globalSettings: updatedSettings })
    } catch (error) {
      toast.error('Failed to update global settings', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
      await logError(`Failed to update global settings: ${String(error)}`)
    }
  },

  updateProjectSettings: async (settings: Partial<ProjectSettings>) => {
    const { currentProjectId, projectPath, selectedCollection } = get()
    if (!currentProjectId) {
      toast.error('No project is currently open')
      return
    }

    try {
      // Check if path overrides are changing
      const pathOverridesChanged = !!settings.pathOverrides

      // If path overrides are changing and a file is open, handle gracefully
      if (pathOverridesChanged) {
        const { currentFile } = useEditorStore.getState()
        if (currentFile) {
          // Auto-save current file before settings change
          await info(
            'Astro Editor [PREFERENCES] Path settings changing while file is open - auto-saving'
          )
          try {
            await useEditorStore.getState().saveFile()
          } catch (saveError) {
            await logError(
              `Astro Editor [PREFERENCES] Failed to auto-save before settings change: ${String(saveError)}`
            )
          }

          // Show warning toast
          toast.warning('Path settings changed', {
            description:
              'The current file has been saved. Please reopen it to continue editing.',
          })

          // Close the current file to prevent save issues
          useEditorStore.getState().closeCurrentFile()
        }
      }

      await projectRegistryManager.updateProjectSettings(
        currentProjectId,
        settings
      )
      const updatedSettings =
        await projectRegistryManager.getEffectiveSettings(currentProjectId)
      set({ currentProjectSettings: updatedSettings })

      // Invalidate queries when settings change
      if (projectPath) {
        // If path overrides changed, invalidate collection-related queries
        if (settings.pathOverrides) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.collections(projectPath),
          })

          // Invalidate collection files for current collection if any
          if (selectedCollection) {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.collectionFiles(
                projectPath,
                selectedCollection
              ),
            })
          }

          // Restart file watcher with new paths
          await info(
            'Astro Editor [PREFERENCES] Path overrides changed - restarting file watcher'
          )
          await get().stopFileWatcher()
          await get().startFileWatcher()
        }

        // If frontmatter mappings changed, invalidate current file to update rendering
        if (settings.frontmatterMappings) {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.fileContent(projectPath, currentFile.id),
            })
          }
        }
      }
    } catch (error) {
      toast.error('Failed to update project settings', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
      await logError(`Failed to update project settings: ${String(error)}`)
    }
  },
}))

// Components can use direct selectors like:
// const projectPath = useProjectStore(state => state.projectPath)
