import { invoke } from '@tauri-apps/api/core'
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

  try {
    await invoke('open_path_in_ide', { ideCommand, filePath })
    toast.success(`Opened in ${ideCommand}`)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    toast.error('Failed to open in IDE', {
      description: errorMessage,
    })
    // eslint-disable-next-line no-console
    console.error('IDE open failed:', error)
  }
}
