import { useProjectStore } from '../store/projectStore'
import type {
  CollectionSettings,
  GlobalSettings,
  ProjectSettings,
} from '@/lib/bindings'
import type { DeepPartial } from '@/types/common'

/**
 * Drops unset values, so stored settings only hold what the writer chose. An
 * empty string, like a cleared text field, is unset too.
 */
function sparse<T extends object>(settings: T): T {
  return Object.fromEntries(
    Object.entries(settings).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as T
}

/**
 * Reads and writes preferences: global settings, and the open project's stored
 * project and collection settings. Resolved values (what a setting falls back
 * to) come from the project scan; see `hooks/settings`.
 */
export const usePreferences = () => {
  const globalSettings = useProjectStore(state => state.globalSettings)
  const projectSettings = useProjectStore(state => state.projectSettings)

  const updateGlobal = (settings: DeepPartial<GlobalSettings>) =>
    useProjectStore.getState().updateGlobalSettings(settings)

  /** Changes project settings; `undefined` unsets one */
  const updateProject = (settings: Partial<ProjectSettings>) => {
    const current = useProjectStore.getState().projectSettings
    if (!current) return Promise.resolve()
    return useProjectStore.getState().updateProjectSettings({
      ...current,
      project: sparse({ ...current.project, ...settings }),
    })
  }

  /** Changes a collection's settings; `undefined` unsets one */
  const updateCollectionSettings = (
    collectionName: string,
    settings: Partial<CollectionSettings>
  ) => {
    const current = useProjectStore.getState().projectSettings
    if (!current) return Promise.resolve()

    const collections = { ...current.collections }
    const updated = sparse({ ...collections[collectionName], ...settings })
    if (Object.keys(updated).length > 0) {
      collections[collectionName] = updated
    } else {
      delete collections[collectionName]
    }
    return useProjectStore
      .getState()
      .updateProjectSettings({ ...current, collections })
  }

  return {
    globalSettings,
    projectSettings,
    updateGlobal,
    updateProject,
    updateCollectionSettings,
  }
}
