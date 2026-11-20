import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { error as logError } from '@tauri-apps/plugin-log'
import { pathMenuItems } from '../path-menu'

/** Offers Delete in a file's menu, greyed out while it can't be used */
export interface DeleteItem {
  enabled: boolean
  onDelete: () => void
}

/**
 * The Git tab's native right-click menu for a file it lists: Reveal in
 * Finder, Open in IDE and Copy Path, and Delete for a file AE added that the
 * entry no longer uses. A deleted file can only have its path copied.
 */
export async function showGitFileMenu(
  path: string,
  exists: boolean,
  position: { x: number; y: number },
  deleteItem?: DeleteItem
): Promise<void> {
  try {
    const items: (MenuItem | PredefinedMenuItem)[] = await pathMenuItems(path, {
      exists,
    })
    if (deleteItem) {
      items.push(
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          text: 'Delete…',
          enabled: deleteItem.enabled,
          action: deleteItem.onDelete,
        })
      )
    }
    const menu = await Menu.new({ items })
    await menu.popup(new LogicalPosition(position.x, position.y))
  } catch (error) {
    void logError(`Failed to show the Git tab's file menu: ${String(error)}`)
  }
}
