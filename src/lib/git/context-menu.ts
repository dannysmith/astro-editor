import { Menu } from '@tauri-apps/api/menu'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { error as logError } from '@tauri-apps/plugin-log'
import { pathMenuItems } from '../path-menu'

/**
 * The Git tab's native right-click menu for a file it lists: Reveal in
 * Finder, Open in IDE and Copy Path. A deleted file can only have its path
 * copied.
 */
export async function showGitFileMenu(
  path: string,
  exists: boolean,
  position: { x: number; y: number }
): Promise<void> {
  try {
    const menu = await Menu.new({
      items: await pathMenuItems(path, { exists }),
    })
    await menu.popup(new LogicalPosition(position.x, position.y))
  } catch (error) {
    void logError(`Failed to show the Git tab's file menu: ${String(error)}`)
  }
}
