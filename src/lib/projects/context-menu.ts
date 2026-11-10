import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { error as logError } from '@tauri-apps/plugin-log'
import { commands, type ListedProject } from '@/lib/bindings'
import { getPlatform } from '@/hooks/usePlatform'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { showProjectSettings } from '../project-settings/actions'
import { openInIde } from '../ide'
import { getPlatformString } from '../platform-strings'
import { toast } from '../toast'
import { locateProject, removeProject } from './actions'

/**
 * The project list's native right-click menu. A missing project can only be
 * located, removed or have its path copied. The open project can't be removed,
 * and is the only one whose settings can be opened.
 */
export async function showProjectContextMenu(
  { project, missing }: ListedProject,
  position: { x: number; y: number }
): Promise<void> {
  const { globalSettings, projectPath } = useProjectStore.getState()
  const ideCommand = globalSettings?.general.ideCommand

  const items = [
    await MenuItem.new({
      text: getPlatformString('revealInFileManager', getPlatform()),
      enabled: !missing,
      action: () => {
        revealItemInDir(project.path).catch((error: unknown) => {
          void logError(`Failed to reveal project: ${String(error)}`)
        })
      },
    }),
    ...(ideCommand
      ? [
          await MenuItem.new({
            text: 'Open in IDE',
            enabled: !missing,
            action: () => void openInIde(project.path, ideCommand),
          }),
        ]
      : []),
    await MenuItem.new({
      text: 'Copy Path',
      action: () => {
        void commands.copyTextToClipboard(project.path).then(result => {
          if (result.status === 'error') {
            toast.error("Couldn't copy the path", { description: result.error })
          }
        })
      },
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    ...(project.path === projectPath
      ? [
          await MenuItem.new({
            text: 'Project Settings…',
            action: () => {
              useUIStore.getState().setProjectListOpen(false)
              showProjectSettings()
            },
          }),
        ]
      : []),
    ...(missing
      ? [
          await MenuItem.new({
            text: 'Locate…',
            action: () => void locateProject(project),
          }),
        ]
      : []),
    await MenuItem.new({
      text: 'Remove from Astro Editor…',
      enabled: project.path !== projectPath,
      action: () => void removeProject(project),
    }),
  ]

  const menu = await Menu.new({ items })
  await menu.popup(new LogicalPosition(position.x, position.y))
}
