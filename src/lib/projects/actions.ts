import { commands } from '@/lib/bindings'
import { useProjectStore } from '../../store/projectStore'
import { toast } from '../toast'

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
