import { create } from 'zustand'
import {
  commands,
  type GlobalSettings,
  type ProjectRegistry,
  type ProjectScan,
  type ProjectSettingsData,
} from '@/lib/bindings'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  error as logError,
  info,
  debug,
  warn as logWarn,
} from '@tauri-apps/plugin-log'
import { toast } from '../lib/toast'
import { formatErrorForLogging } from '../lib/diagnostics'
import { useEditorStore } from './editorStore'
import { useUIStore } from './uiStore'
import { projectName } from '../lib/projects/display'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'
import { wasStartupClaimedByDeepLink } from '../lib/deep-link'
import {
  fetchProjectScan,
  getProjectScan,
  isBrowsable,
} from '../lib/project-scan'
import type { DeepPartial } from '../types/common'

interface ProjectState {
  // Core identifiers
  projectPath: string | null
  currentProjectId: string | null
  selectedCollection: string | null
  currentSubdirectory: string | null // Relative path from collection root, e.g., "2024/january"

  // Settings as stored. Resolved values come from the project scan (`lib/project-scan.ts`).
  globalSettings: GlobalSettings | null
  registry: ProjectRegistry | null
  projectSettings: ProjectSettingsData | null

  // The collection folders the watcher was started with
  _watchedFolders: string[]

  // Event listener cleanup functions
  _unlistenFileChanged: UnlistenFn | null
  _unlistenSchemaChanged: UnlistenFn | null
  _unlistenWatcherRescan: UnlistenFn | null
  _unlistenWatcherRebuilt: UnlistenFn | null
  _unlistenWatcherError: UnlistenFn | null

  // Actions
  setProject: (path: string) => void
  setSelectedCollection: (collection: string | null) => void
  setCurrentSubdirectory: (subdirectory: string | null) => void
  navigateUp: () => void // Go up one level in directory hierarchy
  navigateToRoot: () => void // Go to collection root (clear subdirectory)
  loadPersistedProject: () => Promise<void>
  loadPreferences: () => Promise<void>
  updateGlobalSettings: (settings: DeepPartial<GlobalSettings>) => Promise<void>
  updateProjectSettings: (settings: ProjectSettingsData) => Promise<void>
  refreshProjectScan: () => Promise<void>
  startFileWatcher: () => Promise<void>
  stopFileWatcher: () => Promise<void>
}

/** Reads the project's scan again, bypassing the cache */
function rescan(projectPath: string): Promise<ProjectScan> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.collections(projectPath),
    queryFn: () => fetchProjectScan(projectPath),
    staleTime: 0,
  })
}

/** The folders a scan's browsable collections live in, to watch */
function collectionFolders(scan: ProjectScan | undefined): string[] {
  return (scan?.collections ?? [])
    .filter(isBrowsable)
    .map(collection => collection.path)
    .sort()
}

/** What decides which files are a collection's, to tell when that changed */
function collectionLayout(scan: ProjectScan | undefined, name: string) {
  const collection = scan?.collections.find(c => c.name === name)
  return JSON.stringify(
    collection && [collection.path, collection.base, collection.patterns]
  )
}

/**
 * Restarts the watcher if the scan's collection folders aren't the ones it
 * watches, since settings or the content config can move them
 */
async function watchFolders(scan: ProjectScan | undefined): Promise<void> {
  const { _watchedFolders, stopFileWatcher, startFileWatcher } =
    useProjectStore.getState()
  const folders = collectionFolders(scan)
  if (JSON.stringify(folders) === JSON.stringify(_watchedFolders)) return

  await info(
    'Astro Editor [WATCHER] Collection folders changed - restarting file watcher'
  )
  await stopFileWatcher()
  await startFileWatcher()
}

/** Merges `patch` into `settings`, object by object */
function deepMerge<T>(settings: T, patch: DeepPartial<T>): T {
  const merged = { ...settings } as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key]
    merged[key] =
      value && typeof value === 'object' && !Array.isArray(value) && current
        ? deepMerge(current, value as DeepPartial<typeof current>)
        : value
  }
  return merged as T
}

/**
 * Opens the project at `path`: registers it, loads its settings and scan, and
 * starts watching it. Returns false if it couldn't be opened, after logging
 * why and, unless `quiet`, telling the writer.
 */
async function openProject(path: string, quiet = false): Promise<boolean> {
  const { getState, setState } = useProjectStore
  await info(`Astro Editor [PROJECT_SETUP] Opening project: ${path}`)

  // Save unsaved edits first, or closing the file below loses them. If the
  // save fails it has said so and kept recovery data; stay put
  if (useEditorStore.getState().isDirty) {
    await useEditorStore.getState().saveFile(false)
    if (useEditorStore.getState().isDirty) {
      await logWarn(
        'Astro Editor [PROJECT_SETUP] Not switching projects: the open file has unsaved edits'
      )
      return false
    }
  }

  const result = await commands.openProject(path)
  if (result.status === 'error') {
    await logError(
      formatErrorForLogging('PROJECT_SETUP', 'Failed to open project', {
        projectPath: path,
        error: result.error,
      })
    )
    if (!quiet) {
      toast.error('Failed to open project', { description: result.error })
    }
    return false
  }
  const { project, settings } = result.data

  // Close the open file and stop the previous project's watcher and
  // listeners first; starting another doesn't, so they'd keep running and
  // every event would be handled once per project opened
  useEditorStore.getState().closeCurrentFile()
  await getState().stopFileWatcher()

  setState({
    projectPath: project.path,
    currentProjectId: project.id,
    projectSettings: settings,
    selectedCollection: null,
    currentSubdirectory: null,
  })
  await debug(`Astro Editor [PROJECT_SETUP] Project ID: ${project.id}`)

  // A cached scan could be from an earlier visit to this project
  await rescan(project.path).catch(async (error: unknown) => {
    await logWarn(`Astro Editor [PROJECT_SETUP] Scan failed: ${String(error)}`)
  })
  await getState().startFileWatcher()
  await info(`Astro Editor [PROJECT_SETUP] Opened project: ${project.id}`)
  return true
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projectPath: null,
  currentProjectId: null,
  selectedCollection: null,
  currentSubdirectory: null,
  globalSettings: null,
  registry: null,
  projectSettings: null,
  _watchedFolders: [],
  _unlistenFileChanged: null,
  _unlistenSchemaChanged: null,
  _unlistenWatcherRescan: null,
  _unlistenWatcherRebuilt: null,
  _unlistenWatcherError: null,

  // Actions
  setProject: (path: string) => {
    void openProject(path)
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
    const { projectPath } = get()
    if (!projectPath) return

    try {
      const scan = queryClient.getQueryData<ProjectScan>(
        queryKeys.collections(projectPath)
      )
      const folders = collectionFolders(scan)
      const result = await commands.startWatchingProject(projectPath, folders)
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      set({ _watchedFolders: folders })

      // Listen for file change events
      const unlistenFileChanged = await listen(
        'file-changed',
        (event: { payload: unknown }) => {
          // Handled by useFileChangeHandler (refreshes the sidebar and the open file)
          window.dispatchEvent(
            new CustomEvent('file-changed', {
              detail: event.payload,
            })
          )
        }
      )

      // The content config or a generated schema changed, which can change
      // the collections and where they are
      const unlistenSchemaChanged = await listen('schema-changed', () => {
        void get().refreshProjectScan()
      })

      // Listen for watcher recovery events
      const unlistenWatcherRescan = await listen('watcher-rescan', () => {
        void debug(
          'Astro Editor [WATCHER] Periodic rescan — refreshing queries'
        )
        void queryClient.invalidateQueries({
          queryKey: queryKeys.all,
        })
      })

      const unlistenWatcherRebuilt = await listen('watcher-rebuilt', () => {
        void info(
          'Astro Editor [WATCHER] File watcher rebuilt after disconnection'
        )
        void queryClient.invalidateQueries({
          queryKey: queryKeys.all,
        })
      })

      const unlistenWatcherError = await listen('watcher-error', () => {
        toast.warning('File watcher stopped unexpectedly', {
          description:
            'Changes to files may not be automatically detected. Try reopening the project.',
        })
      })

      // Store the unlisten functions for cleanup
      set({
        _unlistenFileChanged: unlistenFileChanged,
        _unlistenSchemaChanged: unlistenSchemaChanged,
        _unlistenWatcherRescan: unlistenWatcherRescan,
        _unlistenWatcherRebuilt: unlistenWatcherRebuilt,
        _unlistenWatcherError: unlistenWatcherError,
      })
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
    const {
      projectPath,
      _unlistenFileChanged,
      _unlistenSchemaChanged,
      _unlistenWatcherRescan,
      _unlistenWatcherRebuilt,
      _unlistenWatcherError,
    } = get()
    if (!projectPath) return

    try {
      // Clean up event listeners first
      _unlistenFileChanged?.()
      _unlistenSchemaChanged?.()
      _unlistenWatcherRescan?.()
      _unlistenWatcherRebuilt?.()
      _unlistenWatcherError?.()
      set({
        _unlistenFileChanged: null,
        _unlistenSchemaChanged: null,
        _unlistenWatcherRescan: null,
        _unlistenWatcherRebuilt: null,
        _unlistenWatcherError: null,
        _watchedFolders: [],
      })

      const result = await commands.stopWatchingProject(projectPath)
      if (result.status === 'error') {
        throw new Error(result.error)
      }
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

  /**
   * Reads the project's collections again, and restarts the watcher if their
   * folders moved
   */
  refreshProjectScan: async () => {
    const { projectPath } = get()
    if (!projectPath) return

    const scan = await rescan(projectPath).catch(async (error: unknown) => {
      await logWarn(
        `Astro Editor [PROJECT_SCAN] Rescan failed: ${String(error)}`
      )
      return undefined
    })
    await watchFolders(scan)
  },

  loadPersistedProject: async () => {
    await get().loadPreferences()

    // If the app was launched by a deep link, let it choose which project to
    // open instead of restoring the last one (avoids opening the wrong project
    // then switching). Bounded wait so we never hang on normal startup.
    if (await wasStartupClaimedByDeepLink()) {
      await info(
        'Astro Editor [PROJECT_SETUP] Deep link claimed startup - skipping persisted project load'
      )
      return
    }

    const { registry } = get()
    const lastProject =
      registry?.lastOpenedProject &&
      registry.projects[registry.lastOpenedProject]
    if (lastProject && !(await openProject(lastProject.path, true))) {
      toast.warning(`Couldn't open ${projectName(lastProject.path)}`, {
        description: 'It may have been moved or deleted.',
        action: {
          label: 'Show Projects',
          onClick: () => useUIStore.getState().setProjectListOpen(true),
        },
        duration: 10_000,
      })
    }
  },

  loadPreferences: async () => {
    const result = await commands.loadPreferences()
    if (result.status === 'error') {
      toast.error('Failed to load preferences', { description: result.error })
      await logError(`Failed to load preferences: ${result.error}`)
      return
    }
    set({
      globalSettings: result.data.globalSettings,
      registry: result.data.registry,
    })
  },

  updateGlobalSettings: async (patch: DeepPartial<GlobalSettings>) => {
    const { globalSettings } = get()
    if (!globalSettings) return

    const updated = deepMerge(globalSettings, patch)
    const result = await commands.saveGlobalSettings(updated)
    if (result.status === 'error') {
      toast.error('Failed to update global settings', {
        description: result.error,
      })
      await logError(`Failed to update global settings: ${result.error}`)
      return
    }
    set({ globalSettings: updated })

    // The new file type can fall back to the global preference
    if (patch.general?.defaultFileType) {
      await get().refreshProjectScan()
    }
  },

  updateProjectSettings: async (settings: ProjectSettingsData) => {
    const { currentProjectId, projectPath } = get()
    if (!currentProjectId || !projectPath) {
      toast.error('No project is currently open')
      return
    }

    const result = await commands.saveProjectSettings(
      currentProjectId,
      settings
    )
    if (result.status === 'error') {
      toast.error('Failed to update project settings', {
        description: result.error,
      })
      await logError(`Failed to update project settings: ${result.error}`)
      return
    }

    const before = getProjectScan()
    set({ projectSettings: settings })
    const after = await rescan(projectPath).catch(() => undefined)

    // If the open file's collection now has different files, the file may
    // not be in it any more, so save and close it
    const { currentFile } = useEditorStore.getState()
    if (
      currentFile &&
      collectionLayout(before, currentFile.collection) !==
        collectionLayout(after, currentFile.collection)
    ) {
      await info(
        'Astro Editor [PREFERENCES] Collection folder changed while its file is open - saving and closing it'
      )
      try {
        await useEditorStore.getState().saveFile()
      } catch (saveError) {
        await logError(
          `Astro Editor [PREFERENCES] Failed to save before settings change: ${String(saveError)}`
        )
      }
      toast.warning('Collection settings changed', {
        description:
          'The open file has been saved. Please reopen it to continue editing.',
      })
      useEditorStore.getState().closeCurrentFile()
    }

    // Every listing of the project's files: the pattern, folder or skipped
    // files setting may have changed what they show
    await queryClient.invalidateQueries({
      predicate: query =>
        query.queryKey[1] === projectPath &&
        (query.queryKey.includes('directory') ||
          query.queryKey.at(-1) === 'files'),
    })
    await watchFolders(after)
  },
}))

// Components can use direct selectors like:
// const projectPath = useProjectStore(state => state.projectPath)
