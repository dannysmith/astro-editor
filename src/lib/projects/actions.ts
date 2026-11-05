import { ask } from '@tauri-apps/plugin-dialog'
import { commands, type ProjectMetadata } from '@/lib/bindings'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { queryClient } from '../query-client'
import { queryKeys } from '../query-keys'
import { toast } from '../toast'
import { projectName } from './display'

/** Shows the project list, which every way of opening a project goes to */
export function showProjectList(): void {
  useUIStore.getState().setProjectListOpen(true)
}

/** Closes the project list and switches to the project at `path` */
export function openListedProject(path: string): void {
  useUIStore.getState().setProjectListOpen(false)
  const { projectPath, setProject } = useProjectStore.getState()
  if (path !== projectPath) setProject(path)
}

/** Opens a folder AE may not have seen, chosen with the folder picker */
export async function openProjectViaDialog(): Promise<void> {
  const result = await commands.selectProjectFolder()
  if (result.status === 'error') {
    toast.error('Failed to open project', {
      description: result.error,
    })
    return
  }
  if (result.data) {
    useProjectStore.getState().setProject(result.data)
    toast.success('Project opened successfully')
  }
}

/**
 * After confirming, forgets a project and deletes its settings. The project's
 * own files are never touched.
 */
export async function removeProject(project: ProjectMetadata): Promise<void> {
  const confirmed = await ask(
    "Its settings in Astro Editor will be deleted. The project's own files won't be touched.",
    {
      title: `Remove ${projectName(project.path)} from Astro Editor?`,
      kind: 'warning',
      okLabel: 'Remove',
      cancelLabel: 'Cancel',
    }
  )
  if (!confirmed) return

  const result = await commands.removeProject(project.id)
  if (result.status === 'error') {
    toast.error("Couldn't remove the project", { description: result.error })
  }
  await queryClient.invalidateQueries({ queryKey: queryKeys.projectList })
}

/**
 * Asks where a missing project went, points it there with its settings, and
 * opens it. If the chosen folder is already registered (usually because it was
 * opened with Open Folder… first), asks before replacing that project's
 * settings with these.
 */
export async function locateProject(project: ProjectMetadata): Promise<void> {
  const picked = await commands.selectProjectFolder()
  if (picked.status === 'error') {
    toast.error("Couldn't locate the project", { description: picked.error })
    return
  }
  const path = picked.data
  if (!path) return

  let result = await commands.relocateProject(project.id, path, false)
  if (result.status === 'ok' && result.data === 'alreadyRegistered') {
    const replace = await ask(
      `Use ${projectName(project.path)}'s settings for it instead? Its current settings will be deleted.`,
      {
        title: `${projectName(path)} is already in Astro Editor`,
        kind: 'warning',
        okLabel: 'Replace',
        cancelLabel: 'Cancel',
      }
    )
    if (!replace) return
    result = await commands.relocateProject(project.id, path, true)
  }
  await queryClient.invalidateQueries({ queryKey: queryKeys.projectList })
  if (result.status === 'error') {
    toast.error("Couldn't locate the project", { description: result.error })
    return
  }

  // Reopen even if it's the open project: it now has the located project's
  // settings
  useUIStore.getState().setProjectListOpen(false)
  useProjectStore.getState().setProject(path)
}
