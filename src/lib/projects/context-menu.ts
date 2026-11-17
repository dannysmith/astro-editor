import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import type { ListedProject } from '@/lib/bindings'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { showProjectSettings } from '../project-settings/actions'
import { pathMenuItems } from '../path-menu'
import { locateProject, removeProject } from './actions'

/**
 * The project list's native right-click menu. A missing project can only be
 * located, removed or have its path copied, and one on a drive that isn't
 * connected isn't offered Locate…, since it hasn't moved. The open project
 * can't be removed, and is the only one whose settings can be opened.
 */
export async function showProjectContextMenu(
  { project, missing, disconnected }: ListedProject,
  position: { x: number; y: number }
): Promise<void> {
  const { projectPath } = useProjectStore.getState()

  const items = [
    ...(await pathMenuItems(project.path, { exists: !missing })),
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
    ...(missing && !disconnected
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
