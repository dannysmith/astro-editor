import { commands } from '@/lib/bindings'
import { error as logError } from '@tauri-apps/plugin-log'
import { useProjectStore } from '../store/projectStore'
import { toast } from './toast'

export async function openInIde(
  filePath: string,
  ideCmd?: string
): Promise<void> {
  const ideCommand =
    ideCmd || useProjectStore.getState().globalSettings?.general?.ideCommand

  if (!ideCommand) {
    toast.error('No IDE configured', {
      description: 'Please configure an IDE in preferences',
    })
    return
  }

  const result = await commands.openPathInIde(ideCommand, filePath)
  if (result.status === 'error') {
    toast.error('Failed to open in IDE', {
      description: result.error,
    })
    void logError(`IDE open failed: ${String(result.error)}`)
    return
  }
  toast.success('Opened in IDE')
}
