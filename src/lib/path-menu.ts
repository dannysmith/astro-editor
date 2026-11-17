/**
 * The items every native right-click menu for a file or folder starts with:
 * Reveal in Finder (or the platform's file manager), Open in IDE when one is
 * set, and Copy Path. Used by the sidebar's file menu, the project list's and
 * the Git tab's.
 */

import { MenuItem } from '@tauri-apps/api/menu'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { error as logError } from '@tauri-apps/plugin-log'
import { commands } from '@/lib/bindings'
import { getPlatform } from '@/hooks/usePlatform'
import { useProjectStore } from '../store/projectStore'
import { openInIde } from './ide'
import { getPlatformString } from './platform-strings'
import { toast } from './toast'

/**
 * The shared items for the file or folder at `path` (absolute). Without
 * `exists` (a missing project, a deleted file), only Copy Path works.
 */
export async function pathMenuItems(
  path: string,
  { exists = true }: { exists?: boolean } = {}
): Promise<MenuItem[]> {
  const ideCommand =
    useProjectStore.getState().globalSettings?.general.ideCommand
  return [
    await MenuItem.new({
      text: getPlatformString('revealInFileManager', getPlatform()),
      enabled: exists,
      action: () => {
        revealItemInDir(path).catch((error: unknown) => {
          void logError(`Failed to reveal ${path}: ${String(error)}`)
        })
      },
    }),
    ...(ideCommand
      ? [
          await MenuItem.new({
            text: 'Open in IDE',
            enabled: exists,
            action: () => void openInIde(path, ideCommand),
          }),
        ]
      : []),
    await MenuItem.new({
      text: 'Copy Path',
      action: () => {
        void commands.copyTextToClipboard(path).then(result => {
          if (result.status === 'error') {
            toast.error("Couldn't copy the path", { description: result.error })
          }
        })
      },
    }),
  ]
}
