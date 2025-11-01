import { invoke } from '@tauri-apps/api/core'
import { useProjectStore } from '../../store/projectStore'
import { toast } from '../toast'

export async function openProjectViaDialog(): Promise<void> {
  try {
    const projectPath = await invoke<string | null>('select_project_folder')
    if (projectPath) {
      useProjectStore.getState().setProject(projectPath)
      toast.success('Project opened successfully')
    }
  } catch (error) {
    toast.error('Failed to open project', {
      description:
        error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
}
