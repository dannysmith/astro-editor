import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { invoke } from '@tauri-apps/api/core'
import { remove } from '@tauri-apps/plugin-fs'
import { openPath } from '@tauri-apps/plugin-opener'
import { ask } from '@tauri-apps/plugin-dialog'
import type { FileEntry } from '@/types'
import { useProjectStore } from '../../store/projectStore'

interface ContextMenuOptions {
  file: FileEntry
  position: { x: number; y: number }
  onRefresh?: () => void
  onRename?: (file: FileEntry) => void
}

export class FileContextMenu {
  private static async showConfirmationDialog(
    fileName: string
  ): Promise<boolean> {
    return ask(`Are you sure you want to delete "${fileName}"?`, {
      title: 'Delete File',
      kind: 'warning',
    })
  }

  private static getIdeCommand(): string | null {
    try {
      // Access global settings directly from the store
      const { globalSettings } = useProjectStore.getState()
      return globalSettings?.general?.ideCommand || null
    } catch {
      return null
    }
  }

  private static generateDuplicatePath(originalPath: string): string {
    const lastSlashIndex = originalPath.lastIndexOf('/')
    const directory = originalPath.substring(0, lastSlashIndex)
    const fileName = originalPath.substring(lastSlashIndex + 1)

    const lastDotIndex = fileName.lastIndexOf('.')
    if (lastDotIndex === -1) {
      // No extension
      return `${directory}/${fileName}-1`
    }

    const nameWithoutExt = fileName.substring(0, lastDotIndex)
    const extension = fileName.substring(lastDotIndex)
    return `${directory}/${nameWithoutExt}-1${extension}`
  }

  static async show({
    file,
    position,
    onRefresh,
    onRename,
  }: ContextMenuOptions): Promise<void> {
    try {
      // Get current IDE setting from global preferences
      const ideCommand = FileContextMenu.getIdeCommand()

      // Get project path from store
      const { projectPath } = useProjectStore.getState()
      if (!projectPath) {
        throw new Error('No project path available')
      }

      // Create menu items
      const revealItem = await MenuItem.new({
        id: 'reveal-in-finder',
        text: 'Reveal in Finder',
        action: () => {
          void (async () => {
            try {
              // Get the directory containing the file
              const directory = file.path.substring(
                0,
                file.path.lastIndexOf('/')
              )
              await openPath(directory)
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to reveal in Finder:', error)
            }
          })()
        },
      })

      const copyPathItem = await MenuItem.new({
        id: 'copy-path',
        text: 'Copy Path',
        action: () => {
          void (async () => {
            try {
              await invoke('copy_text_to_clipboard', { text: file.path })
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to copy path:', error)
            }
          })()
        },
      })

      const duplicateItem = await MenuItem.new({
        id: 'duplicate-file',
        text: 'Duplicate',
        action: () => {
          void (async () => {
            try {
              const duplicatePath = FileContextMenu.generateDuplicatePath(
                file.path
              )

              // Read the original file content
              const content = await invoke('read_file', {
                filePath: file.path,
                projectRoot: projectPath,
              })

              // Parse the duplicate path into directory and filename
              const lastSlashIndex = duplicatePath.lastIndexOf('/')
              const directory = duplicatePath.substring(0, lastSlashIndex)
              const filename = duplicatePath.substring(lastSlashIndex + 1)

              // Create the duplicate file
              await invoke('create_file', {
                directory,
                filename,
                content,
                projectRoot: projectPath,
              })

              // Refresh the file list if callback is provided
              if (onRefresh) {
                onRefresh()
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to duplicate file:', error)
            }
          })()
        },
      })

      const renameItem = await MenuItem.new({
        id: 'rename-file',
        text: 'Rename',
        action: () => {
          try {
            if (onRename) {
              onRename(file)
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to initiate rename:', error)
          }
        },
      })

      // Create "Open in IDE" menu item if IDE is configured
      const openInIdeItem = ideCommand
        ? await MenuItem.new({
            id: 'open-in-ide',
            text: `Open in ${ideCommand}`,
            action: () => {
              void (async () => {
                try {
                  await invoke('open_path_in_ide', {
                    ideCommand,
                    filePath: file.path,
                  })
                } catch (error) {
                  // eslint-disable-next-line no-console
                  console.error('Failed to open file in IDE:', error)
                }
              })()
            },
          })
        : null

      const separator = await PredefinedMenuItem.new({
        text: 'separator',
        item: 'Separator',
      })

      const deleteItem = await MenuItem.new({
        id: 'delete-file',
        text: 'Delete',
        action: () => {
          void (async () => {
            try {
              const confirmed = await FileContextMenu.showConfirmationDialog(
                file.name || file.path.split('/').pop() || 'file'
              )
              if (confirmed) {
                await remove(file.path)
                // Refresh the file list if callback is provided
                if (onRefresh) {
                  onRefresh()
                }
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Failed to delete file:', error)
            }
          })()
        },
      })

      // Create and show the context menu
      const menuItems = [
        revealItem,
        copyPathItem,
        duplicateItem,
        renameItem,
        ...(openInIdeItem ? [openInIdeItem] : []),
        separator,
        deleteItem,
      ]

      const menu = await Menu.new({
        items: menuItems,
      })

      // Show the menu at the specified position
      await menu.popup(new LogicalPosition(position.x, position.y))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to show context menu:', error)
    }
  }
}
