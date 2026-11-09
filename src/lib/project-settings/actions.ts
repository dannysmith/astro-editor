import { ask, open } from '@tauri-apps/plugin-dialog'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { toast } from '../toast'
import { relativePath } from './status'

/**
 * Opens the open project's settings, at a collection's page or the project's.
 * Only the open project's settings can be shown.
 */
export function showProjectSettings(collectionName: string | null = null) {
  if (!useProjectStore.getState().projectPath) return
  useUIStore.getState().setProjectSettingsOpen(true, collectionName)
}

/**
 * Asks for a folder inside the open project with the folder picker, starting
 * at `start`. Returns it relative to the project, or null if the writer
 * cancelled or chose a folder outside it.
 */
export async function chooseProjectFolder(
  start: string
): Promise<string | null> {
  const { projectPath } = useProjectStore.getState()
  if (!projectPath) return null

  const picked = await open({
    directory: true,
    defaultPath: start,
    title: 'Choose a Folder in the Project',
  })
  if (typeof picked !== 'string') return null

  const relative = relativePath(picked, projectPath)
  if (relative === picked) {
    toast.error('Choose a folder inside the project', {
      description: 'Astro Editor only edits files inside the project.',
    })
    return null
  }
  return relative
}

/**
 * After confirming, deletes the open project's settings for collections that
 * are no longer in its content config
 */
export async function clearSavedSettings(names: string[]): Promise<void> {
  const confirmed = await ask(
    `Astro Editor has settings saved for ${names.length === 1 ? 'a collection' : 'collections'} your content config no longer has: ${names.join(', ')}.`,
    {
      title: 'Clear these settings?',
      kind: 'warning',
      okLabel: 'Clear',
      cancelLabel: 'Cancel',
    }
  )
  if (!confirmed) return

  const { projectSettings, updateProjectSettings } = useProjectStore.getState()
  if (!projectSettings) return
  const collections = Object.fromEntries(
    Object.entries(projectSettings.collections).filter(
      ([name]) => !names.includes(name)
    )
  )
  await updateProjectSettings({ ...projectSettings, collections })
}
